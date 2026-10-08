// finalRules.test.js — 029_progression_final_v3.sql and its JS mirror: the season-2 board write
// (finalRules.decideSubmitFinal) and lb_rebirth / lb_ascend season 2 (rebirthRules.decideRebirth / decideAscend). The SQL
// text is pinned against the JS constants so the two cannot drift.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  decideSubmitFinal, finalLevelRoom, F_ECON, F_GATE_BASE, F_GATE_STEP, F_LV_HEADROOM, F_LEVELS_PER_SEC, F_LEVEL_BANK_SECS,
  F_WORDS_PER_RB, F_LV_MAX,
} from './finalRules.js';
import {
  decideRebirth, decideAscend, serverGate, GATE2_BASE, GATE2_STEP, RATE_PER_SEC, RB_WINDOW_SECS, RB_PER_WINDOW, LOG_KEEP_DAYS,
  SEASON2_ECON,
} from './rebirthRules.js';

const T0 = Date.UTC(2026, 9, 6, 20, 0, 0);
const UUID = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const row = (o = {}) => ({ level: 1, rebirths: 0, lifetime_words: 0, lifetime_letters: 0, submitted_at: T0 - 60_000, econ: 13, ...o });
const sub = (o = {}) => ({ level: 1, rebirths: 0, words: 0, letters: 0, ...o });
const sql = () => readFileSync(join(process.cwd(), 'supabase', 'migrations', '029_progression_final_v3.sql'), 'utf8').replace(/\r\n/g, '\n');
const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const has = (s, text) => assert.ok(s.includes(text), `029 is missing: ${text}`);

test('FINAL v3 board constants: gate 15 + 18·R (= lb_rebirth season 2), room = 15 + 18·R + 100', () => {
  assert.equal(F_ECON, SEASON2_ECON);
  assert.equal(F_GATE_BASE, GATE2_BASE);
  assert.equal(F_GATE_STEP, GATE2_STEP);
  assert.deepEqual([0, 1, 9].map(finalLevelRoom), [115, 133, 277]);
  assert.equal(finalLevelRoom(1e12), F_LV_MAX);
});

test('FIRST season-2 write: a baseline bounded by play (rebirths ≤ words / 100, level ≤ the room)', () => {
  const fresh = decideSubmitFinal({ ...row(), submitted_at: null }, sub({ level: 60, words: 30 }), T0);
  assert.deepEqual([fresh.action, fresh.row.level, fresh.row.rebirths, fresh.row.econ, fresh.weekDelta], ['first', 60, 0, 13, 0]);
  const forged = decideSubmitFinal({ ...row(), submitted_at: null }, sub({ level: 9e8, rebirths: 40, words: 250 }), T0);
  assert.deepEqual([forged.row.rebirths, forged.row.level], [2, finalLevelRoom(2)]);
  const s1 = decideSubmitFinal(row({ econ: 12, rebirths: 30, level: 600 }), sub({ level: 600, rebirths: 30, words: 90 }), T0);
  assert.deepEqual([s1.action, s1.row.rebirths, s1.row.level], ['first', 0, 115], 'a season-1 row starts a season-2 baseline');
});

test('then: rebirths never rise on a submit; the level is free up to the room or +1/s (20 min bank); clamped, not rejected', () => {
  const r = row({ level: 100, rebirths: 2, lifetime_words: 500, submitted_at: T0 - 10_000 });
  const up = decideSubmitFinal(r, sub({ level: 5000, rebirths: 3, words: 520 }), T0);
  assert.deepEqual([up.action, up.row.rebirths, up.row.level, up.weekDelta], ['increase', 2, finalLevelRoom(2), 20]);
  // a long-held climb past the room: + 1 level a second since the last write, banking 20 min
  const held = row({ level: 400, rebirths: 2, lifetime_words: 500, submitted_at: T0 - 3600_000 });
  assert.equal(decideSubmitFinal(held, sub({ level: 99999, rebirths: 2, words: 600 }), T0).row.level, 400 + F_LEVEL_BANK_SECS * F_LEVELS_PER_SEC);
  // honest v3 pace (a run up to the gate 15 + 18·R) is never clamped
  const honest = row({ level: 100, rebirths: 8, lifetime_words: 5000, submitted_at: T0 - 60_000 });
  assert.equal(decideSubmitFinal(honest, sub({ level: 159, rebirths: 8, words: 5014 }), T0).row.level, 159);
  // after a server rebirth (stored LV 1 at R1) the client's new climb lands
  const after = row({ level: 1, rebirths: 1, lifetime_words: 200, submitted_at: T0 - 30_000 });
  assert.equal(decideSubmitFinal(after, sub({ level: 4, rebirths: 1, words: 210 }), T0).row.level, 4);
  assert.equal('stars' in up.row, false, 'a submit never writes stars');
});

test('throttle, rate checks and RESET as 017 / 022', () => {
  assert.equal(decideSubmitFinal(row({ submitted_at: T0 - 2000 }), sub(), T0).action, 'throttled');
  assert.equal(decideSubmitFinal(row({ submitted_at: T0 - 10_000 }), sub({ words: 999 }), T0).action, 'rejected');
  const reset = decideSubmitFinal(row({ level: 300, rebirths: 5, lifetime_words: 900 }), sub({ level: 1, rebirths: 0, words: 0 }), T0);
  assert.deepEqual([reset.action, reset.row.level, reset.row.rebirths], ['reset', 1, 0]);
});

