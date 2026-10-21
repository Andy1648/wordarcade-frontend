// contracts/live.js — DAILY CONTRACTS, the live half (lazy: bus.js loads it on the first game event; the menu's
// DAILY tile loads it on mount). Storage, the local-midnight reset, the gem grants and the toasts — the rules are
// pool.js's.
//
// Store: taw.contracts = pool.freshDay's shape, for TODAY only (a new local day replaces it; nothing carries over).
// Grants go through gemsCore.grantGems with reason 'contract' (detail = the task id, or 'sweep') — so the round's
// end card can say "CONTRACT DONE +N" from the gem ledger it already reads, and the gem pill hears it.
//
// THE STREAK is streak.js's, untouched: one accepted word a day keeps it (Duolingo: "one lesson keeps the streak" —
// the bar stays tiny). The contracts only SHOW it: the first task finished each day plays the STREAK KEPT moment.
import { freshDay, applyEvent, rerollSlot, allDone, BY_ID, TIER_GEMS, SWEEP_GEMS, MODES, modeOf } from './pool.js';
import { grantGems } from '../gemsCore.js';
import { getStreak } from '../streak.js';
import { rarityOf } from '../rarityIndex.js';
import { GAMES } from '../../gameData.js';
import { isModeLocked } from '../modeAccess.js';

import { CONTRACTS_KEY, CONTRACTS_CHANGE, dayKey } from './bus.js';

export { CONTRACTS_KEY, CONTRACTS_CHANGE, dayKey };
/** ms to the next local midnight. */
export function msToReset(now = Date.now()) {
  const m = new Date(now);
  m.setHours(24, 0, 0, 0);
  return Math.max(0, m.getTime() - now);
}

/** The contract modes the player can play right now (a locked CHAIN / FUSE is never dealt). */
export function openModes() {
  try {
    const open = GAMES.filter((g) => !isModeLocked(g, 0)).map((g) => modeOf(g.id)).filter(Boolean);
    return open.length ? open : MODES;
  } catch {
    return MODES;
  }
}

let mem = null; // the session copy when storage is blocked
function read() {
  try {
    const raw = localStorage.getItem(CONTRACTS_KEY);
    return raw ? JSON.parse(raw) : mem;
  } catch {
    return mem;
  }
}
function write(s) {
  mem = s;
  try { localStorage.setItem(CONTRACTS_KEY, JSON.stringify(s)); } catch { /* memory only */ }
  try { window.dispatchEvent(new CustomEvent(CONTRACTS_CHANGE)); } catch { /* node */ }
}
const valid = (s) => s && s.v === 1 && Array.isArray(s.picks) && Array.isArray(s.done) && s.prog && typeof s.prog === 'object';

/** Today's contracts (deals a new day on first sight after local midnight). */
export function today(now = Date.now()) {
  const day = dayKey(now);
  const s = read();
  if (valid(s) && s.day === day) return { seen: {}, ...s };
  const fresh = freshDay(day, openModes());
  write(fresh);
  return fresh;
}

/** The one daily reroll of `slot`. Returns true when it swapped. */
export function reroll(slot) {
  const next = rerollSlot(today(), slot, openModes());
  if (!next) return false;
  write(next);
  return true;
}

// ---- the toasts (lazy: the first tick loads them) -------------------------------------------------------------------
let toastMod = null;
function toast(t) {
  if (toastMod) { toastMod.pushContractToast(t); return; }
  import('../../components/contracts/ContractToast.jsx').then((m) => { toastMod = m; m.pushContractToast(t); }, () => {});
}
// A long count would toast every word; it speaks at each quarter instead (and always on a finish).
function worthSaying(t) {
  if (t.done || t.target <= 5) return true;
  const q = (n) => Math.floor((n / t.target) * 4);
  return q(t.to) > q(t.from);
}

/** Handle one bus event. */
export function handle(ev) {
  const e = { ...ev };
  if (e.type === 'word' && !e.band && e.word) {
    try { e.band = rarityOf(String(e.word).trim().toLowerCase()).band; } catch { /* unknown → no band */ }
  }
  const cur = today();
  const { state, ticks } = applyEvent(cur, e);
  if (!ticks.length) return;
  let next = state;
  const said = [];
  for (const t of ticks) {
    const c = BY_ID[t.id];
    if (t.done) {
      const gems = grantGems(TIER_GEMS[c.tier], 'contract', { detail: t.id, mode: c.mode });
      if (!next.kept) {
        next = { ...next, kept: true };
        said.push({ kind: 'kept', streak: Math.max(1, getStreak().count), goal: c.goal, gems });
      } else {
        said.push({ kind: 'done', goal: c.goal, gems });
      }
    } else if (worthSaying(t)) {
      said.push({ kind: 'tick', goal: c.goal, to: t.to, target: t.target });
    }
  }
  if (allDone(next) && !next.sweep) {
    next = { ...next, sweep: true };
    const gems = grantGems(SWEEP_GEMS, 'contract', { detail: 'sweep' });
    said.push({ kind: 'sweep', gems });
  }
  write(next);
  for (const t of said) toast(t);
}
