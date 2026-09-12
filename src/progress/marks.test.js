// marks.test.js — MARKS: one slot, earned not bought, and visible in the payout.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MARKS, MARKS_EQUIPPED_KEY, markById, unlockedMarks, getEquippedMark, equipMark,
  markWinsFactors, markXpMult, markRarityStep, markComboKeep,
} from './marks.js';
import { ACHIEVEMENTS } from './achievements.js';
import { PAYOUT_FACTORS } from './payout.js';

function withStorage(seed, fn) {
  const map = new Map(Object.entries(seed || {}));
  const saved = globalThis.localStorage;
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

test('there are 6-8 marks and every one is unique', () => {
  assert.ok(MARKS.length >= 6 && MARKS.length <= 8, `${MARKS.length} marks`);
  assert.equal(new Set(MARKS.map((m) => m.id)).size, MARKS.length);
  assert.equal(new Set(MARKS.map((m) => m.name)).size, MARKS.length);
});

test('EVERY mark is unlocked by a REAL achievement — no dead mark nobody can earn', () => {
  // The whole point of a mark is that it is the standing reward for an achievement. A `from` that
  // matches no achievement id is a mark that can never be obtained, and nothing else in the app
  // would ever tell us.
  const ids = new Set(ACHIEVEMENTS.map((a) => a.id));
  for (const m of MARKS) assert.ok(ids.has(m.from), `${m.id} points at missing achievement ${m.from}`);
});

test('every mark has an effect, and every effect is a SMALL one', () => {
  for (const m of MARKS) {
    assert.ok(m.blurb && m.icon && m.name, m.id);
    const e = m.effect || {};
    const keys = Object.keys(e).filter((k) => k !== 'mode');
    assert.ok(keys.length > 0, `${m.id} has no effect`);
    // Rule 2: a mark is worth equipping and is never the reason a number is large.
    if (e.winsMult) assert.ok(e.winsMult > 1 && e.winsMult <= 1.5, `${m.id} winsMult ${e.winsMult}`);
    if (e.xpMult) assert.ok(e.xpMult > 1 && e.xpMult <= 1.5, `${m.id} xpMult ${e.xpMult}`);
    if (e.rarityStep) assert.ok(e.rarityStep > 0 && e.rarityStep <= 0.25, `${m.id} rarityStep`);
    if (e.comboKeep) assert.ok(e.comboKeep > 0 && e.comboKeep <= 0.5, `${m.id} comboKeep`);
  }
});

test("a wins mark's factor key is a REAL payout row — rule 3, enforced", () => {
  // A mark that changed a payout without appearing in the receipt would be exactly the defect this
  // branch exists to fix. markWinsFactors emits `mark`, so `mark` has to be a known factor.
  assert.ok(PAYOUT_FACTORS.some((f) => f.key === 'mark'), 'payout.js must know the `mark` factor');
});

test('ONE SLOT: equipping replaces, and an un-equip is allowed', () => {
  const earned = ['m-wb-5', 'lv-15'];
  withStorage({}, () => {
    assert.equal(getEquippedMark(), null);
    equipMark('mk-bomber', earned);
    assert.equal(getEquippedMark(), 'mk-bomber');
    equipMark('mk-student', earned);
    assert.equal(getEquippedMark(), 'mk-student', 'the second equip REPLACES the first');
    equipMark(null, earned);
    assert.equal(getEquippedMark(), null, 'an empty slot is a legitimate choice');
  });
});

test('a mark you have not earned cannot be equipped, even by hand-editing storage', () => {
  withStorage({}, () => {
    equipMark('mk-eternal', ['m-wb-5']); // eternal comes from sec-eternal, not earned
    assert.equal(getEquippedMark(), null);
  });
  // A storage value for a mark that does not exist reads as nothing, never as a crash.
  withStorage({ [MARKS_EQUIPPED_KEY]: 'mk-nonsense' }, () => {
    assert.equal(getEquippedMark(), null);
  });
});

test('unlockedMarks takes an array or a Set and lists only what the achievements earned', () => {
  assert.deepEqual(unlockedMarks([]).map((m) => m.id), []);
  assert.deepEqual(unlockedMarks(['m-wb-5']).map((m) => m.id), ['mk-bomber']);
  assert.deepEqual(unlockedMarks(new Set(['m-wb-5', 'dist-500'])).map((m) => m.id), ['mk-bomber', 'mk-magpie']);
});

test('a MODE-scoped mark pays in its mode and nowhere else', () => {
  assert.deepEqual(markWinsFactors({ markId: 'mk-bomber', mode: 'wordBomb' }), { mark: 1.25 });
  assert.deepEqual(markWinsFactors({ markId: 'mk-bomber', mode: 'satRush' }), {}, 'not its mode');
  // A global mark pays everywhere.
  assert.deepEqual(markWinsFactors({ markId: 'mk-magpie', mode: 'satRush' }), { mark: 1.15 });
  // A mark with no wins effect contributes no wins row at all (rather than a ×1 one).
  assert.deepEqual(markWinsFactors({ markId: 'mk-student', mode: 'fuse' }), {});
  assert.deepEqual(markWinsFactors({ markId: null, mode: 'fuse' }), {});
});

test('the non-wins effects read as neutral when nothing relevant is equipped', () => {
  assert.equal(markXpMult('mk-student'), 1.2);
  assert.equal(markXpMult('mk-bomber'), 1);
  assert.equal(markXpMult(null), 1);
  assert.equal(markRarityStep('mk-linguist'), 0.12);
  assert.equal(markRarityStep('mk-bomber'), 0);
  assert.equal(markComboKeep('mk-metronome'), 0.3);
  assert.equal(markComboKeep(null), 0);
});

test('a blocked store never throws and simply never remembers', () => {
  const saved = globalThis.localStorage;
  globalThis.localStorage = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
    removeItem() { throw new Error('blocked'); },
  };
  try {
    assert.equal(getEquippedMark(), null);
    assert.doesNotThrow(() => equipMark('mk-bomber', ['m-wb-5']));
    assert.doesNotThrow(() => equipMark(null));
  } finally {
    if (saved === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = saved;
  }
});

test('markById is the only lookup, and it is guarded', () => {
  assert.equal(markById('mk-bomber').name, 'BOMBER');
  assert.equal(markById('nope'), null);
  assert.equal(markById(undefined), null);
});
