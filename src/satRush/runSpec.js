// runSpec.js — what a Rush RUN is, as plain data, and the pure builder that turns it into words.
//
// A run is FINITE (Andy oct17: "the user shouldnt have an infinite run"). It is fully described by
//   RunSpec = { pack, mode, difficulty, length, category? }
//     pack        which word pack (packs.js) — 'sat' today, FRENCH RUSH later
//     mode        'briefing' (study `length` words, then hunt exactly those)
//                 'lineup'   (a `length`-word case file, suspects narrowing per word)
//     difficulty  'easy' | 'standard' | 'hard' — the tier band the words come from
//     length      how many words the run is about (LENGTHS[mode])
//     category    optional topic filter for packs that have categories
// buildRunQueue() picks and orders those words from the pack and the player's learning memory
// (lexicon.js): words the player has been shaky on come back (up to REVIEW_SHARE of the run),
// unseen words come next, recently served and mastered words last. The engine then plays the queue
// and ends the run when every word in it is settled (a miss or a shaky clear comes back later in
// the same run — the dropout schedule — so "settled" means captured clean, or out of lives).
//
// Pure: no React, no DOM, no storage. The RNG and the lexicon state are passed in.
import { dueWords, needsReview, isMastered, hasSeen } from './lexicon.js';

export const MODES = ['briefing', 'lineup'];

export const DIFFICULTIES = {
  easy: { id: 'easy', label: 'EASY', line: 'tier 1–2', tiers: [1, 2] },
  standard: { id: 'standard', label: 'STANDARD', line: 'tier 1 → 4', tiers: [1, 4] },
  hard: { id: 'hard', label: 'HARD', line: 'tier 3–5', tiers: [3, 5] },
};
export const DIFFICULTY_ORDER = ['easy', 'standard', 'hard'];

// FRENCH RUSH levels (oct19, Andy: "do a better job with the level difficulty … ensure this is priority
// for AP exam"). A word's `tier` is how hard it is for an English speaker to LEARN — real frequency
// (OpenSubtitles fr top-50k rank) blended with a teacher rating, one step easier for a true cognate —
// and its `ap` is how much the AP exam leans on it (1 must-know, 2 common, 3 extra). The levels cut on
// BOTH: BASICS is must-know AND easy, EXAM CORE is everything the exam uses a lot, SCORE 5 is the
// harder tail.
export const FR_DIFFICULTIES = {
  easy: { id: 'easy', label: 'BASICS', line: 'must-know', tiers: [1, 2], apMax: 1 },
  standard: { id: 'standard', label: 'EXAM CORE', line: 'most on the AP', tiers: [1, 4], apMax: 2 },
  hard: { id: 'hard', label: 'SCORE 5', line: 'harder + rarer', tiers: [3, 5], apMax: 3 },
};

/** The level table for a pack (FRENCH RUSH has its own; everything else uses the SAT one). */
export function difficultiesFor(pack) {
  return pack === 'fr' ? FR_DIFFICULTIES : DIFFICULTIES;
}

// LINEUP: how many words the case file holds. BRIEFING: how many words you study (and then hunt).
export const LENGTHS = { lineup: [10, 20, 30], briefing: [5, 10, 15] };

export const DEFAULT_SPEC = { pack: 'sat', mode: 'lineup', difficulty: 'standard', length: 10, category: null, pace: 'timed', skipStudied: false };

// At most this share of a run is words the player has been shaky on before (the rest is new ground).
export const REVIEW_SHARE = 0.3;

/** Any partial / stale / hand-written spec → a valid one (unknown values fall back to defaults). */
export function normalizeSpec(spec = {}) {
  const s = spec || {};
  const mode = MODES.includes(s.mode) ? s.mode : DEFAULT_SPEC.mode;
  const difficulty = DIFFICULTIES[s.difficulty] ? s.difficulty : DEFAULT_SPEC.difficulty;
  const lengths = LENGTHS[mode];
  const length = lengths.includes(Number(s.length)) ? Number(s.length) : lengths[0];
  const pack = typeof s.pack === 'string' && s.pack ? s.pack : DEFAULT_SPEC.pack;
  const category = typeof s.category === 'string' && s.category ? s.category : null;
  // pace: 'self' (no clock — HINT + CONTINUE) | 'timed' (the clue clock)
  const pace = s.pace === 'self' ? 'self' : 'timed';
  // skipStudied: a study deck leaves out words already studied (FRENCH RUSH's default)
  const skipStudied = s.skipStudied === true;
  return { pack, mode, difficulty, length, category, pace, skipStudied };
}

/** The pack's rows inside the difficulty's tier band (and the category, when the spec names one). */
export function bandWords(words, difficulty, category = null, pack = 'sat') {
  const table = difficultiesFor(pack);
  const d = table[difficulty] || table.standard;
  const [lo, hi] = d.tiers;
  const apMax = d.apMax || 9;
  return words.filter(
    (r) =>
      r.tier >= lo &&
      r.tier <= hi &&
      (r.ap == null || r.ap <= apMax) &&
      (!category || r.category === category)
  );
}

