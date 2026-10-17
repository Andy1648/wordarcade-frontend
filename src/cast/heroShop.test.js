// heroShop.test.js — ELITE heroes (Andy oct17): bought once with gems, kept, equipped on buy; a locked ELITE can never
// be your MAIN (a hand-edited taw.main falls back to RIOT); every ELITE keeps its member's colour + idle beat.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ELITE, ELITE_PRICE, CAST_BEATS, ownsHero, readMain, castFor, castSrc, HEROES_KEY } from './cast.js';
import { buyHero } from './heroShop.js';
import * as G from '../progress/gems.js';

function withStorage(seed, fn) {
  const map = new Map(Object.entries(seed || {}));
  const saved = globalThis.localStorage;
  globalThis.localStorage = { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k) };
  try { return fn(map); } finally { if (saved === undefined) delete globalThis.localStorage; else globalThis.localStorage = saved; }
}
const gems = (bal) => JSON.stringify({ v: 1, bal, peak: 1, streak: 0, mig: 1 });

test('five ELITEs, one per member, same colour + beat, painted HERO', () => {
  assert.equal(ELITE.length, 5);
  for (const e of ELITE) {
    assert.ok(e.elite && e.price === ELITE_PRICE && e.color && e.seat);
    assert.equal(CAST_BEATS[e.id], CAST_BEATS[e.base]);
    assert.equal(castSrc(e.id, 'hero'), `/cast/${e.id}-hero.webp`);
    assert.equal(castSrc(e.id, 'win'), `/cast/${e.id}-hero.webp`, 'unpainted poses fall back to the ELITE hero, never the base outfit');
  }
});

test('locked: not owned, cannot be your main', () => withStorage({ 'taw.main': 'hex-elite' }, () => {
  assert.equal(ownsHero('hex-elite'), false);
  assert.equal(ownsHero('riot'), true);
  assert.equal(readMain(), 'riot');
}));

test('short on gems: nothing spent, nothing owned', () => withStorage({ [G.GEMS_KEY]: gems(ELITE_PRICE - 1) }, (map) => {
  assert.deepEqual(buyHero('riot-elite'), { ok: false, reason: 'unaffordable' });
  assert.equal(G.getGems(), ELITE_PRICE - 1);
  assert.equal(map.get(HEROES_KEY), undefined);
}));

test('buy: gems paid once, owned, equipped; buying again is free', () => withStorage({ [G.GEMS_KEY]: gems(ELITE_PRICE + 10) }, () => {
  assert.deepEqual(buyHero('riot-elite'), { ok: true });
  assert.equal(G.getGems(), 10);
  assert.equal(ownsHero('riot-elite'), true);
  assert.equal(readMain(), 'riot-elite');
  assert.equal(castFor('me', true).name, 'ROCKSTAR RIOT');
  assert.deepEqual(buyHero('riot-elite'), { ok: true });
  assert.equal(G.getGems(), 10);
}));

test('intermediate crew: HEX + GLITCH cost gems, RIOT / HYPE / BRAWL stay free', () => withStorage({ 'taw.s2.heroes.gf': '1' }, () => {
  assert.equal(ownsHero('riot') && ownsHero('hype') && ownsHero('brawl'), true);
  assert.equal(ownsHero('hex'), false);
  assert.equal(ownsHero('glitch'), false);
}));

test('grandfathered: already playing HEX when it became priced → it is yours (once)', () => withStorage({ 'taw.main': 'hex' }, (map) => {
  assert.equal(readMain(), 'hex');
  assert.equal(ownsHero('hex'), true);
  assert.equal(map.get('taw.s2.heroes.gf'), '1');
  map.set('taw.main', 'glitch'); // a later hand-edit gets nothing
  assert.equal(readMain(), 'riot');
}));

test('buying a priced crew member: 750 gems, owned, equipped', () => withStorage({ 'taw.s2.heroes.gf': '1', [G.GEMS_KEY]: gems(800) }, () => {
  assert.deepEqual(buyHero('glitch'), { ok: true });
  assert.equal(G.getGems(), 50);
  assert.equal(readMain(), 'glitch');
}));
