// wins.js — the WINS currency + per-mode round counters. localStorage-backed, every access
// wrapped (a blocked/absent store degrades to 0, never throws). Wins are a SPENDABLE
// balance (taw.wins); taw.winsLifetime is a never-decremented all-time total tracked
// separately; taw.rounds.{wordBomb,blitz,satRush} counts completed rounds per mode.
//
// A round only "counts" (pays wins + bumps its mode counter) when the player got at least
// MIN_WORDS accepted — a sub-3 round is treated as not-really-played.

import {
  rebirthMult,
  getRebirths,
  round10,
  loadProgress,
  saveProgress,
  creditXp,
  xpPerWord,
  keyTierXp,
  getKeyTier,
  XP_MULTIPLIERS,
} from './xp.js';
import { momentumMult, getMomentum } from './momentum.js';
import { markWinsFactors, markXpMult } from './marks.js';
import { addMasteryWord, masteryXpMult } from './mastery.js';
import { getStreakMult } from './streak.js';

export const WINS_KEY = 'taw.wins';
export const WINS_LIFETIME_KEY = 'taw.winsLifetime';
// One-time flag: has the "WINS BUY UPGRADES IN THE SHOP" first-earn explainer been shown yet?
export const WINS_HINT_KEY = 'taw.seenWinsHint';
export const ROUNDS_KEY = 'taw.rounds';
export const ROUND_MODES = ['wordBomb', 'blitz', 'satRush'];
// The payout gate: a round pays nothing until this many words are accepted. Exported
// so the in-game HUD pill can show the gate ("3 WORDS TO EARN") before it's crossed.
export const MIN_WORDS = 3;

function readInt(key) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return 0;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}
function writeInt(key, n) {
  try {
    localStorage.setItem(key, String(n));
  } catch {
    /* storage blocked */
  }
}

export function getWins() {
  return readInt(WINS_KEY);
}
export function saveWins(n) {
  writeInt(WINS_KEY, n);
}
export function getWinsLifetime() {
  return readInt(WINS_LIFETIME_KEY);
}

// The one-time first-earn WINS explainer: read/set its "already shown" flag. Guarded like every
// other access — a blocked store simply never remembers, so the worst case is the tip re-showing.
export function hasSeenWinsHint() {
  try {
    return localStorage.getItem(WINS_HINT_KEY) === '1';
  } catch {
    return false;
  }
}
export function markWinsHintSeen() {
  try {
    localStorage.setItem(WINS_HINT_KEY, '1');
  } catch {
    /* storage blocked */
  }
}
export function saveWinsLifetime(n) {
  writeInt(WINS_LIFETIME_KEY, n);
}

export function getRounds() {
  const out = {};
  for (const m of ROUND_MODES) out[m] = 0;
  try {
    const raw = localStorage.getItem(ROUNDS_KEY);
    if (raw == null) return out;
    const o = JSON.parse(raw) || {};
    for (const m of ROUND_MODES) {
      const v = Number(o[m]);
      if (Number.isFinite(v) && v >= 0) out[m] = Math.floor(v);
    }
  } catch {
    /* fall through to zeroed out */
  }
  return out;
}
export function saveRounds(rounds) {
  try {
    localStorage.setItem(ROUNDS_KEY, JSON.stringify(rounds));
  } catch {
    /* storage blocked */
  }
}

// THE PER-MODE PAYOUT TABLE IS XP_MULTIPLIERS (xp.js) AND ONLY THAT.
// `WINS_MULT` used to live here — a SECOND per-mode table (WB 2 · Blitz 1.4 · SAT 1.6 · CHAIN 2.5
// · FUSE 2.5) that scaled wins while XP_MULTIPLIERS scaled XP, so the same word ranked the modes
// differently depending on which number you looked at. With one stack there can only be one
// table, and it is the XP one: menu 1 · WB 2 · Blitz 2 · SAT 3 · CHAIN 4 · FUSE 5.
/** Every mode that pays, in payout-key spelling. */
export const PAYOUT_MODES = ['wordBomb', 'blitz', 'satRush', 'chain', 'fuse'];

