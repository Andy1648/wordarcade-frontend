// useMenuSecrets.js — mounts the five menu secrets on the Homepage. Menu-only: it
// attaches its OWN keydown listener (separate from the XP capture path so it never
// perturbs scoring) that feeds the pure detector, and on a hit grants the flat Wins
// and surfaces a transient STAMP for the caller to flash. No orphan fixed UI — the
// caller renders the stamp as a one-shot pointer-events:none overlay.
import { useEffect, useRef, useState } from 'react';
import { createSecretDetector } from './menuSecrets';
import { getWins, saveWins, getWinsLifetime, saveWinsLifetime } from '../progress/wins';
import { secretFound as evSecretFound } from '../lib/events.js';

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
 * Returns { stamp } — the current stamp to flash ({ id, stamp, wins, blurb } | null),
 * auto-clearing ~2.4s after each hit.
 */
export function useMenuSecrets({ active = true, registerPop } = {}) {
  const [stamp, setStamp] = useState(null);
  const detRef = useRef(null);
  const clearRef = useRef(0);

  if (detRef.current === null) {
    detRef.current = createSecretDetector({ storage: safeStorage() });
  }

  function grant(hit) {
    if (!hit) return;
    try {
      saveWins(getWins() + hit.wins);
      saveWinsLifetime(getWinsLifetime() + hit.wins);
    } catch {
      /* storage blocked — the stamp still shows, just not banked */
    }
    try { evSecretFound(hit.id); } catch { /* analytics only */ }
    setStamp(hit);
    clearTimeout(clearRef.current);
    clearRef.current = setTimeout(() => setStamp(null), 2400);
  }

  useEffect(() => {
    if (!active) return undefined;
    const det = detRef.current;
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return; // ignore shortcuts
      grant(det.onKey(e.key));
    };
    window.addEventListener('keydown', onKey);
    // expose the pop hook (fired by the menu's per-keystroke pop effect)
    if (typeof registerPop === 'function') registerPop(() => grant(det.onPop()));
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => () => clearTimeout(clearRef.current), []);

  return { stamp };
}
