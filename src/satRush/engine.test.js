// engine.test.js — the rules of SAT RUSH. These tests matter more than the
// implementation: every later step builds on this behaviour, so the interaction
// cases (revenant x deep cut, silver x revenant, the flip x stage-2 entry) are
// covered explicitly, not just each rule in isolation.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSatRushEngine,
  curveTier,
  isFlipped,
  revealOrder,
  DEFAULT_CONFIG,
  REVEAL_META,
  REVEAL_SENTENCE,
  REVEAL_GLOSS,
  REVEAL_ROOT,
  REVEAL_FIRST_LETTER,
} from './engine.js';

// Identity RNG: floor(0.9999999 * (i+1)) === i, so the Fisher-Yates shuffle is a
// no-op and drawWord() scans the pool in the exact order we pass it. Word
// selection is therefore fully deterministic.
const IDENTITY_RNG = () => 0.9999999;

// A generous synthetic pool: `perTier` words of each tier 1..5, distinct names.
// Lengths are read from state in assertions, never hard-coded.
function makePool(perTier = 12) {
  const rows = [];
  for (let t = 1; t <= 5; t++) {
    for (let i = 0; i < perTier; i++) {
      const word = `x${t}${String.fromCharCode(97 + i)}`;
      rows.push({
        word,
        pos: 'n',
        tier: t,
        gloss: `def ${word}`,
        context: 'use ___ now',
        root: { morpheme: 'r-', meaning: 'm', cousins: ['ca', 'cb'] },
        alts: [],
      });
    }
  }
  return rows;
}

function engine(overrides = {}) {
  return createSatRushEngine({
    words: makePool(overrides.perTier ?? 12),
    rng: IDENTITY_RNG,
    config: overrides.config ?? {},
  });
}

// Fast-forward `n` slots without resolving (heat/lives untouched) — used to reach
// a specific wordNumber in isolation from scoring side effects.
function skipTo(eng, targetWordNumber) {
  while (eng.getState().wordNumber < targetWordNumber) eng.nextWord();
  return eng.getState().current;
}

// Clear `n` fresh words at stage 0 (each raises heat by 1).
function clearN(eng, n) {
  const results = [];
  for (let i = 0; i < n; i++) {
    eng.nextWord();
    results.push(eng.submitCorrect());
  }
  return results;
}

// --- multiplier decay ------------------------------------------------------

test('multiplier decays 5-4-3-2-1 across the stages and clamps at the last', () => {
  const eng = engine();
  eng.nextWord(); // fresh tier-1, heat 0, no revenant
  const seen = [eng.currentMultiplier()];
  for (let i = 0; i < 6; i++) {
    eng.advanceStage();
    seen.push(eng.currentMultiplier());
  }
  // 5,4,3,2,1 then clamped at 1 for the extra advances.
  assert.deepEqual(seen, [5, 4, 3, 2, 1, 1, 1]);
});

// --- the tier-4/5 stage flip ----------------------------------------------

test('the sentence is always stage 1; tiers 4-5 swap gloss<->root (root arrives first)', () => {
  assert.equal(isFlipped(3), false);
  assert.equal(isFlipped(4), true);
  // Tiers 1-3: definition (gloss) before morphology (root).
  assert.deepEqual(revealOrder(3), [
    REVEAL_META,
    REVEAL_SENTENCE,
    REVEAL_GLOSS,
    REVEAL_ROOT,
    REVEAL_FIRST_LETTER,
  ]);
  // Tiers 4-5: root before gloss, so the definition is the LAST thing to land.
  assert.deepEqual(revealOrder(5), [
    REVEAL_META,
    REVEAL_SENTENCE,
    REVEAL_ROOT,
    REVEAL_GLOSS,
    REVEAL_FIRST_LETTER,
  ]);
});

