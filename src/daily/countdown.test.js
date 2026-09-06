// countdown.test.js — the live "next daily in HH:MM:SS" clock rests on this math being
// pure and correct across a local-midnight rollover. No timers, fixed Dates only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { msUntilLocalMidnight, formatCountdown, nextDailyIn } from './countdown.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ---- msUntilLocalMidnight ----
test('one hour before local midnight → exactly 1h remaining', () => {
  const now = new Date(2026, 8, 4, 23, 0, 0, 0); // 23:00 local
  assert.equal(msUntilLocalMidnight(now), 60 * 60 * 1000);
});

test('mixed H:M:S before local midnight → exact remainder', () => {
  const now = new Date(2026, 8, 4, 22, 58, 57, 0); // 01:01:03 left
  assert.equal(msUntilLocalMidnight(now), (1 * 3600 + 1 * 60 + 3) * 1000);
});

test('just after midnight → nearly a full day (never ~0)', () => {
  const now = new Date(2026, 8, 5, 0, 0, 1, 0); // 1s past midnight
  assert.equal(msUntilLocalMidnight(now), MS_PER_DAY - 1000);
});

test('exactly local midnight → a FULL day, never 0 (no dead tick)', () => {
  const now = new Date(2026, 8, 5, 0, 0, 0, 0);
  assert.equal(msUntilLocalMidnight(now), MS_PER_DAY);
});

test('result is always in (0, MS_PER_DAY] for any local time of day', () => {
  for (let h = 0; h < 24; h++) {
    for (const mnt of [0, 17, 43, 59]) {
      const ms = msUntilLocalMidnight(new Date(2026, 5, 15, h, mnt, 30, 0));
      assert.ok(ms > 0 && ms <= MS_PER_DAY, `h=${h} m=${mnt} → ${ms}`);
    }
  }
});

// ---- formatCountdown ----
test('formats HH:MM:SS with zero-padding', () => {
  assert.equal(formatCountdown((1 * 3600 + 1 * 60 + 1) * 1000), '01:01:01');
  assert.equal(formatCountdown(0), '00:00:00');
  assert.equal(formatCountdown((23 * 3600 + 59 * 60 + 59) * 1000), '23:59:59');
});

test('formatCountdown floors sub-second and clamps negatives to zero', () => {
  assert.equal(formatCountdown(1999), '00:00:01');
  assert.equal(formatCountdown(-5000), '00:00:00');
  assert.equal(formatCountdown(NaN), '00:00:00');
});

// ---- nextDailyIn (composed) ----
test('nextDailyIn is the formatted time to local midnight', () => {
  const now = new Date(2026, 8, 4, 21, 30, 15, 0); // 02:29:45 to midnight
  assert.equal(nextDailyIn(now), '02:29:45');
});
