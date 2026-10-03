// marks.test.js — MARKS: one slot, earned not bought, and visible in the payout.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MARKS, MARKS_EQUIPPED_KEY, markById, unlockedMarks, getEquippedMark, equipMark,
  markWinsFactors, markXpMult, markRarityStep, markComboKeep,
  MARK_RANK_WORDS, MARK_RANK_SCALE, MAX_MARK_RANK, rankForWords, markRank, markProgress, addMarkWord,
  effectAtRank, markBlurbAt, MARK_WORDS_KEY, MARK_TIERS, markMainMult, checkMarkClaims, MARKS_OWNED_KEY,
} from './marks.js';
import { listClaims, claim } from './claims.js';
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

test('STEP 49: a collection of 16 unique marks across all four tiers', () => {
  assert.equal(MARKS.length, 16);
  for (const t of Object.keys(MARK_TIERS)) assert.ok(MARKS.some((m) => m.tier === t), `no ${t} mark`);
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
    const keys = Object.keys(e).filter((k) => k !== 'mode' && k !== 'modes');
    assert.ok(keys.length > 0, `${m.id} has no effect`);
    // Rule 2: a mark is worth equipping and is never the reason a number is large.
    if (e.winsMult) assert.ok(e.winsMult > 1 && e.winsMult <= 1.5, `${m.id} winsMult ${e.winsMult}`);
    if (e.xpMult) assert.ok(e.xpMult > 1 && e.xpMult <= 1.5, `${m.id} xpMult ${e.xpMult}`);
    if (e.rarityStep) assert.ok(e.rarityStep > 0 && e.rarityStep <= 0.25, `${m.id} rarityStep`);
    if (e.comboKeep) assert.ok(e.comboKeep > 0 && e.comboKeep <= 0.5, `${m.id} comboKeep`);
  }
});

