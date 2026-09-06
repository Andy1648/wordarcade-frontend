// useUrlSync.js — the view<->DOM/URL reflection extracted from App.jsx (refactor/app-split-6).
// PURE refactor: three effects moved verbatim — the data-view attribute mirror, the clean-URL
// history sync, and the popstate back/forward handler. Takes the live `view` + the nav helpers
// (goHome/goToSatRush/goToChain/goToFuse). NONE of these touch the WS drain, the functional-setView
// room guard, the live-`view` render, or the FIFO queue — they only reflect the already-chosen view
// onto <html> and the URL, and map Back/forward to the safe client-side views.
import { useRef, useEffect } from 'react';
import { canonicalPathForView, MENU_PATHS, hasStickyQuery, viewIntentFromPath } from '../router';

export function useUrlSync({ view, goHome, goToSatRush, goToChain, goToFuse }) {
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
}
