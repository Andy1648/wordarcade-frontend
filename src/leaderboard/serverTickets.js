// serverTickets.js — GUARANTEED ROLLS, the server half (migration 060_guaranteed_rolls.sql). Tickets live ONLY on the
// server: this module never stores one, so the ROLL screen can only show what lb_tickets just returned.
//
//   listTickets()        lb_tickets → [{ id, tier, state, pick }] (validated) — [] when off / offline / pre-060
//   rollTicket(t)        lb_ticket_roll → the reserved pick (asking again returns the SAME one — no re-rolls)
//   claimTicket(id)      lb_ticket_claim on the reveal's landing (a failure is kept and retried on the next list)
//   streakCheckin(day)   lb_streak_checkin — the STREAK CALENDAR's server-checked step (DAY 4 / DAY 7 mint tickets)
//   buyTicket(tier)      065 lb_ticket_buy — the SHOP's sealed EPIC+ / LEGENDARY+ ROLL (gems → a server ticket)
// The floor tier is never sent: the server reads it from its own ticket row.
import { getSecret, rpc } from './client.js';
import { serverRollOn } from './serverRoll.js';
import { normalizeTickets, spendPick, TICKET_SHOP, buyOutcome } from '../progress/rollTickets.js';
import { loadGemState, saveGemState, tellBalance } from '../progress/gemsCore.js';

const BUY_KEY = 'taw.s2.ticketbuy'; // 065: a PAID buy whose answer is not in yet — { req, tier, price } (retried, never re-charged)
const LANDED_KEY = 'taw.s2.ticketland'; // a ticket whose reveal LANDED in this save but whose claim is unanswered
let off = false; // lb_tickets is not there (pre-060): stop asking this page load

const missing = (e) => /lb_ticket|lb_streak|PGRST202|http_404|Could not find the function/i.test(String((e && e.code) || (e && e.message) || ''));

function readLanded() {
  try { return localStorage.getItem(LANDED_KEY) || ''; } catch { return ''; }
}
function writeLanded(id) {
  try { if (id) localStorage.setItem(LANDED_KEY, id); else localStorage.removeItem(LANDED_KEY); } catch { /* blocked */ }
}

/** Can this player use tickets right now? (a named season-2 player, online, 060 present) */
export function ticketsOn() {
  return !off && serverRollOn();
}

/** The reveal of ticket `id` landed in this save: remember it until the claim is answered. */
export function noteLanded(id) {
  writeLanded(id);
}

/** Commit a landed ticket roll. Resolves true when the server has it spent. */
export async function claimTicket(id) {
  if (!id) return false;
  writeLanded(id);
  try {
    const r = await rpc('lb_ticket_claim', { p_secret: getSecret(), p_ticket: id });
    if (r && (r.ok || r.reason === 'no_ticket')) { writeLanded(''); return !!r.ok; }
  } catch { /* offline: retried on the next list */ }
  return false;
}

/**
 * My unspent tickets. A ticket this save already LANDED (its claim got lost) is claimed first and left out; a reserved
 * one that never landed comes back with its pick, so the screen replays the SAME gear.
 */
export async function listTickets() {
  if (!ticketsOn()) return [];
  try {
    const landed = readLanded();
    if (landed) await claimTicket(landed);
    if (readBuy()) await settleBuy(); // a paid buy whose answer got lost: asked again with the SAME request id
    const r = await rpc('lb_tickets', { p_secret: getSecret() });
    const list = normalizeTickets(r);
    const still = readLanded();
    return still ? list.filter((t) => t.id !== still) : list;
  } catch (e) {
    if (missing(e)) off = true;
    return [];
  }
}

/** Reserve ticket `t`'s pick. Resolves { mark, tier, shiny } (at or above t.tier) or null. */
export async function rollTicket(t) {
  if (!t || !t.id || !ticketsOn()) return null;
  try {
    const r = await rpc('lb_ticket_roll', { p_secret: getSecret(), p_ticket: t.id });
    return spendPick(r, t.tier);
  } catch (e) {
    if (missing(e)) off = true;
    return null;
  }
}

