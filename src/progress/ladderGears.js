// ladderGears.js — the EARNED (achievement) gears, season 2 (Andy oct17: "getting the legendary gear would require like
// 100% done for an achievement"). Each one belongs to ONE achievement ladder (v3/achievements.js) and is yours the moment
// that ladder's LAST tier is claimed — 100% done. Ownership is DERIVED from the claimed tiers (no second store to drift),
// so a save that maxed a ladder before this existed simply has its gear. Tapping the gear opens its ladder.
//
// A LEAF (imports nothing): markRollsCore (eager — the payout reads the worn gear) and the v3 screens both read it.
// The tier counts mirror ACHIEVEMENTS_V3[].T.length (ladderGears.test.js keeps them equal).
export const LADDER_GEARS = Object.freeze([
  // ladder id → gear id, the ladder's tier count, the short 1–2 word name the achievement shows
  { ladder: 'type', gear: 'mk-ironhand', tiers: 5 },
  { ladder: 'bots', gear: 'mk-grandmaster', tiers: 5 },
  { ladder: 'reb', gear: 'mk-eternal', tiers: 5 },
  { ladder: 'roll', gear: 'mk-linguist', tiers: 5 },
  { ladder: 'win', gear: 'mk-legend', tiers: 5 },
  { ladder: 'chain', gear: 'mk-marathon', tiers: 5 },
  { ladder: 'index', gear: 'mk-curator', tiers: 3 },
  { ladder: 'power', gear: 'mk-omega', tiers: 5 },
]);
const BY_GEAR = new Map(LADDER_GEARS.map((r) => [r.gear, r]));
const BY_LADDER = new Map(LADDER_GEARS.map((r) => [r.ladder, r]));
export const ACH_CLAIMED_KEY = 'taw.s2.ach'; // = v3/store.js ACH_KEY (repeated so this stays a leaf)

/** The ladder an EARNED gear belongs to ({ ladder, gear, tiers }), or null. */
export function ladderOfGear(id) {
  return BY_GEAR.get(id) || null;
}
/** The EARNED gear a ladder pays at 100%, or null. */
export function gearOfLadder(ladder) {
  return (BY_LADDER.get(ladder) || {}).gear || null;
}
function readClaimed(storage) {
  try {
    const s = storage || (typeof window !== 'undefined' ? window.localStorage : null);
    const raw = s && s.getItem ? s.getItem(ACH_CLAIMED_KEY) : null;
    const o = raw ? JSON.parse(raw) : null;
    return o && typeof o === 'object' ? o : {};
  } catch {
    return {};
  }
}
/** The EARNED gear ids this save owns through a maxed ladder. */
export function ladderOwnedGears(storage) {
  const c = readClaimed(storage);
  return LADDER_GEARS.filter((r) => Number(c[r.ladder]) >= r.tiers).map((r) => r.gear);
}
export function ownsLadderGear(id, storage) {
  const r = BY_GEAR.get(id);
  return !!r && Number(readClaimed(storage)[r.ladder]) >= r.tiers;
}
