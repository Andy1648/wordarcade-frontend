// engine.js — the pure rules core of SAT RUSH.
//
// NO React, NO DOM, NO timers. This is a deterministic state machine: the UI
// owns the wall clock (setTimeout for stage ticks / the spell-along endgame) and
// calls into the engine on each event (advanceStage, submitCorrect,
// registerWrongKeystroke, miss). Time is expressed as DATA the engine computes
// (stageIntervalMs, endgame()) so every rule here is unit-testable without a
// clock. The RNG is injected so word selection is reproducible in tests.
//
// Stage / reveal / multiplier model (multiplier is tied to the STAGE INDEX, not
// to the content, so the tier-4/5 flip never changes what a stage is worth):
//   stage 0  meta (part of speech + letter count)   5x
//   stage 1  sentence                               4x
//   stage 2  C                                       3x
//   stage 3  D                                       2x
//   stage 4  first letter                           1x
// where {C,D} = {gloss, root}: gloss-then-root for tiers 1-3, SWAPPED to
// root-then-gloss for tiers >= 4 (see revealOrder). High tiers thus force
// inference from context + morphology BEFORE the definition appears. This is
// intentionally NOT stage-2-invariant: a tier-4/5 revenant entering at stage 2
// has the sentence + root but NO gloss — a deliberately harder re-entry than a
// tier-1-3 revenant's sentence + gloss.

export const DEFAULT_CONFIG = {
  stageIntervalMs: 2000, // per-stage reveal cadence (configurable)
  stageMultipliers: [5, 4, 3, 2, 1], // by stage index 0..4
  // SPELL-ALONG endgame: at the final stage letters keep auto-revealing on this
  // cadence (never scaled by the deep-cut interval) until only the last letter is
  // missing, so every word is eventually typeable — the skill is answering EARLY.
  spellAlongMs: 1100,
  lives: 3,
  heatCap: 5,
  silverMultiplier: 2, // at heat cap, all multipliers double
  // A clear only bumps heat when at most this many letters were revealed (the
  // free stage-4 first letter). Leaning on the spell-along reveals scores
  // normally and keeps the streak, but leaves heat unchanged (never reset), so
  // SILVER TONGUE stays something you earn by knowing words.
  heatMaxRevealed: 1,
  tierEvery: 12, // tier = min(5, 1 + floor(wordNumber / tierEvery))
  tierMax: 5,
  deepCutEvery: 15, // every Nth word is a deep cut (forced tier 5 when fresh)
  deepCutIntervalScale: 1.55, // deep cut slows the reveal cadence
  deepCutBonus: 150, // flat, added after the multiplier
  revenantOffset: 6, // a miss requeues the word for wordNumber + offset
  revenantEntryStage: 2, // revenants re-enter mid-reveal (sentence + gloss up)
  revenantMultiplier: 2, // and pay double
  wrongKeystrokePenalty: -2, // per rejected key, never a life
  wrongKeystrokeRevealEvery: 3, // every 3rd wrong key reveals the next letter...
  wrongKeystrokeRevealPenalty: -8, // ...for this extra cost
  tierFlipMin: 4, // tiers >= this swap the sentence/gloss reveal order
};

export const REVEAL_META = 'meta';
export const REVEAL_SENTENCE = 'sentence';
export const REVEAL_GLOSS = 'gloss';
export const REVEAL_ROOT = 'root';
export const REVEAL_FIRST_LETTER = 'firstLetter';

// --- Pure helpers (exported for direct unit testing) -----------------------

/** Tier from the endless curve, ignoring deep cuts. 1-based wordNumber. */
export function curveTier(wordNumber, config = DEFAULT_CONFIG) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  return Math.min(cfg.tierMax, 1 + Math.floor(wordNumber / cfg.tierEvery));
}

/**
 * Does this word swap gloss<->root? Only when it is high-tier AND actually has a
 * root: a null-root word has no morphology to front-load, so it keeps the gloss
 * at stage 2 (the flip would otherwise leave stage 2 empty).
 */
