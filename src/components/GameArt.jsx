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
      {/* bomb — raised so its dome reads ABOVE the title bar even on a small card (the bar
         cannot cover it); still craters the bottom-left, overlapping the blast base */}
      <circle cx="112" cy="318" r="146" fill="#2E1432" stroke="#150818" strokeWidth="8" />
      <path d="M112 318 m-146 0 a146 146 0 0 1 136 -145 l0 30 a116 116 0 0 0 -104 115 z" fill="#3E1C46" />
      <ellipse cx="70" cy="246" rx="34" ry="22" fill="#5A2A60" />
      <rect x="92" y="184" width="48" height="26" rx="4" fill="#5A4A2A" stroke="#2A2010" strokeWidth="5" />
      {/* fuse arcs from the bomb up to the spark */}
      <path d="M116 184 Q182 120 232 78" fill="none" stroke="#3A2A10" strokeWidth="9" strokeLinecap="round" />
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
      {/* the 5× multiplier sits LOW in the scene zone (below the masthead band's divider) so it
         reads as one hero, never bisected by the rule even on a small card */}
      <text x="150" y="198" fontSize="78" fontWeight="bold" fill="#A855F7" stroke="#111" strokeWidth="3" textAnchor="middle" fontFamily={BUNGEE}>5×</text>
      {tiles.map(([l, x]) => (
        <g key={l}>
          <rect x={x - 30} y="252" width="60" height="80" rx="3" fill="#F2EFE7" stroke="#111" strokeWidth="6" />
          <text x={x} y="312" fontSize="46" fontWeight="bold" fill="#111" textAnchor="middle" fontFamily={BUNGEE}>{l}</text>
        </g>
      ))}
    </svg>
  );
}

// ---- WORD RACE: a hot-pink track field, three lanes racing to a checkered finish on the right,
//      speed streaks with drippy ends, the IN fragment tile up top, and the mascot's RUN pose
//      (the real PNG — never drawn in code) sprinting the middle lane. ----
export function WordRaceArt() {
  const checks = [];
  for (let r = 0; r < 12; r += 1) {
    for (let c = 0; c < 2; c += 1) {
      if ((r + c) % 2 === 0) checks.push(<rect key={`${r}-${c}`} x={262 + c * 19} y={r * 34} width="19" height="34" fill="#000" />);
    }
  }
  return (
    <svg {...SCENE_PROPS} className="card-art word-race-art">
      <rect width="300" height="400" fill="#FF4FA3" />
      <path d="M0 150 L300 118 L300 262 L0 300 Z" fill="#E23A8C" />
      {/* lane rules, slightly skewed so the track reads as rushing past */}
      <path d="M0 152 L262 124" stroke="#1a0b2e" strokeWidth="6" strokeLinecap="round" />
      <path d="M0 226 L262 196" stroke="#1a0b2e" strokeWidth="6" strokeLinecap="round" strokeDasharray="22 16" />
      <path d="M0 300 L262 264" stroke="#1a0b2e" strokeWidth="6" strokeLinecap="round" />
      {/* speed streaks with a drip off each tail — asymmetric on purpose */}
      <g stroke="#FFE94A" strokeWidth="7" strokeLinecap="round">
        <path d="M18 186 L92 178" />
        <path d="M8 250 L70 243" />
        <path d="M36 214 L88 208" opacity="0.7" />
      </g>
      <path d="M22 186 q-3 14 2 22 q4 -7 1 -22" fill="#FFE94A" />
      <path d="M12 250 q-2 10 3 15 q3 -6 0 -15" fill="#FFE94A" />
      {/* the checkered finish, cropped by the right edge */}
      <rect x="262" y="0" width="38" height="400" fill="#fff" />
      {checks}
      <path d="M262 0 V400" stroke="#1a0b2e" strokeWidth="5" />
      {/* the fragment tile, tilted */}
      <g transform="rotate(-7 96 70)">
        <rect x="46" y="36" width="100" height="68" rx="10" fill="#1a0b2e" stroke="#000" strokeWidth="6" />
        <text x="96" y="86" fontSize="42" fontWeight="bold" fill="#FFE94A" textAnchor="middle" fontFamily={BUNGEE}>IN</text>
      </g>
      <image href="/mascot-run.png" x="104" y="150" width="128" height="128" />
    </svg>
  );
}

// Lookup map so GameCard can resolve `artKey` strings from gameData.js.
export const GAME_ART_COMPONENTS = {
  WordBombArt,
  CategoryBlitzArt,
  SatRushArt,
  WordRaceArt,
};
