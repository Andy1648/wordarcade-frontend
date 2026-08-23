// GameArt.jsx
// One exported component per game's card BACKGROUND - now constantly animated
// (CSS-driven) "fidget toy" scenes that run all the time behind the card text,
// not just on hover. Flat fills + thick coloured outlines (no gradients/blur),
// matching each card's colour scheme. All the motion lives in GameCardArt.css;
// the JSX just lays out classed SVG elements + per-element timing vars. GameCard
// looks these up by name via the `artKey` field in gameData.js.
import './GameCardArt.css';

// ---- WORD BOMB: a pulsing bomb, orbiting letter tiles, rising fuse sparks ----
export function WordBombArt() {
  // Each tile orbits the bomb at its own radius + speed, and flashes brighter on
  // a staggered cycle so "one tile glows" every couple of seconds.
  const tiles = [
    { l: 'B', r: 50, dur: 6.0, fdelay: 0 },
    { l: 'O', r: 60, dur: 7.5, fdelay: 2 },
    { l: 'M', r: 44, dur: 5.0, fdelay: 4 },
    { l: 'W', r: 56, dur: 6.8, fdelay: 6 },
    { l: 'A', r: 48, dur: 4.4, fdelay: 8 },
    { l: 'D', r: 64, dur: 8.0, fdelay: 10 },
  ];
  return (
    <svg viewBox="0 0 140 168" width="100%" height="100%" className="card-art wb-art" aria-hidden="true">
      {tiles.map((t, i) => (
        <g key={i} className="wb-orbit" style={{ '--odur': `${t.dur}s` }}>
          <g className="wb-tile" style={{ '--fdelay': `${t.fdelay}s` }} transform={`translate(70 ${92 - t.r})`}>
            <rect x="-9" y="-9" width="18" height="18" rx="3" fill="#F3E2BE" stroke="#9A7A3A" strokeWidth="3" />
            <text x="0" y="5" fontSize="13" fontWeight="bold" fill="#3A2A10" textAnchor="middle" fontFamily="'Bungee', sans-serif">{t.l}</text>
          </g>
        </g>
      ))}

      {/* Central pulsing bomb */}
      <g className="wb-bomb">
        <path d="M70 56 Q92 40 98 26" fill="none" stroke="#3A2A10" strokeWidth="5" strokeLinecap="round" />
        <polygon points="98,14 106,28 98,24 91,30 94,21" fill="#FF7A2E" stroke="#B23C00" strokeWidth="3" strokeLinejoin="round" />
        <rect x="60" y="54" width="20" height="10" rx="2" fill="#5A4A2A" stroke="#2A2010" strokeWidth="3" />
        <circle cx="70" cy="98" r="34" fill="#2E1432" stroke="#150818" strokeWidth="5" />
        <ellipse cx="58" cy="84" rx="9" ry="6" fill="#5A2A60" />
      </g>

      {/* Sparks rising off the fuse tip (~98,20) */}
      {[1, 2, 3, 4].map((n) => (
        <circle key={n} className={`wb-spark wb-spark-${n}`} cx="98" cy="20" r="2.5" fill="#FFB347" />
      ))}
    </svg>
  );
}

