// mastery.test.js (Job 2) — per-mode mastery curve, level derivation, word crediting, the XP perk,
// the M50 cap, milestones, and storage-failure fallback. Pure, node --test.
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
  MASTERY_BASE,
  MASTERY_QUAD,
  MASTERY_MILESTONE_EVERY,
  isMasteryMilestone,
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

test('masteryNeed follows the v9 quadratic round(30 + 1.2×level²)', () => {
  assert.equal(masteryNeed(1), 31); // round(31.2)
  assert.equal(masteryNeed(2), 35); // round(34.8)
  assert.equal(masteryNeed(10), 150);
  assert.equal(masteryNeed(49), 2911); // the last step before the M50 cap
  for (let l = 1; l < MASTERY_MAX; l++) {
    assert.equal(masteryNeed(l), Math.round(MASTERY_BASE + MASTERY_QUAD * l * l), `need(${l})`);
  }
  // Garbage input reads as M1.
  assert.equal(masteryNeed(0), masteryNeed(1));
  assert.equal(masteryNeed(NaN), masteryNeed(1));
});

test('masteryNeed never gets cheaper per level, and grows only polynomially (no ×1.4 wall)', () => {
  for (let l = 1; l < MASTERY_MAX - 1; l++) {
    assert.ok(masteryNeed(l + 1) >= masteryNeed(l), `need(${l + 1}) >= need(${l})`);
  }
  // The whole bar fits in ~50k words of one mode; v8's geometric curve had 16 h+ gaps by M20.
  const total = masteryWordsToReach(MASTERY_MAX);
  assert.ok(total > 40_000 && total < 60_000, `words to M50 = ${total}`);
  assert.ok(masteryNeed(MASTERY_MAX - 1) < 100 * masteryNeed(1));
});

test('milestones land every 5th level and never at M1', () => {
  assert.equal(MASTERY_MILESTONE_EVERY, 5);
  assert.equal(isMasteryMilestone(1), false);
  assert.equal(isMasteryMilestone(4), false);
  assert.equal(isMasteryMilestone(5), true);
  assert.equal(isMasteryMilestone(MASTERY_MAX), true); // M50 pays
  assert.equal(isMasteryMilestone(NaN), false);
  const count = Array.from({ length: MASTERY_MAX }, (_, i) => i + 1).filter(isMasteryMilestone).length;
  assert.equal(count, MASTERY_MAX / MASTERY_MILESTONE_EVERY);
});

test('masteryFromWords derives level + progress and keeps going past M50 (no dead end)', () => {
  assert.equal(MASTERY_MAX, 50);
  const toM2 = masteryNeed(1);
  assert.deepEqual(masteryFromWords(0).level, 1);
  assert.equal(masteryFromWords(toM2 - 1).level, 1); // one short of M2
  assert.equal(masteryFromWords(toM2).level, 2); // exactly M2
  const at2 = masteryFromWords(toM2);
  assert.equal(at2.intoLevel, 0);
  assert.equal(at2.need, masteryNeed(2));
  assert.equal(masteryFromWords(masteryWordsToReach(MASTERY_MAX)).level, MASTERY_MAX);
  assert.equal(masteryFromWords(masteryWordsToReach(MASTERY_MAX) - 1).level, MASTERY_MAX - 1);
  // Past the M50 goal the bar still has a next level and a cost — never "MAXED".
  const past = masteryFromWords(masteryWordsToReach(MASTERY_MAX) + masteryNeed(MASTERY_MAX));
  assert.equal(past.level, MASTERY_MAX + 1);
  assert.equal(past.maxed, false);
  assert.ok(past.need > 0);
  const huge = masteryFromWords(10 ** 9);
  assert.ok(huge.level > 1000 && !huge.maxed, `1e9 words → M${huge.level}`);
});

test('masteryWordsToReach is the cumulative sum of the curve', () => {
  assert.equal(masteryWordsToReach(1), 0);
  assert.equal(masteryWordsToReach(2), masteryNeed(1));
  assert.equal(masteryWordsToReach(3), masteryNeed(1) + masteryNeed(2));
});

test('addMasteryWord increments the mode and reports level-ups; unknown mode is a no-op', () => {
  withStorage({}, () => {
    let res;
    const toM2 = masteryNeed(1);
    for (let i = 0; i < toM2 - 1; i++) res = addMasteryWord('fuse');
    assert.equal(res.level, 1);
    assert.equal(res.leveledUp, false);
    res = addMasteryWord('fuse'); // the masteryNeed(1)-th word → M2
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
    for (let i = 0; i < masteryNeed(1); i++) addMasteryWord('chain'); // → M2
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
