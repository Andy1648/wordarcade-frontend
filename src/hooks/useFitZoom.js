// useFitZoom.js — scale a short FORM screen (name entry, join-by-code, the room lobby) to the
// viewport it is actually on.
//
// WHY NOT --app-scale. The app-wide zoom (main.jsx) is tuned for the in-game stage: it caps the
// scale at innerHeight / 1040, the stage's natural height. These screens are 500-800px tall, so
// that cap shrank them for no reason — to 0.60 at 1366x625, where a 13px label rendered at 7.8px —
// and on a 1920x1080 monitor held them at 1.04, a small box in the middle of a big screen. Andy +
// friends: "too small, don't scale enough, text hard to see".
//
// THE RULE. Zoom = the largest scale at which the box still fits (FILL_H of the height, FILL_W of
// the width), never below 1 (the design size, where every string already sits at or above its
// --fs-* token floor) and never above MAX. Phones (<= PHONE_MAX) keep their own CSS and zoom 1.
//
// PERF. The one layout read (getBoundingClientRect) runs on mount, on window resize and when the
// box's own content changes size (a player joins) — coalesced into one rAF — never per frame or
// per keystroke. The zoom is a plain style write.
import { useLayoutEffect } from 'react';

const FILL_H = 0.8;
const FILL_W = 0.9;
const MAX = 1.9;
const PHONE_MAX = 600; // matches main.jsx: phones never zoom

// `active` re-runs the fit when the box first mounts after an early `return null` (RoomScreen).
export default function useFitZoom(ref, active = true) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!active || !el || typeof window === 'undefined') return undefined;
    let z = 1;
    let raf = 0;

    const fit = () => {
      raf = 0;
      if (window.innerWidth <= PHONE_MAX) {
        if (z !== 1) {
          z = 1;
          el.style.removeProperty('zoom');
        }
        return;
      }
      const r = el.getBoundingClientRect(); // visual size, i.e. natural × the current zoom
      if (!r.width || !r.height) return;
      const natW = r.width / z;
      const natH = r.height / z;
      const next = Math.max(1, Math.min(MAX, (window.innerWidth * FILL_W) / natW, (window.innerHeight * FILL_H) / natH));
      if (Math.abs(next - z) > 0.01) {
        z = next;
        el.style.zoom = next.toFixed(3);
      }
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(fit);
    };

    fit();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
    if (ro) ro.observe(el);
    window.addEventListener('resize', schedule);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', schedule);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ref, active]);
}
