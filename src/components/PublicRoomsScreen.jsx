// PublicRoomsScreen.jsx
// The unified JOIN ROOM screen. Two ways into a game, one screen:
//   1. Type a room code at the top (the join-by-code flow), or
//   2. Tap a room from the auto-refreshing public-games list below.
// Both paths send the SAME `join_room` (via onJoin) - App owns the messaging;
// this screen is presentational + validation only and holds no game logic.
//
// Refresh strategy: fetch on mount (entering the screen), a light auto-refresh
// on an interval so the list doesn't go stale while you read it, and a manual
// REFRESH button for the impatient.
import { useEffect, useRef, useState } from 'react';
import { GAMES } from '../gameData';
import { useSound } from '../contexts/SoundContext';
import './PublicRoomsScreen.css';

const MAX_NAME_LENGTH = 20;
const ROOM_CODE_LENGTH = 5;
const AUTO_REFRESH_MS = 5000;

// gameType -> display label + accent colour, derived from the homepage game data
// so names/colours stay in sync with the cards. Unknown types fall back gracefully.
const GAME_INFO = GAMES.reduce((acc, g) => {
  acc[g.id] = { label: g.name.replace('\n', ' '), color: g.baseColor };
  return acc;
}, {});

function gameLabel(type) {
  return GAME_INFO[type]?.label || (type || 'GAME').toUpperCase();
}
function gameColor(type) {
  return GAME_INFO[type]?.color || '#2EFFE0';
}

