// heroShop.test.js — ELITE heroes (Andy oct17): bought once with gems, kept, equipped on buy; a locked ELITE can never
// be your MAIN (a hand-edited taw.main falls back to RIOT); every ELITE keeps its member's colour + idle beat.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ELITE, ELITE_PRICE, CAST_BEATS, ownsHero, readMain, castFor, castSrc, HEROES_KEY } from './cast.js';
import { buyHero } from './heroShop.js';
import { heroEarned } from './cast.js';
import { REBIRTH_KEY as REBIRTH_KEY_FOR_TEST } from '../progress/xp.js';
import * as G from '../progress/gems.js';
import * as CASTMOD from './cast.js';

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
    // oct17: every ELITE has its own painted WIN + KO (never the base outfit)
    assert.equal(castSrc(e.id, 'win'), `/cast/${e.id}-win.webp`);
    assert.equal(castSrc(e.id, 'ko'), `/cast/${e.id}-ko.webp`);
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

test('skipping the wait on a crew member: 300 gems, owned, equipped', () => withStorage({ 'taw.s2.heroes.gf': '1', [G.GEMS_KEY]: gems(350) }, () => {
  assert.deepEqual(buyHero('glitch'), { ok: true });
  assert.equal(G.getGems(), 50);
  assert.equal(readMain(), 'glitch');
}));

test('earned free: GLITCH at the first rebirth, HEX at level 20 (no gems)', () => withStorage({ 'taw.s2.heroes.gf': '1' }, (map) => {
  assert.equal(ownsHero('glitch'), false);
  map.set(REBIRTH_KEY_FOR_TEST, '1');
  assert.equal(ownsHero('glitch'), true, 'a rebirth earns GLITCH');
  assert.equal(heroEarned('hex'), false);
}));

test('NEW FACES + LEGEND: painted, priced, never handed out as another player\'s seat member', () => withStorage({ 'taw.s2.heroes.gf': '1' }, (map) => {
  for (const id of ['dud', 'lexi', 'boo', 'shh', 'sizzle', 'mecha', 'quill', 'jinx', 'salty', 'buzz', 'nova']) {
    for (const pose of ['hero', 'win', 'ko']) assert.equal(castSrc(id, pose), `/cast/${id}-${pose}.webp`);
    assert.equal(ownsHero(id), false);
    assert.ok(CAST_BEATS[id]);
  }
  for (let i = 0; i < 200; i++) assert.ok(!['dud', 'lexi', 'boo', 'shh', 'sizzle', 'mecha', 'quill', 'jinx', 'salty', 'buzz', 'nova'].includes(castFor(`p${i}`).id));
  map.set(REBIRTH_KEY_FOR_TEST, '5');
  assert.equal(ownsHero('boo'), false, 'oct19: REBIRTH 5 only unlocks the BUY — a LEGEND is never free');
  assert.equal(ownsHero('lexi'), false);
}));

test('GOLD: earned with 100 wins on its member (bots + online), never sold; a win counts for the equipped hero', async () => {
  const { GOLD, GOLD_WINS, goldProgress } = await import('./cast.js');
  const { bumpHeroWin, HERO_WINS_KEY, heroWins } = await import('./heroWins.js');
  withStorage({ 'taw.s2.heroes.gf': '1', [G.GEMS_KEY]: gems(99999) }, (map) => {
    assert.equal(GOLD.length, 5);
    assert.equal(GOLD_WINS, 100);
    for (const g of GOLD) {
      assert.ok(g.gold && !g.price && g.seat && CAST_BEATS[g.id]);
      assert.equal(castSrc(g.id, 'hero'), `/cast/${g.id}-hero.webp`);
      assert.equal(castSrc(g.id, 'win'), `/cast/${g.id}-hero.webp`, 'oct19: a GOLD never borrows the member WIN — its own gold HERO until painted');
    }
    map.set(HERO_WINS_KEY, JSON.stringify({ riot: 99 }));
    assert.equal(ownsHero('riot-gold'), false);
    assert.deepEqual(buyHero('riot-gold'), { ok: false, reason: 'locked' }, 'GOLD is never for sale');
    assert.equal(G.getGems(), 99999);
    map.set('taw.main', 'riot-elite'); // an ELITE's wins count toward its member
    bumpHeroWin();
    assert.equal(heroWins('riot'), 100);
    assert.deepEqual(goldProgress('riot-gold'), { have: 100, need: 100, done: true });
    assert.equal(ownsHero('riot-gold'), true);
    assert.deepEqual(buyHero('riot-gold'), { ok: true });
    assert.equal(readMain(), 'riot-gold');
    bumpHeroWin(); // equipped GOLD → still RIOT's count
    assert.equal(heroWins('riot'), 101);
    assert.equal(ownsHero('hex-gold'), false);
  });
});

