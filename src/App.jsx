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
import {
  CHAIN_VIEW,
  FUSE_VIEW,
  SOLO_LAUNCH,
  SOLO_MODES_ENABLED,
} from './solo/config';
import { CG_ENTRY } from './cg/cgEntry';
import { useWebSocket } from './hooks/useWebSocket';
import { useOverlays } from './hooks/useOverlays';
import { useRoom } from './hooks/useRoom';
import { useProgressionEvents } from './hooks/useProgressionEvents';
import { useGameSocket } from './hooks/useGameSocket';
import { useConnectivity } from './hooks/useConnectivity';
import { useSessionPresence } from './hooks/useSessionPresence';
import { useReturnBonus } from './hooks/useReturnBonus';
import { useScreenShake } from './hooks/useScreenShake';
import { useGlobalButtonFeedback } from './hooks/useGlobalButtonFeedback';
import { useFirstGestureMusic } from './hooks/useFirstGestureMusic';
import { useUrlSync } from './hooks/useUrlSync';
import { useCgEntry } from './hooks/useCgEntry';
import { useIntroSequence } from './hooks/useIntroSequence';
import { useAchievementsOnHome } from './hooks/useAchievementsOnHome';
import { useMusicPlayer } from './hooks/useMusicPlayer';
import { useBeatSync } from './hooks/useBeatSync';
import { useSoundEffects } from './hooks/useSoundEffects';
import { SoundContext } from './contexts/SoundContext';
import { buildPlayerColors } from './playerColors';
import { resolvePlayerName, rememberName } from './playerName';
import {
  hasSeenIntro,
  hasPlayedBefore,
  getLastSeen,
} from './visitHistory';
import ReturnBonusCard from './components/ReturnBonusCard';
import ScreenBoundary from './components/ScreenBoundary';
// COMBO + LUCKY parity (feat/parity-wb-blitz): the SAME pure modules CHAIN/FUSE use, reused
// verbatim (no forked logic) so Word Bomb + Category Blitz score identically — a consecutive-accept
// combo multiplier and a 1/40 lucky ×5, both folded into the per-word reward weight.
import { freshCombo } from './progress/combo';
import { makeLuckyOracle, randomSeed } from './progress/luck';
import { noteSession } from './progress/records';
import { loadRarityIndex } from './progress/rarityIndex';
import {
  hasPlayedDay,
  currentDayNumber,
} from './daily/streak.js';
import { useOneShotAction } from './hooks/useOneShotAction';
import { track } from './lib/analytics';
import { setMuted as setJuiceMuted } from './juice';
import { SCREEN_ACCENT, isPreselectableGame, drawLucky } from './appConfig';

import { Analytics } from '@vercel/analytics/react';
import './Transitions.css';

