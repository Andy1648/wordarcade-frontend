// statBoard.js — the STAT BOARD (Andy oct5, Keyboard Escape / Genshin): "BASE big, then each multiplier on its own
// line (KEY ×, REBIRTH ×, MARK ×, BOOST ×), then TOTAL huge. For both wins/word and XP/letter."
//
// Two stacks, read from the live save:
//   WINS / WORD  = BASE (10 + the worn mark's +N BASE WINS) × MODE × REBIRTH 5^R × MARK × INDEX × BOOST   (5-letter ref)
//   XP / LETTER  = BASE (10 + the worn mark's +N BASE XP)   × KEY × REBIRTH 5^R × MARK × INDEX × BOOST
//
// HONESTY: TOTAL is NOT this module's product — it is the number the game pays (wins.perWordRateNow and
// letterXp.letterXpNow). The lines are read from the SAME factor sources the payout reads (perWordFactors /
// wordWinsBase for wins; keyXpMult / rebirthXpMult / markXpBoost / letterPerkMult / boostMult for XP), and
// statBoard.test.js asserts BASE × every line = TOTAL across saves. So the board cannot claim a bonus the
// game does not pay.
//
// The reference is a 5-letter word (length/5 = ×1, no line) in `mode` (default Word Bomb, MODE ×1 — still a line, so
// the chain names every factor of FINAL's 22 × length/5 × MODE × 2^R × (1 + ★) × MARK). KEY does not
// touch wins (Rebirth Rush), so the wins stack has no KEY line. FRENZY (FUSE's ×5, every mode under the ORIGIN
// perk) is a timed multiplier like BOOST and rides the BOOST line; the DOUBLE LETTERS perk is the worn mark's and
// rides the MARK line.
import { perWordFactors, perWordRateNow, wordWinsBase, WORD_LEN_REF } from './wins.js';
import { keyXpMult, rebirthXpMult, getKeyTier, getRebirths, LEVEL_XP_PER_LETTER } from './xp.js';
import { markXpBoost, letterXpNow } from './letterXp.js';
import { markBaseXp, wornMarkId, markEntry, indexMult, loadRollState } from './markRollsCore.js';
import { letterPerkMult } from './markPerks.js';
import { boostMult } from './boost.js';
import { keyRarity, rebirthRarity, rarityKey } from '../lib/rarityStyle.js';
import { formatNum, formatMultExact } from '../format.js';

export const BOARD_MODE = 'wordBomb'; // the reference mode (MODE ×1)
/** The MODE chip's tag, by payout key. */
export const BOARD_MODE_NAMES = { wordBomb: 'WORD BOMB', blitz: 'BLITZ', wordRace: 'WORD RACE', chain: 'CHAIN', satRush: 'SAT RUSH', fuse: 'FUSE' };

const pos = (v, d = 1) => (Number.isFinite(v) && v > 0 ? v : d);

/** The worn mark's rarity key (null with nothing worn). PERMANENT reads as legendary (rarityKey). */
function wornTier() {
  try {
    const id = wornMarkId();
    const e = id ? markEntry(id) : null;
    return e ? rarityKey(e.tier) : null;
  } catch {
    return null;
  }
}

/**
 * The two stacks. Each is { id, base, lines: [{ id, label, mult, tier }], total }.
 *   base  — the BASE before every multiplier (10 + the worn mark's +N)
 *   lines — one per multiplier, in Andy's order; `tier` is a rarity key for the line's colour (or null)
 *   total — what the game pays right now (perWordRateNow().rate / letterXpNow())
 */
export function statBoard({ mode = BOARD_MODE } = {}) {
  const kt = getKeyTier();
  const rc = getRebirths();
  const markTier = wornTier();
  const rbTier = rebirthRarity(rc);
  // THE INDEX (% of the rollable marks owned, +0.5% per %) multiplies wins AND XP inside markWinsMult / markXpMult.
  // It is its own line (numbers audit, Andy item 5: "BASE × each multiplier"), so MARK is the worn mark alone.
  let index = 1;
  try {
    index = pos(indexMult(loadRollState()));
  } catch {
    index = 1;
  }

  // WINS / WORD — the payout's own factor object, so every line is a number the payout multiplies by. MODE is a
  // line (the reference word is 5 letters, so length/5 = ×1 and needs none).
  const f = perWordFactors({ mode });
  const winsBase = wordWinsBase({ wordLength: WORD_LEN_REF });
  const wins = {
    id: 'wins',
    mode,
    base: winsBase,
    lines: [
      { id: 'mode', label: 'MODE', mult: pos(f.mode), tier: null },
      { id: 'rebirth', label: 'REBIRTH', mult: pos(f.rebirth), tier: rbTier },
      { id: 'mark', label: 'MARK', mult: pos(f.bonus) / index, tier: markTier },
      { id: 'index', label: 'INDEX', mult: index, tier: null },
      { id: 'boost', label: 'BOOST', mult: pos(f.boost) * pos(f.frenzy), tier: null },
    ],
    total: perWordRateNow({ mode }).rate,
  };

  // XP / LETTER — levelXpPerLetter's terms × letterXpNow's two outer factors
  const xp = {
    id: 'xp',
    base: LEVEL_XP_PER_LETTER + Math.max(0, Number(markBaseXp()) || 0),
    lines: [
      { id: 'key', label: 'POWER', mult: pos(keyXpMult(kt)), tier: keyRarity(kt), keyTier: kt },
      { id: 'rebirth', label: 'REBIRTH', mult: pos(rebirthXpMult(rc)), tier: rbTier },
      { id: 'mark', label: 'MARK', mult: (pos(markXpBoost()) / index) * pos(letterPerkMult()), tier: markTier },
      { id: 'index', label: 'INDEX', mult: index, tier: null },
      { id: 'boost', label: 'BOOST', mult: pos(boostMult()), tier: null },
    ],
    total: letterXpNow(),
  };
  return { wins, xp };
}

