// stars.js — the LATE-GAME LAYERS (Andy oct2: "higher progression gets new mechanics so it never
// becomes purely exponential grinding — see Sell Lemons: each prestige layer unlocks a new system;
// its rebirth panel shows 'rebirth to get: N' and warns when it's a bad time").
//
// LAYER 1 — STARS (unlocks with the FIRST rebirth). A rebirth now also pays ★ STARS, and how many
// depends on how far PAST the gate you went: 1 at the gate, +1 every starStep(rc) levels beyond it.
// That turns "rebirth the instant the button lights" into a decision, which is what the rebirth
// panel's REBIRTH TO GET: N ★ and its BAD TIME warning (a star is one or two levels away) are for.
// Stars buy STAR PERKS — mechanics, not just a bigger number:
//   STAR POWER  +10% wins per level, UNCAPPED (price rises by 1★ a level) — the sink that never ends
//   FRENZY+     FUSE FRENZY lasts +1 min per level (to +5)
//   HEAD START  every rebirth climb starts +5 levels higher per level (to half the next gate)
// LAYER 2 — AUTOMATION (unlocks at R3). The idle-game manager layer: perks that BUY for you.
//   AUTO-KEY    buys KEY TIER whenever you can afford it (on every menu return)
//   AUTO-FORGE  buys LETTER FORGE the same way
// Each layer unlock is a claimable "NEW SYSTEM" reveal (claims.js kind 'layer').
// REBIRTH RUSH: STAR POWER (+10% wins) is out of the wins formula and the LETTER FORGE is off the shelf,
// so the shop no longer SELLS STAR POWER or AUTO-FORGE (ShopScreen hides them). Their entries stay in
// PERKS so stored levels load untouched.
//
// PURE + guarded store (taw.stars). Blocked storage → no stars, every perk at 0, never throws.
import { rebirthThreshold, loadProgress, saveProgress, getRebirths, doRebirth, saveRebirths, saveKeyTier } from './xp.js';
import { queueClaim } from './claims.js';
import { noteRebirth } from './gemsCore.js';
// PROGRESSION v3 (SEASON2, default OFF): a rebirth pays +7 × R gems (no ★, no layer claims); ★ come ONLY from
// ASCENSION at R10 (ascendWithStars); star perks and AUTO-KEY are not part of v3. OFF = unchanged.
import { SEASON2 } from './season.js';
import { canAscend, starsForAscend } from './v3/econ.js';
import { getStarsV3, saveStarsV3 } from './v3/store.js';

export const STARS_KEY = 'taw.stars';
export const LAYER_STARS_AT = 1; // rebirths to unlock STARS
export const LAYER_AUTO_AT = 3; // rebirths to unlock AUTOMATION
export const BAD_TIME_LEVELS = 2; // warn when the next star is this many levels away (or fewer)

export const PERKS = [
  { id: 'power', name: 'STAR POWER', layer: 1, max: Infinity, blurb: '+10% WINS PER LEVEL — NO CAP' },
  { id: 'frenzy', name: 'FRENZY+', layer: 1, max: 5, blurb: 'FUSE FRENZY LASTS +1 MIN PER LEVEL' },
  { id: 'head', name: 'HEAD START', layer: 1, max: 6, blurb: 'EVERY CLIMB STARTS +5 LEVELS HIGHER' },
  { id: 'autoKey', name: 'AUTO-KEY', layer: 2, max: 1, blurb: 'BUYS KEY TIER FOR YOU' },
  { id: 'autoForge', name: 'AUTO-FORGE', layer: 2, max: 1, blurb: 'BUYS LETTER FORGE FOR YOU' },
];
export const STAR_POWER_PCT = 0.1;

/** ★ price of the NEXT level of a perk, standing at `lv`. */
export function perkCost(id, lv = 0) {
  if (id === 'power') return lv + 1; // 1, 2, 3, … — rising, never capped
  if (id === 'frenzy' || id === 'head') return 2;
  if (id === 'autoKey' || id === 'autoForge') return 3;
  return Infinity;
}

