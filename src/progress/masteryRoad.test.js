// masteryRoad.test.js — MODE MASTERY ROADS: the node ladders keep the cadence promise, every node pays exactly once,
// a locked node never pays, the hero node hands out the hero (or a chest when it's already yours). Pure, node --test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ROAD_LEVELS, ROAD_SHAPE, ROAD_MODES, roadStatus, claimRoadNode, masteryMark, HERO_OWNED_GEMS } from './masteryRoad.js';
import { masteryWordsToReach, MASTERY_KEY, MASTERY_MODES } from './mastery.js';
import { HEROES_KEY } from '../cast/cast.js';
import { RATE } from '../../claude/mastery-road/cadence.mjs';

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
const atLevel = (mode, lv) => ({ [MASTERY_KEY]: JSON.stringify({ [mode]: masteryWordsToReach(lv) }) });

test('every mastery mode has a road of ROAD_SHAPE length, strictly rising, starting above M1', () => {
  for (const m of MASTERY_MODES) {
    const L = ROAD_LEVELS[m];
    assert.ok(L && ROAD_MODES[m], m);
    assert.equal(L.length, ROAD_SHAPE.length, m);
    assert.ok(L[0] >= 2, m);
    for (let i = 1; i < L.length; i++) assert.ok(L[i] > L[i - 1], `${m} node ${i}`);
  }
});

test('cadence: a median player reaches the first node inside 25 min and every early gap (nodes 1-6) stays under 40 min', () => {
  for (const m of MASTERY_MODES) {
    const r = RATE[m].median;
    let last = 0;
    ROAD_LEVELS[m].slice(0, 6).forEach((lv, i) => {
      const t = masteryWordsToReach(lv) / r;
      assert.ok(t - last < (i === 0 ? 25 : 40), `${m} node ${i}: ${Math.round(t - last)} min`);
      last = t;
    });
  }
});

test('one-time gem budget a road stays small: chests + tickets ≤ 4 rolls at the season-2 price', () => {
  const chests = ROAD_SHAPE.filter((s) => s.kind === 'chest').reduce((t, s) => t + s.gems, 0);
  const tickets = ROAD_SHAPE.filter((s) => s.kind === 'ticket').length;
  assert.ok(chests + tickets * 75 <= 4 * 75, `${chests} + ${tickets} tickets`);
});

test('a fresh save: everything locked, the first node is next with its full distance', () => {
  withStorage({}, () => {
    const s = roadStatus('chain');
    assert.equal(s.level, 1);
    assert.equal(s.ready, 0);
    assert.equal(s.next.i, 0);
    assert.equal(s.next.toGo, masteryWordsToReach(ROAD_LEVELS.chain[0]));
    assert.ok(s.nodes.every((n) => n.state === 'locked'));
  });
});

test('reached nodes are READY; a claim pays once, a locked node never pays', () => {
  withStorage(atLevel('word-bomb', ROAD_LEVELS['word-bomb'][2]), (map) => {
    const s = roadStatus('word-bomb');
    assert.deepEqual(s.nodes.slice(0, 4).map((n) => n.state), ['ready', 'ready', 'ready', 'locked']);
    assert.equal(claimRoadNode('word-bomb', 3).ok, false); // locked
    const chest = claimRoadNode('word-bomb', 1);
    assert.equal(chest.ok, true);
    assert.equal(chest.gems, ROAD_SHAPE[1].gems);
    assert.equal(claimRoadNode('word-bomb', 1).ok, false); // twice
    assert.equal(roadStatus('word-bomb').nodes[1].state, 'claimed');
    assert.equal(claimRoadNode('word-bomb', 0).ok, true); // the badge
    assert.equal(roadStatus('word-bomb').badgeTier, 1);
    assert.ok(map.get('taw.s2.road'));
  });
});

test('the hero node hands out the mode hero — or a chest when it is already yours', () => {
  const heroAt = ROAD_SHAPE.findIndex((s) => s.kind === 'hero');
  withStorage(atLevel('fuse', ROAD_LEVELS.fuse[heroAt]), (map) => {
    const r = claimRoadNode('fuse', heroAt);
    assert.equal(r.ok, true);
    assert.equal(r.gems, 0);
    assert.ok(JSON.parse(map.get(HEROES_KEY)).includes(ROAD_MODES.fuse.hero));
  });
  withStorage({ ...atLevel('fuse', ROAD_LEVELS.fuse[heroAt]), [HEROES_KEY]: JSON.stringify([ROAD_MODES.fuse.hero]) }, () => {
    const r = claimRoadNode('fuse', heroAt);
    assert.equal(r.ok, true);
    assert.equal(r.gems, HERO_OWNED_GEMS);
  });
});

test('masteryMark: the level now, 0 for a mode without a road; blocked storage never throws', () => {
  withStorage(atLevel('sat-rush', 4), () => {
    assert.equal(masteryMark('sat-rush'), 4);
    assert.equal(masteryMark('word-race'), 0);
  });
  const saved = globalThis.localStorage;
  globalThis.localStorage = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  try {
    assert.equal(roadStatus('chain').level, 1);
    assert.equal(claimRoadNode('chain', 0).ok, false);
  } finally {
    if (saved === undefined) delete globalThis.localStorage; else globalThis.localStorage = saved;
  }
});
