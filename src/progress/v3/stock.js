// v3/stock.js — the SHOP's STOCK (season 2 only; claude/mockups/v2/Shop.dc.html, P3). "Wins buy only POWER;
// everything else costs gems" (progression-v3.md): five gem-priced items at the mockup's odd prices (the mockup's ×2 GEM DROPS is out: gems never scale), each with a
// limited count that RESTOCKS every 5:00 (a shared wall-clock window — every player's restock lands on the same
// :00 / :05 boundary, so the timer is the clock, not a per-save countdown).
//
//   COMMON     +25% XP · 10 MIN        45   ×5   → stockXpMult() ×1.25 on XP / LETTER (v3/hooks.js xpSwap.d)
//   RARE       ×2 LUCK · 15 MIN        120  ×3   → stockLuckMult() ×2 on roll luck (v3/unlocks.js unlockLuckMult)
//   (×2 GEM DROPS removed — Andy oct6: "Do NOT scale gems"; the gem earn table stays exactly FINAL's)
//   EPIC       ×10 OVERDRIVE · NOW     225  ×2   → a ×10 BOOST for 5 min (boost.js startBoost — the R3 2nd slot too)
//   RARE       +5 MIN EVERY BOOST      150  ×2   → +5 min on every running timer (both boost slots + the three above)
//   LEGENDARY  1 FREE EPIC+ ROLL       495  ×1   → VISUAL ONLY for now (buyable: false) — the roll's reveal belongs
//                                                  to the ROLL screen (P6); the card shows, the purchase is disabled
//
// Every write is a no-op with the SEASON2 flag OFF (store.js set()). LEAF-ish: imports store.js, boost.js and
// gemsCore.js only (never hooks.js / unlocks.js — they import THIS).
import { SEASON2 } from '../season.js';
import { S2_PREFIX } from './store.js';
import { startBoost } from '../boost.js';
import { loadGemState, saveGemState, tellBalance } from '../gemsCore.js';

export const STOCK_KEY = `${S2_PREFIX}stock`; // { w: window index, left: { id: n } }
export const STOCK_FX_KEY = `${S2_PREFIX}stockfx`; // { xp: until, luck: until, gems: until } (ms)
export const BOOST2_KEY = `${S2_PREFIX}boost2`; // = hooks.js BOOST2_KEY (the R3 2nd slot)
// = boost.js BOOST_KEY — a literal, so the eager index exports no extra binding to this chunk (payload ratchet);
// stock.test.js pins it
export const BOOST1_KEY = 'taw.boost';
export const RESTOCK_MS = 5 * 60 * 1000;
export const EXTEND_MS = 5 * 60 * 1000;

// `says` (R5 oct8 — Andy: "there are boosts and … things like this should say — boost WHAT? and many don't"):
// ONE line per card naming exactly what the item multiplies, so no card makes the player guess. Display only —
// it never touches the effect. Keep each under ~26 characters: the card is 228px wide at 1366.
export const STOCK = [
  { id: 'xp25', rarity: 'common', icon: 'levels', big: '+25%', what: 'XP · 10 MIN', says: 'XP ONLY · NOT WINS', price: 45, max: 5, fx: 'xp', mult: 1.25, min: 10 },
  { id: 'luck2', rarity: 'rare', icon: 'luck', big: '×2', what: 'LUCK · 15 MIN', says: 'BETTER GEAR ROLL ODDS', price: 120, max: 3, fx: 'luck', mult: 2, min: 15 },
  { id: 'overdrive', rarity: 'epic', icon: 'overdrive', big: '×10', what: 'OVERDRIVE · NOW', says: 'WINS + XP · EVERY MODE', price: 225, max: 2, boost: { mult: 10, min: 5 } },
  { id: 'extend', rarity: 'rare', icon: 'clock', big: '+5 MIN', what: 'EVERY BOOST', says: 'EXCEPT OVERDRIVE', price: 150, max: 2, extend: true },
  { id: 'epicroll', rarity: 'legendary', icon: 'roll', big: '1', what: 'FREE EPIC+ ROLL', says: 'EPIC OR BETTER, GUARANTEED', price: 495, max: 1, buyable: false },
];
export const RARITY = {
  common: { name: 'COMMON', line: '#A9B4C8', fill: '#262b38' },
  rare: { name: 'RARE', line: '#3D8BFF', fill: '#0f2350' },
  epic: { name: 'EPIC', line: '#B04BFF', fill: '#2a0e4a' },
  legendary: { name: 'LEGENDARY', line: '#FFC23D', fill: '#3d2a05' },
};
const FX_MULT = { xp: 1.25, luck: 2, gems: 2 };

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
function readJson(k) {
  try {
    const o = JSON.parse(localStorage.getItem(k) || 'null');
    return o && typeof o === 'object' ? o : null;
  } catch {
    return null;
  }
}
function writeJson(k, o) {
  if (!SEASON2) return false;
  try {
    localStorage.setItem(k, JSON.stringify(o));
    return true;
  } catch {
    return false;
  }
}

