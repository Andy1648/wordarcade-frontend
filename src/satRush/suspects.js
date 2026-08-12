// suspects.js — the LINEUP mode's SUSPECT LINEUP generator. Pure: no React, no
// DOM, no timers. The RNG is INJECTED so a seeded RNG makes every lineup
// reproducible in tests (same idiom as engine.js / briefing.js).
//
// LINEUP mode serves every word with a lineup of suspects, one of which is the
// answer, and the lineup NARROWS as the ante drops — that narrowing is the whole
// point: it makes the multiplier VISIBLE (answer early = answer with more
// suspects still standing). The player still types into the letter slots exactly
// as in briefing mode; the suspects are a recognition aid layered on top, they do
// NOT change the input model.
//
// PICKING THE 5 DISTRACTORS (relative to the answer row):
//   - SAME letter count as the answer. Non-negotiable (the slots already show the
//     length, so a different-length suspect would be eliminated for free). Only
//     relaxed by the thin-pool fallback below.
//   - SAME part of speech.
//   - Never one of the answer's `alts` (that recreates the marked-wrong-for-a-
//     good-answer problem).
//   - Never a word sharing the answer's `root.morpheme` (same-root words tend to
//     be related in meaning — an arguably-correct distractor is worse than an easy
//     one).
//   - Never sharing a 5-character substring with the answer.
// Then the answer is shuffled into the 5 and 6 suspects are returned.
//
// THE ELIMINATION SCHEDULE narrows with the stage/ante:
//   stage 0  5x   6 standing
//   stage 1  3x   4 standing  (2 eliminated)
//   stage 2  1x   2 standing  (2 more eliminated: the answer + ONE distractor)
// Eliminations are random EXCEPT one invariant that keeps the mode solvable: the
// LAST surviving distractor (the one still standing at the final 2-suspect stage)
// must differ from the answer at the FIRST letter. Because a wrong keystroke is
// rejected without advancing the cursor, a player at the final stage can type one
// candidate's first letter — if it bounces, it's the other one — so the final
// stage is ALWAYS solvable and the mode can never soft-lock. That property only
// holds if the final two differ at position 0, so it is enforced here (the
// survivor is chosen from the distractors that differ at the first letter) and
// asserted in the tests.
//
// THIN-POOL FALLBACK (long words especially): if fewer than 5 exact-length
// distractors exist, widen the letter count to +/-1, then +/-2. If fewer than 3
// distractors exist even then, serve a 4-suspect or 2-suspect lineup and compress
// the schedule to match. Never fewer than 2 suspects. `fallbackTier` (0/1/2 for
// the length widening) and the reduced `count` are returned so the caller can log
// which fallback fired.

// Fisher-Yates with an injected RNG — identical idiom to engine.js/briefing.js,
// so a seeded RNG makes every draw reproducible.
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

// True if `x` and `y` share any common substring of length >= n. Checking every
// n-gram of x against y's full string is sufficient and symmetric: a shared
// substring of length n is an n-gram of BOTH, so it appears in y. Words shorter
// than n have no n-grams, so the rule is vacuously satisfied (short words are
// never over-filtered).
function sharesSubstring(x, y, n = 5) {
  if (x.length < n || y.length < n) return false;
  for (let i = 0; i + n <= x.length; i++) {
    if (y.includes(x.slice(i, i + n))) return true;
  }
  return false;
}

// The full set of hard constraints EXCEPT the length rule (which the fallback
// relaxes on its own axis). Same POS, not the answer, not an alt, not same-root,
// no shared 5-substring.
function passesCore(d, answer, altSet) {
  if (d.word === answer.word) return false;
  if (d.pos !== answer.pos) return false;
  if (altSet.has(d.word)) return false;
  if (answer.root && d.root && d.root.morpheme === answer.root.morpheme) return false;
  if (sharesSubstring(d.word, answer.word)) return false;
  return true;
}

// Candidate distractors at a given length tolerance (0 = exact, 1 = +/-1, ...).
function candidatesAt(answer, pool, altSet, tol) {
  const target = answer.word.length;
  return pool.filter(
    (d) => Math.abs(d.word.length - target) <= tol && passesCore(d, answer, altSet)
  );
}

