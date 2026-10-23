// claude/sql-sandbox/060-guaranteed-rolls.mjs — runs 060_guaranteed_rolls.sql on a THROWAWAY in-memory Postgres (PGlite, WASM)
// against a stub of the tables it touches, then plays it adversarially (41 checks). Never touches Supabase.
// RUN: in an empty scratch folder, npm i @electric-sql/pglite@0.3.0, copy this file there, then: node 060-guaranteed-rolls.mjs <repo path>
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const REPO = process.argv[2];
const db = new PGlite();
const q = async (sql, params) => (await db.query(sql, params)).rows;
const one = async (sql, params) => (await q(sql, params))[0];

await db.exec(`
create role anon; create role authenticated;
create schema private;
create table public.profiles (id uuid primary key default gen_random_uuid(), username text, secret text unique,
  level int default 1, rebirths int default 0, stars int default 0, lifetime_words bigint default 0, lifetime_letters bigint default 0,
  wins_per_word double precision default 0, week_words int default 0, s2_week_stars0 int default 0, s2_week_rb0 int default 0,
  s2_week_lv0 int default 1, rb_words0 bigint, s2_roll_seq int default 0, s2_rolls int default 0, s2_since_epic int default 0,
  s2_since_leg int default 0, s2_roll_spent bigint default 0, reset_all boolean default false, submitted_at timestamptz,
  updated_at timestamptz, is_tester boolean default false, created_at timestamptz default now());
create function private.profile_for_secret(s text) returns uuid language sql stable as $$ select id from public.profiles where secret = s $$;
create function private.tier_rank(t text) returns integer language sql immutable as $$
  select case t when 'rare' then 0 when 'epic' then 1 when 'legendary' then 2 when 'mythic' then 3 when 'secret' then 4 else -1 end; $$;
create table private.gear_pool (mark_id text primary key, tier text not null, x double precision not null, ord integer not null);
create table private.gear_owned (profile_id uuid not null references public.profiles(id) on delete cascade, mark_id text not null,
  copies integer not null default 1, shiny boolean not null default false, source text not null default 'roll' check (source in ('roll','grandfather')),
  first_at timestamptz not null default now(), primary key (profile_id, mark_id));
create table private.roll_log (id bigserial primary key, profile_id uuid, seq int, idx int default 0, mark_id text, tier text, state text);
create table private.gear_refused (profile_id uuid, mark_id text);
create table private.cloud_saves (profile_id uuid primary key, blob text, score numeric, saved_at timestamptz);
create table public.unlisted_finds (profile_id uuid);
create table public.profile_showcase (profile_id uuid);
create table public.rebirth_requests (profile_id uuid);
`);
const pool = readFileSync(`${REPO}/supabase/migrations/059_gear_expansion.sql`, 'utf8');
await db.exec(pool.slice(pool.indexOf('insert into private.gear_pool'), pool.indexOf(';', pool.indexOf('insert into private.gear_pool')) + 1));
const mig = readFileSync(`${REPO}/supabase/migrations/060_guaranteed_rolls.sql`, 'utf8').replace(/notify pgrst[^;]*;/g, '');
await db.exec(mig);
await db.exec(mig); // safe to re-run

const A = 'a'.repeat(40), B = 'b'.repeat(40);
const pa = (await one(`insert into public.profiles (username, secret) values ('ann', $1) returning id`, [A])).id;
const pb = (await one(`insert into public.profiles (username, secret) values ('bob', $1) returning id`, [B])).id;
const rpc = async (fn, args) => (await one(`select public.${fn}(${args.map((_, i) => `$${i + 1}`).join(', ')}) as r`, args)).r;
const utc = Math.floor(Date.now() / 86400000);
let pass = 0;
const ok = (c, m) => { assert.ok(c, m); pass += 1; console.log('ok -', m); };

