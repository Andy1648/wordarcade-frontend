// BackgroundScene.jsx
// A persistent, CSS-only animated backdrop rendered once in App (outside the
// view-switching logic) so it never unmounts/remounts between screens. It sits
// at z-index 0 behind every screen; all motion is pure CSS driven by inline
// custom properties.
//
// Everything here is STATIC module-level config (no Math.random, no state) so
// that frequent parent re-renders - e.g. the Word Bomb tension class flipping
// every second - never reposition or restart a fresh random layout. React just
// updates the `intensity` class on the container; the DOM nodes are stable.
import './BackgroundScene.css';

// A few organic blob border-radii so the splatters aren't perfect circles.
const BLOBS = [
  '42% 58% 63% 37% / 41% 44% 56% 59%',
  '63% 37% 54% 46% / 55% 48% 52% 45%',
  '38% 62% 47% 53% / 62% 41% 59% 38%',
];

// Drifting paint-splatter blobs. drift = the slow translate cycle (seconds,
// prime-ish so they never sync); spin = the slow continuous rotation. dx/dy is
// the drift amplitude. All low-opacity palette colours.
const SPLATTERS = [
  { left: 6,  top: 12, size: 110, color: '#FF2EC4', op: 0.09, dx: 28,  dy: 34,  drift: 19, spin: 71, rev: false, blob: 0 },
  { left: 82, top: 8,  size: 70,  color: '#2EFFE0', op: 0.08, dx: -30, dy: 26,  drift: 23, spin: 83, rev: true,  blob: 1 },
  { left: 14, top: 70, size: 120, color: '#FFE94A', op: 0.07, dx: 34,  dy: -22, drift: 29, spin: 67, rev: false, blob: 2 },
  { left: 88, top: 64, size: 90,  color: '#FF6B3D', op: 0.08, dx: -26, dy: -30, drift: 17, spin: 89, rev: true,  blob: 0 },
  { left: 46, top: 28, size: 50,  color: '#9A1AFF', op: 0.10, dx: 20,  dy: 24,  drift: 31, spin: 73, rev: false, blob: 1 },
  { left: 70, top: 42, size: 60,  color: '#2EFFE0', op: 0.07, dx: -22, dy: 28,  drift: 37, spin: 79, rev: true,  blob: 2 },
  { left: 30, top: 52, size: 80,  color: '#FF2EC4', op: 0.06, dx: 24,  dy: -20, drift: 41, spin: 61, rev: false, blob: 0 },
  { left: 60, top: 82, size: 100, color: '#FFE94A', op: 0.08, dx: -28, dy: -24, drift: 13, spin: 97, rev: true,  blob: 1 },
  { left: 3,  top: 44, size: 64,  color: '#FF6B3D', op: 0.09, dx: 30,  dy: 18,  drift: 43, spin: 59, rev: false, blob: 2 },
];

// Small particles that rise bottom -> top on their own loop (prime-ish secs).
const PARTICLES = [
  { left: 5,  size: 5, dur: 13, delay: 0,  color: '#FF2EC4', op: 0.12 },
  { left: 12, size: 4, dur: 17, delay: 3,  color: '#2EFFE0', op: 0.10 },
  { left: 21, size: 7, dur: 11, delay: 6,  color: '#FFE94A', op: 0.09 },
  { left: 29, size: 3, dur: 19, delay: 1,  color: '#FF6B3D', op: 0.13 },
  { left: 37, size: 6, dur: 23, delay: 8,  color: '#9A1AFF', op: 0.10 },
  { left: 44, size: 4, dur: 14, delay: 4,  color: '#2EFFE0', op: 0.11 },
  { left: 52, size: 8, dur: 18, delay: 11, color: '#FF2EC4', op: 0.08 },
  { left: 59, size: 5, dur: 12, delay: 2,  color: '#FFE94A', op: 0.12 },
  { left: 66, size: 3, dur: 21, delay: 7,  color: '#FF6B3D', op: 0.14 },
  { left: 73, size: 6, dur: 16, delay: 5,  color: '#2EFFE0', op: 0.09 },
  { left: 80, size: 4, dur: 13, delay: 9,  color: '#9A1AFF', op: 0.11 },
  { left: 87, size: 7, dur: 19, delay: 0,  color: '#FF2EC4', op: 0.10 },
  { left: 93, size: 5, dur: 15, delay: 6,  color: '#FFE94A', op: 0.12 },
  { left: 48, size: 4, dur: 22, delay: 10, color: '#FF6B3D', op: 0.10 },
  { left: 17, size: 6, dur: 20, delay: 12, color: '#2EFFE0', op: 0.09 },
];

// Thin diagonal "scratch" lines that scroll slowly across, horizontally.
const LINES = [
  { top: 22, angle: 36,  dur: 33, delay: 0,  color: '#2EFFE0' },
  { top: 54, angle: -42, dur: 37, delay: 6,  color: '#FF2EC4' },
  { top: 78, angle: 40,  dur: 41, delay: 13, color: '#FFE94A' },
];

