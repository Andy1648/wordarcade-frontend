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
      const push = (e) => {
        if (e === el || el.contains(e) || e.contains(el)) return;
        if (e.closest('.spotlight-overlay')) return; // the coach mark is not its own obstacle
        const cs = getComputedStyle(e);
        if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) return;
        const b = e.getBoundingClientRect();
        if (b.width <= 0 || b.height <= 0) return;
        // WEIGHT BY TYPE SIZE. Covering four pixels of a 10px caption is not the same event
        // as covering four pixels of the 38px letter the whole mode is about, and an
        // unweighted area score treated them as interchangeable — which is how the search's
        // first cut still chose a spot over `.solo-center`, the required letter on a CHAIN
        // board. Bigger type is more expensive to cover, in proportion.
        const fs = parseFloat(cs.fontSize) || 16;
        rects.push({
          left: b.left, top: b.top, right: b.right, bottom: b.bottom,
          weight: 1 + fs / 16,
        });
      };
      for (const e of document.querySelectorAll(INTERACTIVE)) push(e);
      // TEXT IS AN OBSTACLE TOO, and until now it was not. This list was INTERACTIVE only —
      // links, buttons, inputs — so the caption was placed with no knowledge of any plain
      // text on the screen, and it landed on plain text in three places: "IT FILLS YOUR
      // LEVEL BAR" through "NEXT: CHROME FRAME LV 19" on the menu, and the sub through the
      // arm hint on both CHAIN and FUSE at 320x640. Nothing it collided with was a control,
      // which is precisely why the algorithm could not see any of it.
      // Leaves only (an element with children is a container, and its box is its children's),
      // and only ones with real text, so this stays a small list. Runs on mount / resize /
      // fonts-ready, never per frame.
      for (const e of document.querySelectorAll('body *')) {
        if (e.children.length) continue;
        if (!(e.textContent || '').trim()) continue;
        push(e);
      }

      // PLACEMENT IS A SEARCH NOW, NOT A HEURISTIC, and the reason is that the heuristic
      // could not express the thing that was going wrong. It asked two questions — "does the
      // caption fit below?" and "does it fit above?" — where "fit" meant clearing obstacles
      // that lie ENTIRELY above the ring or ENTIRELY below it, and it counted an obstacle
      // only if that obstacle covered 35% of the caption's column. Anything straddling the
      // ring, anything narrow, and anything in the band it finally chose was invisible to
      // it; and when neither side fitted it fell back to BELOW regardless of what was there.
      // Measured landings under that rule: the sub through "NEXT / BOLT FRAME / LV 3" on the
      // menu, the headline through CHAIN's arm hint, and the headline through `.solo-center`
      // — the required letter, the single most important glyph on a solo screen.
      //
      // So: propose candidate boxes, SCORE each by how much painted content it would cover,
      // and take the best. Ties break toward below-and-centred, which is where it used to go
      // and where it looks right when the screen has room. A screen with nowhere clean to
      // stand now picks the LEAST bad spot instead of the same bad spot every time.
      const cap = capRef.current;
      const capW = cap ? cap.offsetWidth : 0;
      const capH = cap ? cap.offsetHeight : 0;

      const clampL = (l) => Math.max(EDGE, Math.min(l, vw - capW - EDGE));
      const clampT = (t) => Math.max(EDGE, Math.min(t, vh - capH - EDGE));

      // Overlap AREA against every obstacle, plus a penalty for leaving the viewport. Area,
      // not a boolean: covering 4px of one label is genuinely better than covering a heading.
      const cost = (l, t) => {
        let c = 0;
        const r2 = { left: l, top: t, right: l + capW, bottom: t + capH };
        for (const b of rects) {
          const ov = Math.min(r2.right, b.right) - Math.max(r2.left, b.left);
          const oh = Math.min(r2.bottom, b.bottom) - Math.max(r2.top, b.top);
          if (ov > 0 && oh > 0) c += ov * oh * (b.weight || 1);
        }
        // never over the target's own ring: that is the thing being pointed at
        const rl = target.left - PAD;
        const rt = target.top - PAD;
        const rr = target.right + PAD;
        const rb = target.bottom + PAD;
        const rov = Math.min(r2.right, rr) - Math.max(r2.left, rl);
        const roh = Math.min(r2.bottom, rb) - Math.max(r2.top, rt);
        if (rov > 0 && roh > 0) c += rov * roh * 4;
        // and off-screen is worse than any overlap
        if (l < EDGE || t < EDGE || l + capW > vw - EDGE || t + capH > vh - EDGE) c += 1e7;
        return c;
      };

      const centred = clampL(cx - capW / 2);
      const belowTop = ringBottom + GAP;
      const aboveTop = ringTop - GAP - capH;
      const candidates = [];
      // the two canonical rows, then the same rows nudged sideways, then the far corners
      for (const t of [belowTop, aboveTop]) {
        for (const l of [centred, clampL(EDGE), clampL(vw - capW - EDGE), clampL(cx - capW / 2 - capW * 0.6), clampL(cx - capW / 2 + capW * 0.6)]) {
          candidates.push([l, clampT(t)]);
        }
      }
      // …and a real sweep, so a busy board still has somewhere to stand. Three columns down
      // the whole height at a third of the caption's own height: enough resolution to find a
      // gap between two lines of text, cheap enough to run once on mount.
      const step = Math.max(12, Math.round(capH / 3));
      for (const l of [centred, clampL(EDGE), clampL(vw - capW - EDGE)]) {
        for (let t = EDGE; t + capH <= vh - EDGE; t += step) candidates.push([l, t]);
      }

      let best = candidates[0];
      let bestCost = Infinity;
      for (const [l, t] of candidates) {
        // bias toward the canonical spot so an equally-clean alternative does not win on noise
        const bias = (t === clampT(belowTop) ? 0 : 60) + Math.abs(l - centred) * 0.5;
        const c = cost(l, t) + bias;
        if (c < bestCost) {
          bestCost = c;
          best = [l, t];
        }
      }
      const [left, top] = best;

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
  // `left` is now the caption's LEFT EDGE (the search works in boxes), so the centring
  // translate that the CSS applies for the no-target variant has to be cancelled here.
  const capStyle = rect && place
    ? { top: `${place.top}px`, left: `${place.left}px` }
    : {}; // no target → caption centres via CSS

  return (
    <div className="spotlight-overlay" aria-hidden="true">
      {holeStyle ? (
        <div className="spotlight-hole" style={holeStyle} />
      ) : (
        <div className="spotlight-dim" />
      )}
      <div
      ref={capRef}
      // `is-anchored` cancels the centring translate that only the no-target fallback wants.
      className={`spotlight-caption${rect ? ' is-anchored' : ' is-centered'}`}
      style={capStyle}
    >
        <span className="spotlight-caption-text">{caption}</span>
        {sub && <span className="spotlight-caption-sub">{sub}</span>}
      </div>
    </div>
  );
}