// ---- anon can touch nothing private
const priv = await q(`select has_table_privilege('anon', 'private.roll_tickets', 'insert') i, has_table_privilege('anon', 'private.roll_tickets', 'select') s,
  has_function_privilege('anon', 'private.grant_ticket(uuid, text, text, text, text)', 'execute') g,
  has_function_privilege('anon', 'public.lb_ticket_roll(text, uuid)', 'execute') r,
  has_table_privilege('anon', 'private.streak_track', 'update') u`);
ok(!priv[0].i && !priv[0].s && !priv[0].g && !priv[0].u, 'anon cannot read/insert tickets, update the track, or call grant_ticket');
ok(priv[0].r, 'anon can call lb_ticket_roll');

// ---- no tickets → nothing to spend; a made-up id is refused
ok((await rpc('lb_tickets', [A])).tickets.length === 0, 'a fresh player has no tickets');
const fake = await rpc('lb_ticket_roll', [A, '00000000-0000-0000-0000-000000000001']);
ok(fake.ok === false && fake.reason === 'no_ticket', 'a forged ticket id rolls nothing');

// ---- grant (server-side only) is idempotent by key
const t1 = (await one(`select private.grant_ticket($1, 'legendary', 'admin', 'k1', 'gift') id`, [pa])).id;
const t1b = (await one(`select private.grant_ticket($1, 'legendary', 'admin', 'k1', 'gift') id`, [pa])).id;
ok(t1 === t1b, 'the same grant key never pays twice');
let bad = null; try { await q(`select private.grant_ticket($1, 'secret', 'admin', 'k2')`, [pa]); } catch (e) { bad = e; }
ok(bad, 'no SECRET+ floor ticket can be minted');
ok((await rpc('lb_tickets', [A])).tickets.length === 1, 'ann sees one ticket');
ok((await rpc('lb_tickets', [B])).tickets.length === 0, 'bob sees none of ann\'s');

// ---- another player cannot spend it
const steal = await rpc('lb_ticket_roll', [B, t1]);
ok(steal.ok === false && steal.reason === 'no_ticket', 'bob cannot roll ann\'s ticket');
ok((await rpc('lb_ticket_claim', [B, t1])).ok === false, 'bob cannot claim ann\'s ticket');

// ---- claim before reserve is refused
ok((await rpc('lb_ticket_claim', [A, t1])).reason === 'not_reserved', 'claim without a reservation is refused');

// ---- reserve: LEGENDARY+, same pick on repeat
const r1 = await rpc('lb_ticket_roll', [A, t1]);
ok(r1.ok && ['legendary', 'mythic', 'secret'].includes(r1.pick.tier), `LEGENDARY+ ticket rolled ${r1.pick.tier} ${r1.pick.mark}`);
const r1b = await rpc('lb_ticket_roll', [A, t1]);
ok(r1b.again && r1b.pick.mark === r1.pick.mark && r1b.pick.shiny === r1.pick.shiny, 'asking again returns the SAME pick (no re-roll)');
const listed = (await rpc('lb_tickets', [A])).tickets[0];
ok(listed.state === 'reserved' && listed.pick.mark === r1.pick.mark, 'the reserved pick is listed for an interrupted reveal');
// pity untouched
const before = await one(`select s2_roll_seq, s2_rolls, s2_since_epic, s2_since_leg, s2_roll_spent from public.profiles where id = $1`, [pa]);
const c1 = await rpc('lb_ticket_claim', [A, t1]);
ok(c1.ok, 'claim lands');
const owned = await one(`select copies from private.gear_owned where profile_id = $1 and mark_id = $2`, [pa, r1.pick.mark]);
ok(owned && owned.copies === 1, 'the gear is server-owned');
const after = await one(`select s2_roll_seq, s2_rolls, s2_since_epic, s2_since_leg, s2_roll_spent from public.profiles where id = $1`, [pa]);
ok(JSON.stringify(before) === JSON.stringify(after), 'pity / seq / spend counters untouched by a ticket');
// re-spend
const again = await rpc('lb_ticket_roll', [A, t1]);
ok(again.ok === false && again.reason === 'spent', 'a spent ticket never rolls again');
const c2 = await rpc('lb_ticket_claim', [A, t1]);
ok(c2.ok && c2.again, 'a retried claim is ok …');
ok((await one(`select copies from private.gear_owned where profile_id = $1 and mark_id = $2`, [pa, r1.pick.mark])).copies === 1, '… and never adds a second copy');
ok((await rpc('lb_tickets', [A])).tickets.length === 0, 'spent tickets leave the list');

