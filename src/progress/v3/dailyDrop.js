// v3/dailyDrop.js — THE DAILY FREE DROP (season 2 only; Andy's prototype scratchpad/shop/daily-drop.html, approved).
// The top tile of the UPGRADES screen: ONE free chest per LOCAL calendar day (it resets at local midnight).
//
//   TAP-CLIMB: the FINAL tier is rolled up front from the printed odds; the 4 taps only REVEAL the climb — each tap
//   stays or steps up one tier, starting from COMMON, and the 4th lands exactly on the rolled tier (planClimb).
//   The roll is saved on the FIRST tap, so closing the shop mid-climb (or reloading) replays the same tier: no rerolls.
//
//   ODDS + PAYS (only things that already exist; never wins — wins scale with rebirth):
//     COMMON     55%   +15 GEMS
//     RARE       28%   +30 GEMS
//     EPIC       12%   +60 GEMS
//     LEGENDARY   4%   +150 GEMS  — the prototype's "1 FREE EPIC+ ROLL" has no grant path yet (the STOCK 'epicroll' is
//                                    buyable:false and markRolls has no banked/forced roll), so it pays the gem fallback
//     MYTHIC      1%   ×10 OVERDRIVE · 5 MIN — the STOCK overdrive's own code path (stock.js grantOverdrive: slot 1,
//                                    time stacks, the multiplier never does)
//
// Store: taw.s2.drop = { day: 'YYYY-MM-DD' (local), claimed: bool, tier: index | null }. Every write is a no-op with
// the SEASON2 flag OFF (the live game never grows the key). Gems go through gemsCore.grantGems (the one door: the
// balance pill hears tellBalance). Installed into the V3 holder by install.js (V3.drop) — ShopV2 and the menu's
// UPGRADES dot read it there, so nothing here joins the eager index chunk.
import { SEASON2 } from '../season.js';
import { S2_PREFIX } from './store.js';
import { grantGems } from '../gemsCore.js';
import { grantOverdrive } from './stock.js';

export const DROP_KEY = `${S2_PREFIX}drop`;
/** Fired on window whenever the drop is written — the menu's UPGRADES dot re-reads on it. */
export const DROP_CHANGE = 'taw:drop-change';
export const TAPS = 4;

export const DROP_TIERS = [
  { id: 'common', name: 'COMMON', p: 55, color: '#A9B4C8', line: '#5f6a80', pay: { gems: 15 } },
  { id: 'rare', name: 'RARE', p: 28, color: '#3D8BFF', line: '#1d4fa8', pay: { gems: 30 } },
  { id: 'epic', name: 'EPIC', p: 12, color: '#B04BFF', line: '#6a1aa8', pay: { gems: 60 } },
  { id: 'legendary', name: 'LEGENDARY', p: 4, color: '#FFC23D', line: '#a87400', pay: { gems: 150 } },
  { id: 'mythic', name: 'MYTHIC', p: 1, color: '#FF4FA3', line: '#b0186a', pay: { overdrive: { mult: 10, min: 5 } } },
];

/** What a tier pays, as the tile prints it. */
export function payText(i) {
  const t = DROP_TIERS[i];
  if (!t) return '';
  if (t.pay.gems) return `+${t.pay.gems} GEMS`;
  const o = t.pay.overdrive;
  return `OVERDRIVE ×${o.mult} · ${o.min} MIN`;
}

