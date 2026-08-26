// streak.test.js — the daily-streak day-math, freeze tokens, reward curve, and its fold into
// xpPerInput. The pure core (advanceStreak/streakMultiplier) needs no storage; the xpPerInput
// case passes the multiplier explicitly so it stays DOM-free too.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceStreak,
  streakMultiplier,
  normalizeStreak,
  localDayIndex,
} from './streak.js';
import { xpPerInput } from './xp.js';

// ---- day rollover increments -------------------------------------------------------------
test('the next day increments the streak', () => {
  const day = 1000;
  const next = advanceStreak({ count: 4, lastDay: day, freezes: 0 }, day + 1);
  assert.equal(next.count, 5);
  assert.equal(next.lastDay, day + 1);
});

test('first-ever activity starts the streak at 1', () => {
  const next = advanceStreak({ count: 0, lastDay: 0, freezes: 0 }, 500);
  assert.equal(next.count, 1);
  assert.equal(next.lastDay, 500);
});

test('a second word the SAME day does not change the count', () => {
  const prev = { count: 3, lastDay: 42, freezes: 0 };
  assert.deepEqual(advanceStreak(prev, 42), prev);
});

// ---- two-day gap resets ------------------------------------------------------------------
test('a missed day with no freeze token resets the streak to 1', () => {
  const next = advanceStreak({ count: 9, lastDay: 100, freezes: 0 }, 102); // skipped day 101
  assert.equal(next.count, 1);
  assert.equal(next.lastDay, 102);
});

test('a larger gap always resets, even with freezes banked', () => {
  const next = advanceStreak({ count: 12, lastDay: 100, freezes: 3 }, 105); // 4 days missed
  assert.equal(next.count, 1);
  assert.equal(next.freezes, 3); // earned freezes are never forfeited on a reset
});

// ---- a freeze token absorbs one miss -----------------------------------------------------
test('a freeze token absorbs a single missed day and keeps the streak going', () => {
  const next = advanceStreak({ count: 5, lastDay: 100, freezes: 1 }, 102); // skipped day 101
  assert.equal(next.count, 6); // streak survives and advances
  assert.equal(next.freezes, 0); // the token was spent
  assert.equal(next.lastDay, 102);
});

// ---- freeze tokens are granted one per 7 days held ---------------------------------------
test('reaching a multiple of 7 grants a freeze token', () => {
  const at6 = { count: 6, lastDay: 200, freezes: 0 };
  const at7 = advanceStreak(at6, 201);
  assert.equal(at7.count, 7);
  assert.equal(at7.freezes, 1);
});

test('a non-milestone day grants no token', () => {
  const next = advanceStreak({ count: 7, lastDay: 200, freezes: 1 }, 201);
  assert.equal(next.count, 8);
  assert.equal(next.freezes, 1);
});

// ---- the reward curve --------------------------------------------------------------------
test('streakMultiplier follows the capped ladder', () => {
  assert.equal(streakMultiplier(0), 1);
  assert.equal(streakMultiplier(2), 1);
  assert.equal(streakMultiplier(3), 1.05);
  assert.equal(streakMultiplier(7), 1.1);
  assert.equal(streakMultiplier(14), 1.2);
  assert.equal(streakMultiplier(30), 1.25);
  assert.equal(streakMultiplier(999), 1.25); // capped
});

// ---- the multiplier is applied in xpPerInput ---------------------------------------------
test('xpPerInput folds the streak multiplier into the stack', () => {
  // Base menu input at tier 0 is 10 XP/letter. A ×2 streak factor doubles it (before round10,
  // which leaves a clean multiple of 10 untouched).
  const base = xpPerInput({ mode: 'menu', keyTier: 0, rebirthCount: 0, streakMult: 1 });
  const boosted = xpPerInput({ mode: 'menu', keyTier: 0, rebirthCount: 0, streakMult: 2 });
  assert.equal(base, 10);
  assert.equal(boosted, 20);
});

// ---- housekeeping ------------------------------------------------------------------------
test('normalizeStreak coerces garbage to a zeroed streak', () => {
  assert.deepEqual(normalizeStreak(null), { count: 0, lastDay: 0, freezes: 0 });
  assert.deepEqual(normalizeStreak({ count: -5, lastDay: 'x', freezes: 2.9 }), {
    count: 0,
    lastDay: 0,
    freezes: 2,
  });
});

test('localDayIndex is stable within a day and advances across local midnight', () => {
  // Two instants 1ms apart inside the same UTC day share an index; +1 day advances it by 1.
  const t = 1_700_000_000_000;
  assert.equal(localDayIndex(t), localDayIndex(t + 1));
  assert.equal(localDayIndex(t + 86400000) - localDayIndex(t), 1);
});