export default function PublicRoomsScreen({
  rooms,
  serverError,
  name,
  onNameChange,
  onJoin,
  onRefresh,
  onCreatePublic,
  onBack,
}) {
  const { sound } = useSound();
  // The row we've sent a join for, locked until we either transition into the
  // room (this screen unmounts) or the server bounces it (cleared below).
  const [joiningCode, setJoiningCode] = useState(null);
  // The code typed into the join-by-code field at the top.
  const [codeInput, setCodeInput] = useState('');
  const [localError, setLocalError] = useState('');
  // True until the FIRST public_rooms response lands, so the initial render shows a
  // "loading" pulse instead of flashing the empty state (which looked like "no games"
  // when we simply hadn't heard back yet). App rebuilds the rooms array on every
  // response, so a change in the rooms prop = a fresh response = loading done.
  const [loading, setLoading] = useState(true);
  const firstRoomsRef = useRef(true);
  useEffect(() => {
    if (firstRoomsRef.current) {
      firstRoomsRef.current = false; // mount run carries App's initial [], not a response
      return;
    }
    setLoading(false);
  }, [rooms]);

  // onRefresh is stable (useCallback in App). Fetch on mount, then poll lightly.
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;
  useEffect(() => {
    refreshRef.current();
    const id = setInterval(() => refreshRef.current(), AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  // A server error means our join attempt failed (room filled up / started
  // between fetch and tap) - unlock so they can pick another, and re-fetch so
  // the now-unjoinable room drops off the list.
  useEffect(() => {
    if (serverError) {
      setJoiningCode(null);
      refreshRef.current();
    }
  }, [serverError]);

  function handleJoin(code) {
    if (joiningCode) return; // already committing to a join
    const trimmed = (name || '').trim();
    if (!trimmed) {
      setLocalError('DROP A NAME FIRST.');
      return;
    }
    setLocalError('');
    sound.click();
    setJoiningCode(code);
    onJoin(code, trimmed);
  }

  function handleCodeChange(e) {
    // Same normalization as the lobby join field: uppercase, alphanumerics only,
    // capped at the fixed code length.
    const cleaned = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    setCodeInput(cleaned.slice(0, ROOM_CODE_LENGTH));
    if (localError) setLocalError('');
  }

  // Join by the typed code. Reuses the SAME join path as tapping a row, with the
  // same name-required guard, plus a code-length check.
  function handleJoinByCode() {
    if (joiningCode) return;
    const trimmed = (name || '').trim();
    if (!trimmed) {
      setLocalError('DROP A NAME FIRST.');
      return;
    }
    if (codeInput.length !== ROOM_CODE_LENGTH) {
      setLocalError(`CODES ARE ${ROOM_CODE_LENGTH} CHARACTERS — CHECK IT.`);
      return;
    }
    handleJoin(codeInput);
  }

  function handleCodeKeyDown(e) {
    if (e.key === 'Enter') handleJoinByCode();
  }

  function handleManualRefresh() {
    sound.click();
    setLoading(true); // cleared when the fresh list comes back (rooms prop changes)
    refreshRef.current();
  }

  const error = localError || serverError;
  const isEmpty = !rooms || rooms.length === 0;

  return (
    <div className="browser-wrap">
      <div className="browser-box">
        <div className="browser-header">
          <button
            className="browser-back-btn"
            onClick={() => {
              sound.click();
              onBack();
            }}
          >
            ← BACK
          </button>
          <button className="browser-refresh-btn" onClick={handleManualRefresh}>
            ⟳ REFRESH
          </button>
        </div>

        <div className="browser-title">JOIN ROOM</div>
        <div className="browser-subtitle">ENTER A CODE OR PICK A PUBLIC GAME</div>

        <label className="browser-field-label" htmlFor="browser-name-input">
          YOUR NAME
        </label>
        <input
          id="browser-name-input"
          className="browser-name-input"
          type="text"
          placeholder="e.g. WordWizard99"
          value={name}
          onChange={(e) => {
            onNameChange(e.target.value);
            if (localError) setLocalError('');
          }}
          maxLength={MAX_NAME_LENGTH}
        />

        {/* Join-by-code: a friend's room code + JOIN, the same path tapping a
            public row uses (onJoin), just with a typed code. */}
        <label className="browser-field-label" htmlFor="browser-code-input">
          ROOM CODE
        </label>
        <div className="browser-code-row">
          <input
            id="browser-code-input"
            className="browser-code-input"
            type="text"
            placeholder="XXXXX"
            value={codeInput}
            onChange={handleCodeChange}
            onKeyDown={handleCodeKeyDown}
            maxLength={ROOM_CODE_LENGTH}
          />
          <button
            className="browser-code-join-btn"
            onClick={handleJoinByCode}
            disabled={!!joiningCode || codeInput.length !== ROOM_CODE_LENGTH}
          >
            JOIN
          </button>
        </div>

        {error && (
          <div className="browser-error" role="alert">{error}</div>
        )}

        <div className="browser-divider">
          <span>OR PICK A PUBLIC GAME</span>
        </div>

        {loading && isEmpty ? (
          // Still waiting on the first list - a calm pulse, never the empty state
          // (which would wrongly read as "no games" before we've heard back).
          <div className="browser-loading" role="status">
            <div className="browser-loading-dots" aria-hidden="true">
              <span>●</span><span>●</span><span>●</span>
            </div>
            <div className="browser-loading-text">SCANNING FOR GAMES…</div>
          </div>
        ) : isEmpty ? (
          // CRITICAL: an empty list must never look broken. Friendly nudge +
          // two ways to start a game right now.
          <div className="browser-empty">
            <div className="browser-empty-emoji" aria-hidden="true">🎮</div>
            <div className="browser-empty-title">NO PUBLIC GAMES RIGHT NOW</div>
            <div className="browser-empty-sub">BE THE ONE WHO STARTS THE PARTY.</div>
            <div className="browser-empty-actions">
              <button
                className="browser-btn browser-btn-create"
                onClick={() => {
                  sound.click();
                  onCreatePublic();
                }}
              >
                + CREATE PUBLIC ROOM
              </button>
            </div>
          </div>
        ) : (
          <ul className="browser-list">
            {rooms.map((room) => {
              const joining = joiningCode === room.code;
              const full = room.playerCount >= room.maxPlayers;
              return (
                <li key={room.code}>
                  <button
                    className="browser-row"
                    style={{ '--row-accent': gameColor(room.gameType) }}
                    onClick={() => handleJoin(room.code)}
                    disabled={!!joiningCode}
                  >
                    <span className="browser-row-main">
                      <span className="browser-row-game">{gameLabel(room.gameType)}</span>
                      <span className="browser-row-code">#{room.code}</span>
                    </span>
                    <span className="browser-row-meta">
                      <span className={`browser-row-count${full ? ' full' : ''}`}>
                        {room.playerCount}/{room.maxPlayers}
                      </span>
                      <span className="browser-row-status">
                        {joining ? 'JOINING…' : 'WAITING'}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