// ---- revoked
const t3 = (await one(`select private.grant_ticket($1, 'epic', 'admin', 'k3') id`, [pa])).id;
await q(`update private.roll_tickets set state = 'revoked' where id = $1`, [t3]);
ok((await rpc('lb_ticket_roll', [A, t3])).reason === 'no_ticket', 'a revoked ticket rolls nothing');

// ---- floor respected for every tier + prefer unowned
const counts = {};
for (const tier of ['rare', 'epic', 'legendary', 'mythic']) {
  for (let i = 0; i < 60; i += 1) {
    const id = (await one(`select private.grant_ticket($1, $2, 'admin', $3) id`, [pb, tier, `f-${tier}-${i}`])).id;
    const r = await rpc('lb_ticket_roll', [B, id]);
    assert.ok(r.ok);
    const rk = { rare: 0, epic: 1, legendary: 2, mythic: 3, secret: 4 };
    assert.ok(rk[r.pick.tier] >= rk[tier], `${tier} ticket gave ${r.pick.tier}`);
    counts[tier] = counts[tier] || {}; counts[tier][r.pick.tier] = (counts[tier][r.pick.tier] || 0) + 1;
    await rpc('lb_ticket_claim', [B, id]);
  }
}
ok(true, `every ticket stays at or above its floor: ${JSON.stringify(counts)}`);
// prefer unowned: a fresh player, 12 legendary+ tickets → every LEGENDARY landed is distinct
const C = 'c'.repeat(40);
const pc = (await one(`insert into public.profiles (username, secret) values ('cat', $1) returning id`, [C])).id;
const legs = [];
for (let i = 0; i < 12; i += 1) {
  const id = (await one(`select private.grant_ticket($1, 'legendary', 'admin', $2) id`, [pc, `u${i}`])).id;
  const r = await rpc('lb_ticket_roll', [C, id]);
  await rpc('lb_ticket_claim', [C, id]);
  if (r.pick.tier === 'legendary') legs.push(r.pick.mark);
}
ok(new Set(legs).size === legs.length, `prefer-unowned: ${legs.length} legendaries, all distinct`);

