// livingBots.sql.test.js — 090_living_bots.sql against the REAL 043 + 090 migrations, in an in-process Postgres (PGlite, a
// dev dependency; the test skips where it isn't installed). The bots' whole behaviour is SQL arithmetic on their id and the
// clock, so it is run here at many timestamps: nothing jumps when 090 lands, every bot only climbs, none outpaces a real
// player, they don't move in lockstep, some binge after idle days, some quit for good, rebirths come at the real gate, and
// a bot never passes a real player who has played in the last 3 days.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (f) => fs.readFileSync(new URL(`../../supabase/migrations/${f}`, import.meta.url), 'utf8');
const SQL_043 = read('043_drifting_bots.sql');
const SQL_090 = read('090_living_bots.sql');

let PGlite = null;
try {
  ({ PGlite } = await import(process.env.PGLITE_PATH || '@electric-sql/pglite'));
} catch { /* not installed here: CI has it */ }

const STUBS = `
  create schema if not exists private;
  do $$ begin create role anon; exception when others then null; end $$;
  do $$ begin create role authenticated; exception when others then null; end $$;
  create table public.profiles (
    id uuid primary key default gen_random_uuid(), username text, level integer not null default 1, rebirths integer not null default 0,
    lifetime_words bigint not null default 0, lifetime_letters bigint not null default 0, wins_per_word numeric not null default 0,
    econ integer not null default 13, stars integer not null default 0, is_bot boolean not null default false,
    created_at timestamptz not null default now(), updated_at timestamptz not null default now());
  create table public.season1_snapshot (profile_id uuid, rebirths integer, level integer, lifetime_words bigint);
  create view public.leaderboard_s2 as select 1 as placeholder;
`;
const N_BOTS = 300;

async function database() {
  const db = new PGlite();
  await db.exec(STUBS);
  await db.exec(SQL_043);
  // a seeded board: bots from R0 to R40 (stored values; 043 drifts some of them), and a few real players. The bot ids are
  // FIXED (md5 of the name), so every run measures the same 300 bots - their behaviour is a function of their id.
  await db.exec(`
    insert into public.profiles (id, username, level, rebirths, lifetime_words, is_bot, created_at)
    select md5('living-bot-' || g)::uuid, 'bot' || g, case when g % 5 = 0 then 2 + g % 13 else 15 + 18 * (g % 41) + g % 17 end, case when g % 5 = 0 then 0 else g % 41 end,
           g * 7, true, timestamptz '2026-10-01' + (g % 30) * interval '1 day'
      from generate_series(1, ${N_BOTS}) g;
    insert into public.profiles (username, level, rebirths, lifetime_words, is_bot, updated_at)
    values ('REALTOP', 1577, 89, 7352, false, now()), ('REALMID', 100, 5, 900, false, now()), ('REALAWAY', 60, 3, 400, false, now() - interval '10 days');
  `);
  return db;
}
const all = async (db, q, p) => (await db.query(q, p)).rows;

test('090: lands with no jump, keeps every start on a re-run, never writes a profiles row', { skip: !PGlite && 'PGlite not installed' }, async () => {
  const db = await database();
  const before = await all(db, 'select id, level, rebirths, updated_at from public.profiles order by id');
  // one transaction = one now(): 043's board and 090's board, read at the same instant
  await db.exec('begin');
  const shown043 = await all(db, 'select id, level, rebirths from public.leaderboard_s2 order by id');
  await db.exec(SQL_090);
  const shown090 = await all(db, 'select id, level, rebirths from public.leaderboard_s2 order by id');
  await db.exec('commit');
  assert.deepEqual(shown090, shown043, 'every row shows exactly what it showed under 043 the moment 090 runs');
  const anchors = await all(db, 'select profile_id, at from private.bot_anchor order by profile_id');
  assert.equal(anchors.length, N_BOTS);
  await db.exec(SQL_090); // a re-run
  assert.deepEqual(await all(db, 'select profile_id, at from private.bot_anchor order by profile_id'), anchors, 'a re-run keeps every start');
  assert.deepEqual(await all(db, 'select id, level, rebirths, updated_at from public.profiles order by id'), before, 'no profiles row is written (THIS WEEK never sees a bot)');
  // real rows on the board are their own stored values
  const real = await all(db, `select b.username, b.level, b.rebirths from public.leaderboard_s2 b join public.profiles p on p.id = b.id where not p.is_bot order by b.username`);
  assert.deepEqual(real.map((r) => [r.username, r.level, r.rebirths]), [['REALAWAY', 60, 3], ['REALMID', 100, 5], ['REALTOP', 1577, 89]]);
});

