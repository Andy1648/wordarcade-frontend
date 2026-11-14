import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rollPlan, ROLL_MS, ROLL_STAGGER, ROLL_MIN_MS } from './rollPlan.js';

const digits = (p) => p.filter((x) => x.digit);

test('only digits roll; separators and suffixes stay put, in order', () => {
  const p = rollPlan('+1,250');
  assert.deepEqual(p.map((x) => x.ch).join(''), '+1,250');
  assert.deepEqual(p.map((x) => x.digit), [false, true, false, true, true, true]);
  assert.deepEqual(digits(p).map((x) => x.d), [1, 2, 5, 0]);
  assert.equal(digits(rollPlan('12.5K')).length, 3);
});

test('the digits land left to right, ROLL_STAGGER apart, the last one at ROLL_MS', () => {
  const ms = digits(rollPlan('4,321')).map((x) => x.ms);
  assert.equal(ms[ms.length - 1], ROLL_MS);
  for (let i = 1; i < ms.length; i++) assert.equal(ms[i] - ms[i - 1], ROLL_STAGGER);
});

test('a long number squeezes the stagger: nothing past ROLL_MS, nothing under ROLL_MIN_MS', () => {
  const ms = digits(rollPlan('1,234,567,890')).map((x) => x.ms);
  assert.ok(Math.max(...ms) <= ROLL_MS);
  assert.ok(Math.min(...ms) >= ROLL_MIN_MS);
  for (let i = 1; i < ms.length; i++) assert.ok(ms[i] >= ms[i - 1]);
});

test('a short total still rolls (never a flicker), and no digits = nothing to roll', () => {
  const p = digits(rollPlan('9', 200));
  assert.equal(p[0].ms, ROLL_MIN_MS);
  assert.equal(digits(rollPlan('LEVELS')).length, 0);
});
