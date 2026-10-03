// The 017_board_reality.sql write rule, modelled in submitRules.js (kept in sync with the SQL).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { decideSubmit } from './submitRules.js';

const T0 = Date.UTC(2026, 9, 3, 17, 0, 0);
const HOUR = 3600 * 1000;

test("Andy's row (LV12 R7, 0 words) + a submit of LV175 R0 = a RESET baseline at LV175, then increases are clamped", () => {
  // his last ACCEPTED submit was long ago — every submit since his local-only reset was dropped by 015/016
  const row = { level: 12, rebirths: 7, lifetime_words: 0, lifetime_letters: 0, submitted_at: T0 - 5 * HOUR };
  const a = decideSubmit(row, { level: 175, rebirths: 0, words: 0, letters: 0 }, T0);
  assert.equal(a.action, 'reset');
  assert.equal(a.row.level, 175);
  assert.equal(a.row.rebirths, 0);
  assert.equal(a.weekDelta, 0);
  assert.equal(a.row.submitted_at, T0);

  // 5 s later (just past the throttle) at LV176 → an INCREASE, inside the clamp (5 s × 0.5 = 2 levels)
  const b = decideSubmit(a.row, { level: 176, rebirths: 0, words: 0, letters: 0 }, T0 + 5001);
  assert.equal(b.action, 'increase');
  assert.equal(b.row.level, 176);
  // …and a forged LV999 in the same window is clamped to 175 + 2
  const c = decideSubmit(a.row, { level: 999, rebirths: 0, words: 0, letters: 0 }, T0 + 5001);
  assert.equal(c.action, 'increase');
  assert.equal(c.row.level, 177);
  // exactly 5 s or less is throttled (SQL: submitted_at >= now() - 5 s)
  assert.equal(decideSubmit(a.row, { level: 176, rebirths: 0, words: 0, letters: 0 }, T0 + 5000).action, 'throttled');
});

test('the first submit is a baseline as submitted (no clamp, no weekly words)', () => {
  const r = decideSubmit({ level: 1, rebirths: 0, lifetime_words: 0, lifetime_letters: 0, submitted_at: null }, { level: 900, rebirths: 3, words: 50000, letters: 250000 }, T0);
  assert.equal(r.action, 'first');
  assert.deepEqual(r.row, { level: 900, rebirths: 3, lifetime_words: 50000, lifetime_letters: 250000, submitted_at: T0 });
  assert.equal(r.weekDelta, 0);
});

test('every lower number is a reset: rebirths, words, letters, or level at the same rebirth count', () => {
  const row = { level: 300, rebirths: 2, lifetime_words: 1000, lifetime_letters: 5000, submitted_at: T0 - HOUR };
  const same = { level: 300, rebirths: 2, words: 1000, letters: 5000 };
  for (const lower of [{ rebirths: 1 }, { words: 999 }, { letters: 4999 }, { level: 299 }]) {
    const r = decideSubmit(row, { ...same, ...lower }, T0);
    assert.equal(r.action, 'reset', JSON.stringify(lower));
    assert.equal(r.weekDelta, 0);
  }
  // a full wipe lands exactly as submitted
  const wipe = decideSubmit(row, { level: 1, rebirths: 0, words: 0, letters: 0 }, T0);
  assert.deepEqual(wipe.row, { level: 1, rebirths: 0, lifetime_words: 0, lifetime_letters: 0, submitted_at: T0 });
  // a level DROP across a rebirth is a normal rebirth (increase path), not a reset
  assert.equal(decideSubmit(row, { level: 5, rebirths: 3, words: 1000, letters: 5000 }, T0).action, 'increase');
});

test('a lower submit is written as submitted, never clamped down further', () => {
  const row = { level: 5222, rebirths: 0, lifetime_words: 800, lifetime_letters: 4000, submitted_at: T0 - 10_000 };
  const r = decideSubmit(row, { level: 4000, rebirths: 0, words: 800, letters: 4000 }, T0);
  assert.equal(r.action, 'reset');
  assert.equal(r.row.level, 4000);
});

