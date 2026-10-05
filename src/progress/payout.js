// payout.js — WHERE THE WINS CAME FROM.
//
// THE BUG THIS EXISTS TO FIX, in Andy's words: "I got 40k and couldn't tell where it came from."
// A word's payout is a product of named factors (Rebirth Rush: BASE 10 × length/5 × MODE × REBIRTH
// × MARK × BOOST) — and once NONE of them were named on screen. The number arrived; the reasons did not. A multiplier the player
// cannot see is not a reward, it is a rumour: it cannot be aimed at, it cannot be compared against
// an upgrade's price, and a shop item that boosts it reads as a shot in the dark.
//
// This module is the single description of that product. It does NOT compute the payout — wins.js
// does, and it stays the authority — this builds the EXPLANATION of a payout that has already been
// computed, from the same factor values. `buildPayout` is given the factors and returns both the
// total and the rows to draw, so a breakdown can never quote a multiplier the payout did not use.
//
// Pure and DOM-free (one module-level round ledger, the same pattern wins.js uses for its pending
// stamp), so the whole thing is unit-testable under node.
import { roundWordXp } from './xp.js';
import { winnerPerkMult } from './markPerks.js';

// The display ORDER, and the only sanctioned labels. Fixed rather than derived from the object's
// key order so the breakdown reads the same way every time — a list that reorders itself between
// words is harder to read than no list at all.
// REBIRTH RUSH (PROGRESSION FINAL, frozen): WINS / word = BASE 10 × length/5 × MODE × REBIRTH × MARK × BOOST
// (× FRENZY on FUSE). These are the ONLY rows. Difficulty, streak, mastery, STAR POWER and the LETTER FORGE
// no longer pay — a caller that still passes them is ignored here, so the receipt can never name (or
// multiply in) a bonus the bank did not pay.
// WORD BOMB + BLITZ: the per-word weight (rarity × combo × lucky, capped) sits in the formula's BOOST slot
// (wins.js WEIGHTED_MODES), so BOOST = code boost × OVERDRIVE × RARITY × LENGTH × COMBO × LUCKY × MULT CAP.
// Its parts are named as BOOST sub-rows (`sub: 'boost'`) right under the BOOST row, so the player reads
// which of them moved this word. Only App's Word Bomb receipt passes them; any other mode leaves them ×1.
export const PAYOUT_FACTORS = [
  { key: 'mode', label: 'MODE', kind: 'permanent' },
  { key: 'rebirth', label: 'REBIRTH', kind: 'permanent' },
  // The worn MARK × every rolled mark's perk for this mode (wins.js perWordFactors → `bonus`).
  { key: 'bonus', label: 'MARK', kind: 'permanent' },
  // FUSE FRENZY — ×5 for five real minutes after a full strip (frenzy.js).
  { key: 'frenzy', label: 'FRENZY', kind: 'word' },
  // BOOST — a redeem code's ×N × OVERDRIVE (boost.js), every mode, for its minutes.
  { key: 'boost', label: 'BOOST', kind: 'word' },
  // BOOST sub-rows (Word Bomb + Blitz only — the per-word weight bankWordWins pays for those modes).
  { key: 'rarity', label: 'RARITY', kind: 'word', sub: 'boost' },
  { key: 'length', label: 'LENGTH', kind: 'word', sub: 'boost' },
  { key: 'combo', label: 'COMBO', kind: 'word', sub: 'boost' },
  { key: 'lucky', label: 'LUCKY', kind: 'word', sub: 'boost' },
  // The ×40 ceiling on the combined rarity×combo×lucky product (PER_WORD_MULT_CAP). A factor BELOW 1 when
  // it bites, listed for exactly that reason: a word that paid less than its multipliers promised says why.
  { key: 'cap', label: 'MULT CAP', kind: 'word', sub: 'boost' },
];
const FACTOR_BY_KEY = new Map(PAYOUT_FACTORS.map((f) => [f.key, f]));

