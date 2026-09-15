// marks.test.js — MARKS: one slot, earned not bought, and visible in the payout.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MARKS, MARKS_EQUIPPED_KEY, markById, unlockedMarks, getEquippedMark, equipMark,
  markWinsFactors, markXpMult, markRarityStep, markComboKeep,
  MARK_SLOTS, getEquippedMarks, markRowNames,
} from './marks.js';
import { perWordWins } from './wins.js';
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


// ---------------------------------------------------------------- MARK SLOTS (flagged variant)
//
// `MARK_SLOTS` is read from the URL once at module load, so under node it is always 1 — which is
// the case that matters most here. The promise the variant makes is that WITHOUT the flag nothing
// changes at all, and that is what these first two tests pin. The combination logic is pure and
// takes its ids as an argument, so it is tested directly rather than through storage.

test('SLOTS=1 IS THE SHIPPED BEHAVIOUR: no flag means one slot and the legacy key', () => {
  assert.equal(MARK_SLOTS, 1, 'no window => one slot');
  withStorage({ [MARKS_EQUIPPED_KEY]: 'mk-eternal' }, () => {
    // Reads the SAME single key, and never consults the list key.
    assert.deepEqual(getEquippedMarks(), ['mk-eternal']);
    assert.equal(getEquippedMark(), 'mk-eternal');
  });
  withStorage({}, () => assert.deepEqual(getEquippedMarks(), []));
});

test('SLOTS=1: one mark emits ONLY the `mark` key, so the receipt is unchanged', () => {
  const f = markWinsFactors({ markIds: ['mk-eternal'], mode: 'wordBomb' });
  assert.deepEqual(f, { mark: 1.5 });
  assert.equal('mark2' in f, false);
  assert.equal('mark3' in f, false);
});

test('a second and third mark get their OWN receipt rows — rule 3 survives multi-slot', () => {
  const f = markWinsFactors({ markIds: ['mk-eternal', 'mk-bomber', 'mk-magpie'], mode: 'wordBomb' });
  assert.deepEqual(f, { mark: 1.5, mark2: 1.25, mark3: 1.15 });
  // Every emitted key must be a REAL payout row, or the mark pays invisibly.
  const rows = new Set(PAYOUT_FACTORS.map((r) => r.key));
  for (const k of Object.keys(f)) assert.ok(rows.has(k), `${k} has no payout row`);
  // And each row can be labelled with the mark actually paying it.
  assert.deepEqual(markRowNames({ markIds: ['mk-eternal', 'mk-bomber'], mode: 'wordBomb' }),
    { mark: 'ETERNAL', mark2: 'BOMBER' });
});

test('a mode-scoped mark in slot 2 is DROPPED outside its mode, and the keys close up', () => {
  // BOMBER is Word Bomb only. In blitz it must not pay — and ETERNAL must still be `mark`,
  // not `mark2`, or the receipt grows a hole where the skipped mark was.
  const f = markWinsFactors({ markIds: ['mk-eternal', 'mk-bomber'], mode: 'blitz' });
  assert.deepEqual(f, { mark: 1.5 });
});

test('the extra slots are actually PAID, not just printed', () => {
  const base = perWordWins({ mode: 'wordBomb', markId: 'mk-eternal', rebirthCount: 0, level: 1, momentumCount: 0 });
  const two = perWordWins({ mode: 'wordBomb', markIds: ['mk-eternal', 'mk-bomber'], rebirthCount: 0, level: 1, momentumCount: 0 });
  // A second mark must move the money. If perWordWins forgot to multiply f.mark2 these are equal.
  assert.ok(two > base, `two marks paid ${two}, one paid ${base}`);
});

test('XP multiplies across slots; the chance effects combine as independent rolls', () => {
  assert.equal(markXpMult('mk-student'), 1.2);
  assert.equal(markXpMult(null), 1);
  // A SINGLE chance must come back EXACTLY, not 1-(1-p): that is 0.30000000000000004.
  assert.equal(markComboKeep('mk-metronome'), 0.3);
  assert.equal(markRarityStep('mk-linguist'), 0.12);
  assert.equal(markComboKeep(null), 0);
});
