// luck.js — LUCKY WORDS (Job 4). 1 in 40 ACCEPTED words is a lucky word paying 5× XP and
// 5× wins for that word. SEEDED per run so a run is reproducible in tests; the oracle is
// consulted only AFTER a word is accepted (never telegraphed). PURE (no DOM/React) so the
// rate, the seeding, and the payout weighting are unit-testable.

export const LUCKY_ODDS = 40; // 1 in 40
export const LUCKY_XP_MULT = 5;
export const LUCKY_WINS_MULT = 5;

// mulberry32 — a small, well-distributed seeded PRNG. Inlined here (rather than importing the
// solo copy) so a progress-layer module carries no cross-feature dependency.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A per-run lucky oracle. next() returns true for a lucky word — an independent 1/LUCKY_ODDS
// draw off the seeded stream, taken once per ACCEPTED word. Same seed → identical sequence,
// so a run replays exactly in a test; the draw depends only on the seeded stream position,
// never on game state, so it can't be predicted or gamed from prior words.
export function makeLuckyOracle(seed) {
  const rand = mulberry32((seed >>> 0) || 1);
  return {
    next() {
      return rand() < 1 / LUCKY_ODDS;
    },
  };
}

// The reward weights for a word: lucky → ×5 both; normal → ×1. Pure, so the payout math is
// testable with no wiring. `winsWeight` feeds the round-end wins model (weightedWords);
// `xpMult` scales the per-word XP credit.
export function luckyReward(isLucky) {
  return isLucky
    ? { winsWeight: LUCKY_WINS_MULT, xpMult: LUCKY_XP_MULT, lucky: true }
    : { winsWeight: 1, xpMult: 1, lucky: false };
}

// Draw a fresh 32-bit seed for a LIVE run (tests inject a fixed seed instead). Non-zero.
export function randomSeed() {
  return (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1;
}
