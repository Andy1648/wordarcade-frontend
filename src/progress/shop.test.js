// node --test — the shop: buying (deducts wins only, adds to owned), the guards (already
// owned, unaffordable), and equipping (instant, per-type slot). IDs are stable save keys.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buy, equip, isOwned, getOwned, getEquipped, buyKeyPower, canAffordAny, POP_STYLES, SOUND_PACKS } from './shop.js';
import { getKeyTier } from './xp.js';

const ALL_COSMETICS = [...POP_STYLES, ...SOUND_PACKS].map((i) => i.id);

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

test('the four defaults are owned from the start', () => {
  withStorage({}, () => {
    for (const id of ['classic', 'thock', 'clack', 'cream']) assert.ok(isOwned(id));
    assert.equal(isOwned('prism'), false);
  });
});

test('buying deducts wins, adds to owned, and leaves winsLifetime untouched', () => {
  withStorage({ 'taw.wins': '500', 'taw.winsLifetime': '900' }, (map) => {
    const r = buy('chrome'); // 150
    assert.equal(r.ok, true);
    assert.equal(r.wins, 350);
    assert.equal(map.get('taw.wins'), '350');
    assert.equal(map.get('taw.winsLifetime'), '900'); // never touched by a purchase
    assert.ok(getOwned().includes('chrome'));
  });
});

test('cannot buy the same item twice; a second attempt does not re-charge', () => {
  withStorage({ 'taw.wins': '500' }, (map) => {
    assert.equal(buy('chrome').ok, true);
    assert.equal(map.get('taw.wins'), '350');
    const again = buy('chrome');
    assert.equal(again.ok, false);
    assert.equal(again.reason, 'owned');
    assert.equal(map.get('taw.wins'), '350'); // unchanged
  });
});

test('cannot buy an unaffordable item; wins unchanged', () => {
  withStorage({ 'taw.wins': '100' }, (map) => {
    const r = buy('prism'); // 2000
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'unaffordable');
    assert.equal(map.get('taw.wins'), '100');
    assert.equal(isOwned('prism'), false);
  });
});

test('buyKeyPower: one tier deducts the next tier cost and bumps taw.keytier', () => {
  withStorage({ 'taw.wins': '100', 'taw.keytier': '0' }, (map) => {
    const r = buyKeyPower(); // T0→T1 costs 90 (post-rebalance)
    assert.equal(r.ok, true);
    assert.equal(r.tier, 1);
    assert.equal(r.spent, 90);
    assert.equal(r.wins, 10);
    assert.equal(map.get('taw.keytier'), '1');
    assert.equal(map.get('taw.wins'), '10');
    // Can't afford T2 (costs 540) with 10 left.
    const again = buyKeyPower();
    assert.equal(again.ok, false);
    assert.equal(again.spent, 0);
    assert.equal(map.get('taw.keytier'), '1'); // unchanged
    assert.equal(getKeyTier(), 1);
  });
});

test('equip requires ownership and sets the right slot', () => {
  withStorage({ 'taw.wins': '500' }, () => {
    assert.equal(equip('prism'), false); // not owned yet
    buy('chrome');
    assert.equal(equip('chrome'), true);
    assert.equal(getEquipped().popStyle, 'chrome');
    assert.equal(getEquipped().soundPack, 'thock'); // untouched
    // a sound pack equips into the sound slot, not the pop slot
    buy('marble');
    assert.equal(equip('marble'), true);
    assert.equal(getEquipped().soundPack, 'marble');
    assert.equal(getEquipped().popStyle, 'chrome'); // still chrome
  });
});

// canAffordAny — the "something to buy" dot. It must count EVERYTHING purchasable, not only
// cosmetics (the bug: the dot went dark forever once all 11 cosmetics were owned while Key
// Power / Word Sense / Momentum / themes were still affordable).
test('canAffordAny stays true when all cosmetics are owned but non-cosmetic sinks are affordable', () => {
  withStorage({ 'taw.owned': JSON.stringify(ALL_COSMETICS) }, () => {
    // Fresh stores → Key Power / Word Sense at tier 0, Momentum at 0, no themes owned.
    assert.equal(canAffordAny(1e12, ALL_COSMETICS), true, 'huge balance, all cosmetics owned → still something to buy');
  });
});

test('canAffordAny is false only when literally nothing is affordable', () => {
  withStorage({ 'taw.owned': JSON.stringify(ALL_COSMETICS) }, () => {
    assert.equal(canAffordAny(0, ALL_COSMETICS), false, 'zero balance → nothing to buy');
  });
});

test('canAffordAny is true for a new player who can afford a cheap cosmetic', () => {
  withStorage({}, () => {
    assert.equal(canAffordAny(150, getOwned()), true, '150 wins affords CHROME');
  });
});
