// stock.test.js — the SHOP's STOCK (season 2, P3): 6 gem-priced items, ×N LEFT per 5-minute window, SOLD OUT, the
// timed effects (+25% XP, ×2 LUCK), ×10 OVERDRIVE (a boost), +5 MIN EVERY BOOST, and the visual-only
// FREE EPIC+ ROLL. The flag is set before any import (node --test runs each file in its own process).
import test from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
  key: (i) => [...mem.keys()][i] ?? null,
  get length() { return mem.size; },
};
globalThis.location = { search: '?season2=1' };
await import('./install.js');
const ST = await import('./stock.js');
const U = await import('./unlocks.js');
const G = await import('../gemsCore.js');
const X = await import('../xp.js');
const BO = await import('../boost.js');

const T0 = 1_000 * ST.RESTOCK_MS + 37_000; // 37 s into a window
const setGems = (n) => G.saveGemState({ ...G.loadGemState(), bal: n });

test('the boost keys match boost.js / hooks.js', () => {
  assert.equal(ST.BOOST1_KEY, BO.BOOST_KEY);
  assert.equal(ST.BOOST2_KEY, 'taw.s2.boost2');
});

test('the stock: five items (no gem scaling) at the odd gem prices, rarity bands, counts; a 5:00 restock window', () => {
  mem.clear();
  assert.deepEqual(ST.STOCK.map((i) => i.price), [45, 120, 225, 150, 495]);
  assert.deepEqual(ST.STOCK.map((i) => i.rarity), ['common', 'rare', 'epic', 'rare', 'legendary']);
  assert.deepEqual(ST.stockLeft(T0), { xp25: 5, luck2: 3, overdrive: 2, extend: 2, epicroll: 1 });
  assert.equal(ST.restockIn(T0), 300 - 37);
  assert.equal(ST.restockIn(T0 + 262_500), 1);
});

test('a buy costs GEMS, takes one unit, and SELLS OUT; the next window restocks', () => {
  mem.clear();
  setGems(1000);
  let r = ST.buyStock('overdrive', T0);
  assert.equal(r.ok, true);
  assert.equal(r.gems, 775);
  assert.equal(G.getGems(), 775);
  assert.equal(r.left.overdrive, 1);
  assert.equal(BO.codeBoostMult(T0 + 1000), 10, '×10 OVERDRIVE is a ×10 boost');
  assert.ok(BO.boostRemaining(T0) <= 5 * 60000 && BO.boostRemaining(T0) > 4 * 60000);
  r = ST.buyStock('overdrive', T0 + 1000);
  assert.equal(r.ok, true);
  r = ST.buyStock('overdrive', T0 + 2000);
  assert.deepEqual([r.ok, r.reason], [false, 'sold_out']);
  assert.equal(G.getGems(), 550, 'a sold-out try charges nothing');
  assert.equal(ST.stockLeft(T0 + ST.RESTOCK_MS).overdrive, 2, 'restocked in the next window');
});

test('short on gems → refused with the gap; nothing charged, nothing taken', () => {
  mem.clear();
  setGems(100);
  const r = ST.buyStock('luck2', T0);
  assert.deepEqual([r.ok, r.reason, r.short], [false, 'gems', 20]);
  assert.equal(G.getGems(), 100);
  assert.equal(ST.stockLeft(T0).luck2, 3);
});

test('timed effects: +25% XP on XP / LETTER, ×2 LUCK — for their minutes only; NOTHING scales gems', () => {
  mem.clear();
  setGems(1000);
  const base = X.levelXpPerLetter(0, 0);
  const luck0 = U.unlockLuckMult();
  assert.equal(ST.buyStock('xp25', T0).ok, true);
  assert.equal(ST.buyStock('luck2', T0).ok, true);
  const now = T0 + 1000;
  assert.equal(ST.stockXpMult(now), 1.25);
  assert.equal(ST.stockLuckMult(now), 2);
  assert.equal(ST.stockXpMult(T0 + 10 * 60000 + 1), 1, 'the XP one ends after 10 min');
  assert.equal(ST.stockLuckMult(T0 + 15 * 60000 - 1), 2, 'LUCK runs 15 min');
  // wired into the live v3 rules (wall clock: these run "now", so re-buy against Date.now())
  mem.clear();
  setGems(1000);
  ST.buyStock('xp25');
  ST.buyStock('luck2');
  assert.ok(Math.abs(X.levelXpPerLetter(0, 0) - base * 1.25) < 1e-9, 'XP / LETTER × 1.25');
  assert.equal(U.unlockLuckMult(), luck0 * 2, 'roll luck × 2');
  // gems are NEVER scaled (Andy oct6): the drop chance stays exactly 1 in 15 — a draw of 0.1 (> 1/15) never drops
  let draws = [0.1, 0.5];
  assert.equal(G.rollGemDrop(() => draws.shift()), 0);
  assert.equal(ST.STOCK.some((i) => i.fx === 'gems'), false, 'no STOCK item touches gems');
});

test('+5 MIN EVERY BOOST: needs a running timer; extends every one', () => {
  mem.clear();
  setGems(1000);
  let r = ST.buyStock('extend', T0);
  assert.deepEqual([r.ok, r.reason], [false, 'nothing']);
  assert.equal(G.getGems(), 1000);
  ST.buyStock('overdrive', T0);
  ST.buyStock('xp25', T0);
  const b0 = BO.boostRemaining(T0);
  const x0 = ST.stockFxLeft('xp', T0);
  r = ST.buyStock('extend', T0);
  assert.equal(r.ok, true);
  assert.equal(BO.boostRemaining(T0) - b0, ST.EXTEND_MS);
  assert.equal(ST.stockFxLeft('xp', T0) - x0, ST.EXTEND_MS);
});

test('FREE EPIC+ ROLL is visual-only for now: never sold, never charged', () => {
  mem.clear();
  setGems(1000);
  const r = ST.buyStock('epicroll', T0);
  assert.deepEqual([r.ok, r.reason], [false, 'soon']);
  assert.equal(G.getGems(), 1000);
});
