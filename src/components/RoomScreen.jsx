// RoomScreen.jsx
import { useState, useEffect, useRef } from 'react';
import WaveText from './WaveText';
import Mascot from './Mascot';
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
];

function gameTypeLabel(gameType) {
  const match = GAME_TYPES.find((gt) => gt.key === gameType);
  return (match || GAME_TYPES[0]).label;
}
// Mirrors gameLogic.js's MIN_PLAYERS_TO_START on the backend - the
// server is the real source of truth and will reject a start_game
// attempt below this count, but matching it here means the player gets
// instant feedback (a disabled button) instead of a round-trip error.
const MIN_PLAYERS_TO_START = 2;

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

  // A server error means the start attempt bounced - let the host try again.
  useEffect(() => {
    if (serverError) setStarting(false);
  }, [serverError]);

  // Mascot sits ON the room code like a bench. It's idle while waiting (with a
  // lazy head-bob from CSS), pops a 1.5s celebrate + a quick jump-up whenever a
  // new player joins, and runs + leaps off the code once the host starts.
  //   mascotPose - which PNG to show
  //   mascotMod  - a positional CSS modifier ('bouncing' | 'jumping')
  const [mascotPose, setMascotPose] = useState('idle');
  const [mascotMod, setMascotMod] = useState('');
  const prevCountRef = useRef(room ? room.players.length : 0);
  const playerCount = room ? room.players.length : 0;
  useEffect(() => {
    if (playerCount > prevCountRef.current) {
      prevCountRef.current = playerCount;
      setMascotPose('celebrate');
      setMascotMod('bouncing'); // quick jump up, then settle back onto the code
      const tPose = setTimeout(() => setMascotPose('idle'), 1500);
      const tHop = setTimeout(() => setMascotMod(''), 320);
      return () => {
        clearTimeout(tPose);
        clearTimeout(tHop);
      };
    }
    prevCountRef.current = playerCount;
    return undefined;
  }, [playerCount]);

  if (!room) return null;

  const isHost = myId !== null && myId === room.hostId;
  const canStart = room.players.length >= MIN_PLAYERS_TO_START;

  function handleStartGame() {
    if (starting) return;
    setStarting(true);
    setMascotPose('run'); // leaps off the code as the game kicks off
    setMascotMod('jumping');
    onStartGame();
  }

  function handleLeave() {
    if (leaving) return;
    setLeaving(true);
    onLeave();
  }

  return (
    <div className="room-wrap">
      <div className="room-box">
        <div className="room-label">ROOM CODE</div>
        <div className="room-code">
          <WaveText text={room.code} />
          {/* The mascot sits ON the code like it's a bench, leaning back. */}
          <div className={`room-mascot-sit${mascotMod ? ` ${mascotMod}` : ''}`}>
            <Mascot pose={mascotPose} size={60} />
          </div>
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
                    onClick={() => onSetGameType(gt.key)}
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
                onClick={() => onSetDifficulty(diff.key)}
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
              ? 'NEED 2+ PLAYERS TO START'
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