// overdrive.js — OVERDRIVE (PROGRESSION FINAL "Rebirth Rush", Andy oct3 20:08): a random ×10 on XP AND wins
// for 5 minutes, about every 30–60 minutes of PLAY. It is a BOOST source (boost.js boostMult multiplies it in),
// so every readout that already names BOOST — the receipt, the HUD rate, XP per letter — shows it with no
// second code path.
//
// "Minutes of play" = time spent typing: notePlay(ms) is fed by the letter flush (letterXp.js) with the gap since
// the previous flush, each gap capped at PLAY_GAP_CAP_MS, so an idle tab never counts. When the played total
// reaches the next trigger (rolled uniformly in 30–60 min), OVERDRIVE starts for 5 wall-clock minutes and the
// next trigger is rolled from zero. Persisted at taw.overdrive { playMs, nextMs, until }. PURE + guarded store:
// blocked storage → no OVERDRIVE, never throws.
import { announceTimers } from './boost.js';

export const OVERDRIVE_KEY = 'taw.overdrive';
export const OVERDRIVE_MULT = 10;
export const OVERDRIVE_MIN = 5;
export const OVERDRIVE_EVERY_MIN = [30, 60]; // minutes of PLAY between OVERDRIVEs (uniform)
export const PLAY_GAP_CAP_MS = 5000; // one flush gap never counts more than 5 s of play

const rollNext = (rng) => {
  const [a, b] = OVERDRIVE_EVERY_MIN;
  const r = typeof rng === 'function' ? rng() : Math.random();
  return (a + (b - a) * Math.min(1, Math.max(0, r))) * 60000;
};

function read() {
  try {
    const o = JSON.parse(localStorage.getItem(OVERDRIVE_KEY) || 'null');
    if (!o || typeof o !== 'object') return null;
    return {
      playMs: Number.isFinite(o.playMs) && o.playMs >= 0 ? o.playMs : 0,
      nextMs: Number.isFinite(o.nextMs) && o.nextMs > 0 ? o.nextMs : null,
      until: Number.isFinite(o.until) && o.until > 0 ? o.until : 0,
    };
  } catch {
    return null;
  }
}
function write(st) {
  try {
    localStorage.setItem(OVERDRIVE_KEY, JSON.stringify(st));
  } catch {
    /* blocked */
  }
}

/** ms of OVERDRIVE left at `now` (0 when none). */
export function overdriveRemaining(now = Date.now()) {
  const st = read();
  return st ? Math.max(0, st.until - now) : 0;
}
export function isOverdriveActive(now = Date.now()) {
  return overdriveRemaining(now) > 0;
}
/** ×10 while OVERDRIVE runs, else 1. */
export function overdriveMult(now = Date.now()) {
  return isOverdriveActive(now) ? OVERDRIVE_MULT : 1;
}

/**
 * Count `ms` of typing toward the next OVERDRIVE. Returns true when this call STARTED one. Play during an
 * OVERDRIVE does not count toward the next (the clock restarts when it starts). `rng` is injectable (sim/tests).
 */
export function notePlay(ms, now = Date.now(), rng) {
  const add = Number.isFinite(ms) && ms > 0 ? Math.min(ms, PLAY_GAP_CAP_MS) : 0;
  if (!add) return false;
  const st = read() || { playMs: 0, nextMs: null, until: 0 };
  if (st.nextMs == null) st.nextMs = rollNext(rng);
  if (st.until > now) return false;
  st.playMs += add;
  if (st.playMs < st.nextMs) {
    write(st);
    return false;
  }
  st.until = now + OVERDRIVE_MIN * 60000;
  st.playMs = 0;
  st.nextMs = rollNext(rng);
  write(st);
  announceTimers();
  return true;
}