test('a null-root high-tier word does NOT flip, so stage 2 is never empty', () => {
  // With a root, tier 5 flips (root before gloss)...
  assert.equal(isFlipped(5, true), true);
  assert.deepEqual(revealOrder(5, true), [
    REVEAL_META,
    REVEAL_SENTENCE,
    REVEAL_ROOT,
    REVEAL_GLOSS,
    REVEAL_FIRST_LETTER,
  ]);
  // ...but with no morphology to front-load it stays in base order (gloss @ 2).
  assert.equal(isFlipped(5, false), false);
  assert.deepEqual(revealOrder(5, false), [
    REVEAL_META,
    REVEAL_SENTENCE,
    REVEAL_GLOSS,
    REVEAL_ROOT,
    REVEAL_FIRST_LETTER,
  ]);

  // Grounded: a real tier-5 word with root:null keeps the gloss at stage 2.
  const rootless = [
    {
      word: 'aaaaa',
      pos: 'adj',
      tier: 5,
      gloss: 'g',
      context: 'use ___ now',
      root: null,
      alts: [],
    },
  ];
  const eng = createSatRushEngine({ words: rootless, rng: IDENTITY_RNG });
  const cur = eng.nextWord();
  assert.equal(cur.reveals[2], REVEAL_GLOSS);
});

// --- silver tongue doubling -----------------------------------------------

test('the clear that REACHES heat cap IS doubled, and so is the next one', () => {
  const eng = engine();
  const results = clearN(eng, 5); // heat 0 -> 5
  // 5th clear reaches the cap and is itself doubled (score spike + chrome on the
  // same frame).
  assert.equal(results[4].breakdown.silver, true);
  assert.equal(results[4].breakdown.effectiveMultiplier, 10); // stage 0 (5x) * silver 2
  assert.equal(results[4].gained, Math.round(results[4].breakdown.base * 10));
  assert.equal(eng.getState().heat, DEFAULT_CONFIG.heatCap);
  assert.equal(eng.getState().silverTongue, true);

  // 6th clear: heat already at cap -> still doubled.
  eng.nextWord();
  assert.equal(eng.currentMultiplier(), 10); // stage 0 (5x) * silver 2
  const r = eng.submitCorrect();
  assert.equal(r.breakdown.silver, true);
  assert.equal(r.breakdown.effectiveMultiplier, 10);
  assert.equal(r.gained, Math.round(r.breakdown.base * 10));
});

test('earning silver banks a doubled clear even if the next word is missed', () => {
  const eng = engine();
  const res = clearN(eng, 5); // the 5th clear both earns silver AND is doubled
  assert.equal(res[4].breakdown.silver, true);
  const bankedAfterSilver = eng.getState().score;

  // Immediately miss the next word: heat/silver break, but the doubled clear the
  // player already earned stays banked — silver is never "earned for nothing".
  eng.nextWord();
  eng.miss();
  assert.equal(eng.getState().silverTongue, false);
  assert.equal(eng.getState().heat, 0);
  assert.equal(eng.getState().score, bankedAfterSilver);
});

// --- revenant: double multiplier, stage-2 entry, requeue -------------------

test('a revenant enters at stage 2, pays double, and is requeued on a re-miss', () => {
  const eng = engine();
  eng.nextWord(); // word 1, fresh tier 1
  const missWord = eng.getState().current.word;
  const m = eng.miss();
  assert.equal(m.requeuedFor, 1 + DEFAULT_CONFIG.revenantOffset); // 7
  assert.equal(m.missCount, 1);

  // Fast-forward to slot 7 (heat stays 0, isolating the revenant doubling).
  const cur = skipTo(eng, 7);
  assert.equal(eng.getState().wordNumber, 7);
  assert.equal(cur.isRevenant, true);
  assert.equal(cur.word, missWord); // same word came back
  assert.equal(cur.stage, DEFAULT_CONFIG.revenantEntryStage); // 2
  assert.equal(eng.currentMultiplier(), 3 * 2); // stage-2 base 3x * revenant 2

  // The revenant enters with sentence + gloss already visible (+ meta).
  const types = new Set(eng.visibleReveals().map((r) => r.type));
  assert.deepEqual(types, new Set([REVEAL_META, REVEAL_SENTENCE, REVEAL_GLOSS]));

  // Miss it a SECOND time -> requeued again for now+6, missCount 2.
  const m2 = eng.miss();
  assert.equal(m2.missCount, 2);
  assert.equal(m2.requeuedFor, 7 + DEFAULT_CONFIG.revenantOffset); // 13
  assert.equal(eng.getState().pendingRevenants, 1);
});

