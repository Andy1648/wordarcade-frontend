// App.jsx
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Homepage from './components/Homepage';
import LobbyScreen from './components/LobbyScreen';
import PublicRoomsScreen from './components/PublicRoomsScreen';
import RoomScreen from './components/RoomScreen';
import GameScreen from './components/GameScreen';
import WallScene from './components/WallScene';
import TransitionOverlay from './components/TransitionOverlay';
import LoadingScreen from './components/LoadingScreen';
import MusicButton from './components/MusicButton';
import CreditsScreen from './components/CreditsScreen';
import SplashScreen from './components/SplashScreen';
import TransitionIntro from './components/TransitionIntro';
import KnifeSplit from './components/KnifeSplit';
import Mascot from './components/Mascot';
import ParticleField from './components/ParticleField';
import CursorTrail from './components/CursorTrail';
import PACKS from './data/packs';
import { useWebSocket } from './hooks/useWebSocket';
import { useMusicPlayer } from './hooks/useMusicPlayer';
import { useBeatSync } from './hooks/useBeatSync';
import { useSoundEffects } from './hooks/useSoundEffects';
import { SoundContext } from './contexts/SoundContext';
import { buildPlayerColors } from './playerColors';
import { resolvePlayerName, rememberName } from './playerName';
import {
  hasSeenIntro,
  markIntroSeen,
  hasPlayedBefore,
  markPlayed,
} from './visitHistory';
import {
  loadDailyState,
  saveDailyState,
  recordDailyResult,
  hasPlayedDay,
  currentDayNumber,
  displayStreak,
} from './daily/streak.js';
import { friendlyError } from './friendlyError';
import { useOneShotAction } from './hooks/useOneShotAction';
import { track } from './lib/analytics';
import { squash, sfx, setMuted as setJuiceMuted } from './juice';

// Server frames that RESOLVE a one-shot action (an ack, a state change, or a
// rejection). Draining any of these bumps `serverEventId`, which re-enables the
// useOneShotAction button guards. Deliberately EXCLUDES high-frequency in-game
// frames (timer_tick, typing_update, etc.) so e.g. an in-flight reroll guard is
// not cleared early by an unrelated tick.
const RESOLVING_TYPES = new Set([
  'room_update',
  'game_reset',
  'game_started',
  'round_start',
  'error',
]);
import { Analytics } from '@vercel/analytics/react';
import './Transitions.css';

// Kill-feed flavor lines shown when a player is eliminated (their last life is
// lost). `{player}` is replaced with the eliminated player's name. FNF/Newgrounds
// voice, curated from the content review pile.
const KILL_FEED_LINES = [
  '{player} CHOKED.',
  '{player} ran out of words.',
  '{player} got DELETED.',
  'The bomb chose {player}.',
  '{player} forgot how to read.',
  '{player} typed nothing. bold strategy.',
  '{player} got cooked.',
  '{player} fumbled the bag.',
  '{player} ran out of time AND talent.',
  '{player} blew up. literally.',
  "{player}'s brain buffered.",
  '{player} got left on read by the dictionary.',
  '{player} is no longer with us.',
  '{player} rage quit (mentally).',
  "{player} couldn't spell their way out.",
  '{player} got bodied by the alphabet.',
  '{player} typed like the wifi was lagging.',
  '{player} let the clock cook them.',
  '{player} sent it. it did not send.',
  '{player} took an L in real time.',
  '{player} spelled it wrong. tragic.',
  '{player} hit submit on nothing.',
  '{player} blinked and it was over.',
  '{player} got outspelled by a 7th grader.',
  '{player} panicked and froze.',
  "{player}'s autocorrect betrayed them.",
  '{player} ran the clock all the way down.',
  '{player} brought a knife to a word fight.',
  '{player} got ratioed by the dictionary.',
  '{player} typed three letters and gave up.',
  '{player} got speedrun out of the game.',
  '{player} ghosted their own turn.',
  '{player} forgot words exist.',
  '{player} got humbled by a vowel.',
  '{player} folded under pressure.',
  '{player} lagged out of relevance.',
  '{player} pressed enter and prayed. it failed.',
  '{player} got benched by a bomb.',
];

// The music button's border/glyph colour, matched to each screen's accent.
const SCREEN_ACCENT = {
  home: '#FF2EC4',
  lobby: '#2EFFE0',
  browse: '#2EFFE0',
  room: '#FFE94A',
  game: '#FF6B3D',
  credits: '#9A1AFF',
};

// The word flashed mid-wipe when navigating to each view.
const TRANSITION_WORDS = {
  game: "LET'S GO!",
  home: 'PEACE OUT',
  lobby: 'READY?',
  browse: 'JOIN ROOM',
  room: 'SQUAD UP',
  credits: 'CREDITS',
};

// The lobby "mode" can be a generic entry ('solo' for Create Room, 'join'
// for Join Room) or a specific game id picked from a homepage card. These are
// the real backend game types we can lock the room into and preselect; any
// other card would fall back to the in-room mode picker (and default Word Bomb).
const PRESELECTABLE_GAMES = ['word-bomb', 'category-blitz', 'imposter-word'];

function isPreselectableGame(mode) {
  return PRESELECTABLE_GAMES.includes(mode);
}

// Portal embed (itch.io / Newgrounds / CrazyGames iframe): land straight on the
// MENU, skipping the intro chain (loading → splash → fight-card intro → knife-
// split). Gated so the DEFAULT build is byte-for-byte unchanged — it only flips
// on for a portal build (VITE_PORTAL='1', set by `npm run build:portal`) or an
// explicit ?portal=1 query param. With neither, the full intro plays as today.
const PORTAL_SKIP_INTRO =
  import.meta.env.VITE_PORTAL === '1' ||
  (typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('portal') === '1');

// Deep links (the invite loop): ?join=CODE drops a friend straight into that
// room — no name prompt (remembered/generated handle), no lobby stops; ?daily=1
// goes straight into today's Daily Challenge. Both skip the intro chain: a
// friend tapping a group-chat link should land IN the game, not on a splash.
// Read once at module load (same pattern as PORTAL_SKIP_INTRO).
const LAUNCH_INTENT = (() => {
  if (typeof window === 'undefined') return { join: null, daily: false };
  const params = new URLSearchParams(window.location.search);
  const join = (params.get('join') || '').trim().toUpperCase();
  return { join: join || null, daily: params.get('daily') === '1' };
})();

// Any launch intent (portal embed, invite link, daily link) skips the intro.
const SKIP_INTRO = PORTAL_SKIP_INTRO || !!LAUNCH_INTENT.join || LAUNCH_INTENT.daily;

