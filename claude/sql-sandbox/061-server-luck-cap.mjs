// claude/sql-sandbox/061-server-luck-cap.mjs — runs 061_server_luck_cap.sql on a THROWAWAY in-memory Postgres (PGlite, WASM)
// against a stub of the tables it touches (the real pool from 059, the real pick_gear from 036), then checks the cap on
// hand-worked accounts and plays lb_roll adversarially. Never touches Supabase.
// RUN: in an empty scratch folder, npm i @electric-sql/pglite@0.3.0, copy this file there, then: node 061-server-luck-cap.mjs <repo path>
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const REPO = process.argv[2];
const db = new PGlite();
const q = async (sql, params) => (await db.query(sql, params)).rows;
const one = async (sql, params) => (await q(sql, params))[0];
const read = (f) => readFileSync(`${REPO}/supabase/migrations/${f}`, 'utf8').replace(/\r\n/g, '\n');

await db.exec(`
create role anon; create role authenticated;
create schema private;
create table public.profiles (id uuid primary key default gen_random_uuid(), username text, secret text unique,
  rebirths int default 0, stars int default 0, s2_roll_seq int default 0, s2_rolls int default 0, s2_since_epic int default 0,
  s2_since_leg int default 0, s2_roll_spent bigint default 0, is_tester boolean default false, created_at timestamptz default now());
create function private.profile_for_secret(s text) returns uuid language sql stable as $$ select id from public.profiles where secret = s $$;
create function private.tier_rank(t text) returns integer language sql immutable as $$
  select case t when 'rare' then 0 when 'epic' then 1 when 'legendary' then 2 when 'mythic' then 3 when 'secret' then 4 else -1 end; $$;
create function private.gem_budget(p uuid) returns bigint language sql stable as $$
  select case when (select username from public.profiles where id = p) = 'broke' then 0 else 1000000 end::bigint $$;
create table private.gear_pool (mark_id text primary key, tier text not null, x double precision not null, ord integer not null);
create table private.gear_owned (profile_id uuid not null references public.profiles(id) on delete cascade, mark_id text not null,
  copies integer not null default 1, shiny boolean not null default false, source text not null default 'roll',
  first_at timestamptz not null default now(), primary key (profile_id, mark_id));
create table private.roll_log (id bigserial primary key, profile_id uuid, seq int, idx int default 0, mark_id text, tier text,
  shiny boolean default false, luck double precision, forced text, bonus boolean default false, state text default 'reserved',
  created_at timestamptz default now(), claimed_at timestamptz);
create table private.cheat_flags (id bigserial primary key, profile_id uuid, reason text check (reason in ('rejected', 'clamped', 'gear')),
  detail jsonb, created_at timestamptz default now());
`);
const pool = read('059_gear_expansion.sql');
const ins = pool.indexOf('insert into private.gear_pool');
await db.exec(pool.slice(ins, pool.indexOf(';', ins) + 1));
const s36 = read('036_server_rolls.sql');
const pg = s36.indexOf('create or replace function private.pick_gear');
await db.exec(s36.slice(pg, s36.indexOf('end $$;', pg) + 'end $$;'.length));
const mig = read('061_server_luck_cap.sql').replace(/notify pgrst[^;]*;/g, '');
await db.exec(mig);
await db.exec(mig); // safe to re-run

let pass = 0;
const ok = (c, m) => { assert.ok(c, m); pass += 1; console.log('ok -', m); };
const near = (a, b) => Math.abs(a - b) < 1e-9;
let k = 0;
const mk = async (opts = {}) => {
  k += 1;
  const secret = String(k).padStart(40, 's');
  const r = await one(`insert into public.profiles (username, secret, rebirths, stars, is_tester, created_at, s2_rolls)
    values ($1, $2, $3, $4, $5, coalesce($6::timestamptz, now()), $7) returning id`,
  [opts.name || `p${k}`, secret, opts.rebirths || 0, opts.stars || 0, !!opts.tester, opts.created || null, opts.rolls || 0]);
  for (const [mark, copies, shiny] of opts.owned || []) {
    await q('insert into private.gear_owned (profile_id, mark_id, copies, shiny) values ($1, $2, $3, $4)', [r.id, mark, copies, !!shiny]);
  }
  return { id: r.id, secret };
};
const cap = async (p) => Number((await one('select private.luck_cap($1) as c', [p.id])).c);
const roll = async (p, luck, n = 1) => (await one('select public.lb_roll($1, $2, $3) as r', [p.secret, luck, n])).r;
const logged = async (p) => q('select luck, bonus from private.roll_log where profile_id = $1 order by id', [p.id]);
const flags = async (p, reason) => Number((await one('select count(*) n from private.cheat_flags where profile_id = $1 and reason = $2', [p.id, reason])).n);
const claimAll = async (p) => {
  await q("update private.roll_log set state = 'claimed' where profile_id = $1", [p.id]);
  await q('update public.profiles set s2_roll_seq = s2_roll_seq + 1, s2_rolls = s2_rolls + 1 where id = $1', [p.id]);
};