// --- deep-cut cadence ------------------------------------------------------

test('deep cuts land on every 10th word (10/20/30), forced tier 5, slower cadence', () => {
  const eng = engine({ perTier: 20 });
  const deepSlots = [];
  for (let n = 1; n <= 30; n++) {
    const cur = eng.nextWord();
    if (cur && cur.isDeepCut) deepSlots.push(n);
  }
  assert.deepEqual(deepSlots, [10, 20, 30]);

  // Inspect slot 30's deep cut directly.
  const eng2 = engine({ perTier: 20 });
  const at30 = skipTo(eng2, 30);
  assert.equal(at30.isDeepCut, true);
  assert.equal(at30.tier, 5); // forced regardless of the curve (curveTier(30)=4)
  assert.equal(
    eng2.stageIntervalMs(),
    Math.round(DEFAULT_CONFIG.stageIntervalMs * DEFAULT_CONFIG.deepCutIntervalScale)
  );
});

// --- heat reset ------------------------------------------------------------

test('any miss zeroes heat, breaks silver, and resets the streak', () => {
  const eng = engine();
  clearN(eng, 5); // heat 5, silver on, streak 5
  assert.equal(eng.getState().silverTongue, true);
  assert.equal(eng.getState().bestStreak, 5);

  eng.nextWord();
  const m = eng.miss();
  assert.equal(eng.getState().heat, 0);
  assert.equal(eng.getState().silverTongue, false);
  assert.equal(eng.getState().currentStreak, 0);
  assert.equal(eng.getState().bestStreak, 5); // best is remembered
  assert.equal(m.gameOver, false); // still had lives

  // The next clear is NOT doubled (silver truly broke).
  eng.nextWord();
  const r = eng.submitCorrect();
  assert.equal(r.breakdown.silver, false);
});

// --- tier curve boundaries -------------------------------------------------

test('tier curve steps up exactly at 8/16/24/32', () => {
  const pairs = [
    [1, 1],
    [7, 1],
    [8, 2],
    [15, 2],
    [16, 3],
    [23, 3],
    [24, 4],
    [31, 4],
    [32, 5],
    [100, 5],
  ];
  for (const [n, tier] of pairs) assert.equal(curveTier(n), tier, `wordNumber ${n}`);
});

// --- score never negative --------------------------------------------------

test('wrong keystrokes bleed score but never below zero, and reveal every 3rd', () => {
  const eng = engine();
  eng.nextWord();
  eng.submitCorrect(); // bank some score on word 1
  eng.nextWord(); // word 2 is unresolved -> keystrokes apply to it
  const startScore = eng.getState().score;
  assert.ok(startScore > 0);

  const k1 = eng.registerWrongKeystroke();
  assert.equal(k1.penalty, -2);
  assert.equal(k1.revealedLetter, false);
  const k2 = eng.registerWrongKeystroke();
  assert.equal(k2.revealedLetter, false);
  const k3 = eng.registerWrongKeystroke();
  assert.equal(k3.revealedLetter, true); // every 3rd
  assert.equal(k3.penalty, -2 + -8); // -10

  // Keep bleeding well past zero — it must clamp, never go negative.
  for (let i = 0; i < 60; i++) {
    const r = eng.registerWrongKeystroke();
    assert.ok(r.score >= 0);
  }
  assert.equal(eng.getState().score, 0);
});

// === INTERACTION CASES =====================================================

