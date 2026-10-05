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
 * @returns { hole: {left,top,width,height} | null, caption: { top: number|null, side: 'below'|'above'|'bottom'|'center' } }
 */
export function spotlightLayout(rect, vw, vh, capH = 0) {
  const center = { hole: null, caption: { top: null, side: 'center' } };
  if (!rect || !(rect.width > 0) || !(rect.height > 0) || !(vw > 0) || !(vh > 0)) return center;
  const left = clamp(rect.left - SPOT_PAD, 0, vw);
  const top = clamp(rect.top - SPOT_PAD, 0, vh);
  const right = clamp(rect.left + rect.width + SPOT_PAD, 0, vw);
  const bottom = clamp(rect.top + rect.height + SPOT_PAD, 0, vh);
  if (right - left < 1 || bottom - top < 1) return center; // scrolled fully off screen: no hole to cut
  const hole = { left, top, width: right - left, height: bottom - top };
  const h = Math.max(0, capH);
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