// Difficulty multiplier for the modes that HAVE a difficulty (Word Bomb / Category Blitz).
// The engine's difficulty KEYS in ascending order are chill < easy < medium < hard (the
// player-facing labels are CHILL / HARD / CRAZY / HELL). We map that ladder onto the spec's
// 1.0 → 2.0 ramp, so the easiest tier pays base and the hardest (HELL) doubles. Modes with
// no difficulty (or an unknown/absent key) fall through to ×1.
export const DIFFICULTY_MULT = { chill: 1.0, easy: 1.25, medium: 1.5, hard: 2.0 };

// A representative round used ONLY to preview a mode's payout on its menu card. Ten accepted
// words at R0 / ×1 difficulty (post-rebalance: WB ~400, Blitz ~200, SAT ~100, CHAIN ~400, FUSE ~200).
export const TYPICAL_ROUND_WORDS = 10;

// ================================================================ ONE STACK, TWO READOUTS
//
// WINS ARE THE WORD'S XP DIVIDED BY TEN. That is the whole model, and it replaces a second,
// parallel multiplier stack that wins used to keep for itself.
//
// WHAT WAS WRONG. A word paid XP through one product (key tier × letters × XP_MULTIPLIERS ×
// rebirth × streak × mastery × the mark's xpMult) and wins through a DIFFERENT one
// (WORD_WINS_BASE 100 × WINS_MULT × difficulty × rebirth × momentum × level × the mark's
// winsMult). Two tables of per-mode multipliers, two bases, and four factors that appeared in
// exactly one of them. So the two numbers on screen for the same keystroke could not be reasoned
// about together, they drifted every time either table was retuned, and a shop item that said
// "+20% XP" silently did nothing to the currency the shop is priced in.
//
// NOW THERE IS ONE PRODUCT. xpPerWord() (xp.js) computes it; wins are that number ÷ 10. Because
// every XP grant is snapped to a multiple of ten, the division is exact — wins are an integer
// with nothing to round away, and the two readouts can never disagree by construction rather
// than by a test that watches them.
//
// WHAT MOVED, EXPLICITLY:
//   - WORD_WINS_BASE (100) is gone. The base is the word's LETTERS at the player's key tier
//     (keyTierXp × length ÷ 10 — see wordWinsBase), so KEY POWER now raises wins as well as XP.
//     That is the intended consequence: it was the one upgrade that bought income in a currency
//     it could not be spent on.
//   - WINS_MULT is gone as a payout input. XP_MULTIPLIERS is the only per-mode table.
//   - DIFFICULTY now applies to BOTH. It used to touch wins only, which meant playing on HELL
//     levelled you no faster than CHILL.
//   - WIN_LEVEL_STEP is gone FROM THE PER-WORD PAYOUT. A level term inside an award that also
//     buys levels is income chasing the curve — the exact compounding that produced the "stuck
//     at LV40" complaint. winLevelMult() itself is KEPT and still scales the flat one-off grants
//     (secret finds, secret achievements), which is what it is good for.
//   - MOMENTUM, the MARK and MASTERY are folded into ONE factor called `bonus`. All three are
//     still individually earnable and each still multiplies; they just stop being three rows of
//     "×1.03" in a breakdown. A mark's xpMult and winsMult are now the same lever, so both are
//     applied.
export const WORD_LEN_REF = 5; // the reference word a RATE is quoted for (cards, dialogs, LiveStack)