/** The LOCAL calendar day of `now` ('YYYY-MM-DD'). */
export function dayKey(now = Date.now()) {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/** ms until the next LOCAL midnight (the reset). */
export function msToReset(now = Date.now()) {
  const m = new Date(now);
  m.setHours(24, 0, 0, 0);
  return Math.max(0, m.getTime() - now);
}
/** "13:42:07" — the reset countdown. */
export function formatCountdown(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const mi = Math.floor((s % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** The final tier from the printed odds (rng in [0, 1)). */
export function rollTier(rng = Math.random) {
  let r = Math.min(0.999999, Math.max(0, Number(rng()) || 0)) * 100;
  for (let i = 0; i < DROP_TIERS.length; i += 1) {
    r -= DROP_TIERS[i].p;
    if (r < 0) return i;
  }
  return 0;
}

/**
 * THE CLIMB the 4 taps reveal: the tier shown AFTER each tap, starting from COMMON (0). Each tap stays or steps up
 * exactly one tier; the last entry is always `final` (0 … 4 — there are 4 taps, so every tier is reachable).
 */
export function planClimb(final, rng = Math.random) {
  const f = Math.max(0, Math.min(DROP_TIERS.length - 1, Math.floor(Number(final) || 0)));
  const out = [];
  let tier = 0;
  let left = f;
  for (let i = 0; i < TAPS; i += 1) {
    const tapsLeft = TAPS - i;
    const up = left > 0 && (left >= tapsLeft || rng() < 0.55);
    if (up) {
      tier += 1;
      left -= 1;
    }
    out.push(tier);
  }
  return out;
}

// ---- the store --------------------------------------------------------------------------------------------------
function read() {
  try {
    const o = JSON.parse(localStorage.getItem(DROP_KEY) || 'null');
    return o && typeof o === 'object' ? o : null;
  } catch {
    return null;
  }
}
function write(o) {
  if (!SEASON2) return false;
  try {
    localStorage.setItem(DROP_KEY, JSON.stringify(o));
  } catch {
    return false;
  }
  try {
    window.dispatchEvent(new Event(DROP_CHANGE));
  } catch {
    /* no window (node tests) */
  }
  return true;
}
const validTier = (v) => (Number.isInteger(v) && v >= 0 && v < DROP_TIERS.length ? v : null);

/** Today's drop: { day, claimed, tier } — a stored row from another day reads as a fresh, unclaimed drop. */
export function readDrop(now = Date.now()) {
  const day = dayKey(now);
  const o = read();
  if (!o || o.day !== day) return { day, claimed: false, tier: null };
  return { day, claimed: o.claimed === true, tier: validTier(o.tier) };
}
/** Is today's free drop waiting (season 2 only — drives the UPGRADES dot)? */
export function dropReady(now = Date.now()) {
  return SEASON2 && !readDrop(now).claimed;
}

/**
 * The FIRST tap: roll today's final tier (or return the one already rolled — no rerolls) and save it.
 * Returns { ok, tier, reason? } — reasons: 'season' (flag OFF / storage blocked), 'claimed'.
 */
export function openDrop(now = Date.now(), rng = Math.random) {
  const d = readDrop(now);
  if (d.claimed) return { ok: false, reason: 'claimed', tier: d.tier };
  if (d.tier != null) return { ok: true, tier: d.tier };
  const tier = rollTier(rng);
  if (!write({ day: d.day, claimed: false, tier })) return { ok: false, reason: 'season', tier: null };
  return { ok: true, tier };
}

/**
 * The 4th tap: pay today's rolled tier and mark the day claimed (claimed is written FIRST, so a failed write never
 * pays and a second claim the same day never pays twice). Returns { ok, tier, gems?, overdrive?, reason? }.
 */
export function claimDrop(now = Date.now(), rng = Math.random) {
  const d = readDrop(now);
  if (d.claimed) return { ok: false, reason: 'claimed', tier: d.tier };
  const tier = d.tier != null ? d.tier : rollTier(rng);
  if (!write({ day: d.day, claimed: true, tier })) return { ok: false, reason: 'season', tier };
  const pay = DROP_TIERS[tier].pay;
  if (pay.gems) {
    grantGems(pay.gems, 'daily', { detail: 'daily drop' });
    return { ok: true, tier, gems: pay.gems };
  }
  grantOverdrive(pay.overdrive.mult, pay.overdrive.min, now);
  return { ok: true, tier, overdrive: pay.overdrive };
}
