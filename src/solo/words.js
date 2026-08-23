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
//   recall     string[]  — the ~31.5k RECALL words, FREQUENCY-ORDERED (index === rank)
//   accept     Set<string> — RECALL ∪ the accept increment (~88k words); membership set
//   topCommon  string[]  — recall.slice(0, TOP_COMMON) — CHAIN's "common words" set
//
// ACCEPT is built as RECALL ∪ increment because words.accept.txt stores only the
// increment (see scripts/build-words.mjs), which keeps the shipped assets inside the
// gzip budget instead of shipping every RECALL word twice.

// CHAIN reads the top-N most frequent RECALL words as its "common" continuations
// (dead-end rescue + the live supply readout). 3000 per the spec.
export const TOP_COMMON = 3000;

let cache = null;

export async function loadSoloWords() {
  if (cache) return cache;
  const { recallRaw, acceptExtraRaw } = await import('./wordsData.js');
  const recall = recallRaw.split(' ');
  const accept = new Set(recall);
  for (const w of acceptExtraRaw.split(' ')) accept.add(w);
  cache = { recall, accept, topCommon: recall.slice(0, TOP_COMMON) };
  return cache;
}

// Test/SSR hook: lets a caller inject already-parsed data (e.g. a node test that read
// the .txt files with fs) so the rest of the app can call loadSoloWords() without the
// Vite ?raw loader. Never used in the browser.
export function __setSoloWordsForTest(data) {
  cache = data;
}
