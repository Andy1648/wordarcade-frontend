// briefing.js — chooses the 5 words THE BRIEFING studies before a run.
//
// Pure, RNG injected (deterministic in tests). The selection encodes the two
// design bets:
//   1. REVIEW FIRST. Up to 2 slots go to words the memory says are due (weak
//      words — cleared only when nearly given away — lead, then the rest of the
//      Leitner-due queue). Spaced repetition is the whole reason the memory
//      exists; it gets first claim.
//   2. THEN A ROOT FAMILY. The remaining slots are filled from ONE morpheme with
//      3+ un-mastered words in the pool — teaching `loqu-` with its family
//      attached teaches four words for the price of one. Families with a member
//      or cousin the player has already met are preferred: transfer lands harder
//      when one of the family is familiar.
//   3. FALLBACK. Early runs (nothing due, no family qualifies) or an exhausted
//      pool fall back to fresh, tier-appropriate words with familyMorpheme null —
//      the screen then reads as five words rather than "one root and its family".
//
// Returns { words:[≤count rows], familyMorpheme, reviewCount, reviewWords:Set }.
// `words` are the raw pool rows (never mutated); `reviewWords` lets the screen
// mark the ones the player has faced before.
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

/**
 * @param {object}   opts
 * @param {object}   opts.state    lexicon state (freshState() for a new player)
 * @param {number}   opts.session  the session the upcoming run will use
 * @param {object[]} opts.words    the full word pool (rows with root/tier/…)
 * @param {() => number} [opts.rng]  RNG in [0,1); injected for determinism
 * @param {number}   [opts.count]  how many words to brief (default 5)
 */
export function pickBriefing({ state, session, words = [], rng = Math.random, count = 5 } = {}) {
  const byWord = new Map(words.map((r) => [r.word, r]));
  const chosen = [];
  const chosenSet = new Set();
  const reviewWords = new Set();

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
    const row = byWord.get(w); // ignore memory for words no longer in the pool
    if (row && take(row)) reviewWords.add(w);
  }
  const reviewCount = chosen.length;

  // ---- 2. one root family for the rest ----
  let familyMorpheme = null;
  const families = new Map();
  for (const row of words) {
    if (!row.root || !row.root.morpheme) continue;
    if (isMastered(state, row.word) || chosenSet.has(row.word)) continue;
    const m = row.root.morpheme;
    if (!families.has(m)) families.set(m, []);
    families.get(m).push(row);
  }
  const candidates = [...families.entries()].filter(([, rows]) => rows.length >= 3);
  if (candidates.length) {
    const scored = candidates.map(([m, rows]) => ({
      m,
      rows,
      // familiar if any family member OR any of their cousins has been met before
      seenMember:
        rows.some((r) => hasSeen(state, r.word)) ||
        rows.some((r) => (r.root.cousins || []).some((c) => hasSeen(state, c))),
    }));
    // shuffle for variety, then bring the "has a familiar member" families to the
    // front — a stable sort keeps the shuffle order within each group.
    const ordered = shuffle(scored, rng).sort((a, b) => (b.seenMember ? 1 : 0) - (a.seenMember ? 1 : 0));
    const pick = ordered[0];
    familyMorpheme = pick.m;
    // take up to 3 of the family (or fewer if review already left <3 slots),
    // shuffled so it isn't always the same three. Capped at 3 so the family
    // teaches a root without swallowing the whole briefing.
    let famTaken = 0;
    for (const row of shuffle(pick.rows, rng)) {
      if (chosen.length >= count || famTaken >= 3) break;
      if (take(row)) famTaken += 1;
    }
  }

  // ---- 3. fresh fallback to reach `count`: un-mastered, unseen-first, low-tier ----
  if (chosen.length < count) {
    const fresh = words.filter((r) => !chosenSet.has(r.word) && !isMastered(state, r.word));
    const ordered = shuffle(fresh, rng).sort((a, b) => {
      const sa = hasSeen(state, a.word) ? 1 : 0;
      const sb = hasSeen(state, b.word) ? 1 : 0;
      if (sa !== sb) return sa - sb; // unseen words first
      return (a.tier || 1) - (b.tier || 1); // then the gentlest tier
    });
    for (const row of ordered) {
      if (chosen.length >= count) break;
      take(row);
    }
  }

  return { words: chosen, familyMorpheme, reviewCount, reviewWords };
}
