// momentum.test.js — the MOMENTUM repeatable sink: rising cost, the stacking wins multiplier, the
// buy flow (deduct + cap), and that it folds into perWordWins as a global wins factor.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getMomentum,
  saveMomentum,
  momentumCost,
  momentumMult,
  momentumMaxed,
  MOMENTUM_BASE,
  MOMENTUM_MAX,
} from './momentum.js';
import { round10 } from './xp.js';
import { perWordWins } from './wins.js';
import { buyMomentum } from './shop.js';

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

test('momentumCost rises ×1.05 from 5000, round10; Infinity at the cap', () => {
  assert.equal(momentumCost(0), 5000); // the first buy
  assert.equal(momentumCost(1), round10(MOMENTUM_BASE * 1.05)); // 5250
  assert.equal(momentumCost(10), round10(MOMENTUM_BASE * Math.pow(1.05, 10)));
  assert.ok(momentumCost(199) > momentumCost(100)); // strictly rising
  assert.equal(momentumCost(MOMENTUM_MAX), Infinity); // nothing left to buy
  assert.equal(momentumCost(MOMENTUM_MAX + 5), Infinity);
  // Every finite cost ends in a zero (payout invariant).
  for (let c = 0; c < MOMENTUM_MAX; c += 7) assert.equal(momentumCost(c) % 10, 0, `cost(${c})`);
});

test('momentumMult stacks +1% per buy: ×1 at 0, ×1.01 at 1, ×2 at 100, ×3 at 200 (capped)', () => {
  assert.equal(momentumMult(0), 1);
  assert.equal(momentumMult(1), 1.01);
  assert.equal(momentumMult(100), 2);
  assert.equal(momentumMult(200), 3);
  assert.equal(momentumMult(9999), 3); // capped at MAX
  assert.equal(momentumMult(-5), 1); // garbage → 0
});

test('getMomentum/saveMomentum clamp to 0..MAX and survive garbage', () => {
  withStorage({}, () => {
    assert.equal(getMomentum(), 0);
    saveMomentum(50);
    assert.equal(getMomentum(), 50);
    saveMomentum(9999);
    assert.equal(getMomentum(), MOMENTUM_MAX); // clamped
    saveMomentum(-3);
    assert.equal(getMomentum(), 0);
  });
  withStorage({ 'taw.momentum': 'garbage' }, () => assert.equal(getMomentum(), 0));
  assert.equal(momentumMaxed(MOMENTUM_MAX), true);
  assert.equal(momentumMaxed(0), false);
});

test('buyMomentum deducts the rising cost, bumps the count; refuses when broke or maxed', () => {
  withStorage({ 'taw.wins': '4999', 'taw.momentum': '0' }, () => {
    assert.equal(buyMomentum().ok, false); // 4999 < 5000
    assert.equal(getMomentum(), 0);
  });
  withStorage({ 'taw.wins': '5000', 'taw.momentum': '0' }, (map) => {
    const r = buyMomentum();
    assert.equal(r.ok, true);
    assert.equal(r.count, 1);
    assert.equal(r.spent, 5000);
    assert.equal(r.wins, 0);
    assert.equal(map.get('taw.momentum'), '1');
  });
  withStorage({ 'taw.wins': '999999999', 'taw.momentum': String(MOMENTUM_MAX) }, () => {
    const r = buyMomentum();
    assert.equal(r.ok, false); // already maxed, even with wins to spare
    assert.equal(r.maxed, true);
    assert.equal(getMomentum(), MOMENTUM_MAX);
  });
});

test('momentum folds into perWordWins as a global wins factor (every mode scales)', () => {
  // Explicit momentumCount keeps this pure; 0 → unchanged, 100 → ×2, 200 → ×3.
  const base = perWordWins({ mode: 'wordBomb', rebirthCount: 0, momentumCount: 0 }); // 40
  assert.equal(base, 40);
  assert.equal(perWordWins({ mode: 'wordBomb', rebirthCount: 0, momentumCount: 100 }), round10(40 * 2)); // 80
  assert.equal(perWordWins({ mode: 'wordBomb', rebirthCount: 0, momentumCount: 200 }), round10(40 * 3)); // 120
  // Live-read path: seeding taw.momentum boosts the default (no momentumCount passed).
  withStorage({ 'taw.momentum': '100' }, () => {
    assert.equal(perWordWins({ mode: 'chain', rebirthCount: 0 }), round10(40 * 2)); // chain 40 × ×2 = 80
  });
});
