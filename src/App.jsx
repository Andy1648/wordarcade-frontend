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
  // Which mode the in-progress game is - 'word-bomb' | 'category-blitz'.
  // Learned authoritatively from the game_started message so GameScreen
  // knows which prompt/fields to render.
  const [gameType, setGameType] = useState('word-bomb');

  // Category Blitz state. Unlike Word Bomb this mode is simultaneous and
  // round-based, so it has its own slice of state:
  //   categoryRound  - the active round { round, category, timerSeconds }, or
  //                    null when no round is running (between rounds / ended)
  //   myAnswers      - this client's accepted answers for the current round
  //   playerProgress - { playerId: answerCount } for everyone (counts only -
  //                    answers stay private until the round ends)
  //   roundResults   - the round_end payload, shown during the intermission
  //   categoryScores - the final finalScores array, set at game over
  //   categoryTotals - running cumulative score per player id, accumulated
  //                    from each round_end (round_end only reports per-round
  //                    scores, so we tally totals client-side)
  const [categoryRound, setCategoryRound] = useState(null);
  const [myAnswers, setMyAnswers] = useState([]);
  const [playerProgress, setPlayerProgress] = useState({});
  const [roundResults, setRoundResults] = useState(null);
  const [categoryScores, setCategoryScores] = useState(null);
  const [categoryTotals, setCategoryTotals] = useState({});

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
      setGameType(lastMessage.payload.gameType || 'word-bomb');
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

    // ---- Category Blitz (simultaneous, round-based) ----

    if (lastMessage.type === 'round_start') {
      const payload = lastMessage.payload;
      setCategoryRound(payload);
      setTimerSeconds(payload.timerSeconds);
      setMyAnswers([]);
      setPlayerProgress({});
      setRoundResults(null);
      setLastWordResult(null);
      setGameOver(null);
      setCategoryScores(null);
      if (payload.round === 1) setCategoryTotals({}); // fresh game
      setView('game');
    }

    if (lastMessage.type === 'answer_result') {
      const payload = lastMessage.payload;
      setLastWordResult(payload); // reused to drive the feedback toast
      if (payload.accepted) {
        setMyAnswers((prev) => [...prev, payload.answer]);
      }
    }

    if (lastMessage.type === 'player_progress') {
      const { playerId, answerCount } = lastMessage.payload;
      setPlayerProgress((prev) => ({ ...prev, [playerId]: answerCount }));
    }

    if (lastMessage.type === 'round_end') {
      const payload = lastMessage.payload;
      setRoundResults(payload);
      setCategoryRound(null); // round over - timer stops, show results
      setLastWordResult(null);
      // Tally cumulative totals from this round's per-player scores.
      setCategoryTotals((prev) => {
        const next = { ...prev };
        (payload.playerResults || []).forEach((pr) => {
          next[pr.id] = (next[pr.id] || 0) + pr.roundScore;
        });
        return next;
      });
    }

    if (lastMessage.type === 'game_over') {
      const payload = lastMessage.payload;
      // Category Blitz game_over carries finalScores; Word Bomb carries just
      // winnerId. Detect by the presence of finalScores.
      if (payload.finalScores) {
        setCategoryScores(payload.finalScores);
        setCategoryRound(null);
        setRoundResults(null);
      }
      setGameOver(payload);
      setView('game');
    }

    if (lastMessage.type === 'error') {
      setServerError(lastMessage.payload.message);
    }
  }, [lastMessage]);

  // Auto-dismiss an accepted toast. Category Blitz answers fly fast, so they
  // clear quicker (1s) than Word Bomb's (2s). Rejections stick around until
  // the next submission/turn so the player can read why it failed.
  useEffect(() => {
    if (lastWordResult && lastWordResult.accepted) {
      const delay = gameType === 'category-blitz' ? 1000 : 2000;
      const timeoutId = setTimeout(() => setLastWordResult(null), delay);
      return () => clearTimeout(timeoutId);
    }
  }, [lastWordResult, gameType]);

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
    setGameType('word-bomb');
    setCategoryRound(null);
    setMyAnswers([]);
    setPlayerProgress({});
    setRoundResults(null);
    setCategoryScores(null);
    setCategoryTotals({});
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

  function handleSetGameType(gameType) {
    send('set_game_type', { gameType });
  }

  function handleStartGame() {
    send('start_game', {});
  }

  function handleSubmitWord(word) {
    send('submit_word', { word });
  }

  function handleSubmitAnswer(answer) {
    send('submit_answer', { answer });
  }

  function handleSkipTurn() {
    send('skip_turn', {});
  }

  if (view === 'game') {
    return (
      <GameScreen
        gameState={gameState}
        gameType={gameType}
        myId={myId}
        timerSeconds={timerSeconds}
        lastWordResult={lastWordResult}
        gameOver={gameOver}
        roomPlayers={room ? room.players : []}
        categoryRound={categoryRound}
        myAnswers={myAnswers}
        playerProgress={playerProgress}
        roundResults={roundResults}
        categoryScores={categoryScores}
        categoryTotals={categoryTotals}
        onSubmitWord={handleSubmitWord}
        onSubmitAnswer={handleSubmitAnswer}
        onSkipTurn={handleSkipTurn}
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
        onSetGameType={handleSetGameType}
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