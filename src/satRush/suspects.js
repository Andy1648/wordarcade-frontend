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
//   - SAME letter count as the answer. This is the LAST thing relaxed (see the
//     ladder below), because the slots show an exact letter count on screen — a
//     wrong-length suspect is eliminated FOR FREE and adds nothing to the choice.
//   - SAME part of speech, PREFERRED but relaxed before length. Part of speech is
//     shown too, but a player has to actually KNOW the word's POS to rule a suspect
//     out — that's reasoning, not a freebie — so a same-length wrong-POS suspect is
//     still a real suspect. A smaller honest lineup beats a padded fake one.
//   - Never one of the answer's `alts` (that recreates the marked-wrong-for-a-
//     good-answer problem).
//   - Never a word sharing the answer's `root.morpheme` (same-root words tend to
//     be related in meaning — an arguably-correct distractor is worse than an easy
//     one).
//   - Never sharing a 5-character substring with the answer.
//   - Never a word whose GLOSS shares >= 2 content words with the answer's gloss —
//     the synonym guard (see glossOverlap below). This catches same-meaning pairs
//     the alts lists miss (transient/ephemeral), so a player who understood the
//     sentence can't be rejected for typing the true synonym standing in the lineup.
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
// THE FALLBACK LADDER (relax the cheapest signal first — LENGTH is the freebie, so
// it goes last). `fallbackTier` reports which rung fired:
//   0. same length + same POS, full six            (ideal)
//   1. same length, ANY POS, full six              (covers ~98% of the pool)
//   2. same length, reduce the count to 4, then 2  (a smaller HONEST lineup)
//   3. widen the letter count (+/-1, +/-2)          (ABSOLUTE last resort)
// Rung 3 means the pool is too thin at that exact length — a CONTENT problem, not a
// code one — so it is logged LOUDLY by the caller (the returned `widened` flag).
// Never fewer than 2 suspects. `count` and `fallbackTier` are returned so the
// caller can report which rung fired.

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

// --- gloss overlap (the SEMANTIC-COLLISION heuristic) ----------------------
// The alts exclusion can't catch same-meaning distractors, because the dataset's
// alts lists were never built as exhaustive synonym lists: there are same-length,
// same-POS pairs whose GLOSSES describe the same thing but aren't cross-listed
// (transient/ephemeral, benevolent/altruistic, ...). If one is the answer and the
// other stands in the lineup, a player who FULLY understood the sentence picks the
// synonym and is rejected — the worst failure this mode can produce.
//
// So a candidate is also excluded if its gloss shares >= 2 content words with the
// answer's gloss. IMPORTANT: this is a cheap HEURISTIC, not a semantic check. It
// lowercases both glosses, drops stopwords and words of <= 3 letters, and counts
// shared remaining words. It kills the obvious collisions (measured: it touches
// ~0.06% of same-length/same-POS pairs, and every one is a real synonym pair), but
// it WILL MISS synonym pairs whose glosses happen to use different vocabulary —
// catching those would need a real similarity pass over the dataset.
const GLOSS_STOPWORDS = new Set([
  'that', 'this', 'with', 'from', 'your', 'yours', 'their', 'they', 'them', 'than',
  'then', 'when', 'what', 'whom', 'whose', 'which', 'while', 'will', 'would', 'could',
  'should', 'shall', 'have', 'having', 'been', 'being', 'into', 'onto', 'upon', 'over',
  'such', 'these', 'those', 'some', 'very', 'just', 'like', 'also', 'only', 'more',
  'most', 'much', 'many', 'each', 'every', 'does', 'done', 'about', 'before', 'after',
  'because', 'though', 'although', 'however', 'someone', 'something', 'anyone',
  'anything', 'everyone', 'everything', 'still', 'even', 'make', 'makes', 'making',
  'without',
]);

function glossContentWords(gloss) {
  return new Set(
    String(gloss)
      .toLowerCase()
      .split(/[^a-z]+/) // punctuation / apostrophes become separators
      .filter((w) => w.length > 3 && !GLOSS_STOPWORDS.has(w))
  );
}

function glossOverlap(a, b) {
  const A = glossContentWords(a);
  const B = glossContentWords(b);
  let n = 0;
  for (const w of A) if (B.has(w)) n += 1;
  return n;
}