function load() {
  try {
    const o = JSON.parse(localStorage.getItem(STARS_KEY) || 'null');
    if (!o || typeof o !== 'object') return { earned: 0, spent: 0, perks: {} };
    const n = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.floor(Number(v)) : 0);
    const perks = {};
    for (const p of PERKS) perks[p.id] = n(o.perks && o.perks[p.id]);
    return { earned: n(o.earned), spent: n(o.spent), perks };
  } catch {
    return { earned: 0, spent: 0, perks: {} };
  }
}
function save(s) {
  try {
    localStorage.setItem(STARS_KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}

export function starsState() {
  const s = load();
  return { ...s, balance: Math.max(0, s.earned - s.spent) };
}
export function perkLevel(id) {
  return load().perks[id] || 0;
}

/** Levels per extra star past the gate for rebirth `rc` (the gate being left): 10% of it, min 3. */
export function starStep(rc) {
  return Math.max(3, Math.round(rebirthThreshold(rc) * 0.1));
}
/** ★ a rebirth from `level` (standing at `rc` rebirths) would pay. 0 below the gate. */
export function starsForRebirth(level, rc) {
  if (SEASON2) return 0; // v3: a rebirth pays gems, never ★
  const gate = rebirthThreshold(rc);
  if (!Number.isFinite(level) || level < gate) return 0;
  return 1 + Math.floor((level - gate) / starStep(rc));
}
/**
 * The rebirth panel's advice: { stars, nextIn, badTime }. `nextIn` = levels to one more star;
 * `badTime` = true when that is BAD_TIME_LEVELS or fewer (so rebirthing now leaves a star behind).
 */
export function rebirthAdvice(level, rc) {
  if (SEASON2) return { stars: 0, nextIn: Math.max(0, rebirthThreshold(rc) - level), badTime: false };
  const stars = starsForRebirth(level, rc);
  if (stars === 0) return { stars: 0, nextIn: rebirthThreshold(rc) - level, badTime: false };
  const step = starStep(rc);
  const past = level - rebirthThreshold(rc);
  const nextIn = step - (past % step);
  return { stars, nextIn, badTime: nextIn <= BAD_TIME_LEVELS };
}

/** Bank the stars a rebirth earned (called by the rebirth itself). */
export function addStars(n) {
  const s = load();
  s.earned += Math.max(0, Math.floor(n) || 0);
  save(s);
  return s.earned - s.spent;
}

/** Buy one level of a perk. Returns { ok, level, balance }. */
export function buyPerk(id, rebirths) {
  if (SEASON2) return { ok: false, locked: true }; // v3: no star perks (★ multiply XP and wins instead)
  const p = PERKS.find((x) => x.id === id);
  if (!p) return { ok: false };
  if (!layerUnlocked(p.layer, rebirths)) return { ok: false, locked: true };
  const s = load();
  const lv = s.perks[id] || 0;
  if (lv >= p.max) return { ok: false, maxed: true };
  const cost = perkCost(id, lv);
  const bal = s.earned - s.spent;
  if (bal < cost) return { ok: false, balance: bal };
  s.spent += cost;
  s.perks[id] = lv + 1;
  save(s);
  return { ok: true, level: lv + 1, balance: s.earned - s.spent };
}

export function layerUnlocked(layer, rebirths) {
  const rc = Number.isFinite(rebirths) ? rebirths : 0;
  return layer === 1 ? rc >= LAYER_STARS_AT : rc >= LAYER_AUTO_AT;
}

// ---- the perks' effects (read by wins.js / frenzy.js / the rebirth) ------------------------------
/** STAR POWER: the wins multiplier (folds into the BONUS row). */
export function starPowerMult() {
  return 1 + STAR_POWER_PCT * perkLevel('power');
}
/** FRENZY+: extra FRENZY ms. */
export function frenzyBonusMs() {
  return perkLevel('frenzy') * 60 * 1000;
}
/** HEAD START: the level a climb begins at after rebirth number `rcAfter`, never past half its gate. */
// REBIRTH RUSH (PROGRESSION-FINAL.md): "Level → 1" on every rebirth — HEAD START no longer skips levels (the
// re-climb through the old wall IS the moment). Owned HEAD START levels are kept in storage, unused.
export const HEAD_START_ON = false;
export function headStartLevel(rcAfter) {
  const hs = perkLevel('head');
  if (!hs || !HEAD_START_ON) return 1;
  return Math.max(1, Math.min(1 + 5 * hs, Math.floor(rebirthThreshold(rcAfter) / 2)));
}

/**
 * THE REBIRTH, with its layers: pays the ★ for how far past the gate the player went, applies HEAD
 * START to the new climb, and queues the claimable reveal when a rebirth unlocks a layer. Returns
 * { rc, stars }. Every rebirth in the app goes through here (ShopScreen; the sims call it too).
 */
export function rebirthWithStars() {
  if (SEASON2) {
    // v3: ONE rebirth — level → 1, R + 1, POWER kept (xp.doRebirth), +7 × R gems. No ★, no layer claim.
    const rc = doRebirth();
    noteRebirth(rc);
    return { rc, stars: 0 };
  }
  const before = getRebirths();
  const lv = loadProgress().level;
  const stars = starsForRebirth(lv, before);
  const rc = doRebirth();
  if (stars > 0) addStars(stars);
  noteRebirth(rc); // GEMS: +REBIRTH, every rebirth (this is the one rebirth door)
  const start = headStartLevel(rc);
  if (start > 1) saveProgress({ level: start, intoLevel: 0 });
  if (rc === LAYER_STARS_AT) {
    queueClaim({ id: 'layer-stars', kind: 'layer', label: 'NEW SYSTEM — STAR PERKS', detail: 'stars', meta: { blurb: 'Rebirths pay ★ — more the further past the gate. Spend in REBIRTH → STAR PERKS.' } });
  }
  if (rc === LAYER_AUTO_AT) {
    queueClaim({ id: 'layer-auto', kind: 'layer', label: 'NEW SYSTEM — AUTOMATION', detail: 'auto', meta: { blurb: 'AUTO-KEY buys KEY TIER for you. Unlock it with ★ in REBIRTH.' } }); // AUTO-FORGE retired (Rebirth Rush)
  }
  return { rc, stars };
}

/**
 * AUTOMATION (layer 2): with AUTO-KEY / AUTO-FORGE owned, buy as many as the balance allows.
 * `buyKey` / `buyForge` are injected (shop.js imports this module's siblings; injecting avoids a
 * cycle). Returns { keys, forges } bought — the menu names them once.
 */
export function runAutomation({ buyKey, buyForge, cap = 500 } = {}) {
  const out = { keys: 0, forges: 0 };
  if (SEASON2) return out; // v3: no AUTO-KEY / AUTO-FORGE (R2 unlocks AUTO ROLL instead)
  const auto = { key: perkLevel('autoKey') > 0, forge: perkLevel('autoForge') > 0 };
  // Alternate the two so neither starves the other when both are on.
  for (let i = 0; i < cap; i++) {
    let any = false;
    if (auto.key && buyKey && buyKey().ok) { out.keys += 1; any = true; }
    if (auto.forge && buyForge && buyForge().ok) { out.forges += 1; any = true; }
    if (!any) break;
  }
  return out;
}

// ---- PROGRESSION v3: ASCENSION (season 2 only) --------------------------------------------------------------
/** The live ★ (season 2; 0 with the flag OFF). */
export function starsV3() {
  return getStarsV3();
}
/**
 * ASCEND (v3, at R10): rebirths, levels and POWER reset; ★ += R − 9. `target` = the server's new ★ total (local
 * lands exactly on it, like a server rebirth), null = local (+ R − 9). Returns { ok, stars, added } — ok:false
 * below R10 or with the flag OFF. Every ascension in the app goes through here (leaderboard/client performAscend).
 */
export function ascendWithStars(target = null) {
  if (!SEASON2) return { ok: false, stars: 0, added: 0 };
  const rb = getRebirths();
  const before = getStarsV3();
  if (target == null && !canAscend(rb)) return { ok: false, stars: before, added: 0 };
  const after = Number.isFinite(target) && target >= 0 ? Math.floor(target) : before + starsForAscend(rb);
  saveStarsV3(after);
  saveRebirths(0);
  saveKeyTier(0); // POWER resets on ascension (it is kept through rebirths)
  saveProgress({ level: 1, intoLevel: 0 });
  return { ok: true, stars: after, added: after - before };
}
