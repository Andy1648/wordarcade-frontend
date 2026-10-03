// revealPlan.js — PURE timing + hold-to-roll pacing for the MARK ROLL reveal (Andy H3: "the mark roll SPIN,
// Sol's RNG style, rarity-scaled"). No DOM, no React: RollReveal.jsx plays these numbers, RollPanel.jsx
// asks holdStep() whether a held button may roll again. Unit-tested in revealPlan.test.js.
//
// THE RULES THIS FILE OWNS
//   - Rarity scales the reveal: a COMMON is a ~300 ms card flip, a RARE a short build-up, an EPIC or
//     LEGENDARY a cutscene of at most 2.5 s with a "1 IN X" stamp.
//   - Reduced motion holds a STATIC result card for the SAME time (the rhythm of a hold is unchanged,
//     only the movement goes).
//   - HOLD-TO-ROLL repeats while held, but NEVER faster than one roll per finished reveal: the next
//     held roll is due HOLD_GAP_MS after the previous reveal ENDS, never on a fixed clock.
//   - A hold STOPS on anything worth looking at: EPIC+, a NEW mark, a GOLD or RAINBOW step-up, an
//     "EQUIP?" question, or a balance that cannot pay for the next roll.
//   - Only EPIC+ is a HEAVY moment (the cutscene layer). Two heavy moments can never overlap because
//     a heavy result always stops the hold and a new roll cannot start until the reveal is over.

export const REVEAL_VERSIONS = ['a', 'b', 'c'];
export const DEFAULT_VERSION = 'a';
/** `?mrv=a|b|c` (H1 quality protocol: three reveals on one build). Anything else → 'a'. */
export function revealVersion(search = '') {
  try {
    const v = new URLSearchParams(search).get('mrv');
    return REVEAL_VERSIONS.includes(v) ? v : DEFAULT_VERSION;
  } catch {
    return DEFAULT_VERSION;
  }
}

// Reveal length per tier, per version (ms). Every value ≤ MAX_REVEAL_MS; commons ≈ 300.
export const MAX_REVEAL_MS = 2500;
export const REVEAL_MS = {
  a: { common: 300, rare: 700, epic: 1800, legendary: 2500 }, // FLIP: card flip, Starr-Drop step-up
  b: { common: 320, rare: 900, epic: 2000, legendary: 2500 }, // REEL: Sol's RNG name cycle
  c: { common: 300, rare: 650, epic: 1600, legendary: 2400 }, // STAMP: the bounty-press stamp
};
export const HOLD_GAP_MS = 120; // the beat between a finished reveal and the next held roll
export const HEAVY_TIERS = ['epic', 'legendary'];

export function isHeavy(tier) {
  return HEAVY_TIERS.includes(tier);
}
/** How long a result holds the stage (the same with or without motion). */
export function revealMs(tier, version = DEFAULT_VERSION) {
  const t = REVEAL_MS[version] || REVEAL_MS[DEFAULT_VERSION];
  return Math.min(MAX_REVEAL_MS, t[tier] || t.common);
}

/** Why a hold stops after this result (null = keep rolling). */
export function holdStopReason(result, { canAfford = true } = {}) {
  if (!result) return null;
  if (isHeavy(result.tier)) return 'heavy';
  if (result.newMark) return 'new';
  if (result.goldUp || result.rainbowUp) return 'variant';
  if (result.decision === 'ask') return 'ask';
  if (!canAfford) return 'broke';
  return null;
}

/**
 * The hold PACER. One per ROLL button. It is the only thing that decides when a held button rolls:
 *   start(now, tier, version)  → a roll began; the stage is busy until now + revealMs
 *   canRoll(now)               → a TAP may roll (the previous reveal has finished)
 *   nextHeldAt()               → when a HELD button may roll again (reveal end + HOLD_GAP_MS)
 *   holdStep(now, held, last, ctx) → 'roll' | 'wait' | 'stop'
 */
export function createPacer() {
  let busyUntil = -Infinity;
  return {
    start(now, tier, version) {
      busyUntil = now + revealMs(tier, version);
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
export function minHeldIntervalMs(version = DEFAULT_VERSION) {
  return revealMs('common', version) + HOLD_GAP_MS;
}
