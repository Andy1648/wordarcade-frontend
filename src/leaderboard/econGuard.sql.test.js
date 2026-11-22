// econGuard.sql.test.js — 091 (economy guard) + 092 (hidden rows off the boards) + 093 (real gem budget), run against
// the REAL migration files (and 043's real board view) in an in-process Postgres (PGlite, a dev dependency; skipped where
// it isn't installed — PGLITE_PATH can point at a copy). The rows are shaped like the live board on nov21: honest players
// on the wins-per-word line, and the three rows 20–45 orders of magnitude above it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (f) => fs.readFileSync(new URL(`../../supabase/migrations/${f}`, import.meta.url), 'utf8');
const SQL_043 = read('043_drifting_bots.sql');
const SQL_091 = read('091_econ_guard.sql');
const SQL_092 = read('092_board_hide.sql');
const SQL_093 = read('093_gem_budget_real.sql');

let PGlite = null;
try {
  ({ PGlite } = await import(process.env.PGLITE_PATH || '@electric-sql/pglite'));
} catch { /* not installed here: CI has it */ }
const skip = !PGlite && 'PGlite not installed';

const STUBS = `
  create schema if not exists private;
  create schema if not exists extensions;
  do $$ begin create role anon; exception when others then null; end $$;
  do $$ begin create role authenticated; exception when others then null; end $$;
  create table public.profiles (
    id uuid primary key default gen_random_uuid(), username text, level integer not null default 1,
    rebirths integer not null default 0, lifetime_words bigint not null default 0, lifetime_letters bigint not null default 0,
    wins_per_word numeric not null default 0, econ smallint not null default 13, stars integer not null default 0,
    is_bot boolean not null default false, is_tester boolean not null default false,
    created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
    submitted_at timestamptz, rb_words0 bigint, week_key date, week_words bigint not null default 0,
    s2_week_key date, s2_week_stars0 integer not null default 0, s2_week_rb0 integer not null default 0,
    s2_week_lv0 integer not null default 1, s2_roll_spent bigint not null default 0);
  create table public.profile_showcase (profile_id uuid primary key references public.profiles (id),
    wins_per_word double precision, base_wins numeric, power integer, updated_at timestamptz not null default now());
  create table public.season1_snapshot (profile_id uuid, rebirths integer, level integer, lifetime_words bigint);
  create table private.cheat_flags (id bigserial primary key, profile_id uuid, reason text, detail jsonb,
    created_at timestamptz not null default now());
  create function private.cheat_flag(p_pid uuid, p_reason text, p_detail jsonb) returns void language sql as
    $$ insert into private.cheat_flags (profile_id, reason, detail) values (p_pid, p_reason, p_detail) $$;
  create table private.roll_log (id bigserial primary key, profile_id uuid, mark_id text, tier text, state text);
  create table private.s2_week_final (wk date, profile_id uuid, week_stars integer, week_rebirths integer,
    week_levels integer, week_words bigint);
`;

const WK = `(date_trunc('week', now() at time zone 'America/New_York'))::date`;

async function database() {
  const db = new PGlite();
  await db.exec(STUBS);
  await db.exec(SQL_043);
  await db.exec(`
    insert into public.profiles (username, level, rebirths, lifetime_words, lifetime_letters, wins_per_word, submitted_at,
                                 s2_week_key, s2_week_rb0, week_key, week_words, s2_roll_spent, is_bot, is_tester)
    values
      ('CHEAT110', 2207, 110, 384, 4597, 9.4e125, now() - interval '1 hour', ${WK}, 74, ${WK}, 76, 124850, false, false),
      ('CHEAT7', 283, 7, 517, 4449, 6.7e33, now() - interval '40 days', ${WK}, 0, ${WK}, 10, 0, false, false),
      ('HONEST102', 1838, 102, 5343, 29667, 1.9e77, now() - interval '1 hour', ${WK}, 81, ${WK}, 400, 259800, false, false),
      ('HONEST43', 788, 43, 1454, 8189, 5.6e35, now() - interval '1 hour', ${WK}, 0, ${WK}, 1454, 232850, false, false),
      ('HONEST5', 100, 5, 900, 5000, 2.5e4, now() - interval '1 hour', ${WK}, 4, ${WK}, 50, 900, false, false),
      ('NEAR', 200, 10, 900, 5000, 1e20, now() - interval '1 hour', ${WK}, 10, ${WK}, 5, 0, false, false),
      ('BOTBIG', 300, 7, 0, 0, 1e60, null, null, 0, null, 0, 0, true, false),
      ('TESTER', 100, 8, 0, 0, 1e90, now() - interval '1 hour', ${WK}, 8, ${WK}, 0, 0, false, true);
    insert into public.profile_showcase (profile_id, wins_per_word, base_wins, power)
      select id, wins_per_word::double precision, 10, 50 from public.profiles;
  `);
  return db;
}
const all = async (db, q, p) => (await db.query(q, p)).rows;
const one = async (db, q, p) => (await all(db, q, p))[0];
const row = (db, name) => one(db, 'select * from public.profiles where username = $1', [name]);
const log10 = (v) => Math.log10(Number(v));