test('090: each bot climbs on its own clock — believable, varied, never in lockstep (60 days, every 3 hours)', { skip: !PGlite && 'PGlite not installed' }, async () => {
  const db = await database();
  await db.exec(SQL_090);
  const STEP_H = 3;
  const SLOTS = (60 * 24) / STEP_H;
  const rows = await all(db, `
    select p.id::text as id, a.level as b_lv, a.rebirths as b_rb, s as slot, l.level, l.rebirths
      from public.profiles p
      join private.bot_anchor a on a.profile_id = p.id
      cross join generate_series(0, ${SLOTS}) s
      cross join lateral public.lb_bot_live(p.id, a.level, a.rebirths, timestamptz '2026-11-14 00:00+00', timestamptz '2026-11-14 00:00+00' + s * interval '${STEP_H} hours') l
     where p.is_bot
     order by p.id, s`);
  const by = new Map();
  for (const r of rows) { if (!by.has(r.id)) by.set(r.id, []); by.get(r.id)[r.slot] = r; }
  assert.equal(by.size, N_BOTS);
  const perDay = 24 / STEP_H;
  let maxDay = 0;
  let quitters = 0;
  let bingers = 0;
  const movedInSlot = new Array(SLOTS + 1).fill(0);
  const movedOnDay = new Array(60).fill(0);
  for (const [id, s] of by) {
    assert.equal(s[0].level, s[0].b_lv, `${id} starts where it stood`);
    assert.equal(s[0].rebirths, s[0].b_rb);
    let idleRun = 0;
    let longestIdleThenPlay = 0;
    for (let i = 1; i <= SLOTS; i++) {
      assert.ok(s[i].level >= s[i - 1].level && s[i].rebirths >= s[i - 1].rebirths, `${id} only ever climbs`);
      if (s[i].level > s[i - 1].level) movedInSlot[i] += 1;
      // a rebirth only at a real gate's pace: never more than one per 18 levels climbed since its start
      const gained = s[i].rebirths - s[i].b_rb;
      if (gained > 0) assert.ok(gained <= Math.floor((s[i].level - s[i].b_lv) / 18) + 1, `${id} +${gained} R after +${s[i].level - s[i].b_lv} LV`);
    }
    for (let d = 0; d < 60; d++) {
      const gain = s[(d + 1) * perDay].level - s[d * perDay].level;
      maxDay = Math.max(maxDay, gain);
      if (gain > 0) { movedOnDay[d] += 1; if (idleRun >= 5) longestIdleThenPlay = Math.max(longestIdleThenPlay, idleRun); idleRun = 0; } else idleRun += 1;
    }
    if (longestIdleThenPlay >= 5) bingers += 1;
    const lateGain = s[SLOTS].level - s[45 * perDay].level;
    const earlyGain = s[30 * perDay].level - s[0].level;
    if (earlyGain > 0 && lateGain === 0) quitters += 1;
  }
  // never faster than a real player at the top (~43 levels a day over a season); a full binge day is capped at 40
  assert.ok(maxDay <= 40, `the fastest bot day is ${maxDay} levels`);
  // on any day a good share of the bots play, but never all of them
  const share = movedOnDay.map((n) => n / N_BOTS);
  assert.ok(Math.min(...share.slice(0, 30)) >= 0.2 && Math.max(...share) <= 0.85, `daily movers ${Math.min(...share).toFixed(2)}–${Math.max(...share).toFixed(2)}`);
  // no lockstep: in any 3-hour slot only a slice of the bots climbs (they play at their own hours)
  const slotMax = Math.max(...movedInSlot) / N_BOTS;
  assert.ok(slotMax <= 0.3, `at most ${(slotMax * 100).toFixed(0)}% of bots climb in one 3-hour slot`);
  assert.ok(bingers >= 10, `${bingers} bots come back after 5+ idle days`);
  assert.ok(quitters >= 10, `${quitters} bots went quiet for good`);
  // variety: the 60-day gains spread from a few levels to hundreds
  const gains = [...by.values()].map((s) => s[SLOTS].level - s[0].level).sort((a, b) => a - b);
  const q = (p) => gains[Math.floor(p * (gains.length - 1))];
  assert.ok(q(0.25) < 60 && q(0.9) > 150, `60-day gains p25 ${q(0.25)}, median ${q(0.5)}, p90 ${q(0.9)}`);
  console.log(`[living bots] 60-day gains p10 ${q(0.1)} p25 ${q(0.25)} median ${q(0.5)} p75 ${q(0.75)} p90 ${q(0.9)} max ${gains.at(-1)} · fastest day ${maxDay} · daily movers ${(Math.min(...share) * 100).toFixed(0)}–${(Math.max(...share) * 100).toFixed(0)}% · busiest 3h slot ${(slotMax * 100).toFixed(0)}% · bingers ${bingers} · quitters ${quitters}`);
  // deterministic: the same moment is the same answer
  const again = await all(db, `select l.level from public.profiles p join private.bot_anchor a on a.profile_id = p.id, lateral public.lb_bot_live(p.id, a.level, a.rebirths, timestamptz '2026-11-14 00:00+00', timestamptz '2026-12-01 13:00+00') l where p.is_bot order by p.id`);
  const once = await all(db, `select l.level from public.profiles p join private.bot_anchor a on a.profile_id = p.id, lateral public.lb_bot_live(p.id, a.level, a.rebirths, timestamptz '2026-11-14 00:00+00', timestamptz '2026-12-01 13:00+00') l where p.is_bot order by p.id`);
  assert.deepEqual(again, once);
});

