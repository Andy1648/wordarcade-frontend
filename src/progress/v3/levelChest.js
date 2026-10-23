// v3/levelChest.js — LEVEL CHESTS (Andy oct22: "every 5th level pays a small gem chest (sim it so it doesn't flood gems),
// and show it on the plate"). Season-2 levels paid nothing (LEVEL_UP = 0 since oct11, "the gems are coming in way too
// quickly"), so the XP bar's goal plate had no reward to show. Now every 5th level of a climb pays a small chest, the FIRST
// time that climb reaches it (a rebirth starts a new climb, like LV_GEMS_KEY), capped per day so play speed can't flood gems:
//   the FINAL sim (claude/econ-oct2/final-sim.mjs, 10 h) crosses ~34 (casual) / ~73 (median) / ~200 (fast) 5th-levels, so
//   an UNCAPPED 10-gem chest would pay the fast player ~6x the median; the cap holds every player at ≤ 100 gems/day
//   (≈ 1.3 rolls at 75) — the same order as the daily contracts (150/day), never more.
// Storage: taw.s2.lvchest = { day: 'YYYY-MM-DD' (local), n: chests paid that day }. Pure helpers take `now` + storage.
// A LEAF (no imports): the menu reads it for the XP bar's plate, so it must not pull the season-2 store into first paint.
const S2_PREFIX = 'taw.s2.'; // = v3/store.js S2_PREFIX (levelChest.test pins the match)

export const LEVEL_CHEST_EVERY = 5;
export const LEVEL_CHEST_GEMS = 10;
export const LEVEL_CHEST_DAILY = 10; // chests per local day (= 100 gems)
export const LEVEL_CHEST_KEY = `${S2_PREFIX}lvchest`;

const store = (s) => s || (typeof localStorage !== 'undefined' ? localStorage : null);
/** Local calendar day of `now` (the cap resets at local midnight). */
export function chestDay(now = Date.now()) {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function readDay(now, s) {
  try {
    const o = JSON.parse(store(s)?.getItem(LEVEL_CHEST_KEY) || 'null');
    return o && o.day === chestDay(now) && Number.isFinite(o.n) ? Math.max(0, Math.floor(o.n)) : 0;
  } catch { return 0; }
}
/** Chests still payable today. */
export function chestsLeftToday(now = Date.now(), s) {
  return Math.max(0, LEVEL_CHEST_DAILY - readDay(now, s));
}
/** Is `level` a chest level (5, 10, 15 …)? */
export const isChestLevel = (level) => Number.isFinite(level) && level > 0 && Math.floor(level) % LEVEL_CHEST_EVERY === 0;
/** How many chest levels lie in (fromPeak, toLevel] — the levels this climb is reaching for the first time. */
export function chestLevelsBetween(fromPeak, toLevel) {
  const a = Math.max(0, Math.floor(Number(fromPeak) || 0));
  const b = Math.floor(Number(toLevel) || 0);
  if (!(b > a)) return 0;
  return Math.floor(b / LEVEL_CHEST_EVERY) - Math.floor(a / LEVEL_CHEST_EVERY);
}
/**
 * Pay the chests a climb just reached (fromPeak → toLevel, first time this climb), up to today's cap. Records the day's
 * count and returns the GEMS to grant (0 when none / capped). The caller grants them (one grantGems, reason 'level').
 */
export function takeLevelChests(fromPeak, toLevel, now = Date.now(), s) {
  const want = chestLevelsBetween(fromPeak, toLevel);
  if (!want) return 0;
  const paid = Math.min(want, chestsLeftToday(now, s));
  if (!paid) return 0;
  try { store(s)?.setItem(LEVEL_CHEST_KEY, JSON.stringify({ day: chestDay(now), n: readDay(now, s) + paid })); } catch { /* blocked storage: pays once anyway */ }
  return paid * LEVEL_CHEST_GEMS;
}
/**
 * What the NEXT level pays, for the XP bar's goal plate: LEVEL_CHEST_GEMS when `nextLevel` is a chest level this climb
 * has not reached yet (`peak` = the climb's highest level so far) and today's cap has room, else 0.
 */
export function nextLevelChest(nextLevel, peak, now = Date.now(), s) {
  if (!isChestLevel(nextLevel)) return 0;
  if (Number.isFinite(peak) && nextLevel <= peak) return 0;
  return chestsLeftToday(now, s) > 0 ? LEVEL_CHEST_GEMS : 0;
}
/** This climb's highest level so far (v3/hooks LV_GEMS_KEY = { r, peak }), or null when the save is on a new climb. */
export function climbPeak(rebirths, s) {
  try {
    const st = JSON.parse(store(s)?.getItem(`${S2_PREFIX}lvgems`) || 'null');
    return st && st.r === rebirths && Number.isFinite(st.peak) ? st.peak : null;
  } catch { return null; }
}
