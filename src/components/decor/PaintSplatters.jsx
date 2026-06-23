// PaintSplatters.jsx
// Five distinct flat cel/Newgrounds-style spray-paint splatter SVGs.
// Each: one irregular organic blob (colored outline, flat fill), a scatter
// of satellite droplets, and a couple of wavy drip lines ending in teardrops.
// Pure SVG function components - no React import (automatic JSX runtime).
// viewBox spans -100..100 = 200 units; the parent sizes the svg via CSS.

function darken(hex, amt = 0.2) {
  const n = parseInt(hex.replace('#', ''), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.round(r * (1 - amt));
  g = Math.round(g * (1 - amt));
  b = Math.round(b * (1 - amt));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export function PaintSplatter1({ className = '', color = '#FF2EC4' }) {
  const edge = darken(color, 0.2);
  const speck = darken(color, 0.12);
  return (
    <svg className={className} viewBox="-100 -100 200 200" aria-hidden="true" focusable="false">
      {/* main blob */}
      <path
        d="M -52 -38
           C -70 -52 -58 -78 -30 -72
           C -14 -82 12 -86 22 -64
           C 48 -70 78 -48 64 -22
           C 86 -8 76 24 50 28
           C 56 52 30 72 8 56
           C -10 80 -44 70 -44 44
           C -74 44 -82 12 -60 0
           C -78 -16 -70 -36 -52 -38 Z"
        fill={color}
        stroke={edge}
        strokeWidth="5"
        strokeLinejoin="round"
      />
      {/* satellite droplets */}
      <circle cx="80" cy="-52" r="5" fill={color} />
      <circle cx="-86" cy="-58" r="4" fill={speck} />
      <circle cx="90" cy="34" r="3.5" fill={color} />
      <circle cx="-78" cy="62" r="5.5" fill={color} />
      <circle cx="30" cy="-90" r="3" fill={color} />
      <circle cx="-30" cy="-92" r="4.5" fill={speck} />
      <circle cx="72" cy="60" r="3" fill={color} />
      {/* drip lines */}
      <path d="M -30 60 Q -26 78 -32 94" stroke={edge} strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="-32" cy="96" r="4" fill={color} />
      <path d="M 14 64 Q 20 80 14 100" stroke={edge} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <circle cx="14" cy="102" r="3.5" fill={color} />
      <path d="M 46 40 Q 50 58 44 74" stroke={edge} strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="44" cy="76" r="3" fill={color} />
    </svg>
  );
}

export function PaintSplatter2({ className = '', color = '#FF2EC4' }) {
  const edge = darken(color, 0.2);
  const speck = darken(color, 0.12);
  return (
    <svg className={className} viewBox="-100 -100 200 200" aria-hidden="true" focusable="false">
      <path
        d="M -44 -52
           Q -78 -56 -64 -24
           Q -88 -6 -58 10
           Q -76 40 -42 42
           Q -38 76 -8 58
           Q 16 84 34 56
           Q 66 66 60 32
           Q 84 14 58 -8
           Q 70 -42 38 -44
           Q 30 -78 2 -60
           Q -20 -82 -44 -52 Z"
        fill={color}
        stroke={edge}
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <circle cx="-90" cy="-40" r="5" fill={color} />
      <circle cx="84" cy="-36" r="4" fill={color} />
      <circle cx="-72" cy="64" r="3.5" fill={speck} />
      <circle cx="86" cy="48" r="5" fill={color} />
      <circle cx="6" cy="-94" r="4.5" fill={color} />
      <circle cx="56" cy="-72" r="3" fill={speck} />
      <path d="M -22 56 Q -16 74 -24 92" stroke={edge} strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="-24" cy="94" r="4.5" fill={color} />
      <path d="M 28 58 Q 34 76 28 96" stroke={edge} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <circle cx="28" cy="98" r="4" fill={color} />
    </svg>
  );
}

export function PaintSplatter3({ className = '', color = '#FF2EC4' }) {
  const edge = darken(color, 0.2);
  const speck = darken(color, 0.12);
  return (
    <svg className={className} viewBox="-100 -100 200 200" aria-hidden="true" focusable="false">
      <path
        d="M -60 -20
           C -82 -34 -66 -66 -38 -56
           C -28 -84 14 -82 18 -54
           C 50 -68 80 -42 60 -18
           C 88 -14 84 22 56 22
           C 64 50 36 66 16 50
           C 4 74 -28 68 -30 44
           C -58 56 -80 26 -58 8
           C -84 -2 -82 -16 -60 -20 Z"
        fill={color}
        stroke={edge}
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <circle cx="78" cy="-50" r="4.5" fill={color} />
      <circle cx="-88" cy="-44" r="3.5" fill={speck} />
      <circle cx="88" cy="44" r="5" fill={color} />
      <circle cx="-46" cy="72" r="4" fill={color} />
      <circle cx="40" cy="-84" r="3" fill={color} />
      <circle cx="-20" cy="-92" r="5.5" fill={color} />
      <circle cx="68" cy="58" r="3" fill={speck} />
      <circle cx="-78" cy="40" r="3.5" fill={color} />
      <path d="M -38 48 Q -32 66 -40 84" stroke={edge} strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="-40" cy="86" r="4" fill={color} />
      <path d="M 2 56 Q 8 74 0 90" stroke={edge} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <circle cx="0" cy="92" r="3.5" fill={color} />
      <path d="M 30 50 Q 36 70 30 88" stroke={edge} strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="30" cy="90" r="3" fill={color} />
    </svg>
  );
}

export function PaintSplatter4({ className = '', color = '#FF2EC4' }) {
  const edge = darken(color, 0.2);
  const speck = darken(color, 0.12);
  return (
    <svg className={className} viewBox="-100 -100 200 200" aria-hidden="true" focusable="false">
      <path
        d="M -48 -44
           C -72 -60 -50 -82 -26 -68
           C -8 -88 28 -76 26 -50
           C 56 -58 78 -30 56 -10
           C 80 6 64 38 38 30
           C 40 60 6 70 -8 48
           C -34 66 -62 44 -50 18
           C -80 14 -76 -22 -50 -22
           C -64 -34 -60 -42 -48 -44 Z"
        fill={color}
        stroke={edge}
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <circle cx="74" cy="-46" r="5" fill={color} />
      <circle cx="-80" cy="-56" r="3.5" fill={color} />
      <circle cx="90" cy="22" r="4" fill={speck} />
      <circle cx="-66" cy="58" r="5" fill={color} />
      <circle cx="14" cy="-88" r="3" fill={color} />
      <circle cx="48" cy="56" r="3.5" fill={speck} />
      <circle cx="-90" cy="6" r="3" fill={color} />
      <path d="M -34 50 Q -40 68 -32 86" stroke={edge} strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="-32" cy="88" r="4.5" fill={color} />
      <path d="M 6 52 Q 12 72 4 92" stroke={edge} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <circle cx="4" cy="94" r="4" fill={color} />
      <path d="M 36 34 Q 42 52 36 70" stroke={edge} strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="36" cy="72" r="3" fill={color} />
    </svg>
  );
}

export function PaintSplatter5({ className = '', color = '#FF2EC4' }) {
  const edge = darken(color, 0.2);
  const speck = darken(color, 0.12);
  return (
    <svg className={className} viewBox="-100 -100 200 200" aria-hidden="true" focusable="false">
      <path
        d="M -56 -30
           Q -84 -48 -56 -60
           Q -50 -86 -20 -70
           Q 6 -88 20 -62
           Q 54 -76 62 -44
           Q 88 -34 70 -8
           Q 90 16 60 30
           Q 70 60 38 60
           Q 22 84 0 62
           Q -26 78 -38 52
           Q -70 56 -62 24
           Q -86 8 -62 -6
           Q -72 -22 -56 -30 Z"
        fill={color}
        stroke={edge}
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <circle cx="-90" cy="-30" r="4" fill={speck} />
      <circle cx="82" cy="-50" r="5" fill={color} />
      <circle cx="92" cy="38" r="3.5" fill={color} />
      <circle cx="-58" cy="74" r="4.5" fill={color} />
      <circle cx="30" cy="-92" r="3" fill={speck} />
      <circle cx="-34" cy="-86" r="5" fill={color} />
      <path d="M -20 62 Q -14 80 -22 96" stroke={edge} strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="-22" cy="98" r="4.5" fill={color} />
      <path d="M 20 60 Q 26 78 18 94" stroke={edge} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <circle cx="18" cy="96" r="4" fill={color} />
      <path d="M 50 46 Q 56 62 50 78" stroke={edge} strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="50" cy="80" r="3" fill={color} />
    </svg>
  );
}

export const PAINT_SPLATTERS = [
  PaintSplatter1,
  PaintSplatter2,
  PaintSplatter3,
  PaintSplatter4,
  PaintSplatter5,
];
