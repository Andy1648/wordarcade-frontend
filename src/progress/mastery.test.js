// mastery.test.js (Job 2) — per-mode mastery curve, level derivation, word crediting, the XP perk,
// the M20 cap, and storage-failure fallback. Pure, node --test.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  masteryNeed,
  masteryFromWords,
  masteryWordsToReach,
  addMasteryWord,
  masteryState,
  masteryXpMult,
  MASTERY_MAX,
  MASTERY_XP_STEP,
} from './mastery.js';

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

test('masteryNeed follows 50×1.4^level', () => {
  assert.equal(masteryNeed(1), Math.round(50 * 1.4)); // 70
  assert.equal(masteryNeed(2), Math.round(50 * 1.4 ** 2)); // 98
  assert.equal(masteryNeed(5), Math.round(50 * 1.4 ** 5)); // 268
});

test('masteryFromWords derives level + progress and caps at M20', () => {
  assert.deepEqual(masteryFromWords(0).level, 1);
  assert.equal(masteryFromWords(69).level, 1); // one short of M2 (need(1)=70)
  assert.equal(masteryFromWords(70).level, 2); // exactly M2
  const at2 = masteryFromWords(70);
  assert.equal(at2.intoLevel, 0);
  assert.equal(at2.need, masteryNeed(2));
  // Astronomically many words → clamped to the M20 cap, no further need.
  const maxed = masteryFromWords(10 ** 9);
  assert.equal(maxed.level, MASTERY_MAX);
  assert.equal(maxed.maxed, true);
  assert.equal(maxed.need, 0);
  assert.equal(maxed.frac, 1);
});

test('masteryWordsToReach is the cumulative sum of the curve', () => {
  assert.equal(masteryWordsToReach(1), 0);
  assert.equal(masteryWordsToReach(2), masteryNeed(1));
  assert.equal(masteryWordsToReach(3), masteryNeed(1) + masteryNeed(2));
});

test('addMasteryWord increments the mode and reports level-ups; unknown mode is a no-op', () => {
  withStorage({}, () => {
    let res;
    for (let i = 0; i < 69; i++) res = addMasteryWord('fuse');
    assert.equal(res.level, 1);
    res = addMasteryWord('fuse'); // 70th word → M2
    assert.equal(res.level, 2);
    assert.equal(res.leveledUp, true);
    assert.equal(masteryState('fuse').level, 2);
    // Independent per mode.
    assert.equal(masteryState('chain').level, 1);
    // Unknown mode never throws / never records.
    assert.deepEqual(addMasteryWord('nope'), { level: 1, leveledUp: false });
  });
});

test('masteryXpMult is 1 at M1 and +3%/level above it', () => {
  withStorage({}, () => {
    assert.equal(masteryXpMult('chain'), 1);
    for (let i = 0; i < 70; i++) addMasteryWord('chain'); // → M2
    assert.equal(masteryState('chain').level, 2);
    assert.ok(Math.abs(masteryXpMult('chain') - (1 + MASTERY_XP_STEP)) < 1e-9);
    assert.equal(masteryXpMult('unknown-mode'), 1);
  });
});

test('storage failure → M1 everywhere, never throws', () => {
  const saved = globalThis.localStorage;
  globalThis.localStorage = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => {} };
  try {
    assert.doesNotThrow(() => addMasteryWord('fuse'));
    assert.equal(masteryState('fuse').level, 1);
    assert.equal(masteryXpMult('fuse'), 1);
  } finally {
    globalThis.localStorage = saved;
  }
});
