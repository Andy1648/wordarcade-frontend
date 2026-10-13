import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanTick, isLevelMilestone, announceRolls, rollTickCode, verifyTick, resetTickCheck } from './live.js';
import { tickText, tickParts } from './tickText.js';

test('the ticker renders only well-formed, clean {kind, name, number} messages', () => {
  assert.deepEqual(cleanTick({ k: 'lv', n: 'ZED', v: 50 }), { k: 'lv', n: 'ZED', v: 50 });
  assert.equal(cleanTick({ k: 'lv', n: 'ZED', v: 50.5 }), null);
  assert.equal(cleanTick({ k: 'hack', n: 'ZED', v: 1 }), null);
  assert.equal(cleanTick({ k: 'lv', n: 'fuckface', v: 1 }), null, 'names pass the board filter');
  assert.equal(cleanTick({ k: 'lv', n: '<img src=x onerror=alert(1)>', v: 1 }), null);
  assert.equal(cleanTick({ k: 'rank', n: 'ZED', v: 101 }), null);
  assert.deepEqual(cleanTick({ k: 'rank', n: '小明', v: 3 }), { k: 'rank', n: '小明', v: 3 });
  assert.equal(cleanTick(null), null);
});

test('templated text only', () => {
  assert.equal(tickText({ k: 'lv', n: 'ZED', v: 50 }), 'ZED just hit LV 50');
  assert.equal(tickText({ k: 'rank', n: 'ZED', v: 3 }), 'ZED took #3');
  assert.equal(tickText({ k: 'rb', n: 'ZED', v: 5 }), 'ZED reached REBIRTH 5');
});

test('milestone levels: 10, 25, then every 50', () => {
  assert.deepEqual([9, 10, 25, 26, 50, 75, 100, 150].map(isLevelMilestone), [false, true, true, false, true, false, true, true]);
});

test('MARK ROLLS ticker: MYTHIC+ only, one line each, "NAME ROLLED MYTHIC" / "NAME ROLLED SECRET"', () => {
  assert.equal(tickText({ k: 'roll', n: 'ZED', v: 4 }), 'ZED ROLLED MYTHIC');
  assert.equal(tickText({ k: 'roll', n: 'ZED', v: 5 }), 'ZED ROLLED SECRET');
  assert.equal(tickText({ k: 'roll', n: 'ZED', v: 3 }), '');
  assert.deepEqual(cleanTick({ k: 'roll', n: 'ZED', v: 4 }), { k: 'roll', n: 'ZED', v: 4 });
  assert.equal(cleanTick({ k: 'roll', n: 'ZED', v: 3 }), null, 'LEGENDARY and below never post');
  assert.equal(cleanTick({ k: 'roll', n: 'ZED', v: 99 }), null);
  assert.deepEqual(['common', 'rare', 'epic', 'legendary', 'mythic', 'secret', undefined].map(rollTickCode), [0, 0, 0, 0, 4, 5, 0]);
});

test('MARK ROLLS ticker: unclaimed posts nothing; claimed posts one per MYTHIC+ result; never throws', () => {
  const map = new Map();
  const saved = globalThis.localStorage;
  globalThis.localStorage = { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k) };
  try {
    const rolls = [{ tier: 'mythic' }, { tier: 'common' }, { tier: 'secret' }, null];
    assert.equal(announceRolls(rolls), 0, 'unclaimed');
    map.set('taw.lb.profile', JSON.stringify({ id: 1, username: 'ZED' }));
    assert.equal(announceRolls(rolls), 2);
    assert.equal(announceRolls([{ tier: 'legendary' }]), 0);
    assert.equal(announceRolls(undefined), 0);
  } finally {
    if (saved === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = saved;
  }
});

test('RARITY IDENTITY: a roll tick hands its TIER to the render as a rarity key; the text is unchanged', () => {
  assert.deepEqual(tickParts({ k: 'roll', n: 'ZED', v: 4 }), { lead: 'ZED ROLLED ', tag: 'MYTHIC', rarity: 'mythic' });
  assert.deepEqual(tickParts({ k: 'roll', n: 'ZED', v: 5 }), { lead: 'ZED ROLLED ', tag: 'SECRET', rarity: 'secret' });
  assert.equal(tickParts({ k: 'roll', n: 'ZED', v: 3 }), null);
  assert.equal(tickParts(null), null);
});

test('TIER IDENTITY: level and rebirth ticks carry their rung, the text is unchanged', () => {
  assert.deepEqual(tickParts({ k: 'lv', n: 'ZED', v: 50 }), { lead: 'ZED just hit ', tag: 'LV 50', rarity: 'legendary' });
  assert.deepEqual(tickParts({ k: 'rb', n: 'ZED', v: 5 }), { lead: 'ZED reached ', tag: 'REBIRTH 5', rarity: 'legendary' });
  assert.deepEqual(tickParts({ k: 'rank', n: 'ZED', v: 3 }), { lead: 'ZED took #3', tag: '', rarity: null });
});

test('038: a received tick shows only when the server backs it; pre-038 it shows; a network error drops it', async () => {
  const t = { k: 'roll', n: 'ZED', v: 5 };
  resetTickCheck();
  assert.equal(await verifyTick(t, async () => false), false, 'a forged ROLLED SECRET is dropped');
  assert.equal(await verifyTick(t, async () => true), true);
  resetTickCheck();
  assert.equal(await verifyTick(t, async () => { throw Object.assign(new Error('x'), { code: 'network' }); }), false);
  assert.equal(await verifyTick(t, async () => { throw Object.assign(new Error('x'), { code: 'PGRST202' }); }), true, 'pre-038: as before');
  assert.equal(await verifyTick(t, async () => false), true, 'and stays off for the page load');
  resetTickCheck();
});