const num = (v, dflt = 1) => (Number.isFinite(v) && v > 0 ? v : dflt);

/**
 * Explain one word's payout.
 *
 * @param {object} arg
 * @param {number} arg.base    the flat per-word base before any multiplier (wordWinsBase())
 * @param {number} [arg.letters]  the word's letter count, so the receipt can NAME the base
 * @param {number} [arg.perLetter] XP per letter at the player's key tier, ditto
 * @param {object} arg.factors { mode, rebirth, bonus (MARK), frenzy, boost, + WB/Blitz BOOST sub-factors
 *                               rarity, length, combo, lucky, cap } — each a multiplier, missing/1 =
 *                               inactive; any other key is ignored (it does not pay)
 * @param {number} [arg.total] the amount ACTUALLY banked this call, when the caller knows it.
 *                             NOTE: this is NOT what the receipt prints. See `paid` below.
 * @param {string} [arg.band]  the rarity band name (COMMON/UNCOMMON/RARE/OBSCURE), for the note
 * @returns {{ base, paid, total, computed, product, rows, band, held }}
 *
 * `paid` IS THE PRODUCT OF THE ROWS, always. This is the fix for a receipt that listed BASE 100,
 * MODE ×2, RARITY ×2.5, LENGTH ×1.16, COMBO ×1.1 and then printed PAID 0. Nothing was wrong with
 * the arithmetic: the first two words of a round bank NOTHING (the 3-word payout gate), the caller
 * passed that 0 through as the amount, and the panel dutifully printed a total that contradicted
 * every line above it. A receipt whose bottom line does not follow from its own rows is worse than
 * no receipt. So the bottom line is now what the rows say this word is WORTH, and `held` carries
 * the other fact — that the gate has not released it yet — as a caption instead of as a zero.
 */
export function buildPayout({ base = 0, factors = {}, total, band, letters, perLetter } = {}) {
  const b = Number.isFinite(base) && base > 0 ? base : 0;
  let product = 1;
  const rows = [];
  for (const f of PAYOUT_FACTORS) {
    const m = num(factors[f.key]);
    product *= m;
    // ×1 is not a contribution; listing it pads the panel with rows that mean "nothing happened".
    // The ONE exception is a factor the player has BOUGHT and is currently getting nothing from —
    // see inactivePayoutFactors(), which is what the shop card needs, not this.
    if (Math.abs(m - 1) > 1e-9) rows.push({ ...f, mult: m });
  }
  // SNAPPED ON THE XP GRID, NOT THE WINS ONE. Wins are the word's XP ÷ 10 and the XP is what
  // gets rounded (to WHOLE XP — roundWordXp, the same function xpPerWord uses), so the receipt
  // multiplies up, snaps, and divides back: the same arithmetic the payout itself does, which is
  // the only way the bottom line can match the ledger. A word can now be worth 10.1 wins.
  const computed = roundWordXp(b * product * 10) / 10;
  const banked = Number.isFinite(total) ? total : computed;
  return {
    base: b,
    product,
    computed,
    paid: computed, // what the rows add up to — the number the panel prints
    // NO XP HERE (PROGRESSION v11, amended): a game word pays WINS ONLY — the bar fills from LETTERS
    // typed (letterXp.js), so the receipt has no XP line to print.
    // The BASE, named rather than asserted: "5 letters × 10" instead of a bare "BASE 5". Absent
    // when the caller does not know them, and the panel falls back to the bare base.
    letters: Number.isFinite(letters) && letters > 0 ? Math.floor(letters) : null,
    perLetter: Number.isFinite(perLetter) && perLetter > 0 ? perLetter : null,
    total: banked, // what was actually banked this call (0 before the 3-word gate)
    held: banked <= 0 && computed > 0,
    rows,
    band: band || null,
  };
}

/**
 * The factors that are switched OFF for this word, with the reason — the other half of legibility.
 * "COMBO ×1" is noise; "COMBO — streak under 2" is the answer to a question the player is
 * actually asking when the number looks small.
 */
