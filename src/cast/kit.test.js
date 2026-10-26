// kit.test.js — HERO COMPONENTS (kit.js): earned ones unlock at their WINS, a rebirth-gated
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

test('a save that still has a SIDEKICK (removed oct26) loads clean: the pet key and sidekick ids are ignored', () => withStorage({
  [KIT_KEY]: JSON.stringify({ own: ['pixel', 'lucky', 'jackpot'], pet: 'pixel', frame: 'jackpot', fx: null }),
}, (store) => {
  const k = readKit();
  assert.deepEqual(k, { own: ['jackpot'], frame: 'jackpot', fx: null });
  assert.equal(ownsKit('pup'), false);
  assert.equal(wearKit('pet', 'pup'), false);
  assert.equal(wearKit('fx', null), true); // the next write drops the old keys
  assert.deepEqual(JSON.parse(store.get(KIT_KEY)), { own: ['jackpot'], frame: 'jackpot', fx: null });
}));

test('a road frame: never for sale, earned by claiming its node', () => withStorage({ 'taw.s2.gems': JSON.stringify({ bal: 99999 }) }, (store) => {
  assert.equal(kitGateMet('chain'), false);
  assert.equal(buyKit('chain').ok, false);
  store.set('taw.s2.road', JSON.stringify({ chain: [ROAD_FRAME_NODE] }));
  assert.equal(ownsKit('chain'), true);
  assert.equal(wearKit('frame', 'chain'), true);
  assert.equal(JSON.parse(store.get(KIT_KEY)).frame, 'chain');
}));

test('ARCADE waits for REBIRTH 2, then costs gems', () => withStorage({ 'taw.s2.gems': JSON.stringify({ bal: 5000 }) }, () => {
  assert.equal(buyKit('arcade').reason, 'locked');
}));

test('a WIN FX: earned at its wins, only fits the fx slot', () => withStorage({ 'taw.s2.count': JSON.stringify({ mp: 30 }) }, () => {
  assert.equal(ownsKit('firework'), true);
  assert.equal(wearKit('frame', 'firework'), false);
  assert.equal(wearKit('fx', 'firework'), true);
  assert.equal(readKit().fx, 'firework');
}));

test('every component id is unique across the slots (one id, one piece)', async () => {
  const { FRAMES, WIN_FX } = await import('./kit.js');
  const ids = [...FRAMES, ...WIN_FX].map((k) => k.id);
  assert.equal(new Set(ids).size, ids.length);
});
