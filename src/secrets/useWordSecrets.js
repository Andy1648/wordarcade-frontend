// useWordSecrets.js — the five secrets, moved OUT of the menu and INTO the game.
//
// WHAT CHANGED AND WHY. These five used to fire on the MENU and announce themselves as a
// centre-screen sticker over a modal backdrop: a one-off popup, mid-aim, that you clicked away and
// which could swallow the click meant for the card behind it. The detections were never the
// problem — they are good, and they stay, byte-identical (secrets/secrets.js is the same pure
// detector, same storage key, same five). What was wrong was WHERE and HOW they landed.
//
// Now they fire while you PLAY, they pay INTO the round you are in, and they surface at the word
// you just typed (components/WordLanding) rather than over the middle of the screen. Nothing here
// renders anything; it hands the caller a hit and the caller shows it at the word.
//
// The detector is fed exactly as it was on the menu — a window keydown listener (separate from the
// scoring path so it can never perturb it) plus an idle timer that closes a word for the
// palindrome check — so all five keep working: the magic word, the 11:11 wish and the typing
// streak come from the keys, the palindrome from the word boundary, and the 1-in-750 golden pop
// from `notePop()`, which the caller calls once per ACCEPTED WORD instead of once per menu pop.
import { useCallback, useEffect, useRef, useState } from 'react';
import { createSecretDetector } from './secrets';
import { grantWins } from '../progress/wins';
import { rebirthMult, getRebirths, loadProgress } from '../progress/xp';
import { winLevelMult } from '../progress/wins';
import { secretFound as evSecretFound } from '../lib/events.js';
import { createWordTracker, doublePairs } from '../unlisted/seasonSecret.js';

const IDLE_MS = 700; // typing pause that closes the current word (palindrome boundary)

function safeStorage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

// The 1-in-750 golden-pop RNG. Normally Math.random; a test seam (same family as App.jsx's
// window.__TAW_LUCKY) lets e2e force it 'off' so a spec pinning an exact wins delta can't be hit by
// an unseeded MIDAS payout landing in the middle of it. Undefined in production → Math.random.
function rarePopRng() {
  try {
    if (typeof window !== 'undefined' && window.__TAW_RARE_POP === 'off') return 1;
  } catch {
    /* no window / blocked → the real RNG */
  }
  return Math.random();
}

/**
 * What a secret actually pays. The catalog numbers (100-250) were set when a word paid 20 wins;
 * at the v7 base of 100 a flat 150 is less than one accepted word, and a reward that small is not
 * a reward, it is a rounding error with a name. Scaled on the SAME rebirth × level ladder the
 * SECRET achievements use, so a discovery stays worth finding at the point you can find it.
 */
export function secretPayout(base, { rebirths = getRebirths(), level = loadProgress().level } = {}) {
  const b = Number.isFinite(base) && base > 0 ? base : 0;
  return Math.round(b * rebirthMult(rebirths) * winLevelMult(level));
}

/**
 * THE UNLISTED GRANT + REVEAL — lazy (unlisted/reveal.js loads on the find, never on the menu's first paint). It grants
 * the gear once, fires the stamp and claims the serial. Resolves the grant or null.
 */
const TRIPLE_DOUBLE_ID = 'mk-ul-tripledouble'; // unlisted/unlistedIds.js (a literal here keeps that module off this path)
export function revealUnlisted(gearId, word) {
  return import('../unlisted/reveal.js').then((m) => m.revealUnlisted(gearId, word)).catch(() => null);
}
function revealForSecret(secretId, word) {
  return import('../unlisted/reveal.js').then((m) => m.revealForSecret(secretId, word)).catch(() => null);
}
// the SEASON gear: a cheap pre-check here (3+ double pairs); reveal.js confirms it is a real word
const maybeTripleDouble = (w) => !!w && w.length >= 8 && doublePairs(w) >= 3;