test('091 backfill: the three far-out rows are hidden + clamped, evidence first; honest rows, bots and testers untouched', { skip }, async () => {
  const db = await database();
  await db.exec(SQL_093);
  await db.exec(SQL_091);
  const c = await row(db, 'CHEAT110');
  assert.equal(c.lb_hidden, true);
  assert.equal(c.lb_hidden_why, 'wins_per_word');
  assert.ok(Math.abs(log10(c.wins_per_word) - (8 + 0.85 * 110)) < 0.01, 'clamped to the ceiling');
  assert.equal((await row(db, 'CHEAT7')).lb_hidden, true);
  // NEAR: 10^20 at R10 is past the 10^16.5 ceiling but not by 10^4: clamped, NOT hidden
  const n = await row(db, 'NEAR');
  assert.equal(n.lb_hidden, false);
  assert.ok(log10(n.wins_per_word) < 16.6);
  for (const h of ['HONEST102', 'HONEST43', 'HONEST5']) {
    const r = await row(db, h);
    assert.equal(r.lb_hidden, false, h);
  }
  assert.equal(Number((await row(db, 'HONEST102')).wins_per_word), 1.9e77);
  assert.equal(Number((await row(db, 'BOTBIG')).wins_per_word), 1e60);
  assert.equal(Number((await row(db, 'TESTER')).wins_per_word), 1e90);
  const ev = await one(db, `select a.detail from private.econ_audit a join public.profiles p on p.id = a.profile_id
                             where p.username = 'CHEAT110' and a.kind = 'backfill'`);
  assert.equal(Number(ev.detail.sent_log10), 126, 'the old number is kept as evidence');
  // the card was clamped too (and logged)
  const s = await one(db, `select s.wins_per_word from public.profile_showcase s join public.profiles p on p.id = s.profile_id where p.username = 'CHEAT7'`);
  assert.ok(Math.log10(s.wins_per_word) <= 8 + 0.85 * 7 + 1e-6);
  const sb = await one(db, `select s.wins_per_word from public.profile_showcase s join public.profiles p on p.id = s.profile_id where p.username = 'BOTBIG'`);
  assert.equal(sb.wins_per_word, 1e60);
  // a re-run changes nothing and logs no second backfill
  const before = await all(db, 'select username, level, rebirths, wins_per_word::text, lb_hidden from public.profiles order by username');
  await db.exec(SQL_091);
  assert.deepEqual(await all(db, 'select username, level, rebirths, wins_per_word::text, lb_hidden from public.profiles order by username'), before);
  assert.equal(Number((await one(db, `select count(*) n from private.econ_audit where kind = 'backfill'`)).n), 3);
  // the review list reads
  const sus = await all(db, 'select username, lb_hidden from private.econ_suspects');
  assert.ok(sus.some((r) => r.username === 'CHEAT110' && r.lb_hidden));
  assert.ok(!sus.some((r) => r.username === 'TESTER' || r.username === 'BOTBIG'));
});

