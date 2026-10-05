// PodiumIcon.jsx — the leaderboard glyph. ONE symbol everywhere: the menu's golden button (desktop + phone), the
// LeaderboardScreen header, the rank-up card, the claim prompt.
//
// less-is-more (Andy oct3 17:45): "the podium's colours don't match the theme. Make it SIMPLE, in the game's art
// style and palette (same ink/outline/shadow as the other menu icons), not multicolour." So it is ONE ink:
//   • three steps in podium order 2-1-3, filled with the button's INK (currentColor — dark on the golden desktop
//     button, yellow on the phone's panel slab), a black outline, and ONE hard black offset shadow;
//   • YOUR #rank standing on the top step in Bungee, the same ink, black stroke + the same black shadow.
// Gone: the cream die-cut sticker, the cyan/gold/orange steps, the pink number, the plinth, the star, the glint.
// The steps are rectangles (CLAUDE.md ART VS MOTION).
//
// Motion (FINITE, transform/opacity only, will-change only while playing, off under reduced motion):
//   bump — when `bump` = { from, to, key } changes: the icon jumps (peak at BUMP_PEAK_MS) and the number ticks.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { formatNum } from '../format';
import './PodiumIcon.css';
import { reduceMotion } from '../lib/reduceMotion';

// Geometry in the 100x100 viewBox: the steps leave room for the outline + the shadow at the right/bottom.
const LINE = 4; // the black outline (centred on each edge)
const SHADOW = 5; // the hard black offset shadow
const STEPS = [
  { k: 'l', x: 8, y: 58, w: 28, h: 30 },
  { k: 'c', x: 36, y: 42, w: 28, h: 46 },
  { k: 'r', x: 64, y: 68, w: 28, h: 20 },
];
const SILHOUETTE = 'M8 58 H36 V42 H64 V68 H92 V88 H8 Z';
const TOP = 42; // the centre step's top edge: the number stands on it
// the number's size (viewBox units) by character count, capped so the widest label still fits the box
const numUnits = (len) => Math.min(40, 92 / (len * 0.74));
// the 13px floor, against the RENDERED size (measured once on mount and on resize — never per frame)
const MIN_NUM_PX = 13;
// below this the number would be a speck: the glyph goes bare (steps only)
const BARE_BELOW = 32;
// the bounce's jump peaks here (30% of BUMP_MS) — exported so the shot script can freeze on it
export const BUMP_MS = 680;
export const BUMP_PEAK_MS = Math.round(BUMP_MS * 0.3);

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

const reduced = reduceMotion; // the in-game REDUCE MOTION toggle, not the OS
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

export default function PodiumIcon({ rank = null, size = null, bump = null, className = '' }) {
  const rootRef = useRef(null);
  const numRef = useRef(null);
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
  // a number that would render under 13px is dropped (the steps alone still read as the leaderboard)
  if (bare || (label && numPx != null && numPx < MIN_NUM_PX)) label = null;

  // the rank went up: jump + tick from → to (the caller shows `from` until this runs)
  const bumpKey = bump ? bump.key : null;
  useLayoutEffect(() => {
    if (!bump || reduced()) return undefined;
    const from = Number(bump.from);
    const to = Number(bump.to);
    const anims = [];
    const timers = [];
    // linear overall, eased PER KEYFRAME: the punch swells to its peak at 30% (BUMP_PEAK_MS), snaps back into a
    // squash and settles. It grows from the icon's TOP edge (transform-origin in PodiumIcon.css) and never
    // travels up: the golden button's top sits on the rebirth stars' baseline at short windows.
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
  const num = (props) => (
    <text x="50" y={TOP - 4} fontSize={fs.toFixed(1)} strokeLinejoin="round" {...props}>{label}</text>
  );

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
        <g className="pi-num-font" textAnchor="middle">
          {/* ONE hard black shadow under the steps and the number */}
          <g fill="#000" stroke="#000" transform={`translate(${SHADOW} ${SHADOW})`}>
            <path d={SILHOUETTE} strokeWidth={LINE} strokeLinejoin="round" />
            {label && num({ strokeWidth: 6 })}
          </g>
          {/* the steps: the button's ink, black outline */}
          {STEPS.map((s) => (
            <rect key={s.k} x={s.x} y={s.y} width={s.w} height={s.h} fill="currentColor" stroke="#000" strokeWidth={LINE} strokeLinejoin="round" />
          ))}
          {/* the rank, standing on the top step: same ink, black stroke outside the fill */}
          {label && <g ref={numRef} className="pi-num">{num({ fill: 'currentColor', stroke: '#000', strokeWidth: 6, paintOrder: 'stroke' })}</g>}
        </g>
      </svg>
    </span>
  );
}