test('INTERACTION: a revenant that is ALSO the 10th word stacks deep-cut + revenant', () => {
  const eng = engine();
  // Miss word 4 -> revenant due at word 10 (a deep-cut slot).
  skipTo(eng, 4);
  eng.miss();
  const cur = skipTo(eng, 10);

  assert.equal(cur.isRevenant, true);
  assert.equal(cur.isDeepCut, true); // it landed on the deep-cut slot
  assert.equal(cur.tier, 1); // a revenant keeps its own tier (word 4 was tier 1)
  assert.equal(cur.stage, 2);
  assert.equal(eng.getState().heat, 0); // isolated from silver
  assert.equal(eng.currentMultiplier(), 3 * 2); // stage-2 3x * revenant 2

  const r = eng.submitCorrect();
  const base = r.breakdown.base; // 1*10 + len*2
  assert.equal(r.breakdown.revenant, true);
  assert.equal(r.breakdown.deepCutBonus, DEFAULT_CONFIG.deepCutBonus);
  assert.equal(r.breakdown.effectiveMultiplier, 6);
  // Revenant doubling AND the flat deep-cut bonus both applied.
  assert.equal(r.gained, Math.round(base * 6) + DEFAULT_CONFIG.deepCutBonus);
});

test('INTERACTION: silver tongue active on a revenant applies BOTH doublings', () => {
  const eng = engine();
  eng.nextWord(); // word 1
  eng.miss(); // revenant due at 7
  clearN(eng, 5); // words 2..6 -> heat reaches cap at word 6, silver on
  assert.equal(eng.getState().wordNumber, 6);
  assert.equal(eng.getState().silverTongue, true);

  const cur = eng.nextWord(); // word 7 = the revenant, heat at cap
  assert.equal(cur.isRevenant, true);
  assert.equal(cur.stage, 2);
  // stage-2 base 3 * silver 2 * revenant 2 = 12
  assert.equal(eng.currentMultiplier(), 12);
  const r = eng.submitCorrect();
  assert.equal(r.breakdown.silver, true);
  assert.equal(r.breakdown.revenant, true);
  assert.equal(r.breakdown.effectiveMultiplier, 12);
  assert.equal(r.gained, Math.round(r.breakdown.base * 12));
});

test('INTERACTION: a miss on a deep cut costs a life, zeroes heat, and requeues', () => {
  const eng = engine({ perTier: 20 });
  clearN(eng, 3); // heat 3 mid-run
  assert.equal(eng.getState().heat, 3);
  const cut = skipTo(eng, 10);
  assert.equal(cut.isDeepCut, true);
  assert.equal(cut.tier, 5);

  const livesBefore = eng.getState().lives;
  const m = eng.miss();
  assert.equal(eng.getState().lives, livesBefore - 1);
  assert.equal(eng.getState().heat, 0); // heat broke mid-run
  assert.equal(eng.getState().silverTongue, false);
  assert.equal(m.requeuedFor, 10 + DEFAULT_CONFIG.revenantOffset); // 16
});

test('INTERACTION: under the gloss<->root flip, a t5 revenant re-enters HARDER than a t3', () => {
  // The stage-2 entry SET now DIFFERS by tier (this is the whole point of moving
  // the flip to gloss<->root): a low-tier revenant re-enters with the definition
  // visible; a high-tier one re-enters with the ROOT and NO definition.
  const setAt = (tier, stage) => new Set(revealOrder(tier).slice(0, stage + 1));
  assert.deepEqual(setAt(3, 2), new Set([REVEAL_META, REVEAL_SENTENCE, REVEAL_GLOSS]));
  assert.deepEqual(setAt(5, 2), new Set([REVEAL_META, REVEAL_SENTENCE, REVEAL_ROOT]));
  assert.ok(!setAt(5, 2).has(REVEAL_GLOSS)); // the hard part: no definition on entry
  assert.ok(setAt(5, 2).has(REVEAL_ROOT)); // morphology instead

  // Grounded in the engine: a real tier-5 revenant (from a missed deep cut)
  // enters at stage 2 with sentence + root and NO gloss — harder than a tier-3
  // revenant's sentence + gloss.
  const eng = engine({ perTier: 20 });
  const cut = skipTo(eng, 10); // fresh deep cut, forced tier 5
  assert.equal(cut.tier, 5);
  eng.miss(); // tier-5 revenant due at 16
  const rev = skipTo(eng, 16);
  assert.equal(rev.tier, 5);
  assert.equal(rev.isRevenant, true);
  assert.equal(rev.stage, 2);
  const types = new Set(eng.visibleReveals().map((r) => r.type));
  assert.deepEqual(types, new Set([REVEAL_META, REVEAL_SENTENCE, REVEAL_ROOT]));
  assert.ok(!types.has(REVEAL_GLOSS));
});

