// GameIcons.jsx
// The small icon glyphs shown in each card's icon badge (top-left circle),
// separate from the larger hover-reveal artwork in GameArt.jsx. Kept
// small and simple since they're always visible, not just on hover.

export function ChainIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 22 22" fill="none">
      <circle cx="5" cy="11" r="3.5" stroke="#000" strokeWidth="2.3" />
      <circle cx="17" cy="11" r="3.5" stroke="#000" strokeWidth="2.3" />
      <path d="M8.5 11h5" stroke="#000" strokeWidth="2.3" strokeLinecap="round" />
    </svg>
  );
}

export function BombIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 22 22" fill="none">
      <circle cx="10" cy="13" r="6" stroke="#000" strokeWidth="2.3" />
      <path d="M14 7 Q17 4 19 5.5" stroke="#000" strokeWidth="2" strokeLinecap="round" fill="none" />
      <circle cx="19" cy="4.5" r="2" fill="#FF2EC4" />
    </svg>
  );
}

export function DuelIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 22 22" fill="none">
      <path
        d="M3 11 L8 6 L8 9 L14 9 L14 6 L19 11 L14 16 L14 13 L8 13 L8 16 Z"
        stroke="#000"
        strokeWidth="2.1"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function SuffixIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 22 22" fill="none">
      <path d="M3 6h9M3 11h13M3 16h7" stroke="#FFE94A" strokeWidth="2.3" strokeLinecap="round" />
      <path d="M17 13 L20 16 L17 19" stroke="#FFE94A" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function CategoryIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 22 22" fill="none">
      <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="#000" strokeWidth="2.3" />
      <rect x="12" y="3" width="7" height="7" rx="1.5" stroke="#000" strokeWidth="2.3" />
      <rect x="3" y="12" width="7" height="7" rx="1.5" stroke="#FF6B3D" strokeWidth="2.3" />
      <rect x="12" y="12" width="7" height="7" rx="1.5" stroke="#000" strokeWidth="2.3" />
    </svg>
  );
}

export function MoreSoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 22 22" fill="none">
      <circle cx="6" cy="11" r="2.2" fill="#2EFFE0" />
      <circle cx="11" cy="11" r="2.2" fill="#2EFFE0" />
      <circle cx="16" cy="11" r="2.2" fill="#2EFFE0" />
    </svg>
  );
}

export const GAME_ICON_COMPONENTS = {
  'chain-reaction': ChainIcon,
  'word-bomb': BombIcon,
  'word-duel': DuelIcon,
  'suffix-surge': SuffixIcon,
  'category-blitz': CategoryIcon,
  'more-soon': MoreSoonIcon,
};
