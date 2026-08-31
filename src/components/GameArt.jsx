// GameArt.jsx
// One exported component per game's card SCENE — the ART-LED v2 poster
// compositions ported from the approved prototype (proto/cards-3). Each scene is
// authored at 300×400 (3:4) and SLICED to cover the card, so elements run off the
// frame on purpose. COMPOSITION RULE (the SAT RUSH standard): a structure runs
// edge-to-edge behind, the hero object overlaps it, secondary elements ATTACH to
// that structure — never an object floating in a flat colour field. Flat fills
// only (no gradients/blur); the tonal "wedges" are separate flat shapes.
//
// These scenes are STATIC — no idle CSS loops (menu motion law). GameCard looks
// them up by name via the `artKey` field in gameData.js.
import './GameCardArt.css';

const BUNGEE = "'Bungee', sans-serif";

// ---- shared generators (ported from the prototype's pinwheel/rays/bolt) --------
// Radial pinwheel of triangular wedges from (cx,cy) — the edge-to-edge structure.
function pinwheel(cx, cy, r, n, fill, op, key) {
  const w = [];
  for (let i = 0; i < n; i += 2) {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = ((i + 1) / n) * Math.PI * 2;
    w.push(
      <polygon
        key={i}
        points={`${cx},${cy} ${(cx + Math.cos(a0) * r).toFixed(1)},${(cy + Math.sin(a0) * r).toFixed(1)} ${(cx + Math.cos(a1) * r).toFixed(1)},${(cy + Math.sin(a1) * r).toFixed(1)}`}
        fill={fill}
      />
    );
  }
  return <g key={key} opacity={op}>{w}</g>;
}
// Straight energy rays from a point out to r.
function rays(cx, cy, r0, r, n, stroke, w, off = 0) {
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2 + off;
    out.push(
      <line
        key={i}
        x1={(cx + Math.cos(a) * r0).toFixed(1)}
        y1={(cy + Math.sin(a) * r0).toFixed(1)}
        x2={(cx + Math.cos(a) * r).toFixed(1)}
        y2={(cy + Math.sin(a) * r).toFixed(1)}
        stroke={stroke}
        strokeWidth={w}
        strokeLinecap="round"
      />
    );
  }
  return out;
}
// Jagged lightning bolt from (cx,cy) outward along angle a.
function bolt(cx, cy, a, len, w, stroke, key) {
  const t = [0, 0.28, 0.52, 0.74, 1];
  const j = [0, 11, -10, 7, 0];
  const pts = t
    .map((tt, i) => {
      const rr = len * tt;
      return `${(cx + Math.cos(a) * rr - Math.sin(a) * j[i]).toFixed(1)},${(cy + Math.sin(a) * rr + Math.cos(a) * j[i]).toFixed(1)}`;
    })
    .join(' ');
  return (
    <polyline key={key} points={pts} fill="none" stroke={stroke} strokeWidth={w} strokeLinejoin="round" strokeLinecap="round" />
  );
}

const SCENE_PROPS = {
  className: 'card-art',
  viewBox: '0 0 300 400',
  preserveAspectRatio: 'xMidYMid slice',
  'aria-hidden': true,
};