// Clean Y2K/comic geometric shapes - outlined (coloured stroke, no fill) - that
// drift and spin independently. Each is a single inline-SVG node and reuses the
// splatter drift/spin keyframes via the same --dx/--dy/--drift-dur/--spin-dur.
const GEO_SHAPES = [
  { kind: 'triangle', left: 9,  top: 24, size: 56, color: '#FF2EC4', op: 0.10, dx: 22,  dy: 18,  drift: 23, spin: 47, rev: false },
  { kind: 'circle',   left: 85, top: 17, size: 46, color: '#2EFFE0', op: 0.10, dx: -20, dy: 24,  drift: 29, spin: 53, rev: true },
  { kind: 'square',   left: 79, top: 73, size: 50, color: '#FFE94A', op: 0.09, dx: -24, dy: -20, drift: 19, spin: 61, rev: false },
  { kind: 'star',     left: 15, top: 77, size: 62, color: '#9A1AFF', op: 0.11, dx: 26,  dy: -18, drift: 31, spin: 43, rev: true },
  { kind: 'diamond',  left: 49, top: 11, size: 42, color: '#FF6B3D', op: 0.11, dx: 18,  dy: 22,  drift: 37, spin: 59, rev: false },
  { kind: 'triangle', left: 62, top: 50, size: 46, color: '#2EFFE0', op: 0.08, dx: -22, dy: -16, drift: 41, spin: 67, rev: true },
];

// Stroke-only inner geometry for each shape kind (viewBox -50 -50 100 100).
function GeoInner({ kind, color }) {
  const stroke = { stroke: color, strokeWidth: 6, fill: 'none', strokeLinejoin: 'round' };
  switch (kind) {
    case 'circle':
      return <circle cx="0" cy="0" r="40" {...stroke} />;
    case 'square':
      return <rect x="-36" y="-36" width="72" height="72" rx="4" {...stroke} />;
    case 'diamond':
      return <polygon points="0,-44 38,0 0,44 -38,0" {...stroke} />;
    case 'star':
      return (
        <polygon
          points="0,-46 11.2,-15.4 43.7,-14.2 18.1,5.9 27,37.2 0,19 -27,37.2 -18.1,5.9 -43.7,-14.2 -11.2,-15.4"
          {...stroke}
        />
      );
    case 'triangle':
    default:
      return <polygon points="0,-42 42,38 -42,38" {...stroke} />;
  }
}

/**
 * @param {object} props
 * @param {'calm'|'warning'|'critical'} props.intensity - drives a tension class
 *   so the whole backdrop speeds up / reddens as a Word Bomb turn runs down.
 *   Defaults to the resting 'calm' on every non-game screen.
 */
export default function BackgroundScene({ intensity = 'calm' }) {
  return (
    <div className={`bg-scene ${intensity}`} aria-hidden="true">
      {/* Comic halftone dot texture, painted first so it sits behind the rest. */}
      <div className="bg-halftone" />

      {SPLATTERS.map((s, i) => (
        <div
          key={`s${i}`}
          className={`bg-splat${s.rev ? ' rev' : ''}`}
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            background: s.color,
            opacity: s.op,
            borderRadius: BLOBS[s.blob],
            '--dx': `${s.dx}px`,
            '--dy': `${s.dy}px`,
            '--drift-dur': `${s.drift}s`,
            '--spin-dur': `${s.spin}s`,
          }}
        />
      ))}

      {PARTICLES.map((p, i) => (
        <div
          key={`p${i}`}
          className="bg-particle"
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            background: p.color,
            '--p-op': p.op,
            '--dur': `${p.dur}s`,
            '--delay': `${p.delay}s`,
          }}
        />
      ))}

      {LINES.map((l, i) => (
        <div
          key={`l${i}`}
          className="bg-line"
          style={{
            top: `${l.top}%`,
            background: `linear-gradient(90deg, transparent, ${l.color}, transparent)`,
            '--angle': `${l.angle}deg`,
            '--dur': `${l.dur}s`,
            '--delay': `${l.delay}s`,
          }}
        />
      ))}

      {GEO_SHAPES.map((g, i) => (
        <svg
          key={`g${i}`}
          className={`bg-geo${g.rev ? ' rev' : ''}`}
          viewBox="-50 -50 100 100"
          aria-hidden="true"
          style={{
            left: `${g.left}%`,
            top: `${g.top}%`,
            width: `${g.size}px`,
            height: `${g.size}px`,
            opacity: g.op,
            '--dx': `${g.dx}px`,
            '--dy': `${g.dy}px`,
            '--drift-dur': `${g.drift}s`,
            '--spin-dur': `${g.spin}s`,
          }}
        >
          <GeoInner kind={g.kind} color={g.color} />
        </svg>
      ))}

      {/* Red tension wash - invisible until the .critical class pulses it. */}
      <div className="bg-red" />
    </div>
  );
}
