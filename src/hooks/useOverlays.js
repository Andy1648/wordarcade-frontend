// useOverlays.js — the overlay/navigation concern extracted from App.jsx (refactor/app-split step 1).
// PURE refactor: this is the exact transition machinery + view-routing that lived inline in App,
// moved verbatim so App can compose it. App still OWNS the `view` useState (it is read before `sound`
// exists, and several App effects/renders depend on it); this hook RECEIVES `view`/`setView` and owns
// everything around them — the Persona-5 bar wipe, its refs, and the shop/stats/rebirth/solo nav
// helpers. Nothing here changes behaviour: same words, same 240ms clear, same nav-depth direction.
import { useRef, useEffect, useCallback } from 'react';
import { SAT_RUSH_VIEW, SAT_RUSH_TRANSITION_WORD } from '../satRush/config';
import { CHAIN_VIEW, CHAIN_TRANSITION_WORD, FUSE_VIEW, FUSE_TRANSITION_WORD } from '../solo/config';
import { CG_ENTRY } from '../cg/cgEntry';
import { DAILY_BLITZ_VIEW } from '../dailyBlitz/launch.js';
import { playWipe } from '../lib/navWipe';

// The word flashed mid-wipe when navigating to each view. (Moved verbatim from App.jsx.)
const TRANSITION_WORDS = {
  game: "LET'S GO!",
  'cg-arm': 'GET READY',
  home: 'PEACE OUT',
  lobby: 'READY?',
  browse: 'JOIN ROOM',
  room: 'SQUAD UP',
  credits: 'CREDITS',
  // the menu's major doors (Andy oct24 "transition screens for all buttons (or at least major ones)")
  shop: 'SHOP',
  stats: 'STATS',
  leaderboard: 'TOP DOGS',
  collection: 'STASH',
  achievements: 'BADGES',
  [DAILY_BLITZ_VIEW]: 'DAILY BLITZ',
  [SAT_RUSH_VIEW]: SAT_RUSH_TRANSITION_WORD,
  [CHAIN_VIEW]: CHAIN_TRANSITION_WORD,
  [FUSE_VIEW]: FUSE_TRANSITION_WORD,
};

// Nav DEPTH for the transition DIRECTION (Job 12): home is the root (0); menu overlays are 1; a
// live game/room/lobby is 2. Going to a deeper view = "forward" (enter); returning toward home =
// "back" (return). Any view not listed defaults to 1. (Moved verbatim from App.jsx.)
const NAV_DEPTH = {
  home: 0,
  credits: 1, stats: 1, leaderboard: 1, shop: 1, collection: 1, achievements: 1,
  browse: 1, lobby: 1,
  room: 2, game: 2, 'cg-arm': 2,
  [SAT_RUSH_VIEW]: 2, [CHAIN_VIEW]: 2, [FUSE_VIEW]: 2, [DAILY_BLITZ_VIEW]: 2,
};

export function useOverlays({ view, setView, sound, gameType }) {
  // Which menu control ('shop' | 'stats' | 'rebirth' | null) opened the overlay we're in, so the
  // homepage can restore focus to it on close (a11y). A ref: read once by the remounting Homepage.
  const overlayReturnRef = useRef(null);
  // Which view the shared Shop/Rebirth overlay opens into ('shop' | 'rebirth'). A ref: never renders.
  const shopViewRef = useRef('shop');

  // ---- ONE consistent wipe for EVERY screen change ----
  // Every transition is fired through this single helper (and lib/navWipe for the menu's sheets), so they
  // all look and sound identical. The overlay is purely cosmetic — the screen has already swapped
  // underneath — so this only lays the band on top.
  // ONE WIPE PER JOURNEY (Andy oct14 "word race has this weird yellow column at the start"): a quick match
  // changes view three times in ~2 s (READY? → SQUAD UP → LET'S GO!), and the last wipe ran while the race
  // mounted — on a busy phone the panel stalled mid-screen as a bright column over the countdown. A view
  // change within COALESCE_MS of the last wipe now swaps without one (the screen still swaps instantly).
  // POOLED (oct24): the wipe is ONE always-mounted node (TransitionOverlay) replayed by lib/navWipe — no
  // state, no re-render, no node per transition. playWipe owns the coalesce clock + reduce-motion check.
  const runTransition = useCallback(
    (word, dir = 'forward') => {
      if (playWipe(word, dir)) sound.whoosh(); // the wipe sweeps across
    },
    [sound]
  );

  // Fire the wipe on every real view change. The screen has already swapped (it renders off `view`);
  // this only lays the overlay on top. The early-return avoids a spurious wipe when `view` didn't
  // actually change (initial mount / no-op setState).
  const lastNavViewRef = useRef(CG_ENTRY ? 'cg-arm' : 'home');
  useEffect(() => {
    if (view === lastNavViewRef.current) return;
    // Nav DIRECTION (Job 12): deeper view = "forward" (enter); toward home = "back". Equal = forward.
    const dir = (NAV_DEPTH[view] ?? 1) >= (NAV_DEPTH[lastNavViewRef.current] ?? 1) ? 'forward' : 'back';
    lastNavViewRef.current = view;
    // WORD RACE starts its own countdown the instant the race mounts — a LET'S GO! wipe on top of it was
    // the "yellow column" (the panel stalling mid-screen over the 3-2-1). The race enters clean.
    if (view === 'game' && gameType === 'word-race') return;
    runTransition(TRANSITION_WORDS[view] || 'GO!', dir);
    // gameType is read at the moment the view changes (set in the same game_started batch); it is not a trigger
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, runTransition]);

  // Overlay / mode nav helpers — pure `view` navigations (+ the focus/sub-view refs). No room/game
  // state, so they live with the overlay concern. (goHome is cross-cutting and stays in App.)
  const goToStats = () => {
    overlayReturnRef.current = 'stats'; // restore focus here when Stats closes
    setView('stats');
  };
  const goToLeaderboard = () => {
    overlayReturnRef.current = 'leaderboard'; // restore focus to the trophy when the board closes
    setView('leaderboard');
  };
  const goToShop = () => {
    shopViewRef.current = 'shop';
    overlayReturnRef.current = 'shop'; // restore focus here when Shop closes
    setView('shop');
  };
  const goToRebirth = () => {
    shopViewRef.current = 'rebirth';
    overlayReturnRef.current = 'rebirth';
    setView('shop');
  };
  const goToCredits = () => setView('credits');
  const goToSatRush = () => setView(SAT_RUSH_VIEW);
  const goToChain = () => setView(CHAIN_VIEW);
  const goToFuse = () => setView(FUSE_VIEW);

  return {
    runTransition,
    shopViewRef,
    overlayReturnRef,
    goToStats,
    goToLeaderboard,
    goToShop,
    goToRebirth,
    goToCredits,
    goToSatRush,
    goToChain,
    goToFuse,
  };
}
