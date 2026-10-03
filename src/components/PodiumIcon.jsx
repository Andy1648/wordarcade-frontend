// PodiumIcon.jsx — the leaderboard glyph (Andy oct3 11:42: "the trophy looks out of place next to the menu's
// bold, chunky, layered type — make it a PODIUM"). ONE symbol everywhere: the menu's golden button (desktop +
// phone), the LeaderboardScreen header, the rank-up card, the claim prompt.
//
// The fine-tune verdict (3 versions shot → review): a HYBRID — one inline SVG (version b) carrying the sticker
// die-cut (version c) inside it, no plate:
//   • a cream die-cut silhouette with a black keyline, tilted −2° (the wordmark's pose), one hard black shadow;
//   • three FILLED steps in podium order 2-1-3 — cyan / GOLD centre (tallest) / orange — on a dark plinth, each a
//     flat fill with a darker-shade outline;
//   • YOUR #rank standing on the top step, in Bungee: pink fill, black stroke, a thin cream keyline (die-cut, so it
//     joins the sticker) and a black offset copy. A star when you are not ranked yet.
// The steps are rectangles; the star is a vector path (CLAUDE.md ART VS MOTION).
//
// Motion (both FINITE, transform/opacity only, will-change only while playing, off under reduced motion):
//   glint — ONE light sweep across the steps when `glint` rises (the menu passes it once it has settled);
//   bump  — when `bump` = { from, to, key } changes: the icon jumps (peak at BUMP_PEAK_MS) and the number ticks.
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { formatNum } from '../format';
import './PodiumIcon.css';

// Geometry in the 100x100 viewBox. The die-cut adds CUT (cream) + KEY (black keyline) around every shape, and
// the shadow sits SHADOW further down-right, so the shapes leave 7 units at the left/top and 11 at the right.
const CUT = 4;
const KEY = 3;
const SHADOW = 4;
const LINE = 3.5; // each step's own outline
const STEPS = [
  { k: 'l', x: 7, y: 55, w: 27, h: 28, fill: '#2EFFE0', line: '#14a594' },
  { k: 'r', x: 62, y: 65, w: 27, h: 18, fill: '#FF6B3D', line: '#b8431f' },
  { k: 'c', x: 33, y: 41, w: 30, h: 42, fill: '#FFE94A', line: '#a8800f' },
];
const PLINTH = { k: 'p', x: 7, y: 81, w: 82, h: 8, fill: '#1a0b2e', line: '#0d0618' };
const SHAPES = [...STEPS, PLINTH];
const TOP = 41; // the gold step's top edge: the number stands on it
const TILT = -2;
// the number's own die-cut: a cream keyline NUM_CUT wide, then a black edge NUM_KEYLINE wide
const NUM_CUT = 4;
const NUM_KEYLINE = 2;
// the number's size (viewBox units) by character count, capped so the widest label still fits the box
const numUnits = (len) => Math.min(46, 92 / (len * 0.74));
// the 13px floor, against the RENDERED size (measured once on mount and on resize — never per frame)
const MIN_NUM_PX = 13;
// below this even the star is a speck: the glyph goes bare
const BARE_BELOW = 32;
// the bounce's jump peaks here (30% of BUMP_MS) — exported so the shot script can freeze on it
export const BUMP_MS = 680;
export const BUMP_PEAK_MS = Math.round(BUMP_MS * 0.3);
// a 5-point star standing on the top step (unranked), centred on x=48, foot on TOP
const STAR = 'M48 4 L54.5 16.6 L68.5 19 L58.6 29.2 L60.6 43.2 L48 37 L35.4 43.2 L37.4 29.2 L27.5 19 L41.5 16.6 Z';

// the rank as the podium prints it: "#9" … "#999", then compact without the "#" ("1.2K", "12K") so the widest
// label is 4 characters
export function podiumLabel(rank) {
  const n = Math.floor(Number(rank));
  if (!(n > 0)) return null;
  if (n < 1000) return `#${n}`;
  const k = n / 1000;
  // from 10K the shared formatter owns the unit — a floored thousand keeps it ≤ 4 chars ("12K", "999K",
  // "1.23M") and never doubles the suffix (the old `formatNum(k) + 'K'` printed "12.3KK" past 10M)
  return k < 10 ? `${Math.floor(k * 10) / 10}K` : formatNum(Math.floor(k) * 1000);
}

