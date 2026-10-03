// markRollShop.test.js — paying for a MARK ROLL: the free starter, the 60-word price charged through the one
// wins channel, a short balance refused, and the ×1.5 auto-equip / EQUIP? split applied for real.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buyMarkRoll, nextRollCost } from './markRollShop.js';
import { ROLL_STATE_KEY, rollPriceNow, loadRollState } from './markRolls.js';
import { MARKS_EQUIPPED_KEY } from './marks.js';

function withStorage(seed, fn) {
  const map = new Map(Object.entries(seed || {}));
  const saved = globalThis.localStorage;
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
const at = (u) => () => u; // a fixed rng

test('the first roll is the FREE starter; the next costs 60 words at your rate', () => {
  withStorage({ 'taw.wins': '0' }, (m) => {
    assert.equal(nextRollCost(1, null).free, true);
    const r = buyMarkRoll({ level: 1, rng: at(0) });
    assert.ok(r, 'a free roll needs no balance');
    assert.equal(r.free, true);
    assert.equal(r.spent, 0);
    assert.equal(loadRollState().starter, true);
    const c = nextRollCost(1);
    assert.equal(c.free, false);
    assert.equal(c.words, 60);
    assert.equal(c.wins, rollPriceNow(1));
    assert.equal(buyMarkRoll({ level: 1, rng: at(0) }), null, 'a short balance is refused, nothing rolls');
    assert.equal(JSON.parse(m.get(ROLL_STATE_KEY)).rolls, 1);
  });
});

test('a paid roll charges exactly the price through the balance', () => {
  withStorage({ 'taw.wins': '1000000', [ROLL_STATE_KEY]: JSON.stringify({ v: 1, starter: true, marks: {} }) }, (m) => {
    const price = rollPriceNow(1);
    const r = buyMarkRoll({ level: 1, rng: at(0) });
    assert.equal(r.free, false);
    assert.equal(r.spent, price);
    assert.equal(Number(m.get('taw.wins')), 1000000 - price + (r.lump || 0));
  });
});

test('nothing worn → the first mark ASKS (×1 → ×2 is over ×1.5) and is not equipped by itself', () => {
  withStorage({ 'taw.wins': '0' }, (m) => {
    const r = buyMarkRoll({ level: 1, rng: at(0) });
    assert.equal(r.decision, 'ask');
    assert.equal(r.fromMain, 1);
    assert.equal(r.toMain, 2);
    assert.equal(m.get(MARKS_EQUIPPED_KEY), undefined);
  });
});
