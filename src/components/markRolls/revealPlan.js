// revealPlan.js — PURE timing + hold-to-roll pacing for the MARK ROLL reveal (Andy H3: "the mark roll SPIN,
// Sol's RNG style, rarity-scaled"). No DOM, no React: RollReveal.jsx plays these numbers, RollPanel.jsx
// asks holdStep() whether a held button may roll again. Unit-tested in revealPlan.test.js.
//
// THE REVEAL (oct3 review verdict — the A/B/C protocol is over, one reveal ships):
//   - COMMON: a ~300 ms card flip. RARE: a short wobble build-up, then the flip. EPIC: a longer build-up +
//     its tier plate flash, in the panel.
//   - SUPERSEDED by Andy oct3 (below): EPIC dims the screen + bursts; LEGENDARY / MYTHIC / SECRET are a 1.5 s
//     full-screen layer over the MARKS panel (rarity colour, particles, "1 IN X" huge), in three feels (?mrv=).
//   - Reduced motion holds a STATIC frame for the SAME time — and keeps the rarity scaling: a legendary+
//     still shows its plate + name + stamp, just without movement.
//
// HOLD-TO-ROLL repeats while held, but NEVER faster than one roll per finished reveal: the next held roll
// is due HOLD_GAP_MS after the previous reveal ENDS, never on a fixed clock. A hold STOPS on anything
// worth looking at — EPIC+, a NEW mark, a GOLD or RAINBOW step-up — and when the balance can't pay.
// Only LEGENDARY+ is a HEAVY (full-screen) moment, and an EPIC+ result always stops the hold, so two never overlap.

// ROLLS REVEAL (Andy oct3, "visuals first"): COMMON = small pop; RARE = colour flash; EPIC = screen dims + burst;
// LEGENDARY / MYTHIC / SECRET = a full-screen 1.5 s reveal (rarity colour, particle burst, "1 IN X" huge).
// Three feels share these numbers (?mrv=a|b|c, revealTimelines.js); tap anywhere skips to the result.
export const MAX_REVEAL_MS = 3000;
export const HEAVY_MS = 1500;
export const REVEAL_MS = { common: 300, rare: 700, epic: 1100, legendary: HEAVY_MS, mythic: HEAVY_MS, secret: HEAVY_MS };
export const TIER_LADDER = ['common', 'rare', 'epic', 'legendary', 'mythic', 'secret'];
/** Andy's per-tier spec, as data: which KIND of reveal a tier gets. */
export const REVEAL_KIND = { common: 'pop', rare: 'flash', epic: 'burst', legendary: 'full', mythic: 'full', secret: 'full' };
export function revealKind(tier) {
  return REVEAL_KIND[tier] || 'pop';
}
const rankOf = (t) => Math.max(0, TIER_LADDER.indexOf(t));

// ---- the reveal VERSION (?mrv=a|b|c) — a = SLAM, b = FLIP + RAYS, c = REEL (pack / case opening) ----
export const REVEAL_VERSIONS = ['a', 'b', 'c'];
export const DEFAULT_REVEAL_VERSION = 'a';
export function revealVersion(search = typeof location !== 'undefined' ? location.search : '') {
  let v = null;
  try { v = new URLSearchParams(search || '').get('mrv'); } catch { v = null; }
  v = String(v || '').toLowerCase();
  return REVEAL_VERSIONS.includes(v) ? v : DEFAULT_REVEAL_VERSION;
}

