// Homepage.jsx
import { GAMES } from '../gameData';
import GameCard from './GameCard';
import './Homepage.css';

/**
 * The lobby/homepage screen. Scope for this build is intentionally just
 * this screen - clicking a card or the action buttons currently does
 * nothing beyond calling the passed-in handlers (or a console.log
 * fallback), since the create/join room flow and WebSocket wiring are
 * separate, later pieces of work.
 */
export default function Homepage({ onSelectGame, onPlaySolo, onJoinRoom }) {
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

  function handlePlaySolo() {
    if (onPlaySolo) {
      onPlaySolo();
    } else {
      console.log('Play Solo clicked (no onPlaySolo handler wired up yet)');
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
          <button className="homepage-btn homepage-btn-play" onClick={handlePlaySolo}>
            PLAY SOLO
          </button>
          <button className="homepage-btn homepage-btn-join" onClick={handleJoinRoom}>
            JOIN ROOM
          </button>
        </div>
      </div>
    </div>
  );
}
