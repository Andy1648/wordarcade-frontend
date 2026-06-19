// App.jsx
import { useState } from 'react';
import Homepage from './components/Homepage';
import LobbyScreen from './components/LobbyScreen';

/**
 * Top-level view state manager. `view` determines which screen renders.
 * `lobbyMode` tells LobbyScreen whether the player clicked "solo",
 * "join", or came from a specific game card (stored as the game id).
 *
 * Keeping this in App.jsx means each screen component stays stateless
 * about navigation - they just call the callbacks they're given.
 */
function App() {
  const [view, setView] = useState('home');
  const [lobbyMode, setLobbyMode] = useState(null);

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