// Only the factors that still pay (Rebirth Rush) can be "off". Combo / rarity / lucky pay only in Word Bomb
// + Blitz (BOOST sub-factors), so they are named as off only when the caller's factors carry them — a mode
// that does not pay them never advertises them. Streak is not in the formula.
export function inactivePayoutFactors(factors = {}) {
  const out = [];
  const off = (key, why) => {
    const f = FACTOR_BY_KEY.get(key);
    if (f) out.push({ ...f, why });
  };
  const has = (k) => factors && Object.prototype.hasOwnProperty.call(factors, k);
  if (has('combo') && num(factors.combo) === 1) off('combo', 'streak under 2');
  if (has('rarity') && num(factors.rarity) === 1) off('rarity', 'COMMON word');
  if (has('lucky') && num(factors.lucky) === 1) off('lucky', 'no lucky roll');
  if (num(factors.rebirth) === 1) off('rebirth', 'no rebirths yet');
  if (num(factors.bonus) === 1) off('bonus', 'no mark worn yet');
  return out;
}

// ---- THE ROUND LEDGER ------------------------------------------------------------------------
// The accept toast can only show one word. The question "where did 40,000 come from" is about a
// whole ROUND, so the end screen needs the same breakdown accumulated across it.
//
// ATTRIBUTION. The payout is a PRODUCT, so there is no unique "wins from combo" — every factor
// multiplies every other. Splitting the winnings above base in proportion to ln(mult) is the
// standard resolution and the only one that (a) sums to exactly the amount earned, (b) gives two
// equal multipliers equal credit, and (c) is order-independent. Stated on screen as "share", not
// as "COMBO earned you N", because the honest claim is a share of a product.
let ledger = null;

export function beginPayoutLedger(mode) {
  ledger = { mode: mode || null, words: 0, base: 0, total: 0, logs: {}, logSum: 0, bonuses: [] };
}

// ---- END-OF-ROUND BONUSES (Andy oct2 O12) -----------------------------------------------------
// A bonus the ROUND pays once at its end (today: WINNER), on top of the words. It is not a
// per-word factor, so it never enters the ln-share split above; it is its own row with its own
// figure, and the TOTAL includes it. Returns false when there is no open round or this bonus was
// already noted for it — the caller pays only on true, so a re-delivered game_over never double-pays.
export const WINNER_BONUS = 0.5; // winning the game pays +50% of what the game's words earned
export function winnerBonusFor(roundTotal) {
  const t = Number.isFinite(roundTotal) ? roundTotal : 0;
  return t > 0 ? Math.max(1, Math.round(t * WINNER_BONUS)) : 0;
}
// `note` (H4) is a short caption for the receipt row: why the bonus is the size it is (e.g. the
// match bonus was held back to today's +50% because the only rival was a bot).
export function noteRoundBonus({ key, label, mult = 1, wins = 0, note = null } = {}) {
  if (!ledger || !key || !(wins > 0)) return false;
  if (ledger.bonuses.some((b) => b.key === key)) return false;
  ledger.bonuses.push({ key, label: label || key.toUpperCase(), mult, wins: Math.round(wins), note: note || null });
  return true;
}