// ---- streak check-in
const D = 'd'.repeat(40);
const pd = (await one(`insert into public.profiles (username, secret) values ('dee', $1) returning id`, [D])).id;
ok((await rpc('lb_streak_checkin', [D, utc])).reason === 'play', 'no play → no check-in');
const play = async (w) => q(`update public.profiles set lifetime_words = lifetime_words + $2, submitted_at = now() where id = $1`, [pd, w]);
ok((await rpc('lb_streak_checkin', [D, utc + 2])).reason === 'day', 'a day 2 ahead of UTC is refused');
ok((await rpc('lb_streak_checkin', [D, utc - 2])).reason === 'day', 'a day 2 behind UTC is refused');
await play(5);
let s = await rpc('lb_streak_checkin', [D, utc - 1]);
ok(s.ok && s.day === 1, 'day 1 checks in');
ok((await rpc('lb_streak_checkin', [D, utc - 1])).again, 'the same day again moves nothing');
ok((await rpc('lb_streak_checkin', [D, utc])).reason === 'play', 'day 2 without new words is refused');
await play(3);
s = await rpc('lb_streak_checkin', [D, utc]); ok(s.ok && s.day === 2, 'day 2 checks in');
await play(3);
s = await rpc('lb_streak_checkin', [D, utc + 1]);
ok(s.ok === false && s.reason === 'early', 'day 3 within a day of day 1 (clock game) is refused');
// simulate real time: move the run start back 5 days and walk the week
const walk = async (back) => q(`update private.streak_track set run_at = now() - make_interval(days => $2), last_day = last_day - 10 + 0 where profile_id = $1`, [pd, back]);
// rewind so days can advance: shift last_day into the past one by one
await q(`update private.streak_track set run_at = now() - interval '6 days', last_day = $2 where profile_id = $1`, [pd, utc - 6]);
// last_day = utc-6 means the next legit day is utc-5 — but the window only accepts utc-1..utc+1, so gap = 5 → reset
s = await rpc('lb_streak_checkin', [D, utc - 1]);
ok(s.ok && s.day === 1, 'two+ missed days send the track back to DAY 1');
// walk a real week by rewriting the stored days (the window is ±1 of now)
async function nextDay(n) { await q(`update private.streak_track set last_day = $2 - 1, run_at = now() - make_interval(days => $3) where profile_id = $1`, [pd, utc, n]); await play(2); return rpc('lb_streak_checkin', [D, utc]); }
const seen = [];
for (let k = 2; k <= 7; k += 1) { const r = await nextDay(k - 1); seen.push(r); assert.ok(r.ok, JSON.stringify(r)); assert.equal(r.day, k); }
ok(seen[2].ticket && seen[2].ticket.tier === 'rare', 'DAY 4 mints a RARE+ ticket');
ok(seen[5].ticket && seen[5].ticket.tier === 'legendary', 'DAY 7 mints a LEGENDARY+ ticket');
ok(seen[5].pos === 0 && seen[5].week === 2, 'after DAY 7 the track wraps to DAY 1, week 2');
const dt = (await rpc('lb_tickets', [D])).tickets;
ok(dt.length === 2 && dt[0].tier === 'legendary', 'dee owns exactly the two streak tickets (LEGENDARY+ listed first)');
// one missed day holds
await q(`update private.streak_track set last_day = $2 - 2 where profile_id = $1`, [pd, utc]); await play(1);
s = await rpc('lb_streak_checkin', [D, utc]); ok(s.ok && s.day === 1 && s.week === 2, 'one missed day holds the place');
// tester skips the span rule only
await q(`update public.profiles set is_tester = true where id = $1`, [pd]);
await q(`update private.streak_track set last_day = $2 - 1 where profile_id = $1`, [pd, utc]); await play(1);
await q(`update private.streak_track set last_day = $2 - 2, run_at = now() where profile_id = $1`, [pd, utc]); await play(1);
s = await rpc('lb_streak_checkin', [D, utc]); ok(s.ok, 'TESTER skips the span check');

// ---- reset wipes tickets + track
await q(`update public.profiles set reset_all = true where id = $1`, [pd]);
await rpc('lb_reset_ack', [D, '{}', 0]);
ok((await rpc('lb_tickets', [D])).tickets.length === 0 && (await rpc('lb_tickets', [D])).streak === null, 'RESET ACCOUNT wipes tickets and the track');

// ---- odds sanity over many draws at the SQL level
const N = 4000;
const dist = await q(`select o_tier, count(*)::int n from (select (private.pick_ticket_gear($1, 'legendary')).o_tier from generate_series(1, ${N})) x group by o_tier`, [pa]);
console.log('LEGENDARY+ odds over', N, dist);
const leg = dist.find((r) => r.o_tier === 'legendary');
ok(leg && leg.n / N > 0.92 && leg.n / N < 0.97, 'LEGENDARY+ ticket ≈ 94.7% LEGENDARY');
const rareDist = await q(`select o_tier, count(*)::int n from (select (private.pick_ticket_gear($1, 'rare')).o_tier from generate_series(1, ${N})) x group by o_tier`, [pa]);
console.log('RARE+ odds over', N, rareDist);
console.log(`\n${pass} checks passed`);