// ---- CATEGORY BLITZ: a throbbing brain, randomly flashing bolts, rising ?s ----
export function CategoryBlitzArt() {
  // Question marks rise like bubbles and fade at the top.
  const qs = [
    { x: 30, size: 18, dur: 5.0, delay: 0, cyan: true },
    { x: 110, size: 14, dur: 6.5, delay: 1.4, cyan: false },
    { x: 66, size: 16, dur: 5.8, delay: 2.8, cyan: false },
    { x: 96, size: 12, dur: 7.0, delay: 4.2, cyan: true },
    { x: 48, size: 13, dur: 6.2, delay: 3.5, cyan: false },
    { x: 124, size: 15, dur: 5.4, delay: 5.0, cyan: true },
    { x: 14, size: 11, dur: 7.6, delay: 2.0, cyan: false },
  ];
  return (
    <svg viewBox="0 0 140 168" width="100%" height="100%" className="card-art cb-art" aria-hidden="true">
      {qs.map((q, i) => (
        <text
          key={i}
          className="cb-q"
          x={q.x}
          y="150"
          fontSize={q.size}
          fontWeight="bold"
          fill={q.cyan ? '#2EFFE0' : '#FFFFFF'}
          stroke="#0F8A78"
          strokeWidth="1.2"
          textAnchor="middle"
          fontFamily="'Bungee', sans-serif"
          style={{ '--qdur': `${q.dur}s`, animationDelay: `${q.delay}s` }}
        >
          ?
        </text>
      ))}

      {/* Brain (throbs + briefly brightens in sync with the right-hand bolt) */}
      <g className="cb-brain">
        <path
          className="cb-brain-fill"
          d="M70 52 q22 -2 24 18 q12 6 4 20 q4 14 -12 16 q-6 10 -16 4 q-10 6 -16 -4 q-16 -2 -12 -16 q-8 -14 4 -20 q2 -20 24 -18 z"
          fill="#FF6FB5"
          stroke="#B02F6E"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <path d="M70 52 Q66 74 72 92 Q66 106 70 116" fill="none" stroke="#B02F6E" strokeWidth="3" strokeLinecap="round" />
        <path d="M54 66 Q60 72 54 78" fill="none" stroke="#B02F6E" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M88 66 Q82 72 88 78" fill="none" stroke="#B02F6E" strokeWidth="2.5" strokeLinecap="round" />
      </g>

      {/* Synapse sparks: short curved strokes radiating off the brain, each
          briefly flashing on its own cycle to read as neural activity. */}
      <path className="cb-synapse cb-synapse-1" d="M54 70 Q46 66 38 60" fill="none" stroke="#B02F6E" strokeWidth="2" strokeLinecap="round" />
      <path className="cb-synapse cb-synapse-2" d="M90 72 Q99 68 107 62" fill="none" stroke="#B02F6E" strokeWidth="2" strokeLinecap="round" />
      <path className="cb-synapse cb-synapse-3" d="M58 106 Q52 112 46 120" fill="none" stroke="#B02F6E" strokeWidth="2" strokeLinecap="round" />
      <path className="cb-synapse cb-synapse-4" d="M84 106 Q91 112 97 120" fill="none" stroke="#B02F6E" strokeWidth="2" strokeLinecap="round" />

      {/* Lightning bolts, each blinking on its own timing */}
      <g className="cb-bolt cb-bolt-1" transform="translate(26 80)">
        <polygon points="4,-11 -4,1 1,1 -3,11 8,-3 2,-3" fill="#FFE94A" stroke="#B8A020" strokeWidth="2.5" strokeLinejoin="round" />
      </g>
      <g className="cb-bolt cb-bolt-2" transform="translate(114 86)">
        <polygon points="4,-11 -4,1 1,1 -3,11 8,-3 2,-3" fill="#FFE94A" stroke="#B8A020" strokeWidth="2.5" strokeLinejoin="round" />
      </g>
      <g className="cb-bolt cb-bolt-3" transform="translate(46 44)">
        <polygon points="4,-11 -4,1 1,1 -3,11 8,-3 2,-3" fill="#FFE94A" stroke="#B8A020" strokeWidth="2.5" strokeLinejoin="round" />
      </g>
      <g className="cb-bolt cb-bolt-4" transform="translate(98 128)">
        <polygon points="4,-11 -4,1 1,1 -3,11 8,-3 2,-3" fill="#FFE94A" stroke="#B8A020" strokeWidth="2.5" strokeLinejoin="round" />
      </g>
      <g className="cb-bolt cb-bolt-5" transform="translate(118 40)">
        <polygon points="4,-11 -4,1 1,1 -3,11 8,-3 2,-3" fill="#FFE94A" stroke="#B8A020" strokeWidth="2.5" strokeLinejoin="round" />
      </g>
      <g className="cb-bolt cb-bolt-6" transform="translate(22 132)">
        <polygon points="4,-11 -4,1 1,1 -3,11 8,-3 2,-3" fill="#FFE94A" stroke="#B8A020" strokeWidth="2.5" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

// ---- SAT RUSH: a MANGA cover. Off-white paper, black ink, Ben-Day screentone,
//      radial speed lines behind inked S·A·T tiles dropping into their slots, and
//      the ante multiplier ticking 5x -> 2x in the ONE spot colour (violet) — the
//      thread back to the mode's in-game violet. Everything else is black ink. ----
const SR_FOCAL = { x: 70, y: 100 };
const SR_SPEED_LINES = Array.from({ length: 22 }, (_, i) => {
  const a = (i / 22) * Math.PI * 2 + 0.11;
  const inner = 18 + (i % 3) * 4; // clear a hole around the tiles
  const outer = 200; // runs off the frame (clipped) = a radial burst
  return {
    x1: SR_FOCAL.x + Math.cos(a) * inner,
    y1: SR_FOCAL.y + Math.sin(a) * inner,
    x2: SR_FOCAL.x + Math.cos(a) * outer,
    y2: SR_FOCAL.y + Math.sin(a) * outer,
    w: 1.5 + (i % 2) * 1.1, // heavier so the lines read as ink at menu scale
  };
});
// A tile, drawn as an inked block with slightly irregular (hand-drawn) edges.
const SR_TILES = [
  { l: 'S', x: 44, delay: 0, d: 'M-11,-14 L10,-15 L12,13 L-10,15 Z' },
  { l: 'A', x: 70, delay: 0.5, d: 'M-10,-15 L11,-14 L10,15 L-12,14 Z' },
  { l: 'T', x: 96, delay: 1.0, d: 'M-12,-14 L10,-15 L11,15 L-10,13 Z' },
];

export function SatRushArt() {
  return (
    <svg viewBox="0 0 140 168" width="100%" height="100%" className="card-art sr-art" aria-hidden="true">
      <defs>
        {/* Ben-Day halftone screentone. */}
        <pattern id="sr-tone" width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="1.5" fill="#111" />
        </pattern>
      </defs>

      {/* Radial speed lines behind the tiles (intensify on the beat via CSS). */}
      <g className="sr-speed">
        {SR_SPEED_LINES.map((l, i) => (
          <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="#111" strokeWidth={l.w} strokeLinecap="round" />
        ))}
      </g>

      {/* Screentone patches, top-left and lower-right corners. */}
      <path d="M0 0 H50 L0 50 Z" fill="url(#sr-tone)" opacity="0.9" />
      <path d="M140 168 H96 L140 120 Z" fill="url(#sr-tone)" opacity="0.9" />

      {/* The ante multiplier — the ONE spot colour (violet), ticking 5x -> 2x. */}
      <g className="sr-mult-art" transform="translate(70 40)">
        <text className="sr-mult-5" x="0" y="0" fontSize="30" fontWeight="bold" fill="#A855F7" stroke="#111" strokeWidth="1.4" textAnchor="middle" fontFamily="'Bungee', sans-serif">5×</text>
        <text className="sr-mult-2" x="0" y="0" fontSize="30" fontWeight="bold" fill="#A855F7" stroke="#111" strokeWidth="1.4" textAnchor="middle" fontFamily="'Bungee', sans-serif">2×</text>
      </g>

      {/* Inked slot row (heavy black outline on the cream page). */}
      {SR_TILES.map((t) => (
        <rect key={`slot-${t.l}`} x={t.x - 12} y="111" width="24" height="32" rx="2" fill="none" stroke="#111" strokeWidth="3.4" />
      ))}
      <rect className="sr-caret" x="58" y="137" width="12" height="3.4" rx="1" fill="#111" />

      {/* Inked tiles that drop into the slots and settle (hand-drawn edges). */}
      {SR_TILES.map((t) => (
        <g key={t.l} transform={`translate(${t.x} 127)`}>
          <g className="sr-tile" style={{ '--sdelay': `${t.delay}s` }}>
            <path d={t.d} fill="#F2EFE7" stroke="#111" strokeWidth="3.2" strokeLinejoin="round" />
            <text x="0" y="7" fontSize="16" fontWeight="bold" fill="#111" textAnchor="middle" fontFamily="'Bungee', sans-serif">{t.l}</text>
          </g>
        </g>
      ))}
    </svg>
  );
}

// ---- CHAIN: three interlocking links holding two tilted letter tiles (E→R),
//      with a small handoff arrow above showing the last letter becoming the
//      next word's first. Flat fills, 4px black outline (house style). ----
export function ChainArt() {
  return (
    <svg viewBox="0 0 140 168" width="100%" height="100%" className="card-art chain-art" aria-hidden="true">
      {/* Three interlocking rounded-rect links (no fill, black outline). */}
      <g fill="none" stroke="#000" strokeWidth="4">
        <rect x="12" y="86" width="52" height="30" rx="15" />
        <rect x="55" y="72" width="30" height="52" rx="15" />
        <rect x="76" y="86" width="52" height="30" rx="15" />
      </g>

      {/* Handoff arrow above the tiles — the last letter becomes the next first. */}
      <g className="chain-arrow-g">
        <path d="M44 58 Q70 38 96 58" fill="none" stroke="#000" strokeWidth="4" strokeLinecap="round" />
        <path d="M96 58 L86 55 M96 58 L91 48" fill="none" stroke="#000" strokeWidth="4" strokeLinecap="round" />
      </g>

      {/* Two tilted letter tiles: E dark, R cream. */}
      <g transform="rotate(-9 40 101)">
        <rect x="27" y="88" width="26" height="26" rx="5" fill="#0D2B28" stroke="#000" strokeWidth="4" />
        <text x="40" y="107" fontSize="16" fontWeight="bold" fill="#F3E2BE" textAnchor="middle" fontFamily="'Bungee', sans-serif">E</text>
      </g>
      <g transform="rotate(9 100 101)">
        <rect x="87" y="88" width="26" height="26" rx="5" fill="#F3E2BE" stroke="#000" strokeWidth="4" />
        <text x="100" y="107" fontSize="16" fontWeight="bold" fill="#0D2B28" textAnchor="middle" fontFamily="'Bungee', sans-serif">R</text>
      </g>
    </svg>
  );
}

// ---- FUSE: a thick burnt cord enters from the left into a cream fragment tile
//      reading AIN, then exits right into a lit flame with sparks. Flat fills,
//      4px black outline. ----
export function FuseArt() {
  return (
    <svg viewBox="0 0 140 168" width="100%" height="100%" className="card-art fuse-art" aria-hidden="true">
      {/* Burnt cord: in from the left, out to the flame on the right. */}
      <path d="M-8 104 C 18 84, 34 120, 50 100" fill="none" stroke="#2A1A0E" strokeWidth="8" strokeLinecap="round" />
      <path d="M90 100 C 106 84, 118 118, 132 96" fill="none" stroke="#2A1A0E" strokeWidth="8" strokeLinecap="round" />

      {/* Cream fragment tile reading AIN (the "piece"). */}
      <g transform="rotate(-4 70 100)">
        <rect x="48" y="84" width="44" height="32" rx="5" fill="#F3E2BE" stroke="#000" strokeWidth="4" />
        <text x="70" y="106" fontSize="16" fontWeight="bold" fill="#2A1A0E" textAnchor="middle" letterSpacing="1.5" fontFamily="'Bungee', sans-serif">AIN</text>
      </g>

      {/* Lit flame at the cord's right tip. */}
      <g className="fuse-flame" transform="translate(130 94)">
        <path d="M0 12 C -9 3, -5 -7, 0 -14 C 5 -7, 9 3, 0 12 Z" fill="#FF6B3D" stroke="#000" strokeWidth="4" strokeLinejoin="round" />
      </g>

      {/* Sparks flicking off the flame. */}
      <circle className="fuse-spark fuse-spark-1" cx="122" cy="86" r="3" fill="#FF4B4B" />
      <circle className="fuse-spark fuse-spark-2" cx="134" cy="100" r="2.4" fill="#FFB347" />
    </svg>
  );
}

// Lookup map so GameCard can resolve `artKey` strings from gameData.js to the
// actual component without a long if/else chain.
export const GAME_ART_COMPONENTS = {
  WordBombArt,
  CategoryBlitzArt,
  SatRushArt,
  ChainArt,
  FuseArt,
};
