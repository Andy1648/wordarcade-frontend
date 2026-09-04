// App.jsx
import { useState, useEffect, useRef, useMemo, useCallback, lazy, Suspense } from 'react';
import Homepage from './components/Homepage';
// Deferred screens: none are on the first-paint path (splash -> menu). Lazy-loading
// them (esp. the 4k-line GameScreen, which drags the whole share/result-card render
// subtree with it) carves the majority of the app out of the initial JS chunk. They
// are warmed on idle right after paint (see the prefetch effect) so navigation into a
// room/game shows no Suspense flash.
const LobbyScreen = lazy(() => import('./components/LobbyScreen'));
const PublicRoomsScreen = lazy(() => import('./components/PublicRoomsScreen'));
const RoomScreen = lazy(() => import('./components/RoomScreen'));
const GameScreen = lazy(() => import('./components/GameScreen'));
import WallScene from './components/WallScene';
import TransitionOverlay from './components/TransitionOverlay';
import LoadingScreen from './components/LoadingScreen';
import AudioControls from './components/AudioControls';
import { sndWordAccepted, sndWordRejected, sndRunOver } from './audio/gameSounds';
const CreditsScreen = lazy(() => import('./components/CreditsScreen'));
// StatsScreen now hosts COLLECTION and ACHIEVEMENTS as tabs (consolidated from their old standalone
// views/footer links), so their bodies are imported by StatsScreen, not lazily as top-level views.
const StatsScreen = lazy(() => import('./components/StatsScreen'));
const ShopScreen = lazy(() => import('./components/ShopScreen'));
// SAT RUSH (solo, flag-gated). Lazy like the other off-first-paint screens.
const SatRushGame = lazy(() => import('./satRush/SatRushGame'));
// CHAIN / FUSE (solo word modes, flag-gated). Lazy — the 357KB word chunk they pull
// must never touch the menu's first paint.
const ChainGame = lazy(() => import('./solo/ChainGame'));
const FuseGame = lazy(() => import('./solo/FuseGame'));
// THE RUN — the headline roguelike mode (10-round gauntlet). Lazy like the other
// off-first-paint screens; its own chunk pulls the run engine + solo word data.
const RunMode = lazy(() => import('./runMode/RunMode'));
// CrazyGames zero-click direct entry (?cg=1). Lazy so the default (no-flag)
// bundle is unchanged — the arm screen only ever loads on a cg session.
const CgArmScreen = lazy(() => import('./components/CgArmScreen'));
import SplashScreen from './components/SplashScreen';
import TransitionIntro from './components/TransitionIntro';
// Eager (not lazy): KnifeSplit must cover the menu on the FIRST frame after the
// intro unmounts. As a lazy chunk, the Suspense gap while it downloaded left the
// menu visible for a beat before the cover snapped on — the flash we're fixing.
import KnifeSplit from './components/KnifeSplit';
// Eager: the skeleton chrome shown while a lazy overlay (Stats/Shop) chunk downloads, so an
// open never flashes an empty box. Tiny + static, so eager import costs nothing meaningful.
import OverlaySkeleton from './components/OverlaySkeleton';
// Eager + tiny: the DELAYED fallback for the main screen router — renders null for ~450ms
// (so the warmed fast path is unchanged) then a minimal loader for a genuinely slow chunk fetch.
import RouteFallback from './components/RouteFallback';
import Mascot from './components/Mascot';
import ParticleField from './components/ParticleField';
import CursorTrail from './components/CursorTrail';
import PACKS from './data/packs';
import { SAT_RUSH_ENABLED, SAT_RUSH_VIEW } from './satRush/config';
import { RUN_VIEW, RUN_MODE_ENABLED } from './runMode/config';
import {
  CHAIN_VIEW,
  FUSE_VIEW,
  SOLO_LAUNCH,
  SOLO_MODES_ENABLED,
} from './solo/config';
import { CG_ENTRY, cgRoomReady, isCoarsePointer } from './cg/cgEntry';
import { useWebSocket } from './hooks/useWebSocket';
import { useOverlays } from './hooks/useOverlays';
import { useRoom } from './hooks/useRoom';
import { useProgressionEvents } from './hooks/useProgressionEvents';
import { canonicalPathForView, MENU_PATHS, hasStickyQuery, viewIntentFromPath } from './router';
import { useMusicPlayer } from './hooks/useMusicPlayer';
import { useBeatSync } from './hooks/useBeatSync';
import { useSoundEffects } from './hooks/useSoundEffects';
import { SoundContext } from './contexts/SoundContext';
import { buildPlayerColors } from './playerColors';
import { resolvePlayerName, rememberName } from './playerName';
import {
  hasSeenIntro,
  markIntroSeen,
  stampLastSeen,
  hasPlayedBefore,
  markPlayed,
  getLastSeen,
} from './visitHistory';
import { claimReturnBonus } from './progress/returnBonus';
import ReturnBonusCard from './components/ReturnBonusCard';
import { checkAchievements } from './progress/achievements';
import ScreenBoundary from './components/ScreenBoundary';
import { secretFound as evSecretFound } from './lib/events.js';
import { addWords } from './wordCount';
import { bankWordWins, awardWins } from './progress/wins';
import { awardWordXp, cappedWordMult } from './progress/xp';
// COMBO + LUCKY parity (feat/parity-wb-blitz): the SAME pure modules CHAIN/FUSE use, reused
// verbatim (no forked logic) so Word Bomb + Category Blitz score identically — a consecutive-accept
// combo multiplier and a 1/40 lucky ×5, both folded into the per-word reward weight.
import { freshCombo, comboAccept, comboBreak } from './progress/combo';
import { makeLuckyOracle, luckyReward, randomSeed } from './progress/luck';
import { recordAcceptedWord } from './progress/collection';
import { noteWord, noteSession, noteLucky } from './progress/records';
import { wordSenseWinsFactor } from './progress/wordSense';
import { loadRarityIndex, rarityOf, isRarityIndexLoaded, whenRarityReady } from './progress/rarityIndex';
import {
  saveDailyState,
  recordDailyResult,
  resolveDailyScore,
  hasPlayedDay,
  currentDayNumber,
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
  home: '#ff4fa3',
  lobby: '#2EFFE0',
  browse: '#2EFFE0',
  room: '#FFE94A',
  game: '#FF6B3D',
  'cg-arm': '#FF6B3D', // matches the game accent (cg arm hands straight into it)
  credits: '#9A1AFF',
  // SAT RUSH is a duotone manga surface; the ♫ button floats over the black gutter,
  // so it wears PAPER (reads on the void) instead of the house pink.
  'sat-rush': '#F0EAD9',
};

// (TRANSITION_WORDS + NAV_DEPTH moved into hooks/useOverlays.js — refactor/app-split step 1.)

// The lobby "mode" can be a generic entry ('solo' for Create Room, 'join'
// for Join Room) or a specific game id picked from a homepage card. These are
// the real backend game types we can lock the room into and preselect; any
// other card would fall back to the in-room mode picker (and default Word Bomb).
const PRESELECTABLE_GAMES = ['word-bomb', 'category-blitz'];

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
// goes straight into today's Daily Challenge; ?satrush=1 opens SAT Rush (a solo
// mode — no room/WebSocket). All skip the intro chain: a friend tapping a
// group-chat link should land IN the game, not on a splash.
// Read once at module load (same pattern as PORTAL_SKIP_INTRO).
const LAUNCH_INTENT = (() => {
  if (typeof window === 'undefined') return { join: null, daily: false, satrush: false };
  const params = new URLSearchParams(window.location.search);
  const join = (params.get('join') || '').trim().toUpperCase();
  return {
    join: join || null,
    daily: params.get('daily') === '1',
    satrush: params.get('satrush') === '1',
  };
})();

// Any launch intent (portal embed, invite link, daily link, SAT Rush link) skips
// the intro.
const SKIP_INTRO =
  PORTAL_SKIP_INTRO ||
  !!LAUNCH_INTENT.join ||
  LAUNCH_INTENT.daily ||
  LAUNCH_INTENT.satrush ||
  SOLO_LAUNCH.chain ||
  SOLO_LAUNCH.fuse ||
  CG_ENTRY; // CrazyGames wants gameplay immediately — no splash/intro chain.

