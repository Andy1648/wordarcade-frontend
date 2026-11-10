// packOdds.js — THE EXACT ODDS INSIDE A PAID ROLL PACK (089), shown one tap away on each pack card (required for a paid random
// item). PURE, read from the SAME tables the server opens the pack with:
//   * the TIER: rollTickets.ticketTierOdds(floor) = private.pick_ticket_gear — the game's tier odds at luck ×1, the tiers
//     under the floor removed, renormalised (a MYTHIC PACK: MYTHIC 15/17, SECRET 2/17; a SECRET PACK: SECRET 1);
//   * the GEAR inside the tier: evenly among the tier's gears you don't own yet (all of them evenly once you own every one),
//     so for a collection that has none of them each gear is the tier's share ÷ its count — what `items` lists;
//   * SHINY: the flat ticket chance (060 lb_ticket_roll, markRollsCore SHINY_CHANCE);
//   * CHASE HEROES (DRAKE / MAGMA / FACET) never come from a pack: they stay drop-only from gear rolls you pay gems for.
import { ROLL_MARKS, SHINY_CHANCE } from '../progress/markRollsCore.js';
import { ticketTierOdds } from '../progress/rollTickets.js';

const ORDER = ['rare', 'epic', 'legendary', 'mythic', 'secret'];

/** A pack's floor → [{ tier, p, items: [{ id, name, p }] }] (highest tier first; every p sums to 1). */
export function packOdds(floor) {
  const tiers = ticketTierOdds(floor);
  return ORDER.filter((t) => tiers[t] > 0).reverse().map((tier) => {
    const gears = ROLL_MARKS.filter((m) => m.tier === tier);
    return { tier, p: tiers[tier], items: gears.map((m) => ({ id: m.id, name: m.name, p: tiers[tier] / gears.length })) };
  });
}

export const PACK_SHINY = SHINY_CHANCE;

/** 0.88235 → "88.24%", 0.0630 → "6.30%" (two decimals, so the column adds up to 100). */
export const pct = (p) => `${(Math.round(p * 10000) / 100).toFixed(2)}%`;