/** The STREAK CALENDAR's server step for local day `day` (streak.js localDayIndex). Resolves the server's reply or null. */
export async function streakCheckin(day) {
  if (!ticketsOn() || !Number.isInteger(day)) return null;
  try {
    return await rpc('lb_streak_checkin', { p_secret: getSecret(), p_day: day });
  } catch (e) {
    if (missing(e)) off = true;
    return null;
  }
}

// ---- 065 SEALED ROLLS: the SHOP buy ------------------------------------------------------------------------------------
// The gem WALLET lives in the browser; the SERVER owns the ticket, the price, the stock and the floor (and caps the spend
// at the account's gem budget). So: pay locally FIRST, remember the paid request, ask the server with that request id
// (idempotent — a retry returns the SAME ticket and never charges the budget twice), then: ok → done; a definite no →
// the gems go back; no answer → the paid request is kept and asked again on the next buy / ticket list (never re-paid).
function readBuy() {
  try {
    const o = JSON.parse(localStorage.getItem(BUY_KEY) || 'null');
    return o && typeof o.req === 'string' && TICKET_SHOP[o.tier] && Number.isFinite(o.price) ? o : null;
  } catch { return null; }
}
function writeBuy(o) {
  try { if (o) localStorage.setItem(BUY_KEY, JSON.stringify(o)); else localStorage.removeItem(BUY_KEY); } catch { /* blocked */ }
}
function payGems(n) {
  const g = loadGemState();
  if (g.bal < n) return false;
  g.bal -= n;
  saveGemState(g);
  tellBalance(g.bal);
  return true;
}
function refundGems(n) { // the buy never happened: the wallet gets its gems back (not a grant — nothing was earned)
  const g = loadGemState();
  g.bal += n;
  saveGemState(g);
  tellBalance(g.bal);
}
const newReq = () => (globalThis.crypto && crypto.randomUUID ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16)));

async function settleBuy() {
  const b = readBuy();
  if (!b) return { ok: false, reason: 'none' };
  let r;
  try {
    r = await rpc('lb_ticket_buy', { p_secret: getSecret(), p_tier: b.tier, p_request: b.req });
  } catch (e) {
    if (missing(e)) { off = true; writeBuy(null); refundGems(b.price); return { ok: false, reason: 'soon' }; }
    return { ok: false, reason: 'offline' }; // kept: asked again later with the same request id
  }
  const o = buyOutcome(r);
  if (o.kind === 'retry') return { ok: false, reason: 'offline' };
  writeBuy(null);
  if (o.kind === 'refund') { refundGems(b.price); return { ok: false, reason: o.reason }; }
  return { ok: true, ticket: o.ticket, left: o.left, again: !!(r && r.again), price: b.price };
}

/** Is a paid buy still waiting on its answer? */
export const buyPending = () => !!readBuy();

/**
 * BUY a sealed `tier` ROLL ('epic' | 'legendary') for its gems. Resolves { ok: true, ticket: { id, tier }, left } or
 * { ok: false, reason: 'soon' | 'offline' | 'gems' | 'sold_out' | 'budget' | ... , short? }.
 */
export async function buyTicket(tier) {
  const item = TICKET_SHOP[tier];
  if (!item) return { ok: false, reason: 'bad_tier' };
  if (!ticketsOn()) return { ok: false, reason: off ? 'soon' : 'offline' };
  if (readBuy()) { // an earlier paid buy is unanswered: settle it first (it IS this purchase if it was the same tier)
    const prev = await settleBuy();
    if (prev.ok || prev.reason === 'offline') return prev;
  }
  const bal = loadGemState().bal;
  if (bal < item.price) return { ok: false, reason: 'gems', short: item.price - bal };
  if (!payGems(item.price)) return { ok: false, reason: 'gems', short: item.price };
  writeBuy({ req: newReq(), tier, price: item.price });
  return settleBuy();
}
