// wins.js — the WINS currency + per-mode round counters. localStorage-backed, every access
// wrapped (a blocked/absent store degrades to 0, never throws). Wins are a SPENDABLE
// balance (taw.wins); taw.winsLifetime is a never-decremented all-time total tracked
// separately; taw.rounds.{wordBomb,blitz,satRush} counts completed rounds per mode.
//
// A round only "counts" (pays wins + bumps its mode counter) when the player got at least
// MIN_WORDS accepted — a sub-3 round is treated as not-really-played.

import { rebirthMult, getRebirths, round10, loadProgress } from './xp.js';
import { momentumMult, getMomentum } from './momentum.js';
import { markWinsFactors } from './marks.js';

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

// Per-mode wins multiplier on the per-word base (Economy v6). REBALANCED (sim/rebalance-2) to
// EQUALIZE wins/min ACROSS modes so mode choice stops being a grind-efficiency decision. Each
// mult offsets that mode's intrinsic throughput × rarity: at equal difficulty / R0 the modes land
// WB 393 · Blitz 344 · Chain 457 · SAT 422 · Fuse 493 wins/min — ISOLATED-throughput spread 1.43×
// (was 37.7×), per the winsmin-sim. CHAIN is raised to ×1.9 so the LV20-gated mode out-earns the
// ungated WB/Blitz (unlock ladder intact), and SAT (the vocabulary mode, ~55% OBSCURE deck) sits
// above Word Bomb as intended. NOTE: the FULL-ECONOMY cross-mode spread (all reward channels, every
// per-word multiplier compounded) is wider than this isolated figure — it was ~1.54× before WORD
// SENSE and blew out to ~29× when WORD SENSE shipped uncapped; the fix/wordsense-cap ceiling (1.5)
// restores it to ~1.55× (claude/audit-economy.md + claude/_ws-cap-sweep.mjs). Keys match the ROUND
// mode passed to bankWordWins/perWordWins ('wordBomb','blitz','satRush','chain','fuse'); a missing
// key → ×1. Derivation: claude/winsmin-sim.mjs + claude/econ-rebalance-2-report.md.
// ANDY (item 4): "SAT RUSH should reach ~80/word (it's far under Blitz today)" and CHAIN + FUSE
// "MUCH higher - it feels impossible to get more than 10k".
// He was right about SAT: at x0.5 it paid HALF of Blitz per word, for the mode with the hardest
// words on screen - its card read 50 against Blitz's 100. FUSE sat at x1.0, the same as Blitz,
// despite the longest runs and the most constrained words.
// Re-fitted in claude/econ-visible-sim.mjs, which prints wins/run and wins/min at weak/median/
// strong play before and after. The binding constraint is the 2.00x cross-mode wins/min spread:
// raising a rate on a HIGH-THROUGHPUT mode moves wins/min fast, which is why FUSE goes to 1.35 and
// not to CHAIN's 1.9. Measured: spread 1.86x -> 1.75x, so the re-fit NARROWS it.
// A strong FUSE run goes 31k -> 44k and a strong SAT run 15k -> 23k.
// RE-FIT (econ-visible round 2). Andy: CHAIN and FUSE must be MUCH higher than the multiplayer
// modes ("they're solo, score-attack, and it feels impossible to clear 10k"), and SAT RUSH must
// sit NEAR BLITZ, not a third of Word Bomb. The shipped table read, at LV40:
//     WB 765 · CHAIN 727 · FUSE 516 · BLITZ 459 · SAT 308
// — both solo modes BELOW Word Bomb, which inverts what the modes are for.
//
// WHAT ACTUALLY UNBLOCKED THIS: fuse's throughput was ASSERTED at ~20 words/min while chain's was
// DERIVED from its engine at 11.6. Driving the real fuse.js engine with the same calibrated human
// produce-time model measures 9.3/min — the median run dies at ~18 words, ~6.5s per word, because
// late fuses fall to 3500ms while the human still needs ~5.5s and every expire burns a full fuse
// for no word. The asserted number was 2.15x too fast, and since wins/min = throughput x per-word,
// it made every proposed FUSE raise look like it would blow the cross-mode spread. It would not.
// That is why fuse had been pinned at x1.35 for two re-fits. See claude/econ-visible-sim.mjs,
// which now DERIVES the figure instead of asserting it.
//
// THE BOUND. Word Bomb is turn-based, so it has the LOWEST throughput (8/min) and is structurally
// allowed the HIGHEST per-word rate. With the cross-mode wins/min spread held under 2.00x, the
// ceiling on how far a mode can lead Word Bomb per word is 2*w_wb/w_mode: 1.38x for CHAIN, 1.72x
// for FUSE. This table sits inside both (chain leads by 1.30x), not on them.
// SAT'S RARITY DOUBLE COUNT IS FIXED, AND THAT IS WHAT BOUGHT THE HEADROOM.
// Previously this table sat on the CORNER of the feasible region with ~0.1% of spare spread,
// because SAT was paid for rarity TWICE: once by a deck that is rare by construction, and again
// by the per-word rarity multiplier, which exists to reward a player for CHOOSING an uncommon
// word — a choice SAT never offers. Measured, the deck averages 3.42x rarity against a real
// typist's 1.23x: a flat 2.79x nobody earned. satRarityMult() (progress/rarity.js) now scores a
// SAT word RELATIVE TO ITS OWN DECK, so a typical SAT word is x1 and the harder ones still pay
// more. Spread 1.864x, headroom 6.8% — up from 0.1%.
//
// THE ASK THAT IS NO LONGER SATISFIABLE, and it flipped direction. "SAT within 20% of Blitz"
// was written when SAT was too LOW. With the double count gone, SAT has NO per-word multiplier
// at all — it is the only mode with neither combo nor lucky (SatRushGame.jsx passes 1, 1) — so
// at an equal card rate it earns just 0.31x Blitz per MINUTE. Holding the cards within 20% of
// each other therefore forces a 2.7-4.0x wins/min gap, which busts the 2.00x spread on its own.
// No card assignment satisfies both; that is a proof, not a judgement (the search is in
// claude/econ-visible-sim.mjs). So SAT's CARD is now 390 against Blitz's 120 — coherent for a
// mode of few, slow, hard words with no multipliers to stack, and the honest reading of what it
// pays. If the cards should sit closer, the lever is giving SAT the combo+lucky every other mode
// has (winsmin-sim already ASSUMES it does — HAS_COMBO_LUCKY.satRush is true while the live code
// passes 1, 1). That is a gameplay change and has NOT been made.
// LV40 after: SAT 1,500 · CHAIN 1,040 · FUSE 1,040 · WB 810 · BLITZ 460.
export const WINS_MULT = { wordBomb: 2.1, blitz: 1.2, satRush: 3.9, chain: 2.7, fuse: 2.7 };

