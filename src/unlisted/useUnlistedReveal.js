// useUnlistedReveal.js — the game screen's one subscription to THE UNLISTED reveal bus. Tiny on purpose: it is the only
// UNLISTED code in the (idle-prefetched) game chunk; the stamp itself (UnlistedStamp.jsx) loads when a reveal fires.
import { useEffect, useState } from 'react';
import { subscribeReveal, peekReveal, clearReveal } from './revealBus.js';

export const REVEAL_MS = 3400;
const LATE_MS = 1200; // a reveal emitted this long before the slot mounted still plays (a find on the game's first key)

/** The live reveal or null. Subscribes to the bus; each reveal lives REVEAL_MS (its own timer, keyed on the reveal). */
export function useUnlistedReveal() {
  const [rv, setRv] = useState(() => {
    const p = peekReveal();
    return p && p.at && Date.now() - p.at < LATE_MS ? p : null;
  });
  useEffect(() => subscribeReveal((r) => setRv(r)), []);
  const key = rv ? rv.key : 0;
  useEffect(() => {
    if (!key) return undefined;
    const t = setTimeout(() => { clearReveal(key); setRv(null); }, REVEAL_MS);
    return () => clearTimeout(t);
  }, [key]);
  return rv;
}

