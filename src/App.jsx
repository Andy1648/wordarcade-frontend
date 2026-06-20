// App.jsx
import { useState, useEffect } from 'react';
import Homepage from './components/Homepage';
import LobbyScreen from './components/LobbyScreen';
import RoomScreen from './components/RoomScreen';
import { useWebSocket } from './hooks/useWebSocket';

/**
 * Top-level view state manager + the single shared WebSocket connection
 * for the whole app. The connection is opened here (not inside
 * LobbyScreen) deliberately - it needs to survive the transition from
 * lobby to room screen, and connecting eagerly on app load (rather than
 * waiting until the player clicks Continue) gives the connection time to
 * wake up from Render's free-tier cold start in the background.
 */
function App() {
  const [view, setView] = useState('home');
  const [lobbyMode, setLobbyMode] = useState(null);
  const [room, setRoom] = useState(null);
  const [serverError, setServerError] = useState('');

  const { status: wsStatus, lastMessage, send } = useWebSocket();

  // Reacts to incoming server messages regardless of which screen is
  // showing. room_update arrives after a successful create/join AND
  // every time the roster changes (someone else joins/leaves), so this
  // naturally keeps RoomScreen's player list live without any extra work.
  useEffect(() => {
    if (!lastMessage) return;

    if (lastMessage.type === 'room_update') {
      setRoom(lastMessage.payload);
      setServerError('');
      setView('room');
    }

    if (lastMessage.type === 'error') {
      setServerError(lastMessage.payload.message);
    }
  }, [lastMessage]);

  function goToLobby(mode) {
    setLobbyMode(mode);
    setServerError('');
    setView('lobby');
  }

  function goHome() {
    setLobbyMode(null);
    setRoom(null);
    setServerError('');
    setView('home');
  }

  function handleLobbyContinue({ name, mode, roomCode }) {
    if (mode === 'join') {
      send('join_room', { code: roomCode, name });
    } else {
      // 'solo' and any specific game-id mode both create a fresh room for
      // now - letting the host pick which game to actually play inside
      // that room is separate, later work.
      send('create_room', { name });
    }
  }

  function handleLeaveRoom() {
    send('leave_room', {});
    goHome();
  }

  if (view === 'room' && room) {
    return <RoomScreen room={room} onLeave={handleLeaveRoom} />;
  }

  if (view === 'lobby') {
    return (
      <LobbyScreen
        mode={lobbyMode}
        onBack={goHome}
        onContinue={handleLobbyContinue}
        wsStatus={wsStatus}
        serverError={serverError}
      />
    );
  }

  return (
    <Homepage
      onSelectGame={(gameId) => goToLobby(gameId)}
      onPlaySolo={() => goToLobby('solo')}
      onJoinRoom={() => goToLobby('join')}
    />
  );
}

export default App;