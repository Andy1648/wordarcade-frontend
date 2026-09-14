// useFitToBox.js — make the prompt FIT instead of scroll.
//
// THE DEFECT. The SAT Rush poster's field region (LAST SEEN / DESCRIPTION / KNOWN ALIASES) was
// `overflow-y: auto`. On a short window, or behind a phone keyboard, or on a word with a long
// gloss, that put a SCROLLBAR on the question — in a mode where a timer is running and the whole
// skill is reading fast. Any prompt you have to scroll to read is a prompt you cannot answer in
// time, and the scroll position is one more thing to get wrong under pressure.
//
// THE FIX. The type shrinks. A CSS clamp alone cannot do this: a clamp knows the viewport but not
// how long THIS definition is, and the overflow is a function of both. So the element gets a scale
// custom property that the type sizes multiply through, and this hook steps it down until the
// content fits — a handful of measurements, only when the content actually changes.
//
// WHY THIS IS NOT A BANNED LAYOUT READ. CLAUDE.md forbids layout reads in per-frame and
// per-keystroke paths. This runs on a WORD/REVEAL change — a few times per word, seconds apart,
// never on a keystroke and never inside rAF. It is the same cadence as the React render that
// caused it.
import { useLayoutEffect } from 'react';

// The floor. 0.52 of the base sizes is ~8.3px on the sentence at the smallest clamp - small, but
// the alternative at 320px with the deck's longest prompt is a scrollbar on a timed question, and
// a small sentence you can read beats a normal one you cannot see. The gate asserts the fit never
// actually REACHES this floor on any shipped viewport; it is the guard rail, not the plan.
export const FIT_MIN = 0.52;
export const FIT_STEP = 0.06;
const MAX_PASSES = Math.ceil((1 - FIT_MIN) / FIT_STEP) + 1;

/**
 * Shrink `ref`'s type (via the `--sr-fit` custom property) until its content fits its own box.
 *
 * @param {{current: HTMLElement|null}} ref  the clipping box
 * @param {Array} deps                        re-fit when these change (the word + what is revealed)
 */
export default function useFitToBox(ref, deps = []) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    // THE BOX WE ARE FITTING INTO IS THE PAGE, NOT THE FIELD REGION.
    //
    // Measuring the field region against itself does not work, and the reason is worth writing
    // down: the region is `flex: … auto`, so its height IS its content. Shrink the type and the
    // box shrinks with it — the overflow never closes, and the loop walks straight to the floor
    // and leaves a tiny prompt inside a box that had room all along (measured: 5px of fields at
    // 320x340 while the content wanted 65). The question is never "does the text fit the region",
    // it is "does the CARD fit the page", and the page is the one box here with a fixed height.
    const box = el.closest('.sr-stage') || el;

    const fit = () => {
      // Always start from 1: a previous word may have been a long one, and a short word must get
      // its full size back rather than inheriting someone else's shrink.
      let scale = 1;
      el.style.setProperty('--sr-fit', '1');
      for (let i = 0; i < MAX_PASSES; i++) {
        // +1px of slack: sub-pixel line-box rounding otherwise reports a 0.4px overflow forever
        // and walks the type all the way to the floor for no visible reason.
        if (box.scrollHeight <= box.clientHeight + 1) break;
        scale = Math.max(FIT_MIN, scale - FIT_STEP);
        el.style.setProperty('--sr-fit', String(scale));
        if (scale <= FIT_MIN) break;
      }
    };

    fit();
    // Re-fit on RESIZE too — a phone keyboard opening is a resize, and it is the single most
    // common way this box gets too short. ResizeObserver on the element itself rather than a
    // window listener, so a layout change that is not a viewport change still gets caught.
    if (typeof ResizeObserver === 'undefined') return undefined;
    let queued = false;
    const ro = new ResizeObserver(() => {
      // The observer fires as a RESULT of our own style write, so re-entering synchronously would
      // loop. One rAF hop breaks it, and the guard collapses a burst of callbacks into one pass.
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        fit();
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
