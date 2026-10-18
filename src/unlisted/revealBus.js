// revealBus.js — the one wire between "a discovery fired" (useWordSecrets, which renders nothing) and "the stamp lands
// on the word" (UnlistedStamp, inside the game screen's reaction slot). A module-level emitter so the reveal needs no
// prop threaded through App.jsx (its WebSocket handlers are Tier 1 and stay untouched). The LAST reveal is kept so a
// stamp that mounts a frame late still plays; `take()` consumes it.
const subs = new Set();
let last = null;
let seq = 0;

/** A discovery landed: { gear, word, serial } → every subscriber, with a fresh `key`. */
export function emitReveal(reveal) {
  if (!reveal || !reveal.gear) return null;
  seq += 1;
  last = { ...reveal, key: seq, at: Date.now() };
  for (const fn of subs) {
    try { fn(last); } catch { /* one bad subscriber never blocks another */ }
  }
  return last;
}
/** The serial arrived after the stamp started: patch the live reveal (same key, so nothing replays). */
export function patchRevealSerial(gearId, serial) {
  if (!last || !last.gear || last.gear.id !== gearId) return;
  last = { ...last, serial };
  for (const fn of subs) {
    try { fn(last); } catch { /* ignore */ }
  }
}
export function subscribeReveal(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}
export function peekReveal() {
  return last;
}
export function clearReveal(key) {
  if (last && (key == null || last.key === key)) last = null;
}
