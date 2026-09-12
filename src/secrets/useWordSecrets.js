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
import { getWins, saveWins, getWinsLifetime, saveWinsLifetime } from '../progress/wins';
import { rebirthMult, getRebirths, loadProgress } from '../progress/xp';
import { winLevelMult } from '../progress/wins';
import { secretFound as evSecretFound } from '../lib/events.js';

const IDLE_MS = 700; // typing pause that closes the current word (palindrome boundary)

function safeStorage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
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

  if (detRef.current === null) {
    detRef.current = createSecretDetector({ storage: safeStorage() });
  }

  const grant = useCallback((raw) => {
    if (!raw) return null;
    const wins = secretPayout(raw.wins);
    const found = { ...raw, wins };
    try {
      // Paid into the balance AND into lifetime: unlike the WORD SENSE refund, this IS earnings.
      saveWins(getWins() + wins);
      saveWinsLifetime(getWinsLifetime() + wins);
    } catch {
      /* storage blocked — the find still shows, just not banked */
    }
    try { evSecretFound(found.id); } catch { /* analytics only */ }
    setHit(found);
    return found;
  }, []);

  useEffect(() => {
    if (!active) return undefined;
    const det = detRef.current;
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return; // ignore shortcuts
      grant(det.onKey(e.key));
      clearTimeout(idleRef.current);
      idleRef.current = setTimeout(() => grant(det.onIdle()), IDLE_MS);
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
