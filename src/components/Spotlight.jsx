// Spotlight.jsx — a ONE-STEP first-run coach mark (fix/logic-and-onboarding).
//
// Dims the screen, cuts a bright hole over one target element, and shows a single caption.
// Dismissed by the FIRST keystroke or pointer-down anywhere. Deliberately built so it can
// NEVER block that first input:
//   • the whole overlay is pointer-events:none — clicks/taps pass straight through to the app
//   • the dismiss listeners never call preventDefault/stopPropagation — the key/tap still
//     reaches the app (so the first keystroke both dismisses the coach mark AND counts)
//   • it never takes focus, so a game input keeps the caret
// It is a pure presentation layer: it reads/measures, it never gates app state.
//
// CAPTION PLACEMENT is anchored to the spotlit target, never to the viewport: the caption
// sits directly below the ring, horizontally centred ON THE RING, in the gap before the
// nearest interactive element below it. If that gap is too small for the caption it flips
// above the ring instead (this is why the menu XP-bar caption no longer lands on the game
// cards). All measurement is one-shot (mount / resize / fonts-ready), never per-frame.
//
// Props:
//   targetSelector : CSS selector of the element to spotlight (measured on mount + resize)
//   caption        : the single line of coach copy (the mode rule, or "TYPE OR CLICK ANYWHERE")
//   sub            : optional smaller line under the caption
//   onDismiss      : called once, on the first key/pointer (caller persists the "seen" flag)
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import './Spotlight.css';

const PAD = 8; // breathing room around the target inside the bright hole (matches the ring)
const GAP = 8; // gap between the ring edge and the caption
const CLEAR = 4; // min clearance the caption keeps from the neighbour it's tucked against
const EDGE = 10; // min distance the caption keeps from any viewport edge

// Elements the caption must never cover. Generic interactive controls: the menu's game cards
// are div[role=button][tabindex=0]; game/solo surfaces expose real inputs and buttons. We only
// avoid things sitting in the caption's own horizontal column, so corner-nav chips off to the
// side never push the caption around.
const INTERACTIVE =
  'a[href], button, input, textarea, select, [role="button"], [tabindex]:not([tabindex="-1"])';

