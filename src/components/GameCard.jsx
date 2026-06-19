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
export default function GameCard({ game, onSelect }) {
  const ArtComponent = GAME_ART_COMPONENTS[game.artKey];
  const IconComponent = GAME_ICON_COMPONENTS[game.id];

  const cardClassName = [
    'game-card',
    game.dashedBorder ? 'dashed-border' : '',
    !game.enabled ? 'disabled' : '',
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

  return (
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
  );
}
