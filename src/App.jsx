// App.jsx
import { useState, useEffect, useRef, useMemo } from 'react';
import Homepage from './components/Homepage';
import LobbyScreen from './components/LobbyScreen';
import RoomScreen from './components/RoomScreen';
import GameScreen from './components/GameScreen';
import WallScene from './components/WallScene';
import TransitionOverlay from './components/TransitionOverlay';
import LoadingScreen from './components/LoadingScreen';
import MusicButton from './components/MusicButton';
import CreditsScreen from './components/CreditsScreen';
import SplashScreen from './components/SplashScreen';
import TransitionIntro from './components/TransitionIntro';
import ParticleField from './components/ParticleField';
import CursorTrail from './components/CursorTrail';
import { useWebSocket } from './hooks/useWebSocket';
import { useMusicPlayer } from './hooks/useMusicPlayer';
import { useBeatSync } from './hooks/useBeatSync';
import { useSoundEffects } from './hooks/useSoundEffects';
import { SoundContext } from './contexts/SoundContext';
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

  // Spectator reactions (Word Bomb): transient floating emoji popups relayed
  // from eliminated players. Each entry { id, emoji, playerName }; auto-removed
  // 2s after it arrives. id is a monotonic counter (stable React key).
  const [reactions, setReactions] = useState([]);
  const reactionIdRef = useRef(0);

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

  // Imposter Word state (social deduction, three phases per round). round_start
  // is shared with Category Blitz, so it's disambiguated by the imposter-only
  // `phase`/`isImposter` fields on the payload.
  //   imposterRound   - { round, totalRounds, category, isImposter, players }
  //   imposterPhase   - 'answering' | 'voting' | 'reveal' | 'finished'
  //   imposterAnswers - live { playerId, playerName, answer } feed (this is how
  //                     the imposter reverse-engineers the category), reset/round
  //   imposterVoteData- { answers: [{playerId,playerName,answers}], players }
  //   imposterVoteCount-{ voted, total } progress (never reveals who voted whom)
  //   imposterMyVote  - the suspectId I locked in (optimistic), or null
  //   imposterResults - the vote_results reveal payload for the current round
  //   imposterFinal   - the game_over payload (final scores + award stats)
  const [imposterRound, setImposterRound] = useState(null);
  const [imposterPhase, setImposterPhase] = useState(null);
  const [imposterAnswers, setImposterAnswers] = useState([]);
  const [imposterVoteData, setImposterVoteData] = useState(null);
  const [imposterVoteCount, setImposterVoteCount] = useState({ voted: 0, total: 0 });
  const [imposterMyVote, setImposterMyVote] = useState(null);
  const [imposterResults, setImposterResults] = useState(null);
  const [imposterFinal, setImposterFinal] = useState(null);

  const { status: wsStatus, lastMessage, send } = useWebSocket();

  // Background music. It's started from the splash dismiss (the guaranteed first
  // user gesture), so no autoplay attempt here - just the player + a fade-in.
  const music = useMusicPlayer();

  // App-wide synthesized sound effects + a single global SFX mute. Created once
  // here and handed to every screen via SoundContext, so e.g. muting in the game
  // persists back on the homepage. Separate from the music mute (MusicButton).
  // The AudioContext is unlocked on the splash click (handleSplashStart).
  const [sfxMuted, setSfxMuted] = useState(false);
  const sound = useSoundEffects(sfxMuted);
  const soundValue = useMemo(
    () => ({ sound, muted: sfxMuted, setMuted: setSfxMuted }),
    [sound, sfxMuted]
  );

  // The splash/attract screen is the very first thing shown and only shows once
  // per session (dismissing it never re-arms it).
  const [showSplash, setShowSplash] = useState(true);
  // After the splash is dismissed we play the anime fight-card intro (TYPE FAST.
  // / DIE SLOW.) before wiping to the homepage. Shown once, between the two.
  const [showIntro, setShowIntro] = useState(false);

  // Beat sync: while music is audibly playing, drive global --beat-* CSS vars
  // (and the data-beat attribute) off the live frequency analysis so animations
  // pulse with the track. beatCount increments per detected beat, which we use
  // to fire a light app-wide shake.
  const { beatCount } = useBeatSync(
    music.getFrequencyData,
    music.isPlaying && !music.isMuted
  );

  // App-wide screen shake at three intensities (light=beat, medium=accept,
  // heavy=explosion/game over). A class on the top-level wrapper; cleared after
  // the shake duration so it can replay.
  const [shake, setShake] = useState(null);
  const shakeTimerRef = useRef(null);
  const SHAKE_MS = { light: 100, medium: 200, heavy: 300 };
  function triggerShake(level) {
    if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
    setShake(level);
    shakeTimerRef.current = setTimeout(
      () => setShake(null),
      SHAKE_MS[level] || 150
    );
  }
  // Light shake on every detected beat (skips the very first render).
  const prevBeatRef = useRef(0);
  useEffect(() => {
    if (beatCount > prevBeatRef.current) {
      prevBeatRef.current = beatCount;
      triggerShake('light');
    }
    // triggerShake is stable enough; we only react to beatCount changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beatCount]);

  useEffect(() => {
    if (!lastMessage) return;

    // TEMP debug: track message order vs the live view (remove after debugging).
    console.log('MSG:', lastMessage.type, 'current view:', view);

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
      if (view !== 'game') {
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
      setReactions([]);
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

    if (lastMessage.type === 'spectator_reaction') {
      const { emoji, playerName } = lastMessage.payload;
      const id = reactionIdRef.current++;
      setReactions((prev) => {
        const next = [...prev, { id, emoji, playerName }];
        // Cap at the 5 most recent so a flood can't pile up on screen.
        return next.length > 5 ? next.slice(next.length - 5) : next;
      });
      // Auto-remove this reaction after its float animation (2s).
      setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== id));
      }, 2000);
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
      // Imposter Word and Category Blitz share round_start; the imposter variant
      // carries a `phase`/`isImposter` field, so branch on that.
      if (payload.phase === 'answering' || typeof payload.isImposter !== 'undefined') {
        setImposterRound({
          round: payload.round,
          totalRounds: payload.totalRounds,
          category: payload.category,
          isImposter: !!payload.isImposter,
          players: payload.players || [],
          answerSeconds: payload.timerSeconds,
        });
        setImposterPhase('answering');
        setImposterAnswers([]);
        setImposterVoteData(null);
        setImposterVoteCount({ voted: 0, total: (payload.players || []).length });
        setImposterMyVote(null);
        setImposterResults(null);
        if (payload.round === 1) setImposterFinal(null); // fresh game
        setMyAnswers([]);
        setTimerSeconds(payload.timerSeconds);
        setLastWordResult(null);
        setGameOver(null);
        setView('game');
      } else {
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
    }

    // ---- Imposter Word relays ----

    // Every accepted answer is broadcast to everyone in real time.
    if (lastMessage.type === 'imposter_answer') {
      const { playerId, playerName, answer } = lastMessage.payload;
      setImposterAnswers((prev) => [...prev, { playerId, playerName, answer }]);
    }

    // Answering closed -> voting opens with all answers revealed.
    if (lastMessage.type === 'vote_phase_start') {
      const payload = lastMessage.payload;
      setImposterVoteData({
        answers: payload.answers || [],
        players: payload.players || [],
        voteSeconds: payload.timerSeconds,
      });
      setImposterPhase('voting');
      setImposterVoteCount({ voted: 0, total: (payload.players || []).length });
      setTimerSeconds(payload.timerSeconds);
      setLastWordResult(null);
    }

    // Live vote progress (counts only, never who-for-whom until the reveal).
    if (lastMessage.type === 'vote_count') {
      setImposterVoteCount(lastMessage.payload);
    }

    // My own vote bounced (e.g. voted for myself) - unlock so I can re-vote.
    if (lastMessage.type === 'vote_result') {
      if (!lastMessage.payload.accepted) setImposterMyVote(null);
    }

    // The reveal.
    if (lastMessage.type === 'vote_results') {
      setImposterResults(lastMessage.payload);
      setImposterPhase('reveal');
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
      // Imposter Word and Category Blitz both carry finalScores, so check the
      // explicit gameType first; Word Bomb carries just winnerId.
      if (payload.gameType === 'imposter-word') {
        setImposterFinal(payload);
        setImposterPhase('finished');
      } else if (payload.finalScores) {
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
    // `view` is read above but intentionally NOT a dependency: adding it would
    // re-run this effect (re-processing the last message) on every view change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    sound.whoosh(); // the diagonal bars sweep in
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
      sound.whoosh(); // the bars sweep (no-op if audio isn't unlocked yet)
      const end = setTimeout(() => setTransition(null), 500);
      return () => clearTimeout(end);
    }
  }, [wsStatus]);

  // Splash: unlock audio + start the music silently within the click gesture.
  // This click is the browser's autoplay-unlock gesture, so it's where we create
  // the SFX AudioContext too; the dismiss itself lands with a punch.
  function handleSplashStart() {
    music.setVolume(0);
    music.play();
    sound.unlock();
    sound.punch();
  }

  // Splash dismissed: hand off to the anime fight-card intro sequence (it covers
  // the screen black, so there's no flash of homepage underneath). The intro
  // calls handleIntroComplete when it's done. Music is already playing silently
  // (started in handleSplashStart on the click); it's faded up once we wipe in.
  function handleSplashDismiss() {
    setShowSplash(false);
    setShowIntro(true);
  }

  // Intro finished: drop the overlay, run the Persona-5 bar wipe down to the
  // homepage, and fade the music up DURING the wipe.
  function handleIntroComplete() {
    setShowIntro(false);
    transitionKeyRef.current += 1;
    setTransition({ word: 'TYPE A WORD', key: transitionKeyRef.current });
    sound.whoosh(); // the bar wipe down to the homepage
    setTimeout(() => setTransition(null), 500);
    music.fadeTo(0.3, 500);
  }

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
    setReactions([]);
    setImposterRound(null);
    setImposterPhase(null);
    setImposterAnswers([]);
    setImposterVoteData(null);
    setImposterVoteCount({ voted: 0, total: 0 });
    setImposterMyVote(null);
    setImposterResults(null);
    setImposterFinal(null);
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

  // Imposter Word: vote for who the imposter is. Lock the choice locally
  // (optimistic) so the UI shows "VOTED" immediately; the server confirms via
  // vote_result and unlocks again only if it bounces (e.g. self-vote).
  function handleSubmitVote(suspectId) {
    setImposterMyVote(suspectId);
    send('submit_vote', { suspectId });
  }

  function handleSkipTurn() {
    send('skip_turn', {});
  }

  // Stream the active player's in-progress text to everyone else (Word Bomb).
  // Sent on every keystroke - no debounce, the live typing is the point.
  function handleTypingUpdate(text) {
    send('typing_update', { text });
  }

  // Eliminated spectators fire emoji reactions the server relays to everyone.
  function handleSpectatorReaction(emoji) {
    send('spectator_reaction', { emoji });
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
        imposterRound={imposterRound}
        imposterPhase={imposterPhase}
        imposterAnswers={imposterAnswers}
        imposterVoteData={imposterVoteData}
        imposterVoteCount={imposterVoteCount}
        imposterMyVote={imposterMyVote}
        imposterResults={imposterResults}
        imposterFinal={imposterFinal}
        onSubmitWord={handleSubmitWord}
        onSubmitAnswer={handleSubmitAnswer}
        onSubmitVote={handleSubmitVote}
        onSkipTurn={handleSkipTurn}
        onTypingUpdate={handleTypingUpdate}
        onLeave={handleLeaveRoom}
        onRematch={handleRematch}
        musicSetVolume={music.setVolume}
        reactions={reactions}
        onSpectatorReaction={handleSpectatorReaction}
        onShake={triggerShake}
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

  // The attract/splash screen is the very first thing shown (over the wall +
  // particles). It connects in the background; clicking it starts everything.
  if (showSplash) {
    return (
      <>
        <WallScene intensity="calm" />
        <ParticleField />
        <SplashScreen onStart={handleSplashStart} onDismiss={handleSplashDismiss} />
        <CursorTrail />
      </>
    );
  }

  // The anime fight-card intro plays over a black overlay between the splash and
  // the homepage; when it finishes it wipes down to the homepage.
  if (showIntro) {
    return (
      <SoundContext.Provider value={soundValue}>
        <WallScene intensity="calm" />
        <ParticleField />
        <TransitionIntro onComplete={handleIntroComplete} />
        <CursorTrail />
      </SoundContext.Provider>
    );
  }

  // Before the socket is up, gate the whole app behind the connecting / failed
  // loading screen (the WallScene still shows behind it). RETRY just reloads to
  // re-attempt the connection.
  if (wsStatus === 'connecting' || wsStatus === 'error') {
    return (
      <>
        <WallScene intensity="calm" />
        <ParticleField />
        <LoadingScreen status={wsStatus} onRetry={() => window.location.reload()} />
        <MusicButton isMuted={music.isMuted} onToggle={music.toggleMute} accent="#FF2EC4" />
        <CursorTrail />
      </>
    );
  }

  // `key={renderedView}` remounts the wrapper only on an actual (committed) view
  // change, so screen-mount effects (e.g. the in-game 3-2-1 countdown) replay
  // then. The WallScene + TransitionOverlay live OUTSIDE that keyed wrapper so
  // the backdrop persists and the wipe plays over the swap.
  return (
    // .app-viewport is fixed + overflow:hidden so it clips the shake to the
    // viewport (no scrollbars can ever appear from the shake). The inner
    // .app-shake is the actual scroll container (overflow-y:auto) AND the
    // element the intensity-graded shake (light=beat / medium=accept /
    // heavy=explosion) is applied to - shaking it just moves it within the
    // clipping outer box, while normal vertical scrolling still works.
    <SoundContext.Provider value={soundValue}>
    <div className="app-viewport">
      <div className={`app-shake${shake ? ` shake-${shake}` : ''}`}>
        <WallScene intensity={bgIntensity} />
        <ParticleField />
        <div className="view-transition-root">
          <div key={renderedView} className="view-screen">
            {screen}
          </div>
        </div>
        {transition && <TransitionOverlay key={transition.key} word={transition.word} />}
        {/* Whole-viewport beat flash (subtlest effect): a single always-present
            div that briefly flashes a palette colour on each beat (colour set by
            useBeatSync via --flash-color). Click-through, below modals. */}
        <div className="screen-flash" aria-hidden="true" />
        <MusicButton
          isMuted={music.isMuted}
          onToggle={music.toggleMute}
          accent={SCREEN_ACCENT[renderedView] || '#FF2EC4'}
        />
      </div>
      {/* Cursor trail sits outside .app-shake so the screen shake never moves
          it, and above everything (z 9999). */}
      <CursorTrail />
    </div>
    </SoundContext.Provider>
  );
}

export default App;