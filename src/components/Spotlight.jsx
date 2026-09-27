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
//   dim            : draw the dark wash over everything but the target (default true)
//   avoidSelector  : extra, NON-interactive elements the caption must not print over
//   avoidTextIn    : a root whose VISIBLE TEXT the caption must never cover (see below)
//   onDismiss      : called once, on the first key/pointer (caller persists the "seen" flag)
//
// WHY `dim` IS OPTIONAL. The wash is a 100vmax box-shadow at rgba(6,3,12,0.76) — it takes the whole
// screen down to about a quarter brightness. On the MENU that is right: it is picking one bar out of
// a dense grid of cards. On a GAME BOARD it is wrong, and badly so — the board is the only thing on
// screen, and dimming it meant the first frame a deep-link visitor ever saw (score, multiplier,
// timer ring, the letter) was washed out, which reads as a broken render or a transition that never
// resolved rather than as a coach mark. The keyline round the target and the caption are what teach;
// the wash only subtracts. Game surfaces pass dim={false}.
//
// WHY `avoidSelector` EXISTS. The placement pass treats only INTERACTIVE elements as obstacles, so
// on the solo board the caption happily printed on top of the chain row and the rule line beneath
// the input — plain divs, invisible to the old obstacle scan. A surface can now name its own
// content as something to place around.
//
// WHY `avoidTextIn` EXISTS. On the Word Bomb board the caption printed over the LIVE FEED, the
// bottom seats' names and (on a phone) the USED WORDS strip: all plain text, none interactive,
// and a board is TOO DENSE for "below, else above, else below anyway" to find a clear gap — at
// 8 players there is no row between the ring and the input at all. With a root named, placement
// becomes a slot search: below the ring, then above it, each nudged sideways into a gap between
// the text boxes in that row; the full caption first, then the headline alone. If NO slot is clear
// the caption is not drawn — the ring still marks the field, and a caption printed over the
// board's own copy is worse than none (the board's prompt already says what to type). Measured
// once per mount / resize / fonts-ready, never per frame, like everything else here.
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

// Every visible text box under `root`, as the ink's own Range rect clipped to the line box that
// lays it out (a Range reports the font's content area, which overhangs a line-height:1 line).
function textRects(root, skip) {
  const out = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    if (!t.textContent.trim()) continue;
    const el = t.parentElement;
    if (!el || (skip && skip.contains(el))) continue;
    if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
    let lineEl = el;
    while (lineEl !== root && getComputedStyle(lineEl).display === 'inline') lineEl = lineEl.parentElement;
    const line = lineEl.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(t);
    for (const r of range.getClientRects()) {
      const b = {
        left: Math.max(r.left, line.left),
        right: Math.min(r.right, line.right),
        top: Math.max(r.top, line.top),
        bottom: Math.min(r.bottom, line.bottom),
      };
      if (b.right - b.left >= 1 && b.bottom - b.top >= 1) out.push(b);
    }
  }
  return out;
}

export default function Spotlight({ targetSelector, caption, sub, onDismiss, dim = true, avoidSelector = null, avoidTextIn = null }) {
  const [rect, setRect] = useState(null); // {left,top,width,height,right,bottom} of the target, or null
  const [place, setPlace] = useState(null); // {top,left[,compact,hidden]} px for the caption (anchored to the ring)
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
      const obstacles = avoidSelector
        ? `${INTERACTIVE}, ${avoidSelector}`
        : INTERACTIVE;
      for (const e of document.querySelectorAll(obstacles)) {
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

      // TEXT-AWARE SLOT SEARCH (avoidTextIn) — see the header. Obstacles are every interactive
      // control plus every visible text box under the root; a slot is clear when no obstacle
      // comes within CLEAR px of it on both axes.
      const textRoot = avoidTextIn ? document.querySelector(avoidTextIn) : null;
      if (textRoot && capRef.current) {
        const cap = capRef.current;
        const textEl = cap.querySelector('.spotlight-caption-text');
        const subEl = cap.querySelector('.spotlight-caption-sub');
        // Measure the FULL caption even when the last pass made it compact (sub display:none).
        // The sub's inline style is not React-managed, so forcing it for one read and clearing it
        // cannot desync the className React owns. (is-hidden is `visibility`, which keeps size.)
        if (subEl) subEl.style.display = 'block';
        const fullW = cap.offsetWidth;
        const fullH = cap.offsetHeight;
        if (subEl) subEl.style.display = '';
        const obstacles = rects.concat(textRects(textRoot, cap));
        const forms = [{ compact: false, w: fullW, h: fullH }];
        if (subEl && textEl) forms.push({ compact: true, w: textEl.offsetWidth, h: textEl.offsetHeight });
        const slot = (w, h, top) => {
          if (top < EDGE || top + h > vh - EDGE) return null;
          // Free horizontal intervals in this row, then the one nearest the ring centre.
          const blocks = obstacles
            .filter((b) => b.bottom > top - CLEAR && b.top < top + h + CLEAR)
            .map((b) => [b.left - CLEAR, b.right + CLEAR])
            .sort((a, b) => a[0] - b[0]);
          let best = null;
          let x = EDGE;
          const consider = (lo, hi) => {
            if (hi - lo < w) return;
            const c = Math.max(lo + w / 2, Math.min(cx, hi - w / 2));
            if (!best || Math.abs(c - cx) < Math.abs(best - cx)) best = c;
          };
          for (const [l, r] of blocks) {
            consider(x, Math.min(l, vw - EDGE));
            x = Math.max(x, r);
          }
          consider(x, vw - EDGE);
          return best === null ? null : { top, left: best };
        };
        for (const f of forms) {
          const found = slot(f.w, f.h, ringBottom + GAP) || slot(f.w, f.h, ringTop - GAP - f.h);
          if (found) {
            setPlace({ ...found, compact: f.compact });
            return;
          }
        }
        setPlace({ top: 0, left: 0, hidden: true });
        return;
      }

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
  }, [targetSelector, caption, sub, avoidSelector, avoidTextIn]);

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
  // No clear slot (avoidTextIn): the ring alone. Still MOUNTED (hidden) so a resize can re-measure it.
  const capClass = `spotlight-caption${rect ? '' : ' is-centered'}${place && place.compact ? ' is-compact' : ''}${place && place.hidden ? ' is-hidden' : ''}`;

  return (
    <div className="spotlight-overlay" aria-hidden="true">
      {holeStyle ? (
        <div className={`spotlight-hole${dim ? '' : ' is-bare'}`} style={holeStyle} />
      ) : dim ? (
        <div className="spotlight-dim" />
      ) : null}
      <div ref={capRef} className={capClass} style={capStyle}>
        <span className="spotlight-caption-text">{caption}</span>
        {sub && <span className="spotlight-caption-sub">{sub}</span>}
      </div>
    </div>
  );
}
