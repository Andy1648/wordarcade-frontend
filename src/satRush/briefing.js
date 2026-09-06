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
// Selection follows a strict spaced-repetition PRIORITY — DUE, then WEAK, then NEW:
//   1a. DUE (schedule-driven) — words whose Leitner interval has elapsed AND that
//       genuinely need re-studying (needsReview(): last encounter a miss or a
//       give-away clear). Weakest (lowest last ante) leads.
//   1b. WEAK (correctness-driven) — chronically low correct-rate words (weakByRate)
//       whose last encounter was NOT cold, pulled FORWARD even before their interval
//       elapses so a word the player keeps fumbling isn't left waiting out the box
//       gap. Worst correct-rate leads. Only consulted after DUE and only when
//       `includeWeak` is on.
//   Review is capped at `reviewCap` slots total and a slot is NEVER backfilled just
//   to fill it: a player who knows everything cold gets ZERO reviews and no repeats.
//   2. NEW / THE REST FRESH — UNSEEN words first (that's what keeps coverage wide
//      across the pool), root-bearing a weak tiebreak so a card can still teach a
//      family.
//   3. SHARED MORPHEME = BONUS, not a gate — if 2+ of the chosen words happen to
//      share a morpheme, they're grouped adjacently and the screen is headed with
//      it. Otherwise familyMorpheme is null (the common case) and the screen simply
//      reads as five words, each still teaching its own root family.
//
// Returns { words:[≤count rows], familyMorpheme, reviewCount, reviewWords:Set }.
// `words` are the raw pool rows (never mutated); `reviewWords` lets the screen mark
// the ones the player has faced before.
import { dueWords, isMastered, hasSeen, needsReview, weakByRate } from './lexicon.js';

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
 * @param {number}   [opts.reviewCap]  max review (repeat) slots per deck. Default 1
 *   reproduces the original single-slot selector exactly; the live mode passes 2 so
 *   the WEAK tier is reachable. A hard ceiling — the fresh fill never becomes review.
 * @param {boolean}  [opts.includeWeak]  when true, DUE is topped up from the WEAK
 *   (low correct-rate, not-yet-due) tier up to reviewCap. Default false = DUE only
 *   (the original behavior). Requires reviewCap >= 2 to have any effect.
 */
export function pickBriefing({
  state,
  session,
  words = [],
  rng = Math.random,
  count = 5,
  exclude = [],
  reviewCap = 1,
  includeWeak = false,
} = {}) {
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

  // ---- 1. review slots (up to reviewCap), priority DUE → WEAK ----
  // A review slot is warranted ONLY for a word that genuinely needs re-studying —
  // never backfilled just to fill it, so a player who knows everything cold gets
  // zero reviews and no repeats. (This is the fix for the old "33% repeats
  // regardless of skill" bug: dueWords used to treat everything seen as due, and the
  // old step force-filled review slots whenever anything was due.)
  //
  // 1a. DUE (schedule-driven): the Leitner interval has elapsed (in dueWords) AND
  //     the word needs review (last encounter a miss / give-away). A word cleared
  //     cold does NOT come back. Weakest (lowest last ante) leads.
  const dueSet = new Set(dueWords(state, session));
  const dueCandidates = [];
  for (const w of Object.keys(state.records)) {
    if (!dueSet.has(w)) continue; // Leitner interval not elapsed yet
    if (!needsReview(state, w)) continue; // knows it cold — nothing to re-study
    if (excludeSet.has(w)) continue; // dealt in the recent window — don't re-deal
    const row = byWord.get(w); // ignore memory for words no longer in the pool
    if (!row) continue;
    const antes = state.records[w].antes;
    dueCandidates.push({ w, row, lastAnte: antes[antes.length - 1] });
  }
  // Weakest-first: lowest last ante (misses before give-aways); word name breaks ties.
  dueCandidates.sort((a, b) => a.lastAnte - b.lastAnte || (a.w < b.w ? -1 : 1));
  for (const c of dueCandidates) {
    if (reviewWords.size >= reviewCap) break;
    if (take(c.row)) reviewWords.add(c.w);
  }

  // 1b. WEAK (correctness-driven): only when includeWeak and slots remain. Pulls
  //     chronically low-correct-rate words FORWARD even before their interval
  //     elapses — but never one already chosen as DUE, never one known cold on its
  //     last encounter (needsReview gates that), and never an excluded/out-of-pool
  //     word. Worst correct-rate leads (weakByRate's order).
  if (includeWeak && reviewWords.size < reviewCap) {
    const weakOrder = weakByRate(state, { exclude: reviewWords });
    for (const w of weakOrder) {
      if (reviewWords.size >= reviewCap) break;
      if (excludeSet.has(w)) continue;
      if (!needsReview(state, w)) continue; // last encounter must be shaky, not cold
      const row = byWord.get(w);
      if (!row) continue;
      if (take(row)) reviewWords.add(w);
    }
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
  // How many of the briefed words actually carry the family morpheme — so the header can say
  // "THREE SHARE A ROOT" when 3+ do, not a hardcoded "TWO". 0 when there's no family.
  const familyCount = familyMorpheme
    ? finalWords.filter((r) => r.root && r.root.morpheme === familyMorpheme).length
    : 0;

  return { words: finalWords, familyMorpheme, familyCount, reviewCount, reviewWords };
}
