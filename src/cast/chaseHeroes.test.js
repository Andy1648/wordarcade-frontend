// chaseHeroes.test.js — the rarest heroes: DRAKE + MAGMA (MYTHIC) and FACET (SECRET). They dropped from gear rolls until
// nov12 (Andy: "dont make any hero avatars rollable its confusing - just make them cost gems"): now they are BOUGHT with
// gems like every other hero, priced over the LEGENDs, and anyone who rolled one keeps it. Every pose + idle frame is
// painted on disk.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import * as CASTMOD from './cast.js';
import { CHASE, HERO_PRICE, HERO_UNLOCK, CAST_BEATS, CAST_FRAMES, HEROES_KEY, heroById, ownsHero, heroGateMet, readMain, castFor, castSrc, hasPose } from './cast.js';
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
const GF = { 'taw.s2.heroes.gf': '1', 'taw.s2.heroes.gf2': '1', 'taw.s2.heroes.gf3': '1' };

test('three top-tier heroes: two MYTHIC, one SECRET (the rarest), all painted — HERO / WIN / K.O. + a 6-frame idle', () => {
  assert.deepEqual(CHASE.map((h) => h.id), IDS);
  assert.deepEqual(CHASE.map((h) => h.chase), ['mythic', 'mythic', 'secret']);
  for (const id of IDS) {
    assert.ok(heroById(id) && heroById(id).legend, id);
    for (const pose of ['hero', 'win', 'ko']) {
      assert.ok(hasPose(id, pose), `${id} ${pose}`);
      assert.equal(castSrc(id, pose), `/cast/${id}-${pose}.webp`);
      assert.ok(existsSync(join(process.cwd(), 'public', 'cast', `${id}-${pose}.webp`)), `${id} ${pose}`);
    }
    assert.equal(CAST_FRAMES[id].n, 6);
    for (let i = 0; i < 6; i += 1) assert.ok(existsSync(join(process.cwd(), 'public', 'cast', 'anim', `${id}-${i}.webp`)), `${id} frame ${i}`);
    assert.ok(CAST_BEATS[id]);
  }
});

test('nov12: never rolled — no drop, no odds, no gate; priced over every LEGEND, SECRET over MYTHIC', () => {
  assert.equal(CASTMOD.rollChaseDrop, undefined, 'the roll drop is gone');
  assert.equal(CASTMOD.CHASE_ODDS, undefined, 'no odds table');
  const legendTop = Math.max(...['boo', 'mecha', 'nova'].map((id) => HERO_PRICE[id]));
  for (const id of IDS) {
    assert.equal(HERO_UNLOCK[id], undefined, `${id} has no drop / lock entry`);
    assert.equal(heroGateMet(id), true, id);
    assert.equal(heroById(id).price, HERO_PRICE[id]);
    assert.ok(HERO_PRICE[id] > legendTop, `${id} ${HERO_PRICE[id]} > ${legendTop}`);
  }
  assert.equal(HERO_PRICE.drake, HERO_PRICE.magma);
  assert.ok(HERO_PRICE.facet > HERO_PRICE.drake);
});

test('bought with gems: short = nothing taken; enough = owned, equipped, and never charged twice', () => withStorage({ ...GF, [G.GEMS_KEY]: gems(HERO_PRICE.facet - 1) }, (map) => {
  assert.equal(ownsHero('facet'), false);
  assert.deepEqual(buyHero('facet'), { ok: false, reason: 'unaffordable' });
  assert.equal(G.getGems(), HERO_PRICE.facet - 1);
  map.set(G.GEMS_KEY, gems(HERO_PRICE.facet + 5));
  assert.deepEqual(buyHero('facet'), { ok: true });
  assert.equal(G.getGems(), 5);
  assert.equal(ownsHero('facet'), true);
  assert.equal(readMain(), 'facet');
  assert.deepEqual(buyHero('facet'), { ok: true });
  assert.equal(G.getGems(), 5, 'owned: equipping again is free');
}));

test('one rolled before nov12 stays owned (it is in the owned list, like a bought hero), and is free to equip', () => withStorage({ ...GF, [HEROES_KEY]: JSON.stringify(['drake']), [G.GEMS_KEY]: gems(0) }, () => {
  assert.equal(ownsHero('drake'), true);
  assert.deepEqual(buyHero('drake'), { ok: true });
  assert.equal(readMain(), 'drake');
  assert.equal(ownsHero('magma'), false);
}));

test('a hand-edited main without owning it falls back to RIOT; never a stranger\'s seat', () => withStorage({ ...GF, 'taw.main': 'facet' }, () => {
  assert.equal(readMain(), 'riot');
  for (let i = 0; i < 200; i++) assert.ok(!IDS.includes(castFor(`p${i}`).id));
}));