test('090: a bot never passes a real player who played in the last 3 days — it waits a few levels behind; once they are away 3 days, it may pass', { skip: !PGlite && 'PGlite not installed' }, async () => {
  const db = await database();
  await db.exec(SQL_090);
  // find a bot that, started 40 days ago at R4 LV80, would by now stand above REALMID (R5 LV100)
  const [pick] = await all(db, `
    select p.id from public.profiles p, lateral public.lb_bot_live(p.id, 80, 4, now() - interval '40 days', now()) l
     where p.is_bot and (l.rebirths, l.level) > (5, 100) and (l.rebirths, l.level) < (89, 1577) order by p.id limit 1`);
  assert.ok(pick, 'some bot climbs past R5 LV100 in 40 days');
  await db.query(`update private.bot_anchor set level = 80, rebirths = 4, at = now() - interval '40 days' where profile_id = $1`, [pick.id]);
  await db.query(`update public.profiles set stars = 0 where id = $1`, [pick.id]);
  const board = async () => all(db, `select b.rank, b.username, b.level, b.rebirths, b.id::text = $1 as me from public.leaderboard_s2 b order by b.rank`, [pick.id]);
  let rows = await board();
  const bot = rows.find((r) => r.me);
  const mid = rows.find((r) => r.username === 'REALMID');
  assert.ok(bot.rank > mid.rank, `held behind REALMID (#${mid.rank}): bot #${bot.rank}`);
  assert.equal(bot.rebirths, 5);
  assert.ok(bot.level >= 94 && bot.level <= 99, `a few levels behind: LV ${bot.level}`);
  // REALMID stops playing for 3+ days: the bot is free to pass
  await db.exec(`update public.profiles set updated_at = now() - interval '4 days' where username = 'REALMID'`);
  rows = await board();
  assert.ok(rows.find((r) => r.me).rank < rows.find((r) => r.username === 'REALMID').rank, 'passes a player who has been away 3 days');
  // REALTOP (active, far above) is never touched
  assert.equal(rows.find((r) => r.username === 'REALTOP').level, 1577);
  // a real player who JUST rebirthed (LV 1) leaves no room a few levels under them: the bot waits one rebirth behind
  await db.exec(`insert into public.profiles (username, level, rebirths, lifetime_words, is_bot, updated_at) values ('REALREB', 1, 6, 0, false, now())`);
  rows = await board();
  const reb = rows.find((r) => r.username === 'REALREB');
  const held = rows.find((r) => r.me);
  assert.ok(held.rank > reb.rank, `never passes a fresh rebirth: bot #${held.rank} R${held.rebirths} LV${held.level} vs REALREB #${reb.rank}`);
  assert.equal(held.rebirths, 5);
});
