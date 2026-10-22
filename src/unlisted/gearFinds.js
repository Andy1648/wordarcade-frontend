// gearFinds.js — the PURE pieces of the UNLISTED finds (acceptedWords.js is the door that runs them on every word a mode
// ACCEPTED): the TYPEWRITER run, the MIRROR test and the WISHBONE clock. History: oct18/oct19 these moved off loose
// keystrokes onto accepted words and got harder (Andy "WAY too easy"); oct20 every mode reports accepted words, so a
// TYPEWRITER run is "in a row" across whatever you are playing — it ends on a deletion, a short word, or a gap of
// TYPEWRITER_IDLE_MS with no word (you walked away), instead of "leaving the game screen".
// Pure: the clock and storage are injected.

export const TYPEWRITER_WORDS = 40;
export const TYPEWRITER_MIN_LEN = 6;
export const TYPEWRITER_IDLE_MS = 3 * 60 * 1000;
/**
 * A run of accepted long words with no take-back: { onKey(key), onDelete(), onWord(word, now) → true once the run
 * reaches `target`, reset(), count() }. A word shorter than `minLen` (or none), or one landing more than `idleMs` after
 * the last, starts the run over (that word counts as the new first when it is long enough).
 */
export function createTypewriterRun(target = TYPEWRITER_WORDS, minLen = TYPEWRITER_MIN_LEN, idleMs = TYPEWRITER_IDLE_MS) {
  let n = 0;
  let last = 0;
  return {
    onKey(key) {
      if (key === 'Backspace' || key === 'Delete') n = 0;
    },
    onDelete() {
      n = 0;
    },
    onWord(word, now = Date.now()) {
      const w = String(word || '').trim();
      if (n > 0 && now - last > idleMs) n = 0;
      last = now;
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
