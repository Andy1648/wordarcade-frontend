// paidPacks.sql.test.js — PAID PACKS (089) against the REAL migrations (060 tickets, 082 / 085 / 086 / 088 payments, 089), in
// an in-process Postgres (PGlite, a dev dependency; the test skips where it isn't installed — CI has it). The money rules
// live in SQL, so a fake database would only test the fake: one ticket per checkout session, a redelivered webhook mints
// nothing, a refund revokes an unopened pack and claws an opened one like spent gems, first-buy ×2 stays gems-only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ROLL_PACKS } from './packs.js';

const read = (f) => fs.readFileSync(new URL(`../../supabase/migrations/${f}`, import.meta.url), 'utf8');
const SQL_089 = read('089_paid_packs.sql');

let PGlite = null;
try {
  ({ PGlite } = await import(process.env.PGLITE_PATH || '@electric-sql/pglite'));
} catch { /* not installed here: CI has it */ }

const PID = '11111111-1111-4111-8111-111111111111';
const UID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SECRET = 's'.repeat(48);
const MYTHICS = ['mk-singularity', 'mk-kraken', 'mk-hydra', 'mk-chronos', 'mk-firebird', 'mk-trident', 'mk-anchor', 'mk-comet', 'mk-meltdown', 'mk-genie', 'mk-gauntlet', 'mk-grimoire', 'mk-supernova', 'mk-pinata'];
const SECRETS = ['mk-origin', 'mk-paradox', 'mk-megaton'];

const STUBS = `
  create schema if not exists private; create schema if not exists auth; create schema if not exists extensions;
  do $$ begin create role anon; exception when others then null; end $$;
  do $$ begin create role authenticated; exception when others then null; end $$;
  do $$ begin create role service_role; exception when others then null; end $$;
  create table auth.current (uid uuid);
  create function auth.uid() returns uuid language sql stable as 'select uid from auth.current limit 1';
  create function auth.jwt() returns jsonb language sql stable as $$select '{}'::jsonb$$;
  create function extensions.digest(t text, a text) returns bytea language sql immutable as $$select sha256(convert_to(t, 'UTF8'))$$;
  create table public.profiles (id uuid primary key, username text, level integer, rebirths integer, lifetime_words bigint, created_at timestamptz default now());
  create table private.profile_secrets (secret_hash bytea primary key, profile_id uuid);
  create table private.redeem_claims (player bytea, code text);
  create table public.redeem_codes (code text, kind text, gems integer);
  create table private.s2_week_prizes (profile_id uuid, gems integer);
  create table private.roll_log (id bigserial, profile_id uuid, mark_id text, tier text, state text);
  create function private.profile_for_secret(p_secret text) returns uuid language sql stable as $$
    select profile_id from private.profile_secrets where secret_hash = extensions.digest(p_secret, 'sha256') $$;
  create function private.tier_rank(t text) returns integer language sql immutable as $$
    select case t when 'rare' then 0 when 'epic' then 1 when 'legendary' then 2 when 'mythic' then 3 when 'secret' then 4 else -1 end; $$;
  create table private.gear_pool (mark_id text primary key, tier text not null, x double precision not null, ord integer not null);
  insert into private.gear_pool values ('mk-r', 'rare', 1.03, 1), ('mk-e', 'epic', 60, 2), ('mk-l', 'legendary', 130, 3),
    ${MYTHICS.map((m, i) => `('${m}', 'mythic', 28000, ${10 + i})`).join(', ')},
    ${SECRETS.map((m, i) => `('${m}', 'secret', 45000, ${30 + i})`).join(', ')};
  create table private.gear_owned (profile_id uuid, mark_id text, copies integer not null default 1, shiny boolean not null default false,
    source text not null default 'roll', primary key (profile_id, mark_id));
  insert into public.profiles (id, username) values ('${PID}', 'A');
  insert into private.profile_secrets values (extensions.digest('${SECRET}', 'sha256'), '${PID}');
`;

async function database({ with089 = true } = {}) {
  const db = new PGlite();
  await db.exec(STUBS);
  for (const f of ['060_guaranteed_rolls.sql', '082_paid_gems.sql', '085_google_signin.sql', '086_pay_auth_hardening.sql', '088_first_buy_bonus.sql']) await db.exec(read(f));
  if (with089) await db.exec(SQL_089);
  return db;
}
const one = async (db, q, p) => (await db.query(q, p)).rows[0];
let seq = 0;
const reserve = async (db, { pack = 'mythic-pack', cents = 499 } = {}) => (await one(db, `insert into private.pay_reservations (profile_id, pack, amount_cents, month, expires_at, auth_uid)
    values ($1, $2, $3, private.pay_month(), now() + interval '35 minutes', $4) returning id`, [PID, pack, cents, UID])).id;
