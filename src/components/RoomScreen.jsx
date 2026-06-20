// RoomScreen.jsx
import './RoomScreen.css';

const DIFFICULTIES = ['easy', 'medium', 'hard'];
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
export default function RoomScreen({ room, myId, preselectedGame, onLeave, onSetGameType, onSetDifficulty, onStartGame }) {
  if (!room) return null;

  const isHost = myId !== null && myId === room.hostId;
  const canStart = room.players.length >= MIN_PLAYERS_TO_START;

  return (
    <div className="room-wrap">
      <div className="room-box">
        <div className="room-label">ROOM CODE</div>
        <div className="room-code">{room.code}</div>
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
            {DIFFICULTIES.map((key) => (
              <button
                key={key}
                className={`room-difficulty-btn${room.difficultyKey === key ? ' selected' : ''}`}
                onClick={() => onSetDifficulty(key)}
              >
                {key.toUpperCase()}
              </button>
            ))}
          </div>
        ) : (
          <div className="room-difficulty-readonly">{room.difficultyKey.toUpperCase()}</div>
        )}

        {isHost ? (
          <button className="room-start-btn" onClick={onStartGame} disabled={!canStart}>
            {canStart ? 'START GAME' : 'NEED 2+ PLAYERS TO START'}
          </button>
        ) : (
          <div className="room-waiting-msg">WAITING FOR HOST TO START THE GAME...</div>
        )}

        <button className="room-leave-btn" onClick={onLeave}>
          LEAVE ROOM
        </button>
      </div>
    </div>
  );
}