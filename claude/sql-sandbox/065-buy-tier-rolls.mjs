// claude/sql-sandbox/065-buy-tier-rolls.mjs — runs 060 + 065_buy_tier_rolls.sql on a THROWAWAY in-memory Postgres (PGlite, WASM)
// against a stub of the tables it touches, then plays the SHOP BUY adversarially. Never touches Supabase.
// RUN: in an empty scratch folder, npm i @electric-sql/pglite@0.3.0, copy this file there, then: node 065-buy-tier-rolls.mjs <repo path>
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
await db.exec(mig);
// 036's gem budget, stubbed: a per-profile number the test sets
await db.exec(`alter table public.profiles add column budget bigint default 100000;
create function private.gem_budget(p uuid) returns bigint language sql stable as $$ select budget from public.profiles where id = p $$;`);
const buy = readFileSync(`${REPO}/supabase/migrations/065_buy_tier_rolls.sql`, 'utf8').replace(/notify pgrst[^;]*;/g, '');
await db.exec(buy);
await db.exec(buy); // safe to re-run

const A = 'a'.repeat(40), B = 'b'.repeat(40);
const pa = (await one(`insert into public.profiles (username, secret) values ('ann', $1) returning id`, [A])).id;
await one(`insert into public.profiles (username, secret, budget) values ('bob', $1, 200) returning id`, [B]);
const rpc = async (fn, args) => (await one(`select public.${fn}(${args.map((_, i) => `$${i + 1}`).join(', ')}) as r`, args)).r;
let pass = 0;
const ok = (c, m) => { assert.ok(c, m); pass += 1; console.log('ok -', m); };
const uuid = () => crypto.randomUUID();
const rk = { rare: 0, epic: 1, legendary: 2, mythic: 3, secret: 4 };
const spent = async (pid) => Number((await one(`select s2_roll_spent from public.profiles where id = $1`, [pid])).s2_roll_spent);

const priv = (await q(`select has_function_privilege('anon', 'private.ticket_shop(text)', 'execute') s,
  has_function_privilege('anon', 'public.lb_ticket_buy(text, text, uuid)', 'execute') b`))[0];
ok(!priv.s && priv.b, 'anon can call lb_ticket_buy but not the price table');

// ---- only EPIC+ / LEGENDARY+ are sold
for (const t of ['rare', 'mythic', 'secret', 'EPIC', '', null]) {
  const r = await rpc('lb_ticket_buy', [A, t, uuid()]);
  ok(r.ok === false && r.reason === 'bad_tier', `tier ${JSON.stringify(t)} is not sold`);
}
ok((await rpc('lb_ticket_buy', [A, 'epic', null])).reason === 'bad_request', 'no request id, no buy');
ok((await rpc('lb_ticket_buy', ['z'.repeat(40), 'epic', uuid()])).reason === 'no_profile', 'an unknown secret buys nothing');