// --- alt half credit & results --------------------------------------------

test('an alt clear is half credit (bonus included) and reports the real word', () => {
  const eng = engine({ perTier: 20 });
  const cut = skipTo(eng, 10); // deep cut, tier 5, stage will be 0 after skip? no:
  // skipTo used nextWord (fresh), so stage 0; deep cut bonus applies on clear.
  assert.equal(cut.isDeepCut, true);
  const full = eng.currentMultiplier(); // stage 0 -> 5 (heat 0)
  assert.equal(full, 5);
  const r = eng.submitCorrect({ viaAlt: true });
  const base = r.breakdown.base;
  const expectedFull = base * 5 + DEFAULT_CONFIG.deepCutBonus;
  assert.equal(r.gained, Math.round(expectedFull * 0.5));
  assert.equal(r.viaAlt, true);
  assert.equal(r.actualWord, cut.word);
});

test('results(): avg ante is the mean clear MULTIPLIER and hardest word is the top tier', () => {
  const eng = engine({ perTier: 20 });
  // Clear one word at stage 0 (5x) and one at stage 2 (3x).
  eng.nextWord();
  eng.submitCorrect(); // stage 0 -> 5x
  eng.nextWord();
  eng.advanceStage();
  eng.advanceStage();
  eng.submitCorrect(); // stage 2 -> 3x
  // A tier-5 deep cut cleared at stage 0 (5x) -> becomes the hardest word.
  skipTo(eng, 10);
  eng.submitCorrect();

  const res = eng.results();
  assert.equal(res.cleared, 3);
  // mean of the base multipliers 5, 3, 5 — higher means answered earlier.
  assert.equal(res.avgAnte, (5 + 3 + 5) / 3);
  assert.equal(res.hardestWord.tier, 5);
  assert.equal(res.runLog.length, 3);
  assert.ok(res.runLog.every((e) => e.ok));
});

test('bestStreak is the longest CONSECUTIVE clear run, not the total cleared', () => {
  // clear 3, miss, clear 5, miss, clear 6 -> 14 cleared, but the best run is 6.
  const eng = engine({ perTier: 30 });
  const runs = [3, 5, 6];
  runs.forEach((n, i) => {
    for (let k = 0; k < n; k++) {
      eng.nextWord();
      eng.submitCorrect();
    }
    if (i < runs.length - 1) {
      eng.nextWord();
      eng.miss();
    }
  });
  const res = eng.results();
  assert.equal(res.cleared, 14);
  assert.equal(res.bestStreak, 6); // NOT 14
});

test('runLog records each word outcome in order (clear / miss)', () => {
  const eng = engine();
  eng.nextWord();
  eng.submitCorrect(); // clear
  eng.nextWord();
  eng.miss(); // miss
  eng.nextWord();
  eng.submitCorrect(); // clear
  const log = eng.results().runLog;
  assert.deepEqual(
    log.map((e) => e.ok),
    [true, false, true]
  );
});

test('game over after three misses; nextWord then returns null', () => {
  const eng = engine();
  for (let i = 0; i < 3; i++) {
    eng.nextWord();
    eng.miss();
  }
  assert.equal(eng.getState().gameOver, true);
  assert.equal(eng.getState().lives, 0);
  assert.equal(eng.nextWord(), null);
});
