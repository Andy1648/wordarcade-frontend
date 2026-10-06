// v3/menuWords.js — MENU TYPING under PROGRESSION FINAL (claude/progression-FINAL.md "Menu anti-mash"): the menu pays
// XP only for REAL DICTIONARY WORDS (finished by space / Enter), at ×0.2 of a game letter, so mashing earns 0.
//
//   * a word pays its letters × XP per letter × 0.2 × REPEAT, where REPEAT = the same word within 60 s of its last
//     typing: ×1 the first time, then ×0.5, ×0.25, then 0 (a gap of 60 s+ starts it over);
//   * typed faster than 12 letters a second (letters ÷ seconds from the word's first letter to its end key) → 0;
//   * not in the dictionary (the solo ACCEPT set) → 0; fewer than 2 letters → 0; menu typing never pays gems or wins.
//
// PURE + node-safe: the dictionary is injected (useXpCapture passes the lazily loaded solo accept set; the CI sim and
// the tests pass their own), and the clock is an argument.

export const MENU_REPEAT_WINDOW_MS = 60_000;
export const MENU_REPEAT_FACTORS = [1, 0.5, 0.25, 0]; // 1st, 2nd, 3rd, 4th+ time inside the window
export const MENU_MAX_LETTERS_PER_SEC = 12; // faster than this earns 0
export const MENU_MIN_WORD = 2;
const MAX_TRACKED = 500; // the repeat memory (oldest dropped)

/**
 * A menu-word judge. `isWord(w)` → boolean (the dictionary). Returns { judge(word, startedAt, endedAt) → factor 0..1,
 * reset() }. `judge` records the word (a refused word is not remembered as a repeat — except a dictionary word typed
 * too fast, which still counts toward its repeat ladder so a macro cannot farm by alternating speeds).
 */
export function createMenuWordJudge({ isWord } = {}) {
  let seen = new Map(); // word → { n, last }
  const judge = (word, startedAt, endedAt) => {
    const w = typeof word === 'string' ? word.toLowerCase() : '';
    if (w.length < MENU_MIN_WORD || !/^[a-z]+$/.test(w)) return 0;
    if (!(typeof isWord === 'function' && isWord(w))) return 0;
    const t1 = Number.isFinite(endedAt) ? endedAt : 0;
    const t0 = Number.isFinite(startedAt) ? startedAt : t1;
    const secs = Math.max(0, t1 - t0) / 1000;
    const tooFast = secs <= 0 || w.length / secs > MENU_MAX_LETTERS_PER_SEC;
    const prev = seen.get(w);
    const n = prev && t1 - prev.last < MENU_REPEAT_WINDOW_MS ? prev.n + 1 : 0;
    seen.delete(w);
    seen.set(w, { n, last: t1 });
    if (seen.size > MAX_TRACKED) seen.delete(seen.keys().next().value);
    if (tooFast) return 0;
    return MENU_REPEAT_FACTORS[Math.min(n, MENU_REPEAT_FACTORS.length - 1)];
  };
  return {
    judge,
    reset() {
      seen = new Map();
    },
  };
}

/** XP a judged menu word pays: letters × (XP per GAME letter) × 0.2 × factor (whole XP; 0 when factor is 0). */
export function menuWordXp(letters, perGameLetter, factor, share = 0.2) {
  const n = Number.isFinite(letters) && letters > 0 ? Math.floor(letters) : 0;
  const p = Number.isFinite(perGameLetter) && perGameLetter > 0 ? perGameLetter : 0;
  const f = Number.isFinite(factor) && factor > 0 ? factor : 0;
  return f > 0 ? Math.round(Number((n * p * share * f).toPrecision(12))) : 0;
}
