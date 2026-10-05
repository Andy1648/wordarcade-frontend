// Homepage.jsx
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { lazyWithReload } from '../lib/chunkReload';
import { rollsEnabled } from '../progress/rollsFlag';
import { GAMES } from '../gameData';
import { useSound } from '../contexts/SoundContext';
import { squash, flash, burst, sfx, setMuted as setJuiceMuted } from '../juice';
import { useMagneticPull } from '../lib/magneticPull';
import GameCard from './GameCard';
import { MenuXpBar, MenuXpFx } from './MenuXp';
import LiveWpm from './LiveWpm';
import { useXpCapture } from '../progress/useXpCapture';
import { letterXpNow } from '../progress/letterXp';
import { useWinsBalance } from '../progress/useWinsBalance';
import { getWinsLifetime, consumePendingWinsStamp, hasSeenWinsHint, markWinsHintSeen } from '../progress/wins';
import { consumePendingRebirth, getRebirths, rebirthThreshold } from '../progress/xp';
import { peekRebirthNow, takeRebirthNow, isRebirthReadyNow } from '../progress/rebirthNow';
import RebirthReadyButton from './RebirthReadyButton';
import { rebirthRushNotice, clearRebirthRushNotice } from '../progress/econMigrate';
import { getStreak } from '../progress/streak';
import { modeOpened as evModeOpened, lockedModeClicked as evLockedModeClicked, firstWinsEarned as evFirstWinsEarned, streakDay as evStreakDay, refreshSessionProps } from '../lib/events.js';
import { canAffordAny, buyKeyPower } from '../progress/shop';
import { runAutomation } from '../progress/stars';
import { isModeLocked } from '../progress/modeAccess';
import { peakLevel } from '../progress/peakLevel';
// unlock-ladder: FRAME cosmetics + the NEXT-unlock teaser. The ladder's THEME half was dropped
// on merge — main's themes system (syncThemeUnlocks above) supersedes it — so this only supplies
// LV-badge frames now (see unlockLadder.js LADDER, frames-only).
import { grantUnlocks, grantRebirthUnlock, getFreeUnlocks, currentCosmetic } from '../progress/unlockLadder';
import MenuFrame from './MenuFrame';
import { menuTier, getSeenTier, setSeenTier, TIER_NAMES, MILESTONE_MAX_HOLD_MS } from '../progress/menuTier';
import { flagOn } from '../lib/featureFlags';
import { noteWallLevel, wallTierFor, getWallTier, WALL_FX_DONE_EVENT } from '../progress/wallTier';

import ScreenBoundary from './ScreenBoundary';
// E6: MARKS opens on a tap — its own lazy chunk, out of the homepage's initial payload
// MARK ROLLS ship dormant behind rollsFlag (rule P held them, PR #156): the legacy panel until Andy turns rolls on.
// With rolls ON, MARKS opens the full-screen ROLL screen (Andy oct5); its INDEX button opens the MARKS INDEX.
const ROLLS = rollsEnabled();
const MarksIndex = ROLLS
  ? lazyWithReload(() => import('./rollScreen/RollScreen'), 'RollScreen')
  : lazyWithReload(() => import('./MarksIndexLegacy'), 'MarksIndexLegacy');
import { markById, unlockedMarks, getEquippedMark, hasUnseenMarks, markMarksSeen, takeMarkRankUp, MARK_RANK_NAMES, markBlurbAt, marksRevealed, equipMark } from '../progress/marks';
import { wornMarkId, markEntry, loadRollState } from '../progress/markRollsCore'; // the menu chip only — the roll system is lazy with MARKS
import { useGems } from './gems/GemChip';
import { canAffordRoll } from '../progress/gemsCore';
import { ACHIEVEMENTS, loadEarned } from '../progress/achievements';

// The achievement each mark comes from, by name — the locked cards say what to go and do rather
// than showing a silhouette, because a mark you cannot have is only interesting if it is a goal.
const ACH_NAME = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a.secret ? 'A SECRET' : a.name]));
import Spotlight from './Spotlight';
import { hasSeenMenuSpotlight, markMenuSpotlightSeen, markMenuSeen } from '../progress/onboarding';
import AudioControls from './AudioControls';
import ConnectingContent from './ConnectingContent';
import MobileMenu from './MobileMenu';
import ClaimPopup from '../claims/ClaimPopup.jsx';
import { useClaims } from '../claims/useClaims.js';
import { queueClaim, trimClaimInbox } from '../progress/claims.js';
import PodiumIcon from './PodiumIcon';
import { moments } from '../lib/moments';
import { momentOpts, MENU_MOMENTS, CARD_MS, WALL_SETTLE_MS } from '../lib/menuMoments';
import { useMomentHold } from '../lib/useMomentSlot';
import { LEADERBOARD_ENABLED, submitStats as submitBoardStats, checkRankUp, markBoardSeen, getBoardSeenEpoch, hasRankNews, setRankNews, getLastRank, restoreFromCloud, hasDevResetNotice, clearDevResetNotice } from '../leaderboard/client.js';
// Rare one-shot moments ride their own lazy chunks: they render on a tiny fraction of menu visits,
// so they stay out of the homepage's initial payload (e2e/payload-budget ratchet).
// CARD PAGES controls (arrows, dots, keys, swipe): only a short-wide desktop ever fetches these.
const CardPager = lazyWithReload(() => import('./CardPager.jsx'), 'CardPager');
const RankUpMoment = lazyWithReload(() => import('../leaderboard/RankUpMoment.jsx'), 'RankUpMoment');
const DevResetNotice = lazyWithReload(() => import('../leaderboard/DevResetNotice.jsx'), 'DevResetNotice');
// T (Andy oct2): the unlock tutorials — lazy, mounted only on a settled menu past LV1 (see below)
// Overlays that only render when opened load on first open (payload ratchet; H2 batch offset).
const LockedPreviewDialog = lazyWithReload(() => import('./LockedPreviewDialog'), 'LockedPreviewDialog');
const RankLadder = lazyWithReload(() => import('./RankLadder'), 'RankLadder');
// The REWARDS panel loads on first open (H4 payload offset): only the small ClaimPopup is on the menu at rest.
const ClaimsPanel = lazyWithReload(() => import('../claims/ClaimsPanel.jsx'), 'ClaimsPanel');
// The mode dialog loads on demand (payload ratchet, PV10 offset): fetched the moment a pointer or focus first
// enters the menu (long before a card can be clicked), so the first open never waits on the network.
const loadModeDialog = () => import('./ModeDialog');
const ModeDialog = lazyWithReload(loadModeDialog, 'ModeDialog');
let modeDialogWarm = false;
const warmModeDialog = () => {
  if (modeDialogWarm) return;
  modeDialogWarm = true;
  loadModeDialog().catch(() => { modeDialogWarm = false; });
};
// The NEW SYSTEM / NEW MARK reveal sticker loads when a claim reveals (payload ratchet).
const ClaimReveal = lazyWithReload(() => import('../claims/ClaimReveal.jsx'), 'ClaimReveal');
const TutorialHost = lazyWithReload(() => import('../tutorials/TutorialHost.jsx'), 'TutorialHost');
import LiveTicker from '../leaderboard/LiveTicker.jsx';
import { announceTick, isLevelMilestone } from '../leaderboard/live.js';
import useMediaQuery from '../lib/useMediaQuery';
import { formatNum } from '../format';
import { hasPlayedBefore } from '../visitHistory';
import './wall-system.css';
import './Homepage.css';
import './MobileMenu.css';

// PHONE FIRST SCREEN (feat/mobile-first-screen). At or below this width the menu renders as
// three full-width typographic rows instead of the card grid — see MobileMenu.jsx. This is a
// RENDER branch, not a CSS one, because the win is the ~390 card nodes never mounting.
const PHONE_MENU_QUERY = '(max-width: 480px)';

// CHROMEBOOK PAGES (feat/chromebook-card-pages, Andy oct5: "game cards are flattened and look
// horrendous" at 1366x657 / 1280x551). A short-wide desktop cannot give six cards a 3:4 box at a
// readable width — the fit-math fell back to SQUAT cards. On these viewports the menu shows
// CARDS_PER_PAGE cards at the full 3:4 ratio and flips between pages (arrows, swipe, ←/→ keys) with
// a two-dot indicator. Tall screens (> 700px) and anything ≤ 760px wide keep their layout exactly.
const PAGED_MENU_QUERY = '(min-width: 761px) and (max-height: 700px)';
const CARDS_PER_PAGE = 3;
const CARD_PAGES = Math.ceil(GAMES.length / CARDS_PER_PAGE);

// How long a queued connect attempt shows the plain CONNECTING… state before we
// assume a COLD START (the Render free tier sleeps when idle and takes ~30-60s to
// wake) and switch to the reassuring WAKING THE SERVER… copy — a static spinner
// reads as broken over that long, so people bail. Named production default; a
// dev/test override (?coldstart=<ms>, 0-60000) lets E2E trip the phase-2 copy
// without a real 4s wait. The connect/auto-fire flow itself is untouched.
const COLD_START_HINT_MS = 4000;
function coldStartHintMs() {
  try {
    const raw = new URLSearchParams(window.location.search).get('coldstart');
    if (raw != null) {
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 0 && n <= 60000) return n;
    }
  } catch {
    /* location unavailable — fall back to the default */
  }
  return COLD_START_HINT_MS;
}

/**
 * The lobby/homepage screen. Clicking a card or an action button calls the
 * matching passed-in handler from App (which owns the create/join room flow and
 * WebSocket wiring). The handlers are guarded so a missing one is simply a no-op.
 */
// STEP 58 (Andy oct2: "SHOP / REBIRTH sit at the bottom and feel odd"): where the menu's nav
// cluster lives. Three layouts were built and compared (claude/menu-layout/) — 'top' won; 'stack'
// (the old desktop corner column + phone bottom strip) and 'rail' stay reachable with ?nav= for a
// side-by-side look. Read once at module load: a layout never changes under a mounted menu.
const NAV_LAYOUTS = ['top', 'rail', 'stack'];
const NAV_LAYOUT = (() => {
  try {
    const q = new URLSearchParams(window.location.search).get('nav');
    return NAV_LAYOUTS.includes(q) ? q : 'top';
  } catch {
    return 'top';
  }
})();

// One cloud check per PAGE LOAD (restore + the dev's reset flag) — see the effect below.
let cloudBootChecked = false;

