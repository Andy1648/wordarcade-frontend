// rollTickets.js — GUARANTEED ROLLS (Andy oct22; migration 060_guaranteed_rolls.sql). PURE helpers for the tickets
// the SERVER mints and owns: RARE+ / EPIC+ / LEGENDARY+ / MYTHIC+. Nothing here grants, stores or trusts a ticket —
// the only tickets the game ever shows are the ones lb_tickets just returned (normalizeTickets drops anything else).
//
//   normalizeTickets(reply)  the server's list, validated (unknown tiers / states / ids are dropped)
//   bestTicket(list)         the ticket the ROLL screen offers first (highest floor, a reserved one before all)
//   ticketTable(floor)       the odds a ticket rolls with (= private.pick_ticket_gear: the game's tier odds at luck ×1,
//                            tiers below the floor removed) — the reel strip is drawn from exactly these
import { ROLL_MARKS, tierRank } from './markRollsCore.js';

export const TICKET_TIERS = ['rare', 'epic', 'legendary', 'mythic'];
/**
 * 065 SEALED ROLLS in the SHOP — the server's price table (065_buy_tier_rolls.sql private.ticket_shop), mirrored so the
 * card can show the price. The SERVER decides the price, the stock and the floor; this copy only draws the card
 * (guaranteedRolls.test.js pins the two together). Priced by claude/econ-oct2/tier-roll-price-sim.mjs: ~1.6–1.7× what
 * rolling for that tier costs at luck ×1 (EPIC+ ~90, LEGENDARY+ ~465 gems).
 */
export const TICKET_SHOP = Object.freeze({
  epic: Object.freeze({ price: 150, perHour: 2 }),
  legendary: Object.freeze({ price: 750, perHour: 1 }),
});
const STATES = ['owned', 'reserved'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MARK_IDS = new Set(ROLL_MARKS.map((m) => m.id));

/** "LEGENDARY+" */
export const ticketLabel = (tier) => `${String(tier || '').toUpperCase()}+`;

function pickOf(p) {
  if (!p || typeof p !== 'object' || !MARK_IDS.has(p.mark)) return null;
  const m = ROLL_MARKS.find((x) => x.id === p.mark);
  return { mark: m.id, tier: m.tier, shiny: p.shiny === true };
}

/** The server's ticket list → [{ id, tier, state, source, pick }], only well-formed rows. */
export function normalizeTickets(reply) {
  const rows = reply && reply.ok && Array.isArray(reply.tickets) ? reply.tickets : [];
  const out = [];
  for (const t of rows) {
    if (!t || !UUID.test(String(t.id)) || !TICKET_TIERS.includes(t.tier) || !STATES.includes(t.state)) continue;
    const pick = t.state === 'reserved' ? pickOf(t.pick) : null;
    if (t.state === 'reserved' && !pick) continue;
    if (pick && tierRank(pick.tier) < tierRank(t.tier)) continue; // never shown below its floor
    out.push({ id: String(t.id), tier: t.tier, state: t.state, source: typeof t.source === 'string' ? t.source : '', pick });
  }
  return out;
}

/**
 * 065: what a lb_ticket_buy reply means for the (already paid) wallet → { kind: 'ok', ticket, left } | { kind: 'refund',
 * reason } (a definite no: the gems go back) | { kind: 'retry' } (no usable answer: keep the paid request, ask again).
 * An ok reply is only trusted with a well-formed id and a tier the shop sells.
 */
export function buyOutcome(reply) {
  if (!reply || typeof reply !== 'object') return { kind: 'retry' };
  if (reply.ok === true) {
    const t = reply.ticket;
    if (!t || !UUID.test(String(t.id)) || !TICKET_SHOP[t.tier]) return { kind: 'retry' };
    const left = Number.isFinite(reply.left) ? Math.max(0, Math.floor(reply.left)) : null;
    return { kind: 'ok', ticket: { id: String(t.id), tier: t.tier, state: 'owned', source: 'shop', pick: null }, left };
  }
  if (reply.ok === false && typeof reply.reason === 'string') return { kind: 'refund', reason: reply.reason };
  return { kind: 'retry' };
}

/** The ticket to offer: a RESERVED one first (an interrupted reveal finishes before anything else), then the highest floor. */
export function bestTicket(list) {
  if (!Array.isArray(list) || !list.length) return null;
  const res = list.find((t) => t.state === 'reserved');
  if (res) return res;
  return list.reduce((b, t) => (tierRank(t.tier) > tierRank(b.tier) ? t : b), list[0]);
}

/** How many tickets share `tier`. */
export function countOf(list, tier) {
  return Array.isArray(list) ? list.filter((t) => t.tier === tier).length : 0;
}

/** A spend reply → the pick (validated against the floor), or null. */
export function spendPick(reply, floor) {
  if (!reply || !reply.ok) return null;
  const p = pickOf(reply.pick);
  if (!p || tierRank(p.tier) < tierRank(floor)) return null;
  return p;
}

/**
 * The odds a `floor` ticket rolls with — private.pick_ticket_gear: luck ×1, every non-RARE gear 1/x, RARE the
 * remainder (only on a RARE+ ticket), tiers under the floor removed, renormalised. → Map id → p (sums to 1).
 * (The server then prefers a gear you don't own inside the drawn tier; the TIER odds are these.)
 */
export function ticketTable(floor) {
  const fr = tierRank(floor);
  const s = ROLL_MARKS.filter((m) => m.tier !== 'rare').reduce((a, m) => a + 1 / m.x, 0);
  const rares = ROLL_MARKS.filter((m) => m.tier === 'rare');
  const rareSum = rares.reduce((a, m) => a + 1 / m.x, 0);
  const w = new Map();
  for (const m of ROLL_MARKS) {
    if (tierRank(m.tier) < fr) { w.set(m.id, 0); continue; }
    w.set(m.id, m.tier === 'rare' ? (Math.max(0, 1 - s) * (1 / m.x)) / rareSum : 1 / m.x);
  }
  let tot = 0;
  for (const v of w.values()) tot += v;
  const probs = new Map();
  for (const [id, v] of w) probs.set(id, tot > 0 ? v / tot : 0);
  return probs;
}

/** Each tier's chance on a `floor` ticket: { legendary: 0.947, mythic: 0.047, secret: 0.006 }. */
export function ticketTierOdds(floor) {
  const probs = ticketTable(floor);
  const out = {};
  for (const m of ROLL_MARKS) {
    const p = probs.get(m.id);
    if (p > 0) out[m.tier] = (out[m.tier] || 0) + p;
  }
  return out;
}