// Repeat visitors have already seen the SQUAD-UP / "TYPE FAST. DIE SLOW." intro,
// so we skip those two animations for them (the loading screen still plays).
// Read once at module load, alongside the flags above. The flag is written when
// the intro finishes on a first visit (handleIntroComplete).
const SEEN_INTRO = hasSeenIntro();

/**
 * Top-level view state manager + the single shared WebSocket connection
 * for the whole app.
 */
function App() {
  const [view, setView] = useState('home');
  // The screen always renders off the live `view` (no lagging copy), so a view
  // change shows immediately and can never be stranded behind a timer. The
  // diagonal-bar wipe is a PURELY COSMETIC overlay that animates on top during
  // the swap and fades out. `transition` is the active overlay ({ word, key }) or
  // null; the key re-keys the overlay so each wipe replays.
  const [transition, setTransition] = useState(null);
  const transitionKeyRef = useRef(0);
  const [lobbyMode, setLobbyMode] = useState(null);
  // Whether the create lobby should default to PUBLIC (set when arriving via the
  // browser's "create public room" button); normal Create Room stays private.
  const [lobbyPublicDefault, setLobbyPublicDefault] = useState(false);
  const [room, setRoom] = useState(null);
  // Category Blitz pack selection, LIFTED to App so the choice made in the Blitz
  // ModeDialog survives the dialog and is sent as set_packs on the create/host path.
  // Defaults to all packs on; the toggle blocks removing the last one (≥1 stays).
  const [blitzPacks, setBlitzPacks] = useState(() => PACKS.map((p) => p.id));
  const handleToggleBlitzPack = useCallback((id) => {
    setBlitzPacks((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev; // keep at least one pack selected
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  }, []);
  // SELECT ALL / CLEAR for the Blitz pack-picker. CLEAR intentionally leaves ONE
  // pack (not zero), preserving the "keep ≥1" invariant the toggle also enforces.
  const handleSetAllBlitzPacks = useCallback((all) => {
    setBlitzPacks(all ? PACKS.map((p) => p.id) : PACKS.slice(0, 1).map((p) => p.id));
  }, []);
  // Public-room browser: the latest list from `public_rooms`, plus the player
  // name used by the no-prompt flows (Quick Play / tap-to-join). Seeded from the
  // remembered/generated name so those flows never need a name screen.
  const [publicRooms, setPublicRooms] = useState([]);
  const [playerName, setPlayerNameState] = useState(() => resolvePlayerName());
  // Set the working name AND persist it, so it carries across Quick Play, the
  // browser, and the Create/Join lobby within and across sessions.
  function setPlayerName(next) {
    setPlayerNameState(next);
    rememberName(next);
  }
  // Per-player session colours, derived from the room roster's join order and
  // keyed by stable player id. Built once per roster change and passed to every
  // screen so a player wears the same colour in the room, the player bar, the
  // kill feed and the stats. See playerColors.js.
  const playerColors = useMemo(
    () => buildPlayerColors(room ? room.players : []),
    [room]
  );
  const [serverError, setServerError] = useState('');
  // Set when the SERVER closed our room (idle reap, or an internal error the
  // backend contained to this one room). Drives the blocking ROOM CLOSED
  // overlay below: the room is already gone server-side, so surfacing it with
  // a route home is the only alternative to a frozen lobby.
  const [roomClosedNotice, setRoomClosedNotice] = useState(null);
  // Monotonic counter bumped on every RESOLVING server frame (see RESOLVING_TYPES).
  // It is the fresh re-enable signal for the one-shot action guards below — a
  // counter, not a string, so an identical repeated error still re-enables them.
  const [serverEventId, setServerEventId] = useState(0);

  // One reused guard per one-shot action (see useOneShotAction). Each disables its
  // button on click, fires the send exactly once, and re-enables on the next
  // serverEventId bump (ack/error) or a safety-timeout backstop. add_bot/remove_bot
  // share one guard (mutually exclusive); rematch + solo play-again share one too.
  const [startPending, fireStart] = useOneShotAction(serverEventId);
  const [diffPending, fireDiff] = useOneShotAction(serverEventId);
  const [botPending, fireBot] = useOneShotAction(serverEventId);
  const [rematchPending, fireRematch] = useOneShotAction(serverEventId);
  const [rerollPending, fireReroll] = useOneShotAction(serverEventId);
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
  // Category Blitz: the answer currently being judged by the AI fallback. Set when
  // an `answer_checking` frame arrives (the server is calling Haiku on a list-miss)
  // and cleared the instant the `answer_result` lands - drives a brief "checking…"
  // indicator on the input. Null whenever nothing is mid-check (the common instant
  // accept-list path never sends answer_checking, so this stays null there).
  const [checkingAnswer, setCheckingAnswer] = useState(null);
  const [gameOver, setGameOver] = useState(null);
  // Which mode the in-progress game is - 'word-bomb' | 'category-blitz'.
  // Learned authoritatively from the game_started message so GameScreen
  // knows which prompt/fields to render.
  const [gameType, setGameType] = useState('word-bomb');
  // Bumped on every game_started. Used as a remount key for the Category Blitz
  // screen so the solo "PLAY AGAIN" loop (which fires a brand new game without
  // ever leaving the game view) gets a clean slate and replays its 3-2-1
  // countdown - the round number stays 1 across solo games, so the screen can't
  // detect a new game from the round number alone.
  const [gameNonce, setGameNonce] = useState(0);

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
  //   categoryRerolls - category rerolls remaining this game (from round_start,
  //                     which also carries reroll restarts); drives the in-game
  //                     NEW CATEGORY button.
  //   lastReroll      - the most recent reroll event { by, byId, key } (set when
  //                     a round_start arrives flagged reroll:true), so non-host
  //                     clients can flash a "host rerolled" notice. key (a
  //                     monotonic counter) re-fires the notice each time.
  const [categoryRerolls, setCategoryRerolls] = useState(null);
  const [lastReroll, setLastReroll] = useState(null);
  const rerollKeyRef = useRef(0);

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

  // ---- Daily Challenge (solo Category Blitz on the server's date-seeded board) ----
  // dailyState: the persisted streak history (localStorage). dailyResult: the
  // just-finished daily's { dayNumber, streak, bestStreak, score } for the
  // results screen + share text; null while no completed daily is on screen.
  // dailyStateRef mirrors dailyState for the WS drain effect (keyed only on
  // [messages], so reading the state there would be stale — same pattern as
  // playerCountRef below).
  const [dailyState, setDailyState] = useState(() => loadDailyState());
  const [dailyResult, setDailyResult] = useState(null);
  const dailyStateRef = useRef(dailyState);
  useEffect(() => {
    dailyStateRef.current = dailyState;
  }, [dailyState]);
  const myIdRef = useRef(null);

  // Invite-link arrival: true from load until the ?join= room answers (join
  // lands -> room_update, or fails -> error). Drives the JOINING ROOM banner
  // so a cold backend (30-60s Render spin-up) doesn't read as a dead link.
  const [linkJoinPending, setLinkJoinPending] = useState(!!LAUNCH_INTENT.join);

  // Reconnect gate for useWebSocket. Auto-reconnect is allowed ONLY outside an
  // active session: the backend treats every connection as a fresh player (new
  // id, no resume), so a silent reconnect mid room/game would NOT restore the
  // lost seat - we surface the drop instead (see the CONNECTION LOST overlay).
  // The hook reads this ref on close/error; we keep it in sync below.
  const canReconnectRef = useRef(true);
  const { status: wsStatus, messages, consumeMessages, send } = useWebSocket(canReconnectRef);

  // An "active session" = the player holds a server-side seat: the waiting room
  // or a live game (NOT the menu/lobby/public browser, and NOT the post-game
  // results, where a fresh connection is fine). A socket drop here can't be
  // silently resumed, so we block reconnect and surface it instead.
  const inActiveSession = view === 'room' || (view === 'game' && !gameOver);
  useEffect(() => {
    canReconnectRef.current = !inActiveSession;
  }, [inActiveSession]);

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

  // The bomb-fuse loading screen is the very first thing shown; it holds until
  // the socket connects (then "explodes" and hands off), at which point the
  // splash takes over. `loadingDone` flips true once that explosion finishes.
  // In a portal embed — and on ?join= / ?daily= deep links — we skip straight
  // to the menu, so the loading screen is pre-completed (the socket still
  // connects in the background via useWebSocket).
  const [loadingDone, setLoadingDone] = useState(SKIP_INTRO);

  // The splash/attract screen is shown after loading, once per session
  // (dismissing it never re-arms it). Portal embeds and deep links skip it, and
  // so do repeat visitors (SEEN_INTRO) — they go loading -> menu with no splash
  // or fight-card intro.
  const [showSplash, setShowSplash] = useState(!SKIP_INTRO && !SEEN_INTRO);
  // After the splash is dismissed we play the anime fight-card intro (TYPE FAST.
  // / DIE SLOW.) before wiping to the homepage. Shown once, between the two.
  const [showIntro, setShowIntro] = useState(false);
  // The intro -> menu KNIFE-SPLIT reveal (replaces the old explosion): true while
  // the blade-slice overlay plays over the freshly-mounted menu. Cosmetic only.
  const [slicing, setSlicing] = useState(false);
  const sliceTimerRef = useRef(null);

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
  // Light shake on every detected beat — IN-GAME ONLY. The ambient whole-screen
  // beat-shake made the menu/lobby feel busy and laggy (it transforms the entire
  // app tree on every drum hit), so it's now gated to the game view; the menu
  // stays calm. `view` is in the deps so the guard reads the live view, not a
  // stale closure (a view change alone never has a new beat, so it won't shake).
  const prevBeatRef = useRef(0);
  useEffect(() => {
    if (beatCount > prevBeatRef.current) {
      prevBeatRef.current = beatCount;
      if (view === 'game') triggerShake('light');
    }
    // triggerShake is stable enough; we react to beatCount (and read live view).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beatCount, view]);

  // The connection dropped WHILE in an active room/game. The seat is gone
  // server-side (no resume), so we don't auto-reconnect or reload - we show a
  // blocking overlay (rendered at the bottom) whose only exit is BACK TO MENU.
  // Outside a session a drop reconnects transparently, so no overlay. Computed
  // up here (not at the render site) so the drama effect below can watch it.
  const connectionLost =
    inActiveSession && (wsStatus === 'closed' || wsStatus === 'error');

  // Losing your seat should FEEL like a knockout, not a dialog: one defeat
  // sting + a heavy jolt the moment the drop is detected (once per drop; the
  // overlay's own slam-in animation lands with it).
  const prevConnLostRef = useRef(false);
  useEffect(() => {
    if (connectionLost && !prevConnLostRef.current) {
      sound.defeat();
      triggerShake('heavy');
    }
    prevConnLostRef.current = connectionLost;
    // sound is stable (apiRef); triggerShake is a hoisted stable helper.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionLost]);

  // Reflect the live view on <html> so view-gated background VISUALS can react in
  // pure CSS without threading `view` into every ambient layer. Used to switch the
  // whole-viewport beat FLASH off on the in-game play screen (it strobes behind
  // text players read fast = a readability + photosensitivity problem); it stays
  // on the menu/lobby as energy. Compounds with prefers-reduced-motion, never
  // bypasses it. Purely cosmetic — no WS/game logic.
  useEffect(() => {
    document.documentElement.setAttribute('data-view', view);
  }, [view]);

  // Subtle hover blip on any real <button>, app-wide (Lobby / Room / game UI),
  // via one delegated listener so we don't touch every button. The Homepage game
  // cards are <div role="button">, so they're NOT matched here and keep their own
  // per-card hover. De-duped per element (no re-fire while moving within a button)
  // and time-debounced so sweeping the pointer across a row doesn't machine-gun.
  useEffect(() => {
    let lastBtn = null;
    let lastAt = 0;
    const onOver = (e) => {
      const btn = e.target.closest ? e.target.closest('button') : null;
      if (!btn || btn === lastBtn || btn.disabled) return;
      lastBtn = btn;
      const t = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (t - lastAt < 70) return; // debounce
      lastAt = t;
      sound.menuHover();
    };
    const onOut = (e) => {
      // Only re-arm once the pointer truly LEAVES the button (not when it crosses
      // between the button's own children), so a child boundary can't re-trigger.
      if (lastBtn && !(e.relatedTarget && lastBtn.contains(e.relatedTarget))) {
        lastBtn = null;
      }
    };
    document.addEventListener('pointerover', onOver);
    document.addEventListener('pointerout', onOut);
    return () => {
      document.removeEventListener('pointerover', onOver);
      document.removeEventListener('pointerout', onOut);
    };
  }, [sound]);

  // ---- Analytics bookkeeping (fire-and-forget; never affects gameplay) ----
  // The WS drain effect below is keyed only on [messages], so reading `room` /
  // `gameStats` STATE directly inside it would be STALE. We mirror the few values
  // game_completed needs into refs (always live) so the capture is accurate
  // without making the drain effect depend on them.
  const gameStartMsRef = useRef(null); // wall-clock ms when the current game started
  const gameModeRef = useRef(null); // gameType of the current game (from game_started)
  const playerCountRef = useRef(0); // live roster size, synced from room below
  useEffect(() => {
    playerCountRef.current = room?.players?.length || 0;
  }, [room]);

  // ---- Shared game-feel ("juice") wiring (Tier 2; never blocks input) ----
  // Keep the juice layer's sound flag synced to the app-wide SFX mute on EVERY
  // screen (the menu synced it too, but this covers lobby/game/results), so muting
  // in-game also silences the press ticks + word-accept sparks.
  useEffect(() => {
    setJuiceMuted(sfxMuted);
  }, [sfxMuted]);

  // ONE shared press-feedback handler for EVERY <button> in the app (menu, lobby,
  // game, results): a light squash + tick on press, matching the CREATE/JOIN proof.
  // Delegated at the document in the CAPTURE phase so it covers every screen with
  // zero per-button wiring and fires even if a handler stops propagation. Buttons
  // that run their own bespoke juice (CREATE/JOIN) opt out via [data-juice-self] so
  // they never double-fire. squash() + sfx() self-gate on reduced-motion + mute
  // inside the toolkit and neither blocks nor awaits, so the type loop is untouched.
  useEffect(() => {
    function onPointerDown(e) {
      const btn = e.target?.closest?.('button');
      if (!btn || btn.disabled) return;
      if (btn.hasAttribute('data-juice-self')) return; // owns its own juice
      squash(btn);
      sfx('tap');
    }
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, []);

  useEffect(() => {
    if (!messages.length) return;
    // Drain the FIFO queue in arrival order so co-arriving frames (e.g.
    // game_started immediately followed by room_update) are EACH processed -
    // batched delivery can no longer collapse them into just the latest one.
    // (Body left at its original indent so the fix reads as a pure wrapper.)
    let sawResolving = false;
    for (const lastMessage of messages) {
    if (!lastMessage) continue;
    // Track whether this drain carried any action-resolving frame, so we bump the
    // one-shot guard signal exactly once below (even if several arrive together).
    if (RESOLVING_TYPES.has(lastMessage.type)) sawResolving = true;

    if (lastMessage.type === 'connected') {
      setMyId(lastMessage.payload.id);
      myIdRef.current = lastMessage.payload.id; // live copy for this drain effect
    }

    // Public-room browser list refresh (response to list_public_rooms).
    if (lastMessage.type === 'public_rooms') {
      setPublicRooms(lastMessage.payload.rooms || []);
    }

    if (lastMessage.type === 'room_update') {
      setRoom(lastMessage.payload);
      setServerError('');
      setLinkJoinPending(false); // invite-link join answered (we're in)
      // Only fall back to the room view if we're not currently in a game. A
      // room_update can land right after game_started (host start) and would
      // otherwise yank the player back out of the match. The rematch flow sends
      // an explicit game_reset to drive the game -> room transition instead.
      // Functional update so we read the LIVE view, not the stale `view` captured
      // in this effect's closure (the effect is keyed only on [lastMessage]).
      setView((prev) => (prev === 'game' ? prev : 'room'));
    }

    if (lastMessage.type === 'game_reset') {
      // Host rematch: the room data already arrived via room_update; this is
      // the explicit cue to leave the game view and return to the lobby.
      setView('room');
    }

    // The server closed the room out from under us (idle reap, or an internal
    // error the backend contained to this room). There is no seat to return
    // to, so surface a blocking notice whose only exit is the menu - the
    // alternative is a lobby that silently stopped responding.
    if (lastMessage.type === 'room_closed') {
      setRoomClosedNotice(
        lastMessage.payload?.reason === 'server_error'
          ? 'THE SERVER HIT A GLITCH AND CLOSED THIS ROOM. GRAB A FRESH ONE.'
          : 'THIS ROOM SAT QUIET TOO LONG, SO THE SERVER SWEPT IT AWAY.'
      );
    }

    if (lastMessage.type === 'game_started') {
      setGameType(lastMessage.payload.gameType || 'word-bomb');
      setGameNonce((n) => n + 1);
      setCategoryRerolls(null);
      setLastReroll(null);
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
      // Daily Challenge: a fresh game clears any previous daily result; the
      // game_over handler below re-fills it if THIS game is a daily.
      setDailyResult(null);
      // Analytics: stamp start refs (read back at game_over for duration) and
      // capture the start. mode comes straight off the message (never stale).
      const startedMode = lastMessage.payload.gameType || 'word-bomb';
      gameModeRef.current = startedMode;
      gameStartMsRef.current = Date.now();
      // No longer a first-timer: future rooms default to CRAZY instead of CHILL.
      markPlayed();
      track('game_started', { mode: startedMode, daily: !!lastMessage.payload.daily });
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
          lostPlayers.push({ id: p.id, name: p.name, lives: p.lives });
        }
      });
      feedPrevLivesRef.current = Object.fromEntries(
        players.map((p) => [p.id, p.lives])
      );
      feedReasonRef.current = null;
      if (lostPlayers.length) {
        const now = Date.now();
        setFeedEvents((prev) => {
          const next = [
            ...prev,
            ...lostPlayers.map((p) => ({
              type: reason,
              playerId: p.id,
              playerName: p.name,
              timestamp: now,
            })),
          ];
          // Anyone who hit 0 lives is eliminated: add a flavor kill-feed line
          // right after their life-loss row.
          lostPlayers
            .filter((p) => typeof p.lives === 'number' && p.lives <= 0)
            .forEach((p) => {
              const line = KILL_FEED_LINES[
                Math.floor(Math.random() * KILL_FEED_LINES.length)
              ].replace('{player}', p.name);
              next.push({
                type: 'eliminated',
                playerId: p.id,
                playerName: p.name,
                message: line,
                timestamp: now,
              });
            });
          return next;
        });
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
            playerId: submitter.id,
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
            playerId: submitter.id,
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
        // Category Blitz round_start. This is the SINGLE path for both a normal
        // round and a host reroll (a server-authoritative round restart): either
        // way we clear answers/progress, take the server's category + full timer,
        // and update the reroll count. A reroll keeps the same round number (so
        // CategoryBlitzScreen doesn't replay the 3-2-1) and carries `reroll`/`by`
        // so non-host clients can flash the "host rerolled" notice.
        setCategoryRound(payload);
        setTimerSeconds(payload.timerSeconds);
        setCategoryRerolls(payload.rerollsRemaining ?? null);
        setMyAnswers([]);
        setPlayerProgress({});
        setRoundResults(null);
        setLastWordResult(null);
        setGameOver(null);
        setCategoryScores(null);
        if (payload.round === 1) setCategoryTotals({}); // fresh game
        if (payload.reroll) {
          setLastReroll({ by: payload.by, byId: payload.byId, key: rerollKeyRef.current++ });
        }
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

    // AI fallback is judging this answer (list-miss). Show the "checking…"
    // indicator until the authoritative answer_result lands.
    if (lastMessage.type === 'answer_checking') {
      setCheckingAnswer(lastMessage.payload?.answer ?? '');
    }

    if (lastMessage.type === 'answer_result') {
      const payload = lastMessage.payload;
      setCheckingAnswer(null); // result is in - drop the "checking…" state
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
      setCheckingAnswer(null); // drop any pending "checking…" if the round closed
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
      // Daily Challenge completed: fold the result into the persisted streak
      // history, keyed by the SERVER's dayNumber (never the local clock).
      // recordDailyResult is same-day-replay safe (streak counts a day once),
      // so a PLAY-AGAIN-then-finish can't double-increment.
      if (payload.daily && payload.finalScores) {
        const mine = payload.finalScores.find((s) => s.id === myIdRef.current);
        const next = recordDailyResult(
          dailyStateRef.current,
          payload.daily.dayNumber,
          mine ? mine.score : 0
        );
        saveDailyState(next);
        setDailyState(next);
        setDailyResult({
          dayNumber: payload.daily.dayNumber,
          streak: next.streak,
          bestStreak: next.bestStreak,
        });
      }
      // Stamp the end time so the overlay can show the game's duration.
      setGameStats((prev) => ({ ...prev, gameEndTime: Date.now() }));
      setView('game');
      // Analytics: counts/enums only (no PII). mode + duration come from refs
      // stamped at game_started; player_count from the room-synced ref — all live,
      // never stale. duration omitted if we somehow never saw a start.
      track('game_completed', {
        mode: gameModeRef.current || payload.gameType || 'word-bomb',
        player_count: playerCountRef.current,
        duration_seconds: gameStartMsRef.current
          ? Math.round((Date.now() - gameStartMsRef.current) / 1000)
          : null,
      });
    }

    if (lastMessage.type === 'error') {
      setServerError(friendlyError(lastMessage.payload.message));
      setLinkJoinPending(false); // if a link join was in flight, it just failed
      // A join that failed while we're still on the HOME screen (an invite
      // link to a full/ended/unknown room) must not dead-end invisibly: land
      // on the JOIN ROOM screen, which shows the error plus live public rooms
      // to hop into instead. Functional update — the live view, not the
      // closure's stale copy.
      if (lastMessage.payload.context === 'join_room') {
        setView((prev) => (prev === 'home' ? 'browse' : prev));
      }
    }
    } // end for-of: every queued frame handled in order
    // One fresh re-enable signal per drain that carried an ack/state-change/error.
    // A counter (never an error string) so an identical repeated error still
    // re-enables the one-shot button guards.
    if (sawResolving) setServerEventId((n) => n + 1);
    // Drop exactly the frames we just processed. The hook's consume is a
    // functional update, so any frame that arrived after this snapshot is kept,
    // never skipped.
    consumeMessages(messages.length);
    // Keyed on the queue: the effect re-runs whenever new frames land and drains
    // every one. It no longer reads `view` directly (the room_update guard uses a
    // functional setView), so [messages, consumeMessages] is the complete dep list.
  }, [messages, consumeMessages]);

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

  // ---- ONE consistent Persona-5 bar wipe for EVERY screen change ----
  // Every transition in the app is fired through this single helper, so they all
  // look and sound identical (same five bars, same whoosh, same 500ms): the
  // initial connect, menu->room, room->game, game->results, and back to menu.
  // The overlay (TransitionOverlay) is purely cosmetic - the screen has already
  // swapped underneath - so this only lays the bars on top and clears them.
  const transitionClearRef = useRef(null);
  const runTransition = useCallback(
    (word) => {
      transitionKeyRef.current += 1;
      setTransition({ word, key: transitionKeyRef.current });
      sound.whoosh(); // the diagonal bars sweep in
      if (transitionClearRef.current) clearTimeout(transitionClearRef.current);
      transitionClearRef.current = setTimeout(() => setTransition(null), 500);
    },
    [sound]
  );
  useEffect(
    () => () => {
      if (transitionClearRef.current) clearTimeout(transitionClearRef.current);
    },
    []
  );

  // Fire the wipe on every real view change. The screen has already swapped (it
  // renders off `view`); this only lays the overlay on top. The early-return
  // avoids a spurious wipe when `view` didn't actually change (initial mount /
  // no-op setState) - it can no longer strand the screen, since nothing gates the
  // screen behind it anymore.
  const lastNavViewRef = useRef('home');
  useEffect(() => {
    if (view === lastNavViewRef.current) return;
    lastNavViewRef.current = view;
    runTransition(TRANSITION_WORDS[view] || 'GO!');
  }, [view, runTransition]);

  // game -> results is an in-`game` change: the game-over overlay reveals WITHOUT
  // a view switch, so the view effect above never fires for it. Run the SAME wipe
  // here the moment results first appear, so the outcome screen arrives with the
  // identical transition as every other screen change. Purely cosmetic, fired
  // from App watching gameOver - it touches no game-screen logic.
  const prevGameOverRef = useRef(false);
  useEffect(() => {
    const now = !!gameOver;
    if (now && !prevGameOverRef.current) runTransition('RESULTS');
    prevGameOverRef.current = now;
  }, [gameOver, runTransition]);

  // Deep-link auto-fire: the moment the socket first opens, act on the launch
  // intent — join the invited room (?join=CODE) with the remembered/generated
  // name (zero prompts: tap link -> in the room), or start today's daily
  // (?daily=1). Once only; a later reconnect must not re-join/re-start.
  const launchFiredRef = useRef(false);
  useEffect(() => {
    if (wsStatus !== 'open' || launchFiredRef.current) return;
    if (!LAUNCH_INTENT.join && !LAUNCH_INTENT.daily) return;
    launchFiredRef.current = true;
    if (LAUNCH_INTENT.join) {
      const name = resolvePlayerName();
      setPlayerNameState(name);
      send('join_room', { code: LAUNCH_INTENT.join, name });
      track('room_joined', { mode: 'invite_link' }); // enum only; no PII
    } else {
      handleStartDaily();
    }
    // handleStartDaily is a stable-enough function declaration; this effect
    // only ever fires once (guarded by launchFiredRef).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsStatus, send]);

  // Wipe to the homepage the moment the socket comes up (connecting -> open).
  const prevWsRef = useRef(wsStatus);
  useEffect(() => {
    const prev = prevWsRef.current;
    prevWsRef.current = wsStatus;
    if (prev !== 'open' && wsStatus === 'open') {
      runTransition('READY?'); // the bars sweep (whoosh no-ops if audio isn't unlocked)
    }
  }, [wsStatus, runTransition]);

  // Splash: unlock audio + start the music silently within the click gesture.
  // This click is the browser's autoplay-unlock gesture, so it's where we create
  // the SFX AudioContext too. No punch here - the intro's two title lines each
  // land their own punch, so a leading hit on dismiss would just double up.
  function handleSplashStart() {
    music.setVolume(0);
    music.play();
    sound.unlock();
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
    // First visit just finished the intro — remember it so repeat visits skip
    // straight past the splash + fight-card animations (#6a).
    markIntroSeen();
    music.fadeTo(0.3, 500);
    // Reveal the menu with the KNIFE-SPLIT (this transition's signature, in place
    // of the explosion + the generic bar wipe). Under reduced motion we skip the
    // slice entirely and just cut to the menu.
    const reduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    // The blade-hit / halves-apart cues + the jolt are fired BY KnifeSplit from
    // its phase chain (onSlash/onOpen below), so each lands WITH its visual —
    // not here at handoff, which is ~920ms before the halves actually part.
    setSlicing(true);
    if (sliceTimerRef.current) clearTimeout(sliceTimerRef.current);
    // KnifeSplit drives its OWN lifecycle (~2.0s slash+hold+open, tap-to-skip,
    // same-session/reduced-motion skip) and calls onComplete (handleSliceComplete)
    // when it's done. This timer is only a safety net so the overlay can never get
    // stuck mid-screen if that callback somehow never fires.
    sliceTimerRef.current = setTimeout(() => setSlicing(false), 2500);
  }

  // KnifeSplit finished (or was skipped): tear down the overlay. Idempotent — the
  // safety timer above and this callback are both guarded by clearing the ref.
  function handleSliceComplete() {
    if (sliceTimerRef.current) {
      clearTimeout(sliceTimerRef.current);
      sliceTimerRef.current = null;
    }
    setSlicing(false);
  }

  function goToLobby(mode, publicDefault = false) {
    setLobbyMode(mode);
    setLobbyPublicDefault(publicDefault);
    setServerError('');
    setView('lobby');
  }

  // Open the unified JOIN ROOM screen (code entry + public-room list). Clear any
  // stale list so we don't flash an old snapshot; the screen's mount effect
  // immediately re-requests a fresh one. This is the menu's "JOIN ROOM" button.
  // (The backend `quick_play` handler still exists but is no longer called from
  // the UI - the Quick Play entry point was removed.)
  function handleOpenBrowser() {
    setServerError('');
    setPublicRooms([]);
    setView('browse');
  }

  // (Re)request the public-room list. Stable so the browser screen can call it on
  // mount + on its auto-refresh interval without re-subscribing every render.
  const handleRefreshPublicRooms = useCallback(() => {
    send('list_public_rooms', {});
  }, [send]);

  // Join a specific public room from the browser - the SAME join-by-code path as
  // the Join Room screen, just with the code taken from the tapped row.
  function handleJoinPublicRoom(code, name) {
    setPlayerName(name);
    setServerError('');
    send('join_room', { code, name });
    track('room_joined', { mode: 'join' }); // fire-and-forget; no name/PII
  }

  // Browser empty-state "create public room": jump to the create lobby with the
  // visibility toggle pre-set to PUBLIC.
  function handleCreatePublicFromBrowser() {
    goToLobby('solo', true);
  }

  function goToCredits() {
    setView('credits');
  }

  function goHome() {
    setLobbyMode(null);
    setLobbyPublicDefault(false);
    setRoom(null);
    setPublicRooms([]);
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
    setCategoryRerolls(null);
    setLastReroll(null);
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
    setDailyResult(null);
    setView('home');
  }

  // Daily Challenge: ONE tap from the menu into today's board. Uses the
  // remembered/generated name (no name prompt), creates a private room, locks
  // it to Category Blitz, and starts with daily:true — the server processes
  // the three frames in order on this socket, exactly like the lobby's
  // create-and-preselect path. No set_packs: the daily ignores packs.
  function handleStartDaily() {
    const name = playerName || resolvePlayerName();
    setPlayerName(name);
    setServerError('');
    setLobbyMode('category-blitz');
    send('create_room', { name, isPublic: false });
    send('set_game_type', { gameType: 'category-blitz' });
    send('start_game', { daily: true });
    track('daily_started', { day: currentDayNumber() });
  }

  // QUICK PLAY VS BOT: one tap from the menu into a live 1v1 against a medium
  // bot. Uses the remembered/generated name (no prompt), creates a PRIVATE room
  // (so there's no public/private visibility question for solo-vs-bot — #6c),
  // locks Word Bomb, adds a medium bot, and starts — the server processes the
  // frames in order on this socket (same pattern as handleStartDaily). First
  // timers get the gentler CHILL tier; returning players keep CRAZY.
  function handleQuickPlayBot() {
    const name = playerName || resolvePlayerName();
    setPlayerName(name);
    setServerError('');
    setLobbyMode('word-bomb');
    send('create_room', { name, isPublic: false });
    send('set_game_type', { gameType: 'word-bomb' });
    send('set_difficulty', { difficultyKey: hasPlayedBefore() ? 'medium' : 'chill' });
    send('add_bot', { difficulty: 'medium' });
    send('start_game', {});
    track('quick_play_bot', {});
  }

  function handleLobbyContinue({ name, mode, roomCode, isPublic }) {
    // Remember the name so Quick Play / the browser default to it next time.
    setPlayerName(name);
    if (mode === 'join') {
      send('join_room', { code: roomCode, name });
      track('room_joined', { mode: 'join' }); // fire-and-forget; no name/PII
    } else {
      // Carry the public/private choice into create_room (defaults false server
      // side, so a missing flag stays private/code-only as before).
      send('create_room', { name, isPublic: !!isPublic });
      // Analytics: the selected mode is a game-id enum ('solo' generic create, or
      // a preselected 'word-bomb' / 'category-blitz' / 'imposter-word'). No PII.
      track('room_created', { mode });
      // Default a FIRST-TIMER's Word Bomb room to the gentler CHILL tier (20s /
      // 3 lives); returning players keep the server default (CRAZY). 'solo' is a
      // generic create that stays Word Bomb server-side. Ordered after create_room
      // on the same socket. Category Blitz / Imposter ignore Word Bomb tiers.
      const isWordBombCreate = mode === 'solo' || mode === 'word-bomb';
      if (isWordBombCreate && !hasPlayedBefore()) {
        send('set_difficulty', { difficultyKey: 'chill' });
      }
      // If the player picked a specific game from the homepage, lock the room
      // into it right away. The server processes messages in order over the
      // same socket, so create_room (which registers the room) is handled
      // before this set_game_type lands.
      if (isPreselectableGame(mode)) {
        send('set_game_type', { gameType: mode });
        // Category Blitz create/host path ONLY: lock in the host's chosen packs.
        // Ordered after set_game_type on the same socket, so the room is already
        // Blitz when set_packs lands. Never sent on join (that branch is above).
        if (mode === 'category-blitz') {
          send('set_packs', { packs: blitzPacks });
        }
      }
    }
  }

  function handleLeaveRoom() {
    send('leave_room', {});
    goHome();
  }

  function handleSetDifficulty(difficultyKey) {
    fireDiff(() => send('set_difficulty', { difficultyKey }));
  }

  function handleSetGameType(gameType) {
    send('set_game_type', { gameType });
  }

  // Solo Word Bomb / Category Blitz: the host explicitly adds/removes a bot
  // opponent (the server re-broadcasts room_update, so the bot just
  // appears/disappears in the roster).
  function handleAddBot(difficulty) {
    fireBot(() => send('add_bot', { difficulty }));
  }

  function handleRemoveBot() {
    fireBot(() => send('remove_bot', {}));
  }

  function handleStartGame() {
    fireStart(() => send('start_game', {}));
  }

  // Host-only "play again": the server resets the room's game and broadcasts a
  // room_update, which the handler above turns back into the 'room' view.
  function handleRematch() {
    fireRematch(() => send('rematch', {}));
  }

  // Solo Category Blitz "PLAY AGAIN": fire a brand new game immediately without
  // bouncing back through the room/lobby. The lone player is the host, so they
  // can just start_game again; the server tears down the old game's timers,
  // creates a fresh solo game with a new random category, and broadcasts
  // game_started + round_start, which the gameNonce remount + the round_start
  // handler turn into a fresh round (with countdown) on the same screen.
  function handlePlayAgain() {
    // Solo "play again" is a rematch sibling — share the rematch guard so the two
    // post-game buttons can't double-fire (they're never both pressed together).
    // After a DAILY run, play-again replays TODAY'S board (daily:true again):
    // same-day replays are streak-safe (the streak counts a day once) and only
    // the day's best score is kept.
    const replayDaily = !!dailyResult;
    fireRematch(() => send('start_game', replayDaily ? { daily: true } : {}));
  }

  // Category Blitz: swap the current round's category. The server enforces
  // host-only (multiplayer) and the per-game reroll allowance; we just ask.
  function handleRerollCategory() {
    fireReroll(() => send('reroll_category', {}));
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
  if (view === 'game') {
    screen = (
      <GameScreen
        gameState={gameState}
        gameType={gameType}
        gameNonce={gameNonce}
        myId={myId}
        isHost={isHost}
        timerSeconds={timerSeconds}
        lastWordResult={lastWordResult}
        onClearResult={() => setLastWordResult(null)}
        checkingAnswer={checkingAnswer}
        gameOver={gameOver}
        roomPlayers={room ? room.players : []}
        playerColors={playerColors}
        feedEvents={feedEvents}
        gameStats={gameStats}
        typingText={typingText}
        categoryRound={categoryRound}
        myAnswers={myAnswers}
        playerProgress={playerProgress}
        roundResults={roundResults}
        categoryScores={categoryScores}
        categoryTotals={categoryTotals}
        categoryRerolls={categoryRerolls}
        lastReroll={lastReroll}
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
        onPlayAgain={handlePlayAgain}
        onRerollCategory={handleRerollCategory}
        rematchPending={rematchPending}
        rerollPending={rerollPending}
        musicSetVolume={music.setVolume}
        reactions={reactions}
        onSpectatorReaction={handleSpectatorReaction}
        onShake={triggerShake}
        roomCode={room ? room.code : null}
        dailyResult={dailyResult}
      />
    );
  } else if (view === 'room' && room) {
    screen = (
      <RoomScreen
        room={room}
        myId={myId}
        playerColors={playerColors}
        preselectedGame={isPreselectableGame(lobbyMode) ? lobbyMode : null}
        serverError={serverError}
        startPending={startPending}
        diffPending={diffPending}
        botPending={botPending}
        onLeave={handleLeaveRoom}
        onSetGameType={handleSetGameType}
        onSetDifficulty={handleSetDifficulty}
        onStartGame={handleStartGame}
        onAddBot={handleAddBot}
        onRemoveBot={handleRemoveBot}
      />
    );
  } else if (view === 'lobby') {
    screen = (
      <LobbyScreen
        mode={lobbyMode}
        defaultPublic={lobbyPublicDefault}
        onBack={goHome}
        onContinue={handleLobbyContinue}
        wsStatus={wsStatus}
        serverError={serverError}
      />
    );
  } else if (view === 'browse') {
    screen = (
      <PublicRoomsScreen
        rooms={publicRooms}
        serverError={serverError}
        name={playerName}
        onNameChange={setPlayerName}
        onJoin={handleJoinPublicRoom}
        onRefresh={handleRefreshPublicRooms}
        onCreatePublic={handleCreatePublicFromBrowser}
        onBack={goHome}
      />
    );
  } else if (view === 'credits') {
    screen = <CreditsScreen onBack={goHome} />;
  } else {
    screen = (
      <Homepage
        wsStatus={wsStatus}
        onSelectGame={(gameId) => goToLobby(gameId)}
        onCreateRoom={() => goToLobby('solo')}
        onJoinRoom={handleOpenBrowser}
        onQuickPlay={handleQuickPlayBot}
        onCredits={goToCredits}
        blitzPacks={blitzPacks}
        onToggleBlitzPack={handleToggleBlitzPack}
        onSetAllBlitzPacks={handleSetAllBlitzPacks}
        onDaily={handleStartDaily}
        daily={{
          dayNumber: currentDayNumber(),
          played: hasPlayedDay(dailyState, currentDayNumber()),
          streak: displayStreak(dailyState, currentDayNumber()),
        }}
      />
    );
  }

  // Ambient backdrop intensity: ramps with the Word Bomb turn timer so the whole
  // screen reacts to the danger level. Resting 'calm' on every other screen.
  let bgIntensity = 'calm';
  if (view === 'game' && gameType === 'word-bomb' && !gameOver && gameState) {
    const maxT = gameState.timerSeconds || 1;
    const ratio = Math.max(0, Math.min(1, timerSeconds / maxT));
    bgIntensity = ratio > 0.6 ? 'calm' : ratio >= 0.3 ? 'warning' : 'critical';
  }

  // The bar wipe is the only motion the transition adds; honour reduced-motion by
  // skipping the overlay entirely (the screen has already swapped underneath, so
  // nothing is lost but the animation). Read live - it's a cheap media query and
  // the overlay is purely cosmetic.
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // The bomb-fuse loading screen is the very first thing shown. It's now a
  // FIXED-DURATION timed intro: it burns the fuse, explodes and hands off on its
  // own schedule (calling onComplete), independent of the socket - which connects
  // in the background. Once handed off we never replace the live menu with the
  // loading/error screen, so a socket error/close after handoff can't blank the UI.
  if (!loadingDone) {
    return (
      <>
        <LoadingScreen
          status={wsStatus}
          onComplete={() => setLoadingDone(true)}
          onRetry={() => window.location.reload()}
        />
        <CursorTrail />
      </>
    );
  }

  // The attract/splash screen follows the loading screen. Clicking it starts
  // everything (audio unlock, intro, etc.). The persistent WallScene +
  // ParticleField render behind it - the splash's own translucent veil dims the
  // graffiti wall so the wordmark + mascot stay the focal point. (Only the INTRO
  // card is stripped to a bare black field; the splash keeps its full backdrop.)
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

  // The anime fight-card intro plays over a full black overlay between the splash
  // and the homepage; when it finishes it wipes down to the homepage. The shared
  // WallScene + ParticleField are intentionally NOT mounted here: the intro was
  // stripped back to near-empty so the two lines (TYPE FAST / DIE SLOW) own a calm
  // black field with nothing competing behind them (and no per-beat halftone
  // repaint). Those backdrops still render on the splash, menu and game.
  if (showIntro) {
    return (
      <SoundContext.Provider value={soundValue}>
        <TransitionIntro onComplete={handleIntroComplete} />
        <CursorTrail />
      </SoundContext.Provider>
    );
  }

  // `key={view}` remounts the wrapper the instant the view changes, so the new
  // screen mounts immediately (its mount effects - e.g. the in-game 3-2-1
  // countdown - replay then) instead of waiting on a timer. The WallScene +
  // TransitionOverlay live OUTSIDE that keyed wrapper so the backdrop persists
  // and the cosmetic wipe plays on top of the already-swapped screen.
  return (
    // Three nested roles, deliberately on separate elements so an animation can
    // never spawn a scrollbar:
    //   .app-viewport - fixed + overflow:hidden: the outermost CLIP box.
    //   .app-shake    - the intensity-graded shake (light=beat / medium=accept /
    //                   heavy=explosion) is applied HERE. It only transforms; it
    //                   is neither the clip nor the scroll container, so a shake
    //                   can't nudge content past a scrollable edge.
    //   .app-scroll   - the actual scroll container (overflow-y:auto), inside the
    //                   shake element, so genuinely tall screens still scroll
    //                   while the shake (an ancestor transform) never affects it.
    <SoundContext.Provider value={soundValue}>
    <div className="app-viewport">
      <div className={`app-shake${shake ? ` shake-${shake}` : ''}`}>
        <div className="app-scroll">
          <WallScene intensity={bgIntensity} />
          <ParticleField />
          <div className="view-transition-root">
            <div key={view} className="view-screen">
              {screen}
            </div>
          </div>
          {transition && !prefersReducedMotion && (
            <TransitionOverlay key={transition.key} word={transition.word} />
          )}
          {/* Invite-link arrival: a friend tapped a ?join= link and we're
              connecting + joining in the background. One clear line so the
              wait (cold backend spin-up) never reads as a broken link.
              Inline-styled, presentation-only. */}
          {linkJoinPending && view === 'home' && (
            <div
              role="status"
              style={{
                position: 'fixed',
                left: '50%',
                bottom: '28px',
                transform: 'translateX(-50%)',
                zIndex: 9000,
                fontFamily: "'Space Mono', monospace",
                fontWeight: 700,
                fontSize: '14px',
                letterSpacing: '0.06em',
                color: '#0d0618',
                background: '#FFE94A',
                border: '2px solid #B8A020',
                borderRadius: '8px',
                boxShadow: '3px 3px 0 #000',
                padding: '10px 18px',
              }}
            >
              JOINING ROOM {LAUNCH_INTENT.join}…
            </div>
          )}
          {/* The intro -> menu knife-split reveal (cosmetic, pointer-events:none,
              auto-cleared after ~480ms). Replaces the old intro explosion. */}
          {slicing && (
            <KnifeSplit
              onComplete={handleSliceComplete}
              onSlash={() => sound.punch()}
              onOpen={() => {
                sound.whoosh();
                triggerShake('light');
              }}
            />
          )}
          {/* Whole-viewport beat flash (subtlest effect): a single always-present
              div that briefly flashes a palette colour on each beat (colour set by
              useBeatSync via --flash-color). Click-through, below modals. */}
          <div className="screen-flash" aria-hidden="true" />
          <MusicButton
            isMuted={music.isMuted}
            onToggle={music.toggleMute}
            accent={SCREEN_ACCENT[view] || '#FF2EC4'}
          />
        </div>
      </div>
      {/* CONNECTION LOST: shown only when the socket drops mid room/game. The
          seat can't be resumed (fresh connection id server-side), so the single
          action is BACK TO MENU, which runs the normal leave/reset path (goHome).
          Styled/animated in Transitions.css; the defeat sting + heavy jolt fire
          from the effect that watches connectionLost above. */}
      {connectionLost && (
        <div className="connlost-overlay" role="alertdialog" aria-label="Connection lost">
          <div className="connlost-mascot">
            <Mascot pose="panic" emote="flinch" size={110} />
          </div>
          <div className="connlost-title">CONNECTION LOST</div>
          <div className="connlost-sub">
            You were dropped from the game. Your seat is gone - hop back to the menu to play again.
          </div>
          <button className="connlost-btn" onClick={goHome}>
            BACK TO MENU
          </button>
        </div>
      )}
      {/* ROOM CLOSED (by the server): idle reap or a contained server error.
          Same treatment as CONNECTION LOST - the room is unrecoverable, the
          only exit is home - so it reuses the connlost styles. connectionLost
          wins if both somehow apply at once. */}
      {roomClosedNotice && !connectionLost && (
        <div className="connlost-overlay" role="alertdialog" aria-label="Room closed">
          <div className="connlost-mascot">
            <Mascot pose="panic" emote="flinch" size={110} />
          </div>
          <div className="connlost-title">ROOM CLOSED</div>
          <div className="connlost-sub">{roomClosedNotice}</div>
          <button
            className="connlost-btn"
            onClick={() => {
              setRoomClosedNotice(null);
              goHome();
            }}
          >
            BACK TO MENU
          </button>
        </div>
      )}
      {/* Cursor trail sits outside .app-shake so the screen shake never moves
          it, and above everything (z 9999). */}
      <CursorTrail />
      {/* Vercel Web Analytics - renders nothing; beacons pageviews on the
          deployed site (no-op on localhost). */}
      <Analytics />
    </div>
    </SoundContext.Provider>
  );
}

export default App;