// statsTab.js — which tab the Stats overlay opens on, set by the caller just before it navigates there
// (the menu's ACHIEVEMENTS tile opens Stats on its ACHIEVEMENTS tab). One pending value, taken once by
// StatsScreen on mount, so a later plain STATS open is back on the default tab. Keeps App out of it.
let pending = null;

export function setStatsTab(tab) {
  pending = tab || null;
}

export function takeStatsTab() {
  const t = pending;
  pending = null;
  return t;
}