// The hard semantic constraints, which hold at EVERY rung regardless of POS/length
// (those two are the ladder's own axes): not the answer, not an alt, not same-root,
// no shared 5-substring, and no >=2-content-word gloss overlap (the synonym guard).
// POS is deliberately NOT checked here — the ladder relaxes it before length.
function passesCore(d, answer, altSet) {
  if (d.word === answer.word) return false;
  if (altSet.has(d.word)) return false;
  if (answer.root && d.root && d.root.morpheme === answer.root.morpheme) return false;
  if (sharesSubstring(d.word, answer.word)) return false;
  if (d.gloss && answer.gloss && glossOverlap(d.gloss, answer.gloss) >= 2) return false;
  return true;
}

// Candidate distractors at a given length tolerance (0 = exact, 1 = +/-1, ...),
// ANY part of speech (POS is the ladder's axis, applied by the caller).
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
 *   fallbackTier,   // 0 same-len+same-POS · 1 same-len any-POS · 2 same-len reduced
 *                   //   count · 3 length widened (the loud, content-problem rung)
 *   reducedCount,   // true when the pool was too thin for a full 6-suspect lineup
 *   widened,        // true only on rung 3 — every suspect is same-length otherwise
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

  // 1. THE LADDER (relax POS before length; widen length only as a last resort).
  //    Every rung EXCEPT 3 keeps the answer's exact letter count.
  const isSamePos = (d) => d.pos === answer.pos;
  const exactLen = candidatesAt(answer, pool, altSet, 0); // same length, any POS
  const exactSamePos = exactLen.filter(isSamePos);

  let candidates;
  let count;
  let fallbackTier;
  let widened = false;

  if (exactSamePos.length >= 5) {
    candidates = exactSamePos; // rung 0 — ideal: same length + same POS
    count = 6;
    fallbackTier = 0;
  } else if (exactLen.length >= 5) {
    candidates = exactLen; // rung 1 — same length, any POS (POS is preferred in the pick)
    count = 6;
    fallbackTier = 1;
  } else if (exactLen.length >= 1) {
    candidates = exactLen; // rung 2 — same length, HONEST reduced count (4, then 2)
    count = exactLen.length >= 3 ? 4 : 2;
    fallbackTier = 2;
  } else {
    // rung 3 — no same-length candidate exists at ALL: widen the letter count as an
    // absolute last resort. This is a content problem (the pool is too thin at this
    // length); the caller logs `widened` loudly.
    widened = true;
    fallbackTier = 3;
    candidates = [];
    for (let tol = 1; tol <= 2 && candidates.length === 0; tol++) {
      candidates = candidatesAt(answer, pool, altSet, tol);
    }
    if (candidates.length === 0) {
      // pathological: relax the substring/root/gloss guards too, purely so a >= 2
      // lineup can always stand up (essentially never reached with the real pool).
      candidates = pool.filter(
        (d) => d.word !== answer.word && !altSet.has(d.word) && Math.abs(d.word.length - answer.word.length) <= 2
      );
      if (candidates.length === 0) candidates = pool.filter((d) => d.word !== answer.word);
    }
    count = candidates.length >= 5 ? 6 : candidates.length >= 3 ? 4 : 2;
  }
  const reducedCount = count < 6;
  const distractorsNeeded = count - 1;

  // 2. Choose the SURVIVOR — a distractor that differs from the answer at the first
  //    letter (the solvability invariant), PREFERRING one that also shares the POS.
  //    If none differ (a pathological pool), fall back to any distractor so we still
  //    return a lineup; the tests assert the invariant holds for real pools.
  const diffFirst = candidates.filter((d) => d.word[0] !== aFirst);
  const diffFirstSamePos = diffFirst.filter(isSamePos);
  const survivor = (
    diffFirstSamePos.length
      ? shuffle(diffFirstSamePos, rng)
      : diffFirst.length
        ? shuffle(diffFirst, rng)
        : shuffle(candidates, rng)
  )[0];

  // 3. The remaining distractors, SAME-POS preferred (so a reduced or any-POS lineup
  //    still shows the most honest suspects it can), get eliminated across stages 1
  //    and 2 (stage 1 first). The survivor is never eliminated.
  const remaining = candidates.filter((d) => d.word !== survivor.word);
  const rest = [
    ...shuffle(remaining.filter(isSamePos), rng),
    ...shuffle(remaining.filter((d) => !isSamePos(d)), rng),
  ].slice(0, distractorsNeeded - 1);
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

  return { count, fallbackTier, reducedCount, widened, lineup };
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
