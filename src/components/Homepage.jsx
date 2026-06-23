// Homepage.jsx
import { useState } from 'react';
import { GAMES } from '../gameData';
import { useSound } from '../contexts/SoundContext';
import GameCard from './GameCard';
import {
  PaintSplatter1,
  PaintSplatter2,
  PaintSplatter3,
  PaintSplatter4,
} from './decor/PaintSplatters';
import './Homepage.css';

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
  const { sound } = useSound();

  // Hovering a card plays a subtle blip - but only when moving onto a NEW card,
  // so it never machine-guns while you sit on one card. (hoverGame is kept just
  // for that dedup now; the card art reveal is pure CSS :hover.)
  function handleHover(id) {
    if (id && id !== hoverGame) sound.menuHover();
    setHoverGame(id);
  }

  function handleSelectGame(gameId) {
    if (navigating) return;
    sound.click();
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
    sound.click(); // the whoosh follows from the screen transition in App
    setNavigating(true);
    if (onCreateRoom) {
      onCreateRoom();
    } else {
      console.log('Create Room clicked (no onCreateRoom handler wired up yet)');
    }
  }

  function handleJoinRoom() {
    if (navigating) return;
    sound.click(); // the whoosh follows from the screen transition in App
    setNavigating(true);
    if (onJoinRoom) {
      onJoinRoom();
    } else {
      console.log('Join Room clicked (no onJoinRoom handler wired up yet)');
    }
  }

  function handleCredits() {
    if (navigating) return;
    sound.click();
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
        {/* The mascot as a faint graffiti stencil sprayed on the wall - ambient
            brand presence, part of the texture, NOT a character in the scene. */}
        <img className="homepage-graffiti" src="/mascot-idle.png" alt="" aria-hidden="true" draggable="false" />

        <PaintSplatter1 className="homepage-splatter homepage-splatter-1" color="#FF2EC4" />
        <PaintSplatter2 className="homepage-splatter homepage-splatter-2" color="#2EFFE0" />
        <PaintSplatter3 className="homepage-splatter homepage-splatter-3" color="#FFE94A" />
        <PaintSplatter4 className="homepage-splatter homepage-splatter-4" color="#9A1AFF" />

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
              onHover={handleHover}
            />
          ))}
        </div>

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