// ANDY (item 5): "Stuck at lvl 40", more than once.
// THE STRUCTURAL CAUSE, and it is one ratio. A level costs EARLY_CURVE_EXP more than the last
// while a word pays WIN_LEVEL_STEP more, so every level takes curve/income longer than the one
// before it, COMPOUNDING. Economy v8's answer is to take the level term out of the per-word award
// entirely (above): income per word is now flat in level and grows through KEY POWER, rebirth,
// mastery and momentum instead — levers the player buys, not ones that accrue for free and then
// race the curve. WIN_LEVEL_STEP survives here because the FLAT grants still want it: a secret
// found at LV80 should not pay what it paid at LV3.
export const WIN_LEVEL_STEP = 1.035; // per-level growth of the FLAT one-off grants
export function winLevelMult(level) {
  const lv = Number.isFinite(level) && level >= 1 ? Math.floor(level) : 1;
  return Math.pow(WIN_LEVEL_STEP, lv - 1);
}

// The payout keys ('wordBomb') and the gameData ids ('word-bomb') are both real and both used;
// XP_MULTIPLIERS and mastery are keyed by the id, DIFFICULTY and the mark's `mode` by the payout
// key. ONE map each way, rather than a per-call-site guess.
const GAME_KEY = {
  wordBomb: 'word-bomb',
  blitz: 'category-blitz',
  satRush: 'sat-rush',
  chain: 'chain',
  fuse: 'fuse',
};
/** The gameData-style id ('word-bomb') for either spelling of a mode. */
export function gameKey(mode) {
  const k = modeKey(mode);
  return k ? GAME_KEY[k] || k : 'menu';
}

// The flat per-word BASE, before any multiplier: what this word's LETTERS are worth at the
// player's key tier, in wins. keyTierXp × length is the XP; ÷10 is the wins.
export function wordWinsBase({ keyTier, wordLength = WORD_LEN_REF } = {}) {
  const kt = Number.isFinite(keyTier) ? keyTier : getKeyTier();
  const len = Number.isFinite(wordLength) && wordLength > 0 ? Math.floor(wordLength) : 1;
  return (keyTierXp(kt) * len) / 10;
}

/**
 * THE MULTIPLIER STACK, as named factors — the single definition, used by the XP award, by the
 * wins payout and by the receipt that explains them. The breakdown and the payment read the same
 * object, so the receipt cannot quote a number the player was not actually paid.
 *
 * `bonus` is momentum × the equipped mark × this mode's mastery, aggregated deliberately: three
 * separate near-1 rows taught nothing, and the player earns them in three different places
 * anyway. Each is still individually earnable and each still multiplies.
 */
export function perWordFactors({ mode, difficulty, rebirthCount, momentumCount, markId, masteryMult, streakMult } = {}) {
  const key = modeKey(mode);
  const id = gameKey(mode);
  const rc = Number.isFinite(rebirthCount) ? rebirthCount : getRebirths();
  // MOMENTUM (repeatable sink): a global +1%/buy multiplier, live-read like rebirth.
  const mm = Number.isFinite(momentumCount) ? momentumCount : getMomentum();
  // The equipped MARK. Its xpMult and winsMult were two names for the same lever once the stacks
  // merged, so BOTH apply — a mark cannot boost one readout and not the other any more.
  const markWins = markWinsFactors({ markId, mode: key }).mark || 1;
  const mastery = Number.isFinite(masteryMult) && masteryMult > 0 ? masteryMult : masteryXpMult(id);
  const stm = Number.isFinite(streakMult) && streakMult > 0 ? streakMult : getStreakMult();
  return {
    mode: XP_MULTIPLIERS[id] ?? 1,
    difficulty: DIFFICULTY_MULT[difficulty] ?? 1,
    rebirth: rebirthMult(rc),
    streak: stm,
    bonus: momentumMult(mm) * markWins * markXpMult(markId) * mastery,
  };
}

/** One word's XP, with the whole stack resolved. The number wins are derived from. */
export function perWordXp(opts = {}) {
  const f = perWordFactors(opts);
  return xpPerWord({
    mode: gameKey(opts.mode),
    keyTier: opts.keyTier,
    rebirthCount: opts.rebirthCount,
    wordLength: Number.isFinite(opts.wordLength) ? opts.wordLength : WORD_LEN_REF,
    weight: opts.weight,
    streakMult: f.streak,
    difficultyMult: f.difficulty,
    bonusMult: f.bonus,
  });
}

