// gearFinds.js — the two UNLISTED finds that are NOT a word-secret any more: TYPEWRITER and WISHBONE.
//
// WHY (Andy oct18: "typewriter and wishbone gear are WAY too easy to get"). They used to ride the word-secrets
// (secrets/secrets.js): TYPEWRITER was 150 keys with no 1.5 s gap (a held key auto-repeats, so a few seconds of
// holding one down did it) and WISHBONE was ANY key pressed during 11:11 — both land on their own in an ordinary
// session. The secrets themselves (their stamp + Wins + the Stats board's 5/5) are unchanged; only the GEAR now needs
// the harder feat, judged here:
//   TYPEWRITER — 50 ACCEPTED words in a row in a game without ever pressing Backspace (a typewriter cannot take a
//                letter back). A Backspace, or leaving the game, starts the run over.
//   WISHBONE   — an ACCEPTED word at 11:11 AM AND one at 11:11 PM, on the SAME local day (the clock seeing double,
//                twice). The morning half is remembered for that day only.
// Pure: the clock and storage are injected. EAGER (the game's key listener): kept tiny — the grant itself is lazy.

export const TYPEWRITER_WORDS = 50;
/** A run of accepted words with no Backspace: { onKey(key), onWord() → true once the run reaches `target`, reset() }. */
export function createTypewriterRun(target = TYPEWRITER_WORDS) {
  let n = 0;
  return {
    onKey(key) {
      if (key === 'Backspace' || key === 'Delete') n = 0;
    },
    onWord() {
      n += 1;
      return n === target;
    },
    reset() {
      n = 0;
    },
    count: () => n,
  };
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
