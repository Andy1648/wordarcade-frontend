// RoomScreen.jsx
import { useState, useEffect } from 'react';
import { useSound } from '../contexts/SoundContext';
import WaveText from './WaveText';
import './RoomScreen.css';

// Each difficulty carries a short timer blurb so players know what they're
// picking. The `desc` mirrors the backend DIFFICULTY_PRESETS startSeconds in
// gameLogic.js (easy 15s, medium 10s, hard 7s).
const DIFFICULTIES = [
  { key: 'easy', label: 'EASY', desc: '15s timer' },
  { key: 'medium', label: 'MEDIUM', desc: '10s timer' },
  { key: 'hard', label: 'HARD', desc: '7s timer' },
];

// Read-only readout for non-hosts: "MEDIUM — 10s timer" (falls back to the
// bare key if it's somehow unknown).
function difficultyReadout(key) {
  const match = DIFFICULTIES.find((d) => d.key === key);
  return match ? `${match.label} — ${match.desc}` : (key || '').toUpperCase();
}
// The two playable game modes. `key` is the value the server expects in
// set_game_type / reports back in room_update's gameType; `label` is the
// display text.
const GAME_TYPES = [
  { key: 'word-bomb', label: 'WORD BOMB' },
  { key: 'category-blitz', label: 'CATEGORY BLITZ' },
  { key: 'imposter-word', label: 'IMPOSTER WORD' },
];

function gameTypeLabel(gameType) {
  const match = GAME_TYPES.find((gt) => gt.key === gameType);
  return (match || GAME_TYPES[0]).label;
}
// Minimum players to start, by game type. Mirrors the backend (the server is
// the real source of truth and will reject an under-count start_game), but
// matching it here gives instant feedback (a disabled button) instead of a
// round-trip error. Imposter Word needs 3 - it's no fun finding the imposter
// among one other person.
const MIN_PLAYERS_TO_START = 2;
const MIN_PLAYERS_BY_TYPE = { 'imposter-word': 3 };

function minPlayersFor(gameType) {
  return MIN_PLAYERS_BY_TYPE[gameType] || MIN_PLAYERS_TO_START;
}

/**
 * Shown once a room has been successfully created or joined.
 *
 * `myId` (the player's own connection id, learned from the server's
 * 'connected' message in App.jsx) determines whether host-only controls
 * - the difficulty selector and Start Game button - are shown. Non-host
 * players instead see the current difficulty as read-only text and a
 * "waiting for host" message.
 */
export default function RoomScreen({ room, myId, preselectedGame, serverError, onLeave, onSetGameType, onSetDifficulty, onStartGame }) {
  // Spam-click guards: lock Start once pressed (re-enabled if the server
  // rejects it) and Leave once pressed (you're on your way out).
  const [starting, setStarting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const { sound } = useSound();

  // A server error means the start attempt bounced - let the host try again.
  useEffect(() => {
    if (serverError) setStarting(false);
  }, [serverError]);

  if (!room) return null;

  const isHost = myId !== null && myId === room.hostId;
  const minPlayers = minPlayersFor(room.gameType);
  const canStart = room.players.length >= minPlayers;

  function handleStartGame() {
    if (starting) return;
    sound.click(); // the countdown beeps follow once the game screen mounts
    setStarting(true);
    onStartGame();
  }

  function handleLeave() {
    if (leaving) return;
    sound.click();
    setLeaving(true);
    onLeave();
  }

  return (
    <div className="room-wrap">
      <div className="room-box">
        <div className="room-label">ROOM CODE</div>
        <div className="room-code">
          <WaveText text={room.code} />
        </div>
        <div className="room-hint">SHARE THIS CODE WITH FRIENDS TO JOIN</div>

        <div className="room-players-label">PLAYERS ({room.players.length})</div>
        <div className="room-players-list">
          {room.players.map((player) => (
            <div key={player.id} className="room-player-chip">
              <span>{player.name}</span>
              {player.id === room.hostId && <span className="room-host-badge">HOST</span>}
            </div>
          ))}
        </div>

        {/* The game-mode picker is hidden when the player already chose a
            specific game from the homepage (preselectedGame) - it's locked in.
            It only appears when they came through generic "Create Room". */}
        {!preselectedGame && (
          <>
            <div className="room-section-label">GAME MODE</div>
            {isHost ? (
              <div className="room-gametype-row">
                {GAME_TYPES.map((gt) => (
                  <button
                    key={gt.key}
                    className={`room-gametype-btn${room.gameType === gt.key ? ' selected' : ''}`}
                    onClick={() => {
                      sound.click();
                      onSetGameType(gt.key);
                    }}
                  >
                    {gt.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="room-difficulty-readonly">{gameTypeLabel(room.gameType)}</div>
            )}
          </>
        )}

        <div className="room-section-label">DIFFICULTY</div>
        {isHost ? (
          <div className="room-difficulty-row">
            {DIFFICULTIES.map((diff) => (
              <button
                key={diff.key}
                className={`room-difficulty-btn${room.difficultyKey === diff.key ? ' selected' : ''}`}
                onClick={() => {
                  sound.click();
                  onSetDifficulty(diff.key);
                }}
              >
                <span className="room-difficulty-name">{diff.label}</span>
                <span className="room-difficulty-desc">{diff.desc}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="room-difficulty-readonly">{difficultyReadout(room.difficultyKey)}</div>
        )}

        {isHost ? (
          <button
            className="room-start-btn"
            onClick={handleStartGame}
            disabled={!canStart || starting}
          >
            {!canStart
              ? `NEED ${minPlayers}+ PLAYERS TO START`
              : starting
              ? 'STARTING...'
              : 'START GAME'}
          </button>
        ) : (
          <div className="room-waiting-msg">WAITING FOR HOST TO START THE GAME...</div>
        )}

        <button
          className={`room-leave-btn${leaving ? ' disabled' : ''}`}
          onClick={handleLeave}
          disabled={leaving}
        >
          LEAVE ROOM
        </button>
      </div>
    </div>
  );
}