// PlayerDot.jsx
// A small colour chip marking a player's session identity colour, shown next to
// their name in the roster and player bar. When a player is past the 5th (their
// hue is reused), `tier` > 0 draws a small numeral inside the dot as a secondary
// marker so the two players sharing a hue stay distinguishable.
import './PlayerDot.css';

export default function PlayerDot({ color, dark, tier = 0, className = '' }) {
  return (
    <span
      className={`player-dot${className ? ` ${className}` : ''}`}
      style={{ '--pc': color, '--pc-dark': dark || '#000' }}
      aria-hidden="true"
    >
      {tier > 0 && <span className="player-dot-tier">{tier + 1}</span>}
    </span>
  );
}
