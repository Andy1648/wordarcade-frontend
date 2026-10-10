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
import { overdrivePerkMinutes, freeOverdriveOn, overdriveLengthMult, FREE_OD_SEC, FREE_OD_EVERY_MIN } from './markPerks.js';
import { markOverdriveSec } from './markRollsCore.js';
// SEASON 2 (PROGRESSION FINAL v2): OVERDRIVE is IN the formulas (× OVERDRIVE on XP and wins) — the same rule as
// here, its state under the season's own key (v3/hooks.js S2_KEYS maps taw.overdrive → taw.s2.overdrive).

export const OVERDRIVE_KEY = 'taw.overdrive';
export const OVERDRIVE_MULT = 10;
export const OVERDRIVE_MIN = 5;
export const OVERDRIVE_EVERY_MIN = [30, 60]; // minutes of PLAY between OVERDRIVEs (uniform)
export const PLAY_GAP_CAP_MS = 5000; // one flush gap never counts more than 5 s of play

/** The live OVERDRIVE window in minutes of play: [30, 60], or [15, 15] with the OVERCLOCK perk (KRAKEN, MYTHIC). */
export function overdriveEveryMin() {
  const p = overdrivePerkMinutes();
  return p ? [p, p] : OVERDRIVE_EVERY_MIN;
}

const rollNext = (rng) => {
  const [a, b] = overdriveEveryMin();
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
      freeMs: Number.isFinite(o.freeMs) && o.freeMs >= 0 ? o.freeMs : 0, // FREE OVERDRIVE's own play clock (MYTHIC+)
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
/** How long the next OVERDRIVE runs: (5 min + the worn mark's +N s OVERDRIVE (MARKS v2)) × AFTERBURN (×2 perk). */
export function overdriveLengthMs() {
  let add = 0;
  try {
    add = markOverdriveSec();
  } catch {
    add = 0;
  }
  return (OVERDRIVE_MIN * 60000 + (Number.isFinite(add) && add > 0 ? add * 1000 : 0)) * overdriveLengthMult();
}
export const FREE_OD_EVERY_MS = FREE_OD_EVERY_MIN * 60000;
export const FREE_OD_MS = FREE_OD_SEC * 1000;
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
  const st = read() || { playMs: 0, nextMs: null, until: 0, freeMs: 0 };
  // a trigger rolled before OVERCLOCK was worn is pulled in to the perk's window
  if (st.nextMs == null || st.nextMs > overdriveEveryMin()[1] * 60000) st.nextMs = rollNext(rng);
  // FREE OVERDRIVE (every MYTHIC+ gear, while it is the worn MAIN): its own clock counts every played ms; at 15 min it
  // starts a 60 s ×10 OVERDRIVE as soon as none is running (one waiting at 15 min fires the moment the current ends)
  if (freeOverdriveOn()) {
    st.freeMs = Math.min(FREE_OD_EVERY_MS, (st.freeMs || 0) + add);
    if (st.freeMs >= FREE_OD_EVERY_MS && !(st.until > now)) {
      st.until = now + FREE_OD_MS;
      st.freeMs = 0;
      write(st);
      announceTimers();
      return true;
    }
  }
  if (st.until > now) {
    if (freeOverdriveOn()) write(st);
    return false;
  }
  st.playMs += add;
  if (st.playMs < st.nextMs) {
    write(st);
    return false;
  }
  st.until = now + overdriveLengthMs();
  st.playMs = 0;
  st.nextMs = rollNext(rng);
  write(st);
  announceTimers();
  return true;
}