/** One word's WINS: its XP ÷ 10. Exact — every XP grant is a multiple of ten. */
export function perWordWins(opts = {}) {
  return Math.round(perWordXp(opts) / 10);
}

// Wins granted for a round (PURE given rebirthCount). <3 accepted words → 0; else
// (weighted or plain) word count × the per-word rate. Difficulty defaults to ×1 (unspecified /
// no-difficulty modes).
//
// `weightedWords` — an optional reward-weighted word count that REPLACES the raw count in the
// multiplication when positive. The <3-word GATE always uses the raw integer count, so a weight
// can't sneak a sub-3 run past the gate. Omitting it leaves the plain count × rate. NOTE: live
// gameplay no longer feeds this — COMBO (progress/combo.js) and LUCKY (progress/luck.js) fold
// their per-word multipliers into the per-word banking WEIGHT (bankWordWins) instead; this
// param is retained for the pure recordRound reference + its unit tests.
export function awardWins({ wordsAccepted, mode, difficulty, rebirthCount, weightedWords, wordLength } = {}) {
  const w = Number.isFinite(wordsAccepted) ? Math.floor(wordsAccepted) : 0;
  if (w < MIN_WORDS) return 0;
  const weight = Number.isFinite(weightedWords) && weightedWords > 0 ? weightedWords : w;
  // Math.round, not round10: wins are XP÷10 and no longer land on a multiple of ten, so snapping
  // the TOTAL to one would quietly disagree with the sum of the words that produced it.
  return Math.round(weight * perWordWins({ mode, difficulty, rebirthCount, wordLength }));
}

// The card's per-ROUND payout preview: a typical round's wins for this mode/difficulty
// (defaults to the easiest tier / ×1). Pure wrapper over awardWins.
export function roundWinsEstimate({ mode, difficulty } = {}) {
  return awardWins({ wordsAccepted: TYPICAL_ROUND_WORDS, mode, difficulty });
}

// TWO MAPS FOR ONE FACT, IN TWO KEY STYLES, IS HOW THEY DRIFT. The kebab-keyed per-mode table
// the menu card used was already MISSING 'category-blitz' entirely, so Blitz fell through to x1.
// There is now ONE table (XP_MULTIPLIERS) and a key normaliser.
const MODE_KEY_ALIAS = {
  'word-bomb': 'wordBomb',
  'category-blitz': 'blitz',
  'sat-rush': 'satRush',
  chain: 'chain',
  fuse: 'fuse',
};
/** Canonical mode key, accepting either the gameData id ('word-bomb') or the payout key. */
export function modeKey(mode) {
  if (!mode) return null;
  return MODE_KEY_ALIAS[mode] || (PAYOUT_MODES.includes(mode) ? mode : null);
}
/** @deprecated kept for callers/tests; the alias map is the only per-mode key table left. */
export const WORD_WINS_MULT = MODE_KEY_ALIAS;

// The BASE per-word rate: mode × difficulty on a reference word, with NO earned multipliers —
// no rebirth, no momentum, no mark, no mastery, no streak. Kept because the mode DIALOG and the
// sims want the stable number. (Key tier is read live: it is the base now, not a multiplier.)
export function wordWinsEstimate({ mode, difficulty, keyTier, wordLength } = {}) {
  return Math.round(
    xpPerWord({
      mode: gameKey(mode),
      keyTier,
      rebirthCount: 0,
      wordLength: Number.isFinite(wordLength) ? wordLength : WORD_LEN_REF,
      weight: 1,
      streakMult: 1,
      difficultyMult: DIFFICULTY_MULT[difficulty] ?? 1,
      bonusMult: 1,
    }) / 10
  );
}

