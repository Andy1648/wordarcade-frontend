// econMigrate.js — one-time save migration to ECONOMY v9 (STEP 19 / Andy A6).
//
// v8 compounded per-word value through ~14 orders of magnitude (claude/progression/before-report.md),
// so a v8 save at L150 can hold a wins balance of 1e12+. Under v9 prices (KEY POWER priced in words,
// additive rebirth) that balance would buy thousands of KEY tiers in one click and flatten the new
// curve on day one. So, ONCE per browser:
//   * KEPT exactly: level, rebirth count, KEY POWER tier count, momentum, cosmetics + themes owned,
//     marks + ranks, mastery, collection, achievements, lifetime wins (a record, never rewritten).
//   * The SPENDABLE wins balance is capped at MIGRATE_WINS_TIERS v9 KEY POWER prices — enough to
//     make real purchases in the new shop, not enough to skip it.
//   * Level progress is re-clamped by readLevelState() itself (into >= need → 0).
// Silent, like the WORD SENSE refund: a rebalance is bookkeeping, and every number on screen is
// simply smaller and saner from here on. Safe to call on every boot (stamped).
import { getWins, saveWins } from './wins.js';
import { getKeyTier, getRebirths, keyTierCostAt } from './xp.js';

export const ECON_VERSION_KEY = 'taw.econ';
export const ECON_VERSION = 9;
export const MIGRATE_WINS_TIERS = 10;

export function migrateEconomyV9() {
  try {
    const v = Number(localStorage.getItem(ECON_VERSION_KEY));
    if (v >= ECON_VERSION) return { migrated: false };
    const tier = getKeyTier();
    const rc = getRebirths();
    let cap = 0;
    for (let i = 1; i <= MIGRATE_WINS_TIERS; i += 1) cap += keyTierCostAt(tier + i, rc);
    const before = getWins();
    const after = Math.min(before, cap);
    if (after !== before) saveWins(after);
    localStorage.setItem(ECON_VERSION_KEY, String(ECON_VERSION));
    return { migrated: true, before, after };
  } catch {
    return { migrated: false }; // storage blocked: nothing persisted to migrate
  }
}