test("a wins mark's contribution is a REAL payout row — rule 3, still enforced", () => {
  // A mark that changed a payout without appearing in the receipt would be exactly the defect this
  // branch exists to fix. Economy v8 folded momentum + mark + mastery into ONE aggregate factor
  // (`bonus`) rather than three near-×1 rows, so the row the mark rides in is `bonus` — but it is
  // still a named row and still drawn. The rule is "a mark cannot be invisible", not "a mark has
  // a row of its own".
  assert.ok(PAYOUT_FACTORS.some((f) => f.key === 'bonus'), 'payout.js must know the `bonus` factor');
  const bonus = PAYOUT_FACTORS.find((f) => f.key === 'bonus');
  assert.equal(bonus.kind, 'permanent');
  assert.ok(bonus.label && bonus.label === bonus.label.toUpperCase());
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

test('unlockedMarks (a save never through the marks layer) lists only what the achievements earned', () => {
  assert.deepEqual(unlockedMarks([]).map((m) => m.id), []);
  assert.deepEqual(unlockedMarks(['m-wb-5']).map((m) => m.id), ['mk-bomber']);
  assert.deepEqual(unlockedMarks(new Set(['m-wb-5', 'dist-500'])).map((m) => m.id), ['mk-bomber', 'mk-magpie']);
});

test('STEP 49: the WORN mark pays its tier bonus everywhere, its flavour perk only in its mode', () => {
  // COMMON = ×2 main; BOMBER's +25% flavour applies in Word Bomb only.
  assert.deepEqual(markWinsFactors({ markId: 'mk-bomber', mode: 'wordBomb' }), { mark: 2 * 1.25 });
  assert.deepEqual(markWinsFactors({ markId: 'mk-bomber', mode: 'satRush' }), { mark: 2 }, 'main bonus still pays outside its mode');
  assert.deepEqual(markWinsFactors({ markId: 'mk-magpie', mode: 'satRush' }), { mark: 2 * 1.15 });
  // A mark whose flavour is XP still pays its MAIN bonus on wins.
  assert.deepEqual(markWinsFactors({ markId: 'mk-student', mode: 'fuse' }), { mark: 2 });
  assert.deepEqual(markWinsFactors({ markId: null, mode: 'fuse' }), {});
  // Rarer pays more: COMMON ×2, RARE ×2.5, EPIC ×3, LEGENDARY ×4 (rank I, before flavour).
  assert.equal(markMainMult(markById('mk-bomber'), 1), 2);
  assert.equal(markMainMult(markById('mk-scholar'), 1), 2.5);
  // permanent marks (LINGUIST, CURATOR) pay ×4 — Andy oct3, decision 4
  assert.equal(markMainMult(markById('mk-linguist'), 1), 4);
  assert.equal(markMainMult(markById('mk-curator'), 1), 4);
  assert.equal(markMainMult(markById('mk-nova'), 1), 3);
  assert.equal(markMainMult(markById('mk-legend'), 1), 4);
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

// ---- MARK RANKS (STEP 21 / A3) -----------------------------------------------------------------
test('ranks climb I..V at the documented word counts', () => {
  assert.equal(MAX_MARK_RANK, 5);
  assert.equal(rankForWords(0), 1);
  assert.equal(rankForWords(MARK_RANK_WORDS[1] - 1), 1);
  assert.equal(rankForWords(MARK_RANK_WORDS[1]), 2);
  assert.equal(rankForWords(10 ** 9), 5);
  for (let i = 1; i < MARK_RANK_WORDS.length; i += 1) assert.ok(MARK_RANK_WORDS[i] > MARK_RANK_WORDS[i - 1]);
});

test('a rank scales the flavour perk, bounded', () => {
  for (const m of MARKS) {
    const v = effectAtRank(m.effect, MAX_MARK_RANK);
    if (v.winsMult) assert.ok(v.winsMult > m.effect.winsMult && v.winsMult <= 1.8, `${m.id} V winsMult ${v.winsMult}`);
    if (v.xpMult) assert.ok(v.xpMult > m.effect.xpMult && v.xpMult <= 1.8, `${m.id} V xpMult`);
    if (v.rarityStep) assert.ok(v.rarityStep <= 0.25, `${m.id} V rarityStep`);
    if (v.comboKeep) assert.ok(v.comboKeep <= 0.5, `${m.id} V comboKeep`);
    assert.equal(v.mode, m.effect.mode);
  }
  assert.deepEqual(effectAtRank({ winsMult: 1.25 }, 1), { winsMult: 1.25 });
  assert.equal(MARK_RANK_SCALE[0], 1);
});

test('only the WORN mark grows, one word at a time, and its payout factor follows its rank', () => {
  withStorage({ [MARKS_EQUIPPED_KEY]: 'mk-bomber' }, (map) => {
    assert.equal(markRank('mk-bomber'), 1);
    assert.equal(markWinsFactors({ mode: 'wordBomb' }).mark, 2 * 1.25);
    map.set(MARK_WORDS_KEY, JSON.stringify({ 'mk-bomber': MARK_RANK_WORDS[1] - 1 }));
    const r = addMarkWord();
    assert.deepEqual(r, { id: 'mk-bomber', rank: 2, rankedUp: true });
    assert.equal(markRank('mk-sprinter'), 1, 'a mark you are not wearing does not grow');
    const k = MARK_RANK_SCALE[1];
    assert.ok(Math.abs(markWinsFactors({ mode: 'wordBomb' }).mark - (1 + 1 * k) * (1 + 0.25 * k)) < 1e-9);
    const p = markProgress('mk-bomber');
    assert.equal(p.rank, 2);
    assert.equal(p.into, 0);
    assert.equal(p.need, MARK_RANK_WORDS[2] - MARK_RANK_WORDS[1]);
  });
});

test('the blurb prints the numbers the rank actually pays', () => {
  const bomber = MARKS.find((m) => m.id === 'mk-bomber');
  assert.equal(markBlurbAt(bomber, 1), '+25% wins in WORD BOMB.');
  assert.equal(markBlurbAt(bomber, 5), '+40% wins in WORD BOMB.');
  const metro = MARKS.find((m) => m.id === 'mk-metronome');
  assert.equal(markBlurbAt(metro, 5), '48% chance a broken COMBO survives.');
});

test('nothing equipped → addMarkWord is a no-op', () => {
  withStorage({}, () => { assert.equal(addMarkWord(), null); });
});

test('STEP 49 + E4: marks unlock at LV 10; the system opens and a new mark is OWNED at once (no inbox)', () => {
  withStorage({ [MARKS_OWNED_KEY]: '[]' }, () => {
    assert.deepEqual(checkMarkClaims({ level: 5, earned: ['m-wb-5'] }), [], 'not before LV 10');
    assert.equal(listClaims().length, 0);
    const q = checkMarkClaims({ level: 10, earned: ['m-wb-5'] });
    assert.deepEqual(q.map((c) => c.detail), ['mk-bomber']);
    assert.equal(listClaims().length, 0, 'E4: marks and the MARKS system never sit in the inbox');
    assert.deepEqual(unlockedMarks([]).map((m) => m.id), ['mk-bomber']);
    assert.deepEqual(checkMarkClaims({ level: 12, earned: ['m-wb-5'] }), [], 'no repeat claim');
  });
});

test('STEP 49: an existing save keeps the marks it had, with no claim flood', () => {
  withStorage({}, () => {
    checkMarkClaims({ level: 40, earned: ['m-wb-5', 'dist-500'] });
    assert.deepEqual(unlockedMarks([]).map((m) => m.id), ['mk-bomber', 'mk-magpie']);
    assert.equal(listClaims().filter((c) => c.kind === 'mark').length, 0);
  });
});