// Difficulty multiplier for the modes that HAVE a difficulty (Word Bomb / Category Blitz).
// The engine's difficulty KEYS in ascending order are chill < easy < medium < hard (the
// player-facing labels are CHILL / HARD / CRAZY / HELL). We map that ladder onto the spec's
// 1.0 → 2.0 ramp, so the easiest tier pays base and the hardest (HELL) doubles. Modes with
// no difficulty (or an unknown/absent key) fall through to ×1.
export const DIFFICULTY_MULT = { chill: 1.0, easy: 1.25, medium: 1.5, hard: 2.0 };

// A representative round used ONLY to preview a mode's payout on its menu card. Ten accepted
// words at R0 / ×1 difficulty (post-rebalance: WB ~400, Blitz ~200, SAT ~100, CHAIN ~400, FUSE ~200).
export const TYPICAL_ROUND_WORDS = 10;

// Economy v7: wins are paid PER WORD, and the per-word BASE ITSELF GROWS WITH THE PLAYER.
//
// WHAT WAS WRONG. v6 paid `20 × mode × difficulty × rebirth × momentum`. The 20 never moved, so
// the only way a stronger player earned more per MINUTE was by typing faster or rebirthing - a
// level-80 player and a level-8 player were paid the SAME for the same word. Two changes:
//   - BASE 20 -> 100. The floor was simply too low to read as a reward next to five-figure
//     upgrade prices.
//   - A LEVEL TERM. WIN_LEVEL_STEP^(level-1), so the base compounds as you climb: ×2.1 at LV50,
//     ×4.4 at LV100, ×19 at LV200, ×82 at LV300. Higher play pays visibly more PER WORD, which is
//     the thing the player can actually see on the accept toast.
// The level term resets with the level bar on rebirth, and rebirthMult (now 3^rc) is what pays
// for that reset - the two are deliberately the same size of lever pointing in opposite
// directions. Live-read from taw.xp unless `level` is passed (keeps the function pure/testable).
export const WORD_WINS_BASE = 100;
// ANDY (item 5): "Stuck at lvl 40", more than once.
// THE STRUCTURAL CAUSE, and it is one ratio. A level costs EARLY_CURVE_EXP more than the last
// while a word pays WIN_LEVEL_STEP more, so every level takes curve/income longer than the one
// before it, COMPOUNDING. At 1.115 / 1.015 that is 1.0985 - each level ~9.9% longer, 6.5x over
// twenty levels, 43x over forty. Which is exactly what LV40 feels like: simulated, LV40 arrives at
// 16m and then LV40->60 takes 3.9x the previous stretch and LV60->100 takes 17.3x.
// Raising income growth 1.015 -> 1.035 (and easing the curve to 1.085, see xp.js) takes the
// per-level stretch to 1.0483 - roughly halving the compounding. Simulated: LV60->100 grows 8.1x
// instead of 17.3x, and a 200-hour player reaches LV171 instead of LV136.
export const WIN_LEVEL_STEP = 1.035; // per-level growth of the per-word base
export function winLevelMult(level) {
  const lv = Number.isFinite(level) && level >= 1 ? Math.floor(level) : 1;
  return Math.pow(WIN_LEVEL_STEP, lv - 1);
}
/**
 * The PERMANENT half of a word's payout, as named factors — what the player has BUILT, as opposed
 * to what this particular word was. Exported so the payout receipt (progress/payout.js) can name
 * every multiplier without re-deriving any of them: the breakdown and the payment read the same
 * object, so the receipt cannot quote a number the player was not actually paid.
 */