test('MIXED: rebirths lower but level higher — the level is capped by the clamp counted from 1 (never below the stored level)', () => {
  // 10 s since the last accepted submit: allowance = 5 levels → cap = max(stored 12, 1 + 5) = 12
  const row = { level: 12, rebirths: 7, lifetime_words: 0, lifetime_letters: 0, submitted_at: T0 - 10_000 };
  const r = decideSubmit(row, { level: 175, rebirths: 0, words: 0, letters: 0 }, T0);
  assert.equal(r.action, 'reset');
  assert.equal(r.row.level, 12);
  // 100 s: allowance 50 → cap = max(12, 51) = 51
  const r2 = decideSubmit({ ...row, submitted_at: T0 - 100_000 }, { level: 175, rebirths: 0, words: 0, letters: 0 }, T0);
  assert.equal(r2.row.level, 51);
  // a 1-level-row reset with a higher level: counted from 1 → 1 + allowance
  const r3 = decideSubmit({ level: 1, rebirths: 4, lifetime_words: 0, lifetime_letters: 0, submitted_at: T0 - 20_000 }, { level: 500, rebirths: 0, words: 0, letters: 0 }, T0);
  assert.equal(r3.row.level, 11);
  // words lower but rebirths/words/letters UP elsewhere: rebirths ≤ +1, letters capped at 150/s (not rejected)
  const r4 = decideSubmit(
    { level: 50, rebirths: 2, lifetime_words: 100, lifetime_letters: 100, submitted_at: T0 - 10_000 },
    { level: 50, rebirths: 9, words: 0, letters: 1_000_000 },
    T0,
  );
  assert.equal(r4.action, 'reset');
  assert.equal(r4.row.rebirths, 3);
  assert.equal(r4.row.lifetime_letters, 100 + 1500);
  assert.equal(r4.row.lifetime_words, 0);
});

test('increases stay rate-checked exactly as 015: words/letters too fast → rejected; rebirth restarts the clamp at 1', () => {
  const row = { level: 100, rebirths: 1, lifetime_words: 1000, lifetime_letters: 5000, submitted_at: T0 - 10_000 };
  assert.equal(decideSubmit(row, { level: 101, rebirths: 1, words: 1201, letters: 5000 }, T0).action, 'rejected');
  assert.equal(decideSubmit(row, { level: 101, rebirths: 1, words: 1000, letters: 6501 }, T0).action, 'rejected');
  const ok = decideSubmit(row, { level: 101, rebirths: 1, words: 1200, letters: 6500 }, T0);
  assert.equal(ok.action, 'increase');
  assert.equal(ok.weekDelta, 200);
  const reb = decideSubmit(row, { level: 80, rebirths: 4, words: 1000, letters: 5000 }, T0);
  assert.equal(reb.row.rebirths, 2);
  assert.equal(reb.row.level, 6); // counted from 1: 1 + 5
  // the 20-minute bank: 2 h away → at most 600 levels
  const back = decideSubmit({ ...row, submitted_at: T0 - 2 * HOUR }, { level: 5000, rebirths: 1, words: 1000, letters: 5000 }, T0);
  assert.equal(back.row.level, 700);
});

test('017 SQL carries the same branches + constants as this model', () => {
  const sql = readFileSync(join(process.cwd(), 'supabase', 'migrations', '017_board_reality.sql'), 'utf8');
  assert.match(sql, /KEEP IN SYNC WITH src\/leaderboard\/submitRules\.js/);
  assert.match(sql, /interval '5 seconds'/);
  assert.match(sql, /rb < old\.rebirths or w < old\.lifetime_words or l < old\.lifetime_letters\s+or \(lv < old\.level and rb = old\.rebirths\)/);
  assert.match(sql, /least\(lv::bigint, greatest\(old\.level::bigint, 1 \+ max_rise\)\)/);
  assert.match(sql, /floor\(least\(secs, 1200\) \* 0\.5\)/);
  assert.match(sql, /20 \* secs/);
  assert.match(sql, /150 \* secs/);
  assert.match(sql, /least\(rb, old\.rebirths \+ 1\)/);
  assert.match(sql, /econ = 10/);
});
