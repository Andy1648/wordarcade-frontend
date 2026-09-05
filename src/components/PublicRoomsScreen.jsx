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

// Compact, all-caps relative time for "LAST GAME · X AGO". Returns null for a
// missing/null timestamp so the caller can simply omit the line (the backend
// sends lastGameStartedAt as epoch ms, or null when it has never seen a game).
function relativeTime(ts) {
  if (!ts) return null;
  const diff = Date.now() - ts;
  if (diff < 45 * 1000) return 'JUST NOW';
  const min = Math.floor(diff / 60000);
  if (min < 60) return `${min} MIN AGO`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} HR AGO`;
  const day = Math.floor(hr / 24);
  return `${day} DAY${day === 1 ? '' : 'S'} AGO`;
}

// DEV-ONLY mock for BE-PICKY screenshots (the live Render backend sends neither
// `stats` nor, offline, any rooms). `?lobbymock=1` → life-signs only (empty list);
// `?lobbymock=rooms` → life-signs + a sample list. Never runs in production
// (guarded by import.meta.env.DEV), so the shipped code path is byte-identical.
function devMock() {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null;
  const v = new URLSearchParams(window.location.search).get('lobbymock');
  if (!v) return null;
  const stats = { online: 47, inGame: 12, gamesInProgress: 5, lastGameStartedAt: Date.now() - 3 * 60 * 1000 };
  const rooms =
    v === 'rooms'
      ? [
          { code: 'FROG9', gameType: 'word-bomb', playerCount: 1, maxPlayers: 8 },
          { code: 'ZAP42', gameType: 'category-blitz', playerCount: 3, maxPlayers: 8 },
          { code: 'MOTH7', gameType: 'word-bomb', playerCount: 8, maxPlayers: 8 },
        ]
      : [];
  return { stats, rooms };
}

export default function PublicRoomsScreen({
  rooms,
  stats,
  serverError,
  name,
  onNameChange,
  onJoin,
  onRefresh,
  onCreatePublic,
  onStartVsBot,
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
    if (codeInput.length === 0) {
      setLocalError('ENTER A ROOM CODE.');
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

  // START VS BOT: create a PUBLIC room + bot and start solo, room stays joinable.
  // Same name-required guard as a join; App owns the create_room/add_bot frames.
  function handleStartVsBot() {
    if (joiningCode) return;
    const trimmed = (name || '').trim();
    if (!trimmed) {
      setLocalError('DROP A NAME FIRST.');
      return;
    }
    setLocalError('');
    sound.click();
    if (onStartVsBot) onStartVsBot(trimmed);
  }

  const error = localError || serverError;

  // Life-signs from the enriched `public_rooms` frame (read DEFENSIVELY — an
  // undeployed backend omits it, leaving `stats` null and this UI hidden). The
  // dev mock only fills in under ?lobbymock in dev builds (screenshots).
  const mock = devMock();
  const liveRooms = mock && mock.rooms.length ? mock.rooms : rooms;
  const liveStats = stats || (mock ? mock.stats : null);
  const lastGameAgo = liveStats ? relativeTime(liveStats.lastGameStartedAt) : null;
  const isEmpty = !liveRooms || liveRooms.length === 0;
  // The mock resolves the first-fetch pulse so screenshots show the real states.
  const showLoading = loading && !mock;

  // The bot CTA — reused in the empty state and as a footer under a populated list.
  const startVsBotBtn = (
    <button className="browser-btn browser-btn-bot" onClick={handleStartVsBot}>
      🤖 START VS BOT
    </button>
  );

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

        {/* Life-signs — makes an empty list feel populated, not dead. Rendered
            only when the backend sends the `stats` block (or the dev mock is on);
            an undeployed backend omits it and this whole strip disappears. */}
        {liveStats && (
          <div className="browser-lifesigns" role="status">
            <span className="browser-life-primary">
              <span className="browser-life-pip" aria-hidden="true" />
              <span className="browser-life-count">{liveStats.online} ONLINE</span>
              {liveStats.inGame > 0 && (
                <span className="browser-life-ingame">{liveStats.inGame} IN GAME</span>
              )}
            </span>
            {lastGameAgo && (
              <span className="browser-life-last">LAST GAME · {lastGameAgo}</span>
            )}
          </div>
        )}

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
            disabled={!!joiningCode}
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

        {showLoading && isEmpty ? (
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
            <div className="browser-empty-title">NO PUBLIC GAMES RIGHT NOW</div>
            <div className="browser-empty-sub">
              START VS A BOT — A REAL PLAYER CAN DROP IN THE SECOND THEY ARRIVE.
            </div>
            <div className="browser-empty-actions">
              {startVsBotBtn}
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
            {liveRooms.map((room) => {
              const joining = joiningCode === room.code;
              const full = room.playerCount >= room.maxPlayers;
              return (
                <li key={room.code}>
                  <button
                    className={`browser-row${full ? ' is-full' : ''}`}
                    style={{ '--row-accent': gameColor(room.gameType) }}
                    onClick={() => handleJoin(room.code)}
                    disabled={!!joiningCode || full}
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
                        {full ? 'FULL' : joining ? 'JOINING…' : 'WAITING'}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {/* Always-reachable escape hatch: don't want to wait on the list? Start
            solo vs a bot right now — the room stays public so a human can join
            before you start. (The empty state shows this too; here it sits under
            a populated list so it's never buried.) */}
        {!isEmpty && (
          <div className="browser-footer-action">{startVsBotBtn}</div>
        )}
      </div>
    </div>
  );
}