// ---- H4: MULTIPLAYER WINNER PAYS A TON (Andy oct3) --------------------------------------------
// Spec + sim: claude/finetune/h4-winner-spec.md, claude/finetune/h4-sim.mjs. Version (c) HYBRID.
//
// Beating a PERSON pays a multiple of your own game — all of it, every rarity/combo/rebirth factor
// included, because it is a multiple of what the game's words actually banked:
//   bonus = mult × gameTotal × counted / myWords
//   counted = min(myWords, CONTEST × best human rival's words, pace × minutes)
// The two caps are the anti-farm: CONTEST means a dummy tab has to really play (a rival who typed
// 3 words lets only 6 of yours count), and PACE means words typed faster than a strong honest
// player — the signature of playing both sides of a self-made room — stop growing the bonus.
//
// `mult` is per mode because a minute of each mode pays very differently (WB is turn-based, ~6
// words a minute; a RACE is ~16, at ×3 a word). Each is tuned so a median honest WINNER earns
// ~2.5× a minute of median solo CHAIN; see the sim table. The cards quote 1 + mult ("YOUR GAME ×7").
export const WINNER_MATCH = {
  wordBomb: { mult: 6, pace: 8 },
  blitz: { mult: 4, pace: 16 },
  wordRace: { mult: 1, pace: 32 },
};
// Today's rule for each mode, paid when a gate fails (a bot room, a dummy tab, a 4-word game).
// Keeping it EXACTLY today's means no gate can ever pay less than the game did before H4.
export const WINNER_FALLBACK = { wordBomb: WINNER_BONUS, blitz: 0, wordRace: 0 };
export const WINNER_GATES = {
  minWinnerWords: 5, // a game you won with fewer valid words is not a match
  minRivalWords: 3, // a rival who typed fewer is an AFK seat, not an opponent
  contest: 2, // at most this many of your words count per word your best rival played
};
const WINNER_MODE = { 'word-bomb': 'wordBomb', 'category-blitz': 'blitz', 'word-race': 'wordRace' };
const winnerModeKey = (m) => (WINNER_MATCH[m] ? m : WINNER_MODE[m] || null);
/** The TOTAL multiplier a won match pays on your game (1 + the bonus), for the copy. */
export function winnerMatchMult(mode) {
  const k = winnerModeKey(mode);
  return k ? 1 + WINNER_MATCH[k].mult : 1;
}
// Receipt captions: why a winner got the fallback (or a capped bonus) instead of the full match pay.
export const WINNER_NOTES = {
  bots: 'MATCH BONUS NEEDS A HUMAN RIVAL',
  self: 'YOUR OTHER TAB IS NOT A RIVAL',
  'rival-words': `RIVAL PLAYED UNDER ${WINNER_GATES.minRivalWords} WORDS`,
  'my-words': `MATCH BONUS NEEDS ${WINNER_GATES.minWinnerWords}+ WORDS`,
  rival: `CAPPED: ${WINNER_GATES.contest} OF YOURS PER RIVAL WORD`,
  pace: 'CAPPED: FASTER THAN A REAL MATCH',
};

const cnt = (x) => (Number.isFinite(x) && x > 0 ? Math.floor(x) : 0);

/**
 * The winner's end-of-game bonus. PURE: every input is a fact the client observed.
 * @param {object} a
 * @param {string}  a.mode       'wordBomb'|'blitz'|'wordRace' (or the kebab gameType)
 * @param {boolean} a.iWon       the server named me the winner
 * @param {number}  a.gameTotal  the wins THIS game's words banked for me
 * @param {number}  a.myWords    my valid words this game
 * @param {number}  [a.minutes]  game length; null/unknown = no pace cap
 * @param {Array}   a.rivals     [{ id, words, isBot }] everyone else who was in the game
 * @param {Array}   [a.selfIds]  player ids other tabs of THIS browser hold (seats.js)
 * @param {number}  [a.perkMult] the CHAMPION perk (ECLIPSE mark: winner bonus ×2) — omit to read the save
 * @returns {{ wins, mult, tier: 'match'|'fallback'|'none', reason, capped, note }}
 */
