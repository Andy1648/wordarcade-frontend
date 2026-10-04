import { test } from 'node:test';
import assert from 'node:assert/strict';
import { milestoneSize, milestoneCrossed, MILESTONE_FX, MILESTONE_MAX_HOLD_MS } from './menuTier.js';

test('milestoneSize: only LV 10 / 25 / 50 and every 100', () => {
  assert.equal(milestoneSize(10), 'S');
  assert.equal(milestoneSize(25), 'M');
  assert.equal(milestoneSize(50), 'L');
  assert.equal(milestoneSize(100), 'XL');
  assert.equal(milestoneSize(200), 'XL');
  assert.equal(milestoneSize(1000), 'XL');
  for (const lv of [1, 2, 9, 11, 24, 37, 49, 75, 99, 101, 150, 250, 350, 0, -100, NaN, undefined, null]) {
    assert.equal(milestoneSize(lv), null, `LV ${lv}`);
  }
});

test('milestone sizes escalate and stay inside the spec numbers', () => {
  const order = ['S', 'M', 'L', 'XL'].map((s) => MILESTONE_FX[s]);
  for (let i = 1; i < order.length; i += 1) {
    assert.ok(order[i].peak > order[i - 1].peak);
    assert.ok(order[i].holdMs > order[i - 1].holdMs);
    assert.ok(order[i].shards > order[i - 1].shards);
    assert.ok(order[i].semis > order[i - 1].semis);
  }
  assert.equal(MILESTONE_MAX_HOLD_MS, MILESTONE_FX.XL.holdMs);
  assert.ok(1500 + MILESTONE_MAX_HOLD_MS < 2200, 'longest card stays under RANKUP_MS');
});

test('milestoneCrossed: biggest milestone in (from, to]', () => {
  assert.equal(milestoneCrossed(9, 10), 'S');
  assert.equal(milestoneCrossed(10, 11), null);
  assert.equal(milestoneCrossed(36, 37), null);
  assert.equal(milestoneCrossed(48, 51), 'L');
  assert.equal(milestoneCrossed(8, 30), 'M');
  assert.equal(milestoneCrossed(99, 100), 'XL');
  assert.equal(milestoneCrossed(100, 150), null);
  assert.equal(milestoneCrossed(149, 150), null);
  assert.equal(milestoneCrossed(199, 200), 'XL');
  assert.equal(milestoneCrossed(1, 500), 'XL');
  assert.equal(milestoneCrossed(5, 4), null);
  assert.equal(milestoneCrossed(10, 10), null);
});