/**
 * WHAT A WORD IS ACTUALLY WORTH IN THIS MODE, RIGHT NOW.
 *
 * ANDY: "Multipliers should SHOW." The menu card used to print the BASE rate and then append the
 * rebirth multiplier as a separate "(x3)" — leaving the player to do the multiplication, and
 * silently omitting momentum and the equipped mark from BOTH numbers. So the card said
 * "200 WINS / WORD (x3)" while a word was really paying, say, 763.
 *
 * This returns the resolved rate and the factors behind it, so the card can print the number the
 * player will actually receive and name what got it there. It is the SAME perWordFactors() the
 * payout uses — the card cannot quote a rate the game will not pay.
 *
 * @returns {{ rate:number, base:number, mult:number, factors:object }}
 *   rate   — wins for one COMMON word at x1 rarity/combo/lucky, all permanent multipliers applied
 *   base   — the reference word's letters at the player's key tier, the floor everything scales from
 *   mult   — rate / base, i.e. everything the player has built, as one number
 */
export function perWordRateNow({ mode, difficulty, rebirthCount, momentumCount, markId, keyTier, wordLength } = {}) {
  const key = modeKey(mode);
  const opts = { mode: key, difficulty, rebirthCount, momentumCount, markId, keyTier, wordLength };
  const factors = perWordFactors(opts);
  const rate = perWordWins(opts);
  const base = wordWinsBase({ keyTier, wordLength });
  return { rate, base, mult: base > 0 ? rate / base : 1, factors };
}

// The player's live rebirth WINS multiplier (same ladder as XP), 1 at R0. Exposed so the menu
// card + mode-dialog copy can annotate the per-word rate with the active rebirth boost. Reads
// taw.rebirths unless a count is passed (keeps it pure/testable).
export function currentRebirthMult(rebirthCount) {
  const rc = Number.isFinite(rebirthCount) ? rebirthCount : getRebirths();
  return rebirthMult(rc);
}

// A finite "+N WINS" menu stamp is queued here when a round pays out, and consumed by the
// homepage on the next menu visit (so returning to the menu shows one stamp for the total).
let pendingStamp = 0;
export function consumePendingWinsStamp() {
  const s = pendingStamp;
  pendingStamp = 0;
  return s;
}

// ================================================================ THE WINS LEDGER
//
// ANDY, REPEATEDLY: "I be here getting like 800 but it gives like over 2k — idk where the thing
// comes from." / "Every single win he earns, no random hidden wins."
//
// HE WAS RIGHT, AND HERE IS THE MEASUREMENT. A scripted 20-word Word Bomb run with the collection
// sitting at 99 words: `taw.wins` moved 10,000 -> 30,010 (delta 20,010) while the game-over card
// said **+15,010**. Five thousand wins appeared in the balance with nothing on screen accounting
// for them — the 100-word COLLECTION MILESTONE, granted through `grantWins` from
// `collection.js:137`, whose return value every single call site discards.
//
// THE CAUSE WAS STRUCTURAL, not a missing `<div>`. There were two ways to credit wins:
//   bankWordWins()  per-word, fed `pendingStamp`, and IS shown (the +N pill / WINS EARNED)
//   grantWins()     a bare number with NO label, NO stamp, and no obligation to be rendered
// and three callers on the second path (achievements, collection milestones, the return bonus).
// Only the return bonus happened to have a card. So the defect was not "somebody forgot a toast";
// it was that the API made forgetting the default.
//
// THE FIX IS THAT THERE IS NOW ONE DOOR. Every win that enters the balance goes through
// `credit(amount, label)`, and a label is MANDATORY. Each credit becomes a ledger ENTRY that the
// UI can render and a test can sum. Nothing can be credited anonymously any more, because the
// only function that writes the balance refuses to do it without a reason.
//
// The ledger is in-memory and per-session ON PURPOSE: it is a feed of "what just happened to your
// balance", not a persisted transaction log. A reload starts a fresh feed; the balance itself is
// the persisted truth.
let ledger = [];
let ledgerSeq = 0;
const ledgerSubs = new Set();

/** The label used when a caller credits without saying why. It is deliberately loud, and
 *  `e2e/no-hidden-wins.spec.js` fails on any entry carrying it. */
export const UNATTRIBUTED = 'UNATTRIBUTED';

