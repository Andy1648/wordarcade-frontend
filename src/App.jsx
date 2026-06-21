// App.jsx
import { useState, useEffect, useRef } from 'react';
import Homepage from './components/Homepage';
import LobbyScreen from './components/LobbyScreen';
import RoomScreen from './components/RoomScreen';
import GameScreen from './components/GameScreen';
import { useWebSocket } from './hooks/useWebSocket';
import './Transitions.css';

// The lobby "mode" can be a generic entry ('solo' for Create Room, 'join'
// for Join Room) or a specific game id picked from a homepage card. Only
// these two are real backend game types we can lock the room into and
// preselect; other cards fall back to the in-room mode picker.
const PRESELECTABLE_GAMES = ['word-bomb', 'category-blitz'];

function isPreselectableGame(mode) {
  return PRESELECTABLE_GAMES.includes(mode);
}

/**
 * Top-level view state manager + the single shared WebSocket connection
 * for the whole app.
 */
function App() {
  const [view, setView] = useState('home');
  // Direction of the most recent view change, driving the slide transition:
  // 'forward' (deeper into the flow) slides in from the right, 'back' (home)
  // from the left. Set once per navigation; the whole home->lobby->room->game
  // chain is forward, and only goHome is back.
  const [transitionDir, setTransitionDir] = useState('forward');
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

  // Live kill-feed for Word Bomb: a running, ordered log of game events
  // (accepted words, timeouts, skips, your own rejections), oldest first.
  // GameScreen renders the tail of it newest-first. The refs below are the
  // bookkeeping the feed needs but that doesn't belong in render state:
  //   feedCurrentRef  - whose turn it is right now (set on each turn_update),
  //                     so an incoming word_result can be attributed to the
  //                     submitter before the turn advances past them.
  //   feedPrevLivesRef - last seen lives per player id, diffed on each
  //                     turn_update to spot who just lost a life.
  //   feedReasonRef   - 'timeout' | 'skip', set by the turn_timeout/
  //                     turn_skipped message that lands just before the
  //                     turn_update, so the life-loss can be labelled.
  const [feedEvents, setFeedEvents] = useState([]);
  const feedCurrentRef = useRef({ id: null, name: 'SOMEONE' });
  const feedPrevLivesRef = useRef({});
  const feedReasonRef = useRef(null);

  // End-of-game statistics for Word Bomb, accumulated across the whole game and
  // handed to the game-over overlay for the summary/per-player/awards panels.
  //   wordsPlayed - every accepted word with who played it and when
  //   timeouts/skips - each life lost, by cause
  //   gameStartTime/gameEndTime - wall-clock bounds for the duration stat
  const EMPTY_STATS = {
    wordsPlayed: [],
    timeouts: [],
    skips: [],
    gameStartTime: null,
    gameEndTime: null,
  };
  const [gameStats, setGameStats] = useState(EMPTY_STATS);

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
      // Fresh game - wipe the live feed and its bookkeeping.
      setFeedEvents([]);
      feedCurrentRef.current = { id: null, name: 'SOMEONE' };
      feedPrevLivesRef.current = {};
      feedReasonRef.current = null;
      // Fresh game - reset stats and stamp the start time.
      setGameStats({
        wordsPlayed: [],
        timeouts: [],
        skips: [],
        gameStartTime: Date.now(),
        gameEndTime: null,
      });
      setView('game');
    }

    if (lastMessage.type === 'turn_update') {
      const payload = lastMessage.payload;
      setGameState(payload);
      setTimerSeconds(payload.timerSeconds);
      setLastWordResult(null);

      // ---- Live feed bookkeeping (Word Bomb) ----
      const players = payload.players || [];
      // Remember whose turn it is now so an incoming word_result can be
      // attributed to the submitter - the turn hasn't advanced past them yet.
      const cur = players.find((p) => p.id === payload.currentPlayerId);
      feedCurrentRef.current = cur
        ? { id: cur.id, name: cur.name }
        : { id: payload.currentPlayerId, name: 'SOMEONE' };

      // Diff lives against the previous snapshot: any player who just dropped a
      // life timed out or skipped. Which one is carried by feedReasonRef, set
      // by the turn_timeout/turn_skipped message that arrives just before this.
      const prevLives = feedPrevLivesRef.current;
      const reason = feedReasonRef.current || 'timeout';
      const lostPlayers = [];
      players.forEach((p) => {
        const before = prevLives[p.id];
        if (
          typeof before === 'number' &&
          typeof p.lives === 'number' &&
          p.lives < before
        ) {
          lostPlayers.push({ id: p.id, name: p.name });
        }
      });
      feedPrevLivesRef.current = Object.fromEntries(
        players.map((p) => [p.id, p.lives])
      );
      feedReasonRef.current = null;
      if (lostPlayers.length) {
        const now = Date.now();
        setFeedEvents((prev) => [
          ...prev,
          ...lostPlayers.map((p) => ({
            type: reason,
            playerName: p.name,
            timestamp: now,
          })),
        ]);
        // Record the life loss in the end-game stats under its cause.
        setGameStats((prev) => {
          const key = reason === 'skip' ? 'skips' : 'timeouts';
          return {
            ...prev,
            [key]: [
              ...prev[key],
              ...lostPlayers.map((p) => ({
                playerId: p.id,
                playerName: p.name,
                timestamp: now,
              })),
            ],
          };
        });
      }
    }

    if (lastMessage.type === 'timer_tick') {
      setTimerSeconds(lastMessage.payload.secondsRemaining);
    }

    if (lastMessage.type === 'word_result') {
      const payload = lastMessage.payload;
      setLastWordResult(payload);
      // Attribute to whoever's turn it currently is (the submitter).
      const submitter = feedCurrentRef.current;
      const playerName = submitter.name || 'SOMEONE';
      if (payload.accepted) {
        const now = Date.now();
        setFeedEvents((prev) => [
          ...prev,
          {
            type: 'accepted',
            playerName,
            word: payload.word,
            timestamp: now,
          },
        ]);
        // Tally the accepted word for the end-game stats.
        setGameStats((prev) => ({
          ...prev,
          wordsPlayed: [
            ...prev.wordsPlayed,
            {
              word: payload.word,
              playerId: submitter.id,
              playerName,
              timestamp: now,
            },
          ],
        }));
      } else {
        // Rejections are only sent to the player who submitted, so this is
        // always our own miss.
        setFeedEvents((prev) => [
          ...prev,
          {
            type: 'rejected',
            playerName,
            reason: payload.reason,
            timestamp: Date.now(),
          },
        ]);
      }
    }

    // turn_timeout / turn_skipped arrive just before the turn_update that
    // advances play. They carry no player id, so we don't emit the feed event
    // here - we just record the reason and let the turn_update's life-loss diff
    // attribute it to the right player.
    if (lastMessage.type === 'turn_timeout') {
      feedReasonRef.current = 'timeout';
    }

    if (lastMessage.type === 'turn_skipped') {
      feedReasonRef.current = 'skip';
    }

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
      // Stamp the end time so the overlay can show the game's duration.
      setGameStats((prev) => ({ ...prev, gameEndTime: Date.now() }));
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
    setTransitionDir('forward');
    setLobbyMode(mode);
    setServerError('');
    setView('lobby');
  }

  function goHome() {
    setTransitionDir('back');
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
    setFeedEvents([]);
    feedCurrentRef.current = { id: null, name: 'SOMEONE' };
    feedPrevLivesRef.current = {};
    feedReasonRef.current = null;
    setGameStats(EMPTY_STATS);
    setView('home');
  }

  function handleLobbyContinue({ name, mode, roomCode }) {
    if (mode === 'join') {
      send('join_room', { code: roomCode, name });
    } else {
      send('create_room', { name });
      // If the player picked a specific game from the homepage, lock the room
      // into it right away. The server processes messages in order over the
      // same socket, so create_room (which registers the room) is handled
      // before this set_game_type lands.
      if (isPreselectableGame(mode)) {
        send('set_game_type', { gameType: mode });
      }
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

  // Host-only "play again": the server resets the room's game and broadcasts a
  // room_update, which the handler above turns back into the 'room' view.
  function handleRematch() {
    send('rematch', {});
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

  // Whether this client is the room host (drives the host-only REMATCH button
  // on the game-over overlay). room comes from room_update, which carries hostId.
  const isHost = !!room && myId != null && room.hostId === myId;

  // Pick the screen for the current view. It's wrapped in a single keyed
  // slide container below so switching views animates, while in-view updates
  // (player joins, turn_updates) re-render the same screen without replaying.
  let screen;
  if (view === 'game') {
    screen = (
      <GameScreen
        gameState={gameState}
        gameType={gameType}
        myId={myId}
        isHost={isHost}
        timerSeconds={timerSeconds}
        lastWordResult={lastWordResult}
        gameOver={gameOver}
        roomPlayers={room ? room.players : []}
        feedEvents={feedEvents}
        gameStats={gameStats}
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
        onRematch={handleRematch}
      />
    );
  } else if (view === 'room' && room) {
    screen = (
      <RoomScreen
        room={room}
        myId={myId}
        preselectedGame={isPreselectableGame(lobbyMode) ? lobbyMode : null}
        serverError={serverError}
        onLeave={handleLeaveRoom}
        onSetGameType={handleSetGameType}
        onSetDifficulty={handleSetDifficulty}
        onStartGame={handleStartGame}
      />
    );
  } else if (view === 'lobby') {
    screen = (
      <LobbyScreen
        mode={lobbyMode}
        onBack={goHome}
        onContinue={handleLobbyContinue}
        wsStatus={wsStatus}
        serverError={serverError}
      />
    );
  } else {
    screen = (
      <Homepage
        onSelectGame={(gameId) => goToLobby(gameId)}
        onCreateRoom={() => goToLobby('solo')}
        onJoinRoom={() => goToLobby('join')}
      />
    );
  }

  // `key={view}` remounts the wrapper only on an actual view change, so the
  // slide animation fires then (not on every re-render within a view).
  return (
    <div className="view-transition-root">
      <div key={view} className={`view-screen view-${transitionDir}`}>
        {screen}
      </div>
    </div>
  );
}

export default App;