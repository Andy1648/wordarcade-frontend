// Homepage.jsx
import { GAMES } from '../gameData';
import GameCard from './GameCard';
import './Homepage.css';

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
export default function Homepage({ onSelectGame, onCreateRoom, onJoinRoom }) {
  function handleSelectGame(gameId) {
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
    if (onCreateRoom) {
      onCreateRoom();
    } else {
      console.log('Create Room clicked (no onCreateRoom handler wired up yet)');
    }
  }

  function handleJoinRoom() {
    if (onJoinRoom) {
      onJoinRoom();
    } else {
      console.log('Join Room clicked (no onJoinRoom handler wired up yet)');
    }
  }

  return (
    <div className="homepage-wrap">
      <div className="homepage-stage">
        <PaintSplatter className="homepage-splatter homepage-splatter-1" color="#FF2EC4" />
        <PaintSplatter className="homepage-splatter homepage-splatter-2" color="#2EFFE0" />
        <PaintSplatter className="homepage-splatter homepage-splatter-3" color="#FFE94A" />
        <PaintSplatter className="homepage-splatter homepage-splatter-4" color="#9A1AFF" />

        <div className="homepage-logo">WORDARCADE</div>
        <div className="homepage-tagline">INSERT BRAIN TO CONTINUE</div>
        <div className="homepage-section-label">// SELECT YOUR GAME //</div>

        <div className="homepage-cards-grid">
          {GAMES.map((game) => (
            <GameCard key={game.id} game={game} onSelect={handleSelectGame} />
          ))}
        </div>

        <div className="homepage-hover-hint">[ HOVER A CARD TO PREVIEW ]</div>

        <div className="homepage-bottom-bar">
          <button className="homepage-btn homepage-btn-create" onClick={handleCreateRoom}>
            CREATE ROOM
          </button>
          <button className="homepage-btn homepage-btn-join" onClick={handleJoinRoom}>
            JOIN ROOM
          </button>
        </div>
      </div>
    </div>
  );
}
