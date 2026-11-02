// spotlightLayout.js — PURE geometry for the spotlight tutorial: the bright hole (the target's rect plus a
// pad, clamped to the viewport) and where the one line sits (below the hole, else above, else pinned to the
// bottom edge). No DOM: the component measures ONCE on show and on resize and hands the numbers in here.

export const SPOT_PAD = 8; // breathing room round the target inside the hole (the glow ring sits on this edge)
export const SPOT_GAP = 16; // hole edge → line
export const SPOT_EDGE = 16; // min distance the line keeps from the viewport's top / bottom

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * @param rect   the target's getBoundingClientRect() (or null when there is no target)
 * @param vw,vh  the viewport size
 * @param capH   the line's laid-out height (0 when unknown)
 * @param pad    the hole's margin round the target (a target that GROWS on hover — a rail tile — gets more, so it
 *               never pops out past the ring)
 * @param clearBottom (optional) the bottom edge of content ABOVE the hole that the line must never cover (a tutorial's
 *               `clear` element — the ROLL screen's reel). The line then lives in the BAND between that edge and the
 *               hole, hugging the hole; `caption.room` is the band's height, which the component fits the line into.
 * @returns { hole: {left,top,width,height} | null, caption: { top: number|null, side: 'below'|'above'|'bottom'|'center', room?: number } }
 */
export function spotlightLayout(rect, vw, vh, capH = 0, pad = SPOT_PAD, clearBottom = null) {
  const center = { hole: null, caption: { top: null, side: 'center' } };
  if (!rect || !(rect.width > 0) || !(rect.height > 0) || !(vw > 0) || !(vh > 0)) return center;
  const left = clamp(rect.left - pad, 0, vw);
  const top = clamp(rect.top - pad, 0, vh);
  const right = clamp(rect.left + rect.width + pad, 0, vw);
  const bottom = clamp(rect.top + rect.height + pad, 0, vh);
  if (right - left < 1 || bottom - top < 1) return center; // scrolled fully off screen: no hole to cut
  const hole = { left, top, width: right - left, height: bottom - top };
  const h = Math.max(0, capH);
  // OVERLAP AUDIT #2 (#5): the first-roll line sat "above" ROLL right on the FOUND chips. With a `clear` edge the line
  // takes the band between that content and the hole — its bottom a GAP above the hole; if it is still taller than the
  // band (the component already shrank it to its floor), its top holds the band's top instead: the cleared content is
  // never covered, and the line never reaches the ring.
  if (clearBottom != null && Number.isFinite(clearBottom) && clearBottom < top) {
    const bandTop = Math.max(SPOT_EDGE, clearBottom + SPOT_GAP);
    const room = Math.max(0, top - SPOT_GAP - bandTop);
    return { hole, caption: { top: Math.max(bandTop, top - SPOT_GAP - h), side: 'above', room } };
  }
  const below = bottom + SPOT_GAP;
  if (below + h <= vh - SPOT_EDGE) return { hole, caption: { top: below, side: 'below' } };
  const above = top - SPOT_GAP - h;
  if (above >= SPOT_EDGE) return { hole, caption: { top: above, side: 'above' } };
  // a target taller than the screen allows either side: the line rides the bottom edge, over the dim
  return { hole, caption: { top: Math.max(SPOT_EDGE, vh - SPOT_EDGE - h), side: 'bottom' } };
}

/** DOM helper (not pure — only called on show / resize / when picking a tutorial): the first VISIBLE match
 *  of `selector` (the menu renders a desktop and a phone tree; one of them is display:none), or null. */
export function findVisibleTarget(selector) {
  if (!selector || typeof document === 'undefined') return null;
  try {
    for (const n of document.querySelectorAll(selector)) {
      const r = n.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return n;
    }
  } catch { /* bad selector → no target */ }
  return null;
}
export const hasVisibleTarget = (selector) => !!findVisibleTarget(selector);
