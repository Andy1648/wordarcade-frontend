// crackPlan.js — THE CRACK ROLL's climb (prototype, Andy nov18: "down for crack rolls … need a really satisfying roll
// system"). A gear roll opens like a loot drop: you TAP a GEAR CORE 3 times — each tap cracks it further and MAY jump its
// colour up a tier (sometimes two) — and the 4th tap bursts it open on the gear.
//
// HONEST BY CONSTRUCTION: the outcome is decided first, by the SAME roll as today (markRolls.roll / the server's pick).
// The climb only PRESENTS that outcome: it starts at the floor (RARE), only ever rises, never shows a tier above the
// result, and always ends ON the result. So the odds the ⓘ ODDS chip shows (nextRollRates: the roll's own table) are the
// whole truth — no tap can change what you get. PURE (no DOM) so node:test loads it.

export const CRACK_LADDER = ['rare', 'epic', 'legendary', 'mythic', 'secret'];
export const CRACK_TAPS = 3; // cracking taps; the 4th tap opens
export const crackRank = (t) => Math.max(0, CRACK_LADDER.indexOf(t));

/**
 * The tier the core shows after each cracking tap: an array of CRACK_TAPS tiers, non-decreasing, ending on `result`.
 * Jumps lean LATE (tension builds); a climb of more than one tier per tap is a SKIP (jumps of 2, never more), so a
 * SECRET always climbs at least two taps. `start` is the colour before the first tap.
 */
export function crackPath(result, rng = Math.random, { start = 'rare', taps = CRACK_TAPS } = {}) {
  const from = crackRank(start);
  const to = Math.max(from, crackRank(result));
  let left = to - from;
  const jumps = new Array(taps).fill(0);
  // place each step on a tap, later taps more likely (weights 1, 2, 3 …); a tap holds at most 2
  while (left > 0) {
    const open = jumps.map((j, i) => (j < 2 ? i + 1 : 0));
    const sum = open.reduce((a, b) => a + b, 0);
    if (!sum) break;
    let r = rng() * sum;
    let pick = open.length - 1;
    for (let i = 0; i < open.length; i += 1) { r -= open[i]; if (r < 0 && open[i]) { pick = i; break; } }
    jumps[pick] += 1;
    left -= 1;
  }
  const out = [];
  let k = from;
  for (const j of jumps) { k += j; out.push(CRACK_LADDER[k]); }
  return out;
}

/** The jump each tap makes (0 hold, 1 up, 2 skip) from `start` along `path`. */
export function crackJumps(path, start = 'rare') {
  let prev = crackRank(start);
  return path.map((t) => { const d = crackRank(t) - prev; prev = crackRank(t); return d; });
}
