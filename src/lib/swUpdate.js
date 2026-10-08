// swUpdate.js — N3 (Andy oct2): "the leaderboard icon sometimes doesn't show until refresh".
//
// CAUSE: the service worker (vite.config.js pwaPlugin — precache-first, registerType autoUpdate) answers a
// returning visit from the PREVIOUS deploy's precache: the old index.html, the old bundle. The new SW then
// installs in the background and takes control (skipWaiting + clientsClaim), but nothing reloads the page,
// so the visit runs the old build to the end — anything a newer deploy added (a nav icon) is simply not
// there until the player refreshes. The NEXT visit is fine, which is why it looked intermittent.
//
// FIX: when an UPDATED service worker takes control (the page already had one — not the first install,
// whose page IS the newest build), reload once so the screen runs the build the SW just activated. Never
// mid-game: the reload waits until the player is NOT IN PLAY. One reload per update, never a loop.
//
// IMMEDIATE (Andy oct8, the SEASON 2 flip: "why would I want a delay? immediate is best"): the old rule waited for
// the MENU (.homepage-wrap), so a returning player — who lands on the SPLASH after 30+ min away — kept the previous
// build until they typed through to the menu. Now the reload fires anywhere that is not a round in progress
// (data-view on <html>, App.jsx: game / room / lobby / vs-bot / chain / fuse / sat-rush), so splash, menu, shop,
// stats, board, credits all reload at once. And a tab left OPEN across a deploy never asked for a new worker (the
// browser only checks on navigation): registration.update() runs whenever the tab comes back into view, so the
// new build arrives within seconds of the player's return instead of on their next visit.
const IN_PLAY = new Set(['game', 'room', 'lobby', 'vs-bot', 'chain', 'fuse', 'sat-rush']);
const notInPlayDefault = () => {
  try {
    const v = document.documentElement.getAttribute('data-view');
    if (!v) return true; // boot / splash: no screen state yet
    return !IN_PLAY.has(v);
  } catch { return true; }
};

export function installSwUpdateReload({ onMenu = notInPlayDefault, pollMs = 2000, checkOnFocus = true } = {}) {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false;
  if (!navigator.serviceWorker.controller) return false; // first install: nothing stale on screen
  let done = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (done) return;
    const go = () => {
      if (done) return;
      done = true;
      try { window.location.reload(); } catch { /* non-browser env */ }
    };
    if (onMenu()) { go(); return; }
    const t = setInterval(() => { if (onMenu()) { clearInterval(t); go(); } }, pollMs);
  });
  if (checkOnFocus) {
    const check = () => {
      try {
        if (document.visibilityState !== 'visible') return;
        navigator.serviceWorker.getRegistration().then((r) => r && r.update()).catch(() => {});
      } catch { /* ignore */ }
    };
    try { document.addEventListener('visibilitychange', check); window.addEventListener('focus', check); } catch { /* non-browser */ }
  }
  return true;
}
