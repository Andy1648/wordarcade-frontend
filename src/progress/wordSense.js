// wordSense.js — WORD SENSE (Job 4): a SECOND permanent upgrade track bought with wins, parallel to
// KEY POWER. Where KEY POWER buys XP-per-letter, WORD SENSE buys the WINS MULTIPLIER PER RARITY TIER
// — so knowing rare words pays more the more you invest. This gives wins a second real sink so
// earning keeps mattering after KEY POWER + themes are maxed.
//
// It scales a word's RARITY EXCESS (mult − 1), so COMMON words (excess 0) are NEVER boosted — the
// reward is strictly for vocabulary. Applied OUTSIDE the ×40 combined-multiplier cap (that cap
// governs the rarity×combo×lucky product; WORD SENSE is a separate upgrade layered on top).
//
// CAP (fix/wordsense-cap): the ORIGINAL curve was ×2.5 PER TIER with NO ceiling and NO max tier —
// an uncapped runaway that, late game, inflated earn ~10⁹×, exhausting MOMENTUM (the never-dry
// sink) in ~2 h and re-breaking mode parity to ~29× (vocab-heavy SAT ran away). A 200-hour full-
// economy sweep (claude/_ws-cap-sweep.mjs) showed a factor CEILING of 1.5 is the tuning that keeps
// momentum ALIVE past 100 h (it never maxes in 200 h) AND holds cross-mode wins/min spread under 2×
// (1.55×, restoring the ~1.54× rebalance target); any ceiling ≥ 1.9 pushes spread past 2×, and a
// tighter ceiling only starts to under-reward SAT. So the factor now climbs a BOUNDED, GENTLE
// ladder: +0.1 per tier from 1.0 (T0) to the 1.5 ceiling at T5, then MAXED. Every tier is a real
// visible step (×1.1 … ×1.5) with no dead-but-buyable tiers; the ×6 KEY-POWER cost ladder is
// reused so 5 tiers is a genuine (but finite) sink. wordSenseWinsFactor's API is unchanged, so the
// four game call-sites need no edit; only the magnitude shrinks to a sane band.
//
// PURE + guarded store (taw.wordsense, an int tier clamped to [0, MAX_TIER]). SURVIVES rebirth (its
// own key, like KEY POWER).
import { keyTierCostAt } from './xp.js';

export const WORDSENSE_KEY = 'taw.wordsense';
export const WORDSENSE_MAX_TIER = 5; // BOUNDED ladder length (was unbounded → runaway)
export const WORDSENSE_MAX_FACTOR = 1.5; // CEILING on the per-rarity factor (from the 200h sweep)
// Per-tier step: a straight climb from 1.0 to the ceiling across MAX_TIER tiers (= +0.1 / tier).
export const WORDSENSE_EFFECT_STEP = (WORDSENSE_MAX_FACTOR - 1) / WORDSENSE_MAX_TIER;

// Read the stored tier, CLAMPED to [0, MAX_TIER] — a stale higher value left by the old uncapped
// version (e.g. a player who bought T18) reads as the max, so their effect is the 1.5 ceiling and
// the shop shows MAXED rather than a nonsense tier.
export function getWordSenseTier() {
  try {
    const raw = localStorage.getItem(WORDSENSE_KEY);
    if (raw == null) return 0;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.min(WORDSENSE_MAX_TIER, Math.floor(n));
  } catch {
    return 0;
  }
}
export function saveWordSenseTier(n) {
  try {
    localStorage.setItem(WORDSENSE_KEY, String(Math.max(0, Math.min(WORDSENSE_MAX_TIER, Math.floor(n)))));
  } catch {
    /* storage blocked */
  }
}

// The multiplier applied to a word's rarity EXCESS at a given tier. T0 = 1 (no boost); climbs +0.1
// per tier to the 1.5 ceiling at T5 (and stays there — the tier is clamped to MAX_TIER).
export function wordSenseFactor(tier) {
  const t = Number.isFinite(tier) && tier > 0 ? Math.min(WORDSENSE_MAX_TIER, Math.floor(tier)) : 0;
  return 1 + WORDSENSE_EFFECT_STEP * t;
}

// The WINS multiplier for a word of rarity multiplier `rarityMult` at the current (or given) tier.
// COMMON (mult 1) → 1 (excess 0, never boosted). A rarer word scales up: 1 + (mult−1)·(factor−1).
// e.g. at T5 (factor 1.5) an OBSCURE word (mult 4) pays 1 + 3·0.5 = ×2.5 on its rarity excess.
export function wordSenseWinsFactor(rarityMult, tier = getWordSenseTier()) {
  const r = Number.isFinite(rarityMult) && rarityMult > 0 ? rarityMult : 1;
  return 1 + Math.max(0, r - 1) * (wordSenseFactor(tier) - 1);
}

// The wins cost to buy the NEXT tier (to REACH tier+1). Reuses the KEY POWER ×6 cost ladder, so the
// two tracks are genuine parallel sinks. Returns Infinity at the MAX tier (nothing left to buy) so
// the shop renders "MAXED" and buyWordSense/canAffordAny refuse — same contract as MOMENTUM.
export function wordSenseCost(tier = getWordSenseTier()) {
  const t = Number.isFinite(tier) && tier >= 0 ? Math.floor(tier) : 0;
  if (t >= WORDSENSE_MAX_TIER) return Infinity;
  return keyTierCostAt(t + 1);
}
