// gems.js — GEMS, the ROLL currency (Andy oct5: "GEMS replaces wins as the roll price").
//
//   - A MARK ROLL costs ROLL_PRICE_GEMS (10). Wins never buy rolls; the free starter roll stays.
//   - EARNED BY PLAYING, never bought:
//       a DROP on an accepted word in any game mode (GEM_DROP_CHANCE, GEM_DROP_MIN–GEM_DROP_MAX gems),
//       beating the bots (BOT_WIN), beating people (PER_PLAYER_BEATEN per player placed below you),
//       a WIN STREAK (STREAK_PER_WIN × the wins in a row before this one),
//       a LEVEL UP (LEVEL_UP per level — every level the save has never reached before, see noteLevelReached),
//       a REBIRTH (REBIRTH).
//   - ONE DOOR: every gem enters the balance through grantGems(n, reason), which writes a LEDGER entry the
//     end-of-game results read ("gems earned this round" — always its own line, never hidden). Spending goes
//     through spendGems. Nothing else writes the balance (the one-time starting grant is gemsMigrate.js, through
//     grantGems too).
//
// LEAF MODULE ON PURPOSE: it imports nothing from progress/*, so wins.js / xp.js / letterXp.js / stars.js can call
// into it without joining an import cycle. Every storage access is guarded (a blocked store reads as 0, never throws).
//
// PAYLOAD SPLIT: the eager half (balance, the one grant door, drops, LEVEL UP, REBIRTH) is gemsCore.js — the index
// chunk imports only that. This module re-exports it and adds what only the lazy game screens need.
import { loadGemState, saveGemState, grantGems, tellBalance, gemsLedgerSince, resetGemsLedgerCore, BOT_WIN, PER_PLAYER_BEATEN, STREAK_PER_WIN } from './gemsCore.js';

const int = (x) => (Number.isFinite(x) && x >= 0 ? Math.floor(x) : 0);

export * from './gemsCore.js';

/** Spend `n` gems. Returns false (and spends nothing) when the balance is short. */
export function spendGems(n) {
  const amt = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  if (amt <= 0) return true;
  const s = loadGemState();
  if (s.bal < amt) return false;
  s.bal -= amt;
  saveGemState(s);
  tellBalance(s.bal);
  return true;
}
/** Every grant this session (a copy). */
export function gemsLedger() {
  return gemsLedgerSince(0);
}
/** { total, by: { reason: n } } for a list of ledger entries. */
export function sumGems(entries = []) {
  const by = {};
  let total = 0;
  for (const e of entries) {
    if (!e || !(e.amount > 0)) continue;
    total += e.amount;
    by[e.reason] = (by[e.reason] || 0) + e.amount;
  }
  return { total, by };
}
/** Test / teardown only. */
export function resetGemsLedger() {
  resetGemsLedgerCore();
  paidGames.clear();
}

// ------------------------------------------------------------------------------------ GAME RESULTS
/**
 * PURE: what a finished game pays. rivals: [{ id, isBot, beaten }] (beaten = placed below me). selfIds: ids that
 * are other tabs of this browser (never count). streak: wins in a row BEFORE this game.
 * → { lines: [{ reason, amount }], total, streak (after) }.
 *   no person in the game (bots only): a win pays BOT_WIN.
 *   people in it: PER_PLAYER_BEATEN per person beaten (a win beats everyone; a loss can still beat some).
 *   a win also pays STREAK_PER_WIN × streak (the wins in a row before it); a loss ends the streak.
 */
export function gameResultPayout({ iWon = false, rivals = [], selfIds = [], streak = 0 } = {}) {
  const self = new Set(selfIds || []);
  const list = (rivals || []).filter((r) => r && !self.has(r.id));
  const people = list.filter((r) => !r.isBot);
  const lines = [];
  if (people.length === 0) {
    if (iWon && list.length > 0) lines.push({ reason: 'bot', amount: BOT_WIN });
  } else {
    const beaten = people.filter((r) => iWon || r.beaten).length;
    if (beaten > 0) lines.push({ reason: 'placement', amount: beaten * PER_PLAYER_BEATEN });
  }
  const before = int(streak);
  if (iWon && before > 0) lines.push({ reason: 'streak', amount: before * STREAK_PER_WIN });
  return { lines, total: lines.reduce((t, l) => t + l.amount, 0), streak: iWon ? before + 1 : 0 };
}
const paidGames = new Set();
/**
 * Pay a finished game ONCE (keyed by `key` for the session — a re-delivered game over never pays twice). Same
 * inputs as gameResultPayout minus the streak (read + written here). Returns the payout (total 0 when already paid
 * or nobody was there to beat).
 */
export function payGameResult({ key, iWon, rivals, selfIds, mode } = {}) {
  if (key != null) {
    if (paidGames.has(key)) return { lines: [], total: 0, streak: loadGemState().streak, repeat: true };
    paidGames.add(key);
  }
  const list = rivals || [];
  if (!list.length) return { lines: [], total: 0, streak: loadGemState().streak }; // a game alone is not a win or a loss
  const s0 = loadGemState();
  const p = gameResultPayout({ iWon, rivals: list, selfIds, streak: s0.streak });
  const s = loadGemState();
  s.streak = p.streak;
  saveGemState(s);
  for (const l of p.lines) grantGems(l.amount, l.reason, { mode });
  return p;
}
export function getWinStreak() {
  return loadGemState().streak;
}
