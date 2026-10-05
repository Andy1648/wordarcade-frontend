// boost.js — BOOST (R10, Andy oct2): a redeem code of kind 'boost' starts a wall-clock timer that
// multiplies EVERY mode's wins/XP by its ×N (default ×3 for 10 min). It is a named factor of the one
// payout stack (wins.js perWordFactors → `boost`), so the receipt, the HUD rate and the bank all read
// the same ×N, and it stacks MULTIPLICATIVELY with FUSE FRENZY.
//
// Persisted as { until, mult } (taw.boost) so it survives reloads and runs. A second boost while one
// is live EXTENDS it (adds its minutes) at the higher of the two multipliers — a code is never wasted.
// PURE + guarded store, like every other progress module: blocked storage → no boost, never throws.

import { overdriveMult } from './overdrive.js';
// PROGRESSION v3 (SEASON2, default OFF): the R3 unlock "2nd boost slot" — a boost that starts while one is live
// runs in its OWN slot (taw.s2.boost2) at the same time instead of extending the first, and the two multiply.
// MINIMAL MODEL (phase 3): one extra slot; the HUD pill for it is the visual PR's. OFF = one slot, as before.
import { SEASON2, S2_PREFIX } from './season.js';
import { featureOpen } from './v3/unlocks.js';
export const BOOST2_KEY = `${S2_PREFIX}boost2`;

export const BOOST_KEY = 'taw.boost';
export const BOOST_DEFAULT_MULT = 3;
export const BOOST_DEFAULT_MIN = 10;

function read(key = BOOST_KEY) {
  try {
    const o = JSON.parse(localStorage.getItem(key) || 'null');
    if (!o) return null;
    const until = Number(o.until);
    const mult = Number(o.mult);
    if (!Number.isFinite(until) || until <= 0 || !Number.isFinite(mult) || mult <= 1) return null;
    return { until, mult };
  } catch {
    return null;
  }
}

// Fired when a BOOST or FRENZY starts, so every live clock (pills, the OVER moment) re-arms at once.
export const TIMERS_EVENT = 'taw:timers';
export function announceTimers() {
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof Event === 'function') window.dispatchEvent(new Event(TIMERS_EVENT));
  } catch {
    /* no window (tests) */
  }
}

/** ms of BOOST left at `now` (0 when none). */
export function boostRemaining(now = Date.now()) {
  const b = read();
  return b ? Math.max(0, b.until - now) : 0;
}

export function isBoostActive(now = Date.now()) {
  return boostRemaining(now) > 0;
}

/** The redeem-code boost alone: ×N while active, else 1. */
export function codeBoostMult(now = Date.now()) {
  const b = read();
  const m1 = b && b.until > now ? b.mult : 1;
  if (!SEASON2) return m1;
  const b2 = read(BOOST2_KEY); // v3: the 2nd slot multiplies (only ever filled once R3 opened it)
  return m1 * (b2 && b2.until > now ? b2.mult : 1);
}
/** The BOOST factor right now, for every mode: the redeem-code boost × OVERDRIVE (overdrive.js, ×10 for 5 min). */
export function boostMult(now = Date.now()) {
  return codeBoostMult(now) * overdriveMult(now);
}

/** Start (or extend) a BOOST. Returns { mult, remaining }. */
export function startBoost(mult = BOOST_DEFAULT_MULT, minutes = BOOST_DEFAULT_MIN, now = Date.now()) {
  const m = Number.isFinite(Number(mult)) && Number(mult) > 1 ? Math.floor(Number(mult)) : BOOST_DEFAULT_MULT;
  const min = Number.isFinite(Number(minutes)) && Number(minutes) > 0 ? Number(minutes) : BOOST_DEFAULT_MIN;
  const cur = read();
  const live = cur && cur.until > now;
  if (SEASON2 && live && featureOpen('boost2')) {
    // v3: slot 1 is busy → the 2nd slot (extended like slot 1 if it is live too)
    const c2 = read(BOOST2_KEY);
    const live2 = c2 && c2.until > now;
    const next2 = { until: (live2 ? c2.until : now) + min * 60000, mult: live2 ? Math.max(c2.mult, m) : m };
    try {
      localStorage.setItem(BOOST2_KEY, JSON.stringify(next2));
    } catch {
      /* blocked */
    }
    announceTimers();
    return { mult: next2.mult, remaining: next2.until - now, slot: 2 };
  }
  const until = (live ? cur.until : now) + min * 60000;
  const next = { until, mult: live ? Math.max(cur.mult, m) : m };
  try {
    localStorage.setItem(BOOST_KEY, JSON.stringify(next));
  } catch {
    /* blocked — no boost */
  }
  announceTimers();
  return { mult: next.mult, remaining: until - now };
}