/**
 * Build the suspect lineup for one answer word.
 *
 * @param {object}       opts
 * @param {object}       opts.answer  the answer word ROW ({ word, pos, root, alts, ... })
 * @param {object[]}     opts.pool    all word rows to draw distractors from
 * @param {() => number} [opts.rng]   RNG in [0,1); injected for determinism
 *
 * @returns {object} {
 *   count,          // 6 | 4 | 2 — total suspects served
 *   fallbackTier,   // 0 | 1 | 2 — the length widening that was needed (0 = exact)
 *   reducedCount,   // true when the pool was too thin for a full 6-suspect lineup
 *   lineup,         // display order (answer shuffled in), STABLE for the whole word:
 *                   //   [{ word, isAnswer, eliminatedAtStage }]
 *                   // eliminatedAtStage is the stage index at which a suspect is
 *                   // crossed out (1 or 2); null for the answer and the ONE
 *                   // surviving distractor (which differs at the first letter).
 * }
 */
export function generateSuspects({ answer, pool = [], rng = Math.random } = {}) {
  const altSet = new Set((answer.alts || []).map((a) => String(a).toLowerCase()));
  const aFirst = answer.word[0];

  // 1. Widen the length tolerance until we have >= 5 candidates (a full lineup),
  //    remembering the tier at which we stopped. If +/-2 still can't reach 5, we
  //    keep the widest set and reduce the suspect count below.
  let candidates = [];
  let fallbackTier = 0;
  for (let tol = 0; tol <= 2; tol++) {
    candidates = candidatesAt(answer, pool, altSet, tol);
    fallbackTier = tol;
    if (candidates.length >= 5) break;
  }

  // 2. Choose the suspect count from how many distractors the pool can offer.
  //    5+ -> 6 suspects; 3-4 -> 4 suspects; 1-2 -> 2 suspects; 0 -> relax the
  //    POS rule as a last resort so we can always stand up at least 2 suspects.
  if (candidates.length === 0) {
    // Extremely thin (a unique-shape word): drop the POS constraint, then the
    // substring constraint, purely to guarantee a >= 2-suspect lineup exists.
    const relaxed = pool.filter(
      (d) => d.word !== answer.word && !altSet.has(d.word) && Math.abs(d.word.length - answer.word.length) <= 2
    );
    candidates = relaxed.length
      ? relaxed
      : pool.filter((d) => d.word !== answer.word);
    fallbackTier = 2;
  }

  let count;
  if (candidates.length >= 5) count = 6;
  else if (candidates.length >= 3) count = 4;
  else count = 2;
  const reducedCount = count < 6;
  const distractorsNeeded = count - 1;

  // 3. Choose the SURVIVOR first — a distractor that differs from the answer at
  //    the first letter (the solvability invariant). If somehow none differ (the
  //    pool is pathological), fall back to any distractor so we still return a
  //    lineup; the tests assert the invariant holds for real pools.
  const diffFirst = candidates.filter((d) => d.word[0] !== aFirst);
  const survivor = diffFirst.length
    ? shuffle(diffFirst, rng)[0]
    : shuffle(candidates, rng)[0];

  // 4. The remaining distractors get eliminated across stages 1 and 2, split as
  //    evenly as possible (stage 1 first). The survivor is never eliminated.
  const rest = shuffle(
    candidates.filter((d) => d.word !== survivor.word),
    rng
  ).slice(0, distractorsNeeded - 1);
  const half = Math.floor(rest.length / 2); // eliminated at stage 1; the rest at stage 2

  const distractorEntries = [
    { word: survivor.word, isAnswer: false, eliminatedAtStage: null },
    ...rest.map((d, i) => ({
      word: d.word,
      isAnswer: false,
      eliminatedAtStage: i < half ? 1 : 2,
    })),
  ];

  // 5. Shuffle the answer into the distractors for a STABLE display order (the
  //    crossing-out happens in place; positions never move).
  const lineup = shuffle(
    [...distractorEntries, { word: answer.word, isAnswer: true, eliminatedAtStage: null }],
    rng
  );

  return { count, fallbackTier, reducedCount, lineup };
}

/**
 * How many suspects are still standing at a given stage — a suspect stands until
 * the stage it is eliminated at is reached. Pure helper shared by the view (the
 * live count) and analytics (`suspectsStanding` at the moment a word resolves).
 */
export function suspectsStanding(lineup, stage) {
  if (!lineup) return 0;
  return lineup.filter((s) => s.eliminatedAtStage == null || s.eliminatedAtStage > stage).length;
}
