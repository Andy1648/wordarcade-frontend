// tripleDouble.js — the SEASON gear's word list (TRIPLE DOUBLE): a real word with three separate double-letter pairs.
// Lazy: loaded with the reveal (reveal.js), never on the menu's first paint. seasonSecret.js does the cheap pre-check.
import { doublePairs } from './seasonSecret.js';

// Every word here has three or more separate double-letter pairs.
export const TRIPLE_DOUBLE_WORDS = new Set([
  'bookkeeper', 'bookkeepers', 'bookkeeping', 'committee', 'committees', 'addressee', 'addressees',
  'successfully', 'unsuccessfully', 'sleeplessness', 'needlessness', 'heedlessness', 'cheerlessness',
  'possessiveness', 'tennessee', 'mississippi',
].filter((w) => doublePairs(w) >= 3));

export function isTripleDouble(word) {
  const w = String(word || '').toLowerCase();
  return TRIPLE_DOUBLE_WORDS.has(w) && doublePairs(w) >= 3;
}

