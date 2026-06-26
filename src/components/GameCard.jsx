// GameCard.jsx
import { useRef } from 'react';
import { GAME_ART_COMPONENTS } from './GameArt';
import { GAME_ICON_COMPONENTS } from './GameIcons';
import { prefersReducedMotion } from '../juice';
import './GameCard.css';

// Max 3D tilt at the card's edge (degrees). Small - a lean, not a flip.
const MAX_TILT = 9;

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

  // ---- CURSOR-TILT (3D parallax) -------------------------------------------
  // The card leans in 3D toward the pointer as it moves across it, then springs
  // back on leave (elastic transition in CSS). Transform-ONLY and rAF-throttled
  // so several cards can't thrash layout; disabled under reduced-motion (the
  // neon glow still ignites via CSS :hover). Lives on a dedicated .game-card-tilt
  // layer so it composes with the card's own scale/hover/beat transforms rather
  // than overwriting them.
  const tiltRef = useRef(null);
  const rafRef = useRef(0);
  const ptRef = useRef({ x: 0, y: 0 });

  function applyTilt() {
    rafRef.current = 0;
    const el = tiltRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    // Normalised cursor offset from card centre, clamped to the card bounds.
    const nx = Math.max(-1, Math.min(1, (ptRef.current.x - (r.left + r.width / 2)) / (r.width / 2)));
    const ny = Math.max(-1, Math.min(1, (ptRef.current.y - (r.top + r.height / 2)) / (r.height / 2)));
    // rotateY follows horizontal offset; rotateX is inverted so the card face
    // tips TOWARD the cursor (top tips back when the pointer is high).
    el.style.setProperty('--tilt-x', `${(nx * MAX_TILT).toFixed(2)}deg`);
    el.style.setProperty('--tilt-y', `${(-ny * MAX_TILT).toFixed(2)}deg`);
  }

  function handlePointerMove(e) {
    if (!game.enabled || prefersReducedMotion()) return;
    ptRef.current = { x: e.clientX, y: e.clientY };
    if (!rafRef.current) rafRef.current = requestAnimationFrame(applyTilt);
  }

  // Spring back to flat (the long elastic transition on .game-card-tilt does the
  // settle; here we just cancel any pending frame and zero the angles).
  function resetTilt() {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    const el = tiltRef.current;
    if (el) {
      el.style.setProperty('--tilt-x', '0deg');
      el.style.setProperty('--tilt-y', '0deg');
    }
  }

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
      {/* Tilt layer: carries the 3D cursor-lean + the neon glow halo (its
          ::after), so the inner card is free to keep its scale/hover/beat. The
          per-card neon accent is its fill colour. */}
      <div
        className="game-card-tilt"
        ref={tiltRef}
        style={{ '--card-accent': game.baseColor }}
        onPointerMove={handlePointerMove}
        onPointerLeave={resetTilt}
      >
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
    </div>
  );
}
