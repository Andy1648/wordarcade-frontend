// statBoard.js — the STAT BOARD (Andy oct5, Keyboard Escape / Genshin): "BASE big, then each multiplier on its own
// line (KEY ×, REBIRTH ×, MARK ×, BOOST ×), then TOTAL huge. For both wins/word and XP/letter."
//
// Two stacks, read from the live save:
//   WINS / WORD  = BASE (10 + the worn mark's +N BASE WINS) × REBIRTH 5^R × MARK × BOOST     (Word Bomb, 5-letter ref)
//   XP / LETTER  = BASE (10 + the worn mark's +N BASE XP)   × KEY × REBIRTH 5^R × MARK × BOOST
//
// HONESTY: TOTAL is NOT this module's product — it is the number the game pays (wins.perWordRateNow and
// letterXp.letterXpNow). The lines are read from the SAME factor sources the payout reads (perWordFactors /
// wordWinsBase for wins; keyXpMult / rebirthXpMult / markXpBoost / letterPerkMult / boostMult for XP), and
// statBoard.test.js asserts BASE × every line = TOTAL across saves. So the board cannot claim a bonus the
// game does not pay.
//
// The reference is Word Bomb (MODE ×1) on a 5-letter word (length/5 = ×1), so neither needs a line. KEY does not
// touch wins (Rebirth Rush), so the wins stack has no KEY line. FRENZY (FUSE's ×5, every mode under the ORIGIN
// perk) is a timed multiplier like BOOST and rides the BOOST line; the DOUBLE LETTERS perk is the worn mark's and
// rides the MARK line.
import { perWordFactors, perWordRateNow, wordWinsBase, WORD_LEN_REF } from './wins.js';
import { keyXpMult, rebirthXpMult, getKeyTier, getRebirths, LEVEL_XP_PER_LETTER } from './xp.js';
import { markXpBoost, letterXpNow } from './letterXp.js';
import { markBaseXp, wornMarkId, markEntry } from './markRollsCore.js';
import { letterPerkMult } from './markPerks.js';
import { boostMult } from './boost.js';
import { keyRarity, rebirthRarity, rarityKey } from '../lib/rarityStyle.js';
import { formatNum, formatMultExact } from '../format.js';

export const BOARD_MODE = 'wordBomb'; // the reference mode (MODE ×1)

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
export function statBoard() {
  const kt = getKeyTier();
  const rc = getRebirths();
  const markTier = wornTier();
  const rbTier = rebirthRarity(rc);

  // WINS / WORD — the payout's own factor object, so every line is a number the payout multiplies by
  const f = perWordFactors({ mode: BOARD_MODE });
  const winsBase = wordWinsBase({ wordLength: WORD_LEN_REF });
  const wins = {
    id: 'wins',
    base: winsBase,
    lines: [
      { id: 'rebirth', label: 'REBIRTH', mult: pos(f.rebirth), tier: rbTier },
      { id: 'mark', label: 'MARK', mult: pos(f.bonus), tier: markTier },
      { id: 'boost', label: 'BOOST', mult: pos(f.boost) * pos(f.frenzy), tier: null },
    ],
    total: perWordRateNow({ mode: BOARD_MODE }).rate,
  };

  // XP / LETTER — levelXpPerLetter's terms × letterXpNow's two outer factors
  const xp = {
    id: 'xp',
    base: LEVEL_XP_PER_LETTER + Math.max(0, Number(markBaseXp()) || 0),
    lines: [
      { id: 'key', label: 'POWER', mult: pos(keyXpMult(kt)), tier: keyRarity(kt), keyTier: kt },
      { id: 'rebirth', label: 'REBIRTH', mult: pos(rebirthXpMult(rc)), tier: rbTier },
      { id: 'mark', label: 'MARK', mult: pos(markXpBoost()) * pos(letterPerkMult()), tier: markTier },
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
 * A board multiplier: two decimals below ×10 (a named factor, printed exactly — formatMultExact), a whole number
 * from ×10 (no "×27.98"), and formatNum's abbreviation from ×10,000.
 */
export function boardMult(v) {
  const n = Number.isFinite(v) ? v : 0;
  return Math.abs(n) >= 10 ? formatNum(n) : formatMultExact(n);
}
