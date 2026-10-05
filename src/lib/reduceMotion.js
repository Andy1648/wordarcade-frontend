// src/lib/reduceMotion.js — THE one source of truth for "reduce motion".
//
// WHY THIS EXISTS: school Chromebooks are managed devices that report
// `prefers-reduced-motion: reduce` by policy, so honouring the OS media query switched off nearly
// every animation for exactly the players who never asked for it. The app no longer reads the OS
// setting AT ALL. Reduce motion is an in-game toggle (the 🔊 settings panel), OFF by default.
//
//   - JS: every motion check calls reduceMotion() (juice/settings.js reduced() included).
//   - CSS: the build rewrites every `@media (prefers-reduced-motion: reduce)` block into rules scoped
//     to `:root[data-reduce-motion]` (postcss/reduceMotionScope.js), and this module owns that
//     attribute. index.html sets it before first paint; main.jsx calls initReduceMotion() as a fallback.
//
// Storage: localStorage `taw.reduceMotion` — '1' on, '0' explicitly off, absent = default (off).
// Pure-ish: importing installs nothing; every DOM/storage touch is wrapped (node tests, blocked storage).

export const REDUCE_MOTION_KEY = 'taw.reduceMotion';

let cached = null; // null = not read yet
const subs = new Set();

function readStored() {
  try {
    return globalThis.localStorage?.getItem(REDUCE_MOTION_KEY) === '1';
  } catch {
    return false;
  }
}

function applyAttr(on) {
  try {
    const de = globalThis.document?.documentElement;
    if (!de) return;
    if (on) de.dataset.reduceMotion = '1';
    else delete de.dataset.reduceMotion;
  } catch {
    /* no DOM */
  }
}

function update(on) {
  const prev = reduceMotion();
  cached = on;
  applyAttr(on);
  if (prev === on) return;
  for (const cb of [...subs]) {
    try {
      cb(on);
    } catch {
      /* a subscriber must never break the toggle */
    }
  }
}

/** Is reduce motion ON? Cached boolean; never consults the OS media query. */
export function reduceMotion() {
  if (cached === null) cached = readStored();
  return cached;
}

/** Turn reduce motion on/off. Persists, flips the <html> attribute and notifies subscribers — live. */
export function setReduceMotion(on) {
  const v = !!on;
  try {
    globalThis.localStorage?.setItem(REDUCE_MOTION_KEY, v ? '1' : '0');
  } catch {
    /* storage blocked — still applies for this session */
  }
  update(v);
}

/** Subscribe to changes. Returns the unsubscribe function. */
export function onReduceMotionChange(cb) {
  subs.add(cb);
  return () => {
    subs.delete(cb);
  };
}

let inited = false;
/** Boot: re-assert the attribute (the index.html inline script is the first-paint path) and follow
 *  changes made in another tab (the `storage` event never fires in the tab that wrote it). */
export function initReduceMotion() {
  applyAttr(reduceMotion());
  if (inited) return;
  inited = true;
  try {
    window.addEventListener('storage', (e) => {
      if (e.key === REDUCE_MOTION_KEY || e.key === null) update(readStored());
    });
  } catch {
    /* no window */
  }
}
