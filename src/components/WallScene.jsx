// WallScene.jsx
// A persistent, CSS+inline-SVG graffiti alley wall rendered once in App (outside
// the view-switching logic) so it never unmounts/remounts between screens. It
// sits at z-index 0 behind every screen: a brick wall covered in spray-painted
// tags, stickers, paint drips and urban grime, onto which the game cards / panels
// read like flyers taped up over the top.
//
// Everything here is STATIC module-level config (no Math.random, no state) so a
// frequent parent re-render - e.g. the Word Bomb tension class flipping every
// second - never reshuffles a fresh random layout. React just swaps the
// `intensity` class on the container; the DOM nodes are stable.
import './WallScene.css';

// The graffiti palette + a darker shade of each fill used as its colored
// outline (never black - per the project's colored-outline rule).
const PINK = { fill: '#FF2EC4', line: '#991A75' };
const CYAN = { fill: '#2EFFE0', line: '#1A9985' };
const YELLOW = { fill: '#FFE94A', line: '#B8A020' };
const ORANGE = { fill: '#FF6B3D', line: '#B83D15' };
const PURPLE = { fill: '#9A1AFF', line: '#5A0EAA' };

// 12 spray-painted words scattered across the wall at varied sizes/angles. Each
// carries its palette pair, position (% of viewport), font size, rotation and an
// optional paint-drip length below it. Opacities sit in the 0.12-0.2 band.
const TAGS = [
  { word: 'WORD', c: PINK,   size: 46, rot: -12, top: 7,  left: 5,  op: 0.18, drip: 34 },
  { word: 'BOOM', c: YELLOW, size: 40, rot: 14,  top: 16, left: 71, op: 0.16, drip: 0 },
  { word: 'POW',  c: CYAN,   size: 34, rot: -24, top: 31, left: 18, op: 0.15, drip: 26 },
  { word: 'ZAP',  c: ORANGE, size: 30, rot: 18,  top: 45, left: 83, op: 0.17, drip: 0 },
  { word: 'FIRE', c: PURPLE, size: 42, rot: -8,  top: 60, left: 6,  op: 0.16, drip: 38 },
  { word: 'GG',   c: YELLOW, size: 28, rot: 26,  top: 11, left: 43, op: 0.14, drip: 0 },
  { word: 'EZ',   c: CYAN,   size: 26, rot: -28, top: 72, left: 58, op: 0.15, drip: 22 },
  { word: 'WOW',  c: PINK,   size: 36, rot: 10,  top: 82, left: 28, op: 0.17, drip: 30 },
  { word: 'EPIC', c: ORANGE, size: 32, rot: -16, top: 26, left: 87, op: 0.13, drip: 0 },
  { word: 'RIP',  c: PURPLE, size: 30, rot: 22,  top: 87, left: 78, op: 0.16, drip: 24 },
  { word: 'YOLO', c: YELLOW, size: 34, rot: -6,  top: 51, left: 46, op: 0.12, drip: 0 },
  { word: 'NOOB', c: CYAN,   size: 28, rot: 16,  top: 65, left: 90, op: 0.15, drip: 28 },
];

// Six decorative stickers slapped on the wall (kind drives the inline SVG body).
// Flat fill + a thick darker-shade outline, slight rotation, low opacity, each
// with its own slow drift cycle (dx/dy amplitude in px, dur in seconds).
const STICKERS = [
  { kind: 'star',    c: YELLOW, size: 42, rot: -14, top: 22, left: 30, op: 0.22, dx: 12,  dy: 10,  dur: 17 },
  { kind: 'bolt',    c: CYAN,   size: 40, rot: 18,  top: 14, left: 84, op: 0.20, dx: -10, dy: 12,  dur: 21 },
  { kind: 'skull',   c: PINK,   size: 44, rot: -8,  top: 68, left: 14, op: 0.18, dx: 11,  dy: -9,  dur: 19 },
  { kind: 'crown',   c: ORANGE, size: 45, rot: 12,  top: 40, left: 62, op: 0.21, dx: -12, dy: -8,  dur: 23 },
  { kind: 'arrow',   c: PURPLE, size: 38, rot: -22, top: 78, left: 50, op: 0.17, dx: 13,  dy: 9,   dur: 15 },
  { kind: 'speech',  c: PINK,   size: 44, rot: 8,   top: 35, left: 8,  op: 0.19, dx: -9,  dy: 11,  dur: 25 },
];

// Five dried vertical paint streaks running down from the top of the wall.
// Different heights + widths, static (no animation - dried paint).
const DRIPS = [
  { left: 22, w: 3, h: 180, c: PINK,   op: 0.13 },
  { left: 41, w: 2, h: 120, c: CYAN,   op: 0.11 },
  { left: 58, w: 4, h: 240, c: YELLOW, op: 0.12 },
  { left: 74, w: 3, h: 150, c: ORANGE, op: 0.14 },
  { left: 90, w: 2, h: 200, c: PURPLE, op: 0.10 },
];

