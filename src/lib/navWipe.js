// navWipe.js — the ONE pooled screen-change wipe (Andy oct24: "transition screens for all buttons (or at
// least major ones)"). A single overlay node (TransitionOverlay) is mounted ONCE for the life of the app
// and registers its parts here; every transition — a `view` change in App, or a menu sheet opening /
// closing (GEARS / ROLL, CONTRACTS, REWARDS, PROFILE) — replays the SAME node through WAAPI. No node is
// ever created per transition (CLAUDE.md "pool every repeated element").
//
// PURELY COSMETIC (CLAUDE.md Known Bugs): callers swap the screen FIRST (or in the same tick) and this
// only lays the wipe on top — position:fixed, pointer-events:none. Nothing here returns a promise,
// gates, delays or blocks which screen is shown; a wipe that never plays loses nothing but motion.
//
// LOOK + TIMING = the ORIGINAL pre-#514 wipe (Andy oct25 "i dont like the new transition screen … not as clean
// as the original one"): the exact old CSS keyframes, replayed here — the full-screen panel sweeps
// translateX(-100%) → 0 (cover peak at 45%) → 100% over 240ms with the shared --transition-ease on every
// segment (a CSS animation-timing-function eases each keyframe interval), and the word fades/scales
// 0.9 → 1 → 1.04 ease-out. Motion law: transform + opacity ONLY, finite one-shots, no layout reads,
// will-change set on play and cleared on finish, and REDUCE MOTION skips the wipe entirely.
import { reduceMotion } from './reduceMotion.js';

export const WIPE_MS = 240; // = Transitions.css --transition-ms (the original "one language, <=250ms")
// ONE WIPE PER JOURNEY (Andy oct14 "weird yellow column"): a burst of view changes (READY? → SQUAD UP →
// LET'S GO!) gets one wipe, not three stacked on a mounting game.
export const COALESCE_MS = 900;
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'; // = Transitions.css --transition-ease
export const COVER_AT = 0.45; // the cover peak: the panel sits exactly on the viewport

let parts = null; // { root, panel, word }
let running = [];
let lastAt = -Infinity;
let lastResult = 'skipped'; // 'played' | 'skipped' (no overlay / reduce motion) | 'coalesced'

/** What the last playWipe call did — App's view-change whoosh plays unless the change was COALESCED. */
export function lastWipeResult() {
  return lastResult;
}

/** Called once by TransitionOverlay on mount. Returns the unregister function. */
export function registerWipe(p) {
  parts = p;
  return () => {
    stop();
    if (parts === p) parts = null;
  };
}

function stop() {
  for (const a of running) {
    try { a.cancel(); } catch { /* already gone */ }
  }
  running = [];
  if (!parts) return;
  parts.root.dataset.state = 'idle';
  parts.panel.style.willChange = '';
  parts.word.style.willChange = '';
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/**
 * Play the wipe. `dir` 'forward' (deeper: the panel sweeps left→right) or 'back' (returning: right→left).
 * Returns true when a wipe actually started (false: reduced motion, coalesced, no overlay, no WAAPI).
 */
export function playWipe(word, dir = 'forward') {
  // the coalesce clock runs FIRST and ticks even when nothing can be drawn (no overlay yet, reduce motion), exactly
  // like the old App-side wipe: a journey is one journey whether or not it was animated
  const t = now();
  if (t - lastAt < COALESCE_MS) { lastResult = 'coalesced'; return false; }
  lastAt = t;
  lastResult = 'skipped';
  if (!parts || reduceMotion()) return false;
  if (typeof parts.panel.animate !== 'function') return false;
  lastResult = 'played';
  stop();
  const { root, panel, word: wordEl } = parts;
  const back = dir === 'back';
  root.dataset.state = 'play';
  root.dataset.dir = back ? 'back' : 'forward';
  wordEl.textContent = word || '';
  panel.style.willChange = 'transform';
  wordEl.style.willChange = 'transform, opacity';
  const timing = { duration: WIPE_MS, easing: 'linear', fill: 'both' };
  const from = back ? '100%' : '-100%';
  const to = back ? '-100%' : '100%';
  const panelAnim = panel.animate(
    [
      { transform: `translateX(${from})`, easing: EASE },
      { transform: 'translateX(0)', offset: COVER_AT, easing: EASE },
      { transform: `translateX(${to})` },
    ],
    timing,
  );
  const wordAnim = wordEl.animate(
    [
      { opacity: 0, transform: 'scale(0.9)', easing: 'ease-out' },
      { opacity: 1, transform: 'scale(1)', offset: COVER_AT, easing: 'ease-out' },
      { opacity: 0, transform: 'scale(1.04)' },
    ],
    timing,
  );
  running = [panelAnim, wordAnim];
  panelAnim.onfinish = () => { if (running[0] === panelAnim) stop(); };
  return true;
}

/** Test seam: forget the coalesce clock. */
export function _resetWipeClock() {
  lastAt = -Infinity;
}
