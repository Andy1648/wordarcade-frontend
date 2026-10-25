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
// Motion law: transform + opacity ONLY, finite one-shots (~320ms), no layout reads (the band is
// sized in CSS — translate percentages need no measuring), will-change set on play and cleared on
// finish, and REDUCE MOTION skips the wipe entirely.
import { reduceMotion } from './reduceMotion.js';

export const WIPE_MS = 320;
// ONE WIPE PER JOURNEY (Andy oct14 "weird yellow column"): a burst of view changes (READY? → SQUAD UP →
// LET'S GO!) gets one wipe, not three stacked on a mounting game.
export const COALESCE_MS = 900;
const EASE_IN_SNAP = 'cubic-bezier(0.22, 1, 0.36, 1)'; // arrives hard, settles
const EASE_OUT_WHIP = 'cubic-bezier(0.5, 0, 0.75, 0)'; // leaves accelerating
const EASE_POP = 'cubic-bezier(0.34, 1.56, 0.64, 1)'; // a small overshoot

let parts = null; // { root, track, band, mascot, word, splat? }
let running = [];
let lastAt = -Infinity;
let mascotWarm = false;
let lastResult = 'skipped'; // 'played' | 'skipped' (no overlay / reduce motion) | 'coalesced'

/** What the last playWipe call did — App's view-change whoosh plays unless the change was COALESCED. */
export function lastWipeResult() {
  return lastResult;
}

// The wipe's ART (painted band, splat, mascot) is fetched on the first GESTURE — never before one (payload
// ratchet) — so it is cached and decoded by the time the first menu button is pressed. Every <img data-src> in
// the overlay is warmed at once.
function warmMascot() {
  if (mascotWarm || !parts || !parts.root) return;
  mascotWarm = true;
  const imgs = parts.root.querySelectorAll ? parts.root.querySelectorAll('img[data-src]') : [parts.mascot].filter(Boolean);
  for (const img of imgs) if (!img.getAttribute || !img.getAttribute('src')) img.src = img.dataset.src || '';
}
const ready = (img) => !!img && mascotWarm && img.complete && img.naturalWidth > 0;

/** Called once by TransitionOverlay on mount. Returns the unregister function. */
export function registerWipe(p) {
  parts = p;
  mascotWarm = false;
  const onGesture = () => {
    window.removeEventListener('pointerdown', onGesture, true);
    window.removeEventListener('keydown', onGesture, true);
    warmMascot();
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('pointerdown', onGesture, true);
    window.addEventListener('keydown', onGesture, true);
  }
  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('pointerdown', onGesture, true);
      window.removeEventListener('keydown', onGesture, true);
    }
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
  parts.band.style.willChange = '';
  parts.word.style.willChange = '';
  if (parts.mascot) parts.mascot.style.willChange = '';
  if (parts.splat) parts.splat.style.willChange = '';
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/**
 * Play the wipe. `dir` 'forward' (deeper: the band sweeps left→right) or 'back' (returning: right→left).
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
  if (typeof parts.band.animate !== 'function') return false;
  lastResult = 'played';
  stop();
  const { root, track, band, mascot, word: wordEl } = parts;
  root.dataset.state = 'play';
  root.dataset.dir = dir === 'back' ? 'back' : 'forward';
  // the flip is static for the whole wipe (the track mirrors; the word never does)
  track.style.transform = dir === 'back' ? 'scaleX(-1)' : '';
  wordEl.textContent = word || '';
  band.style.willChange = 'transform';
  wordEl.style.willChange = 'transform, opacity';
  // LINEAR overall timing + PER-SEGMENT easing: a whole-iteration ease would squash the cover into the first
  // few frames and spend the hold on the exit. Cover = snap in (ease-out), hold, clear = whip out (ease-in).
  const timing = { duration: WIPE_MS, easing: 'linear', fill: 'both' };
  // cover fast, HOLD a beat on the word, clear fast — a slap, not a slide
  // the flat fallback band leans (skew); the PAINTED band carries its own lean, so it travels straight
  const sk = parts.painted ? '' : ' skewX(-8deg)';
  const bandAnim = band.animate(
    [
      { transform: `translateX(-118%)${sk}`, easing: EASE_IN_SNAP },
      { transform: `translateX(0)${sk}`, offset: 0.3 },
      { transform: `translateX(0)${sk}`, offset: 0.52, easing: EASE_OUT_WHIP },
      { transform: `translateX(118%)${sk}` },
    ],
    timing,
  );
  const wordAnim = wordEl.animate(
    [
      { opacity: 0, transform: 'scale(0.6) rotate(-8deg)', easing: EASE_POP },
      { opacity: 1, transform: 'scale(1) rotate(-3deg)', offset: 0.3 },
      { opacity: 1, transform: 'scale(1) rotate(-3deg)', offset: 0.56, easing: EASE_OUT_WHIP },
      { opacity: 0, transform: 'scale(1.08) rotate(-3deg)' },
    ],
    timing,
  );
  running = [bandAnim, wordAnim];
  const splat = parts.splat;
  if (word && ready(splat)) {
    splat.style.willChange = 'transform, opacity';
    // the ink SLAPS down under the word as the band lands, then rides the exit out with it
    running.push(
      splat.animate(
        [
          { opacity: 0, transform: 'scale(0.3) rotate(-30deg)' },
          { opacity: 0, transform: 'scale(0.3) rotate(-30deg)', offset: 0.18, easing: EASE_POP },
          { opacity: 1, transform: 'scale(1) rotate(-12deg)', offset: 0.34 },
          { opacity: 1, transform: 'scale(1.03) rotate(-12deg)', offset: 0.56, easing: EASE_OUT_WHIP },
          { opacity: 0, transform: 'scale(1.15) rotate(-12deg)' },
        ],
        timing,
      ),
    );
  }
  if (ready(mascot)) {
    mascot.style.willChange = 'transform';
    // the runner leans into the sweep, lands, then kicks off the far edge (rides the band's leading edge)
    running.push(
      mascot.animate(
        [
          { transform: 'translateY(-50%) rotate(-14deg)', easing: EASE_IN_SNAP },
          { transform: 'translateY(-62%) rotate(4deg)', offset: 0.3 },
          { transform: 'translateY(-50%) rotate(-4deg)', offset: 0.52, easing: EASE_OUT_WHIP },
          { transform: 'translateY(-70%) rotate(14deg)' },
        ],
        timing,
      ),
    );
  }
  bandAnim.onfinish = () => { if (running[0] === bandAnim) stop(); };
  return true;
}

/** Test seam: forget the coalesce clock. */
export function _resetWipeClock() {
  lastAt = -Infinity;
}