const reduced = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return true;
  }
};
// will-change ON for the life of an element's animations, OFF when the LAST one on it ends (overlapping tick
// pops on the one number node must not clear it under each other)
const running = new WeakMap();
function play(el, frames, opts) {
  if (!el || typeof el.animate !== 'function') return null;
  running.set(el, (running.get(el) || 0) + 1);
  el.style.willChange = 'transform, opacity';
  const a = el.animate(frames, opts);
  let ended = false;
  const off = () => {
    if (ended) return;
    ended = true;
    const n = (running.get(el) || 1) - 1;
    running.set(el, n);
    if (n <= 0) el.style.willChange = '';
  };
  a.onfinish = off;
  a.oncancel = off;
  return a;
}

// one shape, grown by `by` on every side (the die-cut layers)
const grow = (s, by) => ({ x: s.x - by, y: s.y - by, width: s.w + by * 2, height: s.h + by * 2 });

export default function PodiumIcon({ rank = null, size = null, glint = false, bump = null, className = '' }) {
  const uid = useId().replace(/:/g, '');
  const rootRef = useRef(null);
  const numRef = useRef(null);
  const glintRef = useRef(null);
  const [tickVal, setTickVal] = useState(null);
  // the rendered box width in px: from `size` when given, else measured (ResizeObserver: mount + resize only)
  const [boxPx, setBoxPx] = useState(typeof size === 'number' ? size : null);
  useEffect(() => {
    if (typeof size === 'number') { setBoxPx(size); return undefined; }
    const el = rootRef.current;
    if (!el || typeof ResizeObserver !== 'function') return undefined;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0] && entries[0].contentRect ? entries[0].contentRect.width : 0;
      if (w) setBoxPx(Math.round(w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [size]);

  const bare = boxPx != null && boxPx < BARE_BELOW;
  const shown = tickVal != null ? tickVal : rank;
  let label = podiumLabel(shown);
  // while ticking, size the number off the widest label of the tick (#12 → #9 stays one size until it lands)
  const fromLabel = bump && tickVal != null ? podiumLabel(bump.from) : null;
  const len = Math.max(2, label ? label.length : 1, fromLabel ? fromLabel.length : 0);
  const fs = numUnits(len);
  const numPx = boxPx != null ? (fs * boxPx) / 100 : null;
  // a number that would render under 13px wears the star instead
  if (label && numPx != null && numPx < MIN_NUM_PX) label = null;

  // ONE glint, on the rising edge only; a falling prop never cuts it short (only unmount cancels it)
  const glintAnim = useRef(null);
  useEffect(() => () => { if (glintAnim.current) glintAnim.current.cancel(); }, []);
  useEffect(() => {
    if (!glint || glintAnim.current || reduced()) return;
    glintAnim.current = play(glintRef.current, [
      { transform: 'translateX(0px) rotate(20deg)', opacity: 0 },
      { transform: 'translateX(60px) rotate(20deg)', opacity: 0.85, offset: 0.45 },
      { transform: 'translateX(140px) rotate(20deg)', opacity: 0 },
    ], { duration: 640, easing: 'linear' });
  }, [glint]);

  // the rank went up: jump + tick from → to (the caller shows `from` until this runs)
  const bumpKey = bump ? bump.key : null;
  useLayoutEffect(() => {
    if (!bump || reduced()) return undefined;
    const from = Number(bump.from);
    const to = Number(bump.to);
    const anims = [];
    const timers = [];
    // linear overall, eased PER KEYFRAME: the punch swells to its peak at 30% (BUMP_PEAK_MS), snaps back into a
    // squash and settles — so the peak is a real moment, not a blip 55 ms in. It grows from the icon's TOP edge
    // (transform-origin in PodiumIcon.css) and never travels up: at 1280x551 the golden button's top already sits
    // on the rebirth stars' baseline (stars y 10–28, button top 28), so any upward jump would hit them. The +5°
    // tilt lifts only the LEFT corner (~4px), over the frame ornament the button already overlaps at rest.
    anims.push(play(rootRef.current, [
      { transform: 'none', easing: 'cubic-bezier(.2,.7,.35,1)' },
      { transform: 'scale(1.18) rotate(5deg)', offset: 0.3, easing: 'cubic-bezier(.55,0,.8,.4)' },
      { transform: 'scale(1.06, 0.92)', offset: 0.55, easing: 'ease-out' },
      { transform: 'scale(0.98, 1.03)', offset: 0.75, easing: 'ease-in-out' },
      { transform: 'none' },
    ], { duration: BUMP_MS, easing: 'linear' }));
    if (from > to && to > 0) {
      // at most 8 steps so a big climb is still a quick tick (#40 → #9 does not crawl)
      const steps = Math.min(8, from - to);
      const vals = Array.from({ length: steps }, (_, i) => Math.round(from - ((from - to) * (i + 1)) / steps));
      setTickVal(from);
      vals.forEach((v, i) => {
        timers.push(setTimeout(() => {
          setTickVal(i === vals.length - 1 ? null : v);
          anims.push(play(numRef.current, [
            { transform: 'scale(1.3)', opacity: 0.6 },
            { transform: 'scale(1)', opacity: 1 },
          ], { duration: 140, easing: 'ease-out' }));
        }, 120 + i * 75));
      });
    }
    return () => {
      timers.forEach(clearTimeout);
      anims.forEach((a) => a && a.cancel());
      setTickVal(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bumpKey]);

  const style = typeof size === 'number' ? { width: size, height: size } : undefined;
  const clipId = `pi-clip-${uid}`;
  // the number (or the star) at a given layer: its die-cut layers go WITH the sticker's (under the steps), so
  // the number's cream keyline fuses with the step's die-cut instead of painting over the gold step
  const mark = (key, props) => {
    if (bare) return null;
    if (label) return <text key={key} x="48" y={TOP - 2} fontSize={fs.toFixed(1)} strokeLinejoin="round" {...props}>{label}</text>;
    return <path key={key} d={STAR} strokeLinejoin="round" {...props} />;
  };
  const numKey = 2 * (1.5 + NUM_CUT + NUM_KEYLINE); // black stroke: the outer edge of the number's die-cut
  const numCream = 2 * (1.5 + NUM_CUT); // cream stroke: the number's cream keyline

  return (
    <span
      ref={rootRef}
      className={`pi${bare ? ' is-bare' : ''}${className ? ` ${className}` : ''}`}
      style={style}
      data-bump-peak-ms={BUMP_PEAK_MS}
      data-num-px={label && numPx != null ? numPx.toFixed(1) : undefined}
      aria-hidden="true"
    >
      <svg className="pi-svg" viewBox="0 0 100 100" focusable="false">
        <defs>
          <clipPath id={clipId}>
            {STEPS.map((s) => <rect key={s.k} x={s.x} y={s.y} width={s.w} height={s.h} />)}
          </clipPath>
        </defs>
        <g className="pi-num-font" textAnchor="middle" transform={`rotate(${TILT} 50 60)`}>
          {/* the sticker: ONE hard shadow under the whole die-cut (steps + number), the black keyline, the cream */}
          <g fill="#000" stroke="#000" transform={`translate(${SHADOW} ${SHADOW})`}>
            {SHAPES.map((s) => <rect key={s.k} {...grow(s, CUT + KEY)} rx="5" strokeWidth="0" />)}
            {mark('ns', { strokeWidth: numKey })}
          </g>
          <g fill="#000" stroke="#000">
            {SHAPES.map((s) => <rect key={s.k} {...grow(s, CUT + KEY)} rx="5" strokeWidth="0" />)}
            {mark('nk', { strokeWidth: numKey })}
          </g>
          <g fill="#F0EAD9" stroke="#F0EAD9">
            {SHAPES.map((s) => <rect key={s.k} {...grow(s, CUT)} rx="3" strokeWidth="0" />)}
            {mark('nc', { strokeWidth: numCream })}
          </g>
          {/* the steps, printed on it: flat fill, darker-shade outline */}
          {SHAPES.map((s) => (
            <rect
              key={s.k}
              x={s.x + LINE / 2}
              y={s.y + LINE / 2}
              width={s.w - LINE}
              height={s.h - LINE}
              rx="1.5"
              fill={s.fill}
              stroke={s.line}
              strokeWidth={LINE}
            />
          ))}
          <g clipPath={`url(#${clipId})`}>
            <rect ref={glintRef} className="pi-glint" x="-30" y="20" width="16" height="90" fill="#fff" opacity="0" />
          </g>
          {/* the face: pink, black stroke outside the fill (the wordmark's ink) */}
          {!bare && <g ref={numRef} className="pi-num">{mark('nf', { fill: '#FF4FA3', stroke: '#000', strokeWidth: 3, paintOrder: 'stroke' })}</g>}
        </g>
      </svg>
    </span>
  );
}
