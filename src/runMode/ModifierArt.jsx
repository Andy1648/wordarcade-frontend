// ModifierArt.jsx — one AUTHORED SVG motif per RUN modifier, in the house card idiom
// (see components/GameArt.jsx): a flat neon field, a faint inked burst behind, and a
// bespoke black-outlined motif that matches the modifier's EFFECT — never a plain tile.
// Each scene is authored at 100×100 and SLICED to cover the card-art banner. STATIC —
// no idle CSS loops (menu motion law). Looked up by modifier id via MODIFIER_ART.
const BUNGEE = "'Bungee', sans-serif";

// A faint radial pinwheel of wedges — the edge-to-edge structure behind every motif so
// the field is never a flat void.
function burst(fill, op = 0.5, cx = 50, cy = 44, r = 140, n = 20) {
  const w = [];
  for (let i = 0; i < n; i += 2) {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = ((i + 1) / n) * Math.PI * 2;
    w.push(
      <polygon key={i} fill={fill}
        points={`${cx},${cy} ${(cx + Math.cos(a0) * r).toFixed(1)},${(cy + Math.sin(a0) * r).toFixed(1)} ${(cx + Math.cos(a1) * r).toFixed(1)},${(cy + Math.sin(a1) * r).toFixed(1)}`} />
    );
  }
  return <g opacity={op}>{w}</g>;
}

// icon defaults: thick black outline, round joins.
const IK = { stroke: '#000', strokeWidth: 4.5, strokeLinejoin: 'round', strokeLinecap: 'round' };

