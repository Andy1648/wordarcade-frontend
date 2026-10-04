// revealPlan.js — PURE timing + hold-to-roll pacing for the MARK ROLL reveal (Andy H3: "the mark roll SPIN,
// Sol's RNG style, rarity-scaled"). No DOM, no React: RollReveal.jsx plays these numbers, RollPanel.jsx
// asks holdStep() whether a held button may roll again. Unit-tested in revealPlan.test.js.
//
// THE REVEAL (oct3 review verdict — the A/B/C protocol is over, one reveal ships):
//   - COMMON: a ~300 ms card flip. RARE: a short wobble build-up, then the flip. EPIC: a longer build-up +
//     its tier plate flash, in the panel.
//   - LEGENDARY / MYTHIC / SECRET (MARKS via ROLLS: "legendary+ full-screen"): the cutscene, a modal layer over
//     the MARKS panel — the tier ladder climbs, the FINAL tier lands huge in its colour, then the mark's NAME and
//     art big, then "1 IN X", then back to the panel. Longer the rarer (2.5 / 2.8 / 3 s).
//   - Reduced motion holds a STATIC frame for the SAME time — and keeps the rarity scaling: a legendary+
//     still shows its plate + name + stamp, just without movement.
//
// HOLD-TO-ROLL repeats while held, but NEVER faster than one roll per finished reveal: the next held roll
// is due HOLD_GAP_MS after the previous reveal ENDS, never on a fixed clock. A hold STOPS on anything
// worth looking at — EPIC+, a NEW mark, a GOLD or RAINBOW step-up — and when the balance can't pay.
// Only LEGENDARY+ is a HEAVY (full-screen) moment, and an EPIC+ result always stops the hold, so two never overlap.

export const MAX_REVEAL_MS = 3000;
export const REVEAL_MS = { common: 300, rare: 700, epic: 1100, legendary: 2500, mythic: 2800, secret: 3000 };
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
    start(now, tier) {
      busyUntil = now + revealMs(tier);
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

/** The short-balance line: "NEED 1,234 MORE WINS". */
export function needMoreText(price, wins, fmt = (n) => String(n)) {
  return `NEED ${fmt(Math.max(1, Math.ceil(price - wins)))} MORE WINS`;
}
