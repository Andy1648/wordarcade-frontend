// GameArt.jsx
// One exported component per game's hover-reveal artwork. Each is a
// self-contained SVG using only flat fills and hard-edged shapes (no
// gradients, no blur/glow filters) to match the cel-shaded Newgrounds
// style locked in for this project. GameCard.jsx looks these up by name
// via the `artKey` field in gameData.js.

export function WordBombArt() {
  // Card background is cyan (#2EFFE0): warm/dark scene for contrast.
  // A lit cartoon bomb mid-blast with floating letter tiles, speed lines,
  // explosion puffs and sparkles.
  return (
    <svg viewBox="0 0 140 168" width="100%" height="100%">
      {/* Speed lines radiating from the bomb */}
      <line x1="14" y1="58" x2="30" y2="68" stroke="#1A6A5E" strokeWidth="5" strokeLinecap="round" />
      <line x1="10" y1="110" x2="28" y2="110" stroke="#1A6A5E" strokeWidth="5" strokeLinecap="round" />
      <line x1="20" y1="150" x2="34" y2="138" stroke="#1A6A5E" strokeWidth="5" strokeLinecap="round" />
      <line x1="120" y1="138" x2="106" y2="128" stroke="#1A6A5E" strokeWidth="5" strokeLinecap="round" />
      <line x1="128" y1="100" x2="112" y2="100" stroke="#1A6A5E" strokeWidth="5" strokeLinecap="round" />

      {/* Explosion puffs (cloud-like bumpy shapes) behind the bomb */}
      <path d="M96 118 q-8 -10 4 -12 q2 -10 12 -4 q10 -4 9 8 q9 5 -2 11 q-4 9 -12 3 q-9 4 -11 -6 z" fill="#FF7A2E" stroke="#B23C00" strokeWidth="4" strokeLinejoin="round" />
      <path d="M104 142 q-6 -8 3 -9 q1 -7 9 -3 q8 -3 7 6 q7 4 -2 8 q-3 7 -9 2 q-6 3 -8 -4 z" fill="#FFC83A" stroke="#B23C00" strokeWidth="4" strokeLinejoin="round" />

      {/* Curved fuse */}
      <path d="M70 70 Q92 46 100 30" fill="none" stroke="#3A2A10" strokeWidth="7" strokeLinecap="round" />
      <path d="M70 70 Q92 46 100 30" fill="none" stroke="#C98A3A" strokeWidth="3" strokeLinecap="round" />

      {/* Flame (layered orange / yellow) */}
      <polygon points="100,12 110,30 100,26 92,32 95,22" fill="#FF7A2E" stroke="#B23C00" strokeWidth="4" strokeLinejoin="round" />
      <polygon points="100,18 105,29 100,27 96,30" fill="#FFE94A" stroke="none" />

      {/* Bomb cap */}
      <rect x="58" y="58" width="22" height="12" rx="2" fill="#5A4A2A" stroke="#2A2010" strokeWidth="4" strokeLinejoin="round" />

      {/* Bomb body */}
      <circle cx="64" cy="106" r="40" fill="#2E1432" stroke="#150818" strokeWidth="6" />
      {/* Highlight glint on body */}
      <ellipse cx="48" cy="90" rx="11" ry="7" fill="#5A2A60" />

      {/* Letter tiles floating around the bomb (cream/tan, tilted) */}
      <g transform="translate(28,46) rotate(-18)">
        <rect x="-12" y="-12" width="24" height="24" rx="5" fill="#F3E2BE" stroke="#9A7A3A" strokeWidth="4" />
        <text x="0" y="6" fontSize="16" fontWeight="bold" fill="#3A2A10" textAnchor="middle" fontFamily="sans-serif">B</text>
      </g>
      <g transform="translate(112,62) rotate(14)">
        <rect x="-11" y="-11" width="22" height="22" rx="5" fill="#F3E2BE" stroke="#9A7A3A" strokeWidth="4" />
        <text x="0" y="6" fontSize="15" fontWeight="bold" fill="#3A2A10" textAnchor="middle" fontFamily="sans-serif">O</text>
      </g>
      <g transform="translate(34,140) rotate(10)">
        <rect x="-11" y="-11" width="22" height="22" rx="5" fill="#F3E2BE" stroke="#9A7A3A" strokeWidth="4" />
        <text x="0" y="6" fontSize="15" fontWeight="bold" fill="#3A2A10" textAnchor="middle" fontFamily="sans-serif">M</text>
      </g>
      <g transform="translate(110,148) rotate(-12)">
        <rect x="-11" y="-11" width="22" height="22" rx="5" fill="#F3E2BE" stroke="#9A7A3A" strokeWidth="4" />
        <text x="0" y="6" fontSize="15" fontWeight="bold" fill="#3A2A10" textAnchor="middle" fontFamily="sans-serif">W</text>
      </g>

      {/* Sparkle stars near the fuse */}
      <polygon points="84,40 87,46 93,49 87,52 84,58 81,52 75,49 81,46" fill="#FFE94A" stroke="#B23C00" strokeWidth="2" strokeLinejoin="round" />
      <polygon points="116,38 118,42 122,44 118,46 116,50 114,46 110,44 114,42" fill="#FFF7C2" stroke="#B23C00" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

export function CategoryBlitzArt() {
  // Card background is orange (#FF6B3D): cool/bright contrast scene.
  // A buzzing brain firing lightning, surrounded by question marks, an
  // exclamation, a ticking clock and speed lines.
  return (
    <svg viewBox="0 0 140 168" width="100%" height="100%">
      {/* Speed lines suggesting fast thinking */}
      <line x1="8" y1="46" x2="24" y2="52" stroke="#A33000" strokeWidth="5" strokeLinecap="round" />
      <line x1="6" y1="86" x2="22" y2="86" stroke="#A33000" strokeWidth="5" strokeLinecap="round" />
      <line x1="132" y1="60" x2="116" y2="66" stroke="#A33000" strokeWidth="5" strokeLinecap="round" />

      {/* Lightning bolts out of the brain */}
      <polygon points="30,98 18,128 30,124 22,150 44,116 32,120 40,98" fill="#FFE94A" stroke="#B23C00" strokeWidth="4" strokeLinejoin="round" />
      <polygon points="110,98 102,124 112,122 106,144 124,114 114,116 120,98" fill="#FFE94A" stroke="#B23C00" strokeWidth="4" strokeLinejoin="round" />

      {/* Brain: lumpy magenta/pink oval */}
      <path
        d="M70 50 q22 -2 24 18 q12 6 4 20 q4 14 -12 16 q-6 10 -16 4 q-10 6 -16 -4 q-16 -2 -12 -16 q-8 -14 4 -20 q2 -20 24 -18 z"
        fill="#FF6FB5"
        stroke="#B02F6E"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      {/* Center wavy divide */}
      <path d="M70 50 Q66 70 72 86 Q66 100 70 110" fill="none" stroke="#B02F6E" strokeWidth="4" strokeLinecap="round" />
      {/* Fold curves */}
      <path d="M52 64 Q58 70 52 76" fill="none" stroke="#B02F6E" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M88 64 Q82 70 88 76" fill="none" stroke="#B02F6E" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M54 92 Q60 96 56 102" fill="none" stroke="#B02F6E" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M86 92 Q80 96 84 102" fill="none" stroke="#B02F6E" strokeWidth="3.5" strokeLinecap="round" />

      {/* Floating question marks (cyan / white, varied) */}
      <text x="24" y="44" fontSize="26" fontWeight="bold" fill="#2EFFE0" stroke="#0F8A78" strokeWidth="1.5" textAnchor="middle" fontFamily="sans-serif" transform="rotate(-16 24 44)">?</text>
      <text x="116" y="40" fontSize="20" fontWeight="bold" fill="#FFFFFF" stroke="#0F8A78" strokeWidth="1.5" textAnchor="middle" fontFamily="sans-serif" transform="rotate(12 116 40)">?</text>
      <text x="22" y="132" fontSize="22" fontWeight="bold" fill="#FFFFFF" stroke="#0F8A78" strokeWidth="1.5" textAnchor="middle" fontFamily="sans-serif" transform="rotate(8 22 132)">?</text>
      <text x="120" y="138" fontSize="28" fontWeight="bold" fill="#2EFFE0" stroke="#0F8A78" strokeWidth="1.5" textAnchor="middle" fontFamily="sans-serif" transform="rotate(-10 120 138)">?</text>
      <text x="70" y="34" fontSize="18" fontWeight="bold" fill="#FFFFFF" stroke="#0F8A78" strokeWidth="1.5" textAnchor="middle" fontFamily="sans-serif">?</text>

      {/* Exclamation mark (yellow) */}
      <text x="98" y="160" fontSize="26" fontWeight="bold" fill="#FFE94A" stroke="#B23C00" strokeWidth="1.5" textAnchor="middle" fontFamily="sans-serif" transform="rotate(10 98 160)">!</text>

      {/* Clock / timer to one side */}
      <g transform="translate(34,150)">
        <circle cx="0" cy="0" r="15" fill="#FFFFFF" stroke="#2A2A2A" strokeWidth="4" />
        <line x1="0" y1="0" x2="0" y2="-9" stroke="#2A2A2A" strokeWidth="3" strokeLinecap="round" />
        <line x1="0" y1="0" x2="7" y2="3" stroke="#2A2A2A" strokeWidth="3" strokeLinecap="round" />
        <line x1="0" y1="-12" x2="0" y2="-15" stroke="#2A2A2A" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="12" y1="0" x2="15" y2="0" stroke="#2A2A2A" strokeWidth="2.5" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export function ImposterWordArt() {
  // Card background is purple (#9A1AFF): bright/contrasting detective scene.
  // A narrowed suspicious eye under a magnifying glass, question marks (one
  // red), sneaky footprints and a "WANTED" poster fading in the background.
  return (
    <svg viewBox="0 0 140 168" width="100%" height="100%">
      {/* WANTED poster in the background (low prominence, torn edges) */}
      <g opacity="0.45">
        <polygon
          points="26,20 110,16 116,28 112,120 104,128 32,124 24,116 30,30"
          fill="#E9D6A8"
          stroke="#9A7A3A"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <text x="70" y="40" fontSize="13" fontWeight="bold" fill="#9A7A3A" textAnchor="middle" fontFamily="sans-serif" letterSpacing="1">WANTED</text>
        <text x="70" y="96" fontSize="30" fontWeight="bold" fill="#9A7A3A" textAnchor="middle" fontFamily="sans-serif">?</text>
      </g>

      {/* Large narrowed eye */}
      <ellipse cx="62" cy="72" rx="40" ry="26" fill="#FFFFFF" stroke="#3A1060" strokeWidth="5" />
      {/* Iris (coloured ring) + pupil + glint */}
      <circle cx="62" cy="74" r="17" fill="#2EBFE0" stroke="#0F6A88" strokeWidth="4" />
      <circle cx="62" cy="74" r="8" fill="#101018" />
      <circle cx="57" cy="69" r="3" fill="#FFFFFF" />
      {/* Suspicious upper lid cutting across (narrowing the eye) */}
      <path d="M22 70 Q62 48 102 70 Q62 60 22 70 Z" fill="#3A1060" stroke="#3A1060" strokeWidth="2" strokeLinejoin="round" />
      <path d="M24 56 Q40 50 54 54" fill="none" stroke="#3A1060" strokeWidth="4" strokeLinecap="round" />

      {/* Magnifying glass overlapping the eye */}
      <line x1="100" y1="108" x2="124" y2="138" stroke="#3A1060" strokeWidth="9" strokeLinecap="round" />
      <line x1="100" y1="108" x2="124" y2="138" stroke="#7A3AB0" strokeWidth="4" strokeLinecap="round" />
      <circle cx="86" cy="92" r="24" fill="#BFEAF5" fillOpacity="0.4" stroke="#3A1060" strokeWidth="6" />
      <path d="M72 80 Q78 76 84 80" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" opacity="0.7" />

      {/* Question marks (white, one red standing out) */}
      <text x="18" y="40" fontSize="22" fontWeight="bold" fill="#FFFFFF" stroke="#3A1060" strokeWidth="1.5" textAnchor="middle" fontFamily="sans-serif" transform="rotate(-14 18 40)">?</text>
      <text x="124" y="44" fontSize="20" fontWeight="bold" fill="#FFFFFF" stroke="#3A1060" strokeWidth="1.5" textAnchor="middle" fontFamily="sans-serif" transform="rotate(12 124 44)">?</text>
      <text x="118" y="150" fontSize="26" fontWeight="bold" fill="#FF5C5C" stroke="#7A1010" strokeWidth="1.5" textAnchor="middle" fontFamily="sans-serif" transform="rotate(10 118 150)">?</text>

      {/* Sneaky footprints leading away across the bottom */}
      <ellipse cx="24" cy="150" rx="6" ry="9" fill="#1A0A2A" stroke="#3A1060" strokeWidth="2" transform="rotate(-24 24 150)" />
      <ellipse cx="44" cy="158" rx="6" ry="9" fill="#1A0A2A" stroke="#3A1060" strokeWidth="2" transform="rotate(-12 44 158)" />
      <ellipse cx="66" cy="160" rx="6" ry="9" fill="#1A0A2A" stroke="#3A1060" strokeWidth="2" transform="rotate(-2 66 160)" />
    </svg>
  );
}

// Lookup map so GameCard can resolve `artKey` strings from gameData.js
// to the actual component without a long if/else chain.
export const GAME_ART_COMPONENTS = {
  WordBombArt,
  CategoryBlitzArt,
  ImposterWordArt,
};
