// GameArt.jsx
// One exported component per game's hover-reveal artwork. Each is a
// self-contained SVG using only flat fills and hard-edged shapes (no
// gradients, no blur/glow filters) to match the cel-shaded Newgrounds
// style locked in for this project. GameCard.jsx looks these up by name
// via the `artKey` field in gameData.js.

export function WordBombArt() {
  return (
    <svg viewBox="0 0 140 168" width="100%" height="100%">
      <path d="M70 75 Q90 50 100 35" fill="none" stroke="#000" strokeWidth="7" strokeLinecap="round" />
      <path d="M69 74 Q89 49 99 34" fill="none" stroke="#FFB347" strokeWidth="3" strokeLinecap="round" />
      <polygon points="95,22 112,28 100,40 108,46 90,40" fill="#FFE94A" stroke="#000" strokeWidth="4" strokeLinejoin="round" />
      <circle cx="68" cy="105" r="42" fill="#3a0a3e" stroke="#000" strokeWidth="7" />
      <path d="M40 85 A42 42 0 0 1 68 63" fill="none" stroke="#7A1A80" strokeWidth="9" strokeLinecap="round" />
      <ellipse cx="50" cy="90" rx="11" ry="7" fill="#9A3AA0" opacity="0.8" />
    </svg>
  );
}

export function CategoryBlitzArt() {
  return (
    <svg viewBox="0 0 140 168" width="100%" height="100%">
      <g transform="translate(70,100)">
        <path d="M-22 -35 L22 -35 L18 5 Q18 18 0 18 Q-18 18 -18 5 Z" fill="#FFE94A" stroke="#000" strokeWidth="6" strokeLinejoin="round" />
        <path d="M-22 -35 L0 -35 L-2 5 Q-2 14 -10 16 Q-18 12 -18 5 Z" fill="#FFF7C2" opacity="0.8" />
        <path d="M-22 -28 Q-40 -28 -38 -10 Q-36 5 -18 0" fill="none" stroke="#000" strokeWidth="6" strokeLinecap="round" />
        <path d="M22 -28 Q40 -28 38 -10 Q36 5 18 0" fill="none" stroke="#000" strokeWidth="6" strokeLinecap="round" />
        <rect x="-8" y="18" width="16" height="14" fill="#E0B400" stroke="#000" strokeWidth="5" />
        <rect x="-20" y="32" width="40" height="9" rx="2" fill="#FFE94A" stroke="#000" strokeWidth="6" />
      </g>
    </svg>
  );
}

export function MoreSoonArt() {
  return (
    <svg viewBox="0 0 140 168" width="100%" height="100%">
      <text x="70" y="120" textAnchor="middle" fontFamily="'Bungee', cursive" fontSize="70" fill="#2EFFE0" opacity="0.5">
        ?
      </text>
    </svg>
  );
}

// Lookup map so GameCard can resolve `artKey` strings from gameData.js
// to the actual component without a long if/else chain.
export const GAME_ART_COMPONENTS = {
  WordBombArt,
  CategoryBlitzArt,
  MoreSoonArt,
};
