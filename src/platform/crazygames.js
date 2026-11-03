// platform/crazygames.js — the CrazyGames SDK v3 glue, ONLY live in the crazygames build (VITE_PLATFORM=crazygames,
// from .env.crazygames). Everywhere else IS_CRAZYGAMES is false and every export is a no-op, so typeaword.com
// behaves exactly as before.
//
// What it does (docs.crazygames.com/sdk/intro + /sdk/game):
//   * initCrazyGames()  — once at boot: `await CrazyGames.SDK.init()`, plus the html.cg-embed class (user-select:none
//                         on the body, inputs exempt — their mobile requirement; index.css owns the rule).
//   * setGameplay(on)   — gameplayStart() when the player enters a round / solo run, gameplayStop() when they leave
//                         it. De-duplicated, and queued until init resolves. CrazyGames measures the "initial
//                         download" up to the first gameplayStart, so this is what keeps the menu's lazy chunks out
//                         of that number.
// Never throws: an ad-blocker that drops the SDK script, or the 'disabled' SDK environment (any non-CrazyGames,
// non-localhost origin), just leaves the game running without the SDK.

export const IS_CRAZYGAMES = (import.meta.env && import.meta.env.VITE_PLATFORM) === 'crazygames';

let ready = false;
let wanted = null; // the latest requested gameplay state (true/false), applied once ready
let applied = false; // gameplay starts STOPPED, so the menu's first setGameplay(false) sends nothing

function sdk() {
  try {
    const s = typeof window !== 'undefined' && window.CrazyGames && window.CrazyGames.SDK;
    if (!s || s.environment === 'disabled') return null;
    return s;
  } catch {
    return null;
  }
}

function flush() {
  if (!ready || wanted === null || wanted === applied) return;
  const s = sdk();
  if (!s || !s.game) return;
  try {
    if (wanted) s.game.gameplayStart();
    else s.game.gameplayStop();
    applied = wanted;
  } catch {
    /* SDK hiccup: the game keeps running */
  }
}

export function initCrazyGames() {
  if (!IS_CRAZYGAMES || typeof window === 'undefined') return;
  try {
    document.documentElement.classList.add('cg-embed');
  } catch {
    /* no DOM */
  }
  const s = window.CrazyGames && window.CrazyGames.SDK;
  if (!s || typeof s.init !== 'function') return;
  Promise.resolve()
    .then(() => s.init())
    .then(() => {
      ready = true;
      flush();
    })
    .catch(() => {
      /* SDK unavailable here (wrong origin / blocked): play on without it */
    });
}

export function setGameplay(on) {
  if (!IS_CRAZYGAMES) return;
  wanted = !!on;
  flush();
}
