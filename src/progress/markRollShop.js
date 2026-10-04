// markRollShop.js — the ONE place a MARK ROLL is paid for (the roll UI calls only this). markRolls.js
// is pure + its own store and never touches the balance; this module charges the price through the
// one wins channel (wins.js saveWins), rolls, pays any INDEX milestone lump, and returns the result
// plus what the UI should do about equipping it.
import { getWins, saveWins, grantWins } from './wins.js';
import { getEquippedMark, equipMark } from './marks.js';
import {
  ensureRollState, loadRollState, saveRollState, rollAndSave, rollPriceNow, rollPriceWords, refWordWins,
  milestoneWins, rollMarkById, equipRolled, equipDecision, wornMarkId, mainMultOf, wornMainOf, tierRank,
} from './markRolls.js';
import { rollsPerRoll } from './markPerks.js';
import { isBoostActive } from './boost.js';

/** What the next roll costs: { free, wins, words }. The first roll on a save is the free starter. */
export function nextRollCost(level = 1, state = loadRollState()) {
  const free = !(state && state.starter);
  return { free, wins: free ? 0 : rollPriceNow(level), words: Math.round(rollPriceWords(level)) };
}

/** The worn MAIN right now (tier × its GOLD / RAINBOW finish). */
export function currentMain() {
  const id = getEquippedMark() || wornMarkId();
  return { id, main: id ? mainMultOf(id) : 1 };
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
 * { ...result, spent, free, decision: 'auto'|'none', fromMain, toMain, lump, extra }.
 * DOUBLE ROLLS (SINGULARITY perk): one price, two results — the RAREST is the shown result (ties: the later),
 * the other rides along in `extra` (both are saved; pity and the index count both).
 * It does NOT equip: the UI applies an 'auto' decision (applyRollEquip) when the reveal LANDS, so the
 * hero and the menu chip never change before the player has seen the result.
 */
export function buyMarkRoll({ level = 1, rng = Math.random } = {}) {
  const st = ensureRollState();
  const cost = nextRollCost(level, st);
  const bal = getWins();
  if (!cost.free && bal < cost.wins) return null;
  if (!cost.free) saveWins(bal - cost.wins);
  const n = rollsPerRoll();
  const all = [];
  for (let i = 0; i < n; i += 1) all.push(rollAndSave(rng, { boost: isBoostActive() }));
  if (cost.free) saveRollState({ ...loadRollState(), starter: true });
  let res = all[0];
  for (const r of all) if (tierRank(r.tier) >= tierRank(res.tier)) res = r;
  const extra = all.filter((r) => r !== res);
  // INDEX milestones pay a lump in words at your rate (≤ 20 words each)
  let lump = 0;
  const ms = all.flatMap((r) => r.milestones);
  if (ms.length) {
    const rate = refWordWins();
    for (const id of ms) {
      const w = milestoneWins(id, rate);
      if (w > 0) { grantWins(w, 'MARKS INDEX', { detail: 'index' }); lump += w; }
    }
  }
  const worn = currentMain();
  const decision = equipDecision(res.markId, worn.id, worn.main);
  const fromMain = worn.id ? worn.main : wornMainOf(null);
  const toMain = mainMultOf(res.markId);
  return { ...res, state: all[all.length - 1].state, spent: cost.wins, free: cost.free, decision, fromMain, toMain, lump, extra };
}

/**
 * ×N ROLL (Andy: "×10 roll button"). Priced at exactly N × the single paid roll; refused (null) when the
 * balance can't pay all N, or while the free starter roll is still waiting (take that one first). Each of the
 * N is a full buyMarkRoll — so pity, luck, the ×2 LUCK roll, DOUBLE ROLLS and INDEX lumps all apply PER ROLL,
 * through the one rollAndSave. Returns the N results in roll order.
 */
export function buyMarkRolls(count = 10, { level = 1, rng = Math.random } = {}) {
  const n = Math.max(1, Math.floor(count));
  const c = nextRollCost(level);
  if (c.free) return null;
  if (getWins() < c.wins * n) return null;
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const r = buyMarkRoll({ level, rng });
    if (!r) break;
    out.push(r);
  }
  return out.length ? out : null;
}

/** Land a roll's equip decision (called when its reveal lands). Re-checks against the MAIN worn NOW, so
 *  an equip the player made meanwhile is never overwritten by a lower mark. Returns the worn id or null. */
export function applyRollEquip(res, earned = []) {
  if (!res) return null;
  const worn = currentMain();
  if (equipDecision(res.markId, worn.id, worn.main) !== 'auto') return null;
  return wearMark(res.markId, earned);
}
