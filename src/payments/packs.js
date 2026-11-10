// packs.js — THE GEM PACKS (real money, Andy nov3 "pay-to-win gems", payments-brief.md). PURE, shared by both sides:
//   * api/_lib/pay.js (the Vercel function) reads the PRICE from here. The client never sends an amount: it sends a
//     pack id, and an unknown id is refused. Changing a price is a change to this file (and a deploy), nothing else.
//   * the buy-gems panel (BuyGems.jsx) and the shop's PACKS shelf (PaidPacks.jsx) show the same table, so the dollar price
//     on a card is the price charged.
// Paid gems are ordinary gems: they land through the one gem door (gemsCore grantGems, reason 'paid') and spend on
// rolls / boosts exactly like earned ones, at the SAME server odds (the server's gem budget counts them — 082).
//
// SAFEGUARDS (kept although the gems are pay-to-win): a dollar price on every pack, a $20 a calendar month cap per
// account (MONTHLY_CAP_CENTS, enforced server-side in 082 pay_reserve — mirrored here only for the panel's text),
// no countdowns or limited offers, roll odds one tap away, a refund contact line.
// ART (nov5): each pack wears its own painted art, growing sack → heap → chest → vault (public/shop/pay-*-v1.webp). No
// numbers are painted in, so the gem amounts below can change without touching the art.

export const PAY_CURRENCY = 'usd';
/** $20.00 a calendar month (America/New_York) per board profile. MIRRORED in 082_paid_gems.sql CAP_CENTS. */
export const MONTHLY_CAP_CENTS = 2000;

// nov5 (Andy: more gems for the same prices; paid gems must feel worth buying): 503 / 601 / 701 / 800 gems a dollar, so the
// bigger the pack the better the value. Against the 75-gem roll: $1.99 = 13 rolls, $19.99 = 213; the $20 monthly cap still
// bounds a month to one HOARD (16,000 gems). The server's roll budget counts net paid gems (082), so the odds never move.
export const PACKS = Object.freeze([
  Object.freeze({ id: 'pouch', kind: 'gems', name: 'GEM POUCH', gems: 1000, cents: 199, art: '/shop/pay-pouch-v1.webp' }),
  Object.freeze({ id: 'pile', kind: 'gems', name: 'GEM PILE', gems: 3000, cents: 499, art: '/shop/pay-pile-v1.webp' }),
  Object.freeze({ id: 'chest', kind: 'gems', name: 'GEM CHEST', gems: 7000, cents: 999, art: '/shop/pay-chest-v1.webp' }),
  Object.freeze({ id: 'hoard', kind: 'gems', name: 'GEM HOARD', gems: 16000, cents: 1999, art: '/shop/pay-hoard-v1.webp' }),
]);

// ---- ROLL PACKS (Andy nov9: "make a 'packs' in the shop that offer mythic/secret packs for real money") -----------------
// A roll pack is ONE GEAR ROLL WITH A GUARANTEED FLOOR, sold for dollars. What the webhook grants is a SERVER TICKET (060's
// guaranteed-roll mechanism: private.roll_tickets, minted by 089 pay_grant_pack, once per checkout session) — never gems,
// never a roll the browser makes. It opens through 060's lb_ticket_roll / lb_ticket_claim, so the pick is the server's:
// the floor is the ticket ROW's tier, the tier odds are the game's at luck x1 above that floor, and inside the tier a gear
// you don't own yet comes first (private.pick_ticket_gear). Exact odds: packOdds.js (one tap away on the card).
//   tier      the floor: 'mythic' = MYTHIC or better, 'secret' = SECRET (the top tier: it can only be SECRET)
//   debtGems  what a refund / dispute claws when the pack was ALREADY OPENED (089 pay_claw2): the same dollars' worth of
//             gems at the best gem-pack rate (800 / $), taken off the wallet (floored at 0) and kept as a debt on the
//             server's gem budget — exactly how a refund of spent gems works (082). An UNOPENED pack is simply revoked.
// PRICES (claude/089 header, the sim in the PR): a MYTHIC+ by rolling costs ~17,700 gems at a fresh account's x6.6 luck cap
// (~50,000 at luck x1) = $22-35 of gem packs; a SECRET ~149,000 (~439,000) = $187-297. So the packs are clearly better value
// than gems for these tiers, while the $20 monthly cap (shared with gems) bounds a month to four MYTHIC packs or one SECRET
// + one MYTHIC. No first-buy double (088 is GEMS only); no countdowns, no limited offers: always the same price.
// ART: `art` is null until the painted pack lands at `artSlot` (public/ art is immutable-cached: add the file, run
// `node scripts/art-manifest.mjs`, then set art = artSlot). Until then the card draws the tier's existing art.
export const ROLL_PACKS = Object.freeze([
  Object.freeze({ id: 'mythic-pack', kind: 'roll', name: 'MYTHIC PACK', tier: 'mythic', cents: 499, debtGems: 4000, art: null, artSlot: '/shop/pack-mythic-v1.webp' }),
  Object.freeze({ id: 'secret-pack', kind: 'roll', name: 'SECRET PACK', tier: 'secret', cents: 1499, debtGems: 12000, art: null, artSlot: '/shop/pack-secret-v1.webp' }),
]);
/** Every pack the checkout sells (gems + roll packs): pay.js charges from this table and nothing else. */
export const ALL_PACKS = Object.freeze([...PACKS, ...ROLL_PACKS]);
/** Is this a roll pack (a server ticket, not gems)? */
export const isRollPack = (p) => !!p && p.kind === 'roll';

/** The pack with this id, or null (never a guess: an unknown id is a refused request). */
export function packById(id) {
  if (typeof id !== 'string') return null;
  return ALL_PACKS.find((p) => p.id === id) || null;
}

/** 199 -> "$1.99" (whole cents only; anything else reads $0.00). */
export function formatUsd(cents) {
  const c = Number.isFinite(cents) && cents > 0 ? Math.round(cents) : 0;
  return `$${Math.floor(c / 100)}.${String(c % 100).padStart(2, '0')}`;
}

/** What is left of this month's cap, never below 0. */
export function capLeft(spentCents, capCents = MONTHLY_CAP_CENTS) {
  const s = Number.isFinite(spentCents) && spentCents > 0 ? spentCents : 0;
  return Math.max(0, capCents - s);
}

/** Can this pack still be bought this month? */
export function fitsCap(pack, spentCents, capCents = MONTHLY_CAP_CENTS) {
  return !!pack && pack.cents <= capLeft(spentCents, capCents);
}
