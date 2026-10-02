// node --test — the shop: buying (deducts wins only, adds to owned), the guards (already
// owned, unaffordable), and equipping (instant, per-type slot). IDs are stable save keys.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buy, equip, isOwned, getOwned, getEquipped, buyKeyPower, canAffordAny, POP_STYLES, SOUND_PACKS, COSMETIC_PRICE_STEP } from './shop.js';
import { getKeyTier, keyTierCostAt } from './xp.js';

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

// ECONOMY v8 cut every price by ten with the currency; v9 (STEP 19) steepened the ladder to ×6 a rung
// and lengthened both lists. These tests are priced off the CATALOG rather than off a literal, so the
// ladder can be retuned without editing them again — the ladder itself is pinned once, below.
const priceOf = (id) => [...POP_STYLES, ...SOUND_PACKS].find((i) => i.id === id).price;

test('cosmetic ladders: each paid rung costs ×COSMETIC_PRICE_STEP the last, and pays a bigger XP mult', () => {
  assert.equal(COSMETIC_PRICE_STEP, 5); // oct2: ×5 a rung from a ×100 base (Andy: cosmetics cost MORE)
  assert.equal(priceOf('chrome'), 6000);
  assert.equal(priceOf('inferno'), 30000);
  assert.equal(priceOf('marble'), 10000);
  for (const list of [POP_STYLES, SOUND_PACKS]) {
    const paid = list.filter((i) => i.price > 0);
    assert.ok(paid.length >= 6, 'the v9 ladders run long enough to stay a goal');
    for (let i = 1; i < paid.length; i++) {
      assert.equal(paid[i].price, paid[i - 1].price * COSMETIC_PRICE_STEP, `${paid[i].id} is one rung above ${paid[i - 1].id}`);
      assert.ok(paid[i].xpMult > paid[i - 1].xpMult, `${paid[i].id} must out-perform ${paid[i - 1].id}`);
      assert.ok(Number.isSafeInteger(paid[i].price), `${paid[i].id} price is an exact integer`);
    }
  }
  // Stable, unique save keys.
  assert.equal(new Set(ALL_COSMETICS).size, ALL_COSMETICS.length);
});

test('buying deducts wins, adds to owned, and leaves winsLifetime untouched', () => {
  const cost = priceOf('chrome');
  withStorage({ 'taw.wins': String(cost + 350), 'taw.winsLifetime': '900' }, (map) => {
    const r = buy('chrome');
    assert.equal(r.ok, true);
    assert.equal(r.wins, 350);
    assert.equal(map.get('taw.wins'), '350');
    assert.equal(map.get('taw.winsLifetime'), '900'); // never touched by a purchase
    assert.ok(getOwned().includes('chrome'));
  });
});

test('cannot buy the same item twice; a second attempt does not re-charge', () => {
  const cost = priceOf('chrome');
  withStorage({ 'taw.wins': String(cost + 350) }, (map) => {
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
    const r = buy('prism'); // far above 100 at any ladder step
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'unaffordable');
    assert.equal(map.get('taw.wins'), '100');
    assert.equal(isOwned('prism'), false);
  });
});

test('buyKeyPower: one tier deducts the next tier cost and bumps taw.keytier', () => {
  // v9: KEY POWER is priced in WORDS (keyTierCostAt) — T1 200, T2 510, T3 830 at R0.
  const t1 = keyTierCostAt(1, 0);
  const t2 = keyTierCostAt(2, 0);
  const t3 = keyTierCostAt(3, 0);
  assert.deepEqual([t1, t2, t3], [200, 510, 830]);
  withStorage({ 'taw.wins': String(t1 + t2 + 100), 'taw.keytier': '0' }, (map) => {
    const r = buyKeyPower();
    assert.equal(r.ok, true);
    assert.equal(r.tier, 1);
    assert.equal(r.spent, t1);
    assert.equal(r.wins, t2 + 100);
    assert.equal(map.get('taw.keytier'), '1');
    assert.equal(map.get('taw.wins'), String(t2 + 100));
    // T2 is covered exactly by what is left (+100).
    const second = buyKeyPower();
    assert.equal(second.ok, true);
    assert.equal(second.spent, t2);
    assert.equal(map.get('taw.wins'), '100');
    // T3 — 100 left is not enough, and a refused buy spends nothing.
    const again = buyKeyPower();
    assert.equal(again.ok, false);
    assert.equal(again.spent, 0);
    assert.equal(map.get('taw.wins'), '100');
    assert.equal(map.get('taw.keytier'), '2'); // unchanged by the refusal
    assert.equal(getKeyTier(), 2);
  });
});

test('buyKeyPower charges the REBIRTH-scaled price (rebirth never makes KEY POWER cheaper)', () => {
  const r1Price = keyTierCostAt(1, 1); // ×2 at R1
  assert.equal(r1Price, 2 * keyTierCostAt(1, 0));
  withStorage({ 'taw.wins': String(r1Price - 10), 'taw.keytier': '0', 'taw.rebirths': '1' }, (map) => {
    assert.equal(buyKeyPower().ok, false, 'the R0 price is not enough at R1');
    assert.equal(map.get('taw.keytier'), '0');
  });
  withStorage({ 'taw.wins': String(r1Price), 'taw.keytier': '0', 'taw.rebirths': '1' }, (map) => {
    const r = buyKeyPower();
    assert.equal(r.ok, true);
    assert.equal(r.spent, r1Price);
    assert.equal(map.get('taw.wins'), '0');
  });
});

test('equip requires ownership and sets the right slot', () => {
  withStorage({ 'taw.wins': String(priceOf('chrome') + priceOf('marble')) }, () => {
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
// cosmetics (the bug: the dot went dark forever once all cosmetics were owned while Key
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

test('Andy oct2 A5: a fresh LV1 profile with 0 wins has no shop dot', () => {
  withStorage({}, () => {
    assert.equal(canAffordAny(0, getOwned()), false);
  });
});

test('Andy oct2 A5: retired themes never light the dot (60 wins used to show one for MIDNIGHT)', () => {
  withStorage({}, () => {
    // 150 wins: above MIDNIGHT's old 60-win theme price, below KEY POWER I (200) and every cosmetic.
    assert.equal(canAffordAny(150, getOwned()), false, 'nothing on the shelf is affordable → no dot');
  });
});

test('canAffordAny is true for a new player who can afford KEY POWER I', () => {
  withStorage({}, () => {
    assert.equal(canAffordAny(10 ** 6, getOwned()), true);
  });
});

test('Andy oct2: buying a cosmetic auto-equips it', () => {
  const m = new Map([['taw.wins', String(10 ** 9)]]);
  const prev = globalThis.localStorage;
  globalThis.localStorage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  try {
    assert.equal(buy('inferno').equipped, true);
    assert.equal(getEquipped().popStyle, 'inferno');
    buy('marble');
    assert.equal(getEquipped().soundPack, 'marble');
    assert.equal(getEquipped().popStyle, 'inferno', 'a sound pack never unequips the pop');
  } finally {
    globalThis.localStorage = prev;
  }
});
