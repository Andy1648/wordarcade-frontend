// useMenuSecrets.js — mounts the five menu secrets on the Homepage. Menu-only: it
// attaches its OWN keydown listener (separate from the XP capture path so it never
// perturbs scoring) that feeds the pure detector, and on a hit grants the flat Wins
// and surfaces a transient STICKER hit for the caller to show (SecretSticker.jsx —
// a modal that swallows the dismiss click so it never falls through to a card).
//
// The palindrome secret is judged at the WORD BOUNDARY: the detector closes a word on a
// non-letter key, and this hook closes it on a typing PAUSE — 700ms after the last
// keydown it calls det.onIdle(). The timer is (re)started on every key and cleared on
// unmount / dismiss, so a paused word is judged exactly once.
import { useEffect, useRef, useState } from 'react';
import { createSecretDetector } from './menuSecrets';
import { getWins, saveWins, getWinsLifetime, saveWinsLifetime } from '../progress/wins';
import { secretFound as evSecretFound } from '../lib/events.js';

const IDLE_MS = 700; // typing pause that closes the current word (palindrome boundary)
const STICKER_MS = 4200; // how long a sticker stays up before it auto-dismisses

function safeStorage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/**
 * @param {boolean} active  only listen while the menu is the live screen.
 * @param {(popFn:()=>void)=>void} registerPop  optional: hand the caller a fn to
 *        call once per menu keystroke POP so the 1-in-750 golden-pop secret can fire.
 * Returns { stamp, dismiss } — `stamp` is the current hit to show
 * ({ id, stamp, wins, blurb, detail, found, total } | null), auto-clearing ~4.2s after
 * each hit; `dismiss()` clears it (and the pending idle timer) immediately.
 */
export function useMenuSecrets({ active = true, registerPop } = {}) {
  const [stamp, setStamp] = useState(null);
  const detRef = useRef(null);
  const clearRef = useRef(0);
  const idleRef = useRef(0);

  if (detRef.current === null) {
    detRef.current = createSecretDetector({ storage: safeStorage() });
  }

  function grant(hit) {
    if (!hit) return;
    try {
      saveWins(getWins() + hit.wins);
      saveWinsLifetime(getWinsLifetime() + hit.wins);
    } catch {
      /* storage blocked — the sticker still shows, just not banked */
    }
    try { evSecretFound(hit.id); } catch { /* analytics only */ }
    setStamp(hit);
    clearTimeout(clearRef.current);
    clearRef.current = setTimeout(() => setStamp(null), STICKER_MS);
  }

  function dismiss() {
    clearTimeout(idleRef.current);
    clearTimeout(clearRef.current);
    setStamp(null);
  }

  useEffect(() => {
    if (!active) return undefined;
    const det = detRef.current;
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return; // ignore shortcuts
      grant(det.onKey(e.key));
      // typing paused → close the word (the palindrome's other boundary)
      clearTimeout(idleRef.current);
      idleRef.current = setTimeout(() => grant(det.onIdle()), IDLE_MS);
    };
    window.addEventListener('keydown', onKey);
    // expose the pop hook (fired by the menu's per-keystroke pop effect)
    if (typeof registerPop === 'function') registerPop(() => grant(det.onPop()));
    return () => {
      window.removeEventListener('keydown', onKey);
      clearTimeout(idleRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => () => { clearTimeout(clearRef.current); clearTimeout(idleRef.current); }, []);

  return { stamp, dismiss };
}