const grantPack = async (db, { s, res, tier = 'mythic', pack = 'mythic-pack', gems = 4000, cents = 499 }) =>
  (await one(db, 'select public.pay_grant_pack($1, $2, $3, $4, $5, $6, $7, \'usd\', $8) as r', [s, res, PID, pack, tier, gems, cents, `pi_${s}`])).r;
async function buyPack(db, opts = {}) {
  seq += 1;
  const s = opts.session || `cs_test_pack_${seq}`;
  const res = await reserve(db, opts);
  return { s, res, r: await grantPack(db, { s, res, ...opts }) };
}
const buyGems = async (db) => {
  seq += 1;
  const s = `cs_test_gems_${seq}`;
  const res = await reserve(db, { pack: 'pouch', cents: 199 });
  return (await one(db, 'select public.pay_grant($1, $2, $3, \'pouch\', 1000, 199, \'usd\', $4) as r', [s, res, PID, `pi_${s}`])).r;
};
const tickets = async (db) => (await db.query('select * from private.roll_tickets where profile_id = $1 order by granted_at', [PID])).rows;
const net = async (db) => Number((await one(db, 'select coalesce(sum(delta), 0) as n from private.pay_gem_ledger where profile_id = $1', [PID])).n);
const claw = async (db, s, ratio, reason = 'refund') => (await one(db, 'select public.pay_claw2($1, $2, $3) as r', [`pi_${s}`, ratio, reason])).r;
const status = async (db, s) => (await one(db, 'select status from private.pay_purchases where stripe_session_id = $1', [s])).status;

const real = { skip: PGlite ? false : 'PGlite is not installed here' };

test('a paid pack mints exactly ONE server ticket at its tier — no gems, no ledger row', real, async () => {
  const db = await database();
  const { s, r } = await buyPack(db);
  assert.deepEqual([r.granted, r.duplicate, r.ticket, r.tier], [true, false, true, 'mythic']);
  const t = await tickets(db);
  assert.equal(t.length, 1);
  assert.deepEqual([t[0].tier, t[0].source, t[0].grant_key, t[0].state], ['mythic', 'pay', `pay:${s}`, 'owned']);
  assert.equal(await net(db), 0, 'a pack is never gems');
  const p = await one(db, 'select kind, ticket_tier, ticket_id, gems, bonus_gems, amount_cents from private.pay_purchases where stripe_session_id = $1', [s]);
  assert.deepEqual([p.kind, p.ticket_tier, p.ticket_id, p.bonus_gems, p.amount_cents], ['pack', 'mythic', t[0].id, 0, 499]);
  // the player sees it through 060's list, as an ordinary ticket
  const list = (await one(db, 'select public.lb_tickets($1) as l', [SECRET])).l;
  assert.equal(list.tickets.length, 1);
  assert.deepEqual([list.tickets[0].tier, list.tickets[0].source], ['mythic', 'pay']);
});

test('a redelivered / duplicated webhook is a no-op: still one ticket', real, async () => {
  const db = await database();
  const { s, res } = await buyPack(db, { session: 'cs_test_dup' });
  const again = await grantPack(db, { s, res });
  assert.deepEqual([again.granted, again.duplicate], [false, true]);
  assert.equal((await tickets(db)).length, 1);
  assert.equal((await one(db, 'select count(*)::int as n from private.pay_purchases')).n, 1);
});

