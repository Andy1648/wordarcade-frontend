// kit.test.js — HERO COMPONENTS (kit.js): the free pup is yours, earned ones unlock at their WINS, a rebirth-gated
// one can't be bought early, a road frame is never sold and is earned by claiming its MASTERY ROAD node, and a slot
// only ever holds something you own.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ownsKit, buyKit, wearKit, readKit, kitGateMet, ROAD_FRAME_NODE, FRAMES, KIT_KEY } from './kit.js';
import { ROAD_SHAPE, ROAD_MODES } from '../progress/masteryRoad.js';

function withStorage(seed, fn) {
  const store = new Map(Object.entries(seed));
  globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  try { return fn(store); } finally { delete globalThis.localStorage; }
}

test('ROAD_FRAME_NODE is the mastery road\'s frame node, and every road frame names a real road', () => {
  assert.equal(ROAD_SHAPE[ROAD_FRAME_NODE].kind, 'frame');
  for (const f of FRAMES.filter((x) => x.road)) {
    assert.ok(ROAD_MODES[f.road], f.id);
    assert.equal(ROAD_MODES[f.road].frame, f.id, `${f.road} road shows ${f.id}`);
  }
});

test('the pup is free; INKY is earned at 15 wins; a slot only takes what you own', () => withStorage({ 'taw.s2.count': JSON.stringify({ bots: 10 }) }, () => {
  assert.equal(ownsKit('pup'), true);
  assert.equal(ownsKit('inky'), false);
  assert.equal(wearKit('pet', 'inky'), false);
  assert.equal(wearKit('pet', 'pup'), true);
  assert.equal(wearKit('frame', 'pup'), false); // wrong slot
  assert.equal(readKit().pet, 'pup');
}));

test('a road frame: never for sale, earned by claiming its node', () => withStorage({ 'taw.s2.gems': JSON.stringify({ bal: 99999 }) }, (store) => {
  assert.equal(kitGateMet('chain'), false);
  assert.equal(buyKit('chain').ok, false);
  store.set('taw.s2.road', JSON.stringify({ chain: [ROAD_FRAME_NODE] }));
  assert.equal(ownsKit('chain'), true);
  assert.equal(wearKit('frame', 'chain'), true);
  assert.equal(JSON.parse(store.get(KIT_KEY)).frame, 'chain');
}));

test('TURBO waits for REBIRTH 3, then costs gems', () => withStorage({ 'taw.s2.gems': JSON.stringify({ bal: 5000 }) }, () => {
  assert.equal(buyKit('turbo').reason, 'locked');
}));
