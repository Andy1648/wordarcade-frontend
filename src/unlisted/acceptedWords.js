// acceptedWords.js — THE ONE DOOR every UNLISTED find goes through: a word the GAME ACCEPTED, in ANY mode.
//
// WHY (Andy oct20): "fix the unlisted stuff - a lot of them are so stupid (also maybe make accepted words count (not
// just randomly typing)). (so like ensure 'newgrounds' has an opportunity). but like make it make sense - no matter the
// mode unless specified." Before this, the finds listened to loose KEYSTROKES in Word Bomb / Blitz only: typing a word
// into the box counted even if the game refused it, CHAIN / FUSE / SAT / FRENCH RUSH / RACE never counted at all, and
// NEWGROUNDS could never be accepted anywhere. Now every mode reports the words it accepted here (`noteAcceptedWord`),
// and nothing else can find a gear. Each riddle says, plainly enough to work out, what the word has to be:
//
//   O.G.          NEWGROUNDS — the Flash site that raised us — accepted (it is on the shared accept list on purpose:
//                 Word Bomb's server and CHAIN / FUSE take it; Blitz when the category fits).
//   MIRROR        a 7+ letter palindrome (ROTATOR, REVIVER, DEIFIED, RACECAR …).
//   TRIPLE DOUBLE a word with three separate double letters (BOOKKEEPER, COMMITTEE, KEENNESS …) — this season only.
//   TYPEWRITER    50 words in a row, every one 5+ letters (oct22; was 40 of 6+), without deleting a single letter (a typewriter cannot take
//                 one back). A shorter word, any deletion, or 3 minutes without a word starts it over.
//   WISHBONE      a word at 11:11 AM AND one at 11:11 PM on the same day (make a wish, twice).
//   MIDAS         sometimes a word turns to gold: 1 accepted word in 750, any mode (luck — never bought).
//
// EAGER but tiny (every mode's accept path calls it); the grant + stamp (reveal.js) load lazily on a find. Mode-agnostic:
// `mode` is recorded for the stamp / analytics only — no gear is mode-specific except where its riddle says so.
import { createTypewriterRun, noteWishWord, isMirrorWord, TYPEWRITER_IDLE_MS } from './gearFinds.js';
import { doublePairs } from './seasonSecret.js';

export const OG_WORD = 'newgrounds';
export const MIDAS_ODDS = 750;
const IDS = {
  og: 'mk-ul-og', mirror: 'mk-ul-mirror', tripledouble: 'mk-ul-tripledouble',
  typewriter: 'mk-ul-typewriter', wishbone: 'mk-ul-wishbone', midas: 'mk-ul-midas',
};

function defaultStorage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}
// MIDAS rng: Math.random, with the same e2e seam as the golden-word secret (window.__TAW_RARE_POP = 'off')
function defaultRng() {
  try {
    if (typeof window !== 'undefined' && window.__TAW_RARE_POP === 'off') return 1;
  } catch { /* the real rng */ }
  return Math.random();
}
function defaultReveal(gearId, word) {
  return import('./reveal.js').then((m) => m.revealUnlisted(gearId, word)).catch(() => null);
}

/**
 * PURE judge: which gears does this accepted word find? → [gear id]. `state` carries the TYPEWRITER run + the clock.
 *   word   the accepted word (any case)
 *   ctx    { now, rng, storage, run } — injectable
 */
export function judgeAcceptedWord(word, { now = Date.now(), rng = defaultRng, storage = defaultStorage(), run } = {}) {
  const w = String(word || '').trim().toLowerCase();
  if (!/^[a-z]+$/.test(w)) return [];
  const out = [];
  if (w === OG_WORD) out.push(IDS.og);
  if (isMirrorWord(w)) out.push(IDS.mirror);
  if (doublePairs(w) >= 3) out.push(IDS.tripledouble);
  if (run && run.onWord(w, now)) out.push(IDS.typewriter);
  if (noteWishWord(now, storage)) out.push(IDS.wishbone);
  if (rng() < 1 / MIDAS_ODDS) out.push(IDS.midas);
  return out;
}

// ---------------------------------------------------------------------------------------------- the live door
const run = createTypewriterRun();
let listening = false;
/** A take-back anywhere (the key, or the input reporting a deletion — phones send those) ends the TYPEWRITER run. */
function listenForTakeBacks() {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  try {
    window.addEventListener('keydown', (e) => run.onKey(e.key), true);
    window.addEventListener('input', (e) => {
      if (typeof e.inputType === 'string' && e.inputType.startsWith('delete')) run.onDelete();
    }, true);
  } catch { /* no window events — the run just never resets on a take-back */ }
}

/**
 * A mode ACCEPTED this word from the local player. Judges every UNLISTED find and reveals what it found (lazily — the
 * grant refuses a gear already owned or out of season). Never throws. → the gear ids it found (for tests / callers).
 *   mode  'wordBomb' | 'blitz' | 'race' | 'chain' | 'fuse' | 'sat' | 'french' | … (informational)
 */
export function noteAcceptedWord(word, { mode = null, reveal = defaultReveal, now = Date.now() } = {}) {
  void mode;
  try {
    listenForTakeBacks();
    const found = judgeAcceptedWord(word, { now, run });
    const w = String(word || '').trim().toLowerCase();
    for (const id of found) reveal(id, w);
    return found;
  } catch {
    return [];
  }
}
/** Test seam: the live TYPEWRITER run. */
export const _typewriterRun = run;
export { TYPEWRITER_IDLE_MS };