/**
 * THE ONE PLACE WINS ENTER THE BALANCE. Everything else in this file routes through here.
 *
 * @param {number} amount  wins to credit (<=0 is a no-op)
 * @param {string} label   what the player did to earn it, in player-facing words. REQUIRED.
 * @param {object} [meta]  { kind: 'word'|'bonus', mode, detail } — `kind` decides whether the UI
 *                         folds it into the per-word total or gives it its own named line.
 * @returns {number} the amount actually credited
 */
function credit(amount, label, meta = {}) {
  const amt = Number.isFinite(amount) && amount > 0 ? Math.floor(amount) : 0;
  if (amt <= 0) return 0;
  saveWins(getWins() + amt);
  saveWinsLifetime(getWinsLifetime() + amt);
  pendingStamp += amt;
  const entry = {
    id: ++ledgerSeq,
    amount: amt,
    label: label || UNATTRIBUTED,
    kind: meta.kind || 'bonus',
    mode: meta.mode || null,
    at: Date.now(),
  };
  ledger.push(entry);
  for (const fn of ledgerSubs) {
    try { fn(entry); } catch { /* a bad subscriber must never break a payout */ }
  }
  return amt;
}

/** Subscribe to every credit as it happens. Returns an unsubscribe. */
export function subscribeWins(fn) {
  if (typeof fn !== 'function') return () => {};
  ledgerSubs.add(fn);
  return () => ledgerSubs.delete(fn);
}

/** Every credit this session, oldest first. */
export function winsLedger() {
  return ledger.slice();
}

/** Credits since a given ledger id (0 = everything) — what one run earned, in named lines. */
export function winsLedgerSince(id = 0) {
  return ledger.filter((e) => e.id > id);
}

/** The newest ledger id, so a caller can mark the start of a run. */
export function winsLedgerMark() {
  return ledgerSeq;
}

/** Test/teardown only. */
export function resetWinsLedger() {
  ledger = [];
  ledgerSeq = 0;
}

// Grant wins directly (no round gating) into BOTH the spendable balance and the never-
// decremented lifetime total. Returns the new balance.
//
// `label` IS REQUIRED and is what the player will read. Callers that omit it still credit — a
// missing label must never cost a player money — but the entry is stamped UNATTRIBUTED and the
// no-hidden-wins gate goes red on it, which is the loudest safe failure.
export function grantWins(n, label, meta = {}) {
  credit(n, label, { kind: 'bonus', ...meta });
  return getWins();
}

