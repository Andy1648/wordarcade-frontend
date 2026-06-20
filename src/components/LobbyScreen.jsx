// LobbyScreen.jsx
import { useState } from 'react';
import { GAMES } from '../gameData';
import './LobbyScreen.css';

const MAX_NAME_LENGTH = 20;

/**
 * The screen a player lands on after leaving the homepage.
 * `mode` is either 'solo', 'join', or a game id (e.g. 'chain-reaction').
 * `onBack` navigates back to the homepage.
 *
 * This version adds the name input - validated for non-empty (after
 * trimming whitespace) and length-capped to match the 20-char limit the
 * backend already enforces (see server.js: `.slice(0, 20)`), so a name
 * never gets silently truncated by the server without the player
 * realizing it client-side first.
 *
 * `onContinue` isn't wired to anything real yet (room code field and
 * backend connection are separate, later pieces) - for now it just logs,
 * matching the same "log instead of silently doing nothing" pattern used
 * in Homepage.jsx so it's obvious during development that the click
 * registered.
 */
export default function LobbyScreen({ mode, onBack, onContinue }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  function getTitle() {
    if (mode === 'solo') return 'PLAY SOLO';
    if (mode === 'join') return 'JOIN ROOM';
    const game = GAMES.find((g) => g.id === mode);
    return game ? game.name.replace('\n', ' ') : 'PLAY';
  }

  function getSubtitle() {
    if (mode === 'join') return 'ENTER A ROOM CODE TO JOIN A FRIEND';
    return 'ENTER YOUR NAME TO GET STARTED';
  }

  function handleNameChange(event) {
    setName(event.target.value);
    if (error) {
      setError(''); // clear the error as soon as they start fixing it
    }
  }

  function handleContinue() {
    const trimmedName = name.trim();

    if (trimmedName.length === 0) {
      setError('Enter a name before continuing.');
      return;
    }

    if (onContinue) {
      onContinue({ name: trimmedName, mode });
    } else {
      console.log(`Continue clicked with name "${trimmedName}" (no onContinue handler wired up yet)`);
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter') {
      handleContinue();
    }
  }

  const isNameValid = name.trim().length > 0;

  return (
    <div className="lobby-wrap">
      <div className="lobby-box">
        <button className="lobby-back-btn" onClick={onBack}>
          ← BACK
        </button>

        <div className="lobby-title">{getTitle()}</div>
        <div className="lobby-subtitle">{getSubtitle()}</div>

        <label className="lobby-field-label" htmlFor="player-name-input">
          YOUR NAME
        </label>
        <input
          id="player-name-input"
          className="lobby-input"
          type="text"
          placeholder="e.g. WordWizard99"
          value={name}
          onChange={handleNameChange}
          onKeyDown={handleKeyDown}
          maxLength={MAX_NAME_LENGTH}
          autoFocus
        />
        {error && <div className="lobby-error">{error}</div>}

        {/* Room code field for 'join' mode comes in the next piece */}

        <button
          className="lobby-continue-btn"
          onClick={handleContinue}
          disabled={!isNameValid}
        >
          CONTINUE
        </button>
      </div>
    </div>
  );
}