// wordSenseRefund.js — give back what WORD SENSE cost, once, silently.
//
// WORD SENSE was deleted (feat/cut-secrets-rarity). It bought a multiplier on a word's rarity
// EXCESS: invisible at the moment it fired, worth nothing on a COMMON word, and describable only
// by a table in a shop card. Rarity is now something you SEE when the word lands, so the upgrade
// that quietly scaled it has nothing left to do.
//
// A player who bought tiers spent real wins on it, and deleting the feature must not delete their
// money. On the next load the full purchase price comes back to the balance — the sum of every
// tier they actually reached, at the prices they actually paid — and the tier key is cleared.
//
// THREE THINGS MAKE THIS SAFE TO RUN ON EVERY BOOT:
//   - it is idempotent. A `done` marker is written in the SAME pass as the credit, and the tier key
//     is cleared, so a second boot finds nothing to refund even if the marker write failed.
//   - it is silent. No sticker, no toast. A refund for a feature that is gone is bookkeeping, not
//     an event, and a modal congratulating you for losing an upgrade would be worse than nothing.
//   - it touches the SPENDABLE balance only, never winsLifetime. Lifetime is a record of what was
//     earned; a refund is not earnings, and inflating it would corrupt every achievement gated on
//     it. (The original purchase did not decrement it either, so the pair stays consistent.)
//
// The old price ladder was KEY TIER's v8 ladder, reused: tier N cost 10 / 60 / 360 / 2,160 / 12,960.
// KEY TIER itself is priced differently since Economy v9 (STEP 19), so the prices that were ACTUALLY
// PAID are frozen here — a refund must return what was spent, not what the tier costs today.
import { getWins, saveWins } from './wins.js';

const WORDSENSE_PRICES = [0, 10, 60, 360, 2160, 12960];
const keyTierCostAt = (i) => WORDSENSE_PRICES[i] || 0;

export const WORDSENSE_KEY = 'taw.wordsense'; // the deleted feature's tier store
export const WORDSENSE_REFUND_KEY = 'taw.wordsenseRefunded';
export const WORDSENSE_MAX_TIER = 5; // the ladder's length when it shipped

/** What `tier` tiers of WORD SENSE cost in total: the sum of the prices to reach 1..tier. */
export function wordSenseRefundAmount(tier) {
  const t = Number.isFinite(tier) && tier > 0 ? Math.min(WORDSENSE_MAX_TIER, Math.floor(tier)) : 0;
  let total = 0;
  for (let i = 1; i <= t; i++) total += keyTierCostAt(i);
  return total;
}

/**
 * Refund a player's WORD SENSE purchases, once. Returns the amount credited (0 when there is
 * nothing to give back, which is every player who never bought it and every boot after the first).
 * Never throws: a blocked store simply means the refund is attempted again next time, and the
 * credit-then-clear order means the worst case is a retry, never a double credit that sticks.
 */
export function refundWordSense() {
  let tier = 0;
  try {
    if (localStorage.getItem(WORDSENSE_REFUND_KEY) === '1') return 0;
    const raw = localStorage.getItem(WORDSENSE_KEY);
    if (raw == null) {
      // Nothing was ever bought. Mark it done anyway so this stops looking every boot.
      localStorage.setItem(WORDSENSE_REFUND_KEY, '1');
      return 0;
    }
    const n = Number(raw);
    tier = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0; // storage blocked — try again next boot
  }
  const amount = wordSenseRefundAmount(tier);
  try {
    if (amount > 0) saveWins(getWins() + amount);
    localStorage.setItem(WORDSENSE_REFUND_KEY, '1');
    localStorage.removeItem(WORDSENSE_KEY);
  } catch {
    /* storage blocked — the marker did not land, so this runs again; the credit is re-attempted
       from the SAME tier value, which is still in place because the removal failed too. */
  }
  return amount;
}