export function winnerPayout({ mode, iWon, gameTotal, myWords, minutes, rivals, selfIds, perkMult } = {}) {
  const none = { wins: 0, mult: 1, tier: 'none', reason: null, capped: null, note: null };
  const k = winnerModeKey(mode);
  const total = Number.isFinite(gameTotal) && gameTotal > 0 ? gameTotal : 0;
  if (!k || !iWon || total <= 0) return none;
  // CHAMPION doubles the BONUS part (what winning adds on top of the game), match and fallback alike
  const pm = Number.isFinite(perkMult) && perkMult > 0 ? perkMult : winnerPerkMult();
  const fb = (WINNER_FALLBACK[k] || 0) * pm;
  const fallback = (reason) => ({
    wins: fb > 0 ? Math.max(1, Math.round(total * fb)) : 0,
    mult: 1 + fb,
    tier: 'fallback',
    reason,
    capped: null,
    note: WINNER_NOTES[reason] || null,
  });
  const mine = cnt(myWords);
  const list = Array.isArray(rivals) ? rivals.filter((r) => r && r.id != null) : [];
  const self = new Set(Array.isArray(selfIds) ? selfIds : []);
  const humans = list.filter((r) => !r.isBot);
  const others = humans.filter((r) => !self.has(r.id));
  const qualified = others.filter((r) => cnt(r.words) >= WINNER_GATES.minRivalWords);
  if (mine < WINNER_GATES.minWinnerWords) return fallback('my-words');
  if (!qualified.length) {
    if (!humans.length) return fallback('bots');
    if (!others.length || humans.some((r) => self.has(r.id) && cnt(r.words) >= WINNER_GATES.minRivalWords)) return fallback('self');
    return fallback('rival-words');
  }
  const best = Math.max(...qualified.map((r) => cnt(r.words)));
  const { mult, pace } = WINNER_MATCH[k];
  const byRival = WINNER_GATES.contest * best;
  const byPace = Number.isFinite(minutes) && minutes > 0 ? pace * minutes : Infinity;
  const counted = Math.min(mine, byRival, byPace);
  const capped = counted >= mine ? null : byRival <= byPace ? 'rival' : 'pace';
  const bonusMult = Math.max(fb, mult * pm * (counted / mine));
  return {
    wins: Math.max(1, Math.round(total * bonusMult)),
    mult: 1 + bonusMult,
    tier: 'match',
    reason: null,
    capped,
    note: capped ? WINNER_NOTES[capped] : null,
  };
}

/** Fold one word's payout into the round ledger. Silently ignored if no round is open. */
export function notePayout({ base = 0, factors = {}, total = 0 } = {}) {
  if (!ledger) return;
  ledger.words += 1;
  ledger.base += Number.isFinite(base) && base > 0 ? base : 0;
  ledger.total += Number.isFinite(total) && total > 0 ? total : 0;
  for (const f of PAYOUT_FACTORS) {
    const m = num(factors[f.key]);
    if (Math.abs(m - 1) <= 1e-9) continue;
    const l = Math.log(m);
    ledger.logs[f.key] = (ledger.logs[f.key] || 0) + l;
    ledger.logSum += l;
  }
}

/**
 * The round's breakdown: total, the flat base it would have paid with no multipliers at all, and
 * one row per factor with its share of everything above that base.
 * Returns null when no round has been opened.
 */
export function readPayoutLedger() {
  if (!ledger) return null;
  const above = Math.max(0, ledger.total - ledger.base);
  const rows = [];
  for (const f of PAYOUT_FACTORS) {
    const l = ledger.logs[f.key];
    if (!l || l <= 0) continue;
    rows.push({
      ...f,
      share: ledger.logSum > 0 ? l / ledger.logSum : 0,
      wins: ledger.logSum > 0 ? Math.round((l / ledger.logSum) * above) : 0,
      // The round's AVERAGE multiplier for this factor, i.e. the geometric mean over the words
      // it actually applied to — the number a player can compare against a shop card.
      mult: Math.exp(l / Math.max(1, ledger.words)),
    });
  }
  rows.sort((a, b) => b.share - a.share);
  const bonuses = ledger.bonuses.map((b) => ({ ...b }));
  const bonusTotal = bonuses.reduce((a, b) => a + b.wins, 0);
  return { mode: ledger.mode, words: ledger.words, base: ledger.base, total: ledger.total + bonusTotal, above, rows, bonuses };
}

export function clearPayoutLedger() {
  ledger = null;
}
