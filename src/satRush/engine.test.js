// engine.test.js — the rules of SAT RUSH. These tests matter more than the
// implementation: every later step builds on this behaviour, so the interaction
// cases (revenant x deep cut, silver x revenant, the 3-stage reveal schedule) are
// covered explicitly, not just each rule in isolation.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSatRushEngine,
  curveTier,
  effectiveStageIntervalMs,
  lineupWindowMs,
  revealSchedule,
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

// Build an engine seeded with a `recent` set (cross-run memory). Same
// deterministic pool + identity RNG as engine(), so pool order == makePool order.
function engineWithRecent(recent, overrides = {}) {
  return createSatRushEngine({
    words: makePool(overrides.perTier ?? 12),
    rng: IDENTITY_RNG,
    recent,
    config: overrides.config ?? {},
  });
}

// The tier-N words in pool order (x{N}a, x{N}b, ...), for building recent sets
// without hard-coding names.
function tierWords(tier, perTier = 12) {
  return makePool(perTier)
    .filter((r) => r.tier === tier)
    .map((r) => r.word);
}

// --- multiplier decay ------------------------------------------------------

test('multiplier decays 5-3-1 across the three stages and clamps at the last', () => {
  const eng = engine();
  eng.nextWord(); // fresh tier-1, heat 0, no revenant
  const seen = [eng.currentMultiplier()];
  for (let i = 0; i < 6; i++) {
    eng.advanceStage();
    seen.push(eng.currentMultiplier());
  }
  // 5,3,1 then clamped at 1 for the extra advances (final stage is index 2).
  assert.deepEqual(seen, [5, 3, 1, 1, 1, 1, 1]);
});

// --- the 3-stage reveal schedule (types share a stage) ---------------------

test('the reveal schedule groups types: meta+sentence @0, gloss+root @1, first letter @2', () => {
  const stageOf = Object.fromEntries(revealSchedule(true).map((r) => [r.type, r.stage]));
  assert.deepEqual(stageOf, {
    [REVEAL_META]: 0,
    [REVEAL_SENTENCE]: 0,
    [REVEAL_GLOSS]: 1,
    [REVEAL_ROOT]: 1,
    [REVEAL_FIRST_LETTER]: 2,
  });
});

test('a root-null word simply has no root reveal (no aliases row), schedule otherwise intact', () => {
  const sched = revealSchedule(false);
  assert.ok(!sched.some((r) => r.type === REVEAL_ROOT));
  assert.deepEqual(
    sched.map((r) => [r.type, r.stage]),
    [
      [REVEAL_META, 0],
      [REVEAL_SENTENCE, 0],
      [REVEAL_GLOSS, 1],
      [REVEAL_FIRST_LETTER, 2],
    ]
  );

  // Grounded: a real root:null word exposes no root reveal in the engine.
  const rootless = [
    { word: 'aaaaa', pos: 'adj', tier: 5, gloss: 'g', context: 'use ___ now', root: null, alts: [] },
  ];
  const eng = createSatRushEngine({ words: rootless, rng: IDENTITY_RNG });
  const cur = eng.nextWord();
  assert.ok(!cur.reveals.some((r) => r.type === REVEAL_ROOT));
});

