// LazyBoostDock — the BoostDock (bottom-right boost timers) only DOWNLOADS once a boost is actually running (payload
// ratchet: the dock, its CSS and liveBoost's list stay out of the menu's first load). The gate is a few localStorage
// reads, re-checked when a timer starts (TIMERS_EVENT), on focus and on storage — nothing ticks at rest.
import { lazy, Suspense, useEffect, useState } from 'react';
import { TIMERS_EVENT } from '../progress/boost.js';

const BoostDock = lazy(() => import('./BoostDock.jsx'));

const untilOf = (k, field = 'until') => {
  try {
    const raw = localStorage.getItem(k);
    if (!raw) return 0;
    if (/^\d+$/.test(raw)) return Number(raw); // taw.frenzyUntil is a bare number
    const o = JSON.parse(raw);
    if (!o || typeof o !== 'object') return 0;
    if (field === '*') return Math.max(0, ...Object.values(o).map(Number).filter(Number.isFinite));
    return Number(o[field]) || 0;
  } catch {
    return 0;
  }
};
/** Is ANY boost timer running? (code boost slots, Rebirth Rush OVERDRIVE, FRENZY, the shop's XP / WINS / LUCK) */
export function hasAnyBoost(now = Date.now()) {
  return [untilOf('taw.boost'), untilOf('taw.s2.boost2'), untilOf('taw.overdrive'), untilOf('taw.frenzyUntil'), untilOf('taw.s2.stockfx', '*')]
    .some((u) => u > now);
}

export default function LazyBoostDock() {
  const [on, setOn] = useState(() => hasAnyBoost());
  useEffect(() => {
    const re = () => setOn(hasAnyBoost());
    window.addEventListener(TIMERS_EVENT, re);
    window.addEventListener('focus', re);
    window.addEventListener('storage', re);
    return () => {
      window.removeEventListener(TIMERS_EVENT, re);
      window.removeEventListener('focus', re);
      window.removeEventListener('storage', re);
    };
  }, []);
  if (!on) return null;
  return (
    <Suspense fallback={null}>
      <BoostDock />
    </Suspense>
  );
}
