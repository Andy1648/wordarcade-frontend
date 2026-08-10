// recentWords.js
// Cross-run memory of the words SAT RUSH has recently served, so a returning
// player is not handed the same early words every run. It is a plain ring buffer
// of the last ~80 served word strings in localStorage; the engine treats these
// as DEPRIORITIZED, never banned (see engine.js drawWord).
//
// Same defensive pattern as visitHistory.js: every read/write is wrapped so a
// private-mode / storage-disabled browser simply behaves as if nothing was
// remembered rather than throwing.

const RECENT_KEY = 'wa_satrush_recent';
const RECENT_CAP = 80; // how many recent words we keep (the ring size)

function readList() {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
  } catch {
    return []; // storage unavailable / corrupt value — remember nothing
  }
}

/** The recently-served words as a Set (for O(1) membership in the engine). */
export function readRecentWords() {
  return new Set(readList());
}

/**
 * Record a served word, keeping only the last RECENT_CAP. Persisted immediately
 * so a mid-run quit still counts. Silent when the word is falsy or storage is
 * unavailable.
 */
export function pushRecentWord(word) {
  if (typeof word !== 'string' || !word) return;
  try {
    const list = readList();
    list.push(word);
    const trimmed = list.length > RECENT_CAP ? list.slice(list.length - RECENT_CAP) : list;
    localStorage.setItem(RECENT_KEY, JSON.stringify(trimmed));
  } catch {
    /* storage unavailable — nothing to remember, no harm done */
  }
}