export default function Homepage({ onSelectGame, onPlaySolo, onRaceQuickMatch, onCreateRoom, onJoinRoom, onQuickPlay, onCredits, onStats, onLeaderboard, onShop, onRebirth, onSatRush, onChain, onFuse, wsStatus, serverEventId, blitzPacks, onToggleBlitzPack, onSetAllBlitzPacks, restoreFocus = null, onFocusRestored, musicMuted = false, onToggleMusic }) {
  // Once any navigation action fires we're about to transition away; lock the
  // buttons so a rapid second click can't double-fire. State resets naturally
  // because the component unmounts on the screen change.
  const [navigating, setNavigating] = useState(false);
  // True on phones (<=480px). Drives the whole first-screen swap below.
  const isPhoneMenu = useMediaQuery(PHONE_MENU_QUERY);
  // Short-wide desktop (Chromebook / 125%-scaled laptop): the card row pages, 3 full-ratio cards a page.
  const isPagedMenu = useMediaQuery(PAGED_MENU_QUERY) && !isPhoneMenu;
  const [cardPage, setCardPage] = useState(0);
  // The phone menu's TYPE A WORD hook (WordHook.jsx) is for visitors who have never started a
  // game. Read once per mount: starting a round navigates away, so it is gone on the way back.
  const [firstTimer] = useState(() => !hasPlayedBefore());
  // CONNECT-GATING: the socket connects in the background while this menu is
  // already live (a cold Render backend can take 30-60s). If the user fires a
  // connect-dependent action (CREATE / JOIN) before the socket is open we must
  // NOT no-op: we mark that control "CONNECTING…", stash the intent, and the
  // effect below fires the SAME action the instant wsStatus flips to 'open'. When
  // the socket is already open this path is byte-identical to firing immediately.
  const [connecting, setConnecting] = useState(null); // 'create' | 'join' | null
  const pendingActionRef = useRef(null);

  // Run a connect-dependent action now if the socket is open; otherwise record
  // the intent (and which control to show "CONNECTING…" on) for auto-fire.
  function runWhenConnected(controlId, action) {
    // Mark the control pending on BOTH paths. On the warm path (socket already
    // open) the action fires immediately, but for quickplay/daily it only SENDS
    // create+start over the socket — the view doesn't change until game_started
    // lands — so without this the button would show nothing but opacity 0.6 for
    // the whole round-trip. (For CREATE/JOIN, whose action changes the view
    // synchronously, this commits in the same batch as the view swap and never
    // paints, so the warm path stays instant.) The pending state is cleared on the
    // serverEventId bump (see the effect below), not here.
    setConnecting(controlId);
    if (wsStatus === 'open') {
      action();
    } else {
      pendingActionRef.current = action;
    }
  }

  // Fire the one queued intent the moment the socket opens (warm path leaves this
  // a no-op - nothing was ever queued, so no "CONNECTING…" flash). We deliberately
  // do NOT clear `connecting` here: the socket opening is only the FIRST half of
  // the wait — quickplay/daily then round-trip create+start before the view flips
  // on game_started. The pending state is cleared on the serverEventId bump below.
  useEffect(() => {
    if (wsStatus === 'open' && pendingActionRef.current) {
      const action = pendingActionRef.current;
      pendingActionRef.current = null;
      action();
    }
  }, [wsStatus]);

  // Clear the pending state when a server frame actually RESOLVES — serverEventId
  // (App.jsx) bumps once per drain carrying room_update/game_started/etc, i.e. the
  // moment the view is about to change. This keeps the spinner up through the whole
  // wait (connect + the create→start round-trip) instead of dying the instant the
  // socket opens. On the home screen no resolving frames arrive until our own
  // action triggers them, so this only ever fires for the action we started; the
  // mount run is a no-op (connecting is already null).
  useEffect(() => {
    setConnecting(null);
    pendingActionRef.current = null;
  }, [serverEventId]);

  // COLD-START HINT (presentation only): while a connect attempt is pending and
  // the socket still isn't open, arm a per-attempt timer; when it fires we flip
  // the pending control from CONNECTING… to the WAKING THE SERVER… copy. Reset the
  // instant the attempt clears or the socket opens, and the effect's cleanup
  // clears the timer on any of those + on unmount. This layers ON TOP of the
  // connect/auto-fire flow above without changing it.
  const [coldStart, setColdStart] = useState(false);
  useEffect(() => {
    if (connecting && wsStatus !== 'open') {
      const t = setTimeout(() => setColdStart(true), coldStartHintMs());
      return () => clearTimeout(t);
    }
    setColdStart(false);
    return undefined;
  }, [connecting, wsStatus]);
  // The card currently hovered (drives the mascot's reaction pose).
  const [hoverGame, setHoverGame] = useState(null);
  const [showRanks, setShowRanks] = useState(false); // rank-ladder overlay (fix/card-polish)
  // MARKS (feat/progression-clarity): the one equipped badge, and its picker. Read once on mount
  // and after an equip — the earned-achievement set only changes on a grant, which re-renders the
  // menu anyway.
  const [showMarks, setShowMarks] = useState(false);
  // REWARDS (Andy oct2): non-game rewards wait here until claimed; the button + its count only
  // exist while something is pending (the badge IS the notification).
  const claims = useClaims();
  const [showClaims, setShowClaims] = useState(false);
  const [claimReveal, setClaimReveal] = useState(null); // the NEW SYSTEM / NEW MARK reveal sticker
  // MARK ROLLS: the worn MAIN may be a ROLLED id (marks.js getEquippedMark only knows the legacy ones)
  const [equippedMark, setEquippedMark] = useState(() => wornMarkId());
  const earnedAch = loadEarned();
  const markUnlocked = unlockedMarks(earnedAch);
  const [marksNew, setMarksNew] = useState(() => hasUnseenMarks(markUnlocked.map((m) => m.id)));
  // E4: a new mark is owned the moment it unlocks (no inbox), so re-check on every claims event —
  // the MARKS button then says NEW MARK without waiting for the next menu mount.
  const markIdsKey = markUnlocked.map((m) => m.id).join(',');
  // a STABLE list for MARKS (keyed on its content, not a fresh array per render — the roll review's
  // must-fix 1: a new array every render made the index re-read storage mid-reveal)
  const markIdList = useMemo(() => (markIdsKey ? markIdsKey.split(',') : []), [markIdsKey]);
  useEffect(() => {
    if (hasUnseenMarks(markIdsKey ? markIdsKey.split(',') : [])) setMarksNew(true);
  }, [markIdsKey, claims]);
  // First-run MENU spotlight: shown once ever, dismissed by the first key/click (which still
  // counts). Init from the persisted flag so it never flashes for a returning player.
  const [showMenuSpot, setShowMenuSpot] = useState(() => !hasSeenMenuSpotlight());
  // T: unlock tutorials mount once the menu has settled (the arrival wipe) and the mount-time moments — a
  // rank-up waits on the network — have announced themselves; from there the queue orders them (H5)
  const [tutReady, setTutReady] = useState(false);
  useEffect(() => { const t = setTimeout(() => setTutReady(true), 4500); return () => clearTimeout(t); }, []);
  const dismissMenuSpot = () => { markMenuSpotlightSeen(); setShowMenuSpot(false); };
  // "This browser has seen the menu" — recorded on MOUNT (not on any interaction), because the
  // only reader is the solo run-over offer, which exists to pitch the rest of the game to a
  // stranger who has never been here. Seeing the menu at all disqualifies you from that pitch.
  useEffect(() => { markMenuSeen(); }, []);
  // The mode whose expand-dialog is open: { game, el } (el = the clicked card
  // element, measured for the FLIP morph). Null when no dialog is showing.
  const [dialog, setDialog] = useState(null);
  // The locked mode whose read-only preview is open ({ game }), or null. Opened by clicking
  // a level-gated CHAIN/FUSE card; closes on scrim/Escape/✕. No play button.
  const [lockedPreview, setLockedPreview] = useState(null);
  const { sound, muted } = useSound();

  // Magnetic cursor-pull on the JOIN CTA (wrapper div, so the button's own
  // :hover/:active transforms compose underneath). Gated to fine-pointer + motion
  // (see useMagneticPull).
  const joinMagnetRef = useRef(null);
  useMagneticPull(joinMagnetRef, { max: 8, base: 6 });

  // ---- Cards peek-scroll region (presentational) -------------------------------
  // The 3-column grid can wrap to >1 row; the region shows one full row + a peek of
  // the next and a "N MORE" pager scrolls down a row at a time. --rowh (the row-1
  // card height incl. its stagger margin) is MEASURED here on mount + resize and
  // written as a CSS var; the accept path never measures.
  // ---- Container-driven menu scale (item 1: title↔XP collision + fit/fill) ------
  // The stage is a fit-to-height flex column. We measure the available inner height
  // once on mount + on resize and derive --menu-scale — the factor the TITLE, CARD
  // GRID and XP BAR all key off — so the menu shrinks to fit short screens (no
  // overlap, no overflow) and the tall card region fills large screens. Capped at 1
  // (never grows past the tuned base sizes); floored so it never becomes illegible.
  const stageRef = useRef(null);
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    // PHONE: none of this fit-math applies — the phone menu is a plain flex column that sizes
    // itself, and every element this measures (corner nav, XP cluster, card grid) is unmounted
    // at that width. Bailing here also keeps the resize handler's layout reads off phones.
    if (isPhoneMenu) return undefined;
    let raf = 0;
    // ---- CARD FIT (fix/card-fit-height) ------------------------------------------------------
    // The cards used to be the largest 3:4 box the region's HEIGHT allowed, so a short laptop got
    // a 171px card and its payout line ran 56-126px off the edge. Now a card has a MINIMUM width —
    // what its own text needs at the type floor — and a viewport that cannot give it that width at
    // 3:4 gets a different ARRANGEMENT, never a smaller card:
    //   1. 'normal' — the old layout; 3:4 cards if they clear the minimum, otherwise cards that
    //      keep the minimum width and take a squatter box (the scene is slice-to-cover).
    //   2. 'short'  — the stage re-flows (Homepage.css [data-fit='short']): the corner nav, JOIN
    //      and CREDITS share ONE bottom row, which frees the nav's right-hand reserve and a row.
    //   3. still short of height — the WORDMARK (only) shrinks by the measured deficit.
    // Layout reads here run on mount / resize only, never per frame.
    const textEm = (el) => {
      if (!el) return 0;
      const fs = parseFloat(getComputedStyle(el).fontSize) || 0;
      if (!fs) return 0;
      let w = 0;
      const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = tw.nextNode(); n; n = tw.nextNode()) {
        const r = document.createRange();
        r.selectNodeContents(n);
        for (const rc of r.getClientRects()) w += rc.width;
      }
      return w / fs;
    };
    // Whole-line em (sets the fit-to-slot size) and widest UNBREAKABLE chunk em (sets the minimum
    // card width): a line may wrap before "/ WORD" and before "(xN)", nowhere else.
    const lineEms = (lines) => {
      let whole = 0;
      let chunk = 0;
      for (const el of lines) {
        const all = textEm(el);
        // every breakable piece (" / WORD", and since oct3 the inline " · POWER ×N" perk) — summed out of the
        // unbreakable head, and each one is its own candidate chunk
        const pers = Array.from(el.querySelectorAll('.game-card-payout-per')).map(textEm);
        const per = pers.reduce((a, b) => a + b, 0);
        const perMax = pers.length ? Math.max(...pers) : 0;
        const mult = textEm(el.querySelector('.game-card-payout-mult'));
        // The perk's second line ("LONGER WORDS PAY MORE", its own block since E3) drops whole on a
        // narrow or short card (then it measures 0), so it never sets the minimum card width; the
        // slot is sized to the WIDER of the two lines, not their sum.
        const tail = textEm(el.querySelector('.game-card-perk-tail'));
        whole = Math.max(whole, all - tail, tail);
        chunk = Math.max(chunk, all - per - mult - tail, perMax, mult);
      }
      return { whole, chunk };
    };
    const measureMinW = (grid) => {
      const q = (sel) => Array.from(grid.querySelectorAll(sel));
      const xp = lineEms(q('.game-card-titlebar .game-card-xp'));
      const pay = lineEms(q('.game-card-titlebar .game-card-payout'));
      const foot = lineEms(q('.game-card-foot .game-card-xp, .game-card-foot .game-card-payout'));
      if (xp.whole) grid.style.setProperty('--xp-em', xp.whole.toFixed(3));
      if (pay.whole) grid.style.setProperty('--pay-em', pay.whole.toFixed(3));
      if (foot.whole) grid.style.setProperty('--foot-em', foot.whole.toFixed(3));
      // border 2x5 + side padding (bar: clamp(10px, 4.5cqw, 18px); foot: clamp(9px, 3.5cqw, 14px))
      // + the 2px slack in --line-room, at the 15px (bar) / 13px (foot) floors.
      const need = (em, floor, padMin, padK, padMax) => {
        let w = 12 + 2 * padMin + floor * em;
        const pad = Math.min(padMax, Math.max(padMin, padK * (w - 10)));
        w = 12 + 2 * pad + floor * em;
        return Math.ceil(w);
      };
      // 182 keeps the card's content box over 170px, where GameCard.css's small-card container
      // queries start dropping the badge / lock sub-line — this gate forbids hiding text to fit.
      // R1 (six cards — WORD RACE on for everyone): six 182px cards cannot share a 1163px row, and the
      // squat 3x2 fallback cut the names. At ≤170px GameCard.css only restyles (padding, name size) and
      // drops the perk tail — the badge, lock line and payout all stay — so six cards may go to 162 (a
      // 152px content box: at ≤150 the payout's unit drops). card-fit's "no hidden text, ≥13px" gate
      // is what holds this floor honest.
      const floor = grid.querySelectorAll('.game-card-magnet').length >= 6 ? 162 : 182;
      return Math.max(
        floor,
        need(Math.max(xp.chunk, pay.chunk), 15, 10, 0.045, 18),
        need(foot.chunk, 13, 9, 0.035, 14),
      );
    };
    // How far each card's text reaches past its own box (horizontal) and how much height it lacks.
    // Also publishes each card's --bar-text-h (the title bar's TEXT height) so a locked card's
    // plaque + scrim sit in the art ABOVE the name instead of on top of it (GameCard.css).
    const cardShortfall = (grid) => {
      let wide = 0;
      let tall = 0;
      const barText = [];
      for (const card of grid.getElementsByClassName('game-card')) {
        if (!card.offsetParent) continue; // not rendered (never expected: compute shows every page)
        const inner = card.clientHeight;
        for (const el of card.querySelectorAll('.game-card-name, .game-card-xp, .game-card-payout, .game-card-badge')) {
          if (el.clientWidth) wide = Math.max(wide, el.scrollWidth - el.clientWidth);
        }
        const bar = card.querySelector('.game-card-titlebar');
        if (bar) {
          const padT = parseFloat(getComputedStyle(bar).paddingTop) || 0;
          const textH = bar.offsetHeight - padT;
          const plaque = card.querySelector('.game-card-lock-plaque');
          // A locked card owes its plaque (plus the lock layer's own 14px padding) above the name.
          const lockH = plaque ? plaque.offsetHeight + 28 : 0;
          tall = Math.max(tall, textH + lockH - inner);
          barText.push([card, textH]);
        }
        const mast = card.querySelector('.game-card-masthead');
        const foot = card.querySelector('.game-card-foot');
        if (mast && foot) tall = Math.max(tall, mast.offsetHeight + foot.offsetHeight - inner);
      }
      for (const [card, h] of barText) card.style.setProperty('--bar-text-h', `${Math.ceil(h)}px`);
      return { wide, tall };
    };

    const compute = () => {
      // Reset to the natural (unscaled) size for a clean, non-compounding measurement.
      stage.style.setProperty('--menu-scale', '1');
      stage.style.height = '';
      const region = stage.querySelector('.homepage-cards-region');
      const grid = stage.querySelector('.homepage-cards-grid');
      const scroll = stage.querySelector('.homepage-cards-scroll');
      if (!region || !grid || !scroll) return;
      // PAGED: every page is shown while measuring (data-measuring lifts the off-page hide), so the
      // minimum width and each card's --bar-text-h come from ALL six cards — flipping never re-fits.
      // The region's height is the stage's leftover either way (flex-grown, min-height 0), so the
      // extra row this costs for the length of this synchronous pass changes nothing it reads.
      if (isPagedMenu) grid.setAttribute('data-measuring', '');
      try {
        fit(region, grid, scroll);
      } finally {
        grid.removeAttribute('data-measuring');
      }
    };
    const fit = (region, grid, scroll) => {
      const minW = measureMinW(grid);
      grid.setAttribute('data-minw', String(minW)); // the narrowest card that shows all its text (gates read it)
      const narrow = window.innerWidth < 360;

      // One arrangement pass: lay the stage out in `mode`, shrink the wordmark if `deficit` px of
      // card height is still owed, then pick and apply the card grid. Returns what it could not fit.
      const pass = (mode, deficit) => {
        stage.setAttribute('data-fit', mode);
        const cs = getComputedStyle(stage);
        const padT = parseFloat(cs.paddingTop) || 0;
        const padB = parseFloat(cs.paddingBottom) || 0;
        const rowGap = parseFloat(cs.rowGap) || 0;
        const inner = stage.clientHeight - padT - padB;
        if (inner <= 0) return null;
        // In-flow children only — the absolutely-positioned glow/spotlight/corner buttons don't
        // take part in the column's height.
        const kids = Array.from(stage.children).filter((el) => {
          const p = getComputedStyle(el).position;
          return p !== 'absolute' && p !== 'fixed' && el.offsetHeight > 0;
        });
        if (!kids.length) return null;
        // --menu-scale SHRINKS the WORDMARK on a short screen so the card region keeps a usable
        // height (never above 1x — menu-fit). It used to zoom the XP cluster too, which takes the
        // cluster's 13px labels under the --fs-label floor; the cluster now keeps its size.
        const logo = stage.querySelector('.homepage-logo-wrap');
        const logoH = logo ? logo.offsetHeight : 0;
        if (mode === 'normal') {
          let fixed = 0;
          for (const el of kids) {
            if (el.classList.contains('homepage-cards-region') || el === logo) continue;
            fixed += el.offsetHeight;
          }
          let marginAdj = 0;
          for (const el of kids) marginAdj += parseFloat(getComputedStyle(el).marginTop) || 0;
          const gaps = rowGap * Math.max(0, kids.length - 1) + marginAdj;
          const MINROW = 120;
          if (logoH > 0) {
            const scale = Math.max(0.4, Math.min(1, (inner - fixed - gaps - MINROW) / logoH));
            stage.style.setProperty('--menu-scale', scale.toFixed(4));
          }
        }
        if (deficit > 0 && logoH > 0) {
          const cur = parseFloat(stage.style.getPropertyValue('--menu-scale')) || 1;
          const scale = Math.max(0.4, Math.min(1, cur * (1 - deficit / logoH)));
          stage.style.setProperty('--menu-scale', scale.toFixed(4));
        }
        // LANDSCAPE nav safe-gutter (fix/landscape-nav): the absolute top-right corner nav is a
        // ~200px stacked column; on a short viewport the card row would pack under it. Measure its
        // footprint from the right edge and expose it as --corner-nav-reserve (Homepage.css). In
        // the 'short' arrangement the nav sits in the bottom row instead and the reserve is unused.
        const nav = stage.querySelector('.homepage-corner-nav');
        if (nav) {
          const nr = nav.getBoundingClientRect();
          const reserve = Math.max(0, Math.ceil(window.innerWidth - nr.left) + 12);
          stage.style.setProperty('--corner-nav-reserve', `${reserve}px`);
        }
        let regionH = region.clientHeight;
        // Available WIDTH from the REGION (full, stable) minus the scroll's gutter — never from the
        // shrink-to-content grid, which would feed its own card width back in.
        const scs = getComputedStyle(scroll);
        const gutter = (parseFloat(scs.paddingLeft) || 0) + (parseFloat(scs.paddingRight) || 0);
        let availW = region.clientWidth - gutter;
        // PAGED: the two arrows (+ the row's gaps) sit beside the cards, and the dot indicator under
        // them — both in flow, both paid for here so the 3:4 cards never overlap or clip them.
        if (isPagedMenu) {
          const row = region.querySelector('.homepage-cards-pagerow');
          const rowGap2 = row ? parseFloat(getComputedStyle(row).columnGap) || 0 : 0;
          for (const a of region.querySelectorAll('.homepage-cards-arrow')) availW -= a.offsetWidth + rowGap2;
          const dots = region.querySelector('.homepage-cards-dots');
          if (dots) regionH -= dots.offsetHeight + (parseFloat(getComputedStyle(dots).marginTop) || 0);
        }
        if (regionH <= 0 || availW <= 0) return null;
        const gcs = getComputedStyle(grid);
        const colGap = parseFloat(gcs.columnGap) || 14;
        const rGap = parseFloat(gcs.rowGap) || colGap;
        const count = grid.querySelectorAll('.game-card-magnet').length || 5;
        // NEVER THREE ACROSS ON A <360px SCREEN (exactly two columns there; the region scrolls).
        // PAGED: one row of CARDS_PER_PAGE, the other cards are a flip away.
        const LAYOUTS = isPagedMenu
          ? [[Math.min(CARDS_PER_PAGE, count), 1]]
          : narrow ? [[2, 3]] : [[count, 1], [3, 2], [2, 3], [1, count]];
        let best = null;
        let owed = 0;
        for (const [cols, rows] of LAYOUTS) {
          if (!isPagedMenu && cols * rows < count) continue; // must hold all five
          const colW = (availW - (cols - 1) * colGap) / cols;
          const rowH = (regionH - (rows - 1) * rGap) / rows;
          let f = null;
          if (narrow) {
            f = { w: colW, h: (colW * 4) / 3, cols, rows, aspect: true };
          } else if (isPagedMenu) {
            // ALWAYS 3:4 — the whole point of paging. Under the text minimum the card keeps the
            // minimum (3:4 still) and the height it owes goes to the short arrangement + the
            // wordmark shrink below, exactly like a six-up row's shortfall.
            let w = Math.min(colW, (rowH * 3) / 4);
            if (w < minW) w = Math.min(colW, minW);
            f = { w, h: (w * 4) / 3, cols, rows, aspect: true };
            // LAST RESORT (only once the short arrangement and the 0.4 wordmark are both spent, e.g.
            // 1163x501): the card stops at the row's height rather than run into the dots and the
            // CREDITS row under it. Never reached at 1366x657 / 1280x551.
            if (clampPaged && f.h > rowH) f = { ...f, h: rowH, aspect: false };
            owed = Math.max(0, f.h - rowH);
          } else {
            const w0 = Math.min(colW, (rowH * 3) / 4);
            if (w0 >= minW) f = { w: w0, h: (w0 * 4) / 3, cols, rows, aspect: true };
            // The 3:4 card would be under its minimum: it takes the WHOLE column (the wider the
            // card, the fewer payout lines wrap) and the height there is.
            else if (colW >= minW) f = { w: colW, h: rowH, cols, rows, aspect: false };
          }
          if (!f || f.w <= 4 || f.h <= 4) continue;
          // A true 3:4 card beats a squat one; among 3:4 the widest wins; among squat the tallest.
          const better = !best
            || (f.aspect && !best.aspect)
            || (f.aspect === best.aspect && (f.aspect ? f.w > best.w + 0.5 : f.h > best.h + 0.5));
          if (better) best = f;
        }
        if (!best) return { wide: minW, tall: 0, rows: 1 };
        grid.style.setProperty('--cards-cols', String(best.cols));
        grid.style.setProperty('--card-w', `${Math.floor(best.w)}px`);
        grid.style.setProperty('--card-h', `${Math.floor(best.h)}px`);
        // data-cols lets the CSS centre a lone last card (a 2-col grid of five ends 2+2+1).
        grid.setAttribute('data-cols', String(best.cols));
        if (narrow) return { wide: 0, tall: 0, rows: best.rows };
        // the row scrolls sideways, so width is never owed — but a full 3:4 height still is (the short
        // arrangement + the wordmark shrink below pay it as far as they can)
        const sf = cardShortfall(grid);
        return { ...sf, tall: Math.max(sf.tall, owed), rows: best.rows };
      };

      // WHERE THE LEFTOVER GOES on a wide screen: the 3:4 cards are width-bound and the region
      // hugs its TOP, so the surplus sits below the cards (see .homepage-cards-region).
      let clampPaged = false;
      let r = pass('normal', 0);
      if (!r || narrow) return;
      if (r.wide > 0.5 || r.tall > 0.5) r = pass('short', 0);
      // Still short of height: take it out of the wordmark, a row's worth per row of cards.
      for (let i = 0; r && r.tall > 0.5 && i < 2; i += 1) r = pass('short', Math.ceil(r.tall * r.rows) + 2);
      if (r && isPagedMenu && r.tall > 0.5) {
        clampPaged = true;
        pass('short', 0);
      }
    };
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(compute);
    };
    compute();
    raf = requestAnimationFrame(compute); // second pass after fonts/layout settle
    // The card minimum is MEASURED text; a fallback face measures differently from Space Mono, so
    // re-fit once the webfonts are in.
    let live = true;
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (live) onResize(); });
    window.addEventListener('resize', onResize);
    return () => {
      live = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, [isPhoneMenu, isPagedMenu]);

  // ---- CARD PAGES (short-wide desktop only) -----------------------------------------------------
  // Homepage owns the page and the fit; the arrows, dots, keys, swipe and the flip slide are the lazy
  // CardPager (only a paged viewport ever fetches it). A pager that stops matching shows everything.
  const cardsGridRef = useRef(null);
  const cardsRowRef = useRef(null);
  const pageCount = isPagedMenu ? CARD_PAGES : 1;
  const shownPage = isPagedMenu ? Math.min(cardPage, pageCount - 1) : 0;
  const flipCards = (to) => setCardPage(Math.max(0, Math.min(pageCount - 1, to)));
  // the keys never flip under an open dialog / panel
  const pagerBlockedRef = useRef(false);
  pagerBlockedRef.current = !!(dialog || lockedPreview || showClaims || showRanks || showMarks || claimReveal || navigating);
  const pager = (slot) => (
    <Suspense fallback={null}>
      <CardPager slot={slot} page={shownPage} pageCount={pageCount} onFlip={flipCards} gridRef={cardsGridRef} rowRef={cardsRowRef} blockedRef={pagerBlockedRef} />
    </Suspense>
  );

  // NOTE (fix/logic-and-onboarding): the old peek-scroll + "N MORE" pager machinery was
  // REMOVED here. The card-sizing effect above sizes all five cards to fit ONE screen and
  // .homepage-cards-scroll is `overflow:visible` (never scrolls), so the fold-count state
  // (cardsBelow/cardsAtEnd/cardsScrollable/cardsMobile), the --rowh measurement and
  // scrollCardsDown only ever fed a pager that couldn't scroll and an `is-atend` class with
  // no CSS. Worse, on mount/resize the fold count could transiently read 1 before the sizing
  // pass settled, flashing a phantom "1 MORE" while all five cards were on screen. Gone.

  // ---- Menu XP meta-progression (presentational) -------------------------------
  // Typing anywhere on the menu earns XP (no text input here). The capture/credit/streak
  // logic is the SHARED hook (also used by the splash) so the two can't drift; it only
  // ever surfaces as the pops + the bar. No-ops while a mode dialog is open.
  const xpFxRef = useRef(null);
  const dialogOpenRef = useRef(false);
  useEffect(() => {
    dialogOpenRef.current = !!dialog;
  }, [dialog]);
  // Wins balance shown in the chip — LIVE off the one balance channel (W, Andy oct2 22:28): a claim
  // from STATS, a code, a purchase or a level-up payout all land here at once, no remount needed.
  const wins = useWinsBalance();
  // GEMS (Andy oct5): the roll currency, live off its own channel. The MARKS dot means only "you can afford a roll":
  // gems ≥ 10, or the free starter roll is still waiting. The roll store is read when the balance moves or MARKS
  // opens/closes (where the starter roll is spent) — never per render: menu typing re-renders this every keystroke.
  const gems = useGems();
  const starterWaiting = useMemo(() => { const st = loadRollState(); return !(st && st.starter); }, [gems, showMarks]); // eslint-disable-line react-hooks/exhaustive-deps
  const rollDot = canAffordRoll(gems) || starterWaiting;
  // Rebirth count (read once on mount) — keys the XP-bar fill colour. Equipping/rebirth
  // happen on other screens, which remount this component, so a snapshot is correct.
  const [rebirths] = useState(() => getRebirths());
  // All-time wins earned + the current daily-streak count, both snapshotted on mount (they only
  // change inside a round, which remounts this screen on return). winsLifetime drives the
  // first-run gating (hide REBIRTH / the XP caption until the player has actually earned wins);
  // streak drives the menu chip (shown only at >= 2 days).
  const [winsLifetime] = useState(() => getWinsLifetime());
  const [streak] = useState(() => getStreak().count);
  // Freeze tokens (earned 1 per 7 days) shown on the menu BEFORE they're needed (Job 10).
  const [streakFreezes] = useState(() => getStreak().freezes || 0);
  // Can the player buy at least one unowned item? Drives the wins-chip dot. Refreshed
  // alongside the balance so earning enough on the menu lights the dot immediately.
  const [winsAffordable, setWinsAffordable] = useState(() => canAffordAny());
  useEffect(() => { setWinsAffordable(canAffordAny(wins)); }, [wins]);
  const { progress: xpProgress } = useXpCapture({
    fxRef: xpFxRef,
    isBlocked: () => dialogOpenRef.current,
    // (the wins chip no longer polls here — useWinsBalance above hears every balance change)
    onCredit: () => {},
  });
  // THE FIVE SECRETS ARE NOT A MENU FEATURE ANY MORE (feat/cut-secrets-rarity). They used to
  // fire here and announce themselves as a centre-screen sticker over a modal backdrop — a
  // one-off popup, mid-aim, that you clicked away and that could swallow the click meant for the
  // card behind it. The detections are unchanged (secrets/secrets.js); they now fire while you
  // PLAY, pay into that round, and surface at the word you typed (secrets/useWordSecrets +
  // components/WordLanding). What is left of them on the menu is nothing, which is the point.
  // FREE UNLOCK LADDER (Job 3): grant every level-reached cosmetic (idempotent, its own
  // storage — separate from the shop), then hold the owned set so the "NEXT UNLOCK" line and
  // the applied FRAME stay in sync as XP climbs on the menu. (The ladder's THEME cosmetics were
  // dropped on merge — main's themes system owns menu colour now — so only FRAMES remain here.)
  const [freeUnlocks, setFreeUnlocks] = useState(() => getFreeUnlocks());
  useEffect(() => {
    const fresh = grantUnlocks(xpProgress.level);
    // Also catch up any rebirth cosmetics already earned (rebirth happens on another screen,
    // which remounts this one, so a mount-time sweep is enough — no ShopScreen coupling).
    let rebirthFresh = false;
    for (let r = 1; r <= rebirths; r++) if (grantRebirthUnlock(r)) rebirthFresh = true;
    if (fresh.length || rebirthFresh) setFreeUnlocks(getFreeUnlocks());
  }, [xpProgress.level, rebirths]);

  // feat/analytics — attach progression session properties (so every later event segments by stage)
  // and fire streak_day at most once per active calendar day. Guarded; never blocks the menu.
  useEffect(() => {
    try {
      const st = getStreak();
      refreshSessionProps({ level: xpProgress.level, rebirths, streak: st.count });
      if (st.count > 0 && st.lastDay) {
        const dayKey = `taw.ev.streakDay.${st.lastDay}`;
        if (typeof localStorage === 'undefined' || localStorage.getItem(dayKey) !== '1') {
          try { if (typeof localStorage !== 'undefined') localStorage.setItem(dayKey, '1'); } catch { /* blocked */ }
          evStreakDay(st.count);
        }
      }
    } catch { /* analytics never blocks the menu */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const menuFrame = currentCosmetic(freeUnlocks, 'frame', rebirths) || '';

  // STEP 22 / A1 — THE MENU TIER. Level + rebirth → how rich the menu looks (corner frame art,
  // pop length, level-up burst). Crossing into a tier this browser has not seen yet slams the
  // new frame in once and names it; every level-up punches the corners once.
  // STEP 50: the shown tier is the BEST this player has reached — a rebirth resets the level, and
  // the menu (frame + the wall's scene) must never move back a tier for it.
  const [worldFrom] = useState(() => getSeenTier());
  const tier = Math.max(menuTier(xpProgress.level, rebirths), worldFrom);
  const [frameFresh, setFrameFresh] = useState(false);
  const [framePunch, setFramePunch] = useState(0);
  const lastLevelRef = useRef(xpProgress.level);
  // H5 (Andy oct3 02:24 "important = announced … never stacking"): the menu's big moments take turns on the
  // ONE moments queue (lib/moments.js; kinds, priorities and safety lengths in lib/menuMoments.js). Each
  // keeps its own art and clock; only its START is queued, and it releases the queue when it ends. Every
  // moment this mount announced is dropped (queued) or released (playing) when the menu unmounts.
  const mountedAtRef = useRef(Date.now());
  const aliveRef = useRef(true);
  const momentCancelsRef = useRef(new Set());
  const levelRef = useRef(xpProgress.level);
  levelRef.current = xpProgress.level;
  const tierRef = useRef(tier);
  tierRef.current = tier;
  const announceMenu = (kind, start, over) => {
    const cancel = moments.announce({ ...momentOpts(kind), ...over, start: (done) => (aliveRef.current ? start(done) : done()) });
    momentCancelsRef.current.add(cancel);
    return cancel;
  };
  useEffect(() => {
    aliveRef.current = true;
    const cancels = momentCancelsRef.current;
    return () => {
      aliveRef.current = false;
      cancels.forEach((c) => { try { c(); } catch { /* already released */ } });
      cancels.clear();
    };
  }, []);
  // N4: every 100 levels the WALL re-forms (wallTier.js → WallScene). On the menu only — never mid-game —
  // so a 100 crossed inside a game plays when the player comes back here. It is a LEVEL moment, announced
  // BEFORE the tier-up (effect order = FIFO within a priority), so on LV100 (both) the wall goes first and
  // the new frame is named after it. Its own timing is unchanged: it re-forms once the menu has settled
  // (the arrival wipe, WALL_SETTLE_MS after mount), and holds the queue until WallScene says it is over.
  const wallWait = () => Math.max(0, WALL_SETTLE_MS - (Date.now() - mountedAtRef.current));
  // The wall follows the BEST level this save reached (wallTier.js), not just the live one: the one-time
  // REBIRTH RUSH conversion (econMigrate.js) turns a LV230 save into LV1 + rebirths at boot, before the menu
  // ever notes its level — reading the live level alone, that player would lose their wall for good. The
  // conversion writes the run's peak into taw.records.maxLevel first (peakLevel), so it is read here too.
  const wallLevel = () => Math.max(levelRef.current, peakLevel());
  useEffect(() => {
    const lv = wallLevel();
    // within 10 levels of the next wall: warm its (lazy) choreography so the moment never waits on a fetch
    if (wallTierFor(lv + 10) > getWallTier()) import('./wallFx.jsx').catch(() => {});
    if (wallTierFor(lv) <= getWallTier()) return;
    announceMenu('wall', (done) => {
      let t = 0;
      const end = () => {
        clearTimeout(t);
        window.removeEventListener(WALL_FX_DONE_EVENT, end);
        done();
      };
      t = setTimeout(() => {
        if (!aliveRef.current) { end(); return; } // left the menu during the settle: replay next visit
        window.addEventListener(WALL_FX_DONE_EVENT, end);
        if (!noteWallLevel(wallLevel())) end();
      }, wallWait());
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xpProgress.level]);
  // STEP 22: the tier-up card (MenuXp tierUp, 1.5 s) — a LEVEL moment after the wall. The tier is marked
  // seen when the card actually plays, so leaving the menu before its turn replays it next visit.
  useEffect(() => {
    const seen = getSeenTier();
    if (tier > Math.max(0, seen)) {
      setFrameFresh(true);
      if (flagOn('milestones')) {
        // MILESTONE MOMENTS: every milestone is also a tier start, and the tier-up shares the level-up
        // card's element — played at once it would overwrite the bigger LEVEL N the same frame. So the
        // tier-up waits out a milestone card still on screen (0 ms otherwise), and its safety release
        // grows by the longest such card.
        announceMenu('tier-up', (done) => {
          const t = tierRef.current;
          setSeenTier(t);
          const fx = xpFxRef.current;
          if (!fx || !fx.tierUp) { done(); return; }
          const play = () => {
            if (!aliveRef.current || !xpFxRef.current) { done(); return; }
            xpFxRef.current.tierUp(TIER_NAMES[t]);
            setTimeout(done, CARD_MS);
          };
          const wait = fx.milestoneBusyMs ? fx.milestoneBusyMs() : 0;
          if (wait > 0) setTimeout(play, wait);
          else play();
        }, { maxMs: MENU_MOMENTS['tier-up'].maxMs + CARD_MS + MILESTONE_MAX_HOLD_MS });
      } else announceMenu('tier-up', (done) => {
        const t = tierRef.current;
        setSeenTier(t);
        if (!xpFxRef.current || !xpFxRef.current.tierUp) { done(); return; }
        xpFxRef.current.tierUp(TIER_NAMES[t]);
        setTimeout(done, CARD_MS);
      });
    } else if (seen < tier) {
      setSeenTier(tier);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier]);
  useEffect(() => {
    if (xpProgress.level > lastLevelRef.current) {
      setFramePunch((k) => k + 1);
      // STEP 51 ticker: "NAME just hit LV 50" (claimed players, milestone levels only)
      for (let lv = lastLevelRef.current + 1; lv <= xpProgress.level; lv += 1) if (isLevelMilestone(lv)) announceTick('lv', lv);
    }
    lastLevelRef.current = xpProgress.level;
  }, [xpProgress.level]);

  const shopLinkRef = useRef(null);
  const statsLinkRef = useRef(null);
  const boardLinkRef = useRef(null);
  const rebirthLinkRef = useRef(null);
  // THEMES: grant any level-unlocked theme (LV10 MIDNIGHT, LV30 TOXIC) as progression reaches it,
  // so the free path works even if the player never opens the shop. Idempotent + persisted.
  // (STEP 50: themes are retired — no more level-granted themes. A refund for BOUGHT ones waits as
  // a claim; it is queued here, where the claims module is loaded.)
  useEffect(() => {
    try {
      const n = Number(localStorage.getItem('taw.themeRefundPending'));
      if (n > 0) {
        queueClaim({ id: 'theme-refund', kind: 'welcome', label: 'THEME REFUND', amount: n, detail: 'themes-retired' });
        localStorage.removeItem('taw.themeRefundPending');
      }
    } catch {
      /* blocked */
    }
  }, []);
  // A11y: when an overlay (Shop/Stats) closes, App passes which control opened it so we
  // restore focus to that footer link on this remount, then clear the flag.
  useEffect(() => {
    if (restoreFocus === 'shop' && shopLinkRef.current) shopLinkRef.current.focus();
    else if (restoreFocus === 'stats' && statsLinkRef.current) statsLinkRef.current.focus();
    else if (restoreFocus === 'leaderboard' && boardLinkRef.current) boardLinkRef.current.focus();
    else if (restoreFocus === 'rebirth' && rebirthLinkRef.current) rebirthLinkRef.current.focus();
    if (restoreFocus && onFocusRestored) onFocusRestored();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // AUTOMATION (stars.js layer 2): AUTO-KEY spends on every menu return, and the menu says what it
  // bought, once. AUTO-FORGE is NOT run: Rebirth Rush took the LETTER FORGE off the shelf (it no longer
  // pays), so an owned AUTO-FORGE must not keep spending wins on it.
  useEffect(() => {
    const r = runAutomation({ buyKey: buyKeyPower });
    if (!r.keys) return undefined;
    const parts = [`+${formatNum(r.keys)} KEY TIER`];
    // H5: an INFO moment on the queue (was an 800 ms guess at clearing the level-up card)
    announceMenu('automation', (done) => {
      if (!xpFxRef.current || !xpFxRef.current.announce) { done(); return; }
      xpFxRef.current.announce('AUTOMATION', parts.join(' · '), 'BOUGHT WHILE YOU PLAYED');
      setTimeout(done, CARD_MS);
    });
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // STEP 21: the worn mark ranked up during the last games → name it once, on the menu. H5: an INFO moment
  // on the queue, after any level/tier card (was a 1600 ms guess at that card's length).
  useEffect(() => {
    const id = getEquippedMark();
    const r = takeMarkRankUp(id);
    if (!r) return undefined;
    const m = markById(id);
    announceMenu('mark-up', (done) => {
      if (!xpFxRef.current || !xpFxRef.current.announce) { done(); return; }
      // H6 audit M7: RANK names the level titles only — a mark levels up as "SMITH IV · MARK UPGRADED"
      xpFxRef.current.announce(`${m.name} ${MARK_RANK_NAMES[r - 1]}`, 'MARK UPGRADED', markBlurbAt(m, r).toUpperCase());
      setTimeout(done, CARD_MS);
    });
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Rebirth Rush one-time conversion (econMigrate): an old save whose levels passed the new gates was turned
  // into rebirths — say so ONCE, as a LEVEL card on the queue. Cleared when it PLAYS (not when queued), so a
  // menu left before its turn still shows it next visit.
  useEffect(() => {
    const added = rebirthRushNotice();
    if (!added) return undefined;
    announceMenu('rebirth-rush', (done) => {
      if (!xpFxRef.current || !xpFxRef.current.rebirthRush) { done(); return; }
      clearRebirthRushNotice();
      xpFxRef.current.rebirthRush(added, getRebirths());
      setTimeout(done, CARD_MS);
    });
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // REBIRTH READY → ×5 FOREVER from a round-end card: that screen armed the intent and left through
  // its own exit (solo onExit / the room's leave path), landing here. Go straight on into the REBIRTH
  // view (ShopScreen takes the intent and plays the ceremony). Layout effect: before the menu paints.
  // Below the gate (a stale intent), it is simply dropped.
  useLayoutEffect(() => {
    if (!peekRebirthNow()) return;
    if (isRebirthReadyNow() && onRebirth) onRebirth();
    else takeRebirthNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const rb = consumePendingRebirth();
    if (rb > 0) announceTick('rb', rb); // STEP 51 ticker: "NAME reached REBIRTH 5"
    if (rb > 0 && xpFxRef.current) {
      // H5: a LEVEL moment on the queue (the rank-up used to wait 1.6 s blind for this card)
      announceMenu('rebirth', (done) => {
        if (!xpFxRef.current) { done(); return; }
        xpFxRef.current.rebirthCelebration(rb);
        setTimeout(done, CARD_MS);
      });
    } else {
      const stamp = consumePendingWinsStamp();
      if (stamp > 0 && xpFxRef.current) {
        // The FIRST time a round ever pays out, show the one-time explainer ("WINS BUY UPGRADES
        // IN THE SHOP") instead of the bare "+N WINS" — a newcomer has no idea what wins are for
        // (the audit's #1 leak). Every later payout shows the normal stamp.
        if (!hasSeenWinsHint()) {
          markWinsHintSeen();
          xpFxRef.current.winsHint();
          evFirstWinsEarned(stamp); // analytics: the first-ever payout (once)
        } else {
          xpFxRef.current.winsStamp(stamp);
        }
      }
    }
  }, []);

  // Keep the juice layer's sound flag in sync with the app-wide SFX mute, so the
  // existing mute toggle silences the new press cues too (default on, honored).
  useEffect(() => {
    setJuiceMuted(muted);
  }, [muted]);

  // Fire the shared game-feel on a menu action button press: squash + color
  // flash + a small spark burst from the button's center + a tap tick. The juice
  // module self-gates on reduced-motion and the mute flag, so this stays
  // unconditional here. `accent` tints the flash/sparks to the button's color.
  function pressJuice(e, accent) {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    squash(el);
    flash(el, accent);
    burst(r.left + r.width / 2, r.top + r.height / 2, { count: 16, colors: [accent], speed: 240 });
    sfx('tap');
  }

  // Hovering a card plays a subtle blip - but only when moving onto a NEW card,
  // so it never machine-guns while you sit on one card. (hoverGame is kept just
  // for that dedup now; the card art reveal is pure CSS :hover.)
  function handleHover(id) {
    if (id && id !== hoverGame) sound.menuHover();
    setHoverGame(id);
  }

  // Clicking a mode card no longer navigates straight to the lobby - it expands
  // the card into the intermediate dialog (CREATE / JOIN). `el` is the clicked
  // .game-card node, handed to ModeDialog as the FLIP morph's origin box.
  function handleOpenDialog(gameId, el) {
    if (navigating) return;
    const game = GAMES.find((g) => g.id === gameId);
    if (!game || !game.enabled) return;
    sound.click();
    // SAT RUSH is solo — there is no room to CREATE/JOIN, so it skips the mode
    // dialog and navigates straight in (same pattern as Daily / Quick Play).
    if (gameId === 'sat-rush') {
      setNavigating(true);
      if (onSatRush) onSatRush();
      return;
    }
    // CHAIN / FUSE are solo, but (unlocked) they now open the SAME mode dialog as
    // Word Bomb / Blitz — a solo variant with one PLAY button — so entering a mode
    // reads consistent across the menu. The PLAY button calls onChain/onFuse.
    evModeOpened(game.id); // analytics: a mode dialog opened
    setDialog({ game, el });
  }

  // Dialog CREATE ROOM: the existing "pick this game -> lobby" path (App's
  // onSelectGame => goToLobby(gameId)). The screen transitions away, unmounting
  // the dialog with it, so no reverse-morph is needed here.
  function handleDialogCreate() {
    if (navigating || !dialog) return;
    sound.click();
    setNavigating(true);
    const gameId = dialog.game.id;
    runWhenConnected('create', () => onSelectGame && onSelectGame(gameId));
  }

  // Dialog PLAY SOLO (Word Bomb): straight into a round vs a medium bot - App's handlePlaySolo sends
  // the create/add_bot frames and starts once the bot is seated. Through runWhenConnected like
  // CREATE, so a cold socket shows WAKING THE SERVER… on the button and fires on open.
  function handleDialogSolo() {
    if (navigating || !dialog) return;
    sound.click();
    setNavigating(true);
    runWhenConnected('solo', () => onPlaySolo && onPlaySolo());
  }

  // Phone hook PLAY SOLO: the first-timer typed a word on the menu and took the one-tap offer.
  // The same path as the dialog's PLAY SOLO, without a dialog to open first.
  function handleHookSolo() {
    if (navigating) return;
    sound.click();
    setNavigating(true);
    runWhenConnected('solo', () => onPlaySolo && onPlaySolo());
  }

  // Dialog QUICK MATCH (WORD RACE): straight into the race queue - App sends race_quick_match and
  // the server seats us in the fullest waiting race (or opens one; bots fill after 10s). Same
  // runWhenConnected path as PLAY SOLO, so a cold socket shows WAKING THE SERVER… on the button.
  function handleDialogQuickMatch() {
    if (navigating || !dialog) return;
    sound.click();
    setNavigating(true);
    runWhenConnected('solo', () => onRaceQuickMatch && onRaceQuickMatch());
  }

  // Dialog JOIN ROOM: the existing unified join-by-code / public-rooms screen
  // (App's onJoinRoom => handleOpenBrowser). Same flow as the bottom-bar JOIN.
  function handleDialogJoin() {
    if (navigating) return;
    sound.click();
    setNavigating(true);
    runWhenConnected('join', () => onJoinRoom && onJoinRoom());
  }

  // Dialog PLAY (solo CHAIN / FUSE): local modes, no socket round-trip — navigate
  // straight into the mode via the matching handler. The dialog unmounts with the
  // screen change, so no reverse-morph is needed.
  function handleDialogPlay() {
    if (navigating || !dialog) return;
    sound.click();
    setNavigating(true);
    const id = dialog.game.id;
    if (id === 'chain' && onChain) onChain();
    else if (id === 'fuse' && onFuse) onFuse();
  }

  function handleJoinRoom(e) {
    if (navigating) return;
    pressJuice(e, '#2EFFE0'); // cyan accent juice
    sound.click(); // the whoosh follows from the screen transition in App
    setNavigating(true);
    runWhenConnected('join', () => onJoinRoom && onJoinRoom());
  }

  function handleStats() {
    if (navigating) return;
    sound.click();
    if (onStats) onStats();
  }

  // STEP 24: the leaderboard. Every menu visit also pushes this browser's stats to the board (if it
  // has claimed a name; throttled to once per 30 s inside client.js, fire-and-forget, never blocks).
  function handleLeaderboard() {
    if (navigating) return;
    sound.click();
    setRankNews(false); // opening the board is reading the news (the board reads rankFrom, not this flag)
    markBoardSeen(); // an in-flight menu rank check must not re-raise the news after this open
    setBoardNews(false);
    if (onLeaderboard) onLeaderboard();
  }
  // STEP 47: after the push, compare my live rank with the last one this browser saw. A RISE shows
  // the "#12 → #7" moment once and badges the trophy until the board is opened.
  const [boardNews, setBoardNews] = useState(() => LEADERBOARD_ENABLED && hasRankNews());
  // N3: the board icon wears your last known rank (#N) — re-read whenever rank news changes
  const boardRank = LEADERBOARD_ENABLED ? getLastRank() : null;
  const [rankUp, setRankUp] = useState(null);
  // Andy oct3 11:42 (podium): the icon shows the OLD rank until the rank-up card's "#to" pops, then bounces
  // and ticks down to the new one. boardHold = the rank to show meanwhile; boardBump = the one-shot trigger.
  const [boardHold, setBoardHold] = useState(null);
  const [boardBump, setBoardBump] = useState(null);
  const rankDoneRef = useRef(null);
  const rankCancelRef = useRef(null);
  const boardShown = boardHold != null ? boardHold : boardRank;
  // 012_admin_reset: the one-shot "reset by the dev" line, left by obeyDevReset before its reload
  const [devReset, setDevReset] = useState(() => LEADERBOARD_ENABLED && hasDevResetNotice());
  useEffect(() => { if (devReset) clearDevResetNotice(); }, [devReset]);
  // STEP 52 — CLOUD SAVE: if the cloud copy of this player's progress is AHEAD of this browser (a
  // wiped Safari, a new device after a recovery code), bring it back and reload into it. Once per
  // session at most, and never when local progress is equal or ahead (cloudSave.js).
  // E4: claims that no longer belong in the inbox (codes, marks, systems, collection, welcome back)
  // are applied or dropped once — the inbox is achievements + rank-ups only.
  useEffect(() => { trimClaimInbox(); }, []);
  // 012_admin_reset: the same lb_load also carries the dev's FULL RESET flag, so it runs once per PAGE
  // LOAD (not once per session): a reset outranks the restore, wipes, and reloads into a fresh LV 1.
  useEffect(() => {
    if (!LEADERBOARD_ENABLED || cloudBootChecked) return undefined;
    cloudBootChecked = true;
    let restore = true;
    try {
      if (sessionStorage.getItem('taw.cloud.restored') === '1') restore = false;
    } catch {
      return undefined;
    }
    restoreFromCloud({ restore })
      .then((r) => {
        if (r && r.reset) {
          window.location.reload(); // even if the menu unmounted: every module must re-read zeros
          return;
        }
        // the save is already imported by now, so the reload must not depend on this mount (StrictMode
        // remounts in dev; a quick tap into a mode unmounts the menu)
        if (!r || !r.restored) return;
        try {
          sessionStorage.setItem('taw.cloud.restored', '1');
        } catch {
          return;
        }
        window.location.reload();
      })
      .catch(() => {});
    return undefined;
  }, []);
  useEffect(() => {
    let live = true;
    // H2a: the epoch is taken NOW, before the push — if the board is opened while this chain is in
    // flight, the late result is dropped instead of re-raising news the board already consumed.
    const epoch = getBoardSeenEpoch();
    submitBoardStats(true) // forced: the rank check must see THIS visit's stats (the DB throttles at 5 s)
      .then(() => checkRankUp(epoch))
      .then((r) => {
        if (live && r && r.kind === 'passed') {
          // extensions-spec a (dormant, flagOn('rival') inside checkRankUp): "XAVI PASSED YOU" — the rank-up
          // card's passed variant, at INFO on the same queue. No news dot / icon hold: the trophy's
          // "rank went up" wording would lie, and the icon already wears the live rank.
          rankCancelRef.current = moments.announce({
            ...momentOpts('rival'),
            start: (done) => {
              if (!live) { done(); return; }
              rankDoneRef.current = done;
              setRankUp(r);
            },
          });
          return;
        }
        if (live && r) {
          setBoardNews(true);
          setBoardHold(r.from);
          // the rank-up goes through the ONE moments queue, so it never plays over another heavy moment
          // H5: a LEVEL moment (was REWARD + a 1.6 s RANKUP_DELAY_MS inside the card): it plays the moment
          // its turn comes, after a wall / tier-up / rebirth card, and the claim popup steps aside for it.
          rankCancelRef.current = moments.announce({
            ...momentOpts('rank-up'),
            start: (done) => {
              if (!live) { done(); return; }
              rankDoneRef.current = done;
              setRankUp(r);
              // never strand the OLD rank on the icon if the card's chunk never arrives
              setTimeout(() => { if (live) setBoardHold(null); }, MENU_MOMENTS['rank-up'].maxMs);
            },
          });
          if (r.to <= 10) announceTick('rank', r.to); // STEP 51 ticker: "NAME took #3"
        }
      })
      .catch(() => {});
    return () => {
      live = false;
      if (rankCancelRef.current) rankCancelRef.current();
    };
  }, []);
  const rankPop = () => {
    if (rankUp) setBoardBump({ from: rankUp.from, to: rankUp.to, key: Date.now() });
    setBoardHold(null);
  };
  const rankDone = () => {
    setRankUp(null);
    setBoardHold(null);
    const d = rankDoneRef.current;
    rankDoneRef.current = null;
    if (d) d();
  };

  function handleShop() {
    if (navigating) return;
    sound.click();
    if (onShop) onShop();
  }

  function handleRebirth() {
    if (navigating) return;
    sound.click();
    if (onRebirth) onRebirth();
  }
  // REBIRTH READY → ×5 FOREVER (Andy oct3): the CTA has already armed the intent; open the REBIRTH
  // view, which runs the rebirth + ceremony at once. A blocked tap disarms it so it can't fire later.
  function handleRebirthNow() {
    if (navigating || !onRebirth) {
      takeRebirthNow();
      return;
    }
    sound.click();
    onRebirth();
  }

  function handleCredits() {
    if (navigating) return;
    sound.click();
    setNavigating(true);
    if (onCredits) onCredits();
  }


  // A locked (level-gated) card was clicked: open its read-only preview dialog instead of
  // navigating. `gameId` comes from GameCard's locked-click hook.
  function handleLockedSelect(gameId) {
    if (navigating) return;
    const game = GAMES.find((g) => g.id === gameId);
    if (!game) return;
    sound.click();
    evLockedModeClicked(gameId, game.unlockLevel); // analytics: interest in a still-locked mode
    setLockedPreview({ game });
  }

  // REBIRTH is a prestige-RESET mechanic — noise to a level-1 newcomer with nothing to reset (the
  // audit's #2 leak). It is shown ONLY once it means something: the player can actually rebirth
  // now, OR has ever earned wins, OR has already rebirthed. ONE gate, read by both menu trees, so
  // the phone and desktop menus can never disagree about whether REBIRTH exists yet.
  const showRebirth = rebirths > 0 || winsLifetime > 0 || xpProgress.level >= rebirthThreshold(rebirths);
  // STEP 21: REBIRTH badges itself the moment it's available — it IS an upgrade, the biggest one.
  const rebirthReady = xpProgress.level >= rebirthThreshold(rebirths);

  // H5: an open panel / overlay holds the moments queue — nothing new starts under it (a moment already
  // playing finishes). Stats, shop and the board are their own screens (they hold it themselves).
  useMomentHold(!!(dialog || lockedPreview || showClaims || showMarks || showRanks || claimReveal));

  return (
    <div className="homepage-wrap" onPointerOver={warmModeDialog} onFocusCapture={warmModeDialog} onTouchStart={warmModeDialog}>
      <div
        ref={stageRef}
        className={`homepage-stage wall-surface${dialog ? ' is-dimmed' : ''}${isPhoneMenu ? ' is-phone-menu' : ''}`}
        data-menu-frame={menuFrame || undefined}
        data-menu-tier={tier}
        data-nav={NAV_LAYOUT}
        data-paged={isPagedMenu ? '' : undefined}
      >
        <MenuFrame tier={tier} rebirths={rebirths} fresh={frameFresh} punchKey={framePunch} />
        {/* BEAT GLOW: a soft pink pool that pulses on each detected beat - the
            menu's one piece of ambient motion now that the idle loops are gone.
            Opacity-only, sits above the wall texture but below the content. */}
        <div className="homepage-beat-glow" aria-hidden="true" />
        {devReset && <Suspense fallback={null}><DevResetNotice onDone={() => setDevReset(false)} /></Suspense>}
        {rankUp && rankUp.kind !== 'passed' && <Suspense fallback={null}><RankUpMoment from={rankUp.from} to={rankUp.to} onPop={rankPop} onDone={rankDone} /></Suspense>}
        {rankUp && rankUp.kind === 'passed' && <Suspense fallback={null}><RankUpMoment kind="passed" from={rankUp.from} to={rankUp.to} name={rankUp.name} levels={rankUp.levels} rebirths={rankUp.rebirths} onDone={rankDone} onTap={() => { rankDone(); handleLeaderboard(); }} /></Suspense>}
        {/* STREETLIGHT: a warm pool of light dropping from above onto the focal
            point (title + cards), brightest at the top and falling off. */}
        <div className="homepage-spotlight wall-spotlight" aria-hidden="true" />

        {/* PHONE (<=480px): the whole desktop menu below — corner nav, wordmark, XP cluster,
            card grid, bottom bar, footer — is replaced by full-width typographic bands (three
            mode rows, a CHAIN | FUSE band, a SHOP / STATS / REBIRTH strip, CREDITS + JOIN).
            Nothing in the desktop branch mounts at this width, which is the point: the card
            region alone is ~390 DOM nodes. Every component is still imported and still used
            at every other width; they simply are not rendered here. */}
        {isPhoneMenu ? (
          <MobileMenu
            games={GAMES}
            onOpen={handleOpenDialog}
            onJoin={handleJoinRoom}
            joinLabel={connecting === 'join' ? <ConnectingContent cold={coldStart} /> : 'JOIN ROOM'}
            onHookPlay={firstTimer && onPlaySolo ? handleHookSolo : null}
            hookPlayLabel={connecting === 'solo' && !dialog ? <ConnectingContent cold={coldStart} /> : null}
            navigating={navigating}
            musicMuted={musicMuted}
            onToggleMusic={onToggleMusic}
            /* Everything the desktop corner nav, footer and CHAIN/FUSE cards reach, through the
               SAME handlers and the same focus-restore refs — the phone gets entry points, not a
               second copy of the logic. Only one tree mounts, so sharing the refs is safe. */
            lockedIds={GAMES.filter((g) => isModeLocked(g, xpProgress.level)).map((g) => g.id)}
            onLockedSelect={handleLockedSelect}
            onShop={handleShop}
            onStats={handleStats}
            onLeaderboard={LEADERBOARD_ENABLED && onLeaderboard ? handleLeaderboard : null}
            boardDot={boardNews}
            boardRank={boardRank}
            boardShown={boardShown}
            boardBump={boardBump}
            boardRef={boardLinkRef}
            onRebirth={showRebirth ? handleRebirth : null}
            onMarks={marksRevealed() || markUnlocked.length ? () => { markMarksSeen(markUnlocked.map((m) => m.id)); setMarksNew(false); setShowMarks(true); } : null}
            marksDot={rollDot}
            gems={marksRevealed() || markUnlocked.length ? gems : null}
            rebirthDot={rebirthReady}
            rebirthReadySlot={rebirthReady ? <RebirthReadyButton ready onGo={handleRebirthNow} className="is-compact hp-m-rr-ready" /> : null}
            onCredits={handleCredits}
            shopDot={winsAffordable}
            shopRef={shopLinkRef}
            statsRef={statsLinkRef}
            rebirthRef={rebirthLinkRef}
            navLayout={NAV_LAYOUT}
            rewardsCount={claims.length}
            onRewards={() => setShowClaims(true)}
            claimSlot={!showClaims && !claimReveal && !showRanks && !showMarks && !dialog && !lockedPreview
              ? <ClaimPopup inline onOpenPanel={() => setShowClaims(true)} onReveal={setClaimReveal} />
              : null}
            level={xpProgress.level}
            levelFrac={xpProgress.frac}
            wins={wins}
          />
        ) : (
        <>
        {/* Corner nav — three WORD buttons (not glyphs), stacked in the top-right corner. Each
            is Bungee on a flat fill, thick black border + hard offset shadow, 44px tall, width
            auto (item 3). SHOP keeps its affordable-item dot. */}
        {/* N3 (Andy oct2): the LEADERBOARD on its OWN, top-left — hero-size, with your rank — so it reads as
            its own thing, not one more nav chip. It mirrors the corner nav's top-right offsets (a layout
            relationship with the frame, not an orphan) and keeps .homepage-nav-btn.is-board for the gates. */}
        {LEADERBOARD_ENABLED && onLeaderboard && (
          <div className="homepage-board-corner">
            <button
              ref={boardLinkRef}
              type="button"
              className={`homepage-nav-btn is-board homepage-board-hero${navigating ? ' disabled' : ''}`}
              onClick={handleLeaderboard}
              onMouseEnter={() => sfx('hover')}
              disabled={navigating}
              aria-label={`Open leaderboard${boardRank ? ` — you're #${formatNum(boardRank)}` : ''}${boardNews ? ' — your rank went up' : ''}`}
              title="Leaderboard"
            >
              {/* the podium wears your #rank on its top step (it replaced the separate #rank badge) */}
              <PodiumIcon rank={boardShown} bump={boardBump} />
              {boardNews && <span className="homepage-shop-dot is-board-news" aria-hidden="true" />}
            </button>
          </div>
        )}
        <nav className="homepage-corner-nav" aria-label="Menu">
          {/* NO SEPARATE REWARDS BUTTON (Andy oct2 A4): claims happen through STATS. While anything is
              waiting, STATS wears the count badge and opens the claims; with nothing waiting it opens
              Stats as always. */}
          {/* SHOP and STATS SWAPPED (Andy A4): STATS leads, SHOP sits last in the word stack —
              nearest the trophy + audio, where the eye lands after the cards. */}
          <button
            ref={statsLinkRef}
            type="button"
            className={`homepage-nav-btn is-stats${navigating ? ' disabled' : ''}`}
            onClick={claims.length > 0 ? () => setShowClaims(true) : handleStats}
            onMouseEnter={() => sfx('hover')}
            disabled={navigating}
            aria-label={claims.length > 0 ? `Open stats — ${formatNum(claims.length)} to claim` : 'Open stats'}
          >
            STATS
            {claims.length > 0 && <span className="homepage-claim-count" aria-hidden="true">{formatNum(claims.length)}</span>}
          </button>
          {/* REBIRTH: gated by showRebirth (see its definition above the return). */}
          {showRebirth && (
            <button
              ref={rebirthLinkRef}
              type="button"
              className={`homepage-nav-btn is-rebirth${rebirthReady ? ' is-ready' : ''}${navigating ? ' disabled' : ''}`}
              onClick={handleRebirth}
              onMouseEnter={() => sfx('hover')}
              disabled={navigating}
              aria-label={`Open rebirth${rebirthReady ? ' — ready' : ''}`}
            >
              REBIRTH
              {rebirthReady && <span className="homepage-shop-dot" aria-hidden="true" />}
            </button>
          )}
          <button
            ref={shopLinkRef}
            type="button"
            className={`homepage-nav-btn is-shop${navigating ? ' disabled' : ''}`}
            onClick={handleShop}
            onMouseEnter={() => sfx('hover')}
            disabled={navigating}
            aria-label={`Open shop${winsAffordable ? ' — items available' : ''}`}
          >
            SHOP
            {winsAffordable && <span className="homepage-shop-dot" aria-hidden="true" />}
          </button>
          {/* fix/visual-real item 4: the sound control JOINS the corner-nav cluster (SHOP / REBIRTH /
              STATS / audio) on the menu instead of floating as an orphan fixed button bottom-right —
              exactly the grouping CLAUDE.md's NO ORPHAN FIXED UI rule prescribes. The global fixed
              AudioControls is suppressed on the home view (App.jsx) so there's only one here. */}
          <AudioControls
            variant="inline"
            accent="#2EFFE0"
            musicMuted={musicMuted}
            onToggleMusic={onToggleMusic}
          />
        </nav>

        {/* Title: the wordmark with a handstyle 3D extrude (.wall-handstyle) and
            paint dripping off the letters - hand-painted on the wall, not set. */}
        <div className="homepage-logo-wrap">
          {/* "TYPE A WORD": the non-breaking space keeps "TYPE A" together
              so the title only ever wraps before "WORD" on narrow screens. The
              data-text must match exactly so the RGB-split clones line up. */}
          <div
            className="homepage-logo wall-handstyle"
            data-text={'TYPE A WORD'}
            role="img"
            aria-label="Type a Word"
          >
            {'TYPE A WORD'}
          </div>
          {/* Paint running off the wordmark. */}
          <div className="homepage-logo-drip" aria-hidden="true">
            <span style={{ left: '17%', '--len': '20px' }} />
            <span style={{ left: '49%', '--len': '34px' }} />
            <span style={{ left: '78%', '--len': '16px' }} />
          </div>
        </div>


        {/* fix/visual-real item 6: the XP bar + its small meta rows are grouped in ONE cluster with a
            tight internal gap, so the NEXT-unlock line sits right under the XP row it belongs to
            instead of floating alone in the dead space between the bar and the cards. The cluster is
            the single fit-math child that carries --menu-scale (see SCALES + .menu-xp-cluster CSS). */}
        <div className="menu-xp-cluster">
          {/* XP meta-progression bar — the PRIMARY element in the space the words-typed
              odometer used to occupy (that chip was removed). LV chip + fill + an "XP-into /
              XP-needed" readout, fed by global keystroke capture (see the effect above). */}
          <MenuXpBar
            level={xpProgress.level}
            toNext={xpProgress.toNext}
            frac={xpProgress.frac}
            /* LETTERS TO THE NEXT LEVEL (PROGRESSION v11, amended): the bar fills from LETTERS typed — in the
               menu or in any game — counted at the LETTERS-OF-YOUR-WORDS price, BASE 10 XP / LETTER × KEY × rebirth ×
               the worn mark (letterXp.js letterXpNow; typed letters pay a fifth until their word is accepted). Words
               pay wins, never per-word XP, so there is no per-mode rate to quote. */
            lettersToNext={Math.max(1, Math.ceil(xpProgress.toNext / Math.max(1, letterXpNow())))}
            /* The first-run lead-in ("TYPE ANYWHERE ·") rides the hint instead of the separate
               caption line that used to sit under the bar — see below. */
            firstRun={xpProgress.level < 2 && winsLifetime === 0 && rebirths === 0}
            /* WPM joins the hint row (see .menu-xp-hint) instead of holding a row of its own. */
            hintRight={<><span className="menu-xp-hint-rule">LONGER WORDS PAY MORE</span><LiveWpm hideZero /></>}
            intoLevel={xpProgress.intoLevel}
            cost={xpProgress.cost}
            rebirths={rebirths}
            wins={wins}
            onWinsClick={handleShop}
            onRankClick={() => setShowRanks(true)}
            streak={streak}
            freezes={streakFreezes}
            /* The slot is only drawn once there is something to put in it — an empty badge on a
               brand-new account is a question with no answer yet. */
            /* Andy oct2 A3: once MARKS is revealed (LV10 / R1) the slot is always there. */
            markSlot={markUnlocked.length > 0 || marksRevealed()}
            mark={markEntry(equippedMark)}
            markNew={marksNew}
            /* GEMS: the count rides beside the wins chip once MARKS is there (where they are spent);
               the MARKS dot = a roll is affordable */
            gems={markUnlocked.length > 0 || marksRevealed() ? gems : null}
            rollDot={rollDot}
            onMarkClick={() => {
              markMarksSeen(markUnlocked.map((m) => m.id));
              setMarksNew(false);
              setShowMarks(true);
            }}
          />
          {/* REBIRTH READY → ×5 FOREVER (Andy oct3: "never let a player miss that they can rebirth"):
              IN this cluster, right under the level bar it is about — in flow, never fixed. One tap
              rebirths and plays the ceremony (no confirm, no shop detour). */}
          <RebirthReadyButton ready={rebirthReady} onGo={handleRebirthNow} className="is-menu" />
          {/* THE FIRST-VISIT CAPTION IS GONE, folded into the bar's own hint line. It said "TYPE
              ANYWHERE TO EARN XP" on its own row directly under a row that now says "12 WORDS TO
              LEVEL 2" — two lines of the same small type, saying two halves of one sentence, on
              the one screen in the app with no vertical room to spare. The hint carries both on a
              first run ("TYPE ANYWHERE · 12 WORDS TO LEVEL 2") and drops the lead-in afterwards.
              Its 20px + the cluster's 5px gap are what pay for the hint line at 320x640. */}
          {/* (The MOMENTUM rail is gone with MOMENTUM — Andy oct2: the LETTER FORGE replaced it, and
              its 22px row was part of what pushed SHOP / REBIRTH down the screen.) */}
          {/* THE NEXT-UNLOCK TEASER IS GONE (Andy's cut). Three spans promising a cosmetic FRAME,
              which at R1 rendered as "NEXT REBIRTH 1 FRAME REBIRTH 1" — a line that says the same
              word three times and names a reward the player cannot see. No affordance, nothing
              clickable, and the ladder it teased is already in the shop. */}
        </div>

        <div className="homepage-cards-region">
          {/* CARD PAGES: on a short-wide desktop (PAGED_MENU_QUERY) the row carries an arrow each
              side and a two-dot indicator under it, all in flow inside the region (no fixed UI).
              Elsewhere the row is display:contents and the region is exactly what it was. */}
          <div className="homepage-cards-pagerow" ref={cardsRowRef}>
            {isPagedMenu && pager('prev')}
            <div className="homepage-cards-scroll" data-count={GAMES.length}>
              <div
                ref={cardsGridRef}
                className="homepage-cards-grid"
                style={{ '--card-count': GAMES.length }}
                data-page={isPagedMenu ? shownPage : undefined}
              >
                {GAMES.map((game) => (
                  <GameCard
                    key={game.id}
                    game={game}
                    onSelect={handleOpenDialog}
                    onLockedSelect={handleLockedSelect}
                    onHover={handleHover}
                    // Level gate OR an earlier play of the mode (deep links open a gated
                    // mode with no level check) — see progress/modeAccess.js.
                    locked={isModeLocked(game, xpProgress.level)}
                    playerLevel={xpProgress.level}
                  />
                ))}
              </div>
            </div>
            {isPagedMenu && pager('next')}
          </div>
          {isPagedMenu && pager('dots')}
          {isPagedMenu && pager('ctl')}
        </div>

        <div className="homepage-bottom-bar">
          {/* CREATE is per-game (each card's dialog has its own CREATE), so the
              menu only needs JOIN here. Magnetic wrapper carries the cursor-pull. */}
          <div ref={joinMagnetRef} className="homepage-btn-magnet">
            <button
              className={`homepage-btn homepage-btn-join${navigating ? ' disabled' : ''}${connecting === 'join' && coldStart ? ' is-waking' : ''}`}
              onClick={handleJoinRoom}
              onMouseEnter={() => sfx('hover')}
              disabled={navigating}
              data-juice-self
            >
              {connecting === 'join' ? <ConnectingContent cold={coldStart} /> : 'JOIN ROOM'}
            </button>
          </div>
        </div>

        {/* DAILY button removed (fix/three-things §3). The daily challenge is still
            reachable via the ?daily=1 deep link (App LAUNCH_INTENT.daily); only the
            loose menu entry was deleted. */}

        {/* Quiet footer link: CREDITS only. (SHOP + STATS are the loud top-corner icon
            buttons now; the guide/help nav was removed to keep the menu clean.) */}
        <div className="homepage-footer-links">
          <button
            className={`homepage-credits-link${navigating ? ' disabled' : ''}`}
            onClick={handleCredits}
            disabled={navigating}
          >
            CREDITS
          </button>
          {/* STEP 51: the live room — online count + other players' moments — joins the footer. */}
          {LEADERBOARD_ENABLED && <LiveTicker className="homepage-live" />}
        </div>
        </>
        )}
      </div>

      {/* XP feedback layer — a SIBLING of the panel, filling the outer backdrop margin so
          the "+N" popups spawn outside the panel border and never overlap its content. */}
      <MenuXpFx ref={xpFxRef} menuTier={tier} />

      {/* The card->dialog expand. Portals to <body> so the stage's overflow:hidden
          and the app zoom never clip it; closes back into the source card. */}
      {/* fix/error-boundaries — each menu OVERLAY gets its own boundary so a crash inside a dialog
          shows the inline panel + closes cleanly (GO BACK), never blanking the live menu behind it. */}
      {dialog && (
        <ScreenBoundary name="mode-dialog" onBack={() => setDialog(null)}>
          <Suspense fallback={null}>
          <ModeDialog
            game={dialog.game}
            sourceEl={dialog.el}
            onClose={() => setDialog(null)}
            onCreate={handleDialogCreate}
            onJoin={handleDialogJoin}
            onPlay={dialog.game.id === 'chain' || dialog.game.id === 'fuse' ? handleDialogPlay : undefined}
            onPlaySolo={
              dialog.game.id === 'word-bomb' && onPlaySolo
                ? handleDialogSolo
                : dialog.game.id === 'word-race' && onRaceQuickMatch
                  ? handleDialogQuickMatch
                  : undefined
            }
            connecting={connecting}
            coldStart={coldStart}
            blitzPacks={blitzPacks}
            onToggleBlitzPack={onToggleBlitzPack}
            onSetAllBlitzPacks={onSetAllBlitzPacks}
          />
          </Suspense>
        </ScreenBoundary>
      )}

      {/* Locked-mode preview (level-gated CHAIN/FUSE). Read-only teaser — no play button. */}
      {lockedPreview && (
        <ScreenBoundary name="locked-preview" onBack={() => setLockedPreview(null)}>
          <Suspense fallback={null}>
            <LockedPreviewDialog
              game={lockedPreview.game}
              level={xpProgress.level}
              onClose={() => setLockedPreview(null)}
            />
          </Suspense>
        </ScreenBoundary>
      )}

      {/* REWARDS — the claim popup (unseen claims) and the inbox panel. */}
      {/* The popup never floats over another overlay (rank ladder, marks, a mode dialog). */}
      {!isPhoneMenu && !showClaims && !claimReveal && !showRanks && !showMarks && !dialog && !lockedPreview && (
        <ClaimPopup onOpenPanel={() => setShowClaims(true)} onReveal={setClaimReveal} />
      )}
      {showClaims && (
        <ScreenBoundary name="rewards" onBack={() => setShowClaims(false)}>
          <Suspense fallback={null}>
            <ClaimsPanel
              onClose={() => setShowClaims(false)}
              onReveal={(c) => { setShowClaims(false); setClaimReveal(c); }}
              onStats={() => { setShowClaims(false); handleStats(); }}
            />
          </Suspense>
        </ScreenBoundary>
      )}
      {tutReady && !dialog && !showMarks && !showClaims && !showRanks && !claimReveal && !showMenuSpot && (xpProgress.level > 1 || rebirths > 0) && (
        <Suspense fallback={null}>
          <TutorialHost level={xpProgress.level} rebirths={rebirths} />
        </Suspense>
      )}
      {claimReveal && <Suspense fallback={null}><ClaimReveal claim={claimReveal} onDone={() => { const wasMark = claimReveal.kind === 'mark'; setClaimReveal(null); if (wasMark) setShowMarks(true); }} /></Suspense>}

      {/* MARKS overlay — one slot: the ROLL screen (its INDEX button opens the MARKS INDEX in the same slot). */}
      {showMarks && (
        <ScreenBoundary name="marks" onBack={() => setShowMarks(false)}>
          <Suspense fallback={null}>
            <MarksIndex
              unlockedIds={markIdList}
              equippedId={equippedMark}
              achievementNames={ACH_NAME}
              level={xpProgress.level}
              earned={earnedAch}
              onEquip={(id) => setEquippedMark(ROLLS ? id : equipMark(id, earnedAch))}
              onClose={() => setShowMarks(false)}
            />
          </Suspense>
        </ScreenBoundary>
      )}

      {/* RANK LADDER overlay — all ten ranks, which you hold, which is next (fix/card-polish). */}
      {showRanks && (
        <ScreenBoundary name="rank-ladder" onBack={() => setShowRanks(false)}>
          <Suspense fallback={null}>
            <RankLadder level={xpProgress.level} onClose={() => setShowRanks(false)} />
          </Suspense>
        </ScreenBoundary>
      )}

      {/* FIRST-RUN spotlight (once ever): dim the menu, ring the XP bar, tell the player it
          responds to typing/clicks. pointer-events:none — the dismissing key/click still counts. */}
      {/* The spotlight rings the XP bar, which the phone branch does not render — with no
          target it would dim the menu and point at nothing, so it is desktop/tablet only. */}
      {showMenuSpot && !isPhoneMenu && (
        <Spotlight
          targetSelector=".menu-xp-bar"
          caption="TYPE OR CLICK ANYWHERE"
          sub="IT FILLS YOUR LEVEL BAR"
          // Never over the wordmark or a card title (fine-tune oct2, loop C): the caption picks a
          // clear slot, drops to its compact headline, or hides and lets the ring teach.
          avoidTextIn=".homepage-stage"
          avoidSelector=".homepage-logo-wrap, .homepage-cards-region, .homepage-corner-nav"
          // No wash (fine-tune oct2): a first-time player's first screen was ~70% dimmed behind a
          // ring; the ring + the bar's own TYPE ANYWHERE line teach without hiding the modes.
          dim={false}
          onDismiss={dismissMenuSpot}
        />
      )}
    </div>
  );
}
