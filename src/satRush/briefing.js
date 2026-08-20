// briefing.js — chooses the (up to) 5 words THE BRIEFING studies before a run.
//
// Pure, RNG injected (deterministic in tests).
//
// WHY THIS SHAPE. The dataset's family structure lives in each word's `cousins`
// field, not in shared headword morphemes: ~90% of morphemes appear on exactly one
// headword, so gating a "root family" lesson on 3+ headwords sharing a morpheme
// fired on almost nothing. But nearly every root-bearing word carries 2-4 verified
// cousins — so the family lesson belongs on EVERY card (the screen teaches each
// word's own morpheme + meaning + cousins), and it fires on ~100% of briefed cards.
//
// Selection is therefore simple:
//   1. REVIEW FIRST — up to 2 words the memory says are due (weak words, cleared
//      only when nearly given away, lead; then the rest of the Leitner-due queue).
//   2. THE REST FRESH — tier-appropriate words, preferring ones that CARRY a root
//      (so the card can teach a family), then unseen, then the gentlest tier.
//   3. SHARED MORPHEME = BONUS, not a gate — if 2+ of the chosen words happen to
//      share a morpheme, they're grouped adjacently and the screen is headed with
//      it. Otherwise familyMorpheme is null (the common case) and the screen simply
//      reads as five words, each still teaching its own root family.
//
// Returns { words:[≤count rows], familyMorpheme, reviewCount, reviewWords:Set }.
// `words` are the raw pool rows (never mutated); `reviewWords` lets the screen mark
// the ones the player has faced before.
import { weakWords, dueWords, isMastered, hasSeen } from './lexicon.js';

// Fisher-Yates with an injected RNG — same idiom as engine.js, so a seeded RNG
// makes every draw reproducible.
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

// The morpheme shared by the MOST chosen words, if any two share one (else null).
// Ties break toward the morpheme that appears earliest among the chosen words
// (Map iteration is insertion order), so the pick is deterministic.
function dominantMorpheme(chosen) {
  const counts = new Map();
  for (const r of chosen) {
    const m = r.root && r.root.morpheme;
    if (m) counts.set(m, (counts.get(m) || 0) + 1);
  }
  let best = null;
  let bestN = 1; // need at least 2 to be a shared root worth heading with
  for (const [m, n] of counts) {
    if (n >= 2 && n > bestN) {
      best = m;
      bestN = n;
    }
  }
  return best;
}

// Move every word carrying `morpheme` into one contiguous block, anchored at the
// first member's original position; everything else keeps its order. So a review
// word chosen first stays first, and the shared-root words read together.
function groupByMorpheme(chosen, morpheme) {
  const isMember = (r) => r.root && r.root.morpheme === morpheme;
  const members = chosen.filter(isMember);
  const out = [];
  let placed = false;
  for (const r of chosen) {
    if (isMember(r)) {
      if (!placed) {
        out.push(...members);
        placed = true;
      }
    } else {
      out.push(r);
    }
  }
  return out;
}

/**
 * @param {object}   opts
 * @param {object}   opts.state    lexicon state (freshState() for a new player)
 * @param {number}   opts.session  the session the upcoming run will use
 * @param {object[]} opts.words    the full word pool (rows with root/tier/…)
 * @param {() => number} [opts.rng]  RNG in [0,1); injected for determinism
 * @param {number}   [opts.count]  how many words to brief (default 5)
 * @param {Iterable<string>} [opts.exclude]  words to skip (e.g. the previous deck)
 *   so a briefing never re-deals the same set. SOFT: if the exclusion leaves the
 *   pool short of `count`, non-mastered excluded words are backfilled so a full
 *   deck always ships.
 */
export function pickBriefing({ state, session, words = [], rng = Math.random, count = 5, exclude = [] } = {}) {
  const byWord = new Map(words.map((r) => [r.word, r]));
  const excludeSet = new Set(Array.from(exclude, (w) => String(w)));
  const chosen = [];
  const chosenSet = new Set();
  const reviewWords = new Set();

  // Shared ordering for fresh + backfill fill: root-bearing first (every card can
  // teach a family), then unseen, then the gentlest tier.
  const freshOrder = (a, b) => {
    const ra = a.root ? 0 : 1;
    const rb = b.root ? 0 : 1;
    if (ra !== rb) return ra - rb;
    const sa = hasSeen(state, a.word) ? 1 : 0;
    const sb = hasSeen(state, b.word) ? 1 : 0;
    if (sa !== sb) return sa - sb;
    return (a.tier || 1) - (b.tier || 1);
  };

  const take = (row) => {
    if (!row || chosenSet.has(row.word)) return false;
    chosen.push(row);
    chosenSet.add(row.word);
    return true;
  };

  // ---- 1. review words (up to 2): weak first, then the rest of the due queue ----
  const reviewOrder = [];
  const pushReview = (w) => {
    if (!reviewOrder.includes(w)) reviewOrder.push(w);
  };
  weakWords(state).forEach(pushReview);
  dueWords(state, session).forEach(pushReview);
  for (const w of reviewOrder) {
    if (chosen.length >= 2) break;
    if (excludeSet.has(w)) continue; // just-briefed — don't re-deal (soft; may backfill)
    const row = byWord.get(w); // ignore memory for words no longer in the pool
    if (row && take(row)) reviewWords.add(w);
  }
  const reviewCount = chosen.length;

  // ---- 2. fill the rest with fresh, tier-appropriate words ----
  // Prefer words that CARRY a root (so the card can teach its family), then unseen
  // words, then the gentlest tier. Mastered and just-briefed (excluded) words are
  // never re-briefed as fresh.
  const fresh = words.filter(
    (r) => !chosenSet.has(r.word) && !isMastered(state, r.word) && !excludeSet.has(r.word)
  );
  const ordered = shuffle(fresh, rng).sort(freshOrder);
  for (const row of ordered) {
    if (chosen.length >= count) break;
    take(row);
  }

  // ---- 2b. SOFT-exclusion backfill ----
  // If excluding the previous deck left us short of a full deck, backfill from the
  // non-mastered EXCLUDED words (same ordering) so a full deck always ships rather
  // than dealing fewer than `count`.
  if (chosen.length < count) {
    const backfill = shuffle(
      words.filter(
        (r) => excludeSet.has(r.word) && !chosenSet.has(r.word) && !isMastered(state, r.word)
      ),
      rng
    ).sort(freshOrder);
    for (const row of backfill) {
      if (chosen.length >= count) break;
      take(row);
    }
  }

  // ---- 3. shared-morpheme BONUS ----
  const familyMorpheme = dominantMorpheme(chosen);
  const finalWords = familyMorpheme ? groupByMorpheme(chosen, familyMorpheme) : chosen;

  return { words: finalWords, familyMorpheme, reviewCount, reviewWords };
}
