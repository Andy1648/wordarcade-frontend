// useLevelBar — a small level bar (or a bare level numeral) driven by lib/barPlan's player: a
// multi-level climb flashes the fill full once per level passed (compressed to ≤ ~1 s) while the
// numeral ticks up, then fills to the real fraction; a gain mid-climb re-plans from what is on
// screen; a drop and reduced motion land instantly. The fill is written as transform: scaleX only
// (put `fillRef` — a callback ref — on the fill and give it NO inline transform: React would
// overwrite the frame. A fill that mounts later is painted at the shown fraction on attach).
// Finite: the player's rAF runs only while a plan is in flight. No layout reads.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createBarPlayer } from '../lib/barPlan';

export function useLevelBar(level, frac = 0) {
  const lv = Number.isFinite(level) && level >= 1 ? Math.floor(level) : 1;
  const f = Number.isFinite(frac) ? Math.max(0, Math.min(1, frac)) : 0;
  const fillRef = useRef(null);
  const flashRef = useRef(false);
  const [shownLevel, setShownLevel] = useState(lv);
  const playerRef = useRef(null);
  if (playerRef.current === null) {
    playerRef.current = createBarPlayer({
      level: lv,
      frac: f,
      onLevel: (l) => setShownLevel(l),
      onFrame: (_l, v, phase) => {
        const el = fillRef.current;
        if (!el) return;
        el.style.transform = `scaleX(${v})`;
        const on = phase === 'flash';
        if (on !== flashRef.current) {
          flashRef.current = on;
          el.classList.toggle('is-levelflash', on);
        }
      },
    });
  }
  const mountedRef = useRef(false);
  useLayoutEffect(() => {
    const p = playerRef.current;
    if (!mountedRef.current) {
      mountedRef.current = true;
      p.set(lv, f); // first paint: land, nothing was gained
      return;
    }
    p.to(lv, f);
  }, [lv, f]);
  useEffect(() => () => playerRef.current && playerRef.current.cancel(), []);
  const attachFill = useCallback((el) => {
    fillRef.current = el;
    if (el && playerRef.current) el.style.transform = `scaleX(${playerRef.current.frac})`;
  }, []);
  return { fillRef: attachFill, shownLevel };
}
