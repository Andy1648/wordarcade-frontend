// finalRules.test.js — 026_progression_final.sql and its JS mirror: the season-2 board write (finalRules.decideSubmitFinal)
// and lb_rebirth / lb_ascend season 2 (rebirthRules.decideRebirth / decideAscend). The SQL text is pinned against the
// JS constants so the two cannot drift.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  decideSubmitFinal, finalLevelRoom, F_ECON, F_GATE_STEP, F_LV_HEADROOM, F_LEVELS_PER_SEC, F_LEVEL_BANK_SECS, F_WORDS_PER_RB,
  F_LV_MAX,
} from './finalRules.js';
import { decideRebirth, decideAscend, GATE2_STEP, ASCEND_AT, ASCEND_STEP, RATE_PER_SEC, RB_WINDOW_SECS, RB_PER_WINDOW, LOG_KEEP_DAYS, SEASON2_ECON } from './rebirthRules.js';

const T0 = Date.UTC(2026, 9, 6, 20, 0, 0);
const UUID = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const row = (o = {}) => ({ level: 1, rebirths: 0, lifetime_words: 0, lifetime_letters: 0, submitted_at: T0 - 60_000, econ: 13, ...o });
const sub = (o = {}) => ({ level: 1, rebirths: 0, words: 0, letters: 0, ...o });
const sql = () => readFileSync(join(process.cwd(), 'supabase', 'migrations', '026_progression_final.sql'), 'utf8').replace(/\r\n/g, '\n');

test('FINAL board constants: gate step 25 (= lb_rebirth season 2), room = 25 × (R+1) + 100', () => {
  assert.equal(F_ECON, SEASON2_ECON);
  assert.equal(F_GATE_STEP, GATE2_STEP);
  assert.deepEqual([0, 1, 9].map(finalLevelRoom), [125, 150, 350]);
  assert.equal(finalLevelRoom(1e12), F_LV_MAX);
});

test('FIRST season-2 write: a baseline bounded by play (rebirths ≤ words / 100, level ≤ the room)', () => {
  const fresh = decideSubmitFinal({ ...row(), submitted_at: null }, sub({ level: 60, words: 30 }), T0);
  assert.deepEqual([fresh.action, fresh.row.level, fresh.row.rebirths, fresh.row.econ, fresh.weekDelta], ['first', 60, 0, 13, 0]);
  const forged = decideSubmitFinal({ ...row(), submitted_at: null }, sub({ level: 9e8, rebirths: 40, words: 250 }), T0);
  assert.deepEqual([forged.row.rebirths, forged.row.level], [2, finalLevelRoom(2)]);
  const s1 = decideSubmitFinal(row({ econ: 12, rebirths: 30, level: 600 }), sub({ level: 600, rebirths: 30, words: 90 }), T0);
  assert.deepEqual([s1.action, s1.row.rebirths, s1.row.level], ['first', 0, 125], 'a season-1 row starts a season-2 baseline');
});

test('then: rebirths never rise on a submit; the level is free up to the room or +1/s (20 min bank); clamped, not rejected', () => {
  const r = row({ level: 100, rebirths: 2, lifetime_words: 500, submitted_at: T0 - 10_000 });
  const up = decideSubmitFinal(r, sub({ level: 5000, rebirths: 3, words: 520 }), T0);
  assert.deepEqual([up.action, up.row.rebirths, up.row.level, up.weekDelta], ['increase', 2, finalLevelRoom(2), 20]);
  // a long-held climb past the room: + 1 level a second since the last write, banking 20 min
  const held = row({ level: 400, rebirths: 2, lifetime_words: 500, submitted_at: T0 - 3600_000 });
  assert.equal(decideSubmitFinal(held, sub({ level: 99999, rebirths: 2, words: 600 }), T0).row.level, 400 + F_LEVEL_BANK_SECS * F_LEVELS_PER_SEC);
  // honest FINAL pace (~150 levels an hour, a POWER buy +16 at once) is never clamped
  const honest = row({ level: 300, rebirths: 8, lifetime_words: 5000, submitted_at: T0 - 60_000 });
  assert.equal(decideSubmitFinal(honest, sub({ level: 320, rebirths: 8, words: 5014 }), T0).row.level, 320);
  // after a server rebirth (stored LV 15 at R1) the client's leftover lands
  const after = row({ level: 15, rebirths: 1, lifetime_words: 200, submitted_at: T0 - 30_000 });
  assert.equal(decideSubmitFinal(after, sub({ level: 17, rebirths: 1, words: 210 }), T0).row.level, 17);
  assert.equal('stars' in up.row, false, 'a submit never writes stars');
});