// Inline SVG body for each sticker kind (viewBox -50 -50 100 100). Flat fill +
// thick colored (darker-shade) outline.
function StickerInner({ kind, fill, line }) {
  const s = { fill, stroke: line, strokeWidth: 3, strokeLinejoin: 'round', strokeLinecap: 'round' };
  switch (kind) {
    case 'bolt':
      return <polygon points="10,-46 -22,8 -2,8 -12,46 24,-10 2,-10" {...s} />;
    case 'skull':
      return (
        <g {...s}>
          <path d="M-26 -18 C-26 -42 26 -42 26 -18 L26 6 C26 16 16 20 10 22 L10 32 L-10 32 L-10 22 C-16 20 -26 16 -26 6 Z" />
          <circle cx="-12" cy="-6" r="7" fill={line} stroke="none" />
          <circle cx="12" cy="-6" r="7" fill={line} stroke="none" />
          <polygon points="0,4 -5,16 5,16" fill={line} stroke="none" />
        </g>
      );
    case 'crown':
      return <polygon points="-38,28 -30,-22 -12,6 0,-30 12,6 30,-22 38,28" {...s} />;
    case 'arrow':
      return (
        <g {...s}>
          <line x1="-34" y1="0" x2="26" y2="0" />
          <polyline points="6,-22 30,0 6,22" fill="none" />
        </g>
      );
    case 'speech':
      return (
        <g>
          <path d="M-40 -30 L40 -30 L40 18 L-2 18 L-20 38 L-16 18 L-40 18 Z" {...s} />
          <text x="0" y="2" textAnchor="middle" dominantBaseline="central"
            fontFamily="'Bungee', cursive" fontSize="26" fill={line} stroke="none">!!!</text>
        </g>
      );
    case 'star':
    default:
      return (
        <polygon
          points="0,-46 11.2,-15.4 43.7,-14.2 18.1,5.9 27,37.2 0,19 -27,37.2 -18.1,5.9 -43.7,-14.2 -11.2,-15.4"
          {...s}
        />
      );
  }
}

/**
 * @param {object} props
 * @param {'calm'|'warning'|'critical'} props.intensity - drives a tension class
 *   so the wall reddens (and its stickers drift a touch faster) as a Word Bomb
 *   turn runs down. Defaults to the resting 'calm' on every non-game screen.
 */
export default function WallScene({ intensity = 'calm' }) {
  return (
    <div className={`wall-scene ${intensity}`} aria-hidden="true">
      {/* Brick courses + mortar, painted first, behind everything. */}
      <div className="wall-bricks" />
      {/* The one allowed environmental gradient: a subtle darkening toward the
          bottom of the alley. */}
      <div className="wall-floor-shade" />

      {/* Horizontal pipe running across the upper portion of the wall. */}
      <svg className="wall-pipe" viewBox="0 0 1000 40" preserveAspectRatio="none" aria-hidden="true">
        <rect x="0" y="10" width="1000" height="20" fill="#1c1230" stroke="#0a0414" strokeWidth="4" />
        <rect x="120" y="4" width="26" height="32" fill="#241636" stroke="#0a0414" strokeWidth="4" />
        <rect x="820" y="4" width="26" height="32" fill="#241636" stroke="#0a0414" strokeWidth="4" />
      </svg>

      {/* A thin jagged crack down the wall. */}
      <svg className="wall-crack" viewBox="0 0 200 600" preserveAspectRatio="none" aria-hidden="true">
        <path
          d="M120 0 L128 70 L112 130 L130 190 L116 250 L134 320 L118 390 L138 470 L120 540 L132 600"
          fill="none" stroke="#000" strokeWidth="2.5"
        />
      </svg>

      {/* Dried vertical paint drips. */}
      {DRIPS.map((d, i) => (
        <div
          key={`drip${i}`}
          className="wall-paint-drip"
          style={{
            left: `${d.left}%`,
            width: `${d.w}px`,
            height: `${d.h}px`,
            background: d.c.fill,
            opacity: d.op,
          }}
        />
      ))}

      {/* Spray-painted graffiti tags (Bungee, colored text-stroke, some dripping). */}
      {TAGS.map((t, i) => (
        <div
          key={`tag${i}`}
          className="wall-tag"
          style={{
            top: `${t.top}%`,
            left: `${t.left}%`,
            fontSize: `${t.size}px`,
            color: t.c.fill,
            opacity: t.op,
            WebkitTextStroke: `${Math.max(2, t.size / 14)}px ${t.c.line}`,
            transform: `rotate(${t.rot}deg)`,
          }}
        >
          {t.word}
          {t.drip > 0 && (
            <span
              className="wall-tag-drip"
              style={{ height: `${t.drip}px`, background: t.c.fill }}
            />
          )}
        </div>
      ))}

      {/* Stickers - each its own drifting inline SVG. */}
      {STICKERS.map((st, i) => (
        <svg
          key={`stk${i}`}
          className="wall-sticker"
          viewBox="-50 -50 100 100"
          aria-hidden="true"
          style={{
            top: `${st.top}%`,
            left: `${st.left}%`,
            width: `${st.size}px`,
            height: `${st.size}px`,
            opacity: st.op,
            '--rot': `${st.rot}deg`,
            '--dx': `${st.dx}px`,
            '--dy': `${st.dy}px`,
            '--dur': `${st.dur}s`,
          }}
        >
          <StickerInner kind={st.kind} fill={st.c.fill} line={st.c.line} />
        </svg>
      ))}

      {/* Comic halftone dot texture over the wall (its opacity breathes with
          the music's mid frequencies via --beat-mid). */}
      <div className="wall-halftone" />

      {/* Whole-wall brightness flash on each detected beat (very subtle white). */}
      <div className="wall-beat-bright" />

      {/* Red tension wash - invisible until the .critical class pulses it. */}
      <div className="wall-red" />
    </div>
  );
}
