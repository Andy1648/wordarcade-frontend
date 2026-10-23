// beatSync.js — BEAT SYNC on / off (Andy oct14 "separate reduce motion to reduce motion AND beat sync (which is the cards
// bouncing)"). The music-driven pops (the menu title, cards and rail tiles bouncing on <html data-beat>) are their own
// switch now, independent of REDUCE MOTION. OFF by default (Andy oct22: "set default beat sync to none bc the screen is obv
// lagging") — only a player who switches it ON gets the bounce. useBeatSync reads beatSyncOn() before every flip.
// Storage: localStorage `taw.beatSync` — '1' on, anything else / absent = off. Every touch is guarded.
export const BEAT_SYNC_KEY = 'taw.beatSync';

let cached = null;
const subs = new Set();

/** Is beat sync on? (cached; one localStorage read per page load) */
export function beatSyncOn() {
  if (cached == null) {
    try { cached = globalThis.localStorage?.getItem(BEAT_SYNC_KEY) === '1'; } catch { cached = false; }
  }
  return cached;
}
/** Turn beat sync on / off (persists; turning it off clears a beat that is mid-flash). */
export function setBeatSync(on) {
  cached = !!on;
  try { globalThis.localStorage?.setItem(BEAT_SYNC_KEY, on ? '1' : '0'); } catch { /* blocked storage: this load only */ }
  if (!on) {
    try { globalThis.document?.documentElement?.removeAttribute('data-beat'); } catch { /* no DOM */ }
  }
  for (const cb of [...subs]) { try { cb(cached); } catch { /* never break the toggle */ } }
}
/** Subscribe to changes; returns the unsubscribe. */
export function subscribeBeatSync(cb) {
  subs.add(cb);
  return () => subs.delete(cb);
}
