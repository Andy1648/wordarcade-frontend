// LobbyScreen.jsx
import { useState } from 'react';
import { GAMES } from '../gameData';
import './LobbyScreen.css';

const MAX_NAME_LENGTH = 20;
// Matches the backend's room code format exactly (see roomManager.js:
// ROOM_CODE_LENGTH and ROOM_CODE_CHARS). Validating the shape client-side
// gives instant feedback, but the server remains the actual source of
// truth for whether a code corresponds to a real room.
const ROOM_CODE_LENGTH = 5;

/**
 * The screen a player lands on after leaving the homepage.
 * `mode` is either 'solo', 'join', or a game id (e.g. 'chain-reaction').
 * `onBack` navigates back to the homepage.
 *
 * Adds the room code field, shown only in 'join' mode. The input
 * auto-uppercases as the player types since room codes are
 * case-insensitive on the backend but displayed/shared in uppercase.
 *
 * `onContinue` still isn't wired to anything real (backend connection is
 * a later piece) - it logs the collected name (+ room code, if relevant)
 * so it's clear during development that validation and submission work.
 */
export default function LobbyScreen({ mode, onBack, onContinue }) {
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');

  const isJoinMode = mode === 'join';

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
    if (error) setError('');
  }

  function handleRoomCodeChange(event) {
    // Auto-uppercase and strip anything that isn't a letter/number, so a
    // pasted code with stray spaces or lowercase letters still works.
    const cleaned = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    setRoomCode(cleaned.slice(0, ROOM_CODE_LENGTH));
    if (error) setError('');
  }

  function handleContinue() {
    const trimmedName = name.trim();

    if (trimmedName.length === 0) {
      setError('Enter a name before continuing.');
      return;
    }

    if (isJoinMode && roomCode.length !== ROOM_CODE_LENGTH) {
      setError(`Room codes are ${ROOM_CODE_LENGTH} characters.`);
      return;
    }

    const payload = { name: trimmedName, mode };
    if (isJoinMode) {
      payload.roomCode = roomCode;
    }

    if (onContinue) {
      onContinue(payload);
    } else {
      console.log('Continue clicked (no onContinue handler wired up yet):', payload);
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter') {
      handleContinue();
    }
  }

  const isFormValid =
    name.trim().length > 0 && (!isJoinMode || roomCode.length === ROOM_CODE_LENGTH);

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

        {isJoinMode && (
          <div className="lobby-field-group">
            <label className="lobby-field-label" htmlFor="room-code-input">
              ROOM CODE
            </label>
            <input
              id="room-code-input"
              className="lobby-code-input"
              type="text"
              placeholder="XXXXX"
              value={roomCode}
              onChange={handleRoomCodeChange}
              onKeyDown={handleKeyDown}
              maxLength={ROOM_CODE_LENGTH}
            />
          </div>
        )}

        {error && <div className="lobby-error">{error}</div>}

        <button
          className="lobby-continue-btn"
          onClick={handleContinue}
          disabled={!isFormValid}
        >
          CONTINUE
        </button>
      </div>
    </div>
  );
}