// App.jsx
import { useState, useEffect } from 'react';
import Homepage from './components/Homepage';
import LobbyScreen from './components/LobbyScreen';
import RoomScreen from './components/RoomScreen';
import GameScreen from './components/GameScreen';
import { useWebSocket } from './hooks/useWebSocket';

/**
 * Top-level view state manager + the single shared WebSocket connection
 * for the whole app.
 */
function App() {
  const [view, setView] = useState('home');
  const [lobbyMode, setLobbyMode] = useState(null);
  const [room, setRoom] = useState(null);
  const [serverError, setServerError] = useState('');
  // The server tells us our own connection id immediately on connect (see
  // server.js's 'connected' message) - we need this to know things like
  // "am I the host" (compare to room.hostId) since room broadcasts list
  // every player's id but never single out which one is ours.
  const [myId, setMyId] = useState(null);

  // Chain Reaction in-game state. gameState holds the latest turn_update
  // payload (whose turn, lives, the word chain, etc.); timerSeconds is the
  // countdown for the current turn (seeded by turn_update, then ticked
  // down by timer_tick); lastWordResult is the transient accept/reject of
  // the most recent submission; gameOver holds the final results once set.
  const [gameState, setGameState] = useState(null);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [lastWordResult, setLastWordResult] = useState(null);
  const [gameOver, setGameOver] = useState(null);

  const { status: wsStatus, lastMessage, send } = useWebSocket();

  useEffect(() => {
    if (!lastMessage) return;

    if (lastMessage.type === 'connected') {
      setMyId(lastMessage.payload.id);
    }

    if (lastMessage.type === 'room_update') {
      setRoom(lastMessage.payload);
      setServerError('');
      setView('room');
    }

    if (lastMessage.type === 'game_started') {
      setGameOver(null);
      setServerError('');
      setView('game');
    }

    if (lastMessage.type === 'turn_update') {
      setGameState(lastMessage.payload);
      setTimerSeconds(lastMessage.payload.timerSeconds);
      setLastWordResult(null);
    }

    if (lastMessage.type === 'timer_tick') {
      setTimerSeconds(lastMessage.payload.secondsRemaining);
    }

    if (lastMessage.type === 'word_result') {
      setLastWordResult(lastMessage.payload);
    }

    // turn_timeout needs no handling here - the server sends a turn_update
    // immediately after, which advances to the next player anyway.

    if (lastMessage.type === 'game_over') {
      setGameOver(lastMessage.payload);
      setView('game');
    }

    if (lastMessage.type === 'error') {
      setServerError(lastMessage.payload.message);
    }
  }, [lastMessage]);

  // Auto-dismiss an accepted word toast after 2s. Rejections stick around
  // until the next submission/turn so the player can read why it failed.
  useEffect(() => {
    if (lastWordResult && lastWordResult.accepted) {
      const timeoutId = setTimeout(() => setLastWordResult(null), 2000);
      return () => clearTimeout(timeoutId);
    }
  }, [lastWordResult]);

  function goToLobby(mode) {
    setLobbyMode(mode);
    setServerError('');
    setView('lobby');
  }

  function goHome() {
    setLobbyMode(null);
    setRoom(null);
    setServerError('');
    setGameState(null);
    setTimerSeconds(0);
    setLastWordResult(null);
    setGameOver(null);
    setView('home');
  }

  function handleLobbyContinue({ name, mode, roomCode }) {
    if (mode === 'join') {
      send('join_room', { code: roomCode, name });
    } else {
      send('create_room', { name });
    }
  }

  function handleLeaveRoom() {
    send('leave_room', {});
    goHome();
  }

  function handleSetDifficulty(difficultyKey) {
    send('set_difficulty', { difficultyKey });
  }

  function handleStartGame() {
    send('start_game', {});
  }

  function handleSubmitWord(word) {
    send('submit_word', { word });
  }

  if (view === 'game') {
    return (
      <GameScreen
        gameState={gameState}
        myId={myId}
        timerSeconds={timerSeconds}
        lastWordResult={lastWordResult}
        gameOver={gameOver}
        onSubmitWord={handleSubmitWord}
        onLeave={handleLeaveRoom}
      />
    );
  }

  if (view === 'room' && room) {
    return (
      <RoomScreen
        room={room}
        myId={myId}
        onLeave={handleLeaveRoom}
        onSetDifficulty={handleSetDifficulty}
        onStartGame={handleStartGame}
      />
    );
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
      onCreateRoom={() => goToLobby('solo')}
      onJoinRoom={() => goToLobby('join')}
    />
  );
}

export default App;