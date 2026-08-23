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
//   1. REVIEW — AT MOST 1 word, and only when one genuinely needs re-studying
//      (needsReview(): last encounter a miss or a give-away clear) AND its Leitner
//      interval has elapsed. Weakest (lowest last ante) leads. If nothing qualifies
//      the whole deck is fresh — a review slot is never backfilled just to fill it,
//      so a strong player is not fed repeats.
//   2. THE REST FRESH — UNSEEN words first (that's what keeps coverage wide across
//      the pool), root-bearing a weak tiebreak so a card can still teach a family.
//   3. SHARED MORPHEME = BONUS, not a gate — if 2+ of the chosen words happen to
//      share a morpheme, they're grouped adjacently and the screen is headed with
//      it. Otherwise familyMorpheme is null (the common case) and the screen simply
//      reads as five words, each still teaching its own root family.
//
// Returns { words:[≤count rows], familyMorpheme, reviewCount, reviewWords:Set }.
// `words` are the raw pool rows (never mutated); `reviewWords` lets the screen mark
// the ones the player has faced before.
import { dueWords, isMastered, hasSeen, needsReview } from './lexicon.js';

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

  // Shared ordering for fresh + backfill fill. UNSEEN is the PRIMARY key so every
  // run reaches for words the player hasn't studied yet — that's what widens
  // coverage across the 600-word pool. Root-bearing is only a WEAK tiebreak (a
  // root-bearing card can teach a family, so it's mildly preferred among words of
  // equal seen-ness) and tier is dropped entirely: the old order (root-bearing
  // PRIMARY, then tier) stable-sorted the shuffle away and collapsed the effective
  // pool onto the same ~40 tier-1 root words. Because the sort is stable and runs
  // AFTER the shuffle, the injected RNG still decides order WITHIN each
  // unseen/root-bearing bucket (which holds hundreds of words), so the draw stays
  // wide and varied instead of deterministic.
  const freshOrder = (a, b) => {
    const sa = hasSeen(state, a.word) ? 1 : 0;
    const sb = hasSeen(state, b.word) ? 1 : 0;
    if (sa !== sb) return sa - sb; // unseen first — PRIMARY
    const ra = a.root ? 0 : 1;
    const rb = b.root ? 0 : 1;
    return ra - rb; // root-bearing a weak tiebreak; shuffle decides the rest
  };

  const take = (row) => {
    if (!row || chosenSet.has(row.word)) return false;
    chosen.push(row);
    chosenSet.add(row.word);
    return true;
  };

  // ---- 1. review (AT MOST 1 slot) ----
  // A review slot is warranted ONLY for a word that genuinely needs re-studying —
  // needsReview() (last encounter a miss or a give-away) — AND whose Leitner
  // interval has actually elapsed (it's in dueWords). A word cleared cold does NOT
  // come back. Among the qualifiers, take the WEAKEST (lowest last ante) so the
  // shakiest word leads. If NOTHING qualifies we deal 5 fresh — we never backfill a
  // review slot just to fill it. (This is the fix for the "33% repeats regardless
  // of skill" bug: dueWords used to treat everything seen as due, and the old step
  // force-filled 2 review slots whenever anything was due.)
  const dueSet = new Set(dueWords(state, session));
  const reviewCandidates = [];
  for (const w of Object.keys(state.records)) {
    if (!dueSet.has(w)) continue; // Leitner interval not elapsed yet
    if (!needsReview(state, w)) continue; // knows it cold — nothing to re-study
    if (excludeSet.has(w)) continue; // dealt in the recent window — don't re-deal
    const row = byWord.get(w); // ignore memory for words no longer in the pool
    if (!row) continue;
    const antes = state.records[w].antes;
    reviewCandidates.push({ w, row, lastAnte: antes[antes.length - 1] });
  }
  // Weakest-first: lowest last ante (misses before give-aways); word name breaks ties.
  reviewCandidates.sort((a, b) => a.lastAnte - b.lastAnte || (a.w < b.w ? -1 : 1));
  if (reviewCandidates.length) {
    const c = reviewCandidates[0];
    if (take(c.row)) reviewWords.add(c.w);
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
