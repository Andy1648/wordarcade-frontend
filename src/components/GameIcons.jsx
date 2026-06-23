// GameIcons.jsx
// The small icon glyphs shown in each card's icon badge (top-left circle),
// separate from the larger hover-reveal artwork in GameArt.jsx. Kept
// small and simple since they're always visible, not just on hover.

export function BombIcon() {
  // A lit bomb sitting in front of a spiky explosion burst.
  return (
    <svg width="16" height="16" viewBox="0 0 22 22" fill="none">
      <path
        d="M11 1.5 L13 6 L17.5 4.5 L16 9 L20.5 11 L16 13 L17.5 17.5 L13 16 L11 20.5 L9 16 L4.5 17.5 L6 13 L1.5 11 L6 9 L4.5 4.5 L9 6 Z"
        fill="#FF2EC4"
        stroke="#B30D85"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="13" r="5.5" fill="#222" stroke="#000" strokeWidth="2" />
      <rect x="11.4" y="5.6" width="3.2" height="2.4" rx="0.6" fill="#444" stroke="#000" strokeWidth="1.6" transform="rotate(38 13 6.8)" />
      <path d="M13.5 6 Q16.5 4 18 5.8" stroke="#000" strokeWidth="2" strokeLinecap="round" fill="none" />
      <circle cx="18.2" cy="5" r="1.8" fill="#FFD23F" stroke="#FF6B00" strokeWidth="1.4" />
      <circle cx="8" cy="11" r="1.4" fill="#fff" />
    </svg>
  );
}

export function CategoryIcon() {
  // A light bulb with an exclamation mark - the "aha!" idea spark.
  return (
    <svg width="16" height="16" viewBox="0 0 22 22" fill="none">
      <path
        d="M11 1.5 C6.6 1.5 3.5 4.4 3.5 8.2 C3.5 10.8 5 12.6 6.5 14 L6.5 16 L15.5 16 L15.5 14 C17 12.6 18.5 10.8 18.5 8.2 C18.5 4.4 15.4 1.5 11 1.5 Z"
        fill="#FFD23F"
        stroke="#C98A00"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <rect x="7" y="16" width="8" height="2.6" rx="1" fill="#9A9A9A" stroke="#000" strokeWidth="1.6" />
      <rect x="8" y="18.6" width="6" height="2.4" rx="1.1" fill="#777" stroke="#000" strokeWidth="1.6" />
      <rect x="9.8" y="5" width="2.4" height="5" rx="1.2" fill="#B30D85" />
      <circle cx="11" cy="12.4" r="1.4" fill="#B30D85" />
    </svg>
  );
}

export function ImposterIcon() {
  // A bandit / superhero eye mask - hiding in plain sight.
  return (
    <svg width="16" height="16" viewBox="0 0 22 22" fill="none">
      <path
        d="M2 8 Q3 5.5 6 6 L16 6 Q19 5.5 20 8 Q20.5 11 18.5 13 Q16.5 14.5 14.5 13 Q13 12 11 12 Q9 12 7.5 13 Q5.5 14.5 3.5 13 Q1.5 11 2 8 Z"
        fill="#9A1AFF"
        stroke="#4B0A87"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="7" cy="9.3" r="2.1" fill="#fff" stroke="#4B0A87" strokeWidth="1.4" />
      <circle cx="15" cy="9.3" r="2.1" fill="#fff" stroke="#4B0A87" strokeWidth="1.4" />
      <circle cx="7" cy="9.3" r="0.9" fill="#222" />
      <circle cx="15" cy="9.3" r="0.9" fill="#222" />
    </svg>
  );
}

export const GAME_ICON_COMPONENTS = {
  'word-bomb': BombIcon,
  'category-blitz': CategoryIcon,
  'imposter-word': ImposterIcon,
};
