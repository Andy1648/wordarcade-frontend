// letters.js — LIFETIME LETTERS TYPED (STEP 51, Andy oct2: the leaderboard's main stat — "every
// accepted letter, +1 per press, the Keyboard Escape hook"). Every accepted word in a GAME adds its
// letter count (menu typing doesn't count, like marks and mastery). A save from before this counter
// existed starts from an ESTIMATE — its lifetime accepted words × 5 letters — once.
import { MASTERY_MODES, masteryWords } from './mastery.js';

export const LETTERS_KEY = 'taw.letters';
const EST_LETTERS_PER_WORD = 5;

function read() {
  try {
    const raw = localStorage.getItem(LETTERS_KEY);
    if (raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}
function write(n) {
  try {
    localStorage.setItem(LETTERS_KEY, String(Math.max(0, Math.floor(n))));
  } catch {
    /* blocked */
  }
}

export function getLetters() {
  const n = read();
  if (n != null) return n;
  // first read on an old save: seed from words played (once)
  let words = 0;
  for (const m of MASTERY_MODES) words += masteryWords(m) || 0;
  const seed = words * EST_LETTERS_PER_WORD;
  write(seed);
  return seed;
}

export function addLetters(n) {
  const k = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  if (!k) return getLetters();
  const total = getLetters() + k;
  write(total);
  return total;
}