// Repeat visitors have already seen the SQUAD-UP / "TYPE FAST. DIE SLOW." intro,
// so we skip those two animations for them (the loading screen still plays).
// Read once at module load, alongside the flags above. The flag is written when
// the intro finishes on a first visit (handleIntroComplete).
const SEEN_INTRO = hasSeenIntro();
// A fresh session (30+ min of absence, so the intro replays) is a new session for the permanent
// record: count it and stamp firstPlayed once. Guarded internally; runs once per page load.
if (!SEEN_INTRO) noteSession();
// RETURN BONUS (Job 6): capture the last-seen time at MODULE LOAD, before the app re-stamps it in a
// mount effect — otherwise "how long were you away" would always read ~0.
const LAST_SEEN_AT_LOAD = getLastSeen();

// Draw the 1/40 lucky verdict for one accepted word. Normally the seeded luck.js oracle; a test seam
// (mirrors window.__TAW_NO_ACHIEVEMENT_GRANT) lets e2e force it off/always so the combo-boosted
// payout-precision specs stay deterministic. Undefined in production → the real random oracle.
function drawLucky(oracle) {
  try {
    const h = typeof window !== 'undefined' ? window.__TAW_LUCKY : undefined;
    if (h === 'off') return false;
    if (h === 'always') return true;
  } catch {
    /* no window / blocked → fall through to the real oracle */
  }
  return oracle.next();
}

/**
 * Top-level view state manager + the single shared WebSocket connection
 * for the whole app.
 */
