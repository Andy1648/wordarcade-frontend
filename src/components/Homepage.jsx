// Homepage.jsx
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { GAMES } from '../gameData';
import { useSound } from '../contexts/SoundContext';
import { squash, flash, burst, sfx, setMuted as setJuiceMuted } from '../juice';
import { useMagneticPull } from '../lib/magneticPull';
import GameCard from './GameCard';
import { MenuXpBar, MenuXpFx } from './MenuXp';
import { useXpCapture } from '../progress/useXpCapture';
import { getWins, getWinsLifetime, consumePendingWinsStamp, hasSeenWinsHint, markWinsHintSeen } from '../progress/wins';
import { consumePendingRebirth, getRebirths, rebirthThreshold } from '../progress/xp';
import { getStreak } from '../progress/streak';
import { canAffordAny } from '../progress/shop';
import ModeDialog from './ModeDialog';
import LockedPreviewDialog from './LockedPreviewDialog';
import ConnectingContent from './ConnectingContent';
import GraffitiTag from './decor/GraffitiTag';
import {
  PaintSplatter1,
  PaintSplatter2,
  PaintSplatter3,
  PaintSplatter4,
} from './decor/PaintSplatters';
import './wall-system.css';
import './Homepage.css';

// Palette pairs (fill + a darker shade of the same hue for the sprayed outline -
// never black, per the project's colored-outline rule).
const PINK = { fill: '#FF2EC4', line: '#991A75' };
const CYAN = { fill: '#2EFFE0', line: '#1A9985' };
const YELLOW = { fill: '#FFE94A', line: '#B8A020' };
const ORANGE = { fill: '#FF6B3D', line: '#B83D15' };
const PURPLE = { fill: '#9A1AFF', line: '#5A0EAA' };

// ALLEY DEPTH (one-point perspective). Vanishing point sits behind the title,
// up-centre; the wall recedes toward it. Lines below converge ON it (floor
// boards + ceiling + side walls) and the tags are SCALE-GRADED to it: tiny &
// faint near the VP (far away), large & stronger at the lower corners (near /
// foreground). Together with the streetlight pool this builds real depth - a
// place you look INTO, not a flat field. Deterministic (no randomness).
const VANISHING = { x: 50, y: 40 };
const PERSPECTIVE_ENDS = [
  // floor boards (the strongest depth cue) running out to the bottom edge
  [0, 100], [17, 100], [34, 100], [50, 100], [66, 100], [83, 100], [100, 100],
  // ceiling
  [0, 0], [100, 0],
  // side walls meeting the floor
  [0, 47], [100, 47],
];

