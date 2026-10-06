// markRollShop.js — the ONE place a MARK ROLL is paid for (the roll UI calls only this). markRolls.js
// is pure + its own store and never touches a balance; this module charges the price in GEMS (gems.js spendGems —
// Andy oct5: "Rolls cost 10 GEMS each. Wins never buy rolls."), rolls, pays the INDEX rewards (a new mark, a ★, a
// completed tier — WINS, words at your rate), and returns the result plus what the UI should do about equipping it.
// MARKS v2 (Andy oct5): no ×10 — AUTO ROLL "until [tier] or better" (autoRoll) rolls one at a time instead.
import { grantWins } from './wins.js';
import { getGems, spendGems, ROLL_PRICE_GEMS } from './gems.js';
import { getEquippedMark, equipMark } from './marks.js';
import {
  ensureRollState, loadRollState, saveRollState, rollAndSave, refWordWins,
  indexRewardWins, rollMarkById, equipRolled, equipDecision, wornMarkId, mainMultOf, wornMainOf, tierRank,
} from './markRolls.js';
import { rollsPerRoll } from './markPerks.js';
import { isBoostActive } from './boost.js';
// PROGRESSION v3 (SEASON2, default OFF): ROLL EPIC+ / FILL INDEX achievement counters, and the R2 AUTO ROLL unlock.
import { SEASON2, V3 } from './season.js'; // V3.store / V3.unlocks: installed lazily (season.js)

/** What the next roll costs: { free, gems }. The first roll on a save is the free starter. `level` is accepted for
 *  old callers and ignored (the price is flat). */
// eslint-disable-next-line no-unused-vars
export function nextRollCost(level = 1, state = loadRollState()) {
  const free = !(state && state.starter);
  return { free, gems: free ? 0 : ROLL_PRICE_GEMS };
}

/** The worn MAIN right now (its strength: tier × ★ pips × shiny). */
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
 * `lump` = the INDEX rewards it paid in wins (new mark / ★ / completed tier, every result incl. `extra`).
 * DOUBLE ROLLS (SINGULARITY perk): one price, two results — the RAREST is the shown result (ties: the later),
 * the other rides along in `extra` (both are saved; pity and the index count both).
 * It does NOT equip: the UI applies an 'auto' decision (applyRollEquip) when the reveal LANDS, so the
 * hero and the menu chip never change before the player has seen the result.
 */
export function buyMarkRoll({ level = 1, rng = Math.random } = {}) {
  const st = ensureRollState();
  const cost = nextRollCost(level, st);
  if (!cost.free && !spendGems(cost.gems)) return null; // short: nothing spent, nothing rolls
  const n = rollsPerRoll();
  const all = [];
  for (let i = 0; i < n; i += 1) all.push(rollAndSave(rng, { boost: isBoostActive() }));
  if (cost.free) saveRollState({ ...loadRollState(), starter: true });
  let res = all[0];
  for (const r of all) if (tierRank(r.tier) >= tierRank(res.tier)) res = r;
  if (SEASON2) {
    for (const r of all) {
      V3.store.noteMarkSeen(r.markId);
      if (tierRank(r.tier) >= tierRank('epic')) V3.store.bumpCounter('epic');
    }
  }
  const extra = all.filter((r) => r !== res);
  // INDEX rewards: words at your rate (the price's reference word), one labelled grant per roll
  let lump = 0;
  const rate = refWordWins();
  for (const r of all) {
    const w = indexRewardWins(r, rate);
    if (w > 0) {
      grantWins(w, 'MARKS INDEX', { detail: 'index' });
      lump += w;
    }
  }
  const worn = currentMain();
  const decision = equipDecision(res.markId, worn.id, worn.main);
  const fromMain = worn.id ? worn.main : wornMainOf(null);
  const toMain = mainMultOf(res.markId);
  return { ...res, state: all[all.length - 1].state, spent: cost.gems, free: cost.free, decision, fromMain, toMain, lump, extra };
}

/** The tiers AUTO ROLL can stop on ("until [tier] or better"). */
export const AUTO_ROLL_TIERS = ['rare', 'epic', 'legendary', 'mythic', 'secret'];
const AUTO_ROLL_CAP = 100000; // a hard stop so no loop can run away (the gems run out long before)

/**
 * AUTO ROLL (Andy oct5): roll ONE at a time through buyMarkRoll until a result (or its double-roll extra) is
 * `until` or better, or the GEMS run out (or `budget` gems have been spent). Each roll is a full
 * buyMarkRoll: price, pity, luck, double rolls, INDEX rewards. `onEach(result, i)` after every roll. Returns the
 * results in roll order ([] when the first can't be paid). Equips nothing (the UI lands each result).
 */
export function autoRoll({ until = 'epic', level = 1, rng = Math.random, onEach, budget = Infinity, max = AUTO_ROLL_CAP } = {}) {
  if (SEASON2 && !V3.unlocks.featureOpen('autoRoll')) return []; // v3: AUTO ROLL opens at R2
  const goal = tierRank(AUTO_ROLL_TIERS.includes(until) ? until : 'epic');
  const cap = Math.min(AUTO_ROLL_CAP, Math.max(0, Math.floor(Number.isFinite(max) ? max : AUTO_ROLL_CAP)));
  const out = [];
  let spent = 0;
  for (let i = 0; i < cap; i += 1) {
    const c = nextRollCost(level);
    if (!c.free && (spent + c.gems > budget || getGems() < c.gems)) break;
    const r = buyMarkRoll({ level, rng });
    if (!r) break;
    spent += r.spent;
    out.push(r);
    if (typeof onEach === 'function') onEach(r, out.length - 1);
    if ([r, ...(r.extra || [])].some((x) => tierRank(x.tier) >= goal)) break;
  }
  return out;
}

/** Land a roll's equip decision (called when its reveal lands). Re-checks against the MAIN worn NOW, so
 *  an equip the player made meanwhile is never overwritten by a lower mark. Returns the worn id or null. */
export function applyRollEquip(res, earned = []) {
  if (!res) return null;
  const worn = currentMain();
  if (equipDecision(res.markId, worn.id, worn.main) !== 'auto') return null;
  return wearMark(res.markId, earned);
}
