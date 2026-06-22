// Homepage.jsx
import { useState } from 'react';
import { GAMES } from '../gameData';
import GameCard from './GameCard';
import Mascot from './Mascot';
import './Homepage.css';

// Which mascot pose to strike while hovering each card. The mascot SITS on the
// Word Bomb card, so it gets hyped on its own game, leans over to peek at
// Category Blitz (idle pose + a CSS lean, handled below), and is unimpressed by
// the locked "More Soon" card.
const HOVER_POSE = {
  'word-bomb': 'celebrate', // hyped about its own game
  'category-blitz': 'idle', // leans over to look (lean is a CSS transform)
  'more-soon': 'taunt', // unimpressed by the locked card
};

// Jagged comic starburst behind the title: 14 spikes, points computed once from
// alternating outer/inner radii (deterministic - no randomness, so it never
// shifts between renders).
const BURST_POINTS = Array.from({ length: 28 }, (_, i) => {
  const r = i % 2 === 0 ? 100 : 64;
  const a = (Math.PI * i) / 14 - Math.PI / 2;
  return `${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`;
}).join(' ');

// Manga-style speed lines radiating from the homepage centre: 8 spokes (each a
// full diameter, so 16 rays) in rotating palette colours.
const SPEED_LINES = [
  { angle: 0, color: '#FF2EC4' },
  { angle: 23, color: '#2EFFE0' },
  { angle: 45, color: '#FFE94A' },
  { angle: 68, color: '#FF6B3D' },
  { angle: 90, color: '#9A1AFF' },
  { angle: 113, color: '#2EFFE0' },
  { angle: 135, color: '#FF2EC4' },
  { angle: 158, color: '#FFE94A' },
];

/**
 * Decorative paint-splatter blob. Purely cosmetic - rendered behind the
 * content, pointer-events disabled, and hidden from assistive tech. The
 * organic blob shape plus a few satellite droplets read as a thrown
 * splatter of flat paint; position/rotation/opacity come from CSS so the
 * same shape can be scattered around the stage edges in each accent color.
 */
function PaintSplatter({ className, color }) {
  return (
    <svg
      className={className}
      viewBox="-100 -100 200 200"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill={color}
        d="M40 -72C60 -66 80 -52 84 -30C88 -9 70 8 61 28C53 45 52 68 30 76C7 84 -17 73 -39 63C-59 53 -78 39 -82 16C-86 -9 -71 -29 -56 -47C-41 -64 -21 -80 3 -82C19 -83 24 -78 40 -72Z"
      />
      <circle fill={color} cx="82" cy="-80" r="11" />
      <circle fill={color} cx="-88" cy="62" r="8" />
      <circle fill={color} cx="94" cy="42" r="6" />
      <circle fill={color} cx="-30" cy="-92" r="5" />
    </svg>
  );
}

/**
 * The lobby/homepage screen. Scope for this build is intentionally just
 * this screen - clicking a card or the action buttons currently does
 * nothing beyond calling the passed-in handlers (or a console.log
 * fallback), since the create/join room flow and WebSocket wiring are
 * separate, later pieces of work.
 */