export function isFlipped(tier, hasRoot = true, config = DEFAULT_CONFIG) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  return hasRoot && tier >= cfg.tierFlipMin;
}

/**
 * The ordered reveal table for a word: one entry per stage 0..4. The sentence is
 * ALWAYS stage 1; stages 2 and 3 carry {gloss, root} and their order swaps for
 * tier >= tierFlipMin (root arrives before the gloss), so high tiers must infer
 * from usage + morphology before the definition lands. Because the swap is
 * gloss<->root, the stage-2 SET differs by tier: {gloss} normally vs {root} when
 * flipped — a tier-4/5 revenant's stage-2 entry therefore has no definition.
 * (A null-root high-tier word does not flip; see isFlipped.)
 */
export function revealOrder(tier, hasRoot = true, config = DEFAULT_CONFIG) {
  const flip = isFlipped(tier, hasRoot, config);
  return [
    REVEAL_META,
    REVEAL_SENTENCE,
    flip ? REVEAL_ROOT : REVEAL_GLOSS,
    flip ? REVEAL_GLOSS : REVEAL_ROOT,
    REVEAL_FIRST_LETTER,
  ];
}

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}

// --- Engine ----------------------------------------------------------------

/**
 * @param {object}   opts
 * @param {object[]} opts.words   the word rows ({word,pos,tier,gloss,context,root,alts})
 * @param {() => number} [opts.rng]  RNG in [0,1); injected for deterministic tests
 * @param {object}   [opts.config]  overrides for DEFAULT_CONFIG (e.g. stageIntervalMs)
 * @param {Set<string>|string[]} [opts.recent]  words served on recent runs, to
 *   DEPRIORITIZE (not ban) in fresh draws so returning players get variety. Pure
 *   input — the engine never reads localStorage; the hook loads and passes it in.
 */