// (SCREEN_ACCENT + PRESELECTABLE_GAMES + isPreselectableGame + drawLucky moved into src/appConfig.js
// — refactor/app-split-6; pure, side-effect-free helpers. TRANSITION_WORDS + NAV_DEPTH moved into
// hooks/useOverlays.js — refactor/app-split step 1.)

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

  // Session presence: last-seen stamps on load + pagehide/beforeunload, so the intro's session
  // boundary measures absence from the SITE. Extracted verbatim to hooks/useSessionPresence.js —
  // refactor/app-split-6.
  useSessionPresence();

  // RETURN BONUS (Job 6): claim once on mount using the last-seen time captured at module load.
  // Extracted verbatim to hooks/useReturnBonus.js — refactor/app-split-6; the card is shown only on
  // the home menu (a deep-link into a game doesn't overlay the return card).
  const { returnCard, setReturnCard } = useReturnBonus(LAST_SEEN_AT_LOAD);

  // ACHIEVEMENTS (Job 7): re-evaluate on landing on the home menu. Extracted verbatim to
  // hooks/useAchievementsOnHome.js — refactor/app-split-6.
  useAchievementsOnHome(view);

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

  // feat/offline: connectivity (Word Bomb / Category Blitz need the server; CHAIN / FUSE / SAT RUSH
  // stay playable offline). Extracted verbatim to hooks/useConnectivity.js — refactor/app-split-6.
  const offline = useConnectivity();

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

  // The loading -> splash -> fight-card intro -> knife-split reveal lifecycle (intro chrome only).
  // Extracted verbatim to hooks/useIntroSequence.js — refactor/app-split-6. Seeded from the
  // module-load SKIP_INTRO / SEEN_INTRO flags; the handlers are fired by the splash/intro/knife
  // components in the render below.
  const {
    loadingDone,
    setLoadingDone,
    showSplash,
    showIntro,
    slicing,
    handleSplashStart,
    handleSplashDismiss,
    handleIntroComplete,
    handleSliceComplete,
  } = useIntroSequence({ music, sound, skipIntro: SKIP_INTRO, seenIntro: SEEN_INTRO });

  // Music starts on the FIRST user gesture anywhere on the site (splash-session volume choreography
  // preserved). Extracted verbatim to hooks/useFirstGestureMusic.js — refactor/app-split-6.
  useFirstGestureMusic({ sound, music, showSplash });

  // Beat sync: while music is audibly playing, drive global --beat-* CSS vars
  // (and the data-beat attribute) off the live frequency analysis so animations
  // pulse with the track. beatCount increments per detected beat, which we use
  // to fire a light app-wide shake.
  const { beatCount } = useBeatSync(
    music.getFrequencyData,
    music.isPlaying && !music.isMuted
  );

  // App-wide screen shake (light=beat, medium=accept, heavy=explosion/game over) + the in-game
  // beat-driven light shake. Extracted verbatim to hooks/useScreenShake.js — refactor/app-split-6.
  const { shake, triggerShake } = useScreenShake({ view, beatCount });

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

  // View<->DOM/URL reflection (data-view attribute + clean-URL history sync + popstate back/forward).
  // Extracted verbatim to hooks/useUrlSync.js — refactor/app-split-6. Touches none of the WS/view
  // traps: it only reflects the already-chosen view onto <html> and the URL.
  useUrlSync({ view, goHome, goToSatRush, goToChain, goToFuse });

  // App-wide, document-delegated button feedback (hover blip + press squash/tick). Extracted
  // verbatim to hooks/useGlobalButtonFeedback.js — refactor/app-split-6.
  useGlobalButtonFeedback(sound);

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

  // WS drain extracted to useGameSocket (refactor/app-split-4 step 4). The hook runs the
  // FIFO-queue drain effect verbatim; it receives every component-scope setter/ref/value it
  // closes over here so App's render + other effects stay byte-identical.
  useGameSocket({
    blitzComboRef, blitzLuckyOracleRef, categoryTotalsRef, consumeMessages, dailyStateRef, drawLucky, 
    feedCurrentRef, feedPrevLivesRef, feedReasonRef, gameDifficultyRef, gameModeRef, gameStartMsRef, 
    messages, myBlitzAcceptedRef, myBlitzWeightRef, myIdRef, myNameRef, myOutstandingWordsRef, 
    myWbAcceptedRef, myWbWeightRef, playerCountRef, reactionIdRef, reconnectTimerRef, rejoinPendingRef, 
    rejoinSentRef, rerollKeyRef, setCategoryRerolls, setCategoryRound, setCategoryScores, setCategoryTotals, 
    setCheckingAnswer, setDailyResult, setDailyState, setFeedEvents, setGameNonce, setGameOver, 
    setGameState, setGameStats, setGameType, setIsDailyGame, setLastReroll, setLastWordResult, 
    setLinkJoinPending, setMyAnswers, setMyId, setPlayerProgress, setPublicRooms, setReactions, 
    setReconnect, setRoom, setRoomClosedNotice, setRoundResults, setServerError, setServerEventId, 
    setTimerSeconds, setTypingText, setView, setWinsEarnedTotal, setWinsTally, setWinsWords, 
    wbComboRef, wbLuckyOracleRef, 
  });

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
  // The provision-on-open + arm-gesture + cg-embed body class + coarse-pointer memo. Extracted
  // verbatim to hooks/useCgEntry.js — refactor/app-split-6 (inert unless CG_ENTRY). It fires WS
  // sends but touches none of the WS drain / view traps.
  const { handleCgArm, cgCoarse } = useCgEntry({
    send, wsStatus, room, playerName, setPlayerName, setLobbyMode,
  });

  // Wipe to the homepage the moment the socket comes up (connecting -> open).
  const prevWsRef = useRef(wsStatus);
  useEffect(() => {
    const prev = prevWsRef.current;
    prevWsRef.current = wsStatus;
    if (prev !== 'open' && wsStatus === 'open') {
      runTransition('READY?'); // the bars sweep (whoosh no-ops if audio isn't unlocked)
    }
  }, [wsStatus, runTransition]);

  // (handleSplashStart/handleSplashDismiss/handleIntroComplete/handleSliceComplete moved into
  // hooks/useIntroSequence.js — refactor/app-split-6; destructured from useIntroSequence above.)

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
              className={`view-screen${isHomeMenu || view === 'shop' || view === 'stats' || view === CHAIN_VIEW || view === FUSE_VIEW || view === SAT_RUSH_VIEW || view === 'game' ? '' : ' app-scaled'}`}
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