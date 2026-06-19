// LobbyScreen.jsx
import { GAMES } from '../gameData';
import './LobbyScreen.css';

/**
 * The screen a player lands on after leaving the homepage.
 * `mode` is either 'solo', 'join', or a game id (e.g. 'chain-reaction').
 * `onBack` navigates back to the homepage.
 *
 * Built in stages - this first version just confirms navigation works
 * and shows the correct title based on mode. Inputs come next.
 */
export default function LobbyScreen({ mode, onBack }) {
  // Resolve a human-readable title from the mode value.
  function getTitle() {
    if (mode === 'solo') return 'PLAY SOLO';
    if (mode === 'join') return 'JOIN ROOM';
    // mode is a game id - find the game name
    const game = GAMES.find((g) => g.id === mode);
    return game ? game.name.replace('\n', ' ') : 'PLAY';
  }

  function getSubtitle() {
    if (mode === 'join') return 'ENTER A ROOM CODE TO JOIN A FRIEND';
    return 'ENTER YOUR NAME TO GET STARTED';
  }

  return (
    <div className="lobby-wrap">
      <div className="lobby-box">
        <button className="lobby-back-btn" onClick={onBack}>
          ← BACK
        </button>

        <div className="lobby-title">{getTitle()}</div>
        <div className="lobby-subtitle">{getSubtitle()}</div>

        {/* Inputs go here next */}
      </div>
    </div>
  );
}