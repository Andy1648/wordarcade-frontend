// PublicRoomsScreen.jsx
// The public-room browser. Presentational + messaging only: it asks App to
// (re)fetch the list and to join a chosen room, but owns no game logic. Joining
// a row reuses the exact same join-by-code path as the Join Room screen - App
// sends `join_room` with the row's code - so there's one join flow, not two.
//
// Refresh strategy: fetch on mount (entering the screen), a light auto-refresh
// on an interval so the list doesn't go stale while you read it, and a manual
// REFRESH button for the impatient.
import { useEffect, useRef, useState } from 'react';
import { GAMES } from '../gameData';
import { useSound } from '../contexts/SoundContext';
import './PublicRoomsScreen.css';

const MAX_NAME_LENGTH = 20;
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
  onQuickPlay,
  onCreatePublic,
  onBack,
}) {
  const { sound } = useSound();
  // The row we've sent a join for, locked until we either transition into the
  // room (this screen unmounts) or the server bounces it (cleared below).
  const [joiningCode, setJoiningCode] = useState(null);
  const [localError, setLocalError] = useState('');

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
      setLocalError('Enter a name before joining.');
      return;
    }
    setLocalError('');
    sound.click();
    setJoiningCode(code);
    onJoin(code, trimmed);
  }

  function handleManualRefresh() {
    sound.click();
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

        <div className="browser-title">PUBLIC GAMES</div>
        <div className="browser-subtitle">TAP A ROOM TO JUMP IN</div>

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

        {error && (
          <div className="browser-error" role="alert">{error}</div>
        )}

        {isEmpty ? (
          // CRITICAL: an empty list must never look broken. Friendly nudge +
          // two ways to start a game right now.
          <div className="browser-empty">
            <div className="browser-empty-emoji" aria-hidden="true">🎮</div>
            <div className="browser-empty-title">NO PUBLIC GAMES RIGHT NOW</div>
            <div className="browser-empty-sub">BE THE ONE WHO STARTS THE PARTY.</div>
            <div className="browser-empty-actions">
              <button
                className="browser-btn browser-btn-quick"
                onClick={() => {
                  sound.click();
                  onQuickPlay();
                }}
              >
                ⚡ QUICK PLAY
              </button>
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

        {/* A persistent Quick Play under the list too, so it's always one tap
            away even when rooms exist. Hidden in the empty state (it's already
            front-and-centre there). */}
        {!isEmpty && (
          <button
            className="browser-btn browser-btn-quick browser-quick-footer"
            onClick={() => {
              sound.click();
              onQuickPlay();
            }}
          >
            ⚡ QUICK PLAY INSTEAD
          </button>
        )}
      </div>
    </div>
  );
}
