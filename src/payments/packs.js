// packs.js — THE GEM PACKS (real money, Andy nov3 "pay-to-win gems", payments-brief.md). PURE, shared by both sides:
//   * api/_lib/pay.js (the Vercel function) reads the PRICE from here. The client never sends an amount: it sends a
//     pack id, and an unknown id is refused. Changing a price is a change to this file (and a deploy), nothing else.
//   * the buy-gems panel (BuyGems.jsx) shows the same table, so the dollar price on a card is the price charged.
// Paid gems are ordinary gems: they land through the one gem door (gemsCore grantGems, reason 'paid') and spend on
// rolls / boosts exactly like earned ones, at the SAME server odds (the server's gem budget counts them — 082).
//
// SAFEGUARDS (kept although the gems are pay-to-win): a dollar price on every pack, a $20 a calendar month cap per
// account (MONTHLY_CAP_CENTS, enforced server-side in 082 pay_reserve — mirrored here only for the panel's text),
// "ask a parent" on the panel, no countdowns or limited offers, roll odds one tap away, a refund contact line.
// ART: the packs wear the existing painted gem piles (the wheel's prize piles + the shop chest) until their own
// art lands — see claude/payments-setup.md "ART REQUEST".

export const PAY_CURRENCY = 'usd';
/** $20.00 a calendar month (America/New_York) per board profile. MIRRORED in 082_paid_gems.sql CAP_CENTS. */
export const MONTHLY_CAP_CENTS = 2000;

// nov4 (Andy "more gems per pack"): ~double the first table, and the bigger the pack the better the value — 302 / 341 / 380 /
// 425 gems a dollar. Against the 75-gem roll: $1.99 = 8 rolls, $19.99 = 113; the $20 monthly cap still bounds a month to
// one HOARD (8,500 gems). The server's roll budget counts net paid gems (082), so the odds never move.
export const PACKS = Object.freeze([
  Object.freeze({ id: 'pouch', name: 'GEM POUCH', gems: 600, cents: 199, art: '/wheel/prize-gems-s.webp' }),
  Object.freeze({ id: 'pile', name: 'GEM PILE', gems: 1700, cents: 499, art: '/wheel/prize-gems-m.webp' }),
  Object.freeze({ id: 'chest', name: 'GEM CHEST', gems: 3800, cents: 999, art: '/wheel/prize-gems-l.webp' }),
  Object.freeze({ id: 'hoard', name: 'GEM HOARD', gems: 8500, cents: 1999, art: '/shop/chest-v2.webp' }),
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
