// gemsCore.js — the EAGER half of GEMS (the roll currency; the full rules are in gems.js's header).
//
// PAYLOAD SPLIT (PR #194, the payload ratchet): xp.js / wins.js / stars.js and the menu chip need only the balance,
// the one grant door, the word DROP, LEVEL UP and REBIRTH — so only that lives in the index chunk. The game-result
// payouts and the ledger sums (read only by the lazy game screens) live in gems.js, which re-exports all of this.
//
// LEAF MODULE ON PURPOSE: it imports nothing from progress/*, so wins.js / xp.js / letterXp.js / stars.js can call
// into it without joining an import cycle. Every storage access is guarded (a blocked store reads as 0, never throws).

// PROGRESSION v3 (SEASON2, default OFF): the v3 gem table (v3/econ.js) and the season's own balance key. Both are
// leaves, so this module stays a leaf. OFF = every constant below as it was.
// (v3: the gem table is swapped in by v3/install.js — __v3 below; ROLL_PRICE_GEMS is `let` so the swap reaches every importer)

// ------------------------------------------------------------------------------------ tuning (exported)
// TUNED ON THE CI SIM (PR #194, Andy: "tune only the drop chance and win payouts"): at Andy's 1/15 + 5 + 5 the
// 10 h loop-sim read casual 0.445 / median 0.585 / strong 0.748 rolls per minute vs the 1-per-2–3-min target
// (0.33–0.5). LEVEL UP + REBIRTH (fixed) are ~60% of it, so the two tunable knobs carry the whole correction.
export const GEM_DROP_CHANCE = 1 / 30; // per accepted game word (Andy's start: 1/15)
export const GEM_DROP_MIN = 1;
export const GEM_DROP_MAX = 3;
export const BOT_WIN = 3; // won a game whose every rival was a bot (Andy's start: 5)
export const PER_PLAYER_BEATEN = 3; // a game with people in it: per person placed below you (Andy's start: 5)
export const STREAK_PER_WIN = 1; // (v3: a FLAT +4 a streak win instead — gems.js gameResultPayout) // × the wins in a row BEFORE this one (2nd straight win +1, 3rd +2 …)
export const LEVEL_UP = 2; // v3: 0 — not in the table (levels reach millions) // per level reached for the first time on this save
export const REBIRTH = 20;
export let ROLL_PRICE_GEMS = 10;

export const GEMS_KEY = 'taw.gems'; // (v3: taw.s2.gems — mapped at the storage layer, v3/install.js)

// The reasons a gem can be granted (the ledger's `reason`; the sim's "by source").
export const GEM_REASONS = ['drop', 'bot', 'placement', 'streak', 'level', 'rebirth', 'start', 'achievement', 'daily']; // v3 ACHIEVEMENTS pay gems; 'daily' = the DAILY FREE DROP

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
export function saveGemState(s) {
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
/** Tell every balance subscriber (gems.js's spendGems uses it too). */
export function tellBalance(v) {
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
/** fn(entry) after every grant. Returns an unsubscribe. */
export function subscribeGemLedger(fn) {
  if (typeof fn !== 'function') return () => {};
  ledgerSubs.add(fn);
  return () => ledgerSubs.delete(fn);
}
/** The newest ledger id — take it when a round starts. */
export function gemsLedgerMark() {
  return ledgerSeq;
}
/** Grants since a mark (0 = all this session). */
export function gemsLedgerSince(id = 0) {
  return ledger.filter((e) => e.id > id);
}
/** Test / teardown only (gems.js's resetGemsLedger also forgets the paid games). */
export function resetGemsLedgerCore() {
  ledger = [];
  ledgerSeq = 0;
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

// v3 (SEASON2): v3/install.js swaps the v3 versions in (v3/hooks.js); never called with the flag OFF.
export function __v3(o) {
  // eslint-disable-next-line no-func-assign
  ({ a: rollGemDrop, b: noteLevelReached, c: ROLL_PRICE_GEMS, d: noteRebirth, e: dropGemsForWord } = o);
}
