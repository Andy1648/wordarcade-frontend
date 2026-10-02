import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weekResetInMs, formatResetIn } from './client.js';

const H = 3600 * 1000;
test('the weekly board resets at Monday 00:00 America/New_York', () => {
  // Sun Oct 4 2026 23:00 EDT (UTC-4) = Mon 03:00 UTC → 1 h left
  assert.equal(weekResetInMs(Date.UTC(2026, 9, 5, 3, 0, 0)), 1 * H);
  // Mon Oct 5 2026 00:00 EDT exactly = a full week left
  assert.equal(weekResetInMs(Date.UTC(2026, 9, 5, 4, 0, 0)), 7 * 24 * H);
  // Fri Oct 2 2026 16:30 EDT → 2 d 7 h 30 m left
  assert.equal(weekResetInMs(Date.UTC(2026, 9, 2, 20, 30, 0)), (2 * 24 + 7.5) * H);
  // winter (EST, UTC-5): Sun Jan 10 2027 23:30 EST = Mon 04:30 UTC → 30 m
  assert.equal(weekResetInMs(Date.UTC(2027, 0, 11, 4, 30, 0)), 0.5 * H);
});

test('the countdown reads coarse: days+hours, hours+minutes, minutes', () => {
  assert.equal(formatResetIn((2 * 24 + 7.5) * H), '2D 7H');
  assert.equal(formatResetIn(4 * H + 12 * 60000), '4H 12M');
  assert.equal(formatResetIn(12 * 60000), '12M');
  assert.equal(formatResetIn(0), '1M');
});
