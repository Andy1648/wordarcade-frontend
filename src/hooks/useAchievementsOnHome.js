// useAchievementsOnHome.js — the home-menu achievements re-evaluation extracted from App.jsx
// (refactor/app-split-6). PURE refactor: moved verbatim. Re-evaluate whenever we land on the home
// menu (so anything earned during a game / run is caught on return). checkAchievements grants wins
// for newly-earned only (the wins chip updates as feedback); the full grid is on the ACHIEVEMENTS
// screen. Idempotent — a repeat home visit with nothing new grants nothing. Takes the live `view`.
import { useEffect } from 'react';
import { checkAchievements } from '../progress/achievements';
import { secretFound as evSecretFound } from '../lib/events.js';

export function useAchievementsOnHome(view) {
  useEffect(() => {
    if (view !== 'home') return;
    const newly = checkAchievements();
    // analytics: a hidden/secret achievement was just discovered (additive; never alters the grant).
    try { if (Array.isArray(newly)) for (const a of newly) if (a && a.secret) evSecretFound(a.id); } catch { /* analytics only */ }
  }, [view]);
}
