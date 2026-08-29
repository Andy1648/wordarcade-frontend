// momentum.js — MOMENTUM: the REPEATABLE wins sink (the retention fix for the ~162 h end-game dead
// stretch, see claude/dead-stretch-report.md). Unlike KEY POWER / WORD SENSE (finite ×6 tier ladders
// that eventually run out and leave 100+ h gaps with nothing to buy), MOMENTUM is ONE upgrade you buy
// over and over: the price rises gently (×1.05) from a low base, so the next purchase is always
// minutes-to-hours away and it never runs dry. Each buy grants a small STACKING wins bonus (+1%),
// and — critically — leaves a permanent VISIBLE mark on the menu (see MomentumRail), so 200 buys read
// as 200 marks of evidence, not a hidden 1.05^n number.
//
// PURE + guarded store (taw.momentum, an int count 0..MOMENTUM_MAX). SURVIVES rebirth (its own key,
// like KEY POWER / WORD SENSE). The one dependency is round10 (xp.js) — no import cycle.
import { round10 } from './xp.js';

export const MOMENTUM_KEY = 'taw.momentum';
export const MOMENTUM_BASE = 5000; // wins price of the FIRST buy (count 0 → next)
export const MOMENTUM_RATIO = 1.05; // price ×1.05 per buy — a gentle climb, always something to buy
export const MOMENTUM_MAX = 200; // buys available; 200 × +1% = ×3.0 wins at the top
export const MOMENTUM_PCT = 0.01; // wins bonus per buy (+1%), stacking additively

export function getMomentum() {
  try {
    const raw = localStorage.getItem(MOMENTUM_KEY);
    if (raw == null) return 0;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.min(MOMENTUM_MAX, Math.floor(n));
  } catch {
    return 0;
  }
}
export function saveMomentum(n) {
  try {
    localStorage.setItem(MOMENTUM_KEY, String(Math.max(0, Math.min(MOMENTUM_MAX, Math.floor(n)))));
  } catch {
    /* storage blocked */
  }
}

// The wins cost to buy the NEXT unit, standing at `count` buys. round10(5000 · 1.05^count). At the
// cap it returns Infinity (nothing left to buy) so callers render "MAXED" and never charge.
export function momentumCost(count = getMomentum()) {
  const c = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  if (c >= MOMENTUM_MAX) return Infinity;
  return round10(MOMENTUM_BASE * Math.pow(MOMENTUM_RATIO, c));
}

// The stacking WINS multiplier from `count` buys: 1 + 0.01·count (×1 at 0, ×3 at 200). Applied as a
// global factor on the per-word wins rate (see wins.js perWordWins), so EVERY mode's wins scale.
export function momentumMult(count = getMomentum()) {
  const c = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  return 1 + MOMENTUM_PCT * Math.min(MOMENTUM_MAX, c);
}

// Whether the player is maxed (no further buys).
export function momentumMaxed(count = getMomentum()) {
  return getSafe(count) >= MOMENTUM_MAX;
}
function getSafe(count) {
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

// One-shot "a new mark just landed" flag (same pattern as the wins stamp): buyMomentum sets it, the
// MomentumRail consumes it ONCE on the next menu mount so the newest stud pops only after a purchase
// — never on every idle menu visit (keeps the menu-motion-law: no ambient loops).
let pendingPop = false;
export function markMomentumPop() {
  pendingPop = true;
}
export function consumeMomentumPop() {
  const p = pendingPop;
  pendingPop = false;
  return p;
}