export function createSatRushEngine({ words = [], rng = Math.random, config = {}, recent = new Set() } = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  const pool = shuffle(words, rng);
  const used = new Set(); // word strings already served as fresh
  const recentSet = recent instanceof Set ? recent : new Set(recent); // deprioritized, not banned
  const revenants = []; // { row, tier, dueWordNumber, missCount }

  const state = {
    score: 0,
    lives: cfg.lives,
    heat: 0,
    silverTongue: false,
    wordNumber: 0, // slot index; first served word is 1
    gameOver: false,
    cleared: 0,
    missed: 0,
    currentStreak: 0,
    bestStreak: 0,
    anteStages: [], // stage index at each clear (lower = knew it faster)
    clearedWords: [], // { word, tier, length } for results (hardest word)
    runLog: [], // ordered per-word outcome for the results/share grid
    current: null, // the live word presentation, or null
    wrongKeystrokes: 0, // for the current word (drives the reveal cadence)
  };

  // Draw an unused fresh word of the requested tier. Preference order:
  //   1. target tier, not recently served  (the normal case)
  //   2. target tier, recently served       (only if the tier is otherwise dry —
  //      recency is a DEPRIORITIZATION, never a ban, so a small/mostly-seen tier
  //      never softlocks)
  //   3. nearest available tier, not recent  (target tier fully used)
  //   4. nearest available tier, recent      (last resort before the pool is dry)
  // Nearest picks the smallest tier distance, tie-breaking toward the lower tier
  // for a gentler curve — unchanged from before. The pool is pre-shuffled with the
  // injected RNG, so "first match in pool order" is the deterministic random pick.
  // With an empty recent set this is byte-identical to the original draw (case 1
  // returns the first exact-tier unused word; case 3 is the old nearest fallback).
  function drawWord(targetTier) {
    let exactRecent = null; // case 2
    let nearest = null; // case 3
    let nearestDist = Infinity;
    let nearestRecent = null; // case 4
    let nearestRecentDist = Infinity;

    for (const row of pool) {
      if (used.has(row.word)) continue;
      const dist = Math.abs(row.tier - targetTier);
      const isRecent = recentSet.has(row.word);
      if (dist === 0) {
        if (!isRecent) {
          used.add(row.word); // case 1 — best possible, take it immediately
          return row;
        }
        if (!exactRecent) exactRecent = row; // remember the first recent exact-tier word
        continue;
      }
      if (!isRecent) {
        if (dist < nearestDist || (dist === nearestDist && row.tier < (nearest ? nearest.tier : Infinity))) {
          nearest = row;
          nearestDist = dist;
        }
      } else if (
        dist < nearestRecentDist ||
        (dist === nearestRecentDist && row.tier < (nearestRecent ? nearestRecent.tier : Infinity))
      ) {
        nearestRecent = row;
        nearestRecentDist = dist;
      }
    }

    const best = exactRecent || nearest || nearestRecent;
    if (best) used.add(best.word);
    return best;
  }

  function buildPresentation(row, tier, { isRevenant, isDeepCut, missCount = 0 }) {
    const length = row.word.length;
    return {
      row,
      word: row.word,
      pos: row.pos,
      tier,
      length,
      gloss: row.gloss,
      context: row.context,
      root: row.root, // may be null
      alts: row.alts || [],
      firstLetter: row.word[0],
      reveals: revealOrder(tier, row.root != null, cfg),
      isRevenant,
      isDeepCut,
      missCount,
      stage: isRevenant ? cfg.revenantEntryStage : 0,
      resolved: false,
    };
  }

  /** Advance to the next slot and present a word. Returns the presentation, or
   *  null if the game is over or the pool is exhausted. */
  function nextWord() {
    if (state.gameOver) return null;
    const n = state.wordNumber + 1;
    const isDeepCutSlot = n % cfg.deepCutEvery === 0;

    // A due revenant takes priority over a fresh draw for this slot.
    let dueIdx = -1;
    for (let i = 0; i < revenants.length; i++) {
      if (revenants[i].dueWordNumber <= n) {
        if (dueIdx === -1 || revenants[i].dueWordNumber < revenants[dueIdx].dueWordNumber) {
          dueIdx = i;
        }
      }
    }

    let present;
    if (dueIdx !== -1) {
      const rev = revenants.splice(dueIdx, 1)[0];
      // A revenant keeps its own tier; if it lands on a deep-cut slot it also
      // gets the deep-cut treatment (bonus/interval/dramatic) on top.
      present = buildPresentation(rev.row, rev.tier, {
        isRevenant: true,
        isDeepCut: isDeepCutSlot,
        missCount: rev.missCount,
      });
    } else {
      const tier = isDeepCutSlot ? cfg.tierMax : curveTier(n, cfg);
      const row = drawWord(tier);
      if (!row) {
        // Pool exhausted and nothing to requeue right now: the run ends.
        state.gameOver = true;
        state.current = null;
        return null;
      }
      present = buildPresentation(row, tier, {
        isRevenant: false,
        isDeepCut: isDeepCutSlot,
      });
    }

    state.wordNumber = n;
    state.wrongKeystrokes = 0;
    state.current = present;
    return present;
  }

  /** Move to the next reveal stage (clamped at the final stage). */
  function advanceStage() {
    const cw = state.current;
    if (!cw) return null;
    const last = cfg.stageMultipliers.length - 1;
    if (cw.stage < last) cw.stage += 1;
    return { stage: cw.stage, atFinal: cw.stage >= last };
  }

  /** The effective multiplier right now (stage decay * silver * revenant). */
  function currentMultiplier() {
    const cw = state.current;
    if (!cw) return 0;
    let m = cfg.stageMultipliers[cw.stage];
    if (state.heat >= cfg.heatCap) m *= cfg.silverMultiplier;
    if (cw.isRevenant) m *= cfg.revenantMultiplier;
    return m;
  }

  /** The reveal cadence for the current word (deep cuts are slower). */
  function stageIntervalMs() {
    const cw = state.current;
    const base = cfg.stageIntervalMs;
    return cw && cw.isDeepCut ? Math.round(base * cfg.deepCutIntervalScale) : base;
  }

  /**
   * The SPELL-ALONG endgame schedule for the current word, as pure data (the
   * hook owns the clock). At the final stage the UI auto-reveals one letter every
   * `tickMs` until `autoRevealMax` letters are locked — the LAST letter is never
   * auto-revealed, so the player always finishes the word — then holds for
   * `finalHoldMs` before it counts as a "walked away" miss. tickMs is the raw
   * spell-along cadence: the deep-cut interval scale applies to the STAGE cadence
   * only, never here.
   */
  function endgame() {
    const cw = state.current;
    if (!cw) return null;
    const tickMs = cfg.spellAlongMs;
    return {
      tickMs,
      autoRevealMax: cw.length - 1, // last letter is never auto-revealed
      finalHoldMs: 2 * tickMs,
    };
  }

  /** Reveals visible at the current stage (types + payload). */
  function visibleReveals() {
    const cw = state.current;
    if (!cw) return [];
    return cw.reveals
      .map((type, stage) => ({ type, stage }))
      .filter((r) => r.stage <= cw.stage);
  }

  /**
   * Resolve the current word as a correct completion.
   * @param {object} [opts]
   * @param {boolean} [opts.viaAlt]   completed a valid same-length alt (half credit)
   * @param {number}  [opts.revealed] letters that were revealed on the word at
   *   completion (input.getState().revealed); gates the heat bump — see below.
   */
  function submitCorrect({ viaAlt = false, revealed = 0 } = {}) {
    const cw = state.current;
    if (!cw || cw.resolved) return null;

    const stage = cw.stage;
    // Heat only advances on a clear the player earned with at most the free
    // stage-4 letter revealed (heatMaxRevealed). A clear that leaned on more of
    // the spell-along auto-reveals scores normally and keeps the streak, but
    // leaves heat UNCHANGED — never reset — so SILVER TONGUE stays something you
    // earn by knowing words, not by waiting for the letters.
    const bumpsHeat = revealed <= cfg.heatMaxRevealed;
    // Silver is read from the heat AFTER this clear's (possible) bump, so a clear
    // that REACHES the cap is itself doubled — the state change (UI goes chrome)
    // and the score spike land on the same frame, and a player who earns silver
    // then immediately misses still banked one doubled clear from it.
    const heatAfter = bumpsHeat ? Math.min(cfg.heatCap, state.heat + 1) : state.heat;
    const silver = heatAfter >= cfg.heatCap;
    let mult = cfg.stageMultipliers[stage];
    if (silver) mult *= cfg.silverMultiplier;
    if (cw.isRevenant) mult *= cfg.revenantMultiplier;

    const base = cw.tier * 10 + cw.length * 2;
    let raw = base * mult;
    if (cw.isDeepCut) raw += cfg.deepCutBonus; // flat, not multiplied
    if (viaAlt) raw *= 0.5; // half credit (bonus included)
    let gained = Math.max(0, Math.round(raw));

    state.score = Math.max(0, state.score + gained);
    cw.resolved = true;

    // Heat / streak / results bookkeeping. (heatAfter already reflects the bump.)
    state.heat = heatAfter;
    state.silverTongue = state.heat >= cfg.heatCap;
    state.cleared += 1;
    state.currentStreak += 1;
    state.bestStreak = Math.max(state.bestStreak, state.currentStreak);
    state.anteStages.push(stage);
    state.clearedWords.push({ word: cw.word, tier: cw.tier, length: cw.length });
    state.runLog.push({
      ok: true,
      stage,
      revealed,
      viaAlt,
      silver: state.silverTongue,
      deepCut: cw.isDeepCut,
      revenant: cw.isRevenant,
    });

    return {
      gained,
      score: state.score,
      viaAlt,
      actualWord: cw.word, // UI shows this on an alt clear ("the word was PLACID")
      breakdown: {
        base,
        stage,
        stageMultiplier: cfg.stageMultipliers[stage],
        silver,
        revenant: cw.isRevenant,
        deepCutBonus: cw.isDeepCut ? cfg.deepCutBonus : 0,
        effectiveMultiplier: mult,
      },
      heat: state.heat,
      silverTongue: state.silverTongue,
    };
  }

  /** A rejected keystroke: bleed score, never a life; every 3rd reveals a letter. */
  function registerWrongKeystroke() {
    const cw = state.current;
    if (!cw || cw.resolved) return null;
    state.wrongKeystrokes += 1;
    let penalty = cfg.wrongKeystrokePenalty;
    let revealedLetter = false;
    if (state.wrongKeystrokes % cfg.wrongKeystrokeRevealEvery === 0) {
      penalty += cfg.wrongKeystrokeRevealPenalty;
      revealedLetter = true;
    }
    state.score = Math.max(0, state.score + penalty); // never negative
    return {
      penalty,
      revealedLetter,
      wrongKeystrokes: state.wrongKeystrokes,
      score: state.score,
    };
  }

  /** A miss (grace expired): lose a life, zero heat, requeue as a revenant. */
  function miss() {
    const cw = state.current;
    if (!cw || cw.resolved) return null;
    cw.resolved = true;

    state.lives -= 1;
    state.heat = 0; // any miss breaks the heat chain (and silver with it)
    state.silverTongue = false;
    state.missed += 1;
    state.currentStreak = 0;
    state.runLog.push({ ok: false, revenant: cw.isRevenant, deepCut: cw.isDeepCut });

    const dueWordNumber = state.wordNumber + cfg.revenantOffset;
    revenants.push({
      row: cw.row,
      tier: cw.tier, // revenants keep their own tier
      dueWordNumber,
      missCount: cw.missCount + 1,
    });

    if (state.lives <= 0) state.gameOver = true;

    return {
      lives: state.lives,
      gameOver: state.gameOver,
      requeuedFor: dueWordNumber,
      missCount: cw.missCount + 1,
    };
  }

  /** Results summary (used by the end screen). Avg ante is the headline stat. */
  function results() {
    // Avg ante is the HEADLINE stat: the mean base multiplier (5..1) at the
    // moment each word was cleared. Higher = answered earlier = "I knew these
    // fast". Shown as e.g. "2.4x". (Base stage multiplier only — not the
    // silver/revenant doublings, which measure luck/state, not knowledge.)
    const antes = state.anteStages;
    const avgAnte = antes.length
      ? antes.reduce((s, stage) => s + cfg.stageMultipliers[stage], 0) / antes.length
      : null;
    // Hardest word cleared: highest tier, tie-break longest.
    let hardest = null;
    for (const w of state.clearedWords) {
      if (
        !hardest ||
        w.tier > hardest.tier ||
        (w.tier === hardest.tier && w.length > hardest.length)
      ) {
        hardest = w;
      }
    }
    return {
      score: state.score,
      cleared: state.cleared,
      missed: state.missed,
      bestStreak: state.bestStreak,
      avgAnte, // mean stage at clear; lower means answered earlier
      hardestWord: hardest,
      runLog: state.runLog.slice(),
    };
  }

  function getState() {
    return {
      score: state.score,
      lives: state.lives,
      heat: state.heat,
      silverTongue: state.silverTongue,
      wordNumber: state.wordNumber,
      gameOver: state.gameOver,
      cleared: state.cleared,
      missed: state.missed,
      currentStreak: state.currentStreak,
      bestStreak: state.bestStreak,
      current: state.current,
      pendingRevenants: revenants.length,
      wrongKeystrokes: state.wrongKeystrokes,
    };
  }

  return {
    config: cfg,
    getState,
    nextWord,
    advanceStage,
    currentMultiplier,
    stageIntervalMs,
    endgame,
    visibleReveals,
    submitCorrect,
    registerWrongKeystroke,
    miss,
    results,
  };
}
