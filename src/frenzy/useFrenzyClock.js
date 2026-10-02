// useFrenzyClock — the live FRENZY countdown for any surface (FUSE HUD, menu card, dialog).
// A 1 Hz interval runs ONLY while a frenzy is live (and is re-armed by `bump`, which the FUSE
// screen calls the instant a strip clears), so nothing ticks at rest. Not an animation: it
// re-renders a number once a second.
import { useEffect, useState, useCallback } from 'react';
import { frenzyRemaining } from '../progress/frenzy.js';

export function useFrenzyClock() {
  const [ms, setMs] = useState(() => frenzyRemaining());
  const [arm, setArm] = useState(0);
  useEffect(() => {
    if (frenzyRemaining() <= 0) {
      setMs(0);
      return undefined;
    }
    setMs(frenzyRemaining());
    const id = setInterval(() => {
      const left = frenzyRemaining();
      setMs(left);
      if (left <= 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [arm]);
  // Another tab / the FUSE screen may start one: re-check on focus and on storage events.
  useEffect(() => {
    const re = () => setArm((n) => n + 1);
    window.addEventListener('focus', re);
    window.addEventListener('storage', re);
    return () => {
      window.removeEventListener('focus', re);
      window.removeEventListener('storage', re);
    };
  }, []);
  const bump = useCallback(() => setArm((n) => n + 1), []);
  return { ms, active: ms > 0, bump };
}
