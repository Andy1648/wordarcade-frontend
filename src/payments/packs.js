// packs.js — THE GEM PACKS (real money, Andy nov3 "pay-to-win gems", payments-brief.md). PURE, shared by both sides:
//   * api/_lib/pay.js (the Vercel function) reads the PRICE from here. The client never sends an amount: it sends a
//     pack id, and an unknown id is refused. Changing a price is a change to this file (and a deploy), nothing else.
//   * the buy-gems panel (BuyGems.jsx) shows the same table, so the dollar price on a card is the price charged.
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
  Object.freeze({ id: 'pouch', name: 'GEM POUCH', gems: 1000, cents: 199, art: '/shop/pay-pouch-v1.webp' }),
  Object.freeze({ id: 'pile', name: 'GEM PILE', gems: 3000, cents: 499, art: '/shop/pay-pile-v1.webp' }),
  Object.freeze({ id: 'chest', name: 'GEM CHEST', gems: 7000, cents: 999, art: '/shop/pay-chest-v1.webp' }),
  Object.freeze({ id: 'hoard', name: 'GEM HOARD', gems: 16000, cents: 1999, art: '/shop/pay-hoard-v1.webp' }),
]);

/** The pack with this id, or null (never a guess: an unknown id is a refused request). */
export function packById(id) {
  if (typeof id !== 'string') return null;
  return PACKS.find((p) => p.id === id) || null;
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
