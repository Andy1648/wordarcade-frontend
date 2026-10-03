// PodiumIcon.jsx — the leaderboard glyph (Andy oct3 11:42: "the trophy looks out of place next to the menu's
// bold, chunky, layered type — make it a PODIUM"). Three FILLED steps in podium order 2-1-3 (gold centre, cyan
// silver, orange bronze) on a dark plinth, each a flat fill with a darker-shade outline and the hard black
// offset shadow — the LayeredWord / sticker look. YOUR #rank stands ON the top step as part of the icon (a
// star when you are not ranked yet). ONE symbol everywhere: the menu's golden button (desktop + phone), the
// LeaderboardScreen header, the rank-up card, the claim prompt.
//
// The steps are rectangles, so CSS / SVG rects are allowed (CLAUDE.md ART VS MOTION); the star is a vector path.
//
// THREE VERSIONS on one build, picked by ?biv=a|b|c (default a) for the fine-tune shoot:
//   a — pure-CSS bars (divs), each casting its own hard shadow onto the step beside it;
//   b — an inline SVG podium with ONE separate offset-shadow layer under the whole silhouette;
//   c — a sticker: the podium die-cut out of cream with a black keyline, tilted like the menu stickers.
//
// Motion (both FINITE, transform/opacity only, will-change only while playing, off under reduced motion):
//   glint — ONE light sweep across the steps when `glint` turns true (the menu passes it once it has settled);
//   bump  — when `bump` = { from, to, key } changes: the icon bounces and the number ticks from → to.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { formatNum } from '../format';
import './PodiumIcon.css';

export const PODIUM_VARIANTS = ['a', 'b', 'c'];
// read once: a fine-tune switch, not state
export const PODIUM_VARIANT = (() => {
  try {
    const v = new URLSearchParams(window.location.search).get('biv');
    return PODIUM_VARIANTS.includes(v) ? v : 'a';
  } catch {
    return 'a';
  }
})();

// Geometry in a 100x100 box (the CSS versions read it as %; the SVG uses it as user units). The centre step
// is drawn LAST so its outline is whole and (version a) its shadow falls on the bronze step.
const STEPS = [
  { k: 'l', x: 5, y: 50, w: 30, h: 35, fill: '#2EFFE0', line: '#14a594' },
  { k: 'r', x: 65, y: 62, w: 30, h: 23, fill: '#FF6B3D', line: '#b8431f' },
  { k: 'c', x: 34, y: 34, w: 32, h: 51, fill: '#FFE94A', line: '#a8800f' },
];
const PLINTH = { k: 'p', x: 2, y: 84, w: 94, h: 9, fill: '#1a0b2e', line: '#0d0618' };
const SHAPES = [...STEPS, PLINTH];
const SHADOW = 4; // the hard offset, in box units
const LINE = 4; // the outline width, in box units
// the numeral's size by character count ("#9" = 2), so "#800" still fits on the 54px phone icon
const NUM_SIZE = { 1: 40, 2: 40, 3: 34, 4: 28, 5: 23, 6: 19 };
// a 5-point star standing on the top step (unranked)
const STAR = 'M50 3 L57.6 17.4 L73.8 20.3 L62.4 32 L64.7 48.2 L50 41 L35.3 48.2 L37.6 32 L26.2 20.3 L42.4 17.4 Z';
// below this even the star is a speck: the glyph goes bare (no number, no star)
const BARE_BELOW = 32;
// the 13px floor: a number that would render smaller than this at a FIXED size shows the star instead
const MIN_NUM_PX = 13;
// the rank as the podium prints it: "#9" … "#999", then compact without the "#" ("1.2K", "12K") so the
// widest label is 4 characters and stays on the 13px floor on the 54px phone icon
export function podiumLabel(rank) {
  const n = Math.floor(Number(rank));
  if (!(n > 0)) return null;
  if (n < 1000) return `#${n}`;
  const k = n / 1000;
  return `${k < 10 ? (Math.floor(k * 10) / 10).toString() : formatNum(Math.floor(k))}K`;
}

const reduced = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return true;
  }
};
// will-change ON for the life of an animation, OFF at rest (CLAUDE.md ANIMATION BUDGET)
function play(el, frames, opts) {
  if (!el || typeof el.animate !== 'function') return null;
  el.style.willChange = 'transform, opacity';
  const a = el.animate(frames, opts);
  const off = () => { el.style.willChange = ''; };
  a.onfinish = off;
  a.oncancel = off;
  return a;
}

function Star({ cls }) {
  return (
    <svg className={cls} viewBox="22 0 58 52" aria-hidden="true" focusable="false">
      <path d={STAR} transform="translate(4 3)" fill="#000" />
      <path d={STAR} fill="#FF4FA3" stroke="#000" strokeWidth="4" strokeLinejoin="round" />
    </svg>
  );
}

