// recentFrags.js — CROSS-RUN MEMORY for FUSE (Andy nov4: "fuse can feel too repetitive sometimes"): the fragments your
// LAST run served, so the next run's bags skip them while anything else is left (fuse.js createFragmentBag draw(avoid)).
// Within a run the bags already never repeat; this stops a fresh run reopening on the fragments you just played.
// LEAF: localStorage only (blocked storage = no memory, never an error).
export const RECENT_KEY = 'taw.fuse.recent';
export const RECENT_CAP = 60; // a median run serves ~22; a long one's last 60 are plenty to steer the next opening

/** The last run's fragments (a Set; empty when there is none or storage is blocked). */
export function readRecent() {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY));
    return new Set(Array.isArray(v) ? v.filter((f) => typeof f === 'string').slice(-RECENT_CAP) : []);
  } catch {
    return new Set();
  }
}

/** Remember a finished run's served fragments (in serve order; the newest RECENT_CAP kept). */
export function writeRecent(frags) {
  try {
    const list = [...frags].filter((f) => typeof f === 'string').slice(-RECENT_CAP);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    /* blocked storage: the next run simply has no memory */
  }
}