// ---- WORD BOMB: explosion sunburst from the spark corner, bomb cratering the
//      bottom-left, W·O·R·D tiles climbing the blast axis, spark on top. ----
export function WordBombArt() {
  const tiles = [[96, 244, 'W', -11], [150, 196, 'O', 6], [202, 150, 'R', -7], [252, 106, 'D', 9]];
  const spark = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    return <line key={i} x1="0" y1="0" x2={(Math.cos(a) * 48).toFixed(1)} y2={(Math.sin(a) * 48).toFixed(1)} stroke="#FFE94A" strokeWidth="6" strokeLinecap="round" />;
  });
  return (
    <svg {...SCENE_PROPS} className="card-art wb-art">
      <rect width="300" height="400" fill="#FF6B3D" />
      {pinwheel(238, 74, 580, 22, '#E4531F', 0.6, 'pw')}
      <g opacity="0.8">{rays(238, 74, 26, 560, 16, '#FFB347', 4, 0.2)}</g>
      {/* bomb cratering the bottom-left, overlapping the blast base */}
      <circle cx="112" cy="372" r="146" fill="#2E1432" stroke="#150818" strokeWidth="8" />
      <path d="M112 372 m-146 0 a146 146 0 0 1 136 -145 l0 30 a116 116 0 0 0 -104 115 z" fill="#3E1C46" />
      <ellipse cx="70" cy="300" rx="34" ry="22" fill="#5A2A60" />
      <rect x="92" y="238" width="48" height="26" rx="4" fill="#5A4A2A" stroke="#2A2010" strokeWidth="5" />
      {/* fuse arcs from the bomb up to the spark */}
      <path d="M116 238 Q186 150 232 78" fill="none" stroke="#3A2A10" strokeWidth="9" strokeLinecap="round" />
      {/* W O R D tiles climbing the blast axis */}
      {tiles.map(([x, y, l, r]) => (
        <g key={l} transform={`translate(${x} ${y}) rotate(${r})`}>
          <rect x="-27" y="-27" width="54" height="54" rx="6" fill="#F3E2BE" stroke="#9A7A3A" strokeWidth="5" />
          <text x="0" y="13" fontSize="36" fontWeight="bold" fill="#3A2A10" textAnchor="middle" fontFamily={BUNGEE}>{l}</text>
        </g>
      ))}
      {/* spark starburst on top at the fuse tip */}
      <g transform="translate(238 74)">
        {spark}
        <circle r="19" fill="#FFB347" stroke="#B23C00" strokeWidth="5" />
      </g>
    </svg>
  );
}

