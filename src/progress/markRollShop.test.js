// markRollShop.test.js — paying for a MARK ROLL: the free starter, the 72-word price charged through the one
// wins channel, a short balance refused, and the equip decision (any higher MAIN) applied only when the reveal lands.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buyMarkRoll, autoRoll, AUTO_ROLL_TIERS, nextRollCost, applyRollEquip } from './markRollShop.js';
import * as SHOP from './markRollShop.js';
import { ROLL_STATE_KEY, rollPriceNow, loadRollState, refWordWins, INDEX_NEW_WORDS, INDEX_COMPLETE_WORDS, ROLL_MARKS } from './markRolls.js';
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
const at = (u) => { let i = 0; return () => (i++ % 2 ? 0.5 : u); }; // a fixed pick draw; every 2nd draw (the SHINY draw) is never shiny

test('the first roll is the FREE starter; the next costs 72 words at your rate', () => {
  withStorage({ 'taw.wins': '0' }, (m) => {
    assert.equal(nextRollCost(1, null).free, true);
    const r = buyMarkRoll({ level: 1, rng: at(0) });
    assert.ok(r, 'a free roll needs no balance');
    assert.equal(r.free, true);
    assert.equal(r.spent, 0);
    assert.equal(loadRollState().starter, true);
    const c = nextRollCost(1);
    assert.equal(c.free, false);
    assert.equal(c.words, 72);
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

test('the price is 72 words at the live per-word rate (perWordRateNow), timed boosts excluded', () => {
  withStorage({}, () => {
    const rate = refWordWins();
    assert.ok(rate > 0);
    assert.ok(Math.abs(rate - perWordRateNow({ mode: 'wordBomb' }).rate) < 1e-9, 'no BOOST, no mark → the live rate');
    assert.equal(rollPriceNow(1), Math.round(72 * rate));
  });
});

test('the worn MARK never changes the price (no taking a MYTHIC off to roll cheap)', () => {
  const st = JSON.stringify({ v: 1, starter: true, marks: { 'mk-eclipse': { n: 1 } } }); // LEGENDARY +200% WINS
  const bare = withStorage({ [ROLL_STATE_KEY]: st }, () => rollPriceNow(1));
  withStorage({ [ROLL_STATE_KEY]: st, [MARKS_EQUIPPED_KEY]: 'mk-eclipse' }, () => {
    const f = perWordRateNow({ mode: 'wordBomb' }).factors;
    assert.ok(f.bonus > 3, 'the worn LEGENDARY is in the live rate');
    assert.equal(rollPriceNow(1), bare, 'but not in the roll price');
  });
});

test('DOUBLE ROLLS (SINGULARITY worn): one price, two results; the rarer is shown', () => {
  const st = { v: 1, starter: true, marks: { 'mk-singularity': { n: 1 } } };
  withStorage({ 'taw.wins': '1000000000', [ROLL_STATE_KEY]: JSON.stringify(st), [MARKS_EQUIPPED_KEY]: 'mk-singularity' }, (m) => {
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


// ---------------------------------------------------------------------------------------- MARKS v2
test('no ×10: the batch API is gone; AUTO ROLL stops on RARE / EPIC / LEGENDARY / MYTHIC / SECRET', () => {
  assert.equal(SHOP.buyMarkRolls, undefined);
  assert.deepEqual(AUTO_ROLL_TIERS, ['rare', 'epic', 'legendary', 'mythic', 'secret']);
});

test('AUTO ROLL until EPIC: one at a time, stops on the hit (the first-EPIC guarantee lands it by roll 10)', () => {
  const st = { v: 2, starter: true, marks: { 'mk-bomber': { n: 1 } } };
  withStorage({ 'taw.wins': '1000000000', [ROLL_STATE_KEY]: JSON.stringify(st) }, (m) => {
    const seen = [];
    const list = autoRoll({ until: 'epic', level: 1, rng: at(0), onEach: (r, i) => seen.push(i) });
    assert.equal(list.length, 10);
    assert.deepEqual(seen, [...Array(10).keys()], 'onEach after every roll');
    assert.ok(list.slice(0, 9).every((r) => r.tier === 'common'));
    assert.equal(list[9].tier, 'epic');
    assert.equal(list[9].pityHit, 'epic');
    assert.equal(JSON.parse(m.get(ROLL_STATE_KEY)).rolls, 10);
  });
});

test('AUTO ROLL stops when the wins run out (or the budget is spent); nothing rolls when short', () => {
  const st = JSON.stringify({ v: 2, starter: true, everEpic: true, marks: { 'mk-bomber': { n: 1 } } });
  withStorage({ [ROLL_STATE_KEY]: st }, (m) => {
    const price = rollPriceNow(1);
    m.set('taw.wins', String(price * 3 + 5));
    const list = autoRoll({ until: 'secret', level: 1, rng: at(0) }); // BOMBER dupes: no reward, no pip yet
    assert.equal(list.length, 3);
    assert.equal(Number(m.get('taw.wins')), 5);
    assert.deepEqual(autoRoll({ until: 'secret', level: 1, rng: at(0) }), [], 'short → []');
    m.set('taw.wins', String(price * 10));
    assert.equal(autoRoll({ until: 'secret', level: 1, rng: at(0), budget: price * 2 }).length, 2, 'budget');
    assert.equal(autoRoll({ until: 'secret', level: 1, rng: at(0), max: 1 }).length, 1, 'max');
  });
});

test('INDEX rewards: a NEW mark pays its words at your rate through the one grant; a dupe pays nothing', () => {
  withStorage({ 'taw.wins': '0', [ROLL_STATE_KEY]: JSON.stringify({ v: 2, starter: false, marks: {} }) }, (m) => {
    const rate = refWordWins();
    const r = buyMarkRoll({ level: 1, rng: at(0) }); // the free starter → BOMBER, new
    assert.equal(r.newMark, true);
    assert.equal(r.lump, Math.round(INDEX_NEW_WORDS.common * rate));
    assert.equal(Number(m.get('taw.wins')), r.lump);
    m.set('taw.wins', String(rollPriceNow(1)));
    const d = buyMarkRoll({ level: 1, rng: at(0) });
    assert.equal(d.newMark, false);
    assert.equal(d.lump, 0);
  });
});

test('INDEX rewards: completing a tier pays its completion once', () => {
  const commons = ROLL_MARKS.filter((x) => x.tier === 'common');
  const marks = Object.fromEntries(commons.slice(1).map((x) => [x.id, { n: 1 }]));
  withStorage({ 'taw.wins': '0', [ROLL_STATE_KEY]: JSON.stringify({ v: 2, starter: false, everEpic: true, marks }) }, () => {
    const rate = refWordWins();
    const r = buyMarkRoll({ level: 1, rng: at(0) }); // the missing first common
    assert.equal(r.completed, 'common');
    assert.equal(r.lump, Math.round((INDEX_NEW_WORDS.common + INDEX_COMPLETE_WORDS.common) * rate));
  });
});