export function perWordFactors({ mode, difficulty, rebirthCount, momentumCount, level, markId } = {}) {
  const rc = Number.isFinite(rebirthCount) ? rebirthCount : getRebirths();
  const lv = Number.isFinite(level) ? level : loadProgress().level;
  // MOMENTUM (repeatable sink): a global +1%/buy wins multiplier, live-read like rebirth (defaults
  // to ×1 at 0 buys, so every existing payout is unchanged until the player buys in). Applied to the
  // per-word rate so it scales EVERY mode's wins uniformly.
  const mm = Number.isFinite(momentumCount) ? momentumCount : getMomentum();
  return {
    mode: WINS_MULT[mode] || 1,
    difficulty: DIFFICULTY_MULT[difficulty] ?? 1,
    rebirth: rebirthMult(rc),
    momentum: momentumMult(mm),
    level: winLevelMult(lv),
    // The equipped MARK, if it pays in this mode. Folded in HERE rather than at the call sites so
    // the payment and the receipt read the same object - a mark cannot boost a payout without
    // appearing in the breakdown, because there is only one place either could come from.
    ...markWinsFactors({ markId, mode }),
  };
}
export function perWordWins(opts = {}) {
  const f = perWordFactors(opts);
  return round10(
    WORD_WINS_BASE * f.mode * f.difficulty * f.rebirth * f.momentum * f.level * (f.mark || 1)
  );
}

// Wins granted for a round (PURE given rebirthCount). <3 accepted words → 0; else
// (weighted or plain) word count × the per-word rate, snapped to a round 10. Difficulty
// defaults to ×1 (unspecified / no-difficulty modes).
//
// `weightedWords` — an optional reward-weighted word count that REPLACES the raw count in the
// multiplication when positive. The <3-word GATE always uses the raw integer count, so a weight
// can't sneak a sub-3 run past the gate. Omitting it (every current caller) is unchanged: since
// perWordWins is already a multiple of 10, round10(count × rate) == count × rate. NOTE: live
// gameplay no longer feeds this — COMBO (progress/combo.js) and LUCKY (progress/luck.js) fold
// their per-word multipliers into the per-word banking WEIGHT (bankWordWins) instead; this
// param is retained for the pure recordRound reference + its unit tests.
export function awardWins({ wordsAccepted, mode, difficulty, rebirthCount, weightedWords, level } = {}) {
  const w = Number.isFinite(wordsAccepted) ? Math.floor(wordsAccepted) : 0;
  if (w < MIN_WORDS) return 0;
  const weight = Number.isFinite(weightedWords) && weightedWords > 0 ? weightedWords : w;
  return round10(weight * perWordWins({ mode, difficulty, rebirthCount, level }));
}

