// boostSpan.test.js — the dock's drain bar: a new boost starts full, drains with time, a +5 MIN extension grows the
// span (the bar refills part-way) and a fresh boost after the last one ended starts full again.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spanOf } from './boostSpan.js';

const MIN = 60_000;

test('a new boost starts full and drains with the clock', () => {
  const spans = {};
  const t0 = 1_000_000;
  assert.equal(spanOf(spans, 'rush', 5 * MIN, t0).frac, 1);
  const half = spanOf(spans, 'rush', 2.5 * MIN, t0 + 2.5 * MIN);
  assert.ok(Math.abs(half.frac - 0.5) < 1e-9);
  assert.equal(half.grew, false);
});

test('+5 MIN on a running boost grows the span (the bar refills part-way), once', () => {
  const spans = {};
  const t0 = 1_000_000;
  spanOf(spans, 'boost1', 5 * MIN, t0);
  const ext = spanOf(spans, 'boost1', 2 * MIN + 5 * MIN, t0 + 3 * MIN); // 2 min left, then +5
  assert.equal(ext.grew, true);
  assert.ok(Math.abs(ext.frac - 7 / 10) < 1e-9);
  assert.equal(spanOf(spans, 'boost1', 7 * MIN - 1000, t0 + 3 * MIN + 1000).grew, false);
});

test('a fresh boost after the last one ended starts full again', () => {
  const spans = {};
  const t0 = 1_000_000;
  spanOf(spans, 'xp', 10 * MIN, t0);
  const again = spanOf(spans, 'xp', 3 * MIN, t0 + 20 * MIN);
  assert.equal(again.frac, 1);
  assert.equal(again.grew, false);
});
