// App.jsx
import { useState, useEffect, useRef } from 'react';
import Homepage from './components/Homepage';
import LobbyScreen from './components/LobbyScreen';
import RoomScreen from './components/RoomScreen';
import GameScreen from './components/GameScreen';
import WallScene from './components/WallScene';
import TransitionOverlay from './components/TransitionOverlay';
import LoadingScreen from './components/LoadingScreen';
import MusicButton from './components/MusicButton';
import CreditsScreen from './components/CreditsScreen';
import { useWebSocket } from './hooks/useWebSocket';
import { useMusicPlayer } from './hooks/useMusicPlayer';
import './Transitions.css';

// The music button's border/glyph colour, matched to each screen's accent.
const SCREEN_ACCENT = {
  home: '#FF2EC4',
  lobby: '#2EFFE0',
  room: '#FFE94A',
  game: '#FF6B3D',
  credits: '#9A1AFF',
};

// The word flashed mid-wipe when navigating to each view.
const TRANSITION_WORDS = {
  game: "LET'S GO!",
  home: 'PEACE OUT',
  lobby: 'READY?',
  room: 'SQUAD UP',
  credits: 'CREDITS',
};

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
  // The lastMessage effect only depends on lastMessage, so reading `view` from
  // its closure could be stale. Mirror it into a ref (updated every render) so
  // message handlers can branch on the live view without re-running the effect.
  const viewRef = useRef('home');
  viewRef.current = view;
  // `view` is the live target; `renderedView` is what's actually on screen and
  // lags it by 250ms during a wipe so the diagonal-bar TransitionOverlay can
  // cover the swap (Persona 5 style). `transition` is the active overlay
  // ({ word, key }) or null; the key re-keys the overlay so each wipe replays.
  const [renderedView, setRenderedView] = useState('home');
  const [transition, setTransition] = useState(null);
  const transitionKeyRef = useRef(0);
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

  // Live "what is everyone typing" map (Word Bomb): playerId -> their current
  // in-progress text, streamed via typing_update keystroke relays. Reset to {}
  // on every turn_update so each turn starts from a clean slate.
  const [typingText, setTypingText] = useState({});

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

  // Background music. Try to start immediately on load; most browsers block
  // autoplay of audio with sound, so we also arm a one-shot click listener that
  // starts it on the first user interaction as a fallback.
  const music = useMusicPlayer();
  const musicPlay = music.play;
  useEffect(() => {
    musicPlay(); // immediate attempt (no-op if the browser blocks it)
    const startMusic = () => {
      musicPlay();
    };
    window.addEventListener('click', startMusic, { once: true });
    return () => window.removeEventListener('click', startMusic);
  }, [musicPlay]);

  useEffect(() => {
    if (!lastMessage) return;

    if (lastMessage.type === 'connected') {
      setMyId(lastMessage.payload.id);
    }

    if (lastMessage.type === 'room_update') {
      setRoom(lastMessage.payload);
      setServerError('');
      // Only fall back to the room view if we're not currently in a game. A
      // room_update can land right after game_started (host start) and would
      // otherwise yank the player back out of the match. The rematch flow sends
      // an explicit game_reset to drive the game -> room transition instead.
      if (viewRef.current !== 'game') {
        setView('room');
      }
    }

    if (lastMessage.type === 'game_reset') {
      // Host rematch: the room data already arrived via room_update; this is
      // the explicit cue to leave the game view and return to the lobby.
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

    if (lastMessage.type === 'typing_update') {
      const { playerId, text } = lastMessage.payload;
      setTypingText((prev) => ({ ...prev, [playerId]: text }));
    }

    if (lastMessage.type === 'turn_update') {
      const payload = lastMessage.payload;
      setGameState(payload);
      setTimerSeconds(payload.timerSeconds);
      setLastWordResult(null);
      // New turn - wipe the typing slate so a previous typist's leftover text
      // doesn't linger under the (now stale) active player.
      setTypingText({});

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

  // Drive the bar wipe on every real view change: fire the overlay, swap the
  // rendered screen at the half-way point (under cover of the bars), and clear
  // the overlay when it finishes. Depends only on `view` (the last navigated
  // view is tracked in a ref) so the mid-wipe setRenderedView doesn't re-run
  // this effect and cancel the pending overlay-clear.
  const lastNavViewRef = useRef('home');
  useEffect(() => {
    if (view === lastNavViewRef.current) return;
    lastNavViewRef.current = view;
    transitionKeyRef.current += 1;
    setTransition({ word: TRANSITION_WORDS[view] || 'GO!', key: transitionKeyRef.current });
    const swap = setTimeout(() => setRenderedView(view), 250);
    const end = setTimeout(() => setTransition(null), 500);
    return () => {
      clearTimeout(swap);
      clearTimeout(end);
    };
  }, [view]);

  // Wipe to the homepage the moment the socket comes up (connecting -> open).
  const prevWsRef = useRef(wsStatus);
  useEffect(() => {
    const prev = prevWsRef.current;
    prevWsRef.current = wsStatus;
    if (prev !== 'open' && wsStatus === 'open') {
      transitionKeyRef.current += 1;
      setTransition({ word: 'READY?', key: transitionKeyRef.current });
      const end = setTimeout(() => setTransition(null), 500);
      return () => clearTimeout(end);
    }
  }, [wsStatus]);

  function goToLobby(mode) {
    setLobbyMode(mode);
    setServerError('');
    setView('lobby');
  }

  function goToCredits() {
    setView('credits');
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
    setFeedEvents([]);
    feedCurrentRef.current = { id: null, name: 'SOMEONE' };
    feedPrevLivesRef.current = {};
    feedReasonRef.current = null;
    setGameStats(EMPTY_STATS);
    setTypingText({});
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

  // Stream the active player's in-progress text to everyone else (Word Bomb).
  // Sent on every keystroke - no debounce, the live typing is the point.
  function handleTypingUpdate(text) {
    send('typing_update', { text });
  }

  // Whether this client is the room host (drives the host-only REMATCH button
  // on the game-over overlay). room comes from room_update, which carries hostId.
  const isHost = !!room && myId != null && room.hostId === myId;

  // Pick the screen for the current view. It's wrapped in a single keyed
  // slide container below so switching views animates, while in-view updates
  // (player joins, turn_updates) re-render the same screen without replaying.
  let screen;
  if (renderedView === 'game') {
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
        typingText={typingText}
        categoryRound={categoryRound}
        myAnswers={myAnswers}
        playerProgress={playerProgress}
        roundResults={roundResults}
        categoryScores={categoryScores}
        categoryTotals={categoryTotals}
        onSubmitWord={handleSubmitWord}
        onSubmitAnswer={handleSubmitAnswer}
        onSkipTurn={handleSkipTurn}
        onTypingUpdate={handleTypingUpdate}
        onLeave={handleLeaveRoom}
        onRematch={handleRematch}
        musicSetVolume={music.setVolume}
      />
    );
  } else if (renderedView === 'room' && room) {
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
  } else if (renderedView === 'lobby') {
    screen = (
      <LobbyScreen
        mode={lobbyMode}
        onBack={goHome}
        onContinue={handleLobbyContinue}
        wsStatus={wsStatus}
        serverError={serverError}
      />
    );
  } else if (renderedView === 'credits') {
    screen = <CreditsScreen onBack={goHome} />;
  } else {
    screen = (
      <Homepage
        onSelectGame={(gameId) => goToLobby(gameId)}
        onCreateRoom={() => goToLobby('solo')}
        onJoinRoom={() => goToLobby('join')}
        onCredits={goToCredits}
      />
    );
  }

  // Ambient backdrop intensity: ramps with the Word Bomb turn timer so the whole
  // screen reacts to the danger level. Resting 'calm' on every other screen.
  let bgIntensity = 'calm';
  if (renderedView === 'game' && gameType === 'word-bomb' && !gameOver && gameState) {
    const maxT = gameState.timerSeconds || 1;
    const ratio = Math.max(0, Math.min(1, timerSeconds / maxT));
    bgIntensity = ratio > 0.6 ? 'calm' : ratio >= 0.3 ? 'warning' : 'critical';
  }

  // Before the socket is up, gate the whole app behind the connecting / failed
  // loading screen (the WallScene still shows behind it). RETRY just reloads to
  // re-attempt the connection.
  if (wsStatus === 'connecting' || wsStatus === 'error') {
    return (
      <>
        <WallScene intensity="calm" />
        <LoadingScreen status={wsStatus} onRetry={() => window.location.reload()} />
        <MusicButton isMuted={music.isMuted} onToggle={music.toggleMute} accent="#FF2EC4" />
      </>
    );
  }

  // `key={renderedView}` remounts the wrapper only on an actual (committed) view
  // change, so screen-mount effects (e.g. the in-game 3-2-1 countdown) replay
  // then. The WallScene + TransitionOverlay live OUTSIDE that keyed wrapper so
  // the backdrop persists and the wipe plays over the swap.
  return (
    <>
      <WallScene intensity={bgIntensity} />
      <div className="view-transition-root">
        <div key={renderedView} className="view-screen">
          {screen}
        </div>
      </div>
      {transition && <TransitionOverlay key={transition.key} word={transition.word} />}
      <MusicButton
        isMuted={music.isMuted}
        onToggle={music.toggleMute}
        accent={SCREEN_ACCENT[renderedView] || '#FF2EC4'}
      />
    </>
  );
}

export default App;