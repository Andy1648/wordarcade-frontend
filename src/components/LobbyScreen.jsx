// LobbyScreen.jsx
import { useState, useEffect } from 'react';
import { GAMES } from '../gameData';
import WaveText from './WaveText';
import './LobbyScreen.css';

const MAX_NAME_LENGTH = 20;
const ROOM_CODE_LENGTH = 5;

/**
 * `wsStatus` and `serverError` are now real, coming from App.jsx's live
 * WebSocket connection - `serverError` covers cases like "room not
 * found" or "room full" that only the backend can know about, and is
 * displayed through the same error UI as local validation errors so the
 * player sees one consistent error experience regardless of source.
 */
export default function LobbyScreen({ mode, onBack, onContinue, wsStatus, serverError }) {
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  // True once a valid Continue has been sent - locks the button until the
  // screen transitions (success) or the server bounces it back (error below).
  const [submitting, setSubmitting] = useState(false);

  const isJoinMode = mode === 'join';

  useEffect(() => {
    if (serverError) {
      setError(serverError);
      // The submission failed (e.g. room not found / full) - let them fix and retry.
      setSubmitting(false);
    }
  }, [serverError]);

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
    const cleaned = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    setRoomCode(cleaned.slice(0, ROOM_CODE_LENGTH));
    if (error) setError('');
  }

  function handleContinue() {
    // Already sent and waiting on the server - ignore repeat clicks / Enter.
    if (submitting) return;

    const trimmedName = name.trim();

    if (trimmedName.length === 0) {
      setError('Enter a name before continuing.');
      return;
    }

    if (isJoinMode && roomCode.length !== ROOM_CODE_LENGTH) {
      setError(`Room codes are ${ROOM_CODE_LENGTH} characters.`);
      return;
    }

    if (wsStatus !== 'open') {
      setError('Still connecting to the server - try again in a moment.');
      return;
    }

    const payload = { name: trimmedName, mode };
    if (isJoinMode) {
      payload.roomCode = roomCode;
    }

    // Validation passed and we're about to send - lock the button.
    setSubmitting(true);

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

  const connectionLabel =
    wsStatus === 'connecting' ? 'CONNECTING TO SERVER...'
    : wsStatus === 'error' ? 'CONNECTION ERROR - TRY REFRESHING'
    : wsStatus === 'closed' ? 'DISCONNECTED'
    : null;

  return (
    <div className="lobby-wrap">
      <div className="lobby-box">
        <button className="lobby-back-btn" onClick={onBack}>
          ← BACK
        </button>

        <div className="lobby-title">
          <WaveText text={getTitle()} />
        </div>
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

        {error && (
          <div className="lobby-error" role="alert">
            {error}
          </div>
        )}
        {connectionLabel && (
          <div className="lobby-connection-status" role="status">
            {connectionLabel}
          </div>
        )}

        <button
          className="lobby-continue-btn"
          onClick={handleContinue}
          disabled={!isFormValid || submitting}
        >
          {submitting ? 'CONNECTING...' : 'CONTINUE'}
        </button>
      </div>
    </div>
  );
}