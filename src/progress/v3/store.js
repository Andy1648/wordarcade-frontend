// v3/store.js — the SEASON-2-ONLY stores (taw.s2.*). Every write is a no-op with the SEASON2 flag OFF, so the live
// game never grows these keys. Every access is guarded (blocked storage reads as fresh, never throws).
// LEAF: imports only season.js.
//
//   taw.s2.stars     ★ STARS — the int an ascension adds (R − 9); multiplies XP and wins by (1 + ★)
//   taw.s2.count     the ACHIEVEMENTS counters (season-2 play only): words, bots, mp, reb, epic, chain, power, marks[]
//   taw.s2.ach       claimed ACHIEVEMENT tiers: { id: tiers claimed }
//   taw.s2.rank      the best RANK index reached (ranks never drop)
//   taw.s2.mark2     the 2nd MARK slot's worn mark id (R5 unlock)
import { SEASON2 } from '../season.js';

export const S2_PREFIX = 'taw.s2.'; // every season-2 key

export const STARS_KEY = `${S2_PREFIX}stars`;
export const COUNT_KEY = `${S2_PREFIX}count`;
export const ACH_KEY = `${S2_PREFIX}ach`;
export const RANK_KEY = `${S2_PREFIX}rank`;
export const MARK2_KEY = `${S2_PREFIX}mark2`;

const int0 = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};
function get(k) {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function set(k, v) {
  if (!SEASON2) return false;
  try {
    localStorage.setItem(k, v);
    return true;
  } catch {
    return false;
  }
}
function json(k, fallback) {
  try {
    const o = JSON.parse(get(k) || 'null');
    return o && typeof o === 'object' ? o : fallback;
  } catch {
    return fallback;
  }
}

// ---- ★ STARS ----------------------------------------------------------------------------------------------
/** ★ (0 with the flag OFF — the live game has no v3 stars). */
export function getStarsV3() {
  return SEASON2 ? int0(get(STARS_KEY)) : 0;
}
export function saveStarsV3(n) {
  return set(STARS_KEY, String(int0(n)));
}

// ---- ACHIEVEMENT counters ---------------------------------------------------------------------------------
export const COUNTERS = ['words', 'bots', 'mp', 'reb', 'epic', 'chain', 'power'];
export function readCounters() {
  const o = json(COUNT_KEY, {});
  const out = {};
  for (const k of COUNTERS) out[k] = int0(o[k]);
  out.marks = Array.isArray(o.marks) ? o.marks.filter((x) => typeof x === 'string').slice(0, 500) : [];
  return out;
}
/** Fired on window whenever a counter or a claimed tier is written — the menu trophy's dot re-reads on it. */
export const ACH_CHANGE = 'taw:ach-change';
function achChanged() {
  try {
    window.dispatchEvent(new Event(ACH_CHANGE));
  } catch {
    /* no window (node sims / tests) */
  }
}
function writeCounters(c) {
  const ok = set(COUNT_KEY, JSON.stringify(c));
  if (ok) achChanged();
  return ok;
}
/** counters[k] += n (season 2 only). */
export function bumpCounter(k, n = 1) {
  if (!SEASON2 || !COUNTERS.includes(k)) return;
  const c = readCounters();
  c[k] += int0(n);
  writeCounters(c);
}
/** counters[k] = max(counters[k], v) (season 2 only). */
export function maxCounter(k, v) {
  if (!SEASON2 || !COUNTERS.includes(k)) return;
  const c = readCounters();
  const n = int0(v);
  if (n <= c[k]) return;
  c[k] = n;
  writeCounters(c);
}
/** A mark id rolled this season (FILL INDEX counts distinct ones). */
export function noteMarkSeen(id) {
  if (!SEASON2 || typeof id !== 'string' || !id) return;
  const c = readCounters();
  if (c.marks.includes(id)) return;
  c.marks.push(id);
  writeCounters(c);
}

// ---- claimed achievement tiers ------------------------------------------------------------------------------
export function readClaimed() {
  const o = json(ACH_KEY, {});
  const out = {};
  for (const [k, v] of Object.entries(o)) out[k] = int0(v);
  return out;
}
export function writeClaimed(o) {
  const ok = set(ACH_KEY, JSON.stringify(o));
  if (ok) achChanged();
  return ok;
}

// ---- best rank (monotonic) ----------------------------------------------------------------------------------
export function bestRankIndex() {
  return SEASON2 ? int0(get(RANK_KEY)) : 0;
}
export function noteRankIndex(i) {
  if (!SEASON2) return;
  if (int0(i) > bestRankIndex()) set(RANK_KEY, String(int0(i)));
}

// ---- the 2nd MARK slot (R5) -------------------------------------------------------------------------------------
export function mark2Id() {
  if (!SEASON2) return null;
  const v = get(MARK2_KEY);
  return typeof v === 'string' && v ? v : null;
}
export function saveMark2Id(id) {
  if (!SEASON2) return false;
  if (id == null) {
    try {
      localStorage.removeItem(MARK2_KEY);
      return true;
    } catch {
      return false;
    }
  }
  return set(MARK2_KEY, String(id));
}

/** The live season-2 rebirth count (taw.s2.rebirths), read here so leaf modules need not import xp.js. */
export function s2Rebirths() {
  return SEASON2 ? int0(get(`${S2_PREFIX}rebirths`)) : 0;
}
