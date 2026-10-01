import { test } from 'node:test';
import assert from 'node:assert/strict';
import { levelTier, menuTier, tierFx, nextTierLevel, MAX_TIER, TIER_NAMES, TIER_COLORS, LEVEL_TIER_STARTS } from './menuTier.js';

test('level tier climbs at the documented starts', () => {
  assert.equal(levelTier(1), 0);
  assert.equal(levelTier(9), 0);
  assert.equal(levelTier(10), 1);
  assert.equal(levelTier(150), 5);
  assert.equal(levelTier(10000), 6);
  assert.equal(levelTier(undefined), 0);
});

test('a rebirth never makes the menu poorer: each rebirth is worth a tier', () => {
  assert.equal(menuTier(1, 1), 1);
  assert.equal(menuTier(1, 3), 3);
  assert.equal(menuTier(150, 3), MAX_TIER);
  assert.ok(menuTier(1, 1) >= menuTier(1, 0));
});

test('L150 is visibly richer than L1 in every motion knob', () => {
  const lo = tierFx(menuTier(1, 0));
  const hi = tierFx(menuTier(150, 0));
  assert.ok(hi.popMs > lo.popMs);
  assert.ok(hi.popRise > lo.popRise);
  assert.ok(hi.shards > lo.shards);
  assert.ok(hi.levelUpShards > lo.levelUpShards);
  assert.ok(tierFx(MAX_TIER).popMs <= 1300, 'pops stay snappy enough to not pile up forever');
});

test('every tier has a name and a colour; next-tier level is monotonic', () => {
  for (let t = 0; t <= MAX_TIER; t += 1) {
    assert.ok(TIER_NAMES[t]);
    assert.ok(TIER_NAMES[t].length <= 6, 'the tier-up headline must fit a 320px menu (as "LEVEL 9" does)');
    assert.ok(TIER_COLORS[t] && TIER_COLORS[t].fill && TIER_COLORS[t].line);
  }
  assert.equal(nextTierLevel(1, 0), LEVEL_TIER_STARTS[1]);
  assert.equal(nextTierLevel(150, 2), null);
});
