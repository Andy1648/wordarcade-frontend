// v3/achievements.js — ACHIEVEMENTS (season 2): EVERY claim lives here and pays GEMS (40–200, progression-v3.md
// "GEMS / ROLLS"). The menu shows no claim popups any more (Andy phase 3: "remove ALL menu claim notifications");
// the player opens ACHIEVEMENTS (claude/mockups/v2/Achievements.dc.html) and claims tier by tier.
//
// Each achievement is a LADDER of tiers (I–V). `T` = the count each tier needs, `R` = the gems it pays. The
// thresholds are the mockup's; the rewards are rescaled from the mockup's 35–875 into the spec's 40–200 band.
// Counts are SEASON-2 play only (v3/store.js counters), so an old save brings no free gems.
//   TYPE WORDS        accepted words                  (wins.awardWordXp)
//   BEAT BOTS         games won against bots          (gems.payGameResult)
//   REBIRTH           rebirths, all climbs            (xp.doRebirth)
//   ROLL EPIC+        EPIC-or-better mark rolls       (markRollShop.buyMarkRoll)
//   WIN MULTIPLAYER   games won against people        (gems.payGameResult)
//   CHAIN             the longest CHAIN run (words)   (wins.bankWordWins)
//   FILL INDEX        distinct marks rolled           (markRollShop.buyMarkRoll)
//   POWER LEVEL       the highest POWER bought        (shop.buyKeyPower)
// Imports only leaves (store.js, gemsCore.js, econ.js, markPerks.js).
import { readCounters, readClaimed, writeClaimed } from './store.js';
import { grantGems } from '../gemsCore.js';
import { ACH_MIN, ACH_MAX } from './econ.js';
import { REMOVED_COMMON_IDS, RETIRED_COMMON_IDS } from '../markPerks.js';

// GEAR POOL v2: a retired COMMON found before the change no longer counts toward FILL INDEX (27 = every gear now)
const GONE = new Set([...REMOVED_COMMON_IDS, ...RETIRED_COMMON_IDS]);

const R5 = [40, 60, 90, 130, 200];
export const ACHIEVEMENTS_V3 = [
  { id: 'type', name: 'TYPE WORDS', g: 'key', counter: 'words', T: [100, 1000, 5000, 25000, 100000], R: R5 },
  { id: 'bots', name: 'BEAT BOTS', g: 'bot', counter: 'bots', T: [10, 50, 250, 1000, 5000], R: R5 },
  { id: 'reb', name: 'REBIRTH', g: 'loop', counter: 'reb', T: [5, 25, 100, 500, 2500], R: [50, 75, 110, 150, 200] },
  // `what` (Andy oct8 "what is CHAIN 35?"): one line for the ladders whose name alone does not say what counts
  { id: 'roll', name: 'ROLL EPIC+', g: 'die', counter: 'epic', T: [3, 15, 75, 300, 1500], R: R5, what: 'EPIC+ GEAR ROLLS' },
  { id: 'win', name: 'WIN MULTIPLAYER', g: 'cup', counter: 'mp', T: [5, 25, 100, 500, 2000], R: [45, 70, 100, 150, 200] },
  { id: 'chain', name: 'CHAIN', g: 'chain', counter: 'chain', T: [5, 10, 20, 35, 50], R: R5, tagNum: true, what: 'WORDS IN A ROW' },
  { id: 'index', name: 'FILL INDEX', g: 'cards', counter: 'marks', T: [3, 6, 27], R: [60, 120, 200], what: 'GEARS FOUND' },
  { id: 'power', name: 'POWER LEVEL', g: 'chev', counter: 'power', T: [3, 6, 10, 25, 50], R: R5, what: 'POWER BOUGHT' },
];
export const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

const have = (c, a) => (a.counter === 'marks' ? c.marks.filter((id) => !GONE.has(id)).length : c[a.counter] || 0);

/**
 * PURE: every achievement's row for given counters + claimed tiers.
 * → [{ id, name, g, tier (claimed so far), maxed, have, need, reward, ready, pct, tiers }]
 */
export function achRows(counters, claimed) {
  return ACHIEVEMENTS_V3.map((a) => {
    const t = Math.min(a.T.length, Number.isFinite(claimed[a.id]) ? claimed[a.id] : 0);
    const maxed = t >= a.T.length;
    const h = have(counters, a);
    const need = a.T[Math.min(t, a.T.length - 1)];
    const ready = !maxed && h >= need;
    return {
      id: a.id, name: a.name, g: a.g, tagNum: !!a.tagNum, what: a.what || '', T: a.T, R: a.R,
      tier: t, tiers: a.T.length, maxed, have: h, need,
      reward: maxed ? 0 : a.R[t], ready,
      pct: maxed ? 100 : Math.min(100, (h / need) * 100),
    };
  });
}
/** The live rows (season-2 counters + claims). */
export function achievementsV3() {
  return achRows(readCounters(), readClaimed());
}
/** How many tiers are claimable right now. */
export function readyCountV3() {
  return achievementsV3().filter((r) => r.ready).length;
}
/** { done, all } — tiers claimed / tiers in total. */
export function tierCountsV3() {
  const claimed = readClaimed();
  let done = 0;
  let all = 0;
  for (const a of ACHIEVEMENTS_V3) {
    all += a.T.length;
    done += Math.min(a.T.length, claimed[a.id] || 0);
  }
  return { done, all };
}
/**
 * CLAIM one tier of `id`: pays its gems (gemsCore.grantGems, reason 'achievement') and moves the ladder up one.
 * Returns { ok, gems, tier } — ok:false when it is not ready (or maxed, or unknown). One tier per call.
 */
export function claimAchievementV3(id) {
  const a = ACHIEVEMENTS_V3.find((x) => x.id === id);
  if (!a) return { ok: false, reason: 'unknown' };
  const claimed = readClaimed();
  const row = achRows(readCounters(), claimed).find((r) => r.id === id);
  if (!row || !row.ready) return { ok: false, reason: row && row.maxed ? 'maxed' : 'not_ready' };
  const gems = Math.max(ACH_MIN, Math.min(ACH_MAX, row.reward));
  claimed[id] = row.tier + 1;
  if (!writeClaimed(claimed)) return { ok: false, reason: 'storage' };
  grantGems(gems, 'achievement', { detail: `ach-${id}-${row.tier + 1}` });
  return { ok: true, gems, tier: row.tier + 1 };
}
