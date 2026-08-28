// wordSense.js — WORD SENSE (Job 4): a SECOND permanent upgrade track bought with wins, parallel to
// KEY POWER and using the same tier shape (effect ×2.5 / cost ×6). Where KEY POWER buys XP-per-letter,
// WORD SENSE buys the WINS MULTIPLIER PER RARITY TIER — so knowing rare words pays more the more you
// invest in it. This gives wins a second real sink so earning keeps mattering after KEY POWER +
// themes are maxed (the classic idle-game plateau).
//
// It scales a word's RARITY EXCESS (mult − 1), so COMMON words (excess 0) are NEVER boosted — the
// reward is strictly for vocabulary. Applied OUTSIDE the ×40 combined-multiplier cap (that cap
// governs the rarity×combo×lucky product; WORD SENSE is a separate upgrade layered on top).
//
// PURE + guarded store (taw.wordsense, an int tier). SURVIVES rebirth (its own key, like KEY POWER).
import { keyTierCostAt } from './xp.js';

export const WORDSENSE_KEY = 'taw.wordsense';
export const WORDSENSE_EFFECT_STEP = 2.5; // effect ×2.5 per tier (same shape as KEY POWER)

export function getWordSenseTier() {
  try {
    const raw = localStorage.getItem(WORDSENSE_KEY);
    if (raw == null) return 0;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}
export function saveWordSenseTier(n) {
  try {
    localStorage.setItem(WORDSENSE_KEY, String(Math.max(0, Math.floor(n))));
  } catch {
    /* storage blocked */
  }
}

// The multiplier applied to a word's rarity EXCESS at a given tier. T0 = 1 (no boost); ×2.5/tier.
export function wordSenseFactor(tier) {
  const t = Number.isFinite(tier) && tier > 0 ? Math.floor(tier) : 0;
  return Math.pow(WORDSENSE_EFFECT_STEP, t);
}

// The WINS multiplier for a word of rarity multiplier `rarityMult` at the current (or given) tier.
// COMMON (mult 1) → 1 (excess 0, never boosted). A rarer word scales up: 1 + (mult−1)·(factor−1).
// e.g. at T1 (factor 2.5) an OBSCURE word (mult 4) pays 1 + 3·1.5 = ×5.5 on its rarity.
export function wordSenseWinsFactor(rarityMult, tier = getWordSenseTier()) {
  const r = Number.isFinite(rarityMult) && rarityMult > 0 ? rarityMult : 1;
  return 1 + Math.max(0, r - 1) * (wordSenseFactor(tier) - 1);
}

// The wins cost to buy the NEXT tier (to REACH tier+1). Same ×6 cost ladder as KEY POWER, so the two
// tracks are genuine parallel sinks competing for the same wins.
export function wordSenseCost(tier = getWordSenseTier()) {
  const t = Number.isFinite(tier) && tier >= 0 ? Math.floor(tier) : 0;
  return keyTierCostAt(t + 1);
}
