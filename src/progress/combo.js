// combo.js — the in-game WINS COMBO (Job 2). Consecutive accepted words build a
// multiplier that boosts the run's WINS payout; any reject/timeout resets it. This is
// a SKILL track layered on the existing per-word wins rate — no new currency.
//
// PURE (no DOM, no React, no timers) so the +0.1 step, the ×3.0 cap, the reset, and the
// combo-weighted word count are unit-testable under node. The React layer owns the HUD
// readout + the finite break shake; this file owns the numbers.
//
// It plugs into the existing round-end wins model (wins.js): a run accumulates a
// combo-WEIGHTED word count (Σ of each accepted word's multiplier). At round end that
// weighted count is passed to awardWins/recordRound as `weightedWords`, so the payout is
//   perWordRate × Σ(comboMult_i)   instead of   perWordRate × wordCount
// and thus stacks cleanly on top of mode/difficulty/rebirth (all already inside perWordRate).

export const COMBO_STEP = 0.1; // +0.1× per accepted word
export const COMBO_MAX = 3.0; // hard cap (reached after 20 consecutive accepts)

// The live multiplier after `streak` consecutive accepted words: ×1.0 at streak 0,
// climbing +0.1 each accept, capped at ×3.0.
export function comboMultiplier(streak) {
  const s = Number.isFinite(streak) && streak > 0 ? Math.floor(streak) : 0;
  return Math.min(COMBO_MAX, 1 + COMBO_STEP * s);
}

// A fresh run's accumulator. `weighted` is the combo-weighted word count (the payout
// input); `streak` is the current consecutive-accept run; `breaks` counts real resets
// (so the HUD can re-key its finite shake on exactly a real break).
export function freshCombo() {
  return { streak: 0, mult: 1, weighted: 0, breaks: 0 };
}

// Credit one accepted word: the streak grows, the word is worth the NEW multiplier, and
// that multiplier is added to the weighted sum. Returns a NEW state (pure).
export function comboAccept(state) {
  const prev = state || freshCombo();
  const streak = prev.streak + 1;
  const mult = comboMultiplier(streak);
  // Guard the float sum against tiny drift so weighted stays clean for the payout.
  const weighted = Math.round((prev.weighted + mult) * 100) / 100;
  return { streak, mult, weighted, breaks: prev.breaks };
}

// A reject / timeout ends the streak → reset to ×1.0. `breaks` bumps only when there was a
// real streak to lose (streak >= 1), so a break with no active combo never fires the shake.
export function comboBreak(state) {
  const prev = state || freshCombo();
  const hadStreak = prev.streak >= 1;
  return { streak: 0, mult: 1, weighted: prev.weighted, breaks: prev.breaks + (hadStreak ? 1 : 0) };
}