test('a SECRET pack can only land SECRET; a MYTHIC pack lands MYTHIC or SECRET, an unowned gear first', real, async () => {
  const db = await database();
  for (let i = 0; i < 6; i += 1) await buyPack(db, { tier: 'secret', pack: 'secret-pack', gems: 12000, cents: 1499 });
  for (let i = 0; i < 20; i += 1) await buyPack(db);
  const seen = { secret: new Set(), mythic: new Set() };
  for (const t of await tickets(db)) {
    const r = (await one(db, 'select public.lb_ticket_roll($1, $2) as r', [SECRET, t.id])).r;
    assert.equal(r.ok, true);
    if (t.tier === 'secret') assert.equal(r.pick.tier, 'secret');
    else assert.ok(['mythic', 'secret'].includes(r.pick.tier), r.pick.tier);
    assert.equal((await one(db, 'select public.lb_ticket_claim($1, $2) as r', [SECRET, t.id])).r.ok, true);
    if (t.tier === 'secret') seen.secret.add(r.pick.mark);
  }
  assert.equal(seen.secret.size, 3, 'three SECRET packs collect all three SECRETS before any repeat');
  // a re-roll of a spent ticket is refused; the floor came from the row, never a parameter
  const spent = (await tickets(db))[0];
  assert.equal((await one(db, 'select public.lb_ticket_roll($1, $2) as r', [SECRET, spent.id])).r.reason, 'spent');
});

test('refund of an UNOPENED pack revokes the ticket; nothing comes off the wallet; a retry changes nothing', real, async () => {
  const db = await database();
  const { s } = await buyPack(db, { session: 'cs_test_refund_unopened' });
  const r = await claw(db, s, 1);
  assert.deepEqual([r.found, r.clawed, r.revoked], [true, 0, true]);
  assert.equal((await tickets(db))[0].state, 'revoked');
  assert.equal(await net(db), 0);
  assert.equal(await status(db, s), 'refunded');
  assert.equal((await one(db, 'select public.lb_tickets($1) as l', [SECRET])).l.tickets.length, 0, 'gone from the list');
  const t = (await tickets(db))[0];
  assert.equal((await one(db, 'select public.lb_ticket_roll($1, $2) as r', [SECRET, t.id])).r.reason, 'no_ticket', 'cannot be opened');
  const again = await claw(db, s, 1);
  assert.deepEqual([again.clawed, again.revoked], [0, true]);
  assert.equal(await net(db), 0);
});

test('refund of an OPENED pack claws its gem value like spent gems: pro rata, never twice, and a debt on the budget', real, async () => {
  const db = await database();
  const before = Number((await one(db, 'select private.gem_budget($1) as b', [PID])).b);
  const { s } = await buyPack(db, { session: 'cs_test_refund_opened' });
  const t = (await tickets(db))[0];
  await one(db, 'select public.lb_ticket_roll($1, $2) as r', [SECRET, t.id]);
  await one(db, 'select public.lb_ticket_claim($1, $2) as r', [SECRET, t.id]);
  assert.equal((await claw(db, s, 0.5)).clawed, 2005); // half of $4.99 rounds up to 250 cents; the claw rounds up too (082)
  assert.equal((await claw(db, s, 0.5)).clawed, 0, 'a retry claws nothing more');
  assert.equal(await status(db, s), 'partly_refunded');
  assert.equal((await claw(db, s, 1)).clawed, 1995);
  assert.equal(await net(db), -4000);
  assert.equal(await status(db, s), 'refunded');
  assert.equal((await tickets(db))[0].state, 'spent', 'the gear stays: the debt is the gems');
  const after = Number((await one(db, 'select private.gem_budget($1) as b', [PID])).b);
  assert.equal(before - after, 4000, 'the server budget carries the debt');
  // the browser is handed the claw like any refunded gems (pay_gems_pending), and floors it at 0 (payClient.clawGems)
  const pending = (await one(db, 'select public.pay_gems_pending($1) as p', [SECRET])).p;
  assert.deepEqual(pending.rows.map((x) => x.delta), [-2005, -1995]);
});

test('a dispute revokes an unopened pack and flags the profile + the Google account; on an opened one it claws all', real, async () => {
  const db = await database();
  const a = await buyPack(db, { session: 'cs_test_dispute_a' });
  const r = await claw(db, a.s, null, 'dispute');
  assert.deepEqual([r.clawed, r.revoked], [0, true]);
  assert.equal(await status(db, a.s), 'disputed');
  assert.equal((await one(db, 'select count(*)::int as n from private.pay_flags where profile_id = $1', [PID])).n, 1);
  assert.equal((await one(db, 'select count(*)::int as n from private.pay_auth_flags where auth_uid = $1', [UID])).n, 1);
  const b = await buyPack(db, { session: 'cs_test_dispute_b', tier: 'secret', pack: 'secret-pack', gems: 12000, cents: 1499 });
  const tb = (await tickets(db)).find((t) => t.grant_key === `pay:${b.s}`);
  await one(db, 'select public.lb_ticket_roll($1, $2) as r', [SECRET, tb.id]); // reserved: its pick may already be in the save
  assert.equal((await claw(db, b.s, null, 'dispute')).clawed, 12000);
  assert.equal((await tickets(db)).find((t) => t.id === tb.id).state, 'reserved');
  assert.equal(await net(db), -12000);
});

