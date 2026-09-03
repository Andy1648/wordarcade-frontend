// wordSense.test.js (Job 4 · fix/wordsense-cap) — the WORD SENSE tier factor is now a BOUNDED,
// gentle ladder (+0.1/tier, 1.0 → 1.5 ceiling at MAX_TIER, then MAXED) instead of the old uncapped
// ×2.5/tier runaway. Covers the factor curve + ceiling, the wins-per-rarity multiplier (COMMON never
// boosted), the clamp on a stale over-invested tier, the cost ladder + MAXED sentinel, and the buy flow.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  wordSenseFactor,
  wordSenseWinsFactor,
  wordSenseCost,
  getWordSenseTier,
  saveWordSenseTier,
  WORDSENSE_EFFECT_STEP,
  WORDSENSE_MAX_TIER,
  WORDSENSE_MAX_FACTOR,
} from './wordSense.js';
import { keyTierCostAt } from './xp.js';
import { buyWordSense } from './shop.js';

function withStorage(seed, fn) {
  const saved = globalThis.localStorage;
  const map = new Map(Object.entries(seed || {}));
  globalThis.localStorage = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
  try {
    return fn(map);
  } finally {
    if (saved === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = saved;
  }
}

test('wordSenseFactor climbs +STEP per tier from 1 at T0 and CEILS at MAX_FACTOR', () => {
  assert.equal(wordSenseFactor(0), 1);
  assert.equal(wordSenseFactor(1), 1 + WORDSENSE_EFFECT_STEP);
  assert.equal(wordSenseFactor(2), 1 + 2 * WORDSENSE_EFFECT_STEP);
  assert.equal(wordSenseFactor(WORDSENSE_MAX_TIER), WORDSENSE_MAX_FACTOR); // reaches the ceiling
  assert.equal(wordSenseFactor(WORDSENSE_MAX_TIER + 3), WORDSENSE_MAX_FACTOR); // clamped, never exceeds
});

test('wordSenseWinsFactor boosts rarity EXCESS; COMMON is never boosted; bounded at the ceiling', () => {
  assert.equal(wordSenseWinsFactor(4, 0), 1); // T0 → no boost anywhere
  assert.equal(wordSenseWinsFactor(1, WORDSENSE_MAX_TIER), 1); // COMMON (mult 1) → excess 0 → ×1
  // At T5 (factor 1.5): OBSCURE(4) → 1 + 3×0.5 = 2.5; RARE(2.5) → 1 + 1.5×0.5 = 1.75.
  assert.equal(wordSenseWinsFactor(4, WORDSENSE_MAX_TIER), 2.5);
  assert.equal(wordSenseWinsFactor(2.5, WORDSENSE_MAX_TIER), 1.75);
  // Monotonic in tier for a rare word, and never runs away past the ceiling.
  assert.ok(wordSenseWinsFactor(4, 2) > wordSenseWinsFactor(4, 1));
  assert.ok(wordSenseWinsFactor(4, 99) <= wordSenseWinsFactor(4, WORDSENSE_MAX_TIER));
});

test('a stale over-invested tier (old uncapped save) clamps to MAX_TIER', () => {
  withStorage({ 'taw.wordsense': '18' }, () => {
    assert.equal(getWordSenseTier(), WORDSENSE_MAX_TIER);
  });
  withStorage({}, () => {
    saveWordSenseTier(99);
    assert.equal(getWordSenseTier(), WORDSENSE_MAX_TIER);
  });
});

test('cost ladder matches KEY POWER (×6) then returns Infinity at MAXED', () => {
  assert.equal(wordSenseCost(0), keyTierCostAt(1)); // 90 (post-rebalance)
  assert.equal(wordSenseCost(1), keyTierCostAt(2)); // 540
  assert.equal(wordSenseCost(WORDSENSE_MAX_TIER - 1), keyTierCostAt(WORDSENSE_MAX_TIER)); // last real buy
  assert.equal(wordSenseCost(WORDSENSE_MAX_TIER), Infinity); // nothing left to buy
});

test('buyWordSense deducts wins and bumps the tier; refuses when unaffordable', () => {
  withStorage({ 'taw.wins': '50' }, () => {
    // 50 < 90 (T1 cost, post-rebalance) → refused.
    const r = buyWordSense();
    assert.equal(r.ok, false);
    assert.equal(getWordSenseTier(), 0);
  });
  withStorage({ 'taw.wins': '100' }, () => {
    const r = buyWordSense();
    assert.equal(r.ok, true);
    assert.equal(r.tier, 1);
    assert.equal(r.spent, 90);
    assert.equal(r.wins, 10); // 100 - 90
    assert.equal(getWordSenseTier(), 1);
  });
});

test('buyWordSense refuses at MAX_TIER (Infinity cost)', () => {
  withStorage({ 'taw.wins': '999999999', 'taw.wordsense': String(WORDSENSE_MAX_TIER) }, () => {
    const r = buyWordSense();
    assert.equal(r.ok, false);
    assert.equal(getWordSenseTier(), WORDSENSE_MAX_TIER);
  });
});

test('storage failure → T0 everywhere, never throws', () => {
  const saved = globalThis.localStorage;
  globalThis.localStorage = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); }, removeItem: () => {} };
  try {
    assert.equal(getWordSenseTier(), 0);
    assert.equal(wordSenseWinsFactor(4), 1);
    assert.doesNotThrow(() => buyWordSense());
  } finally {
    globalThis.localStorage = saved;
  }
});