// ---- ×10 ROLL (Andy: "10 cards flip in fast (80ms stagger); best card gets the full reveal last") ----
export const MULTI_COUNT = 10;
export const MULTI_STAGGER_MS = 80;
export const MULTI_FLIP_MS = 220;
/** ×10 costs exactly ten single rolls. */
export function multiPrice(single) {
  return Math.max(0, Math.round(Number(single) || 0)) * MULTI_COUNT;
}
/** The BEST of a ×10: the rarest tier; a SHINY breaks a tie; then a NEW mark; then the earliest. -1 if empty. */
export function bestIndex(results) {
  let best = -1;
  const score = (r) => rankOf(r.tier) * 4 + (r.shiny ? 2 : 0) + (r.newMark ? 1 : 0);
  (results || []).forEach((r, i) => {
    if (!r) return;
    if (best < 0 || score(r) > score(results[best])) best = i;
  });
  return best;
}
/**
 * The ×10 plan: every other card flips in grid order, 80 ms apart; the BEST card stays face down and gets
 * its tier's full reveal LAST, starting once the last flip has landed.
 *   → { best, flips: [{ idx, at }], bestAt, D }  (D = the whole ×10 reveal, ms)
 */
export function multiPlan(results) {
  const list = results || [];
  const best = bestIndex(list);
  const flips = [];
  list.forEach((r, i) => {
    if (i === best) return;
    flips.push({ idx: i, at: flips.length * MULTI_STAGGER_MS });
  });
  const bestAt = flips.length ? flips[flips.length - 1].at + MULTI_FLIP_MS : 0;
  const tier = best >= 0 ? list[best].tier : 'common';
  return { best, flips, bestAt, D: bestAt + revealMs(tier) };
}
export const HOLD_GAP_MS = 120; // the beat between a finished reveal and the next held roll
export const HEAVY_TIERS = ['legendary', 'mythic', 'secret'];
const STOP_TIERS = ['epic', ...HEAVY_TIERS];

export function isHeavy(tier) {
  return HEAVY_TIERS.includes(tier);
}
/** How long a result holds the stage (the same with or without motion). */
export function revealMs(tier) {
  return Math.min(MAX_REVEAL_MS, REVEAL_MS[tier] || REVEAL_MS.common);
}

/** Why a hold stops after this result (null = keep rolling). */
export function holdStopReason(result, { canAfford = true } = {}) {
  if (!result) return null;
  if (STOP_TIERS.includes(result.tier)) return 'heavy';
  if (result.newMark) return 'new';
  if (result.goldUp || result.rainbowUp) return 'variant';
  if (!canAfford) return 'broke';
  return null;
}

/**
 * The hold PACER. One per ROLL button. It is the only thing that decides when a held button rolls:
 *   start(now, tier)  → a roll began; the stage is busy until now + revealMs
 *   canRoll(now)      → a TAP may roll (the previous reveal has finished)
 *   nextHeldAt()      → when a HELD button may roll again (reveal end + HOLD_GAP_MS)
 *   holdStep(now, held, last, ctx) → 'roll' | 'wait' | 'stop'
 */
export function createPacer() {
  let busyUntil = -Infinity;
  return {
    /** `ms` overrides the tier window (a ×10 runs multiPlan().D). */
    start(now, tier, ms) {
      busyUntil = now + (Number.isFinite(ms) ? ms : revealMs(tier));
      return busyUntil;
    },
    /** A tap mid-reveal SKIPS to the result instead of rolling (input still answers at once). */
    finishNow(now) {
      busyUntil = Math.min(busyUntil, now);
    },
    busy(now) {
      return now < busyUntil;
    },
    canRoll(now) {
      return now >= busyUntil;
    },
    nextHeldAt() {
      return busyUntil + HOLD_GAP_MS;
    },
    holdStep(now, held, last, ctx = {}) {
      if (!held) return 'stop';
      if (holdStopReason(last, ctx)) return 'stop';
      return now >= busyUntil + HOLD_GAP_MS ? 'roll' : 'wait';
    },
  };
}

/** Fastest possible held rhythm for a run of commons (the test pins it to the reveal, never under). */
export function minHeldIntervalMs() {
  return revealMs('common') + HOLD_GAP_MS;
}

/** The short-balance line: "NEED 4 MORE GEMS" (GEMS buy rolls — Andy oct5). */
export function needMoreText(price, have, fmt = (n) => String(n)) {
  return `NEED ${fmt(Math.max(1, Math.ceil(price - have)))} MORE GEMS`;
}