/** BASE × every line — what the lines claim. Equals `total` up to the payout's whole-XP grid (tests). */
export function boardProduct(stack) {
  return stack.lines.reduce((p, l) => p * l.mult, stack.base);
}

/**
 * A board multiplier: exact to three decimals below ×10, two below ×10,000, formatNum's abbreviation from there.
 * NUMBERS AUDIT (Andy item 5: "the math must multiply out"): this used to round to a whole number from ×10, so
 * POWER 3 (2.5³ = 15.625) printed ×16 and BASE 10 × 16 did not make the 156.3 XP / LETTER beside it.
 */
export function boardMult(v) {
  const n = Number.isFinite(v) ? v : 0;
  if (Math.abs(n) >= 10000) return formatNum(n);
  // below ×10 a third decimal when it is real (the INDEX's ×1.003 must not print as a lit "×1")
  const txt = Math.abs(n) < 10 ? String(Math.round(Number((n * 1000).toPrecision(12))) / 1000) : formatMultExact(n);
  const [i, d] = txt.split('.');
  return i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (d ? `.${d}` : ''); // ×1,024 — grouped like formatNum
}

/**
 * THE CHAIN (P8, claude/mockups/v2/Stats.dc.html) — a stack as the v2 STATS screen plays it: BASE, then one chip per
 * multiplier in the mockup's order, ending at the TOTAL multiplier (Balatro-style: the total first, then the chain
 * that makes it). PURE over a statBoard() stack + the v3 numbers it is handed.
 *
 * SEASON 2 (`v3` given — the V3 holder from season.js): v3 folds ★ into the REBIRTH factor (2^R × (1 + ★)) and the
 * XP base is v3's own (econ.XP_BASE, not the live 10), so the chain splits REBIRTH into REBIRTH 2^R + ASCEND (1 + ★),
 * rebases XP on econ.XP_BASE + the worn mark's +N, and names the SHOP STOCK's timed XP multiplier when one runs.
 * With the flag off (no `v3`) the chain is the stack's own lines. Either way BASE × every chip = TOTAL
 * (statBoard.test.js / statChain.s2.test.js).
 *
 * Returns { id, base, total, mult, chips: [{ id, label, mult, tag }] } — `mult` = TOTAL / BASE.
 */
export function statChain(stack, { v3 = null, stars = 0, markBaseXp: mbx = 0, tags = {} } = {}) {
  const line = (id) => stack.lines.find((l) => l.id === id) || { mult: 1 };
  const st = Number.isFinite(stars) && stars > 0 ? Math.floor(stars) : 0;
  const starM = v3 ? v3.econ.starMult(st) : 1;
  const chip = (id, label, mult) => ({ id, label, mult: pos(mult), tag: tags[id] || '' });
  // FINAL's order (Andy item 5): … × REBIRTH 2^R × STARS (1 + ★) × MARK … — STARS sits right after REBIRTH (v3 folds
  // it into the REBIRTH factor, so the chain splits it back out). INDEX is shown only while it pays (×1 = no marks).
  const rebirthChips = [chip('rebirth', 'REBIRTH', line('rebirth').mult / starM)];
  if (v3 && v3.econ.ASCENSION_ON) rebirthChips.push(chip('ascend', 'STARS', starM)); // FINAL v2: ascension hidden → no STARS chip
  const tail = [chip('mark', 'MARK', line('mark').mult)];
  if (line('index').mult !== 1) tail.push(chip('index', 'INDEX', line('index').mult));
  tail.push(chip('boost', 'BOOST', line('boost').mult));
  let base = stack.base;
  let chips;
  if (stack.id === 'wins') {
    chips = [chip('mode', 'MODE', line('mode').mult), ...rebirthChips, ...tail];
  } else {
    chips = [chip('power', 'POWER', line('key').mult), ...rebirthChips, ...tail];
    if (v3) {
      base = v3.econ.XP_BASE + Math.max(0, Number(mbx) || 0);
      const shop = v3.stock && typeof v3.stock.stockXpMult === 'function' ? pos(v3.stock.stockXpMult()) : 1;
      if (shop !== 1) chips.push(chip('shop', 'UPGRADES', shop));
    }
  }
  return { id: stack.id, base, total: stack.total, mult: base > 0 ? stack.total / base : 1, chips };
}