test('029 SQL mirrors finalRules.js + rebirthRules.js season 2: constants, order, gate → LV1, ascend off, grants; lb_caps untouched', () => {
  const s = sql();
  has(s, 'KEEP IN SYNC WITH src/leaderboard/rebirthRules.js');
  has(s, 'src/leaderboard/finalRules.js (decideSubmitFinal)');
  has(s, 'WRITE-ONLY: Claude never runs migrations');
  has(s, '022_season2_board.sql → 024_season2_weekly.sql → 027_progression_final_v2.sql → THIS FILE (029) →');
  has(s, 'claude/run-season2.sql (= 023, the reset)');
  has(s, "to_regprocedure('private.lb_board_write_s2(text,integer,integer,bigint,bigint,numeric)') is null");
  // the board write
  has(s, `F_ECON constant smallint := ${F_ECON};`);
  has(s, `F_GATE_BASE constant integer := ${F_GATE_BASE};`);
  has(s, `F_GATE_STEP constant integer := ${F_GATE_STEP};`);
  has(s, `F_LV_HEADROOM constant integer := ${F_LV_HEADROOM};`);
  has(s, `F_LEVELS_PER_SEC constant integer := ${F_LEVELS_PER_SEC};`);
  has(s, `F_LEVEL_BANK_SECS constant integer := ${F_LEVEL_BANK_SECS};`);
  has(s, `F_WORDS_PER_RB constant integer := ${F_WORDS_PER_RB};`);
  has(s, `F_LV_MAX constant bigint := ${F_LV_MAX};`);
  has(s, 'if old.submitted_at is null or old.econ is distinct from F_ECON then');
  has(s, 'rb := least(rb, floor(w / F_WORDS_PER_RB)::bigint);');
  has(s, 'lv := least(lv, least(F_LV_MAX, F_GATE_BASE + F_GATE_STEP * rb + F_LV_HEADROOM));');
  has(s, 'rb := least(rb, old.rebirths::bigint); -- a submit never raises rebirths');
  has(s, 'lv_cap := least(F_LV_MAX, greatest(F_GATE_BASE + F_GATE_STEP * rb + F_LV_HEADROOM, base_lv + max_rise));');
  has(s, "interval '5 seconds'");
  has(s, '20 * secs');
  has(s, '150 * secs');
  // lb_rebirth
  has(s, `RATE_PER_SEC constant integer := ${RATE_PER_SEC};`);
  has(s, `RB_WINDOW_SECS constant integer := ${RB_WINDOW_SECS};`);
  has(s, `RB_PER_WINDOW constant integer := ${RB_PER_WINDOW};`);
  has(s, `LOG_KEEP_DAYS constant integer := ${LOG_KEEP_DAYS};`);
  has(s, `GATE2_BASE constant integer := ${GATE2_BASE};`);
  has(s, `GATE2_STEP constant integer := ${GATE2_STEP};`);
  has(s, 'when p_season = 0 then 25 * (old.rebirths::numeric + 1)');
  has(s, 'when p_season = 2 and old.econ = S2_ECON then GATE2_BASE + GATE2_STEP * old.rebirths::numeric');
  has(s, 'elsif old.level < gate then');
  has(s, 'set rebirths = old.rebirths + 1, level = 1, updated_at = now()');
  has(s, "return (prev.result || jsonb_build_object('replay', true))::json;");
  assert.doesNotMatch(s, /left_lv/, 'v3 never keeps leftover levels');
  // lb_ascend: hidden
  has(s, "res := jsonb_build_object('ok', false, 'reason', 'off');");
  assert.doesNotMatch(s, /set stars = /, '029 never grants a star');
  // order of checks: replay → rate → season → gate → pace → grant
  const body = s.slice(s.indexOf('create or replace function public.lb_rebirth'), s.indexOf('create or replace function public.lb_ascend'));
  const order = [
    'where profile_id = pid and request_id = p_request_id', "interval '1 second'", 'if gate is null then', 'old.level < gate',
    'granted >= RB_PER_WINDOW', 'update public.profiles set rebirths',
  ].map((t) => body.indexOf(t));
  for (let i = 1; i < order.length; i++) assert.ok(order[i - 1] >= 0 && order[i] > order[i - 1], `check ${i} out of order: ${order}`);
  // grants / revokes
  for (const fn of ['lb_rebirth', 'lb_ascend']) {
    has(s, `revoke all on function public.${fn}(text, uuid, smallint) from public;`);
    has(s, `grant execute on function public.${fn}(text, uuid, smallint) to anon, authenticated;`);
  }
  has(s, 'revoke all on function private.lb_board_write_s2(text, integer, integer, bigint, bigint, numeric) from anon, authenticated;');
  assert.doesNotMatch(s, new RegExp(esc('create or replace function public.lb_caps')), '029 leaves lb_caps to 023 (season2_reset)');
  assert.doesNotMatch(s, /\bgrant [a-z, ]+ on (table )?public\.rebirth_requests/i);
});

test('JS rule == SQL rule on a FINAL v3 climb: R0 → R10, each at LV 15 + 18·R → LV 1; ascension refused', () => {
  let r = { level: 1, rebirths: 0, stars: 0, econ: 13 };
  let n = 0;
  const log = [];
  let now = T0;
  while (r.rebirths < 10) {
    r = { ...r, level: serverGate(r.rebirths, 2) };
    const out = decideRebirth(r, { requestId: UUID(++n), season: 2 }, log, (now += 400e3));
    assert.equal(out.result.ok, true, JSON.stringify(out.result));
    log.push(out.entry);
    r = out.row;
    assert.equal(r.level, 1);
  }
  assert.deepEqual([0, 1, 4, 9].map((x) => serverGate(x, 2)), [15, 33, 87, 177]);
  const asc = decideAscend(r, { requestId: UUID(++n), season: 2 }, [], (now += 1e6));
  assert.deepEqual([asc.result.reason, asc.row.stars, asc.row.rebirths], ['off', 0, 10]);
});
