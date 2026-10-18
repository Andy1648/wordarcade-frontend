// seasonSecret.js — the SEASON gear's detector: TRIPLE DOUBLE (season 2 only, never returns).
//
// THE FIND: type ONE real word with THREE double letters in it (BOOKKEEPER: oo · kk · ee). Judged at the WORD
// BOUNDARY, exactly like the palindrome (secrets.js): a non-letter key or a typing pause closes the word, so nothing
// fires mid-word. A real word only — the curated list below — so "aabbcc" is not a find. Kept apart from secrets.js
// so the five word-secrets (and their Stats-board 5/5) stay exactly as they were.
//
// Pure: feed it keys, ask it at the boundary. No storage — the gear's own store (unlisted.js) is what makes it once.
// EAGER (the game's key listener): only the tracker + the pair count. The real-word list is tripleDouble.js (lazy).

/** How many separate double-letter pairs a word has ("bookkeeper" → 3; "aaa" → 1). */
export function doublePairs(word) {
  const w = String(word || '');
  let n = 0;
  for (let i = 0; i < w.length - 1; i++) {
    if (w[i] === w[i + 1]) { n++; i++; }
  }
  return n;
}
const MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'AltGraph', 'Fn', 'OS', 'Dead', 'Unidentified']);

/**
 * A word tracker for the game's key stream: { onKey(key) → closed word|null, onIdle() → current word|null, current() }.
 * `onKey` returns the word a boundary key just CLOSED (the letters since the last boundary), so the caller can judge it
 * and remember it as "the word you typed". Backspace removes a letter (it is an edit, not a boundary).
 */
export function createWordTracker() {
  let word = '';
  return {
    onKey(raw) {
      const k = String(raw || '');
      if (/^[a-zA-Z]$/.test(k)) { word = (word + k.toLowerCase()).slice(-24); return null; }
      if (k === 'Backspace') { word = word.slice(0, -1); return null; }
      if (k.length > 1 && MODIFIERS.has(k)) return null;
      const closed = word || null;
      word = '';
      return closed;
    },
    onIdle() {
      return word || null;
    },
    current() {
      return word;
    },
  };
}
