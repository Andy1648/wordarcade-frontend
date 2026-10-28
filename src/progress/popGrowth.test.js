import { test } from 'node:test';
import assert from 'node:assert/strict';
import { careerLevel, popGrowth, GROWTH_MAX, GROWTH_MAX_NARROW, GROWTH_CAP_CAREER } from './popGrowth.js';

const gate = (r) => 25 * (r + 1); // the live table: R1 at LV25, R2 at LV50 …
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≉ ${b}`);

test('career level is the level with no rebirths', () => {
  assert.equal(careerLevel(1, 0, gate), 1);
  assert.equal(careerLevel(37, 0, gate), 37);
});

test('career level banks every past rebirth gate, so a rebirth never moves it back', () => {
  assert.equal(careerLevel(25, 0, gate), 25);
  assert.equal(careerLevel(1, 1, gate), 26); // just rebirthed: one more than the LV25 it left
  assert.equal(careerLevel(1, 3, gate), 1 + 25 + 50 + 75);
});

test('career level survives junk input', () => {
  assert.equal(careerLevel(NaN, -2, gate), 1);
  assert.equal(careerLevel(5, 2, () => NaN), 5);
});

test('pop growth starts at x1 and grows monotonically with career level', () => {
  assert.equal(popGrowth(1).scale, 1);
  let prev = 0;
  for (const c of [1, 2, 5, 10, 25, 50, 100, 300, 1000, 3000]) {
    const s = popGrowth(c).scale;
    assert.ok(s > prev, `career ${c}: ${s} > ${prev}`);
    prev = s;
  }
});

test('pop growth is capped — no runaway past the cap', () => {
  close(popGrowth(GROWTH_CAP_CAREER).scale, 1 + GROWTH_MAX);
  close(popGrowth(1e9).scale, 1 + GROWTH_MAX);
  close(popGrowth(1e9, true).scale, 1 + GROWTH_MAX_NARROW);
});

test('a rebirth never shrinks the pop', () => {
  assert.ok(popGrowth(careerLevel(1, 1, gate)).scale > popGrowth(careerLevel(25, 0, gate)).scale);
});

test('the early levels are felt (L10 is already ~+20%)', () => {
  assert.ok(popGrowth(10).scale > 1.18);
});

test('pop dressing comes in stages', () => {
  assert.equal(popGrowth(9).stage, 0);
  assert.equal(popGrowth(10).stage, 1);
  assert.equal(popGrowth(100).stage, 2);
  assert.equal(popGrowth(1000).stage, 3);
  assert.equal(popGrowth(1e6).stage, 3);
});
