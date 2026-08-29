// wordSense.test.js (Job 4) — the WORD SENSE tier factor, the wins-per-rarity multiplier (COMMON
// never boosted), the cost ladder, and the buy flow deducting wins.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  wordSenseFactor,
  wordSenseWinsFactor,
  wordSenseCost,
  getWordSenseTier,
  WORDSENSE_EFFECT_STEP,
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

test('wordSenseFactor grows ×2.5 per tier from 1 at T0', () => {
  assert.equal(wordSenseFactor(0), 1);
  assert.equal(wordSenseFactor(1), WORDSENSE_EFFECT_STEP);
  assert.equal(wordSenseFactor(2), WORDSENSE_EFFECT_STEP ** 2);
});

test('wordSenseWinsFactor boosts rarity EXCESS; COMMON is never boosted', () => {
  // T0 → no boost anywhere.
  assert.equal(wordSenseWinsFactor(4, 0), 1);
  assert.equal(wordSenseWinsFactor(1, 3), 1); // COMMON (mult 1) → excess 0 → always ×1
  // T1 (factor 2.5): OBSCURE(4) → 1 + 3×1.5 = 5.5; RARE(2.5) → 1 + 1.5×1.5 = 3.25.
  assert.equal(wordSenseWinsFactor(4, 1), 5.5);
  assert.equal(wordSenseWinsFactor(2.5, 1), 3.25);
  // Monotonic in tier for a rare word.
  assert.ok(wordSenseWinsFactor(4, 2) > wordSenseWinsFactor(4, 1));
});

test('cost ladder matches KEY POWER (×6, same shape)', () => {
  assert.equal(wordSenseCost(0), keyTierCostAt(1)); // 500
  assert.equal(wordSenseCost(1), keyTierCostAt(2)); // 3000
  assert.equal(wordSenseCost(5), keyTierCostAt(6));
});

test('buyWordSense deducts wins and bumps the tier; refuses when unaffordable', () => {
  withStorage({ 'taw.wins': '50' }, () => {
    // 50 < 80 (T1 cost, post-rebalance) → refused.
    let r = buyWordSense();
    assert.equal(r.ok, false);
    assert.equal(getWordSenseTier(), 0);
  });
  withStorage({ 'taw.wins': '100' }, () => {
    const r = buyWordSense();
    assert.equal(r.ok, true);
    assert.equal(r.tier, 1);
    assert.equal(r.spent, 80);
    assert.equal(r.wins, 20); // 100 - 80
    assert.equal(getWordSenseTier(), 1);
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
