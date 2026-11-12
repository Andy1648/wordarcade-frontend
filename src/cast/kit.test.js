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

test('nov9: ARCADE is gems only (no rebirth): short = unaffordable, enough = bought at R0', () => withStorage({ 'taw.s2.kit.gf3': '1', 'taw.gems': JSON.stringify({ v: 1, bal: 5000, peak: 1, streak: 0, mig: 1 }) }, (map) => {
  assert.equal(buyKit('arcade').reason, 'unaffordable');
  map.set('taw.gems', JSON.stringify({ v: 1, bal: 9000, peak: 1, streak: 0, mig: 1 }));
  assert.deepEqual(buyKit('arcade'), { ok: true });
  assert.equal(ownsKit('arcade'), true);
}));

test('nov9: wins no longer earn a frame; frames the OLD rules had earned stay owned', () => {
  withStorage({ 'taw.s2.kit.gf3': '1', 'taw.s2.count': JSON.stringify({ mp: 300 }) }, () => assert.equal(ownsKit('frost'), false));
  withStorage({ 'taw.s2.count': JSON.stringify({ mp: 75 }) }, (map) => {
    assert.equal(ownsKit('frost') && ownsKit('graffiti'), true, '75 wins had earned FROST + GRAFFITI');
    assert.equal(ownsKit('flame'), false);
    assert.equal(map.get('taw.s2.kit.gf3'), '1');
  });
});

test('WIN FX are retired (nov2): no id is a piece any more, the fx slot never holds one', () => withStorage({ 'taw.s2.kit.gf3': '1', 'taw.s2.count': JSON.stringify({ mp: 300 }), [KIT_KEY]: JSON.stringify({ own: ['firework'], fx: 'firework' }) }, () => {
  assert.equal(ownsKit('firework'), false);
  assert.equal(wearKit('fx', 'firework'), false);
  assert.equal(readKit().fx, null);
  assert.deepEqual(readKit().own, []);
}));

test('every component id is unique across the slots (one id, one piece)', async () => {
  const { FRAMES } = await import('./kit.js');
  const ids = FRAMES.map((k) => k.id);
  assert.equal(new Set(ids).size, ids.length);
});
