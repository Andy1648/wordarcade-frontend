// markRollShop.test.js — paying for a MARK ROLL: the free starter, the 60-word price charged through the one
// wins channel, a short balance refused, and the equip decision (any higher MAIN) applied only when the reveal lands.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buyMarkRoll, nextRollCost, applyRollEquip } from './markRollShop.js';
import { ROLL_STATE_KEY, rollPriceNow, loadRollState, refWordWins } from './markRolls.js';
import { perWordRateNow } from './wins.js';
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

test('nothing worn → the first mark is AUTO, but nothing is equipped until the reveal lands', () => {
  withStorage({ 'taw.wins': '0' }, (m) => {
    const r = buyMarkRoll({ level: 1, rng: at(0) });
    assert.equal(r.decision, 'auto');
    assert.equal(r.fromMain, 1);
    assert.ok(Math.abs(r.toMain - 1.1) < 1e-9, 'a COMMON MAIN is ×1.1');
    assert.equal(m.get(MARKS_EQUIPPED_KEY), undefined, 'the tap writes no MAIN (no spoiler)');
    assert.equal(applyRollEquip(r), r.markId, 'the landing equips it');
    assert.equal(m.get(MARKS_EQUIPPED_KEY), r.markId);
  });
});

test('the landing re-checks: a MAIN the player equipped meanwhile is never replaced by a lower one', () => {
  withStorage({ 'taw.wins': '0', [ROLL_STATE_KEY]: JSON.stringify({ v: 1, starter: false, marks: { 'mk-kraken': { n: 1 } } }) }, (m) => {
    const r = buyMarkRoll({ level: 1, rng: at(0) }); // a common
    m.set(MARKS_EQUIPPED_KEY, 'mk-kraken'); // a MYTHIC ×10 worn before the reveal lands
    assert.equal(applyRollEquip(r), null);
    assert.equal(m.get(MARKS_EQUIPPED_KEY), 'mk-kraken');
  });
});

test('the price is 60 words at the live per-word rate (perWordRateNow), timed boosts excluded', () => {
  withStorage({}, () => {
    const rate = refWordWins();
    assert.ok(rate > 0);
    assert.ok(Math.abs(rate - perWordRateNow({ mode: 'wordBomb' }).rate) < 1e-9, 'no BOOST running → the live rate');
    assert.equal(rollPriceNow(1), Math.round(60 * rate));
  });
});

test('DOUBLE ROLLS (SINGULARITY owned): one price, two results; the rarer is shown', () => {
  const st = { v: 1, starter: true, marks: { 'mk-singularity': { n: 1 } } };
  withStorage({ 'taw.wins': '1000000000', [ROLL_STATE_KEY]: JSON.stringify(st) }, (m) => {
    const price = rollPriceNow(1);
    const r = buyMarkRoll({ level: 1, rng: at(0) });
    assert.equal(r.extra.length, 1, 'a second result rides along');
    assert.equal(JSON.parse(m.get(ROLL_STATE_KEY)).rolls, 2, 'both rolls are saved');
    assert.equal(r.spent, price, 'one price');
  });
  withStorage({ 'taw.wins': '1000000000', [ROLL_STATE_KEY]: JSON.stringify({ v: 1, starter: true, marks: {} }) }, () => {
    const r = buyMarkRoll({ level: 1, rng: at(0) });
    assert.equal(r.extra.length, 0, 'no perk → one result');
  });
});
