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

  // Pass the clicked card element up so the homepage can measure it for the
  // card->dialog FLIP morph (the expand starts from exactly this box).
  function handleClick(event) {
    if (game.enabled && onSelect) {
      onSelect(game.id, event.currentTarget);
    }
  }

  function handleKeyDown(event) {
    if (game.enabled && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      handleClick(event);
    }
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
