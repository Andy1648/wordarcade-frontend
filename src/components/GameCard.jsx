// GameCard.jsx
import { GAME_ART_COMPONENTS } from './GameArt';
import { GAME_ICON_COMPONENTS } from './GameIcons';
import './GameCard.css';

/**
 * Renders one game selection card. All visual variation (colors, text,
 * which icon/artwork to show) comes from the `game` object - this
 * component has no hardcoded knowledge of any specific game, so adding
 * a 7th game means adding an entry to gameData.js plus one art component
 * and one icon component, not editing this file.
 *
 * `onSelect` is called with the game's id when a non-disabled card is
 * clicked. The "more soon" card has `enabled: false` and renders without
 * a click handler or hover-lift, matching its disabled visual state.
 */
export default function GameCard({ game, onSelect, onHover, topper }) {
  const ArtComponent = GAME_ART_COMPONENTS[game.artKey];
  const IconComponent = GAME_ICON_COMPONENTS[game.id];

  const cardClassName = [
    'game-card',
    game.dashedBorder ? 'dashed-border' : '',
    !game.enabled ? 'disabled' : '',
    game.featured ? 'featured' : '',
    // A mascot sits on this card's top edge - drop the top tape so it doesn't
    // poke through where the character is perched.
    topper ? 'has-topper' : '',
  ]
    .filter(Boolean)
    .join(' ');

  function handleClick() {
    if (game.enabled && onSelect) {
      onSelect(game.id);
    }
  }

  function handleKeyDown(event) {
    if (game.enabled && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      handleClick();
    }
  }

  // Cursor-tracking 3D tilt: lean the card toward the pointer by writing --rx/--ry,
  // which the :hover transform in GameCard.css turns into rotateX/rotateY. Skipped
  // for disabled cards and under reduced-motion; reset on leave so it settles flat.
  const TILT_DEG = 9; // max lean
  function handlePointerMove(event) {
    if (!game.enabled) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const el = event.currentTarget;
    const r = el.getBoundingClientRect();
    const px = (event.clientX - r.left) / r.width; // 0 (left) .. 1 (right)
    const py = (event.clientY - r.top) / r.height; // 0 (top) .. 1 (bottom)
    el.style.setProperty('--ry', `${(-(px - 0.5) * 2 * TILT_DEG).toFixed(2)}deg`);
    el.style.setProperty('--rx', `${((py - 0.5) * 2 * TILT_DEG).toFixed(2)}deg`);
  }
  function handlePointerLeave(event) {
    event.currentTarget.style.setProperty('--rx', '0deg');
    event.currentTarget.style.setProperty('--ry', '0deg');
  }

  return (
    // The wrapper is the grid item and carries the constant idle sway (rotation
    // + drift), so the inner card is free to run its beat-pop on top at the same
    // time. Hovering raises the wrapper's z-index so a scaled card is never
    // blocked by - nor blocks - its neighbours.
    <div
      className="game-card-wrap"
      onMouseEnter={() => onHover && onHover(game.id)}
      onMouseLeave={() => onHover && onHover(null)}
      onFocus={() => onHover && onHover(game.id)}
      onBlur={() => onHover && onHover(null)}
    >
      {/* A character perched on the card's top edge, riding the wrapper's idle
          sway with it. Sits above the card; never intercepts pointer events. */}
      {topper}
      <div
        className={cardClassName}
        style={{ background: game.baseColor }}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        role="button"
        tabIndex={game.enabled ? 0 : -1}
        aria-disabled={!game.enabled}
        aria-label={`${game.name.replace('\n', ' ')} - ${game.badgeText}`}
      >
        {/* Strips of tape pinning the "flyer" to the wall - one at each top corner,
            angled opposite ways. Purely decorative. */}
        <span className="game-card-tape game-card-tape-left" aria-hidden="true" />
        <span className="game-card-tape game-card-tape-right" aria-hidden="true" />

        {game.featured && <div className="game-card-featured-tag">★ FEATURED</div>}

      {ArtComponent && (
        <div className="game-card-art">
          <ArtComponent />
        </div>
      )}

      <div className="game-card-content">
        <div
          className="game-card-icon-box"
          style={{
            background: game.iconBg,
            borderColor: game.iconBorderColor || '#000',
          }}
        >
          {IconComponent && <IconComponent />}
        </div>

        <div className="game-card-name" style={{ color: game.textColor }}>
          {game.name}
        </div>

        <div className="game-card-desc" style={{ color: game.descColor }}>
          {game.description}
        </div>

        <div
          className="game-card-badge"
          style={{
            background: game.badgeBg,
            color: game.badgeColor,
            borderColor: game.badgeBorderColor || '#000',
          }}
        >
          {game.badgeText}
        </div>
      </div>
      </div>
    </div>
  );
}