// ---- a buy: server price, ticket minted with the server floor, spend counted, pity untouched
const before = await one(`select s2_roll_seq, s2_rolls, s2_since_epic, s2_since_leg from public.profiles where id = $1`, [pa]);
const req = uuid();
const b1 = await rpc('lb_ticket_buy', [A, 'legendary', req]);
ok(b1.ok && b1.price === 750 && b1.ticket.tier === 'legendary' && b1.left === 0, 'LEGENDARY+ costs 750 and mints a legendary ticket');
ok((await spent(pa)) === 750, 'the price goes on s2_roll_spent');
const b1r = await rpc('lb_ticket_buy', [A, 'legendary', req]);
ok(b1r.ok && b1r.again && b1r.ticket.id === b1.ticket.id, 'a retried buy returns the SAME ticket');
ok((await spent(pa)) === 750, '... and never charges twice');
const b1x = await rpc('lb_ticket_buy', [A, 'epic', req]);
ok(b1x.ok && b1x.again && b1x.ticket.tier === 'legendary', 'reusing a request id for another tier gets the original ticket, not a new one');
ok((await rpc('lb_ticket_buy', [A, 'legendary', uuid()])).reason === 'sold_out', 'LEGENDARY+ stock is 1 an hour');
const e1 = await rpc('lb_ticket_buy', [A, 'epic', uuid()]);
const e2 = await rpc('lb_ticket_buy', [A, 'epic', uuid()]);
ok(e1.ok && e1.price === 150 && e1.left === 1 && e2.ok && e2.left === 0, 'EPIC+ costs 150, 2 an hour');
ok((await rpc('lb_ticket_buy', [A, 'epic', uuid()])).reason === 'sold_out', 'the 3rd EPIC+ this hour is sold out');
await q(`update private.roll_tickets set granted_at = now() - interval '61 minutes' where profile_id = $1 and source = 'shop'`, [pa]);
ok((await rpc('lb_ticket_buy', [A, 'epic', uuid()])).ok, 'the stock refills on the next hour');
const after = await one(`select s2_roll_seq, s2_rolls, s2_since_epic, s2_since_leg from public.profiles where id = $1`, [pa]);
ok(JSON.stringify(before) === JSON.stringify(after), 'buying never touches pity / roll counters');
ok((await spent(pa)) === 750 + 450, 'spend = 750 + 3 x 150');

// ---- the ticket opens through 060 with the floor of the ROW
const list = (await rpc('lb_tickets', [A])).tickets;
ok(list.length === 4 && list.every((t) => t.source === 'shop'), 'the bought tickets are listed (source shop)');
for (const t of list) {
  const r = await rpc('lb_ticket_roll', [A, t.id]);
  ok(r.ok && rk[r.pick.tier] >= rk[t.tier], `${t.tier}+ opened ${r.pick.tier}`);
  ok((await rpc('lb_ticket_claim', [A, t.id])).ok, 'claimed');
}
await q(`update public.profiles set is_tester = true where id = $1`, [pa]);
const worst = { epic: 9, legendary: 9 };
for (let i = 0; i < 80; i += 1) {
  await q(`update private.roll_tickets set granted_at = now() - interval '2 hours' where profile_id = $1 and source = 'shop'`, [pa]);
  const tier = i % 2 ? 'epic' : 'legendary';
  const b = await rpc('lb_ticket_buy', [A, tier, uuid()]);
  assert.ok(b.ok, JSON.stringify(b));
  const r = await rpc('lb_ticket_roll', [A, b.ticket.id]);
  worst[tier] = Math.min(worst[tier], rk[r.pick.tier]);
  await rpc('lb_ticket_claim', [A, b.ticket.id]);
}
ok(worst.epic >= 1 && worst.legendary >= 2, `80 bought rolls never opened below their floor (worst epic ${worst.epic}, legendary ${worst.legendary})`);

// ---- the gem budget: bob could only ever have earned 200
ok((await rpc('lb_ticket_buy', [B, 'epic', uuid()])).ok, 'bob buys one EPIC+ (150 of 200)');
const g2 = await rpc('lb_ticket_buy', [B, 'epic', uuid()]);
ok(g2.ok === false && g2.reason === 'budget', 'a 2nd would pass his gem budget: refused');
ok((await rpc('lb_ticket_buy', [B, 'legendary', uuid()])).reason === 'budget', 'a LEGENDARY+ too');
ok((await rpc('lb_tickets', [B])).tickets.length === 1, 'bob holds exactly one ticket');
const bt = (await rpc('lb_tickets', [B])).tickets[0];
ok((await rpc('lb_ticket_roll', [A, bt.id])).reason === 'no_ticket', 'ann cannot open bob\'s bought roll');

// ---- reset wipes bought tickets (060 lb_reset_ack)
await q(`update public.profiles set reset_all = true where secret = $1`, [B]);
await rpc('lb_reset_ack', [B, '{}', 0]);
ok((await rpc('lb_tickets', [B])).tickets.length === 0, 'RESET ACCOUNT wipes bought rolls');

console.log(`\n${pass} checks passed`);
