// firstBuy.sql.test.js — FIRST BUY: DOUBLE GEMS against the REAL migrations (082, 085, 086, 088), in an in-process Postgres
// (PGlite, a dev dependency; the test skips where it isn't installed). The money rules live in SQL, so a fake database would
// only test the fake. PGlite has one connection, so two grants can't truly overlap here: the race is covered by the advisory
// lock (asserted present) and by the primary key (exercised below with a row put there first).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (f) => fs.readFileSync(new URL(`../../supabase/migrations/${f}`, import.meta.url), 'utf8');
const SQL_088 = read('088_first_buy_bonus.sql');

let PGlite = null;
try {
  ({ PGlite } = await import(process.env.PGLITE_PATH || '@electric-sql/pglite'));
} catch { /* not installed here: CI has it */ }

const PID = '11111111-1111-4111-8111-111111111111';
const PID2 = '22222222-2222-4222-8222-222222222222';
const UID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const UID2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SECRET = 's'.repeat(48);

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
  insert into public.profiles (id, username) values ('${PID}', 'A'), ('${PID2}', 'B');
  insert into private.profile_secrets values (extensions.digest('${SECRET}', 'sha256'), '${PID}');
`;

async function database({ with088 = true } = {}) {
  const db = new PGlite();
  await db.exec(STUBS);
  for (const f of ['082_paid_gems.sql', '085_google_signin.sql', '086_pay_auth_hardening.sql']) await db.exec(read(f));
  if (with088) await db.exec(SQL_088);
  return db;
}
const one = async (db, q, p) => (await db.query(q, p)).rows[0];
let seq = 0;
/** A reservation (as pay_reserve leaves it) for this account, then the grant the webhook sends. */
async function buy(db, { uid = UID, pid = PID, gems = 1000, cents = 199, session } = {}) {
  seq += 1;
  const s = session || `cs_test_${seq}`;
  const r = await one(db, `insert into private.pay_reservations (profile_id, pack, amount_cents, month, expires_at, auth_uid)
    values ($1, 'pouch', $2, private.pay_month(), now() + interval '35 minutes', $3) returning id`, [pid, cents, uid]);
  return grant(db, { s, res: r.id, pid, gems, cents });
}
const grant = async (db, { s, res, pid = PID, gems = 1000, cents = 199 }) => (await one(db, `select public.pay_grant($1, $2, $3, 'pouch', $4, $5, 'usd', $6) as r`, [s, res, pid, gems, cents, `pi_${s}`])).r;
const net = async (db, pid = PID) => Number((await one(db, 'select coalesce(sum(delta), 0) as n from private.pay_gem_ledger where profile_id = $1', [pid])).n);
const claw = async (db, s, ratio, reason = 'refund') => (await one(db, 'select public.pay_claw2($1, $2, $3) as r', [`pi_${s}`, ratio, reason])).r;
const open = async (db, secret = SECRET) => (await one(db, 'select public.pay_first_buy_open($1) as o', [secret])).o;

const real = { skip: PGlite ? false : 'PGlite is not installed here' };

test('the first purchase doubles; the second does not', real, async () => {
  const db = await database();
  assert.equal(await open(db), true);
  const a = await buy(db);
  assert.deepEqual([a.granted, a.gems, a.bonus], [true, 2000, 1000]);
  assert.equal(await net(db), 2000);
  assert.equal(await open(db), false);
  const b = await buy(db, { gems: 3000, cents: 499 });
  assert.deepEqual([b.granted, b.gems, b.bonus], [true, 3000, 0]);
  assert.equal(await net(db), 5000);
});

test('a retried webhook never grants or doubles twice', real, async () => {
  const db = await database();
  await buy(db, { session: 'cs_test_retry' });
  const res = (await one(db, "select reservation_id as r from private.pay_purchases where stripe_session_id = 'cs_test_retry'")).r;
  const again = await grant(db, { s: 'cs_test_retry', res });
  assert.deepEqual([again.granted, again.duplicate], [false, true]);
  assert.equal(await net(db), 2000);
  assert.equal((await one(db, 'select count(*)::int as n from private.pay_gem_ledger')).n, 1);
});

test('a full refund claws the bonus too, and refund then rebuy gets no bonus', real, async () => {
  const db = await database();
  await buy(db, { session: 'cs_test_refund' });
  const r = await claw(db, 'cs_test_refund', 1);
  assert.equal(r.clawed, 2000);
  assert.equal(await net(db), 0);
  assert.equal((await one(db, "select status from private.pay_purchases where stripe_session_id = 'cs_test_refund'")).status, 'refunded');
  assert.equal(await open(db), false);
  const again = await buy(db);
  assert.deepEqual([again.gems, again.bonus], [1000, 0]);
  assert.equal(await net(db), 1000);
});

test('a partial refund claws its share of pack + bonus, and a retry claws nothing more', real, async () => {
  const db = await database();
  await buy(db, { session: 'cs_test_half' });
  assert.equal((await claw(db, 'cs_test_half', 0.5)).clawed, 1006); // half of $1.99 rounds up to 100 cents; the claw rounds up too (082)
  assert.equal((await claw(db, 'cs_test_half', 0.5)).clawed, 0);
  assert.equal(await net(db), 994);
});

test('a dispute claws all of it and flags the account', real, async () => {
  const db = await database();
  await buy(db, { session: 'cs_test_dispute' });
  assert.equal((await claw(db, 'cs_test_dispute', null, 'dispute')).clawed, 2000);
  assert.equal(await net(db), 0);
  assert.equal((await one(db, 'select count(*)::int as n from private.pay_auth_flags where auth_uid = $1', [UID])).n, 1);
});

test('two checkouts open at once: only the first grant doubles, whichever lands first', real, async () => {
  const db = await database();
  const mk = async () => (await one(db, `insert into private.pay_reservations (profile_id, pack, amount_cents, month, expires_at, auth_uid)
    values ($1, 'pouch', 199, private.pay_month(), now() + interval '35 minutes', $2) returning id`, [PID, UID])).id;
  const [r1, r2] = [await mk(), await mk()];
  const b = await grant(db, { s: 'cs_test_second', res: r2 });
  const a = await grant(db, { s: 'cs_test_first', res: r1 });
  assert.deepEqual([b.bonus, a.bonus], [1000, 0]);
  assert.equal(await net(db), 3000);
  assert.match(SQL_088, /pg_advisory_xact_lock\(hashtext\('taw-first-buy:'/);
});

test('the primary key alone still stops a second bonus', real, async () => {
  const db = await database();
  await buy(db, { uid: UID2, pid: PID2, session: 'cs_test_other' });
  await db.exec(`insert into private.pay_first_buy (auth_uid, stripe_session_id) values ('${UID}', 'cs_test_other')`);
  const r = await buy(db);
  assert.deepEqual([r.gems, r.bonus], [1000, 0]);
});

test('a new Google account on a board profile that already bought gets no bonus; another account + profile does', real, async () => {
  const db = await database();
  await buy(db);
  const sameProfile = await buy(db, { uid: UID2 });
  assert.equal(sameProfile.bonus, 0);
  const elsewhere = await buy(db, { uid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', pid: PID2 });
  assert.equal(elsewhere.bonus, 1000);
});

test('a purchase made before 088 ran counts as earlier: no bonus for someone who already bought', real, async () => {
  const db = await database({ with088: false });
  const old = await one(db, `insert into private.pay_reservations (profile_id, pack, amount_cents, month, expires_at, auth_uid)
    values ($1, 'pouch', 199, private.pay_month(), now() + interval '35 minutes', $2) returning id`, [PID, UID]);
  await grant(db, { s: 'cs_test_before', res: old.id });
  assert.equal(await net(db), 1000); // 082's grant, no bonus before 088
  await db.exec(SQL_088);
  assert.equal(await open(db), false);
  assert.equal((await buy(db)).bonus, 0);
});

test('a reservation with no Google account never doubles; the stamp shows signed out and with no secret', real, async () => {
  const db = await database();
  assert.equal((await buy(db, { uid: null })).bonus, 0);
  assert.equal(await open(db, null), true);
  assert.equal(await open(db, 'x'.repeat(48)), true);
});

test('088 is safe to run again: nothing is granted or changed', real, async () => {
  const db = await database();
  await buy(db);
  await db.exec(SQL_088);
  assert.equal(await net(db), 2000);
  assert.equal((await buy(db)).bonus, 0);
});

test('088 grants: nobody but the service role can grant; the stamp check is open to players', () => {
  assert.doesNotMatch(SQL_088, /grant execute on function public\.pay_grant/); // create or replace keeps 082's service-role grant
  assert.match(SQL_088, /grant execute on function public\.pay_first_buy_open\(text\) to anon, authenticated, service_role;/);
  assert.match(SQL_088, /revoke all on private\.pay_first_buy from anon, authenticated;/);
  assert.ok([...SQL_088].every((c) => c.charCodeAt(0) < 128), 'ASCII only');
});
