// ghost.js — "race the ghost of your own best run" for the SOLO modes (CHAIN / FUSE). feat/ghost.
//
// The lobby is usually empty; a self-ghost needs no server and no account. During a run we record a
// COMPACT replay of the accepted words on a timeline (word + ms-from-first-word). When a run BEATS the
// stored best, its replay becomes the mode's ghost. A later run then replays that ghost on the same
// timeline so you can see, live, whether you're ahead of or behind your best self.
//
// Storage: `taw.ghost.<mode>` = { s:<score>, d:<durationMs>, e:[[tDs, "word"], …] }. Timestamps are
// DECISECONDS (ms/100) to shave bytes — a ghost race is a pace line, 100ms resolution is plenty. Only
// ACCEPTED words are recorded: a ghost is the trail of your successful words, and only an accept moves
// it forward. All storage access is guarded (a blocked store just disables the feature, never throws).
//
// CAP: we keep exactly ONE ghost per mode (the best run) — the smallest possible footprint. We also
// hard-cap a single replay at MAX_EVENTS words so a pathological run can't bloat the key.

const KEY = (mode) => `taw.ghost.${mode}`;
export const MAX_EVENTS = 400; // a real CHAIN/FUSE run is ~10-40 words; this is a generous safety cap.

function read(mode) {
  try {
    const raw = localStorage.getItem(KEY(mode));
    if (raw == null) return null;
    const o = JSON.parse(raw);
    if (!o || typeof o.s !== 'number' || !Array.isArray(o.e)) return null;
    return o;
  } catch {
    return null;
  }
}
function write(mode, obj) {
  try { localStorage.setItem(KEY(mode), JSON.stringify(obj)); return true; } catch { return false; }
}

// A recorder for ONE run. Pure in-memory until finish(); construct on run start.
export function createGhostRecorder() {
  let t0 = null; // ms timestamp of the first recorded word
  const events = []; // [[tDs, word], …]
  return {
    // Record an accepted word. `nowMs` defaults to performance.now()/Date.now() but is injectable.
    record(word, nowMs = defaultNow()) {
      if (typeof word !== 'string' || !word) return;
      if (events.length >= MAX_EVENTS) return; // cap the replay length
      if (t0 == null) t0 = nowMs;
      const tDs = Math.max(0, Math.round((nowMs - t0) / 100)); // deciseconds from the first word
      events.push([tDs, word.toLowerCase()]);
    },
    count() { return events.length; },
    // Finish the run. If `score` beats the stored ghost's score (or none exists), persist this replay
    // as the mode's new ghost. Returns { saved:boolean, beat:boolean, prevScore:number|null }.
    finish(mode, score, nowMs = defaultNow()) {
      const prev = read(mode);
      const prevScore = prev ? prev.s : null;
      const beat = prevScore == null || score > prevScore;
      if (!beat || events.length === 0) return { saved: false, beat, prevScore };
      const d = t0 == null ? 0 : Math.max(0, Math.round(nowMs - t0));
      const saved = write(mode, { s: score, d, e: events.slice(0, MAX_EVENTS) });
      return { saved, beat, prevScore };
    },
  };
}

function defaultNow() {
  return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
}

// Load the stored ghost for a mode, as a playback-friendly object, or null if none.
//   { score, durationMs, words: [{ t: <ms>, word }], byteSize }
export function loadGhost(mode) {
  const o = read(mode);
  if (!o) return null;
  const words = o.e.map(([tDs, word]) => ({ t: tDs * 100, word }));
  return { score: o.s, durationMs: o.d || 0, words, byteSize: byteSizeOf(mode) };
}

// How many words the ghost has "typed" by elapsed ms — its live pace at a given point in a new run.
export function ghostWordsAt(ghost, elapsedMs) {
  if (!ghost || !ghost.words.length) return 0;
  // words are in ascending t; count those whose timestamp has passed.
  let lo = 0;
  let hi = ghost.words.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (ghost.words[mid].t <= elapsedMs) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

// The ghost's most-recent word at elapsed ms (what it just "typed"), or '' before its first.
export function ghostWordAt(ghost, elapsedMs) {
  const n = ghostWordsAt(ghost, elapsedMs);
  return n > 0 ? ghost.words[n - 1].word : '';
}

// The stored replay's exact byte size (UTF-8) — for the report + a live budget check.
export function byteSizeOf(mode) {
  try {
    const raw = localStorage.getItem(KEY(mode));
    if (raw == null) return 0;
    return typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(raw).length : raw.length;
  } catch {
    return 0;
  }
}

export function clearGhost(mode) {
  try { localStorage.removeItem(KEY(mode)); } catch { /* blocked */ }
}