test('a refund of zero changes nothing; an unknown payment is not found', real, async () => {
  const db = await database();
  const { s } = await buyPack(db);
  assert.equal((await claw(db, s, 0)).clawed, 0);
  assert.equal((await tickets(db))[0].state, 'owned');
  assert.equal((await claw(db, 'nope', 1)).found, false);
});

test('first buy ×2 is GEMS only: a pack never doubles and does not use the gem bonus up', real, async () => {
  const db = await database();
  await buyPack(db);
  assert.equal((await one(db, 'select public.pay_first_buy_open($1) as o', [SECRET])).o, true);
  const g = await buyGems(db);
  assert.deepEqual([g.gems, g.bonus], [2000, 1000]);
  assert.equal((await one(db, 'select public.pay_first_buy_open($1) as o', [SECRET])).o, false);
  assert.equal((await tickets(db)).length, 1, 'still the one pack ticket');
});

test('gem purchases keep working as before 089 (grant, refund) and the gem budget is unchanged for them', real, async () => {
  const db = await database();
  const b0 = Number((await one(db, 'select private.gem_budget($1) as b', [PID])).b);
  await buyGems(db); // first buy: 2000
  assert.equal(Number((await one(db, 'select private.gem_budget($1) as b', [PID])).b) - b0, 2000);
  assert.equal((await claw(db, `cs_test_gems_${seq}`, 1)).clawed, 2000);
  assert.equal(Number((await one(db, 'select private.gem_budget($1) as b', [PID])).b), b0);
});

test('the cap counts packs: $14.99 + $4.99 fits, then nothing more this month', real, async () => {
  const db = await database();
  await db.exec(`insert into private.auth_links (auth_uid, profile_id) values ('${UID}', '${PID}')`);
  const reserveVia = async (pack, cents) => (await one(db, 'select public.pay_reserve($1, $2, $3, $4) as r', [SECRET, pack, cents, UID])).r;
  assert.equal((await reserveVia('secret-pack', 1499)).ok, true);
  assert.equal((await reserveVia('mythic-pack', 499)).ok, true);
  const no = await reserveVia('pouch', 199);
  assert.deepEqual([no.ok, no.reason, no.spent_cents], [false, 'cap', 1998]);
});

test('089 is safe to run again: nothing minted, revoked or changed', real, async () => {
  const db = await database();
  const { s } = await buyPack(db);
  await db.exec(SQL_089);
  assert.equal((await tickets(db)).length, 1);
  assert.equal((await tickets(db))[0].state, 'owned');
  assert.equal((await one(db, 'select kind from private.pay_purchases where stripe_session_id = $1', [s])).kind, 'pack');
  await buyPack(db, { tier: 'secret', pack: 'secret-pack', gems: 12000, cents: 1499 });
  assert.equal((await tickets(db)).length, 2);
});

test('089: service role only, ASCII, both copies identical, the gem values match the pack table', () => {
  assert.match(SQL_089, /grant execute on function public\.pay_grant_pack\([^)]*\) to service_role;/);
  assert.doesNotMatch(SQL_089, /grant execute on function public\.pay_grant_pack\([^)]*\) to [^;]*anon/);
  assert.doesNotMatch(SQL_089, /grant execute on function public\.pay_claw2\([^)]*\) to [^;]*anon/);
  assert.ok([...SQL_089].every((c) => c.charCodeAt(0) < 128), 'ASCII only');
  const copy = fs.readFileSync(new URL('../../claude/089_paid_packs.sql', import.meta.url), 'utf8');
  assert.equal(copy.replace(/\r/g, ''), SQL_089.replace(/\r/g, ''), 'claude/ and supabase/migrations/ copies match');
  assert.doesNotMatch(SQL_089, /^\s*(drop table|drop function|delete from|truncate)/im, 'no removal SQL');
  for (const p of ROLL_PACKS) {
    assert.ok(['mythic', 'secret'].includes(p.tier), p.id);
    assert.ok(p.debtGems > 0 && p.debtGems <= 100000, p.id); // pay_grant_pack's bad_gems bound
    assert.ok(p.id.length <= 32, p.id); // pay_reserve / pay_grant_pack's bad_pack bound
  }
});
