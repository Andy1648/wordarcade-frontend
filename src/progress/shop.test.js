// node --test — the shop: buying (deducts wins only, adds to owned), the guards (already
// owned, unaffordable), and equipping (instant, per-type slot). IDs are stable save keys.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buy, equip, isOwned, getOwned, getEquipped } from './shop.js';

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
