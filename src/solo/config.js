// config.js — solo-mode flags, view ids, and launch-intent parsing.
//
// CHAIN and FUSE are flag-gated exactly like SAT RUSH: nothing on the menu points at
// them yet, and they're reachable in dev via ?chain=1 / ?fuse=1 (a solo launch link,
// no room/WebSocket). Adding menu cards later is a gameData change, not a rewrite.

export const CHAIN_VIEW = 'chain';
export const FUSE_VIEW = 'fuse';

// The transition word shown by App's view-change wipe when entering each mode.
export const CHAIN_TRANSITION_WORD = 'CHAIN';
export const FUSE_TRANSITION_WORD = 'FUSE';

// Modes ship as soon as they're wired; the flag lets us dark-launch behind ?chain/?fuse.
export const SOLO_MODES_ENABLED = true;

function param(name) {
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get(name) === '1';
  } catch {
    return false;
  }
}

// Read once at module load (same idiom as satRush/App). ?chain=1 / ?fuse=1.
export const SOLO_LAUNCH = {
  chain: param('chain'),
  fuse: param('fuse'),
};
