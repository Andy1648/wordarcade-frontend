// TrophyIcon.jsx — the leaderboard glyph (STEP 24). An inline STROKE icon like the menu's chevron and
// padlock: UI iconography, not illustration, so it lives in code at the size it is drawn.
export default function TrophyIcon({ size = 24, className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4z" />
      <path d="M7 6H4.5a2.5 2.5 0 0 0 2.6 3.6M17 6h2.5a2.5 2.5 0 0 1-2.6 3.6" />
      <path d="M12 14v3M8.5 20.5h7M9.5 17.5h5v3h-5z" />
    </svg>
  );
}
