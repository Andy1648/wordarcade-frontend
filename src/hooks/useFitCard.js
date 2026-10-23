// useFitCard.js — keep an end card (the CHAIN / FUSE run-over card) inside the viewport on ANY screen, phones included.
// Andy oct21-22: nothing scrolls unless it is a list. The card's content varies by run (a third row of words, a gem chip that
// wraps, CONTRACT DONE, a level chest), so short-phone CSS alone left a 360x640 card 11–31px over on some runs. This
// measures the card's natural height and, only when it would overflow, shrinks it with `zoom` (layout-true, so it stays
// centred) down to MIN. useFitZoom deliberately leaves phones at 1; this is the end card's own backstop.
//
// PERF: the one layout read runs on mount, on window resize and when the card's own content changes size (ResizeObserver),
// coalesced into one rAF — never per frame or per keystroke. The zoom is a plain style write; nothing animates.
import { useLayoutEffect } from 'react';

const MIN = 0.85; // never below this: the 52px way-out pill stays a 44px touch target (and text at the type floor)
const EDGE = 16; // the scrim's padding + the card's hard shadow

export default function useFitCard(ref, active = true) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!active || !el || typeof window === 'undefined') return undefined;
    let raf = 0;
    let z = 1;
    const fit = () => {
      raf = 0;
      el.style.zoom = '';
      const h = el.offsetHeight; // natural height at zoom 1
      const avail = window.innerHeight - EDGE;
      const next = h > avail ? Math.max(MIN, avail / h) : 1;
      z = next;
      el.style.zoom = z < 1 ? String(Math.floor(z * 1000) / 1000) : '';
    };
    const queue = () => { if (!raf) raf = requestAnimationFrame(fit); };
    fit();
    window.addEventListener('resize', queue);
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => queue()) : null;
    if (ro) ro.observe(el);
    return () => {
      window.removeEventListener('resize', queue);
      if (ro) ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
      el.style.zoom = '';
    };
  }, [ref, active]);
}
