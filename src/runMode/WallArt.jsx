// WallArt.jsx — THE WALL, authored as a real vector asset (ART VS MOTION: the bar is a
// drawn object with inked edges, graduated ticks and drips, never a CSS border box).
//
// It is drawn TWICE per bar, in two tones, so the ticks read at every fill height:
//   • the BACK copy, in the rule tone, sits under the fill and shows through the empty
//     part of the column;
//   • the FRONT copy, in the void tone, sits over the fill and inks the filled part.
// Neither copy animates — the only moving piece is the fill rectangle's scaleY.
//
// Authored at 84×600 and stretched (preserveAspectRatio="none"). Everything is a FILLED
// path, never a stroke, so a vertical stretch never changes an outline's weight.

// Deterministic jitter so the ticks are hand-cut, not machine-ruled — same drawing every
// render, different length on every tick.
function jit(i, span) {
  const n = Math.sin(i * 12.9898) * 43758.5453;
  return (n - Math.floor(n)) * span;
}

const H = 600;
const W = 84;

// One graduation. `p` is 0 (base) → 1 (target).
function tick(i, p, major, tone) {
  const y = H - p * H;
  const h = major ? 6 : 3.2;
  const len = major ? 30 + jit(i, 9) : 11 + jit(i + 7, 7);
  const right = major ? 15 + jit(i + 3, 6) : 0;
  return (
    <g key={`t${i}`} fill={tone}>
      <rect x="6" y={y - h / 2} width={len} height={h} />
      {major && <rect x={W - 6 - right} y={y - h / 2} width={right} height={h} />}
    </g>
  );
}

export default function WallArt({ tone = '#3c2260', className = '' }) {
  const ticks = [];
  // minors every 1/20th, majors every 1/4 — the graduated ruler you read the fill against.
  for (let i = 1; i < 20; i += 1) {
    const p = i / 20;
    const major = i % 5 === 0;
    ticks.push(tick(i, p, major, tone));
  }
  return (
    <svg className={className} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
      {/* left inked edge — wobbled, thicker at the base where the paint pooled */}
      <path fill={tone} d="M0 0 h7 l-1.4 96 l1.9 104 l-1.2 118 l1.6 122 l-1.1 96 l1.4 64 H0 Z" />
      {/* right inked edge — deliberately a different wobble, so the two sides disagree */}
      <path fill={tone} d={`M${W} 0 h-7 l1.1 88 l-1.7 112 l1.3 126 l-1.5 114 l1.2 100 l-1.1 60 H${W} Z`} />
      {/* TARGET cap — a double rule at the top of the column, the line you are climbing to,
          with two uneven drips running off it (overspray, not a ruled box). */}
      <rect fill={tone} x="0" y="0" width={W} height="9" />
      <path fill={tone} d="M18 9 h11 v27 a5.5 5.5 0 0 1 -11 0 Z" />
      <path fill={tone} d="M56 9 h8 v15 a4 4 0 0 1 -8 0 Z" />
      <rect fill={tone} x="6" y="17" width={W - 12} height="4" />
      {ticks}
      {/* base plinth — kept SLIM (a heavy one swallowed the trough band of paint entirely,
          so a 0-score run-over showed no accent at all on screen while the gate, which only
          counts boxes, happily saw one). */}
      <rect fill={tone} x="0" y={H - 7} width={W} height="7" />
    </svg>
  );
}