test('throttle, rate checks and RESET as 017 / 022', () => {
  assert.equal(decideSubmitFinal(row({ submitted_at: T0 - 2000 }), sub(), T0).action, 'throttled');
  assert.equal(decideSubmitFinal(row({ submitted_at: T0 - 10_000 }), sub({ words: 999 }), T0).action, 'rejected');
  const reset = decideSubmitFinal(row({ level: 300, rebirths: 5, lifetime_words: 900 }), sub({ level: 1, rebirths: 0, words: 0 }), T0);
  assert.deepEqual([reset.action, reset.row.level, reset.row.rebirths], ['reset', 1, 0]);
});

test('026 SQL mirrors finalRules.js + rebirthRules.js season 2: constants, order, spend, ascend, grants; lb_caps untouched', () => {
  const s = sql();
  assert.match(s, /KEEP IN SYNC WITH src\/leaderboard\/rebirthRules\.js/);
  assert.match(s, /src\/leaderboard\/finalRules\.js \(decideSubmitFinal\)/);
  assert.match(s, /WRITE-ONLY: Claude never runs migrations/);
  assert.match(s, /022_season2_board\.sql → 024_season2_weekly\.sql → THIS FILE \(026\) → claude\/run-season2\.sql/);
  assert.match(s, /to_regprocedure\('private\.lb_board_write_s2\(text,integer,integer,bigint,bigint,numeric\)'\) is null/);
  // the board write
  assert.match(s, new RegExp(`F_ECON constant smallint := ${F_ECON};`));
  assert.match(s, new RegExp(`F_GATE_STEP constant integer := ${F_GATE_STEP};`));
  assert.match(s, new RegExp(`F_LV_HEADROOM constant integer := ${F_LV_HEADROOM};`));
  assert.match(s, new RegExp(`F_LEVELS_PER_SEC constant integer := ${F_LEVELS_PER_SEC};`));
  assert.match(s, new RegExp(`F_LEVEL_BANK_SECS constant integer := ${F_LEVEL_BANK_SECS};`));
  assert.match(s, new RegExp(`F_WORDS_PER_RB constant integer := ${F_WORDS_PER_RB};`));
  assert.match(s, new RegExp(`F_LV_MAX constant bigint := ${F_LV_MAX};`));
  assert.match(s, /if old\.submitted_at is null or old\.econ is distinct from F_ECON then/);
  assert.match(s, /rb := least\(rb, floor\(w \/ F_WORDS_PER_RB\)::bigint\);/);
  assert.match(s, /lv := least\(lv, least\(F_LV_MAX, F_GATE_STEP \* \(rb \+ 1\) \+ F_LV_HEADROOM\)\);/);
  assert.match(s, /rb := least\(rb, old\.rebirths::bigint\); -- a submit never raises rebirths/);
  assert.match(s, /lv_cap := least\(F_LV_MAX, greatest\(F_GATE_STEP \* \(rb \+ 1\) \+ F_LV_HEADROOM, base_lv \+ max_rise\)\);/);
  assert.match(s, /interval '5 seconds'/);
  assert.match(s, /20 \* secs/);
  assert.match(s, /150 \* secs/);
  // lb_rebirth
  assert.match(s, new RegExp(`RATE_PER_SEC constant integer := ${RATE_PER_SEC};`));
  assert.match(s, new RegExp(`RB_WINDOW_SECS constant integer := ${RB_WINDOW_SECS};`));
  assert.match(s, new RegExp(`RB_PER_WINDOW constant integer := ${RB_PER_WINDOW};`));
  assert.match(s, new RegExp(`LOG_KEEP_DAYS constant integer := ${LOG_KEEP_DAYS};`));
  assert.match(s, new RegExp(`GATE2_STEP constant integer := ${GATE2_STEP};`));
  assert.match(s, /when p_season = 0 then 25 \* \(old\.rebirths::numeric \+ 1\)/);
  assert.match(s, /when p_season = 2 and old\.econ = S2_ECON then GATE2_STEP \* \(old\.rebirths::numeric \+ 1\)/);
  assert.match(s, /elsif p_season = 2 and old\.level <= gate then/);
  assert.match(s, /'gate', gate \+ 1, 'cost', gate/);
  assert.match(s, /elsif p_season = 0 and old\.level < gate then/);
  assert.match(s, /left_lv := case when p_season = 2 then \(old\.level - gate\)::integer else 1 end;/);
  assert.match(s, /set rebirths = old\.rebirths \+ 1, level = left_lv/);
  assert.match(s, /return \(prev\.result \|\| jsonb_build_object\('replay', true\)\)::json;/);
  // lb_ascend
  assert.match(s, new RegExp(`ASCEND_AT constant integer := ${ASCEND_AT};`));
  assert.match(s, new RegExp(`ASCEND_STEP constant integer := ${ASCEND_STEP};`));
  assert.match(s, /need := ASCEND_AT \+ ASCEND_STEP \* greatest\(coalesce\(old\.stars, 0\), 0\);/);
  assert.match(s, /st := coalesce\(old\.stars, 0\) \+ 1;/);
  assert.match(s, /set stars = st, rebirths = 0, level = 1/);
  assert.doesNotMatch(s, /old\.rebirths - \(ASCEND_AT - 1\)/, 'never R − 9');
  // order of checks: replay → rate → season → gate → pace → grant
  const body = s.slice(s.indexOf('create or replace function public.lb_rebirth'), s.indexOf('create or replace function public.lb_ascend'));
  const at = (re) => body.search(re);
  const order = [/where profile_id = pid and request_id = p_request_id/, /interval '1 second'/, /if gate is null then/, /old\.level <= gate/, /granted >= RB_PER_WINDOW/, /update public\.profiles set rebirths/].map(at);
  for (let i = 1; i < order.length; i++) assert.ok(order[i] > order[i - 1], `check ${i} out of order: ${order}`);
  // grants / revokes
  for (const fn of ['lb_rebirth', 'lb_ascend']) {
    assert.match(s, new RegExp(`revoke all on function public\\.${fn}\\(text, uuid, smallint\\) from public;`));
    assert.match(s, new RegExp(`grant execute on function public\\.${fn}\\(text, uuid, smallint\\) to anon, authenticated;`));
  }
  assert.match(s, /revoke all on function private\.lb_board_write_s2\(text, integer, integer, bigint, bigint, numeric\) from anon, authenticated;/);
  assert.doesNotMatch(s, /create or replace function public\.lb_caps/, '026 leaves lb_caps to 023 (season2_reset)');
  assert.doesNotMatch(s, /\bgrant [a-z, ]+ on (table )?public\.rebirth_requests/i);
});