/** The 5-minute window `now` is in (shared by everyone: the restock lands on the wall clock's :00 / :05). */
export const windowOf = (now = Date.now()) => Math.floor(now / RESTOCK_MS);
/** Seconds until the next restock (1 … 300). */
export function restockIn(now = Date.now()) {
  return Math.max(1, Math.ceil((RESTOCK_MS - (now - windowOf(now) * RESTOCK_MS)) / 1000));
}
/** Units left of each item in THIS window: { id: n } (a new window = full stock). */
export function stockLeft(now = Date.now()) {
  const s = readJson(STOCK_KEY);
  const fresh = Object.fromEntries(STOCK.map((it) => [it.id, it.max]));
  if (!s || s.w !== windowOf(now) || !s.left) return fresh;
  for (const it of STOCK) if (Number.isFinite(s.left[it.id])) fresh[it.id] = Math.max(0, Math.min(it.max, Math.floor(s.left[it.id])));
  return fresh;
}

// ---- the timed effects ------------------------------------------------------------------------------------------
function readFx() {
  const o = readJson(STOCK_FX_KEY) || {};
  return { xp: num(o.xp), luck: num(o.luck), gems: num(o.gems) };
}
/** ms left on a stock effect ('xp' | 'luck' | 'gems'). */
export function stockFxLeft(kind, now = Date.now()) {
  if (!SEASON2) return 0;
  return Math.max(0, readFx()[kind] - now);
}
const fxMult = (kind, now) => (stockFxLeft(kind, now) > 0 ? FX_MULT[kind] : 1);
/** ×1.25 on XP / LETTER while a +25% XP is running (else ×1). */
export const stockXpMult = (now = Date.now()) => fxMult('xp', now);
/** ×2 on roll luck while a ×2 LUCK is running. */
export const stockLuckMult = (now = Date.now()) => fxMult('luck', now);

/** Every running timer a "+5 MIN EVERY BOOST" would extend: [{ key, field|null }]. */
function liveTimers(now) {
  const out = [];
  for (const k of [BOOST1_KEY, BOOST2_KEY]) {
    const o = readJson(k);
    if (o && num(o.until) > now && num(o.mult) > 1) out.push({ key: k, o });
  }
  const f = readFx();
  for (const kind of Object.keys(FX_MULT)) if (f[kind] > now) out.push({ key: STOCK_FX_KEY, kind });
  return out;
}
/** Is any boost / stock timer running (the +5 MIN item needs one)? */
export const anyTimerLive = (now = Date.now()) => liveTimers(now).length > 0;

function applyEffect(it, now) {
  if (it.fx) {
    const f = readFx();
    f[it.fx] = Math.max(f[it.fx], now) + it.min * 60000; // a 2nd buy while running extends it
    return writeJson(STOCK_FX_KEY, f);
  }
  if (it.boost) {
    startBoost(it.boost.mult, it.boost.min, now);
    return true;
  }
  if (it.extend) {
    const timers = liveTimers(now);
    const f = readFx();
    for (const t of timers) {
      if (t.kind) f[t.kind] += EXTEND_MS;
      else writeJson(t.key, { ...t.o, until: num(t.o.until) + EXTEND_MS });
    }
    if (timers.some((t) => t.kind)) writeJson(STOCK_FX_KEY, f);
    return true;
  }
  return false;
}

/**
 * BUY one unit of `id` for GEMS. Returns { ok, reason?, gems, left } — reasons: 'season' (flag OFF), 'unknown',
 * 'soon' (visual-only item), 'sold_out', 'gems' (short; `short` = how many more), 'nothing' (+5 MIN with no timer
 * running). Nothing is charged unless the effect applied.
 */
export function buyStock(id, now = Date.now()) {
  const it = STOCK.find((x) => x.id === id);
  const g = loadGemState();
  const left = stockLeft(now);
  if (!SEASON2) return { ok: false, reason: 'season', gems: g.bal, left };
  if (!it) return { ok: false, reason: 'unknown', gems: g.bal, left };
  if (it.buyable === false) return { ok: false, reason: 'soon', gems: g.bal, left };
  if (left[id] <= 0) return { ok: false, reason: 'sold_out', gems: g.bal, left };
  if (g.bal < it.price) return { ok: false, reason: 'gems', short: it.price - g.bal, gems: g.bal, left };
  if (it.extend && !anyTimerLive(now)) return { ok: false, reason: 'nothing', gems: g.bal, left };
  if (!applyEffect(it, now)) return { ok: false, reason: 'storage', gems: g.bal, left };
  g.bal -= it.price;
  saveGemState(g);
  tellBalance(g.bal);
  left[id] -= 1;
  writeJson(STOCK_KEY, { w: windowOf(now), left });
  return { ok: true, gems: g.bal, left, spent: it.price };
}