// Bank wins INCREMENTALLY as accepted words climb, so leaving mid-round never forfeits what
// was already earned (§2). Called once per accepted word with the round's running accept count
// BEFORE (prevWords) and AFTER (nowWords) this word. Pays perWordWins for every word past the
// MIN_WORDS gate: word 3 banks 3×perWord RETROACTIVELY (the round crosses the gate), words 4+
// bank 1×perWord each, words 1-2 bank nothing (still gated). Grants into balance + lifetime +
// the menu stamp, and bumps the mode's round counter ONCE (the first crossing). Returns the
// wins granted THIS call. Pure given rebirthCount (only side effect is localStorage).
//
// This REPLACES the end-of-round recordRound() payout in every mode — the two must never both
// run for the same round or wins double-pay. recordRound is kept (tested, pure) but no longer
// called from gameplay; the per-word ledger is now the single source of the payout.
// RARITY (word-value): the gate is on the COUNT of accepted words (still MIN_WORDS), but the
// PAYOUT is on a rarity WEIGHT — the running SUM of each word's rarity multiplier (see rarity.js:
// COMMON ×1 … OBSCURE ×4, + length bonus, capped ×4.5). Callers pass the cumulative weight BEFORE
// (prevWeight) and AFTER (nowWeight) this word alongside the counts. Because the paid weight is
// zero until the COUNT clears the gate, the first three words' full rarity is released
// RETROACTIVELY the instant word 3 lands (paidNow jumps from 0 to the whole cumulative weight),
// and words 4+ each release exactly their own weight — full per-word fidelity, no caller-side
// buffer. prevWeight/nowWeight DEFAULT to the counts (every word ×1) when omitted, so any caller
// that doesn't pass a weight behaves byte-identically to the pre-rarity payout.
export function bankWordWins({ mode, difficulty, prevWords, nowWords, prevWeight, nowWeight, rebirthCount, wordLength } = {}) {
  const iCount = (x) => (Number.isFinite(x) ? Math.floor(x) : 0);
  const prevN = iCount(prevWords);
  const nowN = iCount(nowWords);
  const prevW = Number.isFinite(prevWeight) ? prevWeight : prevN;
  const nowW = Number.isFinite(nowWeight) ? nowWeight : nowN;
  // Paid weight is the cumulative weight, but ZERO until the count clears the gate.
  const paidPrev = prevN >= MIN_WORDS ? prevW : 0;
  const paidNow = nowN >= MIN_WORDS ? nowW : 0;
  const deltaWeight = paidNow - paidPrev;
  if (deltaWeight <= 0) return 0;
  // `wordLength` is THIS word's letters — the same count the XP award used, so the two readouts
  // stay the same event. On the gate-crossing word the released weight covers words 1-3 and they
  // are all valued at this word's length, exactly as they are already all valued at this word's
  // difficulty and rebirth count.
  const granted = Math.round(deltaWeight * perWordWins({ mode, difficulty, rebirthCount, wordLength }));
  // Through the ONE door, like every other credit — so the per-word money and the bonus money are
  // summable by the same test and renderable by the same component.
  credit(granted, 'WORDS', { kind: 'word', mode });
  // First time this round crosses the gate → count the round (mode counters only).
  if (prevN < MIN_WORDS && nowN >= MIN_WORDS && mode && ROUND_MODES.includes(mode)) {
    const r = getRounds();
    r[mode] += 1;
    saveRounds(r);
  }
  return granted;
}

// ---- THE AWARD ------------------------------------------------------------------------------
// Credit one accepted word's XP to the persisted level state; returns creditXp's result plus the
// gain ({ state, leveledUp, level, gain, mastery }). Persistence happens here so returning to the
// menu reflects the levels earned in play; the caller may use `leveledUp` to fire a celebration.
//
// MOVED FROM xp.js (Economy v8). It computes the SAME product perWordWins() divides by ten —
// perWordXp() is the one definition — so the XP a word grants and the wins it banks are two
// readings of one number rather than two calculations that happen to be near each other. Mastery
// is read BEFORE the word is credited to the mastery track, so a word never retroactively boosts
// itself.
export function awardWordXp(opts = {}) {
  const mode = opts.mode || 'menu';
  const gain = perWordXp({ ...opts, mode });
  const res = creditXp(loadProgress(), gain);
  saveProgress(res.state);
  const mastery = addMasteryWord(mode); // credit this accepted word to the mode's mastery track
  return { ...res, gain, mastery };
}

// Apply a completed round: grant wins (balance + lifetime) and bump the mode's round
// counter — but ONLY when wordsAccepted >= MIN_WORDS. Returns the wins granted. `difficulty`
// (Word Bomb / Category Blitz tier key) scales the payout via DIFFICULTY_MULT.
// NOTE: superseded by bankWordWins() for live gameplay (kept for its unit tests / as the pure
// reference for the total a full round pays). Do NOT call this AND bankWordWins for one round.
export function recordRound({ mode, wordsAccepted, difficulty } = {}) {
  const granted = awardWins({ wordsAccepted, mode, difficulty });
  const counts = (Number.isFinite(wordsAccepted) ? wordsAccepted : 0) >= MIN_WORDS;
  if (counts) {
    credit(granted, 'WORDS', { kind: 'word', mode });
    if (mode && ROUND_MODES.includes(mode)) {
      const r = getRounds();
      r[mode] += 1;
      saveRounds(r);
    }
  }
  return granted;
}
