// words.js — lazy loader + accessor for the solo word data.
//
// Both solo modes (CHAIN, FUSE) call loadSoloWords() once when they start. It pulls
// the raw assets from wordsData.js via a DYNAMIC import, so the big strings land in
// their own lazy chunk (off the menu bundle) and are parsed exactly once, then cached
// for the rest of the session.
//
// The engines are PURE and never import this file — they take word data as arguments,
// so they stay testable under node without Vite's ?raw loader. This module is the
// bridge between the committed .txt assets and the running app only.
//
// Shape returned:
//   recall       string[]  — the ~31.5k RECALL words, FREQUENCY-ORDERED (index === rank)
//   accept       Set<string> — RECALL ∪ the accept increment (~88k words); membership set
//   topCommon    string[]  — recall.slice(0, TOP_COMMON) — CHAIN's "common words" set
//   maxAcceptLen number    — the longest word length in the built ACCEPT union. Derived
//                            from the list itself (one pass at load), never hardcoded, so
//                            the input maxlength can never lag the shipped word data.
//
// ACCEPT is built as RECALL ∪ increment because words.accept.txt stores only the
// increment (see scripts/build-words.mjs), which keeps the shipped assets inside the
// gzip budget instead of shipping every RECALL word twice.

// {maxLen} — the longest word in the full accept set, written by
// scripts/clean-accept-artifacts.mjs (tiny; static so it is known before any chunk loads).
import acceptMaxLen from './acceptMaxLen.json';

// CHAIN reads the top-N most frequent RECALL words as its "common" continuations
// (dead-end rescue + the live supply readout). 3000 per the spec.
export const TOP_COMMON = 3000;

let cache = null;

export async function loadSoloWords() {
  if (cache) return cache;
  const { recallRaw, acceptExtraRaw, famousRaw, commonRaw } = await import('./wordsData.js');
  const recall = recallRaw.split(' ');
  const accept = new Set(recall);
  for (const w of acceptExtraRaw.split(' ')) accept.add(w);
  // The hand-curated famous long words (antidisestablishmentarianism & co. — see wordsData.js).
  for (const w of famousRaw.split(/\s+/)) if (w) accept.add(w.toLowerCase());
  // STEP 55: common proper-noun words (october, london, france…) + mild insults — see wordsData.js.
  for (const w of (commonRaw || '').split(/\s+/)) if (w) accept.add(w.toLowerCase());
  // Floor at the generated whole-set length (base + the lazy extension), so a long ext word
  // can be TYPED on the first run too, before the extension chunk lands.
  let maxAcceptLen = acceptMaxLen.maxLen;
  for (const w of accept) if (w.length > maxAcceptLen) maxAcceptLen = w.length;
  cache = { recall, accept, topCommon: recall.slice(0, TOP_COMMON), maxAcceptLen };
  return cache;
}

// ---- Acceptance extension (lazy, AFTER the first run) --------------------------------
// The shipped accept set (RECALL ∪ words.accept.txt ≈ 88k) is FREQUENCY-filtered, so many
// real English words are wrongly rejected as "NOT IN OUR WORD LIST". loadSoloAcceptExt()
// pulls the ~182k-word extension (its own ~423KB-brotli lazy chunk) and ADDS it, in place,
// to the SAME live `cache.accept` Set the running engines already reference — so the current
// run and every later run instantly accept the bigger vocabulary. It is called only AFTER a
// run ENDS (never on mount), so the extension never delays the first game; until it lands the
// 88k set applies. Idempotent + single-flight: the fetch/merge happens exactly once.
let extState = 'idle'; // 'idle' | 'loading' | 'done'
let extPromise = null;

export function loadSoloAcceptExt() {
  if (extState === 'done') return Promise.resolve(cache);
  if (extPromise) return extPromise;
  extState = 'loading';
  extPromise = (async () => {
    if (!cache) await loadSoloWords(); // base must exist to merge into
    let mod = null;
    try {
      mod = await import('./wordsAcceptExt.js');
    } catch {
      mod = null;
    }
    if (!mod || typeof mod.acceptExtRaw !== 'string') {
      // Offline / failed fetch: keep the base set, and let the NEXT run-end try again.
      extState = 'idle';
      extPromise = null;
      return cache;
    }
    const { acceptExtRaw } = mod;
    // IN SLICES (STEP 59): 182k words added in one loop was a single ~150 ms task (620 ms at 4x CPU
    // throttle) that froze the run-over card's entrance on every CHAIN / FUSE death. Each slice is
    // a few ms; the set only ever grows, so a lookup mid-merge is at worst the old (smaller) answer.
    const words = acceptExtRaw.split(' ');
    const SLICE = 6000;
    for (let i = 0; i < words.length; i += SLICE) {
      const end = Math.min(words.length, i + SLICE);
      for (let j = i; j < end; j++) {
        const w = words[j];
        if (!w) continue;
        cache.accept.add(w);
        if (w.length > cache.maxAcceptLen) cache.maxAcceptLen = w.length;
      }
      if (end < words.length) await new Promise((r) => setTimeout(r, 0));
    }
    extState = 'done';
    return cache;
  })();
  return extPromise;
}

// Whether the extension has finished merging (mainly for tests / diagnostics).
export function isSoloAcceptExtLoaded() {
  return extState === 'done';
}

// Test/SSR hook: lets a caller inject already-parsed data (e.g. a node test that read
// the .txt files with fs) so the rest of the app can call loadSoloWords() without the
// Vite ?raw loader. Never used in the browser. Also resets the extension latch.
export function __setSoloWordsForTest(data) {
  cache = data;
  extState = 'idle';
  extPromise = null;
}