function App() {
  // CrazyGames entry (?cg=1) lands directly in the ARM state; every other entry
  // starts on the home menu, exactly as before.
  const [view, setView] = useState(CG_ENTRY ? 'cg-arm' : 'home');
  // The screen always renders off the live `view` (no lagging copy), so a view
  // change shows immediately and can never be stranded behind a timer. The
  // diagonal-bar wipe is a PURELY COSMETIC overlay that animates on top during
  // the swap and fades out. `transition` (+ its wipe machinery + nav helpers) now lives in
  // hooks/useOverlays.js — refactor/app-split step 1; App composes it below (after `sound`).
  // (lobbyMode + lobbyPublicDefault moved into hooks/useRoom.js — refactor/app-split step 2.)
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
  // (publicRooms moved into hooks/useRoom.js — refactor/app-split step 2.)
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
  // (serverError + roomClosedNotice moved into hooks/useRoom.js — refactor/app-split step 2.)
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
  // (myId + myIdRef moved into hooks/useRoom.js — refactor/app-split step 2.)

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
  // True while the in-progress game is a Daily Challenge run (learned from
  // game_started.daily). Drives the mid-daily LEAVE confirmation so a stray tap
  // can't silently forfeit the day's attempt.
  // (isDailyGame moved into hooks/useProgressionEvents.js — refactor/app-split step 3.)
  const [confirmLeaveDaily, setConfirmLeaveDaily] = useState(false);
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
  // WINS: count MY accepted words per round/game, client-side from data that already
  // arrives (word_result / answer_result). Refs (not state) so the message handler reads a
  // live value. Word Bomb pays at game_over; Category Blitz pays at each round_end.
  const myWbAcceptedRef = useRef(0); // Word Bomb: my accepts this game
  const myBlitzAcceptedRef = useRef(0); // Category Blitz: my accepts this round
  // RARITY (word-value): the running SUM of each of my accepted words' rarity multipliers, per
  // mode. bankWordWins pays on the delta of this weight past the 3-word gate (see wins.js), so a
  // rarer word banks proportionally more. Reset alongside the accept counts on a fresh game/round.
  const myWbWeightRef = useRef(0);
  const myBlitzWeightRef = useRef(0);
  // COMBO + LUCKY payout parity (feat/parity-wb-blitz). The visible streak meter (GameScreen's
  // cosmetic useCombo) already existed but never touched scoring; these fold the SAME combo.js
  // multiplier + luck.js 1/40 ×5 into the per-word reward WEIGHT, exactly as CHAIN/FUSE do. Advanced
  // on the identical authoritative events the WS handler already sees (accept / reject / life-loss /
  // fresh game|round), so the payout combo stays in lockstep with the visible meter. Refs (not state)
  // so the message handler reads a live value; the oracle is re-seeded per game/round.
  const wbComboRef = useRef(freshCombo());
  const wbLuckyOracleRef = useRef(makeLuckyOracle(randomSeed()));
  const blitzComboRef = useRef(freshCombo());
  const blitzLuckyOracleRef = useRef(makeLuckyOracle(randomSeed()));
  // Preload the rarity rank index once (its own lazy chunk) so word-value scoring is ready by the
  // time play starts. Idempotent + single-flight; a failed load degrades to all-COMMON (×1).
  useEffect(() => {
    loadRarityIndex();
  }, []);
  // WINS attribution (Word Bomb): the words I've submitted this game whose word_result
  // hasn't come back yet. My accepted words are counted by WORD MATCH against this list,
  // NOT by the live turn pointer (feedCurrentRef) — a turn_update processed just before
  // my word_result advances that pointer off me and used to drop my word from the count,
  // and dropping one word can fall under the 3-word wins gate → a valid word "didn't
  // score" (see e2e/word-bomb-scoring RACE). Reset each game_started; entries are consumed
  // on match, and the server always answers a submit so the list self-drains.
  const myOutstandingWordsRef = useRef([]);
  // WINS visibility (Economy v3): a LIVE running estimate of the wins this round/game will
  // pay, shown in the in-game HUD and ticking up as MY answers are accepted; and the total
  // actually EARNED this run, shown large on the game-over screen. `winsTally` is the pending
  // per-round (Blitz) / per-game (Word Bomb) estimate; `winsEarnedTotal` accumulates the real
  // recordRound() payouts across the run.
  const [winsTally, setWinsTally] = useState(0);
  // MY accepted-word count this round/game — drives the HUD pill's pre-gate "3 WORDS TO
  // EARN" state (winsTally alone can't: it's 0 for both 0 and 2 accepted words).
  const [winsWords, setWinsWords] = useState(0);
  const [winsEarnedTotal, setWinsEarnedTotal] = useState(0);
  // (overlayReturnRef + shopViewRef moved into hooks/useOverlays.js — refactor/app-split step 1.)
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

  // ---- Daily Challenge (solo Category Blitz on the server's date-seeded board) ----
  // (dailyState + dailyResult + dailyStateRef + the ref-sync effect moved into
  // hooks/useProgressionEvents.js — refactor/app-split step 3.)

  // Session presence: refresh the last-seen stamp on load and again on
  // pagehide/beforeunload, so the intro's 30-minute session boundary measures
  // absence from the SITE, not time since the intro (a refresh after a long play
  // session must not replay it). This runs AFTER SEEN_INTRO was read at module
  // load, so stamping now never suppresses this load's own intro.
  useEffect(() => {
    stampLastSeen();
    const stamp = () => stampLastSeen();
    window.addEventListener('pagehide', stamp);
    window.addEventListener('beforeunload', stamp);
    return () => {
      window.removeEventListener('pagehide', stamp);
      window.removeEventListener('beforeunload', stamp);
    };
  }, []);

  // RETURN BONUS (Job 6): claim once on mount using the last-seen time captured at module load. The
  // wins are granted here (they returned after >=6h, at most once/calendar day); the card is shown
  // only on the home menu (a deep-link into a game doesn't overlay the return card).
  const [returnCard, setReturnCard] = useState(null);
  useEffect(() => {
    const b = claimReturnBonus(LAST_SEEN_AT_LOAD);
    if (b) setReturnCard(b);
  }, []);

  // ACHIEVEMENTS (Job 7): re-evaluate whenever we land on the home menu (so anything earned during a
  // game / run is caught on return). checkAchievements grants wins for newly-earned only (the wins
  // chip updates as feedback); the full grid is on the ACHIEVEMENTS screen. Idempotent — a repeat
  // home visit with nothing new grants nothing.
  useEffect(() => {
    if (view !== 'home') return;
    const newly = checkAchievements();
    // analytics: a hidden/secret achievement was just discovered (additive; never alters the grant).
    try { if (Array.isArray(newly)) for (const a of newly) if (a && a.secret) evSecretFound(a.id); } catch { /* analytics only */ }
  }, [view]);

  // (myIdRef moved into hooks/useRoom.js — refactor/app-split step 2; the drain writes the returned ref.)
  // Live mirror of my display name, so the (deps-trimmed) message-drain effect can
  // attribute my own accepted word to me by name even when the turn pointer has raced
  // ahead. Assigned every render — playerName rarely changes mid-game.
  const myNameRef = useRef(playerName);
  myNameRef.current = playerName;
  // Synchronous mirror of categoryTotals (running per-player round-sum), so the
  // game_over handler can read this game's authoritative total without waiting on
  // a batched state commit. Reset each fresh game.
  const categoryTotalsRef = useRef({});

  // Invite-link arrival: true from load until the ?join= room answers (join
  // lands -> room_update, or fails -> error). Drives the JOINING ROOM banner
  // so a cold backend (30-60s Render spin-up) doesn't read as a dead link.
  const [linkJoinPending, setLinkJoinPending] = useState(!!LAUNCH_INTENT.join);

  // Reconnect gate for useWebSocket. feat/reconnect: auto-reconnect is now ALWAYS allowed — a
  // mid-session drop (school-wifi blip) should try to come back, not instantly kill the game. The
  // backend still issues a fresh id with no resume and REJECTS a live-game join (game_already_started),
  // so a mid-GAME seat cannot truly be restored without a protocol change (see
  // claude/reconnect-findings.md). But the socket reconnects with backoff, we ATTEMPT rejoin-by-code,
  // and either land back (a waiting/finished room rejoins cleanly) or fall to a wins-preserved landing
  // instead of a dead screen. Banked wins are already in localStorage per accepted word, so no drop
  // ever loses them.
  const canReconnectRef = useRef(true);
  const { status: wsStatus, messages, consumeMessages, send } = useWebSocket(canReconnectRef);

  // An "active session" = the player holds a server-side seat: the waiting room or a live game.
  const inActiveSession = view === 'room' || (view === 'game' && !gameOver);

  // ---- Mid-session reconnect state machine (feat/reconnect) ----
  // null = healthy | 'trying' = dropped mid-session, RECONNECTING overlay up, BOARD KEPT | 'lost' =
  // couldn't return, wins-preserved landing. Orchestrated in effects below + resolved in the drain
  // via rejoinPendingRef (a tiny guarded hook, inert unless a rejoin is in flight).
  const [reconnect, setReconnect] = useState(null);
  const reconnectRoomRef = useRef(null); // room code to rejoin
  const rejoinSentRef = useRef(false); // join_room already sent for this reconnect
  const rejoinPendingRef = useRef(false); // a rejoin's result is awaited (the drain reads this)
  const reconnectTimerRef = useRef(null);
  const reconnectGiveUp = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    rejoinSentRef.current = false;
    rejoinPendingRef.current = false;
    setReconnect('lost');
  }, []);

  // Enter 'trying' the instant the socket drops during a session (the board stays mounted behind the
  // overlay). Arm a hard deadline so a socket that never returns still lands somewhere sane.
  useEffect(() => {
    // With reconnect always allowed, a drop shows as wsStatus leaving 'open' (the hook goes straight
    // to 'connecting', not 'closed'). In an active session that can only mean we dropped.
    if (inActiveSession && wsStatus !== 'open' && reconnect === null) {
      reconnectRoomRef.current = room && room.code ? room.code : null;
      rejoinSentRef.current = false;
      setReconnect('trying');
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = setTimeout(reconnectGiveUp, 12000);
    }
  }, [inActiveSession, wsStatus, reconnect, room, reconnectGiveUp]);

  // Socket came back while trying → attempt rejoin-by-code (existing join_room). rejoinPendingRef
  // tells the drain to resolve the next room_update as success / the next error as failure.
  useEffect(() => {
    if (reconnect === 'trying' && wsStatus === 'open' && !rejoinSentRef.current) {
      rejoinSentRef.current = true;
      if (reconnectRoomRef.current) {
        rejoinPendingRef.current = true;
        send('join_room', { code: reconnectRoomRef.current, name: playerName || resolvePlayerName() });
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = setTimeout(reconnectGiveUp, 6000); // a rejected/absent room resolves fast
      } else {
        reconnectGiveUp();
      }
    }
  }, [reconnect, wsStatus, send, playerName, reconnectGiveUp]);

  // feat/offline: connectivity, so the multiplayer modes (Word Bomb / Category Blitz — which NEED the
  // server) show a clear NEEDS INTERNET state instead of a silent spin, while CHAIN / FUSE / SAT RUSH
  // (fully client-side, precached by the service worker) stay playable. Seeded from navigator.onLine
  // and kept live via the online/offline events.
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' && navigator.onLine === false);
  useEffect(() => {
    const goOnline = () => setOffline(false);
    const goOffline = () => setOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

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

  // Overlay/navigation concern (refactor/app-split step 1). App keeps the `view` useState (read
  // above before `sound` exists); this hook owns the cosmetic bar-wipe + shop/stats/rebirth/solo
  // nav helpers. Placed here because runTransition needs `sound`. goHome stays in App (cross-cutting).
  const {
    transition,
    runTransition,
    shopViewRef,
    overlayReturnRef,
    goToStats,
    goToShop,
    goToRebirth,
    goToCredits,
    goToSatRush,
    goToChain,
    goToFuse,
    goToRun,
  } = useOverlays({ view, setView, sound });

  // Room/lobby concern (refactor/app-split step 2). App keeps `room` (read by playerColors above),
  // `serverEventId` (feeds the guards above) and `linkJoinPending` (LAUNCH_INTENT-coupled); this hook
  // owns the rest. The drain below calls these setters and writes myIdRef. goHome is hoisted (App).
  const {
    publicRooms,
    setPublicRooms,
    lobbyMode,
    setLobbyMode,
    lobbyPublicDefault,
    setLobbyPublicDefault,
    serverError,
    setServerError,
    roomClosedNotice,
    setRoomClosedNotice,
    myId,
    setMyId,
    myIdRef,
    goToLobby,
    handleOpenBrowser,
    handleRefreshPublicRooms,
    handleJoinPublicRoom,
    handleCreatePublicFromBrowser,
    handleLeaveRoom,
  } = useRoom({ send, setView, setPlayerName, goHome });

  // Daily-Challenge progression state (refactor/app-split step 3). The drain (App), goHome and
  // handleLeaveRequest/handleStartDaily call these setters and read dailyStateRef — unchanged.
  const {
    isDailyGame,
    setIsDailyGame,
    dailyState,
    setDailyState,
    dailyResult,
    setDailyResult,
    dailyStateRef,
  } = useProgressionEvents();

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

  // Music starts on the FIRST user gesture anywhere on the site — a click, key,
  // or touch on ANY element (the splash cover, the menu, a landing page). Browsers
  // block autoplay until a gesture, so this is the earliest legal moment; the
  // listener is document-level, one-shot, and covers every entry path (cold splash,
  // SEEN_INTRO repeat visitor with no splash, ?satrush=1 / ?join= / ?daily= deep
  // links, and landing-page → home). pointerdown+keydown+touchstart so a mouse, a
  // key, or a bare touch all unlock it.
  //
  // Volume choreography differs by path and is preserved here: during the splash /
  // fight-card intro the music must stay SILENT until the menu wipe (handleIntro-
  // Complete fades it up), so on a splash session we start at 0 and DON'T fade;
  // every other path fades up to 0.3 immediately. splashWillShowRef is captured at
  // first render so the branch is stable.
  const splashWillShowRef = useRef(showSplash);
  const firstGestureMusicRef = useRef(false);
  useEffect(() => {
    const startMusicOnGesture = () => {
      if (firstGestureMusicRef.current) return;
      firstGestureMusicRef.current = true;
      sound.unlock();
      music.setVolume(0);
      music.play();
      // Splash sessions hold the track silent until the menu wipe fades it up.
      if (!splashWillShowRef.current) music.fadeTo(0.3, 500);
      document.removeEventListener('pointerdown', startMusicOnGesture);
      document.removeEventListener('keydown', startMusicOnGesture);
      document.removeEventListener('touchstart', startMusicOnGesture);
    };
    document.addEventListener('pointerdown', startMusicOnGesture);
    document.addEventListener('keydown', startMusicOnGesture);
    document.addEventListener('touchstart', startMusicOnGesture);
    return () => {
      document.removeEventListener('pointerdown', startMusicOnGesture);
      document.removeEventListener('keydown', startMusicOnGesture);
      document.removeEventListener('touchstart', startMusicOnGesture);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  // feat/reconnect: the drop is now a two-phase flow (reconnect 'trying' -> 'lost'), not a single
  // CONNECTION LOST boolean. connectionLost is kept as an alias for the FINAL give-up state so the
  // roomClosedNotice guard + the defeat sting keep their meaning.
  const connectionLost = reconnect === 'lost';

  // Losing your seat for good should FEEL like a knockout: one defeat sting + a heavy jolt the moment
  // we give up (entering 'lost'), NOT while still trying. Fires once per drop.
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

  // ---- Clean-URL routing (feat/router) ----
  // Keep the URL in sync with the view so refresh/share/deep-links land on the route. Only the four
  // deep-linkable views own a path (home menu, sat-rush, chain, fuse); everything else (lobby, room,
  // game, browse, overlays, cg-arm) leaves the URL as-is. Never rewrites an embed/dev query (?cg=1,
  // ?portal=1, SAT dev flags) — hasStickyQuery guards it. The FIRST sync (boot) replaces (drops the
  // bridged ?query, no history entry); later view changes push (so Back returns to the prior route).
  const didFirstUrlSyncRef = useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hasStickyQuery()) return; // keep embed/dev entries exactly as launched
    const path = canonicalPathForView(view);
    if (path === null) return; // transient view — don't touch the URL
    const here = window.location.pathname;
    // For the home view, any menu path (/, /word-bomb, /category-blitz) is already correct — don't
    // clobber a valid mode-landing URL down to '/'.
    if (path === '/' && (MENU_PATHS.has(here) || here.startsWith('/room/'))) {
      // A valid menu route (/, /word-bomb, /category-blitz) or a /room/CODE deep link that's still
      // resolving — keep the URL; just drop a bridged query if one is present.
      if (window.location.search) window.history.replaceState(window.history.state, '', here);
      didFirstUrlSyncRef.current = true;
      return;
    }
    if (here === path && !window.location.search) return; // already canonical
    const method = didFirstUrlSyncRef.current ? 'pushState' : 'replaceState';
    window.history[method](window.history.state, '', path);
    didFirstUrlSyncRef.current = true;
  }, [view]);

  // Back/forward: map the popped path to a view. Only the safe client-side views are driven from
  // history (menu/sat/chain/fuse); room/game/lobby paths are ignored so the back button never fights
  // the WS/room lifecycle.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onPop = () => {
      const intent = viewIntentFromPath(window.location.pathname);
      if (intent === 'home') goHome();
      else if (intent === 'sat-rush') goToSatRush();
      else if (intent === 'chain') goToChain();
      else if (intent === 'fuse') goToFuse();
      // null intent (/room/*, etc.): leave the app as-is.
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
    // goHome + goTo* are stable within a session; bind once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  // The active game's difficulty tier (chill/easy/medium/hard), mirrored from the room so
  // the WS drain effect (keyed on [messages]) reads it live, never stale — recordRound
  // scales the wins payout by it (DIFFICULTY_MULT). Solo/no-difficulty modes leave it null.
  const gameDifficultyRef = useRef(null);
  useEffect(() => {
    playerCountRef.current = room?.players?.length || 0;
    gameDifficultyRef.current = room?.difficultyKey || null;
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
      // feat/reconnect: a room_update while a rejoin is in flight = we're back in (a waiting/finished
      // room accepted us). Clear the reconnect overlay; the normal handling below restores state.
      if (rejoinPendingRef.current) {
        rejoinPendingRef.current = false;
        rejoinSentRef.current = false;
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
        setReconnect(null);
      }
      setRoom(lastMessage.payload);
      setServerError('');
      setLinkJoinPending(false); // invite-link join answered (we're in)
      // Only fall back to the room view if we're not currently in a game. A
      // room_update can land right after game_started (host start) and would
      // otherwise yank the player back out of the match. The rematch flow sends
      // an explicit game_reset to drive the game -> room transition instead.
      // 'cg-arm' is guarded the SAME way: the cg provisioning add_bot broadcasts a
      // room_update while the player is still on the arm screen — it must NOT pull
      // them into the waiting room; they leave cg-arm only via game_started.
      // Functional update so we read the LIVE view, not the stale `view` captured
      // in this effect's closure (the effect is keyed only on [lastMessage]).
      setView((prev) => (prev === 'game' || prev === 'cg-arm' ? prev : 'room'));
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
      setIsDailyGame(!!lastMessage.payload.daily);
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
      myWbAcceptedRef.current = 0; // fresh game → reset my Wins accept count
      myWbWeightRef.current = 0; // fresh game → reset the rarity weight ledger
      wbComboRef.current = freshCombo(); // fresh game → reset the payout combo
      wbLuckyOracleRef.current = makeLuckyOracle(randomSeed()); // + a fresh lucky stream
      // WPM is no longer tracked in Word Bomb / Category Blitz — they're turn-based, so typing
      // speed there is meaningless (§2). Only the continuous modes + menu record it.
      myOutstandingWordsRef.current = []; // fresh game → drop any stale in-flight submits
      setWinsTally(0); // fresh game → reset the live HUD wins tally + the earned total
      setWinsWords(0);
      setWinsEarnedTotal(0);
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
      // COMBO (parity): if I just lost a life (my turn timed out / was skipped), that's a miss —
      // break my payout combo, mirroring the cosmetic streak's miss() on the same life-loss.
      if (lostPlayers.some((p) => p.id === myIdRef.current)) {
        wbComboRef.current = comboBreak(wbComboRef.current);
      }
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
      // Attribute this result. Prefer a WORD MATCH against my own outstanding submits
      // over the live turn pointer (feedCurrentRef): a turn_update processed just before
      // this frame advances the pointer off me, which used to drop my accepted word from
      // the wins count (see e2e/word-bomb-scoring RACE). A match => it's mine wherever the
      // turn pointer is; no match => fall back to feedCurrentRef (a broadcast accept for
      // another player). Rejections are only sent to the submitter, so those are mine too.
      const resultWord = (payload.word || '').trim().toLowerCase();
      const q = myOutstandingWordsRef.current;
      const qIdx = resultWord ? q.indexOf(resultWord) : -1;
      if (qIdx !== -1) q.splice(qIdx, 1);
      const submitter = feedCurrentRef.current;
      const isMine = qIdx !== -1 || submitter.id === myIdRef.current;
      const attributedId = isMine ? myIdRef.current : submitter.id;
      const playerName = isMine ? myNameRef.current || 'YOU' : submitter.name || 'SOMEONE';
      if (payload.accepted) {
        const now = Date.now();
        // RARITY (word-value): scored for MY own accepted words only (the pop is my feedback);
        // hoisted so the feed event below can carry it. Null for other players' words.
        let wbRarity = null;
        // Lifetime WORDS TYPED + Wins: count ONLY the local player's own accepted words.
        // (Daily flows through this same path and counts as word-bomb — fine.)
        if (isMine) {
          sndWordAccepted(myWbAcceptedRef.current); // Job 11: accept chime, pitch climbs with count
          addWords('word-bomb');
          const prevWb = myWbAcceptedRef.current;
          myWbAcceptedRef.current += 1; // my accepted words this Word Bomb game (for Wins)
          const wbNowWords = myWbAcceptedRef.current; // snapshot for this word's banking gate
          setWinsWords(wbNowWords); // drives the pill's pre-gate state
          const wbWord = payload.word;
          // COMBO + LUCKY (parity): advance the payout combo and draw the lucky oracle NOW, at accept
          // time, and CAPTURE this word's multipliers — so even if scoring defers past the rarity
          // race, the word is weighted by the combo/lucky it had when it landed (order-safe).
          wbComboRef.current = comboAccept(wbComboRef.current);
          const wbComboMult = wbComboRef.current.mult;
          const wbLucky = luckyReward(drawLucky(wbLuckyOracleRef.current));
          if (wbLucky.lucky) noteLucky(); // permanent CHANCE record (guarded)
          // RARITY-DEPENDENT SCORING. Route through whenRarityReady so a word accepted before the
          // lazy rarity index has loaded (the RACE: rarityOf would return COMMON → underpay) is
          // scored the instant the index resolves, in word order, instead of being locked at ×1.
          // When the index is already loaded this runs SYNCHRONOUSLY (this same tick), so wbRarity
          // is set for the feed event below and nothing changes; the deferral is only the rare
          // first-~100ms cold path. Instant feedback (chime, count, pill, feed) already fired above.
          const scoreWbWord = () => {
            const r = rarityOf(wbWord);
            const prevWbWeight = myWbWeightRef.current;
            // Unified economy (Job 1): the per-word reward weight (rarity × combo × lucky, capped at
            // ×40) feeds BOTH the wins banking below AND an XP grant — parity with CHAIN/FUSE.
            const wbWeight = cappedWordMult(r.mult, wbComboMult, wbLucky.winsWeight);
            // WINS weight rides WORD SENSE (Job 4) — a wins multiplier on rarity, outside the ×40 cap.
            myWbWeightRef.current += wbWeight * wordSenseWinsFactor(r.mult);
            awardWordXp({ mode: 'word-bomb', wordLength: (wbWord || '').trim().length, weight: wbWeight });
            recordAcceptedWord(wbWord, { mode: 'word-bomb', band: r.band }); // Collection (Job 3)
            noteWord(wbWord, r); // permanent record: distinct / obscure / rarest-ever (guarded)
            // BANK wins for this word (§2): past the 3-word gate every accepted word banks
            // immediately (leaving mid-game keeps it). Payout rides the rarity WEIGHT delta,
            // gated on the accept COUNT snapshot taken when the word landed.
            const banked = bankWordWins({
              mode: 'wordBomb',
              difficulty: gameDifficultyRef.current,
              prevWords: wbNowWords - 1,
              nowWords: wbNowWords,
              prevWeight: prevWbWeight,
              nowWeight: myWbWeightRef.current,
            });
            if (banked > 0) setWinsEarnedTotal((prev) => prev + banked);
            setWinsTally(
              awardWins({ wordsAccepted: myWbAcceptedRef.current, mode: 'wordBomb', difficulty: gameDifficultyRef.current })
            );
            return r;
          };
          if (isRarityIndexLoaded()) {
            wbRarity = scoreWbWord(); // synchronous — feeds the rarity pop in the feed event below
          } else {
            whenRarityReady(scoreWbWord); // defer: score correctly on resolve, in word order
          }
        }
        setFeedEvents((prev) => [
          ...prev,
          {
            type: 'accepted',
            playerId: attributedId,
            playerName,
            word: payload.word,
            timestamp: now,
            // Rarity tag for MY own accepted words (announce=false for COMMON → the feed shows
            // nothing extra; UNCOMMON+ carry a label + tier colour for the pop).
            rarity: wbRarity && wbRarity.announce ? { label: wbRarity.label, color: wbRarity.color, band: wbRarity.band } : null,
          },
        ]);
        // Tally the accepted word for the end-game stats.
        setGameStats((prev) => ({
          ...prev,
          wordsPlayed: [
            ...prev.wordsPlayed,
            {
              word: payload.word,
              playerId: attributedId,
              playerName,
              timestamp: now,
            },
          ],
        }));
      } else {
        // Rejections are only sent to the player who submitted, so this is
        // always our own miss.
        wbComboRef.current = comboBreak(wbComboRef.current); // a reject ends the payout combo
        sndWordRejected(); // Job 11: soft reject
        setFeedEvents((prev) => [
          ...prev,
          {
            type: 'rejected',
            playerId: attributedId,
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
      myBlitzAcceptedRef.current = 0; // fresh round → reset my Wins accept count
      myBlitzWeightRef.current = 0; // fresh round → reset the rarity weight ledger
      blitzComboRef.current = freshCombo(); // fresh round → reset the payout combo (Blitz pays per round)
      blitzLuckyOracleRef.current = makeLuckyOracle(randomSeed()); // + a fresh lucky stream
      setWinsTally(0); // fresh round → reset the live HUD wins tally (Blitz pays per round)
      setWinsWords(0);
      setPlayerProgress({});
      setRoundResults(null);
      setLastWordResult(null);
      setGameOver(null);
      setCategoryScores(null);
      if (payload.round === 1) {
        setCategoryTotals({}); // fresh game
        categoryTotalsRef.current = {};
        setWinsEarnedTotal(0); // fresh Blitz game → reset the run's earned-wins total
      }
      if (payload.reroll) {
        setLastReroll({ by: payload.by, byId: payload.byId, key: rerollKeyRef.current++ });
      }
      setView('game');
    }

    // AI fallback is judging this answer (list-miss). Show the "checking…"
    // indicator until the authoritative answer_result lands.
    if (lastMessage.type === 'answer_checking') {
      setCheckingAnswer(lastMessage.payload?.answer ?? '');
    }

    if (lastMessage.type === 'answer_result') {
      const payload = lastMessage.payload;
      setCheckingAnswer(null); // result is in - drop the "checking…" state
      // RARITY (word-value): score an accepted answer and carry the verdict on the result so the
      // feedback toast can pop "RARE ×2.5". answer_result is always about MY own answer.
      const blitzRarity = payload.accepted ? rarityOf(payload.answer) : null;
      setLastWordResult(
        blitzRarity && blitzRarity.announce
          ? { ...payload, rarity: { label: blitzRarity.label, color: blitzRarity.color, band: blitzRarity.band } }
          : payload
      ); // reused to drive the feedback toast
      if (payload.accepted) {
        sndWordAccepted(myBlitzAcceptedRef.current); // Job 11: accept chime
        setMyAnswers((prev) => [...prev, payload.answer]);
        addWords('category-blitz');
        myBlitzAcceptedRef.current += 1; // my accepts this Blitz round (for Wins)
        const blitzNowWords = myBlitzAcceptedRef.current; // snapshot for this answer's banking gate
        setWinsWords(blitzNowWords); // drives the pill's pre-gate state
        const blitzAnswer = payload.answer;
        // COMBO + LUCKY (parity): advance at accept time and capture this answer's multipliers, so a
        // deferred (rarity-race) score still weights the answer by the combo/lucky it had on accept.
        blitzComboRef.current = comboAccept(blitzComboRef.current);
        const blitzComboMult = blitzComboRef.current.mult;
        const blitzLucky = luckyReward(drawLucky(blitzLuckyOracleRef.current));
        if (blitzLucky.lucky) noteLucky(); // permanent CHANCE record (guarded)
        // RARITY-DEPENDENT SCORING — same RACE fix as Word Bomb: route through whenRarityReady so an
        // answer accepted before the lazy rarity index loads is scored correctly on resolve (in
        // order), not locked at COMMON ×1. Synchronous when the index is already loaded.
        const scoreBlitzWord = () => {
          const r = rarityOf(blitzAnswer);
          const prevBlitzWeight = myBlitzWeightRef.current;
          const blitzWeight = cappedWordMult(r.mult, blitzComboMult, blitzLucky.winsWeight);
          myBlitzWeightRef.current += blitzWeight * wordSenseWinsFactor(r.mult); // WORD SENSE (Job 4)
          awardWordXp({ mode: 'category-blitz', wordLength: (blitzAnswer || '').trim().length, weight: blitzWeight });
          recordAcceptedWord(blitzAnswer, { mode: 'category-blitz', band: r.band }); // Collection (Job 3)
          noteWord(blitzAnswer, r); // permanent record: distinct / obscure / rarest-ever (guarded)
          const banked = bankWordWins({
            mode: 'blitz',
            difficulty: gameDifficultyRef.current,
            prevWords: blitzNowWords - 1,
            nowWords: blitzNowWords,
            prevWeight: prevBlitzWeight,
            nowWeight: myBlitzWeightRef.current,
          });
          if (banked > 0) setWinsEarnedTotal((prev) => prev + banked);
          setWinsTally(
            awardWins({ wordsAccepted: myBlitzAcceptedRef.current, mode: 'blitz', difficulty: gameDifficultyRef.current })
          );
        };
        if (isRarityIndexLoaded()) scoreBlitzWord();
        else whenRarityReady(scoreBlitzWord);
      } else {
        // A rejected answer is a miss → break the payout combo, mirroring the cosmetic streak's
        // miss() on the same rejected answer_result.
        blitzComboRef.current = comboBreak(blitzComboRef.current);
      }
    }

    if (lastMessage.type === 'player_progress') {
      const { playerId, answerCount } = lastMessage.payload;
      setPlayerProgress((prev) => ({ ...prev, [playerId]: answerCount }));
    }


    if (lastMessage.type === 'round_end') {
      const payload = lastMessage.payload;
      // WINS: already banked per-answer during the round (bankWordWins in answer_result) — NO
      // end-of-round payout here (that would double-pay). winsEarnedTotal already accumulated.
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
        categoryTotalsRef.current = next; // keep the sync mirror current
        return next;
      });
    }

    if (lastMessage.type === 'game_over') {
      const payload = lastMessage.payload;
      sndRunOver(); // Job 11: game-over fall (feat/sound)
      // (No wpmEnd() — fix/three-again §2 removed WPM tracking from the turn-based modes.)
      // Category Blitz carries finalScores; Word Bomb carries just winnerId.
      if (payload.finalScores) {
        setCategoryScores(payload.finalScores);
        setCategoryRound(null);
        setRoundResults(null);
      } else {
        // WINS: already banked per-word during play (bankWordWins in word_result) — NO
        // end-of-game payout here (that would double-pay). winsEarnedTotal already accumulated.
      }
      setGameOver(payload);
      // Daily Challenge completed: fold the result into the persisted streak
      // history, keyed by the SERVER's dayNumber (never the local clock).
      // recordDailyResult is same-day-replay safe (streak counts a day once),
      // so a PLAY-AGAIN-then-finish can't double-increment.
      if (payload.daily && payload.finalScores) {
        const mine = payload.finalScores.find((s) => s.id === myIdRef.current);
        // Authoritative score = the round-sum we tallied (matches the breakdown),
        // with the server scoreboard as a fallback. Using finalScores alone let a
        // missing/mismatched entry record AND show a 0 while rounds scored points.
        const dailyScore = resolveDailyScore(
          categoryTotalsRef.current[myIdRef.current],
          mine ? mine.score : undefined
        );
        // The Daily's OWN previous best (before this run) — the daily screen
        // compares against this, NOT the separate solo-CB personal best.
        const prevDailyBest =
          (dailyStateRef.current && dailyStateRef.current.bestScore) || 0;
        // A REPLAY = today was already recorded before this run. Replays keep your
        // best-of-day (streak counts a day once), so a replay that doesn't beat
        // your best isn't re-recorded — the results screen says so.
        const isReplay =
          !!dailyStateRef.current &&
          dailyStateRef.current.lastDayNumber === payload.daily.dayNumber;
        const next = recordDailyResult(
          dailyStateRef.current,
          payload.daily.dayNumber,
          dailyScore
        );
        saveDailyState(next);
        setDailyState(next);
        // NOTE: the daily STREAK feature was removed — the streak/bestStreak counters
        // are no longer surfaced anywhere. The day-tracking (best score + replay
        // detection via lastDayNumber) stays so the Daily Challenge itself still works.
        setDailyResult({
          dayNumber: payload.daily.dayNumber,
          score: dailyScore,
          prevBest: prevDailyBest,
          isReplay,
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
      // feat/reconnect: an error while a rejoin is in flight = the room's gone (room_not_found) or the
      // game moved on (game_already_started) — we can't return to that live seat. Fall to the
      // wins-preserved landing rather than a dead screen. (Swallow the error toast in this case.)
      if (rejoinPendingRef.current) {
        rejoinPendingRef.current = false;
        rejoinSentRef.current = false;
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
        setReconnect('lost');
        setLinkJoinPending(false);
        continue; // don't also surface this as a generic server error toast
      }
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
  // The setters/refs it calls (incl. useRoom's setMyId/setPublicRooms/setServerError/
  // setRoomClosedNotice + myIdRef) are STABLE React identities — safe to omit, and adding
  // them would defeat the deliberately-trimmed array that guards the documented drain
  // re-run / stale-closure bugs. ESLint can't tell a custom hook's returns are stable:
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // (The Persona-5 bar-wipe helper + the view-change wipe effect moved into hooks/useOverlays.js —
  // refactor/app-split step 1. `runTransition` is destructured from useOverlays above; the gameOver
  // wipe below still fires it from App because it watches `gameOver`, which App owns.)

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
    if (launchFiredRef.current) return;
    // SAT Rush is a SOLO mode (no room/WebSocket): a ?satrush=1 launch link opens
    // the mode directly, on mount, WITHOUT waiting for the socket — pure view
    // navigation that touches no WS handler, the functional setView room guard,
    // or the FIFO message queue. Handled before the wsStatus gate so a solo link
    // never hangs on the multiplayer backend being up.
    if (LAUNCH_INTENT.satrush) {
      launchFiredRef.current = true;
      goToSatRush();
      return;
    }
    // CHAIN / FUSE are solo too — open directly on mount, no socket wait.
    if (SOLO_LAUNCH.chain) {
      launchFiredRef.current = true;
      goToChain();
      return;
    }
    if (SOLO_LAUNCH.fuse) {
      launchFiredRef.current = true;
      goToFuse();
      return;
    }
    if (wsStatus !== 'open') return;
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
    // handleStartDaily / goToSatRush are stable-enough function declarations; this
    // effect only ever fires once (guarded by launchFiredRef).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsStatus, send]);

  // ---- CrazyGames zero-click entry (?cg=1) ----
  // Provision the solo-vs-bot room the moment the socket opens: the same
  // create_room / set_game_type / set_difficulty / add_bot frames, MINUS start_game
  // (held until the player arms). The
  // server processes them in order on this socket, so by the time the player
  // engages the room + bot are seated and start_game is instant. Fires once.
  const cgProvisionFiredRef = useRef(false);
  useEffect(() => {
    if (!CG_ENTRY) return;
    if (wsStatus !== 'open') return;
    if (cgProvisionFiredRef.current) return;
    cgProvisionFiredRef.current = true;
    const name = playerName || resolvePlayerName();
    setPlayerName(name);
    setLobbyMode('word-bomb');
    send('create_room', { name, isPublic: false });
    send('set_game_type', { gameType: 'word-bomb' });
    // Difficulty = the current menu default (first-timers get the gentler CHILL,
    // returning players CRAZY... i.e. medium).
    send('set_difficulty', { difficultyKey: hasPlayedBefore() ? 'medium' : 'chill' });
    send('add_bot', { difficulty: 'medium' });
    // setPlayerName is stable-enough; this effect fires once (guarded by the ref).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsStatus, send]);

  // The arm gesture (first keystroke on desktop / TAP TO START on mobile). Fire
  // start_game ONLY once the room + bot are provisioned; if the player armed
  // during the wake/spin-up, remember it (cgArmPendingRef) and the effect below
  // starts the instant the roster is ready. game_started then swaps us to the
  // live GameScreen (view 'game'), which mounts fresh — so the input is empty
  // when the real combo first renders (the arming key was discarded, never seeded).
  const cgArmedRef = useRef(false);
  const cgArmPendingRef = useRef(false);
  const handleCgArm = useCallback(() => {
    if (cgArmedRef.current) return;
    if (cgRoomReady(room)) {
      cgArmedRef.current = true;
      send('start_game', {});
      track('cg_direct_entry', {});
    } else {
      cgArmPendingRef.current = true;
    }
  }, [room, send]);
  useEffect(() => {
    if (!CG_ENTRY) return;
    if (cgArmedRef.current || !cgArmPendingRef.current) return;
    if (!cgRoomReady(room)) return;
    cgArmedRef.current = true;
    cgArmPendingRef.current = false;
    send('start_game', {});
    track('cg_direct_entry', {});
  }, [room, send]);

  // CrazyGames compliance (cg path only): user-select:none on the body. Scoped by
  // the html.cg-embed class (see index.css) so the default entry is untouched.
  useEffect(() => {
    if (!CG_ENTRY) return;
    document.documentElement.classList.add('cg-embed');
    return () => document.documentElement.classList.remove('cg-embed');
  }, []);

  // Touch vs mouse for the arm screen — computed once (fine=autofocus, coarse=tap).
  const cgCoarse = useMemo(() => isCoarsePointer(), []);

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

  // (goToLobby/handleOpenBrowser/handleRefreshPublicRooms/handleJoinPublicRoom/
  // handleCreatePublicFromBrowser moved into hooks/useRoom.js — refactor/app-split step 2.)

  // (goToStats/goToShop/goToRebirth/goToCredits/goToSatRush/goToChain/goToFuse moved into
  // hooks/useOverlays.js — refactor/app-split step 1; destructured from useOverlays above.)

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
    setIsDailyGame(false);
    setConfirmLeaveDaily(false);
    setGameType('word-bomb');
    setCategoryRound(null);
    setMyAnswers([]);
    setPlayerProgress({});
    setRoundResults(null);
    setCategoryScores(null);
    setCategoryTotals({});
    categoryTotalsRef.current = {};
    setCategoryRerolls(null);
    setLastReroll(null);
    setFeedEvents([]);
    feedCurrentRef.current = { id: null, name: 'SOMEONE' };
    feedPrevLivesRef.current = {};
    feedReasonRef.current = null;
    setGameStats(EMPTY_STATS);
    setTypingText({});
    setReactions([]);
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
      // a preselected 'word-bomb' / 'category-blitz'). No PII.
      track('room_created', { mode });
      // Default a FIRST-TIMER's Word Bomb room to the gentler CHILL tier (20s /
      // 3 lives); returning players keep the server default (CRAZY). 'solo' is a
      // generic create that stays Word Bomb server-side. Ordered after create_room
      // on the same socket. Category Blitz ignores Word Bomb tiers.
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

  // (handleLeaveRoom moved into hooks/useRoom.js — refactor/app-split step 2.)

  // Mid-game LEAVE from the game screen. During a live Daily run, confirm first —
  // leaving forfeits the day's attempt, and a stray tap shouldn't cost it. Any
  // other game (or a finished daily on the results screen) leaves immediately.
  function handleLeaveRequest() {
    if (isDailyGame && !gameOver) {
      setConfirmLeaveDaily(true);
      return;
    }
    handleLeaveRoom();
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
    // Remember my in-flight word so its word_result is attributed to ME by word match,
    // no matter what turn_update lands first (see the word_result handler + myOutstandingWordsRef).
    const w = (word || '').trim().toLowerCase();
    if (w) myOutstandingWordsRef.current.push(w);
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

  // Eliminated spectators fire emoji reactions the server relays to everyone.
  function handleSpectatorReaction(emoji) {
    send('spectator_reaction', { emoji });
  }

  // Whether this client is the room host (drives the host-only REMATCH button
  // on the game-over overlay). room comes from room_update, which carries hostId.
  const isHost = !!room && myId != null && room.hostId === myId;

  // Warm the deferred screen chunks on idle after first paint, so navigating into
  // a lobby/room/game is instant (the Suspense fallback above never actually shows).
  // Scheduled at idle and never blocks the menu's first paint.
  //
  // SLOW-CONNECTION GUARD (JOB D perf/js-split): this warm eagerly pulls ~6 route chunks
  // (GameScreen/Room/Lobby/Public/Stats/Shop) + their CSS. On a fast link that's free idle
  // bandwidth, but on a SLOW link it floods a tiny pipe DURING the menu load and measurably
  // delays time-to-interactive (measured: the whole route graph downloads before the menu's
  // corner-nav even paints, because requestIdleCallback's 2500ms timeout fires mid-load). So
  // when the browser reports a slow/metered connection (Save-Data, or effectiveType 2g/3g) we
  // SKIP the warm entirely — navigation then lazy-loads on demand (the screen-wipe + null
  // Suspense fallback already cover the brief fetch). Fast/unknown connections are unchanged.
  useEffect(() => {
    const conn =
      typeof navigator !== 'undefined' &&
      (navigator.connection || navigator.mozConnection || navigator.webkitConnection);
    if (conn && (conn.saveData || /(^|-)(2g|3g)$/.test(conn.effectiveType || ''))) {
      return; // slow/metered: don't steal the menu's bandwidth — load screens on navigation
    }
    const warm = () => {
      import('./components/GameScreen');
      import('./components/RoomScreen');
      import('./components/LobbyScreen');
      import('./components/PublicRoomsScreen');
      // Overlays too: Stats/Shop open OVER the menu, so a cold chunk fetch there reads as a
      // blank box (the shared Suspense fallback is null). Warming them makes the common open
      // instant; the OverlaySkeleton below covers the rare still-cold open.
      import('./components/StatsScreen');
      import('./components/ShopScreen');
    };
    const ric = typeof window !== 'undefined' && window.requestIdleCallback;
    const id = ric ? ric(warm, { timeout: 2500 }) : setTimeout(warm, 1200);
    return () => {
      if (ric && window.cancelIdleCallback) window.cancelIdleCallback(id);
      else clearTimeout(id);
    };
  }, []);

  // Pick the screen for the current view. It's wrapped in a single keyed
  // slide container below so switching views animates, while in-view updates
  // (player joins, turn_updates) re-render the same screen without replaying.
  let screen;
  // fix/visual-real item 4/2: true when the home MENU is the rendered screen (the else branch
  // below). The menu hosts the sound control inside its own corner-nav cluster, so the global
  // fixed control must be suppressed here — keyed on which screen actually renders, not on `view`
  // alone, so a menu shown under any non-'home' fallback value can never double up the control.
  let isHomeMenu = false;
  if (view === 'game') {
    screen = (
      <GameScreen
        gameState={gameState}
        gameType={gameType}
        gameNonce={gameNonce}
        // cg entry skips the 3-2-1 so the server's ~3s pre-timer window becomes
        // free combo-reading time (timer frozen at full, clock not yet moving).
        cgMode={CG_ENTRY}
        myId={myId}
        isHost={isHost}
        timerSeconds={timerSeconds}
        lastWordResult={lastWordResult}
        // Instant local Word Bomb reject (proposal a): GameScreen surfaces the three
        // client-determinable rejects through the SAME lastWordResult path a server
        // word_result would, so the feedback (buzz/shake/toast) is identical — just
        // same-frame instead of after a round-trip.
        onLocalWordResult={setLastWordResult}
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
        onSubmitWord={handleSubmitWord}
        onSubmitAnswer={handleSubmitAnswer}
        onSkipTurn={handleSkipTurn}
        onTypingUpdate={handleTypingUpdate}
        onLeave={handleLeaveRequest}
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
        winsTally={winsTally}
        winsWords={winsWords}
        winsEarnedTotal={winsEarnedTotal}
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
  } else if (view === 'stats') {
    // Inner Suspense with a skeleton fallback: a cold chunk fetch shows the panel chrome,
    // never an empty box (data itself is synchronous localStorage, so it paints at once).
    screen = (
      <Suspense fallback={<OverlaySkeleton title="STATS" />}>
        <StatsScreen onBack={goHome} />
      </Suspense>
    );
  } else if (view === 'shop') {
    screen = (
      <Suspense fallback={<OverlaySkeleton title={shopViewRef.current === 'rebirth' ? 'REBIRTH' : 'SHOP'} />}>
        <ShopScreen onBack={goHome} initialView={shopViewRef.current} />
      </Suspense>
    );
  } else if (view === SAT_RUSH_VIEW && SAT_RUSH_ENABLED) {
    // Flag-gated placeholder route. Nothing on the menu points here yet; the
    // mode is reachable only with the flag on (?satRush=1) during dev.
    screen = <SatRushGame onExit={goHome} musicSetVolume={music.setVolume} />;
  } else if (view === CHAIN_VIEW && SOLO_MODES_ENABLED) {
    // Flag-gated solo mode, reachable via ?chain=1 (no menu card yet).
    screen = <ChainGame onExit={goHome} />;
  } else if (view === FUSE_VIEW && SOLO_MODES_ENABLED) {
    // Flag-gated solo mode, reachable via ?fuse=1 (no menu card yet).
    screen = <FuseGame onExit={goHome} />;
  } else if (view === RUN_VIEW && RUN_MODE_ENABLED) {
    // THE RUN — solo, no room/WebSocket; routes home on exit like the other solo modes.
    screen = <RunMode onExit={goHome} />;
  } else if (view === 'cg-arm') {
    // CrazyGames arm state: full play layout, timer frozen, start_game held until
    // the player engages. Only reachable on a ?cg=1 session.
    screen = (
      <CgArmScreen wsStatus={wsStatus} coarse={cgCoarse} onArm={handleCgArm} />
    );
  } else {
    isHomeMenu = true;
    screen = (
      <Homepage
        wsStatus={wsStatus}
        serverEventId={serverEventId}
        onSelectGame={(gameId) => goToLobby(gameId)}
        onSatRush={goToSatRush}
        onChain={goToChain}
        onFuse={goToFuse}
        onRun={goToRun}
        onCreateRoom={() => goToLobby('solo')}
        onJoinRoom={handleOpenBrowser}
        onCredits={goToCredits}
        onStats={goToStats}
        onShop={goToShop}
        onRebirth={goToRebirth}
        restoreFocus={overlayReturnRef.current}
        onFocusRestored={() => {
          overlayReturnRef.current = null;
        }}
        blitzPacks={blitzPacks}
        onToggleBlitzPack={handleToggleBlitzPack}
        onSetAllBlitzPacks={handleSetAllBlitzPacks}
        musicMuted={music.isMuted}
        onToggleMusic={music.toggleMute}
        onDaily={handleStartDaily}
        daily={{
          dayNumber: currentDayNumber(),
          played: hasPlayedDay(dailyState, currentDayNumber()),
        }}
      />
    );
  }

  // fix/error-boundaries — wrap the ACTIVE screen (menu / any game screen / any overlay-view) in its
  // OWN boundary, keyed by view so it remounts per screen. A crash inside one screen now shows an
  // inline "THIS SCREEN BROKE — GO BACK" panel + reports to Sentry, while the shell (nav, transitions,
  // the global boundary) stays mounted and the OTHER screens are unaffected. GO BACK returns to the
  // menu (the menu's own boundary reloads, since there's nowhere to go back to from home).
  screen = (
    <ScreenBoundary key={`sb-${view}`} name={view} onBack={isHomeMenu ? null : goHome}>
      {screen}
    </ScreenBoundary>
  );

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

  // The anime fight-card intro plays between the splash dismiss and the homepage
  // reveal. It is NOT an early return: rendering only the intro here would defer
  // the entire menu tree (WallScene + its 12 tags, ParticleField, Homepage, the
  // odometer) until showIntro flips off — i.e. it would all mount at the exact
  // instant the knife-split starts, dumping 300ms+ of layout/paint into the
  // slice's first frames. Instead the normal app tree renders NOW and the intro
  // sits ON TOP as a fixed, opaque, full-viewport black overlay (see the
  // `showIntro && <TransitionIntro/>` mount inside the main return, and
  // .intro-overlay's z-index in TransitionIntro.css). The menu mounts and paints
  // behind the intro's black card where the cost is invisible, its entrance
  // animations run there once (so they don't visibly replay when the slice opens),
  // and the knife then animates over an already-painted menu. The overlay is still
  // a bare calm-black field — the two lines own it, nothing shows through.

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
          <WallScene intensity={bgIntensity} resetKey={view} />
          <ParticleField />
          <div className="view-transition-root">
            {/* a11y (JOB C): the current screen is a <main> LANDMARK so page content is contained
                in a landmark (axe `region`). There is only ever ONE view-screen at a time (keyed on
                `view`, remounted on change; the wipe is a separate cosmetic overlay), so this yields
                exactly one <main>, never two. */}
            <main
              key={view}
              // fix/shop-click (production regression): --app-scale is applied ONLY to the views that
              // want it — via the `app-scaled` class below — NOT to the shared .view-screen base. The
              // full-viewport FIT-TO-SCREEN views (home MENU, SHOP / STATS incl. Collection &
              // Achievements tabs) get NO `zoom` at all. An earlier fix left the CSS
              // `.view-screen { zoom: var(--app-scale) }` in place and overrode it with inline zoom:1,
              // which reports computed:1 but on recent Chrome's standardized `zoom` still applied the
              // CSS zoom VISUALLY — so the menu rendered at --app-scale while hit-testing at true
              // scale, and a real click on a corner button (SHOP/STATS/REBIRTH) landed on the visual
              // gap, credited XP, and never reached the button. Removing the zoom property entirely
              // (rather than overriding it) leaves no zoom to misbehave: visual == hit-test on every
              // browser. GAME views keep the zoom via `.view-screen.app-scaled`.
              className={`view-screen${isHomeMenu || view === 'shop' || view === 'stats' || view === CHAIN_VIEW || view === FUSE_VIEW || view === RUN_VIEW || view === SAT_RUSH_VIEW || view === 'game' ? '' : ' app-scaled'}`}
            >
              {/* One Suspense boundary covers every lazy screen (game/room/lobby/
                  browse/credits). The fallback is DELAYED (null for ~450ms): chunks are
                  idle-prefetched after paint and the screen-wipe overlay covers the swap, so
                  the warmed fast path never sees it — identical to the old fallback={null}.
                  It shows a minimal loader ONLY when a cold/slow fetch outlasts the wipe,
                  where the old code left a blank screen. (fix/loading-states) */}
              <Suspense fallback={<RouteFallback />}>{screen}</Suspense>
            </main>
          </div>
          {transition && !prefersReducedMotion && (
            <TransitionOverlay key={transition.key} word={transition.word} dir={transition.dir} />
          )}
          {/* RETURN BONUS (Job 6): the welcome-back card, only over the home menu. */}
          {returnCard && view === 'home' && (
            <ReturnBonusCard bonus={returnCard} onDismiss={() => setReturnCard(null)} />
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
          {/* feat/offline: a clear NEEDS INTERNET status on the menu when offline — names which modes
              still play (the precached solo ones) and which need the server (Word Bomb / Blitz), so
              those never just fail silently. Same inline status-banner pattern as JOINING ROOM. */}
          {offline && isHomeMenu && (
            <div
              role="status"
              style={{
                position: 'fixed',
                left: '50%',
                bottom: '28px',
                transform: 'translateX(-50%)',
                zIndex: 9000,
                maxWidth: 'min(92vw, 460px)',
                textAlign: 'center',
                fontFamily: "'Space Mono', monospace",
                fontWeight: 700,
                fontSize: '13px',
                letterSpacing: '0.04em',
                color: '#0d0618',
                background: '#FF6B3D',
                border: '2px solid #A63C18',
                borderRadius: '8px',
                boxShadow: '3px 3px 0 #000',
                padding: '10px 16px',
              }}
            >
              OFFLINE — CHAIN, FUSE &amp; SAT RUSH STILL PLAY. WORD BOMB &amp; CATEGORY BLITZ NEED INTERNET.
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
          {/* ONE corner sound control (Job 11): a single 🔊 button that opens a popover holding all
              three toggles — MUSIC / KEYSTROKE / EVENTS — plus volume. Replaces the three separate
              floating fixed buttons (music ♫ / clack ⌨ / events 🔊) that, side by side, overlapped
              the menu's CREDITS footer link at 360px. Music state is owned by App's player.
              fix/visual-real item 4: on the HOME menu this global fixed control is suppressed — the
              menu renders the same control INSIDE its corner-nav cluster instead (no orphan fixed
              UI). Every other screen (no corner-nav to join) keeps the bottom-right control. */}
          {!isHomeMenu && (
            <AudioControls
              accent={SCREEN_ACCENT[view] || '#2EFFE0'}
              musicMuted={music.isMuted}
              onToggleMusic={music.toggleMute}
            />
          )}
        </div>
      </div>
      {/* CONNECTION LOST: shown only when the socket drops mid room/game. The
          seat can't be resumed (fresh connection id server-side), so the single
          action is BACK TO MENU, which runs the normal leave/reset path (goHome).
          Styled/animated in Transitions.css; the defeat sting + heavy jolt fire
          from the effect that watches connectionLost above. */}
      {/* feat/reconnect — phase 1: RECONNECTING. The board stays mounted behind this; we're
          re-opening the socket (backoff) and trying to rejoin by code. No BACK-TO-MENU yet — give
          the blip a moment. Static (no idle spinner) per the animation budget. */}
      {reconnect === 'trying' && (
        <div className="connlost-overlay" role="alertdialog" aria-label="Reconnecting">
          <div className="connlost-mascot">
            <Mascot pose="panic" emote="flinch" size={110} />
          </div>
          <div className="connlost-title">RECONNECTING…</div>
          <div className="connlost-sub">
            Lost the connection. Trying to get you back into the game — hang tight.
          </div>
          <button
            className="connlost-btn"
            onClick={() => {
              if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
              rejoinSentRef.current = false;
              rejoinPendingRef.current = false;
              setReconnect(null);
              goHome();
            }}
          >
            LEAVE TO MENU
          </button>
        </div>
      )}
      {/* feat/reconnect — phase 2: couldn't return (the live game moved on / room gone). The seat
          can't be resumed without a protocol change, but WINS are banked per word in localStorage,
          so nothing earned is lost. Land on the menu, never a blank screen. */}
      {reconnect === 'lost' && (
        <div className="connlost-overlay" role="alertdialog" aria-label="Connection lost">
          <div className="connlost-mascot">
            <Mascot pose="panic" emote="flinch" size={110} />
          </div>
          <div className="connlost-title">CONNECTION LOST</div>
          <div className="connlost-sub">
            Couldn't get back into that game — it moved on without you. Your wins are safe; jump back to the menu to play again.
          </div>
          <button
            className="connlost-btn"
            onClick={() => {
              setReconnect(null);
              goHome();
            }}
          >
            BACK TO MENU
          </button>
        </div>
      )}
      {/* LEAVE MID-DAILY confirmation: the Daily is a one-shot streak run, so a
          stray LEAVE tap shouldn't silently forfeit it. Reuses the connlost
          overlay styling with a two-button choice. */}
      {confirmLeaveDaily && (
        <div className="connlost-overlay" role="alertdialog" aria-label="Leave the Daily Challenge?">
          <div className="connlost-title">LEAVE THE DAILY?</div>
          <div className="connlost-sub">
            You're mid-run. Leaving now forfeits today's attempt — it won't count toward your streak.
          </div>
          <div className="daily-leave-actions">
            <button className="connlost-btn" onClick={() => setConfirmLeaveDaily(false)}>
              KEEP PLAYING
            </button>
            <button
              className="connlost-btn daily-leave-danger"
              onClick={() => {
                setConfirmLeaveDaily(false);
                handleLeaveRoom();
              }}
            >
              LEAVE ANYWAY
            </button>
          </div>
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
      {/* Fight-card intro overlay. Mounted on TOP of the already-rendered menu
          (fixed, opaque, full-viewport — z-index below CursorTrail so the cursor
          trail still draws over it, above all menu chrome so nothing shows
          through). The menu underneath has already mounted + painted, so the knife
          animates over it with no first-frame mount cost. */}
      {showIntro && <TransitionIntro onComplete={handleIntroComplete} />}
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