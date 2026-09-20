// LobbyScreen.jsx
import { useState, useEffect } from 'react';
import { getStoredName, rememberName } from '../playerName';
import { useSound } from '../contexts/SoundContext';
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
export default function LobbyScreen({ mode, defaultPublic = false, onBack, onContinue, wsStatus, serverError }) {
  // Pre-fill from the last name the player used (persisted in localStorage) so
  // returning players don't retype it. Falls back to '' on a fresh device / when
  // storage is unavailable. We keep the stored copy in sync as they edit.
  const [name, setName] = useState(() => getStoredName());
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  // Create-room visibility. Private (default) = code-only, matching the original
  // behavior; public lists the room in the browser / makes it quick-play-able.
  // Only meaningful when creating a room (ignored in join mode).
  const [isPublic, setIsPublic] = useState(defaultPublic);
  const { sound } = useSound();
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

  // ONE LINE, and it is an instruction rather than a name. The mode the player picked is
  // already what they just tapped; what they do not know is what this screen wants.
  function getInstruction() {
    if (isJoinMode) return `TYPE YOUR NAME AND THE ${ROOM_CODE_LENGTH}-CHARACTER CODE`;
    return 'TYPE YOUR NAME TO OPEN THE ROOM';
  }

  function handleNameChange(event) {
    const next = event.target.value;
    setName(next);
    // Persist as they type so the name carries to Quick Play / Browse and across
    // sessions. rememberName trims + no-ops on empty, so clearing the field keeps
    // the last good name rather than wiping it.
    rememberName(next);
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

    sound.click(); // the action press (button or Enter-to-submit), not typing

    const trimmedName = name.trim();

    if (trimmedName.length === 0) {
      setError('DROP A NAME FIRST.');
      return;
    }

    if (isJoinMode && roomCode.length !== ROOM_CODE_LENGTH) {
      setError(`CODES ARE ${ROOM_CODE_LENGTH} CHARACTERS — CHECK IT.`);
      return;
    }

    if (wsStatus !== 'open') {
      setError('HOLD UP — STILL CONNECTING. TRY AGAIN IN A SEC.');
      return;
    }

    const payload = { name: trimmedName, mode };
    if (isJoinMode) {
      payload.roomCode = roomCode;
    } else {
      // Create flow: carry the public/private choice through to create_room.
      payload.isPublic = isPublic;
    }

    // Validation passed and we're about to send - lock the button and persist the
    // final trimmed name for the no-prompt flows / next visit.
    rememberName(trimmedName);
    setSubmitting(true);

    if (onContinue) onContinue(payload);
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter') {
      handleContinue();
    }
  }

  const isFormValid =
    name.trim().length > 0 && (!isJoinMode || roomCode.length === ROOM_CODE_LENGTH);

  const connectionLabel =
    wsStatus === 'connecting' ? 'HOOKING YOU UP…'
    : wsStatus === 'error' ? 'SERVER GHOSTED YOU — HIT REFRESH.'
    : wsStatus === 'closed' ? 'CONNECTION DROPPED.'
    : null;

  return (
    <div className="lobby-wrap">
      <div className="lobby-box">
        <button
          className="lobby-back-btn"
          onClick={() => {
            sound.click();
            onBack();
          }}
        >
          ← BACK
        </button>

        {/* THE HEADLINE IS GONE. A screen with one job does not need a title naming the job:
            .lobby-title ("JOIN ROOM" / the mode name) and .lobby-subtitle were 20px and 16px of
            decoration above a 16px field, and on a phone the title was the biggest text here.
            One instruction line replaces both. */}
        <div className="lobby-instruction">{getInstruction()}</div>

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
            {/* N SLOTS, ONE PER CHARACTER — not one text field. The player can SEE how many
                characters they owe, which a single box cannot tell them. It is still ONE input
                (so paste, autofill and the mobile keyboard all behave); the input itself is
                transparent and stretched across the slots, and the slots under it render the
                value. Tapping anywhere focuses the real field. */}
            <div
              className="lobby-code-slots"
              onClick={() => document.getElementById('room-code-input')?.focus()}
            >
              {Array.from({ length: ROOM_CODE_LENGTH }).map((_, i) => (
                <span
                  key={i}
                  className={`lobby-code-slot${roomCode.length === i ? ' is-next' : ''}${roomCode[i] ? ' is-filled' : ''}`}
                  aria-hidden="true"
                >
                  {roomCode[i] || ''}
                </span>
              ))}
              <input
                id="room-code-input"
                className="lobby-code-input"
                type="text"
                inputMode="text"
                autoCapitalize="characters"
                autoComplete="one-time-code"
                aria-label={`Room code, ${ROOM_CODE_LENGTH} characters`}
                value={roomCode}
                onChange={handleRoomCodeChange}
                onKeyDown={handleKeyDown}
                maxLength={ROOM_CODE_LENGTH}
              />
            </div>
          </div>
        )}

        {!isJoinMode && (
          <div className="lobby-field-group">
            <span className="lobby-field-label">ROOM VISIBILITY</span>
            <div className="lobby-toggle" role="group" aria-label="Room visibility">
              <button
                type="button"
                className={`lobby-toggle-btn${!isPublic ? ' active' : ''}`}
                aria-pressed={!isPublic}
                onClick={() => {
                  sound.click();
                  setIsPublic(false);
                }}
              >
                🔒 PRIVATE
              </button>
              <button
                type="button"
                className={`lobby-toggle-btn${isPublic ? ' active' : ''}`}
                aria-pressed={isPublic}
                onClick={() => {
                  sound.click();
                  setIsPublic(true);
                }}
              >
                🌐 PUBLIC
              </button>
            </div>
            <div className="lobby-toggle-hint">
              {isPublic
                ? 'ANYONE CAN FIND THIS ROOM AND JOIN.'
                : 'CODE-ONLY. INVITE WHO YOU WANT.'}
            </div>
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