test('JS rule == SQL rule on a FINAL climb: R0 → R10 → ascend → R15 → ascend', () => {
  let r = { level: 1, rebirths: 0, stars: 0, econ: 13 };
  let n = 0;
  const log = [];
  let now = T0;
  const climb = (to) => {
    while (r.rebirths < to) {
      r = { ...r, level: r.level + GATE2_STEP * (r.rebirths + 1) + 3 };
      const out = decideRebirth(r, { requestId: UUID(++n), season: 2 }, log, (now += 400e3));
      assert.equal(out.result.ok, true, JSON.stringify(out.result));
      log.push(out.entry);
      r = out.row;
    }
  };
  climb(10);
  assert.equal(r.level, 1 + 3 * 10, 'every rebirth spent exactly its gate');
  r = decideAscend(r, { requestId: UUID(++n), season: 2 }, [], (now += 1e6)).row;
  assert.deepEqual([r.stars, r.rebirths, r.level], [1, 0, 1]);
  climb(14);
  assert.equal(decideAscend(r, { requestId: UUID(++n), season: 2 }, [], (now += 1e6)).result.ok, false);
  climb(15);
  r = decideAscend(r, { requestId: UUID(++n), season: 2 }, [], (now += 1e6)).row;
  assert.deepEqual([r.stars, r.rebirths], [2, 0]);
});
