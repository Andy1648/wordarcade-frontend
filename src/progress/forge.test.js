import test from 'node:test';
import assert from 'node:assert/strict';
import { forgeLevels, forgeBuys, nextForgeLetter, forgeMultForWord, forgeCost, forgeOne, forgeMany, forgeMigrateMomentum, FORGE_ORDER, FORGE_KEY } from './forge.js';
import { buyForge } from './shop.js';
import { getWins } from './wins.js';

function withStorage(seed, fn) {
  const m = new Map(Object.entries(seed));
  const prev = globalThis.localStorage;
  globalThis.localStorage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  try { return fn(m); } finally { globalThis.localStorage = prev; }
}

test('forge order: the first 26 buys light the alphabet most-common-first, then level 2 begins', () => {
  withStorage({}, () => {
    for (let i = 0; i < 26; i++) assert.equal(forgeOne().letter, FORGE_ORDER[i]);
    assert.equal(Object.keys(forgeLevels()).length, 26);
    assert.deepEqual(forgeOne(), { letter: 'e', level: 2 });
    assert.equal(forgeBuys(), 27);
  });
});

test('a word pays +5% per forged level of EVERY letter it contains (longer words forge more)', () => {
  const lv = { e: 2, t: 1, s: 1 };
  assert.equal(forgeMultForWord('tease', lv), 1 + 0.05 * (1 + 2 + 0 + 1 + 2));
  assert.equal(forgeMultForWord('', lv), 1);
  assert.ok(forgeMultForWord('settees', lv) > forgeMultForWord('tees', lv));
});

test('NO CAP: price grows linearly in words, finite at 10,000 buys', () => {
  const a = forgeCost(0, { keyTier: 0, rebirthCount: 0 });
  const b = forgeCost(40, { keyTier: 0, rebirthCount: 0 });
  const z = forgeCost(10000, { keyTier: 0, rebirthCount: 0 });
  assert.equal(b, 2 * a);
  assert.ok(Number.isFinite(z) && z > b);
  withStorage({}, () => {
    forgeMany(5000);
    assert.equal(forgeBuys(), 5000);
    assert.ok(nextForgeLetter());
  });
});

test('buyForge charges the price and forges the next letter', () => {
  withStorage({ 'taw.wins': '100000' }, () => {
    const cost = forgeCost(0);
    const r = buyForge();
    assert.equal(r.ok, true);
    assert.equal(r.letter, 'e');
    assert.equal(getWins(), 100000 - cost);
  });
  withStorage({ 'taw.wins': '0' }, () => assert.equal(buyForge().ok, false));
});

test('MOMENTUM migrates one buy → one forge, once, and the old key is gone', () => {
  withStorage({ 'taw.momentum': '30' }, (m) => {
    assert.equal(forgeMigrateMomentum(), 30);
    assert.equal(forgeBuys(), 30);
    assert.equal(m.has('taw.momentum'), false);
    assert.equal(forgeMigrateMomentum(), 0, 'idempotent');
    assert.equal(forgeBuys(), 30);
    assert.ok(JSON.parse(m.get(FORGE_KEY)).e === 2); // 30 buys: all 26 at lv1, then e,t,a,o at lv2
  });
});