export default function Spotlight({ targetSelector, caption, sub, onDismiss }) {
  const [rect, setRect] = useState(null); // {left,top,width,height,right,bottom} of the target, or null
  const [place, setPlace] = useState(null); // {top,left} px for the caption (anchored to the ring)
  const capRef = useRef(null);
  const doneRef = useRef(false);

  // Measure the target + choose the caption placement. Re-runs on resize, next frame (so a
  // just-mounted layout settles) and once web fonts load (Bungee changes the caption's size).
  useLayoutEffect(() => {
    let raf = 0;
    const measure = () => {
      const el = targetSelector ? document.querySelector(targetSelector) : null;
      if (!el) {
        setRect(null);
        setPlace(null);
        return;
      }
      const r = el.getBoundingClientRect();
      const target = {
        left: r.left,
        top: r.top,
        width: r.width,
        height: r.height,
        right: r.right,
        bottom: r.bottom,
      };
      setRect(target);

      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // The ring edges (the bright hole extends PAD beyond the target on every side).
      const ringTop = target.top - PAD;
      const ringBottom = target.bottom + PAD;
      const cx = target.left + target.width / 2;

      const rects = [];
      for (const e of document.querySelectorAll(INTERACTIVE)) {
        if (e === el || el.contains(e) || e.contains(el)) continue;
        const b = e.getBoundingClientRect();
        if (b.width > 0 && b.height > 0) rects.push(b);
      }

      // Room to the nearest interactive element that covers a SUBSTANTIAL slice of the caption's
      // column — a wide control (the menu's game cards, a game input) is a real vertical
      // obstacle; a corner chip that only grazes the column edge is not (we nudge horizontally
      // around those below). Falls back to the viewport edge when the column is otherwise clear.
      // roomFor() returns how tall a caption may be to fit below / above without covering one.
      const cap = capRef.current;
      const roomFor = (capW) => {
        const cxLeft = Math.max(EDGE + capW / 2, Math.min(cx, vw - EDGE - capW / 2));
        const bandL = cxLeft - capW / 2;
        const bandR = cxLeft + capW / 2;
        const blockSpan = Math.max(40, capW * 0.35);
        let belowLimit = vh;
        let aboveLimit = 0;
        for (const b of rects) {
          if (Math.min(bandR, b.right) - Math.max(bandL, b.left) < blockSpan) continue;
          if (b.top >= ringBottom) belowLimit = Math.min(belowLimit, b.top);
          else if (b.bottom <= ringTop) aboveLimit = Math.max(aboveLimit, b.bottom);
        }
        return {
          cxLeft,
          bandL,
          bandR,
          below: belowLimit - ringBottom - GAP - CLEAR,
          above: ringTop - aboveLimit - GAP - CLEAR,
        };
      };

      // Caption size as laid out. offsetWidth/offsetHeight ignore the appear-scale transform (a
      // scaled reading would mis-place it mid-animation). The caption's compact form on short
      // viewports (one line, no sub) is chosen by a CSS height media query — NOT toggled from
      // here — so this reads whatever size it actually is with nothing to fight React over.
      const capW = cap ? cap.offsetWidth : 0;
      const capH = cap ? cap.offsetHeight : 0;
      const room = roomFor(capW);
      const { cxLeft, bandL, bandR } = room;
      // Prefer below; flip above ONLY when below can't hold the caption and above can. As a last
      // resort (nothing fits either side) stay BELOW — never print across the ring/wordmark above.
      const below = capH <= room.below || capH > room.above;

      let top = below ? ringBottom + GAP : ringTop - GAP - capH;
      top = Math.max(EDGE, Math.min(top, vh - capH - EDGE));

      // NUDGE: keep the caption off any interactive control sitting in its own row (e.g. the
      // audio button that hugs the bar on mobile). Shift toward whichever side is clear, staying
      // as close to the ring centre as the free space allows.
      const capTop = top - 2;
      const capBot = top + capH + 2;
      let minLeft = EDGE;
      let maxRight = vw - EDGE;
      for (const b of rects) {
        if (b.bottom <= capTop || b.top >= capBot) continue; // not in the caption's row
        if (b.right <= bandL || b.left >= bandR) continue; // not intruding into the column
        if (b.left >= cx) maxRight = Math.min(maxRight, b.left - 4);
        else if (b.right <= cx) minLeft = Math.max(minLeft, b.right + 4);
        // an element straddling the ring centre can't be nudged around — leave it to the caller
      }
      let left = cxLeft;
      const lo = minLeft + capW / 2;
      const hi = maxRight - capW / 2;
      if (lo <= hi) left = Math.max(lo, Math.min(cx, hi));

      setPlace({ top, left });
    };

    measure();
    raf = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    // Bungee loading resizes the caption; re-place once fonts are ready.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure).catch(() => {});
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
    };
  }, [targetSelector, caption, sub]);

  // Dismiss on the FIRST key/pointer — without ever swallowing it (no preventDefault).
  useEffect(() => {
    const fire = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      onDismiss?.();
    };
    // capture:true so we hear it even if the app stops propagation later; passive so we
    // physically cannot preventDefault (the input is never blocked).
    window.addEventListener('keydown', fire, { capture: true, passive: true });
    window.addEventListener('pointerdown', fire, { capture: true, passive: true });
    return () => {
      window.removeEventListener('keydown', fire, { capture: true });
      window.removeEventListener('pointerdown', fire, { capture: true });
    };
  }, [onDismiss]);

  const holeStyle = rect
    ? {
        left: `${rect.left - PAD}px`,
        top: `${rect.top - PAD}px`,
        width: `${rect.width + PAD * 2}px`,
        height: `${rect.height + PAD * 2}px`,
      }
    : null;
  const capStyle = rect && place ? { top: `${place.top}px`, left: `${place.left}px` } : {}; // no target → caption centres via CSS

  return (
    <div className="spotlight-overlay" aria-hidden="true">
      {holeStyle ? (
        <div className="spotlight-hole" style={holeStyle} />
      ) : (
        <div className="spotlight-dim" />
      )}
      <div ref={capRef} className={`spotlight-caption${rect ? '' : ' is-centered'}`} style={capStyle}>
        <span className="spotlight-caption-text">{caption}</span>
        {sub && <span className="spotlight-caption-sub">{sub}</span>}
      </div>
    </div>
  );
}
