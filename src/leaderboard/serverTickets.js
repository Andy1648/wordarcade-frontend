// serverTickets.js — GUARANTEED ROLLS, the server half (migration 060_guaranteed_rolls.sql). Tickets live ONLY on the
// server: this module never stores one, so the ROLL screen can only show what lb_tickets just returned.
//
//   listTickets()        lb_tickets → [{ id, tier, state, pick }] (validated) — [] when off / offline / pre-060
//   rollTicket(t)        lb_ticket_roll → the reserved pick (asking again returns the SAME one — no re-rolls)
//   claimTicket(id)      lb_ticket_claim on the reveal's landing (a failure is kept and retried on the next list)
//   streakCheckin(day)   lb_streak_checkin — the STREAK CALENDAR's server-checked step (DAY 4 / DAY 7 mint tickets)
// The floor tier is never sent: the server reads it from its own ticket row.
import { getSecret, rpc } from './client.js';
import { serverRollOn } from './serverRoll.js';
import { normalizeTickets, spendPick } from '../progress/rollTickets.js';

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
