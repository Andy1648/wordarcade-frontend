// glossary.js — definitions, where we actually have them, and honesty where we do not.
//
// THE COVERAGE PROBLEM, STATED PLAINLY. The only definition data in this app is SAT Rush's deck:
// 956 words with a `gloss`. The solo/Word-Bomb acceptance set is ~88,000 words. The overlap is
// 919 words — **1.0% coverage**. So a run-end "here is the word you missed, and what it means"
// can show a meaning for about one word in a hundred, and for the rest there is nothing true to
// say. This module returns null in that case, and every caller is expected to render the word
// WITHOUT inventing a definition for it. A fabricated gloss on a vocabulary game is worse than
// no gloss: it teaches something false and the player has no way to know.
//
// WHERE THE DATA WOULD COME FROM, if this is worth closing:
//   - the cheapest real option is a bundled short-definition set for the top ~5-10k words by
//     frequency, built offline (WordNet is the usual source, CC-BY-compatible) and shipped as a
//     lazy chunk like words.accept-ext.txt already is. At ~40 chars a gloss that is ~300KB before
//     compression for 8k words, which is the same order as the acceptance extension.
//   - a runtime dictionary API is the wrong answer here: it puts a network round-trip inside a
//     game-over beat, and it fails offline, which the rest of this app does not.
//
// LOADING: lazy and once. The deck is only pulled when a run actually ENDS and something wants a
// definition, so it never sits on the play path or the first paint.

let cache = null; // Map<lowercase word, gloss>
let inflight = null;

/** Load the gloss table once. Resolves to a Map; resolves to an EMPTY map if the data cannot be
 *  fetched, so a failed import degrades to "no definition" rather than throwing into a game-over. */
export function loadGlossary() {
  if (cache) return Promise.resolve(cache);
  if (inflight) return inflight;
  inflight = import('../data/satRush/words.json')
    .then((m) => {
      const rows = m.default || m;
      const map = new Map();
      for (const r of rows) {
        if (r && r.word && r.gloss) map.set(String(r.word).toLowerCase(), r.gloss);
      }
      cache = map;
      return map;
    })
    .catch(() => {
      cache = new Map(); // never retry-storm a game-over screen
      return cache;
    });
  return inflight;
}

/** The gloss for a word, or null. Synchronous: returns null until loadGlossary() has resolved,
 *  which is the correct answer for a caller that has not waited — "we don't have one (yet)". */
export function glossFor(word) {
  if (!cache || !word) return null;
  return cache.get(String(word).trim().toLowerCase()) || null;
}

/** True once the table is available, so a caller can distinguish "still loading" from "no gloss". */
export function glossaryReady() {
  return cache !== null;
}