test('091 trigger: a later write past the hide line hides; an honest write passes untouched', { skip }, async () => {
  const db = await database();
  await db.exec(SQL_093);
  await db.exec(SQL_091);
  await db.exec(`update public.profiles set wins_per_word = 2.0e78, level = level + 5, submitted_at = now() where username = 'HONEST102'`);
  const h = await row(db, 'HONEST102');
  assert.equal(Number(h.wins_per_word), 2.0e78);
  assert.equal(h.lb_hidden, false);
  await db.exec(`update public.profiles set wins_per_word = 1e40, submitted_at = now() where username = 'HONEST5'`);
  const c = await row(db, 'HONEST5');
  assert.equal(c.lb_hidden, true, '10^40 at R5 is a hacked save');
  assert.ok(log10(c.wins_per_word) <= 8 + 0.85 * 5 + 1e-6);
  assert.ok(Number((await one(db, `select count(*) n from private.cheat_flags where reason = 'clamped'`)).n) >= 1);
  // the showcase write path (lb_showcase_set's upsert) is clamped by its own trigger
  await db.exec(`update public.profile_showcase s set wins_per_word = 1e200 from public.profiles p where p.id = s.profile_id and p.username = 'HONEST43'`);
  const s = await one(db, `select s.wins_per_word from public.profile_showcase s join public.profiles p on p.id = s.profile_id where p.username = 'HONEST43'`);
  assert.ok(Math.log10(s.wins_per_word) <= 8 + 0.85 * 43 + 1e-6);
});

test('091 words bank: idling a day no longer banks a day of words; a first write is capped; honest pace passes', { skip }, async () => {
  const db = await database();
  await db.exec(SQL_093);
  await db.exec(SQL_091);
  await db.exec(`update public.profiles set submitted_at = now() - interval '1 day' where username = 'HONEST5'`);
  await db.exec(`update public.profiles set lifetime_words = lifetime_words + 345600, week_words = week_words + 345600,
                        submitted_at = now() where username = 'HONEST5'`);
  const r = await row(db, 'HONEST5');
  assert.equal(Number(r.lifetime_words), 900 + 4 * 7200, 'the bank stops at 2 hours');
  assert.equal(Number(r.week_words), 50 + 4 * 7200);
  // honest pace (300 words over 10 min) lands whole
  await db.exec(`update public.profiles set submitted_at = now() - interval '10 minutes' where username = 'HONEST43'`);
  await db.exec(`update public.profiles set lifetime_words = lifetime_words + 300, submitted_at = now() where username = 'HONEST43'`);
  assert.equal(Number((await row(db, 'HONEST43')).lifetime_words), 1754);
  // a first season-2 write
  await db.exec(`insert into public.profiles (username) values ('FRESH')`);
  await db.exec(`update public.profiles set lifetime_words = 5000000, submitted_at = now() where username = 'FRESH'`);
  assert.equal(Number((await row(db, 'FRESH')).lifetime_words), 100000);
});

test('091 catch-up pace: a write can lift rebirths 40 a day at most, and the level follows the kept rebirths', { skip }, async () => {
  const db = await database();
  await db.exec(SQL_093);
  await db.exec(SQL_091);
  // setup: words first (no submitted_at move = not a board write), then the clock
  await db.exec(`update public.profiles set lifetime_words = 50000 where username = 'HONEST5'`);
  await db.exec(`update public.profiles set submitted_at = now() - interval '1 hour' where username = 'HONEST5'`);
  await db.exec(`update public.profiles set rebirths = 500, level = 15 + 18 * 500 + 100, submitted_at = now() where username = 'HONEST5'`);
  let r = await row(db, 'HONEST5');
  assert.equal(r.rebirths, 45, '+40, not +495');
  // 070's level rule on the KEPT rebirths: gate + 100, or +1 a second since the last write (20 min bank) — not R500's gate
  assert.ok(r.level <= Math.max(15 + 18 * 45 + 100, 100 + 1200), `level ${r.level}`);
  await db.exec(`update public.profiles set submitted_at = now() - interval '1 hour' where username = 'HONEST5'`);
  await db.exec(`update public.profiles set rebirths = 500, level = 15 + 18 * 500 + 100, submitted_at = now() where username = 'HONEST5'`);
  r = await row(db, 'HONEST5');
  assert.equal(r.rebirths, 45, 'the day is spent');
  // daan's real case: R2 row, R26 save, enough words -> lands in one write
  await db.exec(`update public.profiles set rebirths = 2, level = 40, lifetime_words = 1842 where username = 'NEAR'`);
  await db.exec(`update public.profiles set submitted_at = now() - interval '1 hour' where username = 'NEAR'`);
  await db.exec(`update public.profiles set rebirths = 26, level = 100, submitted_at = now() where username = 'NEAR'`);
  assert.equal((await row(db, 'NEAR')).rebirths, 26);
  // lb_rebirth's own +1 (no submitted_at move) is not a catch-up; one with no typing is logged, never refused
  await db.exec(`update public.profiles set rebirths = rebirths + 1, level = 1, rb_words0 = lifetime_words where username = 'NEAR'`);
  assert.equal((await row(db, 'NEAR')).rebirths, 27);
  await db.exec(`update public.profiles set rebirths = rebirths + 1, level = 1, rb_words0 = lifetime_words where username = 'NEAR'`);
  assert.equal((await row(db, 'NEAR')).rebirths, 28);
  const few = await one(db, `select count(*) n from private.econ_audit a join public.profiles p on p.id = a.profile_id
                              where p.username = 'NEAR' and a.kind = 'rebirth_few_words'`);
  assert.equal(Number(few.n), 1, 'the second one had 0 words since the first');
});

