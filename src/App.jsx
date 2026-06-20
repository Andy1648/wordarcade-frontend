// App.jsx
import { useState } from 'react';
import Homepage from './components/Homepage';
import LobbyScreen from './components/LobbyScreen';
import ConnectionTest from './components/ConnectionTest';

// TEMPORARY: set to true to verify the WebSocket connection works before
// wiring it into the real LobbyScreen flow. Set back to false (or just
// delete this flag + the ConnectionTest import/render) once confirmed -
// this is a diagnostic detour, not a permanent part of the app.
const SHOW_CONNECTION_TEST = true;

/**
 * Top-level view state manager. `view` determines which screen renders.
 * `lobbyMode` tells LobbyScreen whether the player clicked "solo",
 * "join", or came from a specific game card (stored as the game id).
 */
function App() {
  const [view, setView] = useState('home');
  const [lobbyMode, setLobbyMode] = useState(null);

  if (SHOW_CONNECTION_TEST) {
    return <ConnectionTest />;
  }

  function goToLobby(mode) {
    setLobbyMode(mode);
    setView('lobby');
  }

  function goHome() {
    setLobbyMode(null);
    setView('home');
  }

  if (view === 'lobby') {
    return <LobbyScreen mode={lobbyMode} onBack={goHome} />;
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