// ---- CATEGORY BLITZ: electric starburst radiating from the brain to every edge,
//      brain hero overlapping the core, prompt "?" chips hanging off it. ----
export function CategoryBlitzArt() {
  const chips = [[74, 270, '?', -9], [150, 286, '?', 5], [226, 270, '?', 10]];
  return (
    <svg {...SCENE_PROPS} className="card-art cb-art">
      <rect width="300" height="400" fill="#3DA8FF" />
      {pinwheel(150, 176, 560, 20, '#2E90E6', 0.5, 'pw')}
      <g opacity="0.9">{Array.from({ length: 11 }, (_, i) => bolt(150, 176, (i / 11) * Math.PI * 2 + 0.3, 320, 7, '#0B5FA0', `b${i}`))}</g>
      <g>{Array.from({ length: 11 }, (_, i) => bolt(150, 176, (i / 11) * Math.PI * 2 + 0.3, 320, 3.2, '#FFE94A', `y${i}`))}</g>
      {/* brain hero overlapping the burst core */}
      <g transform="translate(150 182) scale(2.5)">
        <path d="M0 -40 q24 -2 26 20 q13 6 4 22 q4 15 -13 17 q-6 11 -17 4 q-11 6 -17 -4 q-17 -2 -13 -17 q-9 -16 4 -22 q2 -22 26 -20 z" fill="#FF6FB5" stroke="#B02F6E" strokeWidth="4" strokeLinejoin="round" />
        <path d="M0 -40 Q-4 -16 2 4 Q-4 20 0 30" fill="none" stroke="#B02F6E" strokeWidth="3" strokeLinecap="round" />
        <path d="M-18 -24 Q-11 -17 -18 -10" fill="none" stroke="#B02F6E" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M20 -24 Q13 -17 20 -10" fill="none" stroke="#B02F6E" strokeWidth="2.5" strokeLinecap="round" />
      </g>
      {/* prompt chips hanging off the brain, overlapping the lower bolts */}
      {chips.map(([x, y, l, r], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${r})`}>
          <rect x="-25" y="-23" width="50" height="46" rx="8" fill="#0A3A63" stroke="#FFE94A" strokeWidth="3.5" />
          <text x="0" y="12" fontSize="30" fontWeight="bold" fill="#FFE94A" textAnchor="middle" fontFamily={BUNGEE}>{l}</text>
        </g>
      ))}
    </svg>
  );
}

// ---- SAT RUSH: a MANGA page — cream paper, black ink, halftone corners, radial
//      speed lines behind a violet 5× and inked S·A·T tiles. ----
export function SatRushArt() {
  const speed = Array.from({ length: 30 }, (_, i) => {
    const a = (i / 30) * Math.PI * 2 + 0.1;
    const inr = 34 + (i % 3) * 8;
    const out = 460;
    return (
      <line
        key={i}
        x1={(150 + Math.cos(a) * inr).toFixed(1)}
        y1={(250 + Math.sin(a) * inr).toFixed(1)}
        x2={(150 + Math.cos(a) * out).toFixed(1)}
        y2={(250 + Math.sin(a) * out).toFixed(1)}
        strokeWidth={2.5 + (i % 2) * 1.8}
      />
    );
  });
  const tiles = [['S', 80], ['A', 150], ['T', 220]];
  return (
    <svg {...SCENE_PROPS} className="card-art sr-art">
      <defs>
        <pattern id="srt3" width="8" height="8" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="2" fill="#111" />
        </pattern>
      </defs>
      <rect width="300" height="400" fill="#F2EFE7" />
      <g stroke="#111" strokeLinecap="round">{speed}</g>
      <path d="M0 0 H120 L0 120 Z" fill="url(#srt3)" />
      <path d="M300 400 H196 L300 296 Z" fill="url(#srt3)" />
      <text x="150" y="150" fontSize="82" fontWeight="bold" fill="#A855F7" stroke="#111" strokeWidth="3" textAnchor="middle" fontFamily={BUNGEE}>5×</text>
      {tiles.map(([l, x]) => (
        <g key={l}>
          <rect x={x - 30} y="252" width="60" height="80" rx="3" fill="#F2EFE7" stroke="#111" strokeWidth="6" />
          <text x={x} y="312" fontSize="46" fontWeight="bold" fill="#111" textAnchor="middle" fontFamily={BUNGEE}>{l}</text>
        </g>
      ))}
    </svg>
  );
}

// ---- CHAIN: teal field, a chain running wall-to-wall (cropping both edges) with
//      two big tilted letter tiles E→R threaded on it, handoff arrow up top. ----
export function ChainArt() {
  return (
    <svg {...SCENE_PROPS} className="card-art chain-art">
      <rect width="300" height="400" fill="#2EFFE0" />
      <path d="M0 300 L300 240 L300 400 L0 400 Z" fill="#22D9C0" />
      <path d="M0 90 L300 40 L300 150 L0 200 Z" fill="#3BFFE4" opacity="0.6" />
      {/* handoff arrow up top */}
      <g transform="translate(150 70)">
        <path d="M-70 20 Q0 -34 70 20" fill="none" stroke="#0A3B34" strokeWidth="7" strokeLinecap="round" />
        <path d="M70 20 L52 14 M70 20 L60 2" fill="none" stroke="#0A3B34" strokeWidth="7" strokeLinecap="round" />
      </g>
      {/* chain running wall to wall, cropping both edges */}
      <g fill="none" stroke="#0A3B34" strokeWidth="9">
        <rect x="-40" y="196" width="120" height="66" rx="33" />
        <rect x="66" y="168" width="66" height="120" rx="33" />
        <rect x="118" y="196" width="120" height="66" rx="33" />
        <rect x="224" y="168" width="66" height="120" rx="33" />
        <rect x="276" y="196" width="120" height="66" rx="33" />
      </g>
      {/* two big letter tiles */}
      <g transform="rotate(-9 66 228)">
        <rect x="30" y="196" width="72" height="72" rx="10" fill="#0D2B28" stroke="#000" strokeWidth="6" />
        <text x="66" y="248" fontSize="44" fontWeight="bold" fill="#F3E2BE" textAnchor="middle" fontFamily={BUNGEE}>E</text>
      </g>
      <g transform="rotate(9 176 228)">
        <rect x="140" y="196" width="72" height="72" rx="10" fill="#F3E2BE" stroke="#000" strokeWidth="6" />
        <text x="176" y="248" fontSize="44" fontWeight="bold" fill="#0D2B28" textAnchor="middle" fontFamily={BUNGEE}>R</text>
      </g>
    </svg>
  );
}

// ---- FUSE: FIRE — a bright hot-amber field with an ember burst blooming from the
//      flame at the right edge, a molten cord threading the AIN fragment tile
//      (up top, clear of the centre plaque), a white-hot flame off the edge.
//      NB: the field is deliberately BRIGHT amber (not the old muddy yellow) so it
//      survives the locked dim as fire — see the FUSE-only locked filter in
//      GameCard.css; do not "correct" that override. ----
export function FuseArt() {
  return (
    <svg {...SCENE_PROPS} className="card-art fuse-art">
      <rect width="300" height="400" fill="#FF7A2A" />
      {pinwheel(300, 244, 540, 22, '#EA5A16', 0.8, 'pw1')}
      {pinwheel(300, 244, 360, 22, '#FFB24D', 0.6, 'pw2')}
      <g opacity="0.9">{rays(300, 244, 24, 320, 15, '#FFD84A', 5, 0.22)}</g>
      {/* cord: char edge under a hot molten core, sweeping top-left -> flame */}
      <path d="M-24 66 C 40 118, 92 96, 150 96 C 214 96, 270 198, 326 250" fill="none" stroke="#4A1C08" strokeWidth="17" strokeLinecap="round" />
      <path d="M-24 66 C 40 118, 92 96, 150 96 C 214 96, 270 198, 326 250" fill="none" stroke="#FFAE4D" strokeWidth="10" strokeLinecap="round" />
      {/* white-hot lit stretch approaching the flame */}
      <path d="M 236 152 C 288 208, 308 232, 326 250" fill="none" stroke="#FFE94A" strokeWidth="8" strokeLinecap="round" />
      {/* sparks flying off the cord */}
      <circle cx="58" cy="112" r="6" fill="#FFE94A" />
      <circle cx="252" cy="172" r="4" fill="#FFF3B0" />
      <circle cx="290" cy="218" r="6" fill="#FFC24A" />
      {/* fragment tile THREADED on the cord, up top and clear of the centre plaque */}
      <g transform="rotate(-4 150 96)">
        <rect x="84" y="57" width="132" height="78" rx="10" fill="#F7EAC6" stroke="#2A1206" strokeWidth="6" />
        <text x="150" y="110" fontSize="46" fontWeight="bold" fill="#2A1206" textAnchor="middle" letterSpacing="3" fontFamily={BUNGEE}>AIN</text>
      </g>
      {/* bright flame burning off the right edge, white-hot core */}
      <g transform="translate(308 244) scale(2.7)">
        <path d="M0 15 C -14 4, -9 -12, 0 -21 C 9 -12, 14 4, 0 15 Z" fill="#FF6B3D" stroke="#7A2A08" strokeWidth="3.5" strokeLinejoin="round" />
        <path d="M0 9 C -8 2, -5 -8, 0 -14 C 5 -8, 8 2, 0 9 Z" fill="#FFE94A" />
        <path d="M0 4 C -4 0, -3 -5, 0 -8 C 3 -5, 4 0, 0 4 Z" fill="#FFF6C8" />
      </g>
    </svg>
  );
}

// Lookup map so GameCard can resolve `artKey` strings from gameData.js.
export const GAME_ART_COMPONENTS = {
  WordBombArt,
  CategoryBlitzArt,
  SatRushArt,
  ChainArt,
  FuseArt,
};
