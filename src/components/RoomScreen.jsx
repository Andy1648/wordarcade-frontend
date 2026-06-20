// RoomScreen.jsx
import './RoomScreen.css';

/**
 * Shown once a room has been successfully created or joined. This proves
 * the full create/join flow works end to end and gives the host a code
 * to share. Deliberately minimal for this piece - it shows the room code
 * and a live player list (which updates automatically as people join,
 * since `room` is refreshed from every room_update broadcast in App.jsx)
 * and a way to leave. A "start game" button, difficulty selector, and
 * actual waiting-room polish are the next piece of work, built on top of
 * this once the underlying connection is confirmed solid.
 */
export default function RoomScreen({ room, onLeave }) {
  if (!room) return null;

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

        <button className="room-leave-btn" onClick={onLeave}>
          LEAVE ROOM
        </button>
      </div>
    </div>
  );
}