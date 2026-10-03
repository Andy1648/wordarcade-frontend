// useCachedCenter.js — an element's centre, MEASURED ONCE and cached (CLAUDE.md ANIMATION BUDGET:
// "No layout reads in any per-frame or per-keystroke path. Measure once on mount/resize and cache;
// spawns are pure writes").
//
// The Word Bomb accept used to call getBoundingClientRect() on the input for EVERY accepted word,
// forcing a synchronous layout on the hottest path in the game. Now the rect is taken by a
// ResizeObserver (its initial delivery = "on mount", then on any size change of the element, its
// parent or the page) and by window resize / visualViewport resize (the phone keyboard). The
// accept path calls the returned getter, which is a plain object read — zero layout.
//
// The element can be swapped by React (a remount between turns); the per-commit effect only
// compares IDENTITY (no layout) and re-observes when it changes.
import { useCallback, useEffect, useRef } from 'react';

/** Pure: a DOMRect-like box -> { x, y, w, h } centre record. Exported for the unit test. */
export function centreOf(r) {
  if (!r) return null;
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
}

export function useCachedCenter(ref) {
  const entryRef = useRef(null); // { el, centre, ro }

  // Every commit: identity check only. Measuring happens in the observer callbacks.
  useEffect(() => {
    const el = ref && ref.current;
    const cur = entryRef.current;
    if (cur && cur.el === el) return;
    if (cur && cur.ro) cur.ro.disconnect();
    if (!el) {
      entryRef.current = null;
      return;
    }
    const entry = { el, centre: null, ro: null };
    entryRef.current = entry;
    const measure = () => {
      if (entryRef.current !== entry) return;
      try {
        entry.centre = centreOf(el.getBoundingClientRect());
      } catch {
        /* detached */
      }
    };
    if (typeof ResizeObserver === 'function') {
      // The initial observation fires after layout, before paint: this IS the on-mount measure.
      entry.ro = new ResizeObserver(measure);
      entry.ro.observe(el);
      if (el.parentElement) entry.ro.observe(el.parentElement);
      if (typeof document !== 'undefined' && document.body) entry.ro.observe(document.body);
    } else {
      measure();
    }
  });

  // Window-level geometry changes (resize, rotation, the on-screen keyboard) and focus (a new turn
  // focuses the field — once per turn, never per key) re-measure the current element.
  useEffect(() => {
    const re = () => {
      const e = entryRef.current;
      if (!e) return;
      try {
        e.centre = centreOf(e.el.getBoundingClientRect());
      } catch {
        /* detached */
      }
    };
    window.addEventListener('resize', re, { passive: true });
    window.addEventListener('orientationchange', re, { passive: true });
    const vv = window.visualViewport;
    if (vv) vv.addEventListener('resize', re, { passive: true });
    document.addEventListener('focusin', re, { passive: true });
    return () => {
      window.removeEventListener('resize', re);
      window.removeEventListener('orientationchange', re);
      if (vv) vv.removeEventListener('resize', re);
      document.removeEventListener('focusin', re);
      const e = entryRef.current;
      if (e && e.ro) e.ro.disconnect();
      entryRef.current = null;
    };
  }, []);

  // The getter the hot path calls: a plain read, never a layout.
  return useCallback(() => (entryRef.current ? entryRef.current.centre : null), []);
}
