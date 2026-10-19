// gearFinds.js — the UNLISTED finds judged on an ACCEPTED word (not on loose keystrokes): TYPEWRITER, MIRROR, WISHBONE
// and the season's TRIPLE DOUBLE.
//
// WHY. Andy oct18 "typewriter and wishbone gear are WAY too easy to get", then oct19 "some unlisted ones are WAY TOO EZ
// TO GET … (i think typewriter and mirror). like stupidly easy atp". Two holes made them easy:
//   1. They were judged on the KEY STREAM. Typing LEVEL (MIRROR) or COMMITTEE (TRIPLE DOUBLE) into the box counted even
//      if the game never took the word — no fragment, no category, no turn needed.
//   2. TYPEWRITER's "no take-backs" listened for a Backspace KEY. Phone keyboards report their keys as "Unidentified",
//      so on a phone a deletion was never seen and any 50 words did it.
// Now every one of these is judged on the word the GAME ACCEPTED (useWordSecrets reads it from the input you typed it
// in), and a take-back is any deletion the input reports (InputEvent "delete…", which phones do send) or the key.
//   TYPEWRITER    — 40 ACCEPTED words in a row, every one 6+ letters, with not one deletion. A shorter accepted word,
//                   any deletion, or leaving the game starts the run over.
//   MIRROR        — an ACCEPTED palindrome of 7+ letters (RACECAR, ROTATOR, REVIVER, DEIFIED …) — the game's fragment
//                   or category has to let it through.
//   WISHBONE      — an ACCEPTED word at 11:11 AM AND one at 11:11 PM, on the SAME local day.
//   TRIPLE DOUBLE — an ACCEPTED word with three separate double letters (BOOKKEEPER, COMMITTEE …), this season only
//                   (reveal.js checks the curated word list).
// The word-secrets themselves (secrets.js: their stamp + Wins + the Stats board's 5/5) are unchanged.
// Pure: the clock and storage are injected. EAGER (the game's key listener): kept tiny — the grant itself is lazy.

export const TYPEWRITER_WORDS = 40;
export const TYPEWRITER_MIN_LEN = 6;
/**
 * A run of accepted long words with no take-back: { onKey(key), onDelete(), onWord(word) → true once the run reaches
 * `target`, reset(), count() }. A word shorter than `minLen` (or none) resets the run.
 */
export function createTypewriterRun(target = TYPEWRITER_WORDS, minLen = TYPEWRITER_MIN_LEN) {
  let n = 0;
  return {
    onKey(key) {
      if (key === 'Backspace' || key === 'Delete') n = 0;
    },
    onDelete() {
      n = 0;
    },
    onWord(word) {
      const w = String(word || '').trim();
      if (w.length < minLen) {
        n = 0;
        return false;
      }
      n += 1;
      return n === target;
    },
    reset() {
      n = 0;
    },
    count: () => n,
  };
}

export const MIRROR_MIN_LEN = 7;
/** MIRROR: a 7+ letter palindrome of three or more different letters ("aaaaaaa" is not a word). */
export function isMirrorWord(word) {
  const w = String(word || '').trim().toLowerCase();
  if (w.length < MIRROR_MIN_LEN || !/^[a-z]+$/.test(w)) return false;
  return w === w.split('').reverse().join('') && new Set(w).size >= 3;
}

export const WISH_KEY = 'taw.ulwish'; // { d: 'YYYY-MM-DD', am: bool } — the morning 11:11 half, kept for that day
const dayOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/**
 * An ACCEPTED word landed at `now`. Returns true when this completes the WISHBONE (the PM 11:11 of a day whose AM
 * 11:11 also landed a word). The AM half is stored; any other minute is a no-op. Guarded: blocked storage = no find.
 */
export function noteWishWord(now = Date.now(), storage = null) {
  const d = new Date(now);
  if (d.getMinutes() !== 11 || d.getHours() % 12 !== 11) return false;
  const day = dayOf(d);
  try {
    if (d.getHours() === 11) {
      storage.setItem(WISH_KEY, JSON.stringify({ d: day, am: true }));
      return false;
    }
    const raw = storage.getItem(WISH_KEY);
    const got = raw ? JSON.parse(raw) : null;
    return !!(got && got.am === true && got.d === day);
  } catch {
    return false;
  }
}