test('092: hidden rows leave ALL TIME (ranked again, no gap), THIS WEEK and the weekly prizes; re-runnable; survives a rewritten board', { skip }, async () => {
  const db = await database();
  await db.exec(SQL_093);
  const cols043 = (await all(db, 'select * from public.leaderboard_s2 limit 0'));
  const colNames = async () => (await db.query('select * from public.leaderboard_s2 limit 1')).fields.map((f) => f.name);
  const before = await colNames();
  await db.exec(SQL_091);
  await db.exec(SQL_092);
  assert.deepEqual(await colNames(), before, 'same columns, same order');
  assert.equal(cols043.length, 0);
  const board = await all(db, 'select rank, username from public.leaderboard_s2 order by rank');
  assert.ok(!board.some((r) => r.username === 'CHEAT110' || r.username === 'CHEAT7'));
  assert.deepEqual(board.map((r) => Number(r.rank)), board.map((_, i) => i + 1), 'ranked 1..n with no gap');
  assert.equal(board[0].username, 'HONEST102', 'the honest #2 is now #1');
  const week = await all(db, 'select username from public.leaderboard_s2_weekly');
  assert.ok(week.length > 0 && !week.some((r) => r.username === 'CHEAT110'));
  const prize = await all(db, `select p.username from private.s2_week_top(${WK}) t join public.profiles p on p.id = t.profile_id`);
  assert.ok(prize.length > 0 && !prize.some((r) => r.username === 'CHEAT110'));
  // anon can't read the raw copy
  const priv = await one(db, `select has_table_privilege('anon', 'private.leaderboard_s2_all', 'select') as ok`);
  assert.equal(priv.ok, false);
  // re-run: unchanged
  await db.exec(SQL_092);
  assert.deepEqual(await all(db, 'select rank, username from public.leaderboard_s2 order by rank'), board);
  // a later file rewrites the board (043 / 090 style): running 092 again wraps the new one
  await db.exec(SQL_043);
  assert.ok((await all(db, 'select username from public.leaderboard_s2')).some((r) => r.username === 'CHEAT110'));
  await db.exec(SQL_092);
  assert.deepEqual(await all(db, 'select rank, username from public.leaderboard_s2 order by rank'), board);
});

test('093: the rebirth term pays what a rebirth really pays; every other term is unchanged', { skip }, async () => {
  const db = await database();
  await db.exec(SQL_093);
  const t = async (r) => Number((await one(db, 'select private.rebirth_gems_total($1) v', [r])).v);
  assert.equal(await t(0), 0);
  assert.equal(await t(3), 150, 'R1-R3 = 25 + 50 + 75, as before');
  assert.equal(await t(4), 250);
  assert.equal(await t(5), 350 + 150, 'R5 jackpot');
  assert.equal(await t(110), 150 + 100 * 107 + 150 * 22);
  const b = async (name) => Number((await one(db, 'select private.gem_budget(id) v from public.profiles where username = $1', [name])).v);
  // CHEAT110: 1.5 x (14,150 + 250 x 384 + 3,150 x 2 days + 4,130 + 2,000) — was 1.5 x 152,625 for the rebirths alone
  assert.equal(await b('CHEAT110'), Math.floor(1.5 * (14150 + 250 * 384 + 3150 * 2 + 4130 + 2000)));
  // an honest top row keeps a budget far above what it spent
  const spent = Number((await row(db, 'HONEST43')).s2_roll_spent);
  assert.ok(spent < 0.5 * (await b('HONEST43')));
});