test('oct19: DUD / LEXI / SHH / SIZZLE are earned at a WINS count (bots + online) or bought; DUD costs the most', () => withStorage({ 'taw.s2.heroes.gf': '1' }, (map) => {
  const { HERO_PRICE, HERO_UNLOCK } = CASTMOD;
  assert.ok(HERO_PRICE.dud > HERO_PRICE.lexi && HERO_PRICE.dud > HERO_PRICE.sizzle);
  for (const id of ['dud', 'lexi', 'shh', 'sizzle', 'quill', 'jinx', 'salty', 'buzz']) assert.ok(HERO_UNLOCK[id].wins > 0 && HERO_PRICE[id] > 0 && !HERO_UNLOCK[id].gate);
  map.set('taw.s2.count', JSON.stringify({ mp: 20, bots: 19 }));
  assert.equal(ownsHero('shh'), false);
  map.set('taw.s2.count', JSON.stringify({ mp: 20, bots: 20 }));
  assert.equal(ownsHero('shh'), true, '40 wins, bots + online');
  assert.equal(ownsHero('dud'), false);
}));

test('oct19: a LEGEND needs its rebirth AND gems — locked (no gems taken) until the rebirth, then bought', () => withStorage({ 'taw.s2.heroes.gf': '1', [G.GEMS_KEY]: gems(20000) }, (map) => {
  const { HERO_PRICE, heroGateMet } = CASTMOD;
  assert.ok(HERO_PRICE.boo > 5000 && HERO_PRICE.mecha > HERO_PRICE.boo && HERO_PRICE.nova > HERO_PRICE.mecha);
  map.set(REBIRTH_KEY_FOR_TEST, '9');
  assert.equal(heroGateMet('mecha'), false);
  assert.deepEqual(buyHero('mecha'), { ok: false, reason: 'locked' });
  assert.equal(G.getGems(), 20000);
  map.set(REBIRTH_KEY_FOR_TEST, '10');
  assert.equal(ownsHero('mecha'), false, 'the rebirth alone does not earn it');
  assert.deepEqual(buyHero('mecha'), { ok: true });
  assert.equal(G.getGems(), 20000 - HERO_PRICE.mecha);
  assert.equal(ownsHero('mecha'), true);
}));

test('oct19 grandfathered: a save that met the OLD free rules keeps BOO / MECHA / DUD (once)', () => withStorage({ 'taw.s2.heroes.gf': '1', [REBIRTH_KEY_FOR_TEST]: '10' }, (map) => {
  assert.equal(ownsHero('boo'), true);
  assert.equal(ownsHero('mecha'), true);
  assert.equal(map.get('taw.s2.heroes.gf2'), '1');
}));

test('oct19: a hero earned by play is never charged when equipped through buyHero', () => withStorage({ 'taw.s2.heroes.gf': '1', 'taw.s2.heroes.gf2': '1', [G.GEMS_KEY]: gems(5000), 'taw.s2.count': JSON.stringify({ bots: 100 }) }, () => {
  assert.equal(ownsHero('dud'), true);
  assert.deepEqual(buyHero('dud'), { ok: true });
  assert.equal(G.getGems(), 5000);
}));