// { field, ink (burst tone), icon } per modifier id.
const MOTIF = {
  // 3+ vowels ×2 — two vowel tiles.
  'double-vowels': { field: '#FF4FA3', ink: '#E23B8C', icon: (
    <>
      <g transform="rotate(-9 36 56)"><rect x="14" y="32" width="44" height="48" rx="7" fill="#FFE94A" {...IK} /><text x="36" y="68" fontSize="34" fontWeight="bold" fill="#000" textAnchor="middle" fontFamily={BUNGEE}>A</text></g>
      <g transform="rotate(9 66 48)"><rect x="44" y="22" width="44" height="48" rx="7" fill="#2EFFE0" {...IK} /><text x="66" y="58" fontSize="34" fontWeight="bold" fill="#000" textAnchor="middle" fontFamily={BUNGEE}>E</text></g>
    </>
  ) },
  // ×1.5 but fewer words — a stubby bomb, tiny lit fuse.
  'short-fuse': { field: '#FF6B3D', ink: '#D24F22', icon: (
    <>
      <circle cx="46" cy="64" r="27" fill="#2E1432" {...IK} />
      <circle cx="37" cy="55" r="6" fill="#5A2A60" />
      <rect x="39" y="30" width="15" height="11" rx="2" fill="#5A4A2A" {...IK} strokeWidth="3.5" />
      <path d="M48 30 q7 -7 11 -9" fill="none" {...IK} />
      <path d="M62 14 c-6 5 -4 12 1 15 c6 -2 8 -10 3 -15z" fill="#FFE94A" stroke="#B23C00" strokeWidth="3" strokeLinejoin="round" />
    </>
  ) },
  // RARE+ ×3 — a book under a magnifier.
  'lexicographer': { field: '#9A1AFF', ink: '#7A12CC', icon: (
    <>
      <path d="M16 42 q22 -9 30 -1 v34 q-8 -8 -30 1z" fill="#F3E2BE" {...IK} />
      <path d="M76 42 q-22 -9 -30 -1 v34 q8 -8 30 1z" fill="#E4CE9A" {...IK} />
      <path d="M24 50 h14 M24 58 h14 M54 50 h14 M54 58 h14" stroke="#000" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="64" cy="62" r="14" fill="none" {...IK} strokeWidth="5" />
      <line x1="74" y1="72" x2="86" y2="84" {...IK} strokeWidth="7" />
    </>
  ) },
  // combo cap up — a rising flame streak.
  'hot-streak': { field: '#FF4FA3', ink: '#E23B8C', icon: (
    <>
      <path d="M50 16 c-16 16 -24 22 -24 38 a24 24 0 0 0 48 0 c0 -11 -6 -18 -12 -24 c-2 7 -6 9 -11 7 c5 -9 3 -19 -1 -21z" fill="#FF6B3D" {...IK} />
      <path d="M50 44 c-8 8 -11 12 -11 20 a11 11 0 0 0 22 0 c0 -8 -5 -12 -11 -20z" fill="#FFE94A" stroke="#B23C00" strokeWidth="3" strokeLinejoin="round" />
    </>
  ) },
  // lucky odds up — a four-leaf clover.
  'lucky-charm': { field: '#2EFFE0', ink: '#22D9C0', icon: (
    <>
      <path d="M50 46 q-16 -18 -2 -24 q14 -2 2 24z" fill="#3ED66A" {...IK} />
      <path d="M50 46 q18 -16 24 -2 q2 14 -24 2z" fill="#3ED66A" {...IK} />
      <path d="M50 46 q16 18 2 24 q-14 2 -2 -24z" fill="#3ED66A" {...IK} />
      <path d="M50 46 q-18 16 -24 2 q-2 -14 24 -2z" fill="#3ED66A" {...IK} />
      <circle cx="50" cy="46" r="5" fill="#1F7A3B" />
      <path d="M52 52 q6 16 -6 30" fill="none" {...IK} strokeWidth="4" />
    </>
  ) },
  // lucky payout ×8 — a slot window, 7-7-7.
  'jackpot': { field: '#FFE94A', ink: '#E3CE1F', icon: (
    <>
      <rect x="16" y="30" width="68" height="42" rx="6" fill="#2E1432" {...IK} />
      <line x1="39" y1="32" x2="39" y2="70" stroke="#000" strokeWidth="3" />
      <line x1="61" y1="32" x2="61" y2="70" stroke="#000" strokeWidth="3" />
      <text x="27" y="62" fontSize="30" fontWeight="bold" fill="#FF4FA3" textAnchor="middle" fontFamily={BUNGEE}>7</text>
      <text x="50" y="62" fontSize="30" fontWeight="bold" fill="#2EFFE0" textAnchor="middle" fontFamily={BUNGEE}>7</text>
      <text x="73" y="62" fontSize="30" fontWeight="bold" fill="#FF4FA3" textAnchor="middle" fontFamily={BUNGEE}>7</text>
    </>
  ) },
  // +0.4× every word, no luck — a book with a worm.
  'bookworm': { field: '#3DA8FF', ink: '#2E90E6', icon: (
    <>
      <rect x="26" y="34" width="48" height="46" rx="4" fill="#FF4FA3" {...IK} />
      <rect x="32" y="40" width="36" height="34" rx="2" fill="#F3E2BE" stroke="#000" strokeWidth="2.5" />
      <path d="M40 50 h20 M40 58 h20 M40 66 h14" stroke="#B02F6E" strokeWidth="2.5" strokeLinecap="round" />
      <g fill="#3ED66A" stroke="#000" strokeWidth="3">
        <circle cx="58" cy="30" r="7" /><circle cx="66" cy="24" r="7" /><circle cx="74" cy="20" r="8" />
      </g>
      <circle cx="76" cy="18" r="2" fill="#000" />
    </>
  ) },
  // length bonus doubled — a stretched ruler / span.
  'long-haul': { field: '#9A1AFF', ink: '#7A12CC', icon: (
    <>
      <rect x="14" y="40" width="72" height="22" rx="4" fill="#FFE94A" {...IK} />
      <line x1="26" y1="40" x2="26" y2="52" stroke="#000" strokeWidth="3" />
      <line x1="38" y1="40" x2="38" y2="55" stroke="#000" strokeWidth="3" />
      <line x1="50" y1="40" x2="50" y2="52" stroke="#000" strokeWidth="3" />
      <line x1="62" y1="40" x2="62" y2="55" stroke="#000" strokeWidth="3" />
      <line x1="74" y1="40" x2="74" y2="52" stroke="#000" strokeWidth="3" />
      <path d="M10 74 h80 M10 74 l8 -5 M10 74 l8 5 M90 74 l-8 -5 M90 74 l-8 5" fill="none" {...IK} strokeWidth="4" />
    </>
  ) },
  // COMMON ×1.8 — a little crowd.
  'common-folk': { field: '#2EFFE0', ink: '#22D9C0', icon: (
    <g {...IK}>
      <circle cx="30" cy="40" r="9" fill="#FF6B3D" /><path d="M18 78 q0 -18 12 -18 q12 0 12 18z" fill="#FF6B3D" />
      <circle cx="70" cy="40" r="9" fill="#9A1AFF" /><path d="M58 78 q0 -18 12 -18 q12 0 12 18z" fill="#9A1AFF" />
      <circle cx="50" cy="34" r="11" fill="#FFE94A" /><path d="M35 80 q0 -20 15 -20 q15 0 15 20z" fill="#FFE94A" />
    </g>
  ) },
  // ×2.5 but 8%/round the run ends — a cracked cannon.
  'glass-cannon': { field: '#FF6B3D', ink: '#D24F22', icon: (
    <>
      <circle cx="32" cy="66" r="15" fill="#2E1432" {...IK} />
      <line x1="32" y1="55" x2="32" y2="77" stroke="#FF6B3D" strokeWidth="3" /><line x1="21" y1="66" x2="43" y2="66" stroke="#FF6B3D" strokeWidth="3" />
      <path d="M28 60 L60 34 L74 46 L42 72z" fill="#8FA0B8" {...IK} />
      <circle cx="70" cy="40" r="7" fill="#FFE94A" stroke="#B23C00" strokeWidth="3" />
      <polyline points="46,44 52,50 45,55 53,62" fill="none" stroke="#FF3B3B" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" />
    </>
  ) },
  // +0.3×/round forever — a rolling snowball.
  'snowball': { field: '#2EFFE0', ink: '#22D9C0', icon: (
    <>
      <g stroke="#22D9C0" strokeWidth="5" strokeLinecap="round"><line x1="12" y1="42" x2="26" y2="42" /><line x1="10" y1="58" x2="24" y2="58" /><line x1="16" y1="74" x2="30" y2="74" /></g>
      <circle cx="58" cy="58" r="24" fill="#EAF6FF" {...IK} />
      <circle cx="52" cy="52" r="3.5" fill="#B9DCEA" /><circle cx="66" cy="60" r="3" fill="#B9DCEA" /><circle cx="58" cy="66" r="2.5" fill="#B9DCEA" />
    </>
  ) },
  // remove the ×40 cap — an up-arrow smashing through a ceiling.
  'uncapped': { field: '#FFE94A', ink: '#E3CE1F', icon: (
    <>
      <line x1="14" y1="40" x2="38" y2="40" stroke="#000" strokeWidth="5" strokeLinecap="round" strokeDasharray="7 6" />
      <line x1="62" y1="40" x2="86" y2="40" stroke="#000" strokeWidth="5" strokeLinecap="round" strokeDasharray="7 6" />
      <path d="M50 82 V32" {...IK} stroke="#FF4FA3" strokeWidth="9" />
      <path d="M50 22 L34 44 M50 22 L66 44" fill="none" {...IK} stroke="#FF4FA3" strokeWidth="9" />
      <circle cx="40" cy="34" r="2.5" fill="#000" /><circle cx="62" cy="30" r="2.5" fill="#000" />
    </>
  ) },
  // +0.3×/vowel — a vowel gliding with speed lines.
  'vowel-movement': { field: '#FF4FA3', ink: '#E23B8C', icon: (
    <>
      <g stroke="#000" strokeWidth="5" strokeLinecap="round"><line x1="14" y1="34" x2="30" y2="34" /><line x1="10" y1="50" x2="28" y2="50" /><line x1="14" y1="66" x2="30" y2="66" /></g>
      <circle cx="60" cy="50" r="21" fill="none" {...IK} stroke="#2EFFE0" strokeWidth="10" />
      <circle cx="60" cy="50" r="21" fill="none" stroke="#000" strokeWidth="4" /><circle cx="60" cy="50" r="12" fill="none" stroke="#000" strokeWidth="4" />
    </>
  ) },
  // OBSCURE ×6 — a faceted gem.
  'rare-breed': { field: '#9A1AFF', ink: '#7A12CC', icon: (
    <>
      <path d="M50 84 L20 46 L32 28 H68 L80 46 Z" fill="#2EFFE0" {...IK} />
      <path d="M20 46 H80 M50 84 L32 46 M50 84 L68 46 M32 28 L40 46 M68 28 L60 46 M40 46 L50 28 L60 46" fill="none" stroke="#0A6A5E" strokeWidth="2.5" />
    </>
  ) },
  // combo builds faster — a crown.
  'combo-king': { field: '#FF6B3D', ink: '#D24F22', icon: (
    <>
      <path d="M22 70 L26 36 L40 54 L50 30 L60 54 L74 36 L78 70 Z" fill="#FFE94A" {...IK} />
      <rect x="22" y="70" width="56" height="12" rx="3" fill="#FFC24A" {...IK} />
      <circle cx="50" cy="30" r="5" fill="#FF4FA3" stroke="#000" strokeWidth="3" />
      <circle cx="26" cy="36" r="4" fill="#2EFFE0" stroke="#000" strokeWidth="2.5" /><circle cx="74" cy="36" r="4" fill="#2EFFE0" stroke="#000" strokeWidth="2.5" />
    </>
  ) },
  // +150 flat wins — a fat coin sack.
  'deep-pockets': { field: '#2EFFE0', ink: '#22D9C0', icon: (
    <>
      <path d="M34 42 q16 -11 32 0 q12 12 8 28 a24 15 0 0 1 -48 0 q-4 -16 8 -28z" fill="#C79A3A" {...IK} />
      <path d="M34 42 q16 -8 32 0" fill="none" {...IK} strokeWidth="4" />
      <circle cx="50" cy="66" r="12" fill="#FFE94A" stroke="#000" strokeWidth="3.5" />
      <text x="50" y="72" fontSize="14" fontWeight="bold" fill="#000" textAnchor="middle" fontFamily={BUNGEE}>W</text>
    </>
  ) },
  // J/Q/X/Z ×3 — a tile bag with a Q tile.
  'scrabble-bag': { field: '#FFE94A', ink: '#E3CE1F', icon: (
    <>
      <path d="M30 46 q20 -10 40 0 q6 22 -2 30 a20 12 0 0 1 -36 0 q-8 -8 -2 -30z" fill="#8B5A2B" {...IK} />
      <path d="M28 46 q22 -12 44 0" fill="none" {...IK} strokeWidth="4" />
      <rect x="38" y="30" width="26" height="26" rx="4" fill="#F3E2BE" {...IK} />
      <text x="51" y="51" fontSize="20" fontWeight="bold" fill="#000" textAnchor="middle" fontFamily={BUNGEE}>Q</text>
    </>
  ) },
  // clean round → +0.5× — forward chevrons (momentum).
  'momentum': { field: '#FF4FA3', ink: '#E23B8C', icon: (
    <>
      <g fill="none" stroke="#000" strokeWidth="14" strokeLinejoin="round" strokeLinecap="round">
        <polyline points="24,32 42,50 24,68" /><polyline points="44,32 62,50 44,68" /><polyline points="64,32 82,50 64,68" />
      </g>
      <g fill="none" stroke="#2EFFE0" strokeWidth="8" strokeLinejoin="round" strokeLinecap="round">
        <polyline points="24,32 42,50 24,68" /><polyline points="44,32 62,50 44,68" /><polyline points="64,32 82,50 64,68" />
      </g>
    </>
  ) },
};

const FALLBACK = { field: '#9A1AFF', ink: '#7A12CC', icon: (
  <text x="50" y="64" fontSize="44" fontWeight="bold" fill="#000" textAnchor="middle" fontFamily={BUNGEE}>?</text>
) };

export default function ModifierArt({ id, className = 'run-card-art-svg' }) {
  const m = MOTIF[id] || FALLBACK;
  return (
    <svg className={className} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="100" height="100" fill={m.field} />
      {burst(m.ink, 0.55)}
      {m.icon}
    </svg>
  );
}

export const MODIFIER_ART_FIELD = Object.fromEntries(Object.entries(MOTIF).map(([k, v]) => [k, v.field]));
