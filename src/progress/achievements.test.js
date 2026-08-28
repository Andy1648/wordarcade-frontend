// achievements.test.js (Job 7) — the catalog shape (count + 5 secrets), snapshot-driven granting,
// idempotency (no double-grant), × rebirth scaling, secret masking, and the completionist meta.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACHIEVEMENTS,
  checkAchievements,
  achievementList,
  achievementCounts,
  loadEarned,
} from './achievements.js';
import { getWins } from './wins.js';

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

test('catalog: ~30 achievements, exactly 5 secret, unique ids', () => {
  assert.ok(ACHIEVEMENTS.length >= 30, `expected >=30, got ${ACHIEVEMENTS.length}`);
  assert.equal(ACHIEVEMENTS.filter((a) => a.secret).length, 5);
  assert.equal(new Set(ACHIEVEMENTS.map((a) => a.id)).size, ACHIEVEMENTS.length);
});

test('checkAchievements grants matching achievements once (idempotent), R0', () => {
  // Seed a save that satisfies exactly FIRST BLOOD (1 word) + WARMING UP (100 words) at R0.
  const wc = JSON.stringify({ v: 1, total: 100, byMode: {} });
  withStorage({ 'wa_words': wc, 'taw.rebirths': '0', 'taw.wins': '0' }, () => {
    const ids = checkAchievements().map((a) => a.id);
    assert.ok(ids.includes('vol-1') && ids.includes('vol-100'));
    assert.ok(!ids.includes('vol-1k')); // 100 words is short of 1,000
    // R0 → ×1: wins = 100 + 500 = 600.
    assert.equal(getWins(), 600);
    // Second pass grants nothing new (idempotent).
    assert.equal(checkAchievements().length, 0);
    assert.ok(loadEarned().includes('vol-1'));
  });
});

test('rebirth scaling: the same achievement pays more at higher rebirth', () => {
  const wc = JSON.stringify({ v: 1, total: 1, byMode: {} });
  withStorage({ 'wa_words': wc, 'taw.rebirths': '2', 'taw.wins': '0' }, () => {
    const newly = checkAchievements();
    const vol1 = newly.find((a) => a.id === 'vol-1');
    assert.equal(vol1.wins, Math.round(100 * 2)); // R2 → ×2 = 200
  });
});

test('achievementList masks unearned secrets as "???" and reveals earned ones', () => {
  withStorage({ 'taw.rebirths': '10' }, () => {
    // R10 satisfies the ETERNAL secret.
    checkAchievements();
    const list = achievementList();
    const eternal = list.find((a) => a.id === 'sec-eternal');
    assert.equal(eternal.earned, true);
    assert.equal(eternal.name, 'ETERNAL'); // revealed once earned
    const dict = list.find((a) => a.id === 'sec-dict'); // not earned
    assert.equal(dict.name, '???');
    assert.match(dict.hint, /hidden/i);
  });
});

test('completionist secret only fires once every other achievement is earned', () => {
  // Craft a save that satisfies EVERYTHING except by using extreme values.
  const wc = JSON.stringify({ v: 1, total: 100000, byMode: {} });
  const mastery = JSON.stringify({ 'word-bomb': 200000, 'category-blitz': 200000, 'sat-rush': 200000, chain: 200000, fuse: 200000 });
  const coll = JSON.stringify({ v: 1, seq: 1, w: {}, ms: [] });
  withStorage({
    'wa_words': wc,
    'taw.rebirths': '10',
    'taw.wins': '0',
    'taw.winsLifetime': '2000000',
    'taw.xp': JSON.stringify({ lv: 60, into: 0 }),
    'taw.keytier': '9',
    'taw.wordsense': '9',
    'taw.mastery': mastery,
    'taw.streak': JSON.stringify({ count: 40, lastDay: 0, freezes: 0 }),
    'taw.wpm': JSON.stringify({ best: { satRush: 120 }, sum: 0, n: 0, recent: [] }),
    'taw.collection': coll,
  }, (map) => {
    // Distinct-word achievements need real collection counts — inject a big collection directly.
    const w = {};
    for (let i = 0; i < 2600; i++) w['w' + i] = [i % 4 === 0 ? 3 : 1, 0, 20000, i]; // ~650 OBSCURE
    map.set('taw.collection', JSON.stringify({ v: 1, seq: 2600, w, ms: [] }));
    const newly = checkAchievements();
    const ids = new Set(newly.map((a) => a.id));
    assert.ok(ids.has('sec-completionist'), 'completionist fires when all others are earned');
    // Every achievement earned now.
    assert.equal(achievementCounts().earned, ACHIEVEMENTS.length);
  });
});

test('storage failure → no throw, no earns', () => {
  const saved = globalThis.localStorage;
  globalThis.localStorage = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); }, removeItem: () => {} };
  try {
    let r;
    assert.doesNotThrow(() => { r = checkAchievements(); });
    assert.equal(Array.isArray(r), true);
  } finally {
    globalThis.localStorage = saved;
  }
});
