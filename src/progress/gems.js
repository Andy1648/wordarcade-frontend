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

// ------------------------------------------------------------------------------------ tuning (exported)
export const GEM_DROP_CHANCE = 1 / 15; // per accepted game word
export const GEM_DROP_MIN = 1;
export const GEM_DROP_MAX = 3;
export const BOT_WIN = 5; // won a game whose every rival was a bot
export const PER_PLAYER_BEATEN = 5; // a game with people in it: per person placed below you
export const STREAK_PER_WIN = 1; // × the wins in a row BEFORE this one (2nd straight win +1, 3rd +2 …)
export const LEVEL_UP = 2; // per level reached for the first time on this save
export const REBIRTH = 20;
export const ROLL_PRICE_GEMS = 10;

export const GEMS_KEY = 'taw.gems';

// The reasons a gem can be granted (the ledger's `reason`; the sim's "by source").
export const GEM_REASONS = ['drop', 'bot', 'placement', 'streak', 'level', 'rebirth', 'start'];

// ------------------------------------------------------------------------------------ state
// taw.gems = { v: 1, bal, peak (highest level that has paid LEVEL_UP), streak (game wins in a row), mig (the
// starting-grant stamp: 1 once gemsMigrate ran on this save) }
function fresh() {
  return { v: 1, bal: 0, peak: 1, streak: 0, mig: 0 };
}
const int = (x, d = 0) => (Number.isFinite(x) && x >= 0 ? Math.floor(x) : d);
export function loadGemState() {
  try {
    const raw = localStorage.getItem(GEMS_KEY);
    if (raw == null) return fresh();
    const o = JSON.parse(raw);
    if (!o || typeof o !== 'object') return fresh();
    return { v: 1, bal: int(o.bal), peak: Math.max(1, int(o.peak, 1)), streak: int(o.streak), mig: int(o.mig) };
  } catch {
    return fresh();
  }
}
function saveGemState(s) {
  try {
    localStorage.setItem(GEMS_KEY, JSON.stringify(s));
  } catch {
    /* storage blocked */
  }
}
/** Was this save's starting grant already given? (gemsMigrate stamps it.) */
export function gemsMigrated() {
  return loadGemState().mig > 0;
}
/** Stamp the starting grant done, and set the LEVEL_UP high-water mark (levels at or below it never pay). */
export function stampGemsMigrated({ peak } = {}) {
  const s = loadGemState();
  s.mig = 1;
  if (Number.isFinite(peak) && peak > s.peak) s.peak = Math.floor(peak);
  saveGemState(s);
}

// ------------------------------------------------------------------------------------ balance channel
export function getGems() {
  return loadGemState().bal;
}
const balanceSubs = new Set();
function tellBalance(v) {
  for (const fn of balanceSubs) {
    try { fn(v); } catch { /* a bad subscriber must never break a write */ }
  }
}
/** fn(newBalance) after every change. Returns an unsubscribe. */
export function subscribeGems(fn) {
  if (typeof fn !== 'function') return () => {};
  balanceSubs.add(fn);
  return () => balanceSubs.delete(fn);
}
/** Can the balance pay one roll? */
export function canAffordRoll(bal = getGems()) {
  return bal >= ROLL_PRICE_GEMS;
}

// ------------------------------------------------------------------------------------ THE LEDGER
// In-memory, per session (like the wins ledger): what just happened to the balance. The end-of-game line reads
// gemsLedgerSince(mark) — mark taken when the round started.
let ledger = [];
let ledgerSeq = 0;
const ledgerSubs = new Set();
/**
 * THE ONE DOOR. Credit `n` gems for `reason` (one of GEM_REASONS). <=0 is a no-op. Returns the amount credited.
 * meta: { mode, detail } — rides on the ledger entry.
 */
export function grantGems(n, reason, meta = {}) {
  const amt = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  if (amt <= 0) return 0;
  const s = loadGemState();
  s.bal += amt;
  saveGemState(s);
  const entry = { id: ++ledgerSeq, amount: amt, reason: GEM_REASONS.includes(reason) ? reason : 'start', mode: meta.mode || null, detail: meta.detail || null, at: Date.now() };
  ledger.push(entry);
  if (ledger.length > 500) ledger = ledger.slice(-500);
  for (const fn of ledgerSubs) {
    try { fn(entry); } catch { /* never break a grant */ }
  }
  tellBalance(s.bal);
  return amt;
}
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
/** fn(entry) after every grant. Returns an unsubscribe. */
export function subscribeGemLedger(fn) {
  if (typeof fn !== 'function') return () => {};
  ledgerSubs.add(fn);
  return () => ledgerSubs.delete(fn);
}
export function gemsLedger() {
  return ledger.slice();
}
/** The newest ledger id — take it when a round starts. */
export function gemsLedgerMark() {
  return ledgerSeq;
}
/** Grants since a mark (0 = all this session). */
export function gemsLedgerSince(id = 0) {
  return ledger.filter((e) => e.id > id);
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
  ledger = [];
  ledgerSeq = 0;
  paidGames.clear();
}

// ------------------------------------------------------------------------------------ DROPS
let gemRng = () => Math.random();
/** Inject the drop rng (tests, the sim). null restores Math.random. */
export function setGemRng(fn) {
  gemRng = typeof fn === 'function' ? fn : () => Math.random();
}
/** PURE: one accepted word's drop → 0 (no drop) or GEM_DROP_MIN..GEM_DROP_MAX. Two draws: the chance, the size. */
export function rollGemDrop(rng = gemRng, chance = GEM_DROP_CHANCE) {
  const u = rng();
  if (!(u >= 0 && u < chance)) return 0;
  let v = rng();
  if (!(v >= 0 && v < 1)) v = 0;
  return GEM_DROP_MIN + Math.floor(v * (GEM_DROP_MAX - GEM_DROP_MIN + 1));
}
/** An accepted GAME word (wins.awardWordXp calls this for every mode; menu typing never drops). Returns the drop. */
export function dropGemsForWord({ mode, rng } = {}) {
  if (!mode || mode === 'menu') return 0;
  const n = rollGemDrop(rng || gemRng);
  return n > 0 ? grantGems(n, 'drop', { mode }) : 0;
}

// ------------------------------------------------------------------------------------ LEVEL UP / REBIRTH
/**
 * A level was reached (xp.saveProgress calls this on every write). Pays LEVEL_UP for every level ABOVE the save's
 * high-water mark and raises it, so a re-climb after a rebirth pays only past the old peak. Returns the gems paid.
 * Nothing pays before the save's starting grant has run (gemsMigrate stamps `mig` and sets the mark at the save's
 * peak): a boot-time level write on an existing save must never pay for levels it reached before GEMS existed.
 */
export function noteLevelReached(level) {
  const L = Number.isFinite(level) ? Math.floor(level) : 0;
  const s = loadGemState();
  if (!s.mig || L <= s.peak) return 0;
  const levels = L - s.peak;
  s.peak = L;
  saveGemState(s);
  return grantGems(levels * LEVEL_UP, 'level', { detail: `lv-${L}` });
}
/** A rebirth happened (stars.rebirthWithStars). */
export function noteRebirth(rc) {
  return grantGems(REBIRTH, 'rebirth', { detail: Number.isFinite(rc) ? `rb-${rc}` : null });
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
