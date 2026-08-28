// rarityIndex.js — the lazy, session-shared word→frequency-rank index that powers RARITY
// scoring in EVERY mode. The ranked corpus is words.recall.txt (index === rank); it is pulled
// as a ?raw string via a DYNAMIC import so it rides its own lazy chunk (shared with the solo
// word data, which imports the same asset) and never touches the menu's first paint.
//
// A game calls loadRarityIndex() on mount (idempotent, single-flight). Until it resolves,
// rarityOf() returns the COMMON/silent default — so a word accepted before the index lands
// simply pays ×1 and shows no rarity pop, never crashes or blocks. This module owns the loading;
// rarity.js stays pure (it only takes an already-built Map).
import { buildRarityIndex, wordRarity } from './rarity.js';

let index = null; // Map<word, rank> once loaded
let loading = null; // in-flight promise (single-flight)

// Kick off the one-time load. Safe to call on every game mount. Resolves to the Map.
export function loadRarityIndex() {
  if (index) return Promise.resolve(index);
  if (loading) return loading;
  loading = import('../solo/words.recall.txt?raw')
    .then((m) => {
      index = buildRarityIndex((m.default || '').split(' '));
      return index;
    })
    .catch(() => {
      // Asset/network failure → an empty index means every word reads COMMON (×1). The economy
      // still works; only the rarity bonus is absent until a later successful load.
      index = new Map();
      return index;
    });
  return loading;
}

// Whether the index has finished loading (mainly for diagnostics/tests).
export function isRarityIndexLoaded() {
  return index instanceof Map;
}

// Synchronous rarity verdict for a word using whatever is loaded. Before the index lands this
// returns the COMMON/silent default (mult 1, announce false) — never null, never throws.
export function rarityOf(word) {
  return wordRarity(word, index);
}

// Test/SSR hook: inject a prebuilt index (or reset with null) without the Vite ?raw loader.
export function __setRarityIndexForTest(map) {
  index = map instanceof Map ? map : null;
  loading = null;
}
