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

// Rounded-rectangle outline as a path string (so we can build ring shapes with
// evenodd fill — a real forged link has thickness, not just a stroke).
function rrPath(x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  return (
    `M${(x + rr).toFixed(1)},${y.toFixed(1)}` +
    `h${(w - 2 * rr).toFixed(1)}a${rr},${rr} 0 0 1 ${rr},${rr}` +
    `v${(h - 2 * rr).toFixed(1)}a${rr},${rr} 0 0 1 ${-rr},${rr}` +
    `h${(-(w - 2 * rr)).toFixed(1)}a${rr},${rr} 0 0 1 ${-rr},${-rr}` +
    `v${(-(h - 2 * rr)).toFixed(1)}a${rr},${rr} 0 0 1 ${rr},${-rr}z`
  );
}
// One forged chain link centred at (cx,cy). `vertical` swaps its long axis so the
// run alternates perpendicular. A filled metal RING (outer minus inner, evenodd)
// gives real thickness; a dark outline reads as the forged edge, an inset light
// rim is the highlight, and an offset dark copy behind it is the cast shadow onto
// the link below. Drawn back-to-front by the caller so each threads THROUGH its
// neighbour. Colours are the card's teal metal.
function forgedLink(cx, cy, vertical, key) {
  const LONG = 108;
  const SHORT = 62;
  const T = 16; // wall thickness
  const w = vertical ? SHORT : LONG;
  const h = vertical ? LONG : SHORT;
  const x = cx - w / 2;
  const y = cy - h / 2;
  const rOut = SHORT / 2;
  const ring = `${rrPath(x, y, w, h, rOut)} ${rrPath(x + T, y + T, w - 2 * T, h - 2 * T, rOut - T)}`;
  const rim = rrPath(x + 4, y + 4, w - 8, h - 8, rOut - 4);
  return (
    <g key={key}>
      <path d={ring} fillRule="evenodd" fill="#03211C" opacity="0.45" transform="translate(5 6)" />
      <path d={ring} fillRule="evenodd" fill="#12564C" stroke="#04211C" strokeWidth="4" strokeLinejoin="round" />
      <path d={rim} fill="none" stroke="#63F7DF" strokeWidth="3.5" strokeLinejoin="round" opacity="0.85" />
    </g>
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
      {/* forged chain running wall-to-wall on one axis: alternating perpendicular
          links that overlap ~35% and are drawn left→right so each threads THROUGH
          the last (later paint = on top = the weave). */}
      {[-8, 60, 128, 196, 264, 332].map((cx, i) =>
        forgedLink(cx, 230, i % 2 === 1, `lk${i}`)
      )}
      {/* two big letter tiles threaded on the chain */}
      <g transform="rotate(-9 66 230)">
        <rect x="30" y="198" width="72" height="72" rx="10" fill="#0D2B28" stroke="#000" strokeWidth="6" />
        <text x="66" y="250" fontSize="44" fontWeight="bold" fill="#F3E2BE" textAnchor="middle" fontFamily={BUNGEE}>E</text>
      </g>
      <g transform="rotate(9 176 230)">
        <rect x="140" y="198" width="72" height="72" rx="10" fill="#F3E2BE" stroke="#000" strokeWidth="6" />
        <text x="176" y="250" fontSize="44" fontWeight="bold" fill="#0D2B28" textAnchor="middle" fontFamily={BUNGEE}>R</text>
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
      {/* BRAIDED ROPE fuse sweeping top-left → flame. A thick casing, then two
          interleaved dashed strands (offset half a period) read as the twist, a
          thin highlight rides the crest, and the burning end frays into strands. */}
      {(() => {
        const CORD = 'M-24 66 C 40 118, 92 96, 150 96 C 214 96, 270 198, 326 250';
        // Two cubic segments of CORD; sample point + tangent to lay DIAGONAL twist
        // knuckles across the rope so it reads as a braided 2-ply, not a segmented
        // band. Static art (no animation) — pure geometry.
        const SEGS = [
          [[-24, 66], [40, 118], [92, 96], [150, 96]],
          [[150, 96], [214, 96], [270, 198], [326, 250]],
        ];
        const bez = (p, t) => {
          const u = 1 - t;
          const b0 = u * u * u, b1 = 3 * u * u * t, b2 = 3 * u * t * t, b3 = t * t * t;
          return [p[0][0] * b0 + p[1][0] * b1 + p[2][0] * b2 + p[3][0] * b3,
                  p[0][1] * b0 + p[1][1] * b1 + p[2][1] * b2 + p[3][1] * b3];
        };
        const tan = (p, t) => {
          const u = 1 - t;
          const c0 = 3 * u * u, c1 = 6 * u * t, c2 = 3 * t * t;
          return Math.atan2(
            c0 * (p[1][1] - p[0][1]) + c1 * (p[2][1] - p[1][1]) + c2 * (p[3][1] - p[2][1]),
            c0 * (p[1][0] - p[0][0]) + c1 * (p[2][0] - p[1][0]) + c2 * (p[3][0] - p[2][0]),
          );
        };
        const knuckles = [];
        let i = 0;
        const HALF = 15; // knuckle half-length (crosses the rope width)
        const SLANT = (58 * Math.PI) / 180; // diagonal lean of the twist
        for (const seg of SEGS) {
          for (let t = 0; t <= 1.0001; t += 0.055) {
            const [x, y] = bez(seg, t);
            const a = tan(seg, t) + SLANT;
            const dx = Math.cos(a) * HALF, dy = Math.sin(a) * HALF;
            knuckles.push(
              <line key={`k${i}`} x1={(x - dx).toFixed(1)} y1={(y - dy).toFixed(1)}
                x2={(x + dx).toFixed(1)} y2={(y + dy).toFixed(1)}
                stroke={i % 2 ? '#B4581C' : '#DD8836'} strokeWidth="12" strokeLinecap="round" />,
            );
            i += 1;
          }
        }
        return (
          <g>
            {/* dark casing = the rope's outline showing between the knuckles */}
            <path d={CORD} fill="none" stroke="#2E1204" strokeWidth="30" strokeLinecap="round" />
            <path d={CORD} fill="none" stroke="#6A2E0E" strokeWidth="24" strokeLinecap="round" />
            {/* diagonal twist knuckles, alternating two ambers */}
            {knuckles}
            {/* lit highlight riding the top crest of the twist */}
            <path d={CORD} fill="none" stroke="#FFC968" strokeWidth="4" strokeLinecap="round" strokeDasharray="7 15" opacity="0.75" />
          </g>
        );
      })()}
      {/* white-hot lit stretch approaching the flame (the burning length) */}
      <path d="M 236 152 C 288 208, 308 232, 326 250" fill="none" stroke="#FFE94A" strokeWidth="9" strokeLinecap="round" strokeDasharray="5 15" opacity="0.9" />
      {/* frayed, charred strands splaying from the burning end */}
      <g stroke="#2A1206" strokeWidth="3" strokeLinecap="round" fill="none">
        <path d="M300 232 q14 -6 26 -3" />
        <path d="M300 240 q16 0 30 6" />
        <path d="M300 248 q14 6 24 16" />
      </g>
      <g stroke="#FF8A3D" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.9">
        <path d="M300 236 q14 -4 24 -1" />
        <path d="M300 244 q15 4 26 12" />
      </g>
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
// RUN — a rising 10-step climb (the escalating ante wall) to a flag at the summit,
// on the signature pink field. Reads as "the gauntlet" / the headline ascent.
export function RunArt() {
  const steps = [0, 1, 2, 3, 4, 5, 6, 7];
  return (
    <svg {...SCENE_PROPS} className="card-art run-art">
      <rect width="300" height="400" fill="#FF4FA3" />
      <path d="M0 300 L300 250 L300 400 L0 400 Z" fill="#E23B8C" />
      {/* the ascending wall of rounds, left→low to right→high */}
      {steps.map((i) => {
        const w = 34, gap = 2;
        const x = 8 + i * (w + gap);
        const h = 70 + i * 34;
        const y = 360 - h;
        return (
          <g key={i}>
            <rect x={x} y={y} width={w} height={h} rx="6" fill={i >= 6 ? '#FFE94A' : '#2EFFE0'} stroke="#000" strokeWidth="5" />
            <rect x={x + 6} y={y + 8} width={w - 12} height="8" rx="3" fill="#000" opacity="0.18" />
          </g>
        );
      })}
      {/* summit flag on the tallest step */}
      <g transform="translate(268 44)">
        <rect x="-3" y="0" width="6" height="70" rx="3" fill="#0d0618" />
        <path d="M3 4 L44 16 L3 30 Z" fill="#9A1AFF" stroke="#000" strokeWidth="5" strokeLinejoin="round" />
      </g>
      {/* the wall marker cutting across — "clear it or fall" */}
      <path d="M0 150 L300 120" fill="none" stroke="#0d0618" strokeWidth="6" strokeDasharray="14 10" strokeLinecap="round" />
      <g transform="rotate(-6 40 128)">
        <rect x="8" y="112" width="86" height="34" rx="8" fill="#0d0618" stroke="#000" strokeWidth="4" />
        <text x="51" y="136" fontSize="20" fill="#FFE94A" textAnchor="middle" fontFamily={BUNGEE}>WALL</text>
      </g>
    </svg>
  );
}

export const GAME_ART_COMPONENTS = {
  WordBombArt,
  CategoryBlitzArt,
  SatRushArt,
  ChainArt,
  FuseArt,
  RunArt,
};