/**
 * The target tier for each slot of a `length`-word run: a straight ramp from the band's low tier to
 * its high tier (a 1-word run sits at the low end). Every `deepCutEvery`-th slot (1-based) targets
 * the top of the band — the engine dresses those slots as deep cuts.
 */
export function tierTargets(length, difficulty, deepCutEvery = 0, pack = 'sat') {
  const table = difficultiesFor(pack);
  const [lo, hi] = (table[difficulty] || table.standard).tiers;
  const out = [];
  for (let i = 0; i < length; i++) {
    const t = length > 1 ? lo + Math.round(((hi - lo) * i) / (length - 1)) : lo;
    const deep = deepCutEvery > 0 && (i + 1) % deepCutEvery === 0;
    out.push(deep ? hi : t);
  }
  return out;
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

/**
 * Pick and order the words of a LINEUP run.
 * @returns {{ rows: object[], reviewWords: Set<string> }}  rows.length <= spec.length (a tiny band
 *   can run short; the run is then simply shorter).
 */
export function buildRunQueue({
  spec,
  words = [],
  lex = null,
  session = 0,
  recent = new Set(),
  rng = Math.random,
  deepCutEvery = 0,
} = {}) {
  const s = normalizeSpec(spec);
  const band = bandWords(words, s.difficulty, s.category, s.pack);
  const recentSet = recent instanceof Set ? recent : new Set(recent);
  const state = lex && lex.records ? lex : { records: {} };
  const used = new Set();
  const reviewWords = new Set();

  // 1. REVIEW: words due under the Leitner schedule whose last encounter was a miss or a give-away,
  //    inside the band. Shakiest (most overdue) first; capped at REVIEW_SHARE of the run.
  const byWord = new Map(band.map((r) => [r.word, r]));
  const reviewCap = Math.floor(s.length * REVIEW_SHARE);
  const review = [];
  for (const w of dueWords(state, session)) {
    if (review.length >= reviewCap) break;
    const row = byWord.get(w);
    if (row && needsReview(state, w)) {
      review.push(row);
      used.add(w);
      reviewWords.add(w);
    }
  }

  // 2. FRESH, slot by slot against the tier ramp. Preference: unseen + not recent → seen (not
  //    mastered) + not recent → recent → mastered; nearest tier wins, ties toward the lower tier.
  //    The band is shuffled first, so the first match in each bucket is the random pick.
  const pool = shuffle(band, rng);
  const rank = (r) => {
    if (isMastered(state, r.word)) return 3;
    if (recentSet.has(r.word)) return 2;
    return hasSeen(state, r.word) ? 1 : 0;
  };
  const targets = tierTargets(s.length, s.difficulty, deepCutEvery, s.pack);
  const slots = new Array(s.length).fill(null);

  // Review words go to evenly spread slots (never the first: the run opens on new ground).
  if (review.length) {
    const step = s.length / (review.length + 1);
    review.forEach((row, k) => {
      const at = Math.min(s.length - 1, Math.max(1, Math.round(step * (k + 1))));
      let i = at;
      while (i < s.length && slots[i]) i++;
      if (i >= s.length) i = slots.indexOf(null);
      if (i >= 0) slots[i] = row;
    });
  }

  for (let i = 0; i < s.length; i++) {
    if (slots[i]) continue;
    let best = null;
    let bestKey = Infinity;
    for (const r of pool) {
      if (used.has(r.word)) continue;
      // AP priority (FRENCH RUSH): a must-know word wins a tie over a nice-to-have one
      const key = rank(r) * 100 + Math.abs(r.tier - targets[i]) * 4 + (r.tier > targets[i] ? 2 : 0) + ((r.ap || 1) - 1);
      if (key < bestKey) {
        best = r;
        bestKey = key;
        if (key === 0) break;
      }
    }
    if (!best) break; // the band is dry
    used.add(best.word);
    slots[i] = best;
  }

  return { rows: slots.filter(Boolean), reviewWords };
}

// Pure: the pool a STUDY screen deals from. FRENCH RUSH (oct19, Andy: "target vocab words that the
// french versions dont sound like the english versions … this can strictly be the study first") studies
// only words an English speaker could NOT guess (`guessable: false` — not cognates, plus the false
// friends); the QUIZ keeps the whole bank. When a theme + level runs short of such words the pool widens
// to the theme's other levels (still non-guessable) before it ever falls back to guessable ones.
export function studyPool(pack, spec, lex) {
  const band = bandWords(pack.words, spec.difficulty, spec.category, spec.pack);
  if (!pack.studyNonGuessable) return band;
  const need = spec.length;
  const studiedSet = spec.skipStudied && lex && lex.studied ? lex.studied : {};
  const fresh = (rows) => rows.filter((r) => !studiedSet[r.word]).length;
  const hard = band.filter((r) => !r.guessable);
  if (fresh(hard) >= need) return hard;
  const wide = pack.words.filter((r) => !r.guessable && (!spec.category || r.category === spec.category));
  if (fresh(wide) >= need || wide.length >= need) return wide;
  return band;
}