/**
 * @param {boolean} active  only listen while a GAME is the live screen.
 * Returns { hit, notePop, clear } — `hit` is the most recent find
 * ({ id, stamp, wins, blurb, detail, found, total }, `wins` already scaled) for the caller to
 * render AT THE WORD; `notePop()` rolls the 1-in-750 golden-word secret and should be called once
 * per accepted word; `clear()` drops the current hit.
 */
export function useWordSecrets({ active = true } = {}) {
  const [hit, setHit] = useState(null);
  const detRef = useRef(null);
  const idleRef = useRef(0);
  // THE WORD YOU TYPED (for the UNLISTED stamp): letters since the last boundary, and the last word a boundary closed.
  // The secrets with no word of their own (11:11, the typing streak, the golden word) stamp this one.
  const wordRef = useRef(null);
  if (wordRef.current === null) {
    const tracker = createWordTracker();
    let lastClosed = null;
    wordRef.current = {
      onKey: (k) => { const w = tracker.onKey(k); if (w) lastClosed = w; return w; },
      onIdle: () => tracker.onIdle(),
      last: () => tracker.current() || lastClosed,
    };
  }

  if (detRef.current === null) {
    detRef.current = createSecretDetector({ storage: safeStorage(), rng: rarePopRng });
  }

  const grant = useCallback((raw) => {
    if (!raw) return null;
    const wins = secretPayout(raw.wins);
    const found = { ...raw, wins };
    try {
      // Paid into the balance AND into lifetime: unlike the WORD SENSE refund, this IS earnings.
      //
      // THROUGH THE ONE DOOR (Batch G). This used to write saveWins/saveWinsLifetime directly,
      // which banked the money correctly but skipped credit() — so a secret payout never entered
      // the wins ledger, never raised the credit toast, and never bumped pendingStamp (so the
      // menu's "+N WINS" stamp under-reported it). wins.js documents credit() as the single door
      // every payout goes through precisely so the money and the explanation cannot diverge; this
      // was the one earning path in the app that went around it. grantWins() is that door.
      //
      // The run's own card is unaffected: App.jsx already adds secret.wins into winsEarnedTotal
      // (~1323 word-bomb, ~1506 blitz), so the total a player reads was never wrong — what was
      // missing was the ATTRIBUTION, which is now a named ledger line like every other bonus.
      grantWins(wins, 'SECRET FIND', { detail: found.id });
    } catch {
      /* storage blocked — the find still shows, just not banked */
    }
    try { evSecretFound(found.id); } catch { /* analytics only */ }
    // THE UNLISTED (oct17): the find is now also a GEAR you keep. The wins above still pay; the gear is the part that
    // lasts. The stamp lands on the word you typed (UnlistedStamp in the game's reaction slot, via the reveal bus).
    revealForSecret(found.id, raw.detail || wordRef.current.last());
    setHit(found);
    return found;
  }, []);

  useEffect(() => {
    if (!active) return undefined;
    const det = detRef.current;
    const words = wordRef.current;
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return; // ignore shortcuts
      const closed = words.onKey(e.key);
      grant(det.onKey(e.key));
      // the SEASON gear (TRIPLE DOUBLE) is judged at the same word boundary as the palindrome
      if (maybeTripleDouble(closed)) revealUnlisted(TRIPLE_DOUBLE_ID, closed);
      clearTimeout(idleRef.current);
      idleRef.current = setTimeout(() => {
        grant(det.onIdle());
        const w = words.onIdle();
        if (maybeTripleDouble(w)) revealUnlisted(TRIPLE_DOUBLE_ID, w);
      }, IDLE_MS);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      clearTimeout(idleRef.current);
    };
  }, [active, grant]);

  useEffect(() => () => clearTimeout(idleRef.current), []);

  const notePop = useCallback(() => grant(detRef.current.onPop()), [grant]);
  const clear = useCallback(() => setHit(null), []);

  return { hit, notePop, clear };
}