// ---- privileges
const priv = await one(`select has_function_privilege('anon', 'private.luck_cap(uuid)', 'execute') c,
  has_table_privilege('anon', 'private.gear_luck', 'select') t, has_function_privilege('anon', 'public.lb_roll(text, double precision, integer)', 'execute') r`);
ok(!priv.c && !priv.t, 'anon cannot call luck_cap or read gear_luck');
ok(priv.r, 'anon can call lb_roll');
ok(Number((await one('select count(*) n from private.gear_luck')).n) === 27, 'gear_luck seeded once (27 rows) after two runs');

// ---- the cap on hand-worked accounts: (1 + PERMS 1 + BOOST 1 + pips + INDEX + worn) x R7 x STOCK 2, max 10
const fresh = await mk();
ok(near(await cap(fresh), 6.6), 'fresh account: (1 + 1 + 1 + 0.3 unseen EARNED / UNLISTED gear) x 2 = 6.6');
ok(near(await cap(await mk({ created: '2026-10-01' })), 10), 'an account from before ROLL_CUTOFF keeps the flat 10');
ok(near(await cap(await mk({ tester: true })), 10), 'the TESTER code keeps the flat 10');
const tal = await mk({ owned: [['mk-talisman', 1]] });
ok(near(await cap(tal), 9), 'MAGIC 8-BALL worn (+1.5), one slot: (3 + 1.5) x 2 = 9');
const slip = await mk({ rebirths: 4, owned: [['mk-slipstream', 11, true]] });
ok(near(await cap(slip), (3 + 0.02 + 0.5 * 1.4 * 2 + 0.3) * 2), 'LUCKY SOCK 11 copies (star 2) shiny, R4 row = R5 with slack: 2 slots, (3 + 0.02 + 1.4 + 0.3) x 2');
const seven = await mk({ rebirths: 6, owned: ['mk-cyclone', 'mk-hotwire', 'mk-highlighter', 'mk-flashcards', 'mk-gumball', 'mk-detonator', 'mk-scholar'].map((m) => [m, 1]) });
ok(near(await cap(seven), (3 + 0.05 + 0.6) * 1.25 * 2), '7 gears = 25% of the 28 floor (+0.05), R6 row = R7 with slack (x1.25), best two 0.3 + 0.3');
ok(near(await cap(await mk({ owned: [['mk-shamrock', 1]] })), 10), 'SHAMROCK (+4) reaches the 10 ceiling');
ok(near(await cap(await mk({ owned: [['mk-not-a-gear', 50, true]] })), 6.6), 'a gear_owned row outside the pool adds nothing');

// ---- lb_roll uses it
const cheat = await mk({ name: 'cheat' });
let r = await roll(cheat, 10);
ok(r.ok && r.picks.length === 1, 'a console 10 still rolls');
ok(near((await logged(cheat))[0].luck, 6.6), '... at the cap 6.6, not 10');
ok((await flags(cheat, 'clamped')) === 1, '... and is flagged clamped');
r = await roll(cheat, 10);
ok(r.again === true && (await logged(cheat)).length === 1, 'asking again before the claim: the SAME reservation, nothing re-rolled');
await claimAll(cheat);
await roll(cheat, 10);
ok((await flags(cheat, 'clamped')) === 1, 'the clamped flag is once an hour, not once a roll');
const legit = await mk({ owned: [['mk-talisman', 1]] });
await roll(legit, 2.5);
ok(near((await logged(legit))[0].luck, 2.5) && (await flags(legit, 'clamped')) === 0, 'a legit 2.5 goes through untouched, no flag');
const low = await mk();
await roll(low, 0.2);
ok(near((await logged(low))[0].luck, 1), 'luck under 1 is raised to 1 (as before)');
const old = await mk({ created: '2026-10-01' });
await roll(old, 50);
ok(near((await logged(old))[0].luck, 10), 'an old account: 50 is cut to the flat 10 (as before)');
const bonus = await mk({ rolls: 9 });
await roll(bonus, 10);
const b = (await logged(bonus))[0];
ok(b.bonus === true && near(b.luck, 6.6), 'the 10th roll is the server\'s x2 bonus ON TOP of the capped luck (logged L = 6.6, bonus)');

// ---- the rest of lb_roll is 047's
const broke = await mk({ name: 'broke' });
ok((await roll(broke, 1)).reason === 'budget', 'over the gem budget: refused (unchanged)');
const dbl = await mk();
ok((await roll(dbl, 1, 2)).picks.length === 1, 'a double roll without SINGULARITY on a new account: one pick (unchanged)');
const sing = await mk({ owned: [['mk-singularity', 1]] });
ok((await roll(sing, 1, 2)).picks.length === 2, 'with SINGULARITY: two picks (unchanged)');
const fast = await mk();
for (let i = 0; i < 3; i += 1) await q("insert into private.roll_log (profile_id, seq, mark_id, tier, luck, state) values ($1, 0, 'x', 'rare', 1, 'claimed')", [fast.id]);
ok((await roll(fast, 1)).reason === 'rate', '3 rolls in a second: rate (unchanged)');
const pity = await roll(await mk(), 1);
ok(Number.isInteger(pity.since_epic) && Number.isInteger(pity.since_leg), 'every reply carries the server pity counters (047)');

console.log(`\n${pass} checks passed`);