const RECEDING_TAGS = [
  // deep background - small + faint, clustered near the vanishing point
  { word: 'RIP',  c: PURPLE, size: 20, top: 31, left: 47, rot: -6,  op: 0.12, drip: 0 },
  { word: 'POW',  c: CYAN,   size: 24, top: 27, left: 57, rot: 9,   op: 0.13, drip: 0 },
  { word: 'EZ',   c: YELLOW, size: 22, top: 37, left: 39, rot: -10, op: 0.12, drip: 0 },
  // mid distance - moderate, out toward the sides
  { word: 'BOOM', c: ORANGE, size: 38, top: 13, left: 73, rot: 7,   op: 0.18, drip: 0 },
  { word: 'FIRE', c: PURPLE, size: 44, top: 55, left: 3,  rot: -8,  op: 0.20, drip: 28 },
  { word: 'ZAP',  c: CYAN,   size: 36, top: 60, left: 87, rot: 12,  op: 0.18, drip: 0 },
  // foreground - large + stronger in the lower corners, reads IN FRONT
  { word: 'WORD', c: PINK,   size: 56, top: 71, left: 1,  rot: 6,   op: 0.28, drip: 34 },
  { word: 'GG',   c: YELLOW, size: 50, top: 75, left: 85, rot: -8,  op: 0.26, drip: 0 },
];

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
export default function Homepage({ onSelectGame, onCreateRoom, onJoinRoom, onQuickPlay, onCredits, onStats, onShop, onRebirth, onSatRush, onChain, onFuse, wsStatus, serverEventId, blitzPacks, onToggleBlitzPack, onSetAllBlitzPacks, onDaily, daily, restoreFocus = null, onFocusRestored }) {
  // Once any navigation action fires we're about to transition away; lock the
  // buttons so a rapid second click can't double-fire. State resets naturally
  // because the component unmounts on the screen change.
  const [navigating, setNavigating] = useState(false);
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
    let raf = 0;
    const compute = () => {
      // Reset to the natural (unscaled) size for a clean, non-compounding measurement.
      stage.style.setProperty('--menu-scale', '1');
      // Phones (≤760px) own their layout in CSS: a fixed frame (title + XP + action buttons)
      // with the CARD LIST scrolling in the middle, so all five cards are reachable and the XP
      // bar never scrolls out. The fit-to-one-screen scale is a laptop concept — leave scale at
      // 1 there so the cards keep full size and the card region's internal scroll takes over.
      if (window.innerWidth <= 760) return;
      const cs = getComputedStyle(stage);
      const padT = parseFloat(cs.paddingTop) || 0;
      const padB = parseFloat(cs.paddingBottom) || 0;
      const rowGap = parseFloat(cs.rowGap) || 0;
      const inner = stage.clientHeight - padT - padB;
      if (inner <= 0) return;
      // In-flow (flex) children only — the absolutely-positioned glow/spotlight/corner
      // buttons don't take part in the column's height.
      const kids = Array.from(stage.children).filter((el) => {
        const p = getComputedStyle(el).position;
        return p !== 'absolute' && p !== 'fixed' && el.offsetHeight > 0;
      });
      if (!kids.length) return;
      // Only the TITLE, XP BAR and CARD REGION key off --menu-scale; the bottom bar /
      // daily link / footer stay fixed. Split the two so the fit math is exact: solve
      // scale·scalable + fixed + gaps = inner.
      const SCALES = ['homepage-logo-wrap', 'menu-xp-bar', 'homepage-cards-region', 'menu-xp-caption'];
      let scalable = 0;
      let fixed = 0;
      for (const el of kids) {
        if (SCALES.some((c) => el.classList.contains(c))) scalable += el.offsetHeight;
        else fixed += el.offsetHeight;
      }
      const gaps = rowGap * Math.max(0, kids.length - 1);
      if (scalable <= 0) return;
      // Fit the content to inner MINUS a vertical RESERVE, so the centred column keeps a
      // breathing gap at the stage's inner top AND bottom edge instead of filling flush (or
      // overflowing on short screens / floating on tall ones). The reserve is split evenly by
      // justify-content:center, so ~RESERVE/2 lands on each side — the gaps are SYMMETRIC by
      // construction (top == bottom). Reduced 56→44 so the visible gap to the neon FRAME
      // (reserve/2 + the stage's own vertical padding) stays inside the 16-32px band at every
      // width — at 56 the 2560/1920 frame gaps ran 35-36px (just over 32). Smaller reserve =
      // the content column grows to fill the extra room. Clamp [0.42, 1.35] unchanged so
      // content can still fill a tall 2560 screen and shrink on a short 1163×501 one.
      const RESERVE = 44;
      const raw = (inner - RESERVE - gaps - fixed) / scalable;
      const scale = Math.max(0.42, Math.min(1.35, raw));
      stage.style.setProperty('--menu-scale', scale.toFixed(4));
    };
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(compute);
    };
    compute();
    raf = requestAnimationFrame(compute); // second pass after fonts/layout settle
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const cardsScrollRef = useRef(null);
  const cardsRowhRef = useRef(0);
  const [cardsBelow, setCardsBelow] = useState(0); // cards below the fold
  const [cardsAtEnd, setCardsAtEnd] = useState(false);
  const [cardsScrollable, setCardsScrollable] = useState(false);
  const [cardsMobile, setCardsMobile] = useState(false); // <=760px: no region/button

  useEffect(() => {
    const el = cardsScrollRef.current;
    if (!el) return undefined;
    const mq = window.matchMedia('(max-width: 760px)');

    // Measure the tallest row-1 card (incl. its stagger margin-top) → --rowh.
    const measure = () => {
      const grid = el.querySelector('.homepage-cards-grid');
      if (!grid) return;
      const cards = grid.querySelectorAll('.game-card-magnet');
      if (!cards.length) return;
      const gridTop = grid.getBoundingClientRect().top;
      const rowOne = Math.min(3, cards.length);
      let rowh = 0;
      for (let i = 0; i < rowOne; i += 1) {
        const bottom = cards[i].getBoundingClientRect().bottom - gridTop;
        if (bottom > rowh) rowh = bottom;
      }
      if (rowh > 0) {
        cardsRowhRef.current = rowh;
        el.style.setProperty('--rowh', `${rowh}px`);
      }
    };

    // Recompute the fold count + fade/end flags (also on every scroll).
    const updateState = () => {
      const regionBottom = el.getBoundingClientRect().bottom;
      let below = 0;
      el.querySelectorAll('.game-card-magnet').forEach((c) => {
        if (c.getBoundingClientRect().bottom > regionBottom + 1) below += 1;
      });
      setCardsBelow(below);
      setCardsScrollable(el.scrollHeight > el.clientHeight + 1);
      setCardsAtEnd(el.scrollTop + el.clientHeight >= el.scrollHeight - 1);
    };

    const refresh = () => {
      setCardsMobile(mq.matches);
      measure();
      updateState();
    };

    // Coalesce scroll-driven layout reads into ONE rAF: a burst of scroll events (mobile
    // momentum can fire ~1/frame) schedules at most one measurement per frame instead of
    // forcing a full read of every card on every event.
    let scrollRaf = 0;
    const onScroll = () => {
      if (scrollRaf) return;
      scrollRaf = requestAnimationFrame(() => {
        scrollRaf = 0;
        updateState();
      });
    };

    refresh();
    const raf = requestAnimationFrame(refresh); // second pass after layout/fonts settle
    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', refresh);
    return () => {
      cancelAnimationFrame(raf);
      if (scrollRaf) cancelAnimationFrame(scrollRaf);
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', refresh);
    };
  }, []);

  const scrollCardsDown = () => {
    const el = cardsScrollRef.current;
    if (el) el.scrollBy({ top: cardsRowhRef.current || 0, behavior: 'smooth' });
  };

  // ---- Menu XP meta-progression (presentational) -------------------------------
  // Typing anywhere on the menu earns XP (no text input here). The capture/credit/streak
  // logic is the SHARED hook (also used by the splash) so the two can't drift; it only
  // ever surfaces as the pops + the bar. No-ops while a mode dialog is open.
  const xpFxRef = useRef(null);
  const dialogOpenRef = useRef(false);
  useEffect(() => {
    dialogOpenRef.current = !!dialog;
  }, [dialog]);
  // Wins balance shown in the chip. Seeded on mount, then kept LIVE: level-ups now pay wins
  // while the player is still on the menu (see useXpCapture), so a mount-only snapshot would
  // sit stale until a remount. onCredit below refreshes it (and the affordability dot).
  const [wins, setWins] = useState(() => getWins());
  // Rebirth count (read once on mount) — keys the XP-bar fill colour. Equipping/rebirth
  // happen on other screens, which remount this component, so a snapshot is correct.
  const [rebirths] = useState(() => getRebirths());
  // All-time wins earned + the current daily-streak count, both snapshotted on mount (they only
  // change inside a round, which remounts this screen on return). winsLifetime drives the
  // first-run gating (hide REBIRTH / the XP caption until the player has actually earned wins);
  // streak drives the menu chip (shown only at >= 2 days).
  const [winsLifetime] = useState(() => getWinsLifetime());
  const [streak] = useState(() => getStreak().count);
  // Can the player buy at least one unowned item? Drives the wins-chip dot. Refreshed
  // alongside the balance so earning enough on the menu lights the dot immediately.
  const [winsAffordable, setWinsAffordable] = useState(() => canAffordAny());
  const { progress: xpProgress } = useXpCapture({
    fxRef: xpFxRef,
    isBlocked: () => dialogOpenRef.current,
    // Fires on every credited keystroke/tap. getWins() only moves on a level-up payout, so
    // the balance setState is a no-op (same value) until then — cheap to check each credit.
    onCredit: () => {
      const w = getWins();
      setWins((prev) => (prev !== w ? w : prev));
      setWinsAffordable(canAffordAny(w));
    },
  });
  const shopLinkRef = useRef(null);
  const statsLinkRef = useRef(null);
  const rebirthLinkRef = useRef(null);
  // A11y: when an overlay (Shop/Stats) closes, App passes which control opened it so we
  // restore focus to that footer link on this remount, then clear the flag.
  useEffect(() => {
    if (restoreFocus === 'shop' && shopLinkRef.current) shopLinkRef.current.focus();
    else if (restoreFocus === 'stats' && statsLinkRef.current) statsLinkRef.current.focus();
    else if (restoreFocus === 'rebirth' && rebirthLinkRef.current) rebirthLinkRef.current.focus();
    if (restoreFocus && onFocusRestored) onFocusRestored();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const rb = consumePendingRebirth();
    if (rb > 0 && xpFxRef.current) {
      xpFxRef.current.rebirthCelebration(rb);
    } else {
      const stamp = consumePendingWinsStamp();
      if (stamp > 0 && xpFxRef.current) {
        // The FIRST time a round ever pays out, show the one-time explainer ("WINS BUY UPGRADES
        // IN THE SHOP") instead of the bare "+N WINS" — a newcomer has no idea what wins are for
        // (the audit's #1 leak). Every later payout shows the normal stamp.
        if (!hasSeenWinsHint()) {
          markWinsHintSeen();
          xpFxRef.current.winsHint();
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

  function handleCredits() {
    if (navigating) return;
    sound.click();
    setNavigating(true);
    if (onCredits) onCredits();
  }

  // Daily Challenge: one tap straight into today's board (App creates a room,
  // locks Blitz and starts daily:true in one shot). Connect-gated like
  // CREATE/JOIN so a cold backend shows CONNECTING… instead of a dead tap.
  function handleDaily(e) {
    if (navigating) return;
    pressJuice(e, '#FFE94A'); // yellow accent — the daily's colour
    sound.click();
    setNavigating(true);
    runWhenConnected('daily', () => onDaily && onDaily());
  }

  // A locked (level-gated) card was clicked: open its read-only preview dialog instead of
  // navigating. `gameId` comes from GameCard's locked-click hook.
  function handleLockedSelect(gameId) {
    if (navigating) return;
    const game = GAMES.find((g) => g.id === gameId);
    if (!game) return;
    sound.click();
    setLockedPreview({ game });
  }

  return (
    <div className="homepage-wrap">
      <div ref={stageRef} className={`homepage-stage wall-surface${dialog ? ' is-dimmed' : ''}`}>
        {/* BEAT GLOW: a soft pink pool that pulses on each detected beat - the
            menu's one piece of ambient motion now that the idle loops are gone.
            Opacity-only, sits above the wall texture but below the content. */}
        <div className="homepage-beat-glow" aria-hidden="true" />
        {/* STREETLIGHT: a warm pool of light dropping from above onto the focal
            point (title + cards), brightest at the top and falling off. */}
        <div className="homepage-spotlight wall-spotlight" aria-hidden="true" />

        {/* Corner nav — three WORD buttons (not glyphs), stacked in the top-right corner. Each
            is Bungee on a flat fill, thick black border + hard offset shadow, 44px tall, width
            auto (item 3). SHOP keeps its affordable-item dot. */}
        <nav className="homepage-corner-nav" aria-label="Menu">
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
          {/* REBIRTH is a prestige-RESET mechanic — noise to a level-1 newcomer with nothing to
              reset (the audit's #2 leak). Show it ONLY once it means something: the player can
              actually rebirth now (level has reached the next threshold), OR has ever earned wins,
              OR has already rebirthed. Until then it stays out of the top nav entirely. */}
          {(rebirths > 0 || winsLifetime > 0 || xpProgress.level >= rebirthThreshold(rebirths)) && (
            <button
              ref={rebirthLinkRef}
              type="button"
              className={`homepage-nav-btn is-rebirth${navigating ? ' disabled' : ''}`}
              onClick={handleRebirth}
              onMouseEnter={() => sfx('hover')}
              disabled={navigating}
              aria-label="Open rebirth"
            >
              REBIRTH
            </button>
          )}
          <button
            ref={statsLinkRef}
            type="button"
            className={`homepage-nav-btn is-stats${navigating ? ' disabled' : ''}`}
            onClick={handleStats}
            onMouseEnter={() => sfx('hover')}
            disabled={navigating}
            aria-label="Open stats"
          >
            STATS
          </button>
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


        {/* XP meta-progression bar — the PRIMARY element in the space the words-typed
            odometer used to occupy (that chip was removed). LV chip + fill + an "XP-into /
            XP-needed" readout, fed by global keystroke capture (see the effect above). */}
        <MenuXpBar
          level={xpProgress.level}
          toNext={xpProgress.toNext}
          frac={xpProgress.frac}
          intoLevel={xpProgress.intoLevel}
          cost={xpProgress.cost}
          rebirths={rebirths}
          wins={wins}
          onWinsClick={handleShop}
          streak={streak}
        />
        {/* First-visit XP caption: one line telling a brand-new player where XP comes from. Shown
            only before LV2 AND only to a genuinely new account (no wins earned, no rebirths — so a
            rebirthed player back at LV1 never sees it), then never again once they reach LV2. */}
        {xpProgress.level < 2 && winsLifetime === 0 && rebirths === 0 && (
          <div className="menu-xp-caption">TYPE ANYWHERE TO EARN XP</div>
        )}

        <div className="homepage-cards-region">
          <div
            ref={cardsScrollRef}
            className={`homepage-cards-scroll${cardsScrollable && !cardsAtEnd ? '' : ' is-atend'}`}
          >
            <div className="homepage-cards-grid" style={{ '--card-count': GAMES.length }}>
              {GAMES.map((game) => (
                <GameCard
                  key={game.id}
                  game={game}
                  onSelect={handleOpenDialog}
                  onLockedSelect={handleLockedSelect}
                  onHover={handleHover}
                  locked={game.unlockLevel != null && xpProgress.level < game.unlockLevel}
                  playerLevel={xpProgress.level}
                />
              ))}
            </div>
          </div>
          {/* "N MORE" pager — desktop only, and only while cards sit below the fold
              (so it's absent for a single row and once scrolled to the end). */}
          {!cardsMobile && cardsBelow > 0 && (
            <button
              type="button"
              className="homepage-cards-more"
              onClick={scrollCardsDown}
              onMouseEnter={() => sfx('hover')}
              aria-label={`Show ${cardsBelow} more game${cardsBelow === 1 ? '' : 's'}`}
            >
              {cardsBelow} MORE{' '}
              <span className="homepage-cards-more-chev" aria-hidden="true">
                ▾
              </span>
            </button>
          )}
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

        {/* DAILY CHALLENGE entry — a quiet text link under JOIN ROOM. Same onDaily
            handler + day number. (The daily-STREAK feature was removed, so the copy no
            longer references a streak — just the day #.) */}
        {daily && (
          <button
            className={`homepage-daily-link${navigating ? ' disabled' : ''}${connecting === 'daily' && coldStart ? ' is-waking' : ''}`}
            onClick={handleDaily}
            onMouseEnter={() => sfx('hover')}
            disabled={navigating}
            aria-label={`Daily challenge number ${daily.dayNumber}`}
          >
            {connecting === 'daily' ? (
              <ConnectingContent cold={coldStart} />
            ) : (
              `⚡ DAILY #${daily.dayNumber}`
            )}
          </button>
        )}

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
        </div>
      </div>

      {/* XP feedback layer — a SIBLING of the panel, filling the outer backdrop margin so
          the "+N" popups spawn outside the panel border and never overlap its content. */}
      <MenuXpFx ref={xpFxRef} />

      {/* The card->dialog expand. Portals to <body> so the stage's overflow:hidden
          and the app zoom never clip it; closes back into the source card. */}
      {dialog && (
        <ModeDialog
          game={dialog.game}
          sourceEl={dialog.el}
          onClose={() => setDialog(null)}
          onCreate={handleDialogCreate}
          onJoin={handleDialogJoin}
          onPlay={dialog.game.id === 'chain' || dialog.game.id === 'fuse' ? handleDialogPlay : undefined}
          connecting={connecting}
          coldStart={coldStart}
          blitzPacks={blitzPacks}
          onToggleBlitzPack={onToggleBlitzPack}
          onSetAllBlitzPacks={onSetAllBlitzPacks}
        />
      )}

      {/* Locked-mode preview (level-gated CHAIN/FUSE). Read-only teaser — no play button. */}
      {lockedPreview && (
        <LockedPreviewDialog
          game={lockedPreview.game}
          level={xpProgress.level}
          onClose={() => setLockedPreview(null)}
        />
      )}
    </div>
  );
}
