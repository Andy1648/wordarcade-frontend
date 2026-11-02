// chaseHeroes.test.js — the CHASE heroes (oct28, Andy: "a few SUPER-RARE chase heroes"): DRAKE + MAGMA (MYTHIC) and
// FACET (SECRET) are never sold and never earned on a counter — only a gear roll can DROP one (CHASE_ODDS), and a drop is
// kept forever. Every pose + idle frame is painted on disk.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { CHASE, CHASE_ODDS, HERO_UNLOCK, CAST_BEATS, CAST_FRAMES, HEROES_KEY, heroById, ownsHero, heroGateMet, readMain, castFor, castSrc, hasPose, rollChaseDrop } from './cast.js';
import { buyHero } from './heroShop.js';
import * as G from '../progress/gems.js';

function withStorage(seed, fn) {
  const map = new Map(Object.entries(seed || {}));
  const saved = globalThis.localStorage;
  globalThis.localStorage = { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k) };
  try { return fn(map); } finally { if (saved === undefined) delete globalThis.localStorage; else globalThis.localStorage = saved; }
}
const gems = (bal) => JSON.stringify({ v: 1, bal, peak: 1, streak: 0, mig: 1 });
const IDS = ['drake', 'magma', 'facet'];

test('three CHASE heroes: two MYTHIC, one SECRET (the rarest), all painted — HERO / WIN / K.O. + a 6-frame idle', () => {
  assert.deepEqual(CHASE.map((h) => h.id), IDS);
  assert.deepEqual(CHASE.map((h) => h.chase), ['mythic', 'mythic', 'secret']);
  assert.ok(CHASE_ODDS.facet > CHASE_ODDS.drake && CHASE_ODDS.drake === CHASE_ODDS.magma);
  for (const id of IDS) {
    assert.ok(heroById(id) && heroById(id).legend && !heroById(id).price, id);
    for (const pose of ['hero', 'win', 'ko']) {
      assert.ok(hasPose(id, pose), `${id} ${pose}`);
      assert.equal(castSrc(id, pose), `/cast/${id}-${pose}.webp`);
      assert.ok(existsSync(join(process.cwd(), 'public', 'cast', `${id}-${pose}.webp`)), `${id} ${pose}`);
    }
    assert.equal(CAST_FRAMES[id].n, 6);
    for (let i = 0; i < 6; i += 1) assert.ok(existsSync(join(process.cwd(), 'public', 'cast', 'anim', `${id}-${i}.webp`)), `${id} frame ${i}`);
    assert.ok(CAST_BEATS[id]);
    assert.equal(HERO_UNLOCK[id].label, `1 IN ${CHASE_ODDS[id]}`, 'the locked card prints its odds');
  }
});

test('never sold, never free: not owned, cannot be bought with any gems, cannot be your MAIN, never a stranger\'s seat', () => withStorage({ [G.GEMS_KEY]: gems(10_000_000), 'taw.main': 'facet' }, () => {
  for (const id of IDS) {
    assert.equal(ownsHero(id), false, id);
    assert.equal(heroGateMet(id), false, id);
    assert.deepEqual(buyHero(id), { ok: false, reason: 'locked' }, id);
  }
  assert.equal(G.getGems(), 10_000_000, 'no gems taken');
  assert.equal(readMain(), 'riot', 'a hand-edited main falls back');
  for (let i = 0; i < 200; i++) assert.ok(!IDS.includes(castFor(`p${i}`).id));
}));

test('THE DROP: a lucky roll keeps the hero (owned, equippable) and never drops one you already have', () => withStorage({}, (map) => {
  assert.equal(rollChaseDrop(() => 0.5), null, 'a normal roll drops nothing');
  // a draw under 1 / 500 hits the first hero not owned yet
  assert.equal(rollChaseDrop(() => 0.0001), 'drake');
  assert.equal(ownsHero('drake'), true);
  assert.deepEqual(JSON.parse(map.get(HEROES_KEY)), ['drake']);
  assert.deepEqual(buyHero('drake'), { ok: true }, 'an owned CHASE hero just equips');
  assert.equal(readMain(), 'drake');
  assert.equal(rollChaseDrop(() => 0.0001), 'magma', 'DRAKE is owned, so the same luck lands MAGMA');
  assert.equal(rollChaseDrop(() => 0.0001), 'facet');
  assert.equal(rollChaseDrop(() => 0), null, 'all three owned: nothing left to drop');
}));

test('the odds hold: over many rolls each hero drops at about 1 IN N', () => withStorage({}, (map) => {
  let seed = 7;
  const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const hits = { drake: 0, magma: 0, facet: 0 };
  const N = 400_000;
  for (let i = 0; i < N; i++) {
    const id = rollChaseDrop(rand);
    if (id) { hits[id] += 1; map.delete(HEROES_KEY); } // forget it, so every roll is a fresh chance
  }
  for (const id of IDS) {
    const want = N / CHASE_ODDS[id];
    assert.ok(Math.abs(hits[id] - want) < want * 0.2, `${id}: ${hits[id]} vs ~${Math.round(want)}`);
  }
}));
