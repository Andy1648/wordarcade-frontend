// markRollShop.js — the ONE place a MARK ROLL is paid for (the roll UI calls only this). markRolls.js
// is pure + its own store and never touches the balance; this module charges the price through the
// one wins channel (wins.js saveWins), rolls, pays any INDEX milestone lump, and returns the result
// plus what the UI should do about equipping it. Spec: claude/econ-oct2/marks-spec.md §3, §6, §8.
import { getWins, saveWins, grantWins } from './wins.js';
import { getEquippedMark, markById, markMainMult, markRank, equipMark } from './marks.js';
import {
  ensureRollState, loadRollState, saveRollState, rollAndSave, rollPriceNow, rollPriceWords, refWordWins,
  milestoneWins, rollMarkById, equipRolled, equipDecision, wornMarkId, mainMultOf, wornMainOf,
} from './markRolls.js';
import { isBoostActive } from './boost.js';

/** What the next roll costs: { free, wins, words }. The first roll on a save is the free starter. */
export function nextRollCost(level = 1, state = loadRollState()) {
  const free = !(state && state.starter);
  return { free, wins: free ? 0 : rollPriceNow(level), words: Math.round(rollPriceWords(level)) };
}

/** The worn MAIN right now, at its real rank for a legacy mark. */
export function currentMain() {
  const legacy = getEquippedMark();
  if (legacy) {
    const m = markById(legacy);
    return { id: legacy, main: markMainMult(m, markRank(legacy)) };
  }
  const rolled = wornMarkId();
  return { id: rolled, main: rolled ? mainMultOf(rolled) : 1 };
}

/** Wear a mark (legacy ids through marks.js, rolled ids through markRolls). Returns the worn id. */
export function wearMark(id, earned = []) {
  if (id == null) return equipMark(null, earned);
  const r = rollMarkById(id);
  if (r && !r.legacy) return equipRolled(id) ? id : wornMarkId();
  return equipMark(id, earned);
}

/**
 * ONE paid (or free starter) roll. Returns null when the balance is short, else
 * { ...result, spent, free, decision: 'auto'|'none', fromMain, toMain, lump }.
 * It does NOT equip: the UI applies an 'auto' decision (applyRollEquip) when the reveal LANDS, so the
 * hero and the menu chip never change before the player has seen the result.
 */
export function buyMarkRoll({ level = 1, rng = Math.random } = {}) {
  const st = ensureRollState();
  const cost = nextRollCost(level, st);
  const bal = getWins();
  if (!cost.free && bal < cost.wins) return null;
  if (!cost.free) saveWins(bal - cost.wins);
  const res = rollAndSave(rng, { boost: isBoostActive() });
  if (cost.free) saveRollState({ ...loadRollState(), starter: true });
  // INDEX milestones pay a lump in words at your rate (≤ 20 words each, spec §6)
  let lump = 0;
  if (res.milestones.length) {
    const rate = refWordWins();
    for (const id of res.milestones) {
      const w = milestoneWins(id, rate);
      if (w > 0) { grantWins(w, 'MARKS INDEX', { detail: 'index' }); lump += w; }
    }
  }
  const worn = currentMain();
  const decision = equipDecision(res.markId, worn.id, worn.main);
  const fromMain = worn.id ? worn.main : wornMainOf(null);
  const toMain = mainMultOf(res.markId);
  return { ...res, spent: cost.wins, free: cost.free, decision, fromMain, toMain, lump };
}

/** Land a roll's equip decision (called when its reveal lands). Re-checks against the MAIN worn NOW, so
 *  an equip the player made meanwhile is never overwritten by a lower mark. Returns the worn id or null. */
export function applyRollEquip(res, earned = []) {
  if (!res) return null;
  const worn = currentMain();
  if (equipDecision(res.markId, worn.id, worn.main) !== 'auto') return null;
  return wearMark(res.markId, earned);
}
