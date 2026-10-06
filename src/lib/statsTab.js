// statsTab.js — which tab the Stats overlay opens on, set by the caller just before it navigates there
// (the menu's ACHIEVEMENTS tile opens Stats on its ACHIEVEMENTS tab). One pending value, so a later plain
// STATS open is back on the default tab. Keeps App out of it.
//
// READ IN RENDER, CLEAR ON COMMIT. StatsScreen reads the value in a useState initializer, and React may run
// that initializer more than once for ONE mount: a lazy/Suspense retry renders at a non-sync priority, and
// any higher-priority update (App re-renders ~1-2x/sec) interrupts it, throws the work-in-progress tree
// away and renders the mount again from scratch. When the read was destructive (take-and-clear), the first,
// discarded render ate the value and the committed one opened on STATS — every time on a slow device (6x CPU
// throttle: 10/10), and intermittently on CI (claims-via-stats.spec.js:57). So: peek while rendering, clear
// only once the screen has actually mounted (clearStatsTab, from an effect).
let pending = null;

export function setStatsTab(tab) {
  pending = tab || null;
}

/** The pending tab, without consuming it — safe in a render / useState initializer. */
export function peekStatsTab() {
  return pending;
}

/** Consume the pending tab. Call from an effect (commit), never from render. */
export function clearStatsTab() {
  pending = null;
}
