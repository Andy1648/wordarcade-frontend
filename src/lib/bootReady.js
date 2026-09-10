// bootReady.js (perf/first-load) — the READINESS signals the boot screen's fuse waits on, plus the
// pure fuse-progress curve. Pure JS (no DOM at import) so it is unit-testable under node.
//
// The LoadingScreen used to burn a FIXED 1900 ms fuse. It now finishes when the app is actually
// ready — document.fonts.ready AND the App module has resolved + mounted — bounded by a 700 ms
// floor (so the fuse always reads as a fuse) and the existing 5000 ms hard cap (so it can never
// hang). App is currently part of the main bundle, so appReady resolves on App's first commit; if
// App is ever made a lazy chunk this gate keeps meaning "the chunk arrived and rendered".

export const FLOOR_MS = 700;
export const HARD_CAP_MS = 5000;
export const HANDOFF_MS = 600; // explosion beat before onComplete (unchanged)

let resolveApp;
export const appReady = new Promise((resolve) => {
  resolveApp = resolve;
});
/** Called by App on mount: the App module resolved and committed its first render. */
export function markAppReady() {
  resolveApp();
}

/** document.fonts.ready when available; resolved immediately where the Font Loading API is absent. */
export function fontsReady() {
  try {
    if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) return document.fonts.ready;
  } catch {
    /* fall through */
  }
  return Promise.resolve();
}

/** Resolves once fonts are ready AND the App has mounted. Never rejects. */
export function bootReady() {
  return Promise.all([fontsReady(), appReady]).then(() => undefined, () => undefined);
}

/**
 * The COSMETIC flame position (0..100) for an elapsed boot time, when the actual boot duration is
 * unknown in advance: a brisk burn to 70% across the floor, then a slow creep 70 -> 95% across the
 * remaining window up to the hard cap. The hand-off (driven by bootReady) snaps it to 100 — so a
 * fast boot reads as a quick full burn and a slow one as a long, tense one, never a frozen flame.
 */
export function fuseProgress(elapsedMs, floor = FLOOR_MS, cap = HARD_CAP_MS) {
  const t = Math.max(0, elapsedMs);
  if (t <= floor) return 70 * (t / floor);
  const creep = Math.min(1, (t - floor) / Math.max(1, cap - floor));
  return 70 + 25 * creep;
}