test('visibleReveals grows by stage: {meta,sentence} @0, +{gloss,root} @1, +firstLetter @2', () => {
  const eng = engine();
  eng.nextWord(); // stage 0
  assert.deepEqual(
    new Set(eng.visibleReveals().map((r) => r.type)),
    new Set([REVEAL_META, REVEAL_SENTENCE])
  );
  eng.advanceStage(); // stage 1 — the definition and the root land together
  assert.deepEqual(
    new Set(eng.visibleReveals().map((r) => r.type)),
    new Set([REVEAL_META, REVEAL_SENTENCE, REVEAL_GLOSS, REVEAL_ROOT])
  );
  eng.advanceStage(); // stage 2 — the first letter joins (then spell-along)
  assert.ok(eng.visibleReveals().some((r) => r.type === REVEAL_FIRST_LETTER));
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

test('a revenant enters at stage 1, pays double, and is requeued on a re-miss', () => {
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
  assert.equal(cur.stage, DEFAULT_CONFIG.revenantEntryStage); // 1
  assert.equal(eng.currentMultiplier(), 3 * 2); // stage-1 base 3x * revenant 2

  // The revenant enters having seen the sentence + definition (+ meta + root):
  // stage 1 reveals gloss AND root together.
  const types = new Set(eng.visibleReveals().map((r) => r.type));
  assert.deepEqual(types, new Set([REVEAL_META, REVEAL_SENTENCE, REVEAL_GLOSS, REVEAL_ROOT]));

  // Miss it a SECOND time -> requeued again for now+6, missCount 2.
  const m2 = eng.miss();
  assert.equal(m2.missCount, 2);
  assert.equal(m2.requeuedFor, 7 + DEFAULT_CONFIG.revenantOffset); // 13
  assert.equal(eng.getState().pendingRevenants, 1);
});

// --- deep-cut cadence ------------------------------------------------------

test('deep cuts land on every 15th word (15/30/45), forced tier 5, slower cadence', () => {
  const eng = engine({ perTier: 20 });
  const deepSlots = [];
  for (let n = 1; n <= 45; n++) {
    const cur = eng.nextWord();
    if (cur && cur.isDeepCut) deepSlots.push(n);
  }
  assert.deepEqual(deepSlots, [15, 30, 45]);

  // Inspect slot 30's deep cut directly.
  const eng2 = engine({ perTier: 20 });
  const at30 = skipTo(eng2, 30);
  assert.equal(at30.isDeepCut, true);
  assert.equal(at30.tier, 5); // forced regardless of the curve (curveTier(30)=3)
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

test('tier curve steps up exactly at 12/24/36/48 (tierEvery 12)', () => {
  const pairs = [
    [1, 1],
    [11, 1],
    [12, 2],
    [23, 2],
    [24, 3],
    [35, 3],
    [36, 4],
    [47, 4],
    [48, 5],
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

// --- spell-along heat rule -------------------------------------------------

test('heat does NOT bump on a clear that used more than the free reveal', () => {
  const eng = engine();
  eng.nextWord();
  const r = eng.submitCorrect({ revealed: 2 }); // leaned on the spell-along
  assert.equal(eng.getState().heat, 0); // unchanged — never bumped
  assert.equal(r.breakdown.silver, false);
  // ...but it still SCORES and keeps the streak (1x is already the floor).
  assert.equal(eng.getState().currentStreak, 1);
  assert.equal(eng.getState().cleared, 1);
  assert.ok(r.gained > 0);

  // A clear at the free stage-4 letter (revealed <= heatMaxRevealed) DOES bump.
  eng.nextWord();
  eng.submitCorrect({ revealed: 1 });
  assert.equal(eng.getState().heat, 1);
  // And revealed lands in the run log (feeds the word_resolved analytics).
  assert.deepEqual(
    eng.results().runLog.map((e) => e.revealed),
    [2, 1]
  );
});

test('silver still requires heatCap clears earned with <= the free reveal', () => {
  const eng = engine();
  // Five spell-along clears never build heat -> silver never turns on.
  for (let i = 0; i < 5; i++) {
    eng.nextWord();
    eng.submitCorrect({ revealed: 2 });
  }
  assert.equal(eng.getState().heat, 0);
  assert.equal(eng.getState().silverTongue, false);

  // Five clears at the free reveal reach the cap and earn silver.
  for (let i = 0; i < 5; i++) {
    eng.nextWord();
    eng.submitCorrect({ revealed: 1 });
  }
  assert.equal(eng.getState().heat, DEFAULT_CONFIG.heatCap);
  assert.equal(eng.getState().silverTongue, true);
});

test('a spell-along clear at heat cap keeps silver (heat UNCHANGED, not reset)', () => {
  const eng = engine();
  for (let i = 0; i < 5; i++) {
    eng.nextWord();
    eng.submitCorrect({ revealed: 1 });
  }
  assert.equal(eng.getState().silverTongue, true);

  // Clearing while leaning on the spell-along must not RESET heat (only a miss
  // does that) — it stays at the cap and the clear is still doubled.
  eng.nextWord();
  const r = eng.submitCorrect({ revealed: 3 });
  assert.equal(eng.getState().heat, DEFAULT_CONFIG.heatCap);
  assert.equal(eng.getState().silverTongue, true);
  assert.equal(r.breakdown.silver, true);
});

// --- spell-along endgame data ----------------------------------------------

test('endgame(): autoRevealMax = length-1, tickMs = spellAlongMs, finalHoldMs = 2*tickMs', () => {
  const eng = engine();
  const cur = eng.nextWord();
  const eg = eng.endgame();
  assert.equal(eg.tickMs, DEFAULT_CONFIG.spellAlongMs);
  assert.equal(eg.autoRevealMax, cur.length - 1); // last letter is never auto-revealed
  assert.equal(eg.finalHoldMs, 2 * DEFAULT_CONFIG.spellAlongMs);
});

test('the deep-cut interval scale slows the STAGE cadence but NEVER the spell-along tick', () => {
  const eng = engine({ perTier: 20 });
  const cut = skipTo(eng, 15); // a deep cut
  assert.equal(cut.isDeepCut, true);
  // Stage cadence is scaled up...
  assert.equal(
    eng.stageIntervalMs(),
    Math.round(DEFAULT_CONFIG.stageIntervalMs * DEFAULT_CONFIG.deepCutIntervalScale)
  );
  // ...but the spell-along tick is the raw spellAlongMs, unscaled.
  assert.equal(eng.endgame().tickMs, DEFAULT_CONFIG.spellAlongMs);
  assert.equal(eng.endgame().finalHoldMs, 2 * DEFAULT_CONFIG.spellAlongMs);
});

test('endgame() tracks a custom spellAlongMs (tickMs and the 2x final hold)', () => {
  const eng = engine({ config: { spellAlongMs: 700 } });
  eng.nextWord();
  const eg = eng.endgame();
  assert.equal(eg.tickMs, 700);
  assert.equal(eg.finalHoldMs, 1400);
});

// --- LINEUP stage-cadence scale (recognition needs reading time) -----------
// LINEUP serves six unknown suspect words plus a fresh sentence each stage, so its
// stage cadence gets its own multiplier that briefing (recall-after-study) doesn't.
// The formula lives in effectiveStageIntervalMs so the hook's timeline is testable.

test('(a) lineup stage advances run at base*lineupStageScale; briefing runs at base', () => {
  const base = DEFAULT_CONFIG.stageIntervalMs;
  // Briefing is exactly the base cadence — no scale applied.
  assert.equal(effectiveStageIntervalMs(base, { mode: 'briefing' }), base);
  // Lineup is base * lineupStageScale.
  assert.equal(
    effectiveStageIntervalMs(base, { mode: 'lineup' }),
    Math.round(base * DEFAULT_CONFIG.lineupStageScale)
  );
  // Sanity: with the shipped 3.0 default a 2800ms base becomes an 8400ms lineup beat.
  assert.equal(effectiveStageIntervalMs(2800, { mode: 'lineup' }), 8400);
});

test('the deep-cut and LINEUP scales STACK multiplicatively (lineup deep cut)', () => {
  const base = DEFAULT_CONFIG.stageIntervalMs;
  assert.equal(
    effectiveStageIntervalMs(base, { mode: 'lineup', isDeepCut: true }),
    Math.round(base * DEFAULT_CONFIG.deepCutIntervalScale * DEFAULT_CONFIG.lineupStageScale)
  );
  // A briefing deep cut only carries the deep-cut scale (lineup scale absent).
  assert.equal(
    effectiveStageIntervalMs(base, { mode: 'briefing', isDeepCut: true }),
    Math.round(base * DEFAULT_CONFIG.deepCutIntervalScale)
  );
});

test('(b) the last-call window is UNCHANGED by the lineup scale (never a 12s coin flip)', () => {
  const base = DEFAULT_CONFIG.stageIntervalMs;
  const len = 7;
  const expected = Math.round(base * 1.4) + len * 200;
  // lineupWindowMs takes the UNSCALED base only — there is no scale argument that
  // could stretch it, so a 3x (or any) stage scale leaves the window identical.
  assert.equal(lineupWindowMs(base, len), expected);
  // Explicit guard on the requirement: the window stays well under 12s at the
  // shipped base, whereas a scaled stage beat (8400ms) would blow past it.
  assert.ok(expected < 12000, 'last-call window must stay a snappy coin flip');
  assert.ok(effectiveStageIntervalMs(base, { mode: 'lineup' }) > expected);
});

test('(c) lineupStageScale: 1 reproduces today\'s lineup timeline exactly', () => {
  const base = DEFAULT_CONFIG.stageIntervalMs;
  const noScale = { lineupStageScale: 1 };
  // With the scale at 1 a lineup stage beat equals the briefing (base) beat...
  assert.equal(
    effectiveStageIntervalMs(base, { mode: 'lineup' }, noScale),
    effectiveStageIntervalMs(base, { mode: 'briefing' })
  );
  // ...and equals the raw base — byte-identical to a mode with no scaling at all.
  assert.equal(effectiveStageIntervalMs(base, { mode: 'lineup' }, noScale), base);
  // Deep cut with the scale at 1 also matches the briefing deep-cut beat exactly.
  assert.equal(
    effectiveStageIntervalMs(base, { mode: 'lineup', isDeepCut: true }, noScale),
    effectiveStageIntervalMs(base, { mode: 'briefing', isDeepCut: true })
  );
});

test('briefing cadence is byte-identical to the engine stageIntervalMs() (scale is lineup-only)', () => {
  const eng = engine();
  eng.nextWord(); // briefing mode default, word 1 (not a deep cut)
  const c = eng.getState().current;
  assert.equal(c.isDeepCut, false);
  assert.equal(
    effectiveStageIntervalMs(eng.config.stageIntervalMs, { mode: 'briefing', isDeepCut: c.isDeepCut }, eng.config),
    eng.stageIntervalMs()
  );
});

// --- cross-run recency (deprioritize, never ban) ---------------------------

test('a fresh draw avoids recently-served words while a non-recent same-tier word exists', () => {
  const t1 = tierWords(1);
  const recent = new Set(t1.slice(0, -1)); // every tier-1 word recent EXCEPT the last
  const eng = engineWithRecent(recent);
  const cur = eng.nextWord(); // word 1 -> target tier 1, not a deep cut
  assert.equal(cur.tier, 1);
  assert.equal(cur.word, t1[t1.length - 1]); // the only non-recent tier-1 word
  assert.ok(!recent.has(cur.word));
});

test('recency deprioritization holds across consecutive fresh draws (deterministic order)', () => {
  const t1 = tierWords(1);
  const recent = new Set(t1.slice(0, 3)); // first three tier-1 words are recent
  const eng = engineWithRecent(recent);
  // Words 1..3 all target tier 1; each should skip the recent trio, in pool order.
  const served = [eng.nextWord().word, eng.nextWord().word, eng.nextWord().word];
  for (const w of served) assert.ok(!recent.has(w), `${w} should be non-recent`);
  assert.deepEqual(served, t1.slice(3, 6));
});

test('when EVERY same-tier word is recent, a fresh draw still returns one (no softlock)', () => {
  const t1 = tierWords(1);
  const recent = new Set(t1); // all tier-1 words are recent
  const eng = engineWithRecent(recent);
  const cur = eng.nextWord();
  assert.ok(cur, 'must still serve a word — recency is a deprioritization, not a ban');
  assert.equal(cur.tier, 1); // stayed in the target tier rather than drifting away
  assert.ok(t1.includes(cur.word));
});

test('a recent-but-unused same-tier word is preferred over drifting to another tier', () => {
  // Only ONE tier-1 word exists and it is recent; the draw must still serve THAT
  // word (case 2) rather than fall through to a fresh tier-2 word (case 3).
  const eng = engineWithRecent(new Set(['x1a']), { perTier: 1 });
  const cur = eng.nextWord(); // target tier 1
  assert.equal(cur.tier, 1);
  assert.equal(cur.word, 'x1a');
});

test('an empty recent set draws identically to the original (first exact-tier word)', () => {
  const eng = engineWithRecent(new Set());
  assert.equal(eng.nextWord().word, tierWords(1)[0]); // x1a, exactly as before
});

// === INTERACTION CASES =====================================================

test('INTERACTION: a revenant that is ALSO the 15th word stacks deep-cut + revenant', () => {
  const eng = engine();
  // Miss word 9 -> revenant due at word 15 (a deep-cut slot) with revenantOffset 6.
  skipTo(eng, 9);
  eng.miss();
  const cur = skipTo(eng, 15);

  assert.equal(cur.isRevenant, true);
  assert.equal(cur.isDeepCut, true); // it landed on the deep-cut slot
  assert.equal(cur.tier, 1); // a revenant keeps its own tier (word 9 was tier 1)
  assert.equal(cur.stage, 1); // revenants re-enter at stage 1 now
  assert.equal(eng.getState().heat, 0); // isolated from silver
  assert.equal(eng.currentMultiplier(), 3 * 2); // stage-1 3x * revenant 2

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
  assert.equal(cur.stage, 1);
  // stage-1 base 3 * silver 2 * revenant 2 = 12
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
  const cut = skipTo(eng, 15);
  assert.equal(cut.isDeepCut, true);
  assert.equal(cut.tier, 5);

  const livesBefore = eng.getState().lives;
  const m = eng.miss();
  assert.equal(eng.getState().lives, livesBefore - 1);
  assert.equal(eng.getState().heat, 0); // heat broke mid-run
  assert.equal(eng.getState().silverTongue, false);
  assert.equal(m.requeuedFor, 15 + DEFAULT_CONFIG.revenantOffset); // 21
});

// --- alt half credit & results --------------------------------------------

test('an alt clear is half credit (bonus included) and reports the real word', () => {
  const eng = engine({ perTier: 20 });
  const cut = skipTo(eng, 15); // deep cut, tier 5, stage will be 0 after skip? no:
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
  // Clear one word at stage 0 (5x) and one at stage 2 (1x).
  eng.nextWord();
  eng.submitCorrect(); // stage 0 -> 5x
  eng.nextWord();
  eng.advanceStage();
  eng.advanceStage();
  eng.submitCorrect(); // stage 2 -> 1x
  // A tier-5 deep cut cleared at stage 0 (5x) -> becomes the hardest word.
  skipTo(eng, 15);
  eng.submitCorrect();

  const res = eng.results();
  assert.equal(res.cleared, 3);
  // mean of the base multipliers 5, 1, 5 — higher means answered earlier.
  assert.equal(res.avgAnte, (5 + 1 + 5) / 3);
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

// --- briefed words (THE BRIEFING) ------------------------------------------
// The 5 studied words are served FIRST, before the tier curve resumes. Each
// keeps its OWN tier (not the early-slot curve tier), carries isBriefed, and the
// empty default stays byte-identical to no briefing (covered by every test above,
// which passes no `briefed`).

function briefedEngine(briefed) {
  return createSatRushEngine({
    words: makePool(12),
    rng: IDENTITY_RNG,
    briefed,
  });
}

test('briefed words are served first and keep their own tier', () => {
  // Two high-tier words that the early tier curve (tier 1) would never pick.
  const eng = briefedEngine(['x5a', 'x3b']);
  const first = eng.nextWord();
  const second = eng.nextWord();
  const servedFirstTwo = new Set([first.word, second.word]);
  assert.deepEqual(servedFirstTwo, new Set(['x5a', 'x3b']), 'both briefed words come out first');
  assert.ok(first.isBriefed && second.isBriefed, 'flagged as briefed');
  // Tiers are the words own (5 and 3), not the slot-1/2 curve tier (1).
  const tierOf = (w) => (w === 'x5a' ? 5 : 3);
  assert.equal(first.tier, tierOf(first.word));
  assert.equal(second.tier, tierOf(second.word));

  // The curve resumes after: slot 3 is a normal fresh tier-1 draw, not briefed.
  const third = eng.nextWord();
  assert.equal(third.isBriefed, false);
  assert.equal(third.tier, 1);
});

test('a briefed word is never re-served as a fresh draw', () => {
  const eng = briefedEngine(['x1a']);
  const first = eng.nextWord();
  assert.equal(first.word, 'x1a');
  const seen = new Set([first.word]);
  for (let i = 0; i < 11; i++) {
    const w = eng.nextWord();
    if (!w) break;
    assert.ok(!seen.has(w.word), `duplicate served: ${w.word}`);
    seen.add(w.word);
  }
});

test('unknown briefed words are ignored, not served', () => {
  const eng = briefedEngine(['not-in-pool', 'x2a']);
  const first = eng.nextWord();
  assert.equal(first.word, 'x2a', 'only the real word is briefed');
  assert.equal(first.isBriefed, true);
});

// --- LINEUP mode: suspects attached per word, briefing mode has none ---------

// A pool that yields a full 6-suspect lineup: 5-letter adjectives, distinct first
// letters, no shared roots, no shared 5-substrings. (makePool's words all share
// morpheme 'r-', which the suspect rules exclude, so it can't be reused here.)
function lineupPool() {
  const words = ['brave', 'clean', 'dizzy', 'eager', 'faint', 'gaudy', 'happy', 'jumpy', 'lucky', 'moldy'];
  return words.map((w) => ({
    word: w,
    pos: 'adj',
    tier: 1,
    gloss: `def ${w}`,
    context: 'use ___ now',
    root: { morpheme: `${w[0]}-`, meaning: 'm', cousins: ['ca'] }, // distinct morphemes
    alts: [],
  }));
}

function standing(lineup, stage) {
  return lineup.filter((s) => s.eliminatedAtStage == null || s.eliminatedAtStage > stage).length;
}

test('briefing mode attaches NO suspects (default)', () => {
  const eng = createSatRushEngine({ words: lineupPool(), rng: IDENTITY_RNG });
  const cur = eng.nextWord();
  assert.equal(cur.suspects, null);
});

test('lineup mode attaches a 6-suspect lineup that narrows 6 -> 4 -> 2', () => {
  const eng = createSatRushEngine({ words: lineupPool(), rng: IDENTITY_RNG, config: { mode: 'lineup' } });
  const cur = eng.nextWord();
  assert.ok(cur.suspects, 'a lineup is attached in lineup mode');
  assert.equal(cur.suspects.count, 6);
  assert.equal(cur.suspects.lineup.length, 6);
  assert.equal(cur.suspects.lineup.filter((s) => s.isAnswer).length, 1);
  assert.ok(
    cur.suspects.lineup.some((s) => s.isAnswer && s.word === cur.word),
    'the answer suspect is the served word'
  );
  assert.equal(standing(cur.suspects.lineup, 0), 6);
  assert.equal(standing(cur.suspects.lineup, 1), 4);
  assert.equal(standing(cur.suspects.lineup, 2), 2);
});

test('lineup mode: the final surviving distractor differs from the answer at [0]', () => {
  const eng = createSatRushEngine({ words: lineupPool(), rng: IDENTITY_RNG, config: { mode: 'lineup' } });
  const cur = eng.nextWord();
  const survivor = cur.suspects.lineup.find((s) => !s.isAnswer && s.eliminatedAtStage == null);
  assert.ok(survivor, 'a surviving distractor exists');
  assert.notEqual(survivor.word[0], cur.word[0]);
});

test('lineup mode: a revenant also carries a suspect lineup', () => {
  const eng = createSatRushEngine({
    words: lineupPool(),
    rng: IDENTITY_RNG,
    config: { mode: 'lineup', revenantOffset: 2 },
  });
  eng.nextWord();
  eng.miss(); // requeue as a revenant for wordNumber + 2
  let cur = eng.nextWord();
  while (cur && !cur.isRevenant) cur = eng.nextWord();
  assert.ok(cur && cur.isRevenant, 'a revenant comes back');
  assert.ok(cur.suspects, 'the revenant still gets a lineup');
  assert.equal(cur.suspects.lineup.length, cur.suspects.count);
});