// The card's per-ROUND payout preview: a typical round's wins for this mode/difficulty
// (defaults to the easiest tier / ×1). Pure wrapper over awardWins.
export function roundWinsEstimate({ mode, difficulty } = {}) {
  return awardWins({ wordsAccepted: TYPICAL_ROUND_WORDS, mode, difficulty });
}

// PER-WORD wins preview shown on the menu cards. Base 20 per word, keyed by game.id (NOT the
// round-mode key used by perWordWins/recordRound — GameCard passes game.id). REBALANCED
// (sim/rebalance-2) to the SAME per-mode factors as WINS_MULT: WB ×2 · Blitz ×1 · SAT ×0.5 ·
// CHAIN ×1.9 · FUSE ×1, then × difficulty, snapped to a round 10 (R0 per-word: word-bomb 40,
// category-blitz 20, sat-rush 10, chain 40, fuse 20 at the ×1 difficulty default). This is the R0
// BASE per-word rate; the card/dialog copy shows it and ANNOTATES the active rebirth boost
// separately via currentRebirthMult() below, so the stable base stays readable.
// TWO MAPS FOR ONE FACT, IN TWO KEY STYLES, IS HOW THEY DRIFT. `WINS_MULT` (camelCase, what the
// payout actually uses) and `WORD_WINS_MULT` (kebab, what the menu card used) were separate
// tables — and the kebab one was already MISSING 'category-blitz' entirely, so Blitz fell through
// to x1. It happens to equal WINS_MULT.blitz today, so nothing was visibly wrong; the next edit to
// one of them would have been. There is now ONE table and a key normaliser.
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
  return MODE_KEY_ALIAS[mode] || (Object.hasOwn(WINS_MULT, mode) ? mode : null);
}
/** @deprecated kept for callers/tests; now derived from the single WINS_MULT table. */
export const WORD_WINS_MULT = MODE_KEY_ALIAS;

// The BASE per-word rate: mode x difficulty only, no player state. Kept because the mode DIALOG
// and the sims want the stable number.
export function wordWinsEstimate({ mode, difficulty } = {}) {
  const diffMult = DIFFICULTY_MULT[difficulty] ?? 1;
  const modeMult = WINS_MULT[modeKey(mode)] || 1;
  return round10(WORD_WINS_BASE * modeMult * diffMult);
}

/**
 * WHAT A WORD IS ACTUALLY WORTH IN THIS MODE, RIGHT NOW.
 *
 * ANDY: "Multipliers should SHOW." The menu card used to print the BASE rate and then append the
 * rebirth multiplier as a separate "(x3)" — leaving the player to do the multiplication, and
 * silently omitting momentum, level and the equipped mark from BOTH numbers. So the card said
 * "200 WINS / WORD (x3)" while a word was really paying, say, 763.
 *
 * This returns the resolved rate and the factors behind it, so the card can print the number the
 * player will actually receive and name what got it there. It is the SAME perWordFactors() the
 * payout uses — the card cannot quote a rate the game will not pay.
 *
 * @returns {{ rate:number, base:number, mult:number, factors:object }}
 *   rate   — wins for one COMMON word at x1 rarity/combo/lucky, all permanent multipliers applied
 *   base   — WORD_WINS_BASE, the floor everything scales from
 *   mult   — rate / base, i.e. everything the player has built, as one number
 */
export function perWordRateNow({ mode, difficulty, rebirthCount, momentumCount, level, markId } = {}) {
  const key = modeKey(mode);
  const factors = perWordFactors({ mode: key, difficulty, rebirthCount, momentumCount, level, markId });
  const rate = perWordWins({ mode: key, difficulty, rebirthCount, momentumCount, level, markId });
  return { rate, base: WORD_WINS_BASE, mult: WORD_WINS_BASE > 0 ? rate / WORD_WINS_BASE : 1, factors };
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
export function bankWordWins({ mode, difficulty, prevWords, nowWords, prevWeight, nowWeight, rebirthCount, level } = {}) {
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
  // Snap each grant to a round multiple of 10 (the payout invariant — every grant ends in a
  // zero) after applying the rarity weight to the base per-word rate.
  const granted = round10(deltaWeight * perWordWins({ mode, difficulty, rebirthCount, level }));
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
