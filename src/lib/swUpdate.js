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
// mid-game: the reload waits until the menu is on screen. One reload per update, never a loop.
const onMenuDefault = () => !!document.querySelector('.homepage-wrap');

export function installSwUpdateReload({ onMenu = onMenuDefault, pollMs = 2000 } = {}) {
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
  return true;
}