// `plate`: a dark backing plate behind the steps (a/b) — for GOLD hosts (the golden button, the rank-up card),
// where the gold top step would otherwise vanish into the gold fill. c brings its own cream die-cut instead.
export default function PodiumIcon({ rank = null, size = null, variant = PODIUM_VARIANT, glint = false, bump = null, plate = false, className = '' }) {
  const rootRef = useRef(null);
  const numRef = useRef(null);
  const glintRef = useRef(null);
  const [tickVal, setTickVal] = useState(null);
  const bare = typeof size === 'number' && size < BARE_BELOW;
  const shown = tickVal != null ? tickVal : rank;
  let label = podiumLabel(shown);
  let len = label ? Math.min(6, label.length) : 1;
  // a fixed small size that would print the number under 13px wears the star instead
  if (label && typeof size === 'number' && (size * (NUM_SIZE[len] || 16)) / 100 < MIN_NUM_PX) { label = null; len = 1; }
  const plated = plate && variant !== 'c';

  // ONE glint when the caller says the screen has settled — started on the rising edge only, and never cut
  // short by the prop falling again (a rank-up arriving mid-sweep); only unmount cancels it
  const glintAnim = useRef(null);
  useEffect(() => () => { if (glintAnim.current) glintAnim.current.cancel(); }, []);
  useEffect(() => {
    if (!glint || glintAnim.current || reduced()) return;
    glintAnim.current = play(glintRef.current, [
      { transform: 'translateX(-160%) rotate(20deg)', opacity: 0 },
      { transform: 'translateX(120%) rotate(20deg)', opacity: 0.85, offset: 0.45 },
      { transform: 'translateX(420%) rotate(20deg)', opacity: 0 },
    ], { duration: 640, easing: 'cubic-bezier(.3,.6,.4,1)' });
  }, [glint]);

  // the rank went up: bounce + tick from → to (the number shows `from` until this runs)
  const bumpKey = bump ? bump.key : null;
  useLayoutEffect(() => {
    if (!bump || reduced()) return undefined;
    const from = Number(bump.from);
    const to = Number(bump.to);
    const anims = [];
    const timers = [];
    anims.push(play(rootRef.current, [
      { transform: 'none' },
      { transform: 'translateY(-16%) scale(1.2) rotate(-7deg)', offset: 0.3 },
      { transform: 'translateY(2%) scale(1.08, 0.9)', offset: 0.55 },
      { transform: 'translateY(-3%) scale(0.97, 1.04)', offset: 0.75 },
      { transform: 'none' },
    ], { duration: 680, easing: 'cubic-bezier(.2,.8,.3,1)' }));
    if (from > to && to > 0) {
      // at most 8 steps so a big climb is still a quick tick (#40 → #9 does not crawl)
      const steps = Math.min(8, from - to);
      const vals = Array.from({ length: steps }, (_, i) => Math.round(from - ((from - to) * (i + 1)) / steps));
      setTickVal(from);
      vals.forEach((v, i) => {
        timers.push(setTimeout(() => {
          setTickVal(i === vals.length - 1 ? null : v);
          anims.push(play(numRef.current, [
            { transform: 'scale(1.35)', opacity: 0.6 },
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
  const num = !bare && (label ? (
    <span ref={numRef} className="pi-num" data-len={len} aria-hidden="true">
      {variant === 'c' && <span className="pi-num-cut">{label}</span>}
      <span className="pi-num-shadow">{label}</span>
      <span className="pi-num-face">{label}</span>
    </span>
  ) : (
    <span ref={numRef} className="pi-num is-star" aria-hidden="true"><Star cls="pi-star" /></span>
  ));

  return (
    <span ref={rootRef} className={`pi pi-${variant}${bare ? ' is-bare' : ''}${plated ? ' has-plate' : ''}${className ? ` ${className}` : ''}`} style={style} aria-hidden="true">
      {plated && <span className="pi-plate" />}
      <span className="pi-stage">
        {variant === 'b' ? (
          <svg className="pi-svg" viewBox="0 0 100 100" focusable="false">
            {/* the ONE shadow layer: the whole silhouette, black, offset */}
            <g fill="#000" transform={`translate(${SHADOW} ${SHADOW})`}>
              {SHAPES.map((s) => <rect key={s.k} x={s.x} y={s.y} width={s.w} height={s.h} rx="2" />)}
            </g>
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
            {!bare && label && (
              <g ref={numRef} className="pi-svg-num" fontSize={NUM_SIZE[len] || 16} textAnchor="middle">
                <text x={50 + SHADOW * 0.75} y={31 + SHADOW * 0.75} fill="#000" stroke="#000" strokeWidth="4" strokeLinejoin="round">{label}</text>
                <text x="50" y="31" fill="#FF4FA3" stroke="#000" strokeWidth="4" strokeLinejoin="round" paintOrder="stroke">{label}</text>
              </g>
            )}
          </svg>
        ) : (
          <>
            {variant === 'c' && SHAPES.map((s) => (
              <span key={`k${s.k}`} className="pi-cut pi-cut-key" style={{ '--x': s.x, '--y': s.y, '--w': s.w, '--h': s.h }} />
            ))}
            {variant === 'c' && SHAPES.map((s) => (
              <span key={`c${s.k}`} className="pi-cut" style={{ '--x': s.x, '--y': s.y, '--w': s.w, '--h': s.h }} />
            ))}
            {SHAPES.map((s) => (
              <span key={s.k} className={`pi-step pi-step-${s.k}`} style={{ '--x': s.x, '--y': s.y, '--w': s.w, '--h': s.h, '--fill': s.fill, '--line': s.line }} />
            ))}
          </>
        )}
        {/* b draws its number inside the SVG; the star (unranked) is the same overlay in every version */}
        {variant === 'b' ? (!bare && !label && num) : num}
        <span className="pi-glint-clip"><span ref={glintRef} className="pi-glint" /></span>
      </span>
    </span>
  );
}