export default function Homepage({ onSelectGame, onCreateRoom, onJoinRoom, onCredits }) {
  // Once any navigation action fires we're about to transition away; lock the
  // buttons so a rapid second click can't double-fire. State resets naturally
  // because the component unmounts on the screen change.
  const [navigating, setNavigating] = useState(false);
  // The card currently hovered (drives the mascot's reaction pose).
  const [hoverGame, setHoverGame] = useState(null);

  // While navigating away the mascot runs off; otherwise it reacts to hover.
  const mascotPose = navigating ? 'run' : HOVER_POSE[hoverGame] || 'idle';
  // Positional modifier for the mascot perched on the Word Bomb card: it leans
  // toward Category Blitz when that card is hovered, and leaps off the side when
  // navigating away.
  const mascotMod = navigating
    ? 'jumping'
    : hoverGame === 'category-blitz'
    ? 'leaning'
    : '';

  // The mascot that sits on top of the Word Bomb card (passed in as that card's
  // "topper" so it's anchored to - and sways with - the card itself).
  const wordBombMascot = (
    <div className={`hp-card-mascot${mascotMod ? ` ${mascotMod}` : ''}`}>
      <Mascot pose={mascotPose} size={70} />
    </div>
  );

  function handleSelectGame(gameId) {
    if (navigating) return;
    setNavigating(true);
    if (onSelectGame) {
      onSelectGame(gameId);
    } else {
      // No handler wired up yet - this is expected at this stage of the
      // build. Logging instead of silently doing nothing makes it obvious
      // during development that the click registered correctly.
      console.log(`Selected game: ${gameId} (no onSelectGame handler wired up yet)`);
    }
  }

  function handleCreateRoom() {
    if (navigating) return;
    setNavigating(true);
    if (onCreateRoom) {
      onCreateRoom();
    } else {
      console.log('Create Room clicked (no onCreateRoom handler wired up yet)');
    }
  }

  function handleJoinRoom() {
    if (navigating) return;
    setNavigating(true);
    if (onJoinRoom) {
      onJoinRoom();
    } else {
      console.log('Join Room clicked (no onJoinRoom handler wired up yet)');
    }
  }

  function handleCredits() {
    if (navigating) return;
    setNavigating(true);
    if (onCredits) {
      onCredits();
    } else {
      console.log('Credits clicked (no onCredits handler wired up yet)');
    }
  }

  return (
    <div className="homepage-wrap">
      <div className="homepage-stage">
        <PaintSplatter className="homepage-splatter homepage-splatter-1" color="#FF2EC4" />
        <PaintSplatter className="homepage-splatter homepage-splatter-2" color="#2EFFE0" />
        <PaintSplatter className="homepage-splatter homepage-splatter-3" color="#FFE94A" />
        <PaintSplatter className="homepage-splatter homepage-splatter-4" color="#9A1AFF" />

        {/* Manga speed lines radiating from centre, behind the cards. */}
        <div className="homepage-speedlines" aria-hidden="true">
          {SPEED_LINES.map((s, i) => (
            <span key={i} style={{ '--angle': `${s.angle}deg`, background: s.color }} />
          ))}
        </div>

        {/* Title: a comic starburst behind the whole-word wordmark. */}
        <div className="homepage-logo-wrap">
          <svg className="homepage-burst" viewBox="-100 -100 200 200" aria-hidden="true">
            <polygon points={BURST_POINTS} fill="#FFE94A" />
          </svg>
          {/* "TYPE A WORD": the non-breaking space keeps "TYPE A" together
              so the title only ever wraps before "WORD" on narrow screens. The
              data-text must match exactly so the RGB-split clones line up. */}
          <div
            className="homepage-logo"
            data-text={'TYPE A WORD'}
            role="img"
            aria-label="Type a Word"
          >
            {'TYPE A WORD'}
          </div>
        </div>
        <div className="homepage-tagline">INSERT BRAIN TO CONTINUE</div>
        <div className="homepage-section-label">// SELECT YOUR GAME //</div>

        <div className="homepage-cards-grid">
          {GAMES.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              onSelect={handleSelectGame}
              onHover={setHoverGame}
              // The mascot rides on top of the Word Bomb (flagship) card.
              topper={game.id === 'word-bomb' ? wordBombMascot : null}
            />
          ))}
        </div>

        <div className="homepage-hover-hint">[ HOVER A CARD TO PREVIEW ]</div>

        <div className="homepage-bottom-bar">
          <button
            className={`homepage-btn homepage-btn-create${navigating ? ' disabled' : ''}`}
            onClick={handleCreateRoom}
            disabled={navigating}
          >
            CREATE ROOM
          </button>
          <button
            className={`homepage-btn homepage-btn-join${navigating ? ' disabled' : ''}`}
            onClick={handleJoinRoom}
            disabled={navigating}
          >
            JOIN ROOM
          </button>
        </div>

        {/* Link to the standalone credits page (holds music attribution etc.). */}
        <button
          className={`homepage-credits-link${navigating ? ' disabled' : ''}`}
          onClick={handleCredits}
          disabled={navigating}
        >
          CREDITS
        </button>
      </div>
    </div>
  );
}
