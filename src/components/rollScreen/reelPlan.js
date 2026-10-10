// reelPlan.js — PURE numbers for the ROLL screen reel (Andy oct5: "Reel swings through marks and slowly decelerates
// onto the result (~2.5–4s). Rarer = longer slowdown … Reel shows real odds, no faked near-misses."). No DOM, no
// React, no storage: RollScreen.jsx / Reel.jsx play these numbers. Unit-tested in reelPlan.test.js.
//
// HONEST STRIP: every cell of the strip is an INDEPENDENT draw from the live roll table (markRolls.rollTable — the
// exact chance of every mark on the roll that was just paid for, luck and pity included). The landing cell is the
// real result. Nothing is inserted: the cells either side of the result are the same draws they would be for any
// other result (drawStrip never reads the result to pick a filler), so a "LEGENDARY just above the line" happens
// exactly as often as the odds say and never more.
//
// FEEL: the reel position is land × (1 − (1 − t/D)^k). D is 2.4 s for every tier (NIGHT oct8) and k grows with rarity
// — a higher power spends a longer share of the spin crawling over the last few cells: rarer = longer slowdown.
// k stays ≤ 2 so the result only crosses the line at ≥ 85% of the spin ("will it tip over" stays open), and the reel
// rests at a random spot INSIDE the result cell (± REST_MAX of a cell), then settles to centre.

export const TIER_LADDER = ['rare', 'epic', 'legendary', 'mythic', 'secret'];
export const tierIndex = (t) => Math.max(0, TIER_LADDER.indexOf(t));

// ---- the strip ----
export const REEL_LEN = 44; // cells in the pool (fixed: the DOM pool never grows)
export const LAND_AT = 38; // the landing cell — six real draws stay visible past it
export const SHORT_FROM = 6; // a SHORT land starts this many cells before the result

/** The table as [{ id, p }] in table order, only p > 0. Accepts a Map (rollTable().probs) or an array. */
export function tableEntries(probs) {
  const out = [];
  const it = probs instanceof Map ? probs.entries() : (probs || []).map((e) => [e.id, e.p]);
  for (const [id, p] of it) if (p > 0) out.push({ id, p });
  return out;
}
/** One draw from the table by inverse CDF (the same walk markRolls.roll makes). */
export function drawOne(entries, rng = Math.random) {
  if (!entries.length) return null;
  let u = rng();
  if (!(u >= 0 && u < 1)) u = 0;
  for (const e of entries) {
    if (u < e.p) return e.id;
    u -= e.p;
  }
  return entries[entries.length - 1].id; // float dust
}
/**
 * The strip: `len` independent draws from the live table, with the REAL result written into `landAt`. The fillers
 * are drawn without looking at the result (no near-miss can be inserted). Returns an array of mark ids.
 */
export function drawStrip(probs, rng = Math.random, { resultId, len = REEL_LEN, landAt = LAND_AT } = {}) {
  const entries = tableEntries(probs);
  const out = new Array(len);
  for (let i = 0; i < len; i += 1) out[i] = drawOne(entries, rng);
  if (resultId != null && landAt >= 0 && landAt < len) out[landAt] = resultId;
  return out;
}

// ---- timing ----
/**
 * Full spin length: 2.4 s for every tier (NIGHT oct8 #4, Andy: "the reel decelerates over 2.4 s") — the RARITY is in the
 * slowdown power below (a rarer result crawls longer over its last cells inside the same 2.4 s) and in the reveal
 * after the land, never in a longer wait.
 */
export const SPIN_MS = { rare: 2400, epic: 2400, legendary: 2400, mythic: 2400, secret: 2400 };
/** The last NEAR_MISS_TICKS cell crossings kick the pointer (a visible "tick … tick … tick" as the reel crawls). */
export const NEAR_MISS_TICKS = 3;
/** RARITY-SCALED REVEAL beats (NIGHT oct8 #4): RARE gets one flash; EPIC+ a rarity-colour wash over the dim; a
 *  LEGENDARY+ full reveal HOLDS 1.2 s before it asks for the tap. */
export const FLASH_TIERS = new Set(['rare']);
export const WASH_TIERS = new Set(['epic', 'legendary', 'mythic', 'secret']);
export const KEEP_HOLD_MS = 1200;
/** The deceleration power by tier: higher = a longer crawl over the last cells. */
export const EASE_POW = { rare: 1.76, epic: 1.82, legendary: 1.88, mythic: 1.94, secret: 2 };
/** The rest offset: the reel stops anywhere inside the result cell (± this much of a cell) — still the result. */
export const REST_MAX = 0.3;
export function restOffset(rng = Math.random) {
  let u = rng();
  if (!(u >= 0 && u < 1)) u = 0.5;
  return (u * 2 - 1) * REST_MAX;
}
/** A SHORT land (a reveal below the skip setting): a quick snap over the last SHORT_FROM cells. */
export const SHORT_MS = 520;
export const SHORT_POW = 2;
/** LEGENDARY+ cutscene hold after the land (a tap skips it). */
export const CUTSCENE_MS = { legendary: 2200, mythic: 2600, secret: 3200 };
/** A tap mid-spin jumps to the land but still plays a SHORT cutscene ("1 IN X" huge); a second tap skips it. */
export const CUTSCENE_JUMP_MS = 1500;

export function spinMs(tier, mode = 'full') {
  if (mode === 'none') return 0;
  if (mode === 'short') return SHORT_MS;
  return SPIN_MS[tier] || SPIN_MS.rare;
}
export function easePow(tier, mode = 'full') {
  return mode === 'short' ? SHORT_POW : EASE_POW[tier] || EASE_POW.rare;
}
export const easeOut = (x, k) => 1 - (1 - Math.max(0, Math.min(1, x))) ** k;
/** Where the reel is at time t (ms since the spin started), in cells. Lands exactly on `land` at t ≥ dur. */
export function reelPos(t, { dur, land = LAND_AT, from = 0, pow = 3 }) {
  if (!(dur > 0) || t >= dur) return land;
  return from + (land - from) * easeOut(t / dur, pow);
}
/** The time (ms) at which the reel reaches cell position `pos` (inverse of reelPos). */
export function timeAt(pos, { dur, land = LAND_AT, from = 0, pow = 3 }) {
  if (!(dur > 0)) return 0;
  const f = (pos - from) / (land - from);
  if (f <= 0) return 0;
  if (f >= 1) return dur;
  return dur * (1 - (1 - f) ** (1 / pow));
}
/** The share of the spin before the result cell's edge crosses the line (the answer is under the frame after it). */
export function crossShare(tier, rest = 0, mode = 'full') {
  const land = LAND_AT + rest;
  const dur = spinMs(tier, mode);
  return timeAt(LAND_AT - 0.5, { dur, land, from: spinFrom(mode), pow: easePow(tier, mode) }) / dur;
}
/** The dim starts as the reel enters the last DIM_CELLS cells — not before (it must not spoil EPIC+ early). */
export const DIM_CELLS = 3.5;
/** The start cell of a spin (a SHORT land starts close to the result). */
export function spinFrom(mode, land = LAND_AT) {
  return mode === 'short' ? Math.max(0, land - SHORT_FROM) : 0;
}
/** The times (ms) at which each cell crosses the line — the reel's ticks. Gaps grow: the ticks slow with the reel. */
export function tickTimes({ dur, land = LAND_AT, from = 0, pow = 3 }) {
  const out = [];
  if (!(dur > 0)) return out;
  // invert reelPos: cell c is crossed at t where from + (land − from)·ease = c − 0.5
  for (let c = Math.ceil(from + 0.5); c <= land; c += 1) {
    const f = (c - 0.5 - from) / (land - from);
    if (f <= 0 || f >= 1) continue;
    out.push(dur * (1 - (1 - f) ** (1 / pow)));
  }
  return out;
}

// ---- which reveal plays ----
/**
 * 'none' (reduced motion: straight to the result card), 'short' (below the skip setting — a quick land), or 'full'.
 * A first-time mark ALWAYS plays the full reveal (Andy) — unless reduced motion asks for no motion at all.
 */
export function revealMode(result, { skipBelow = 'epic', reduced = false, autoUntil = null } = {}) {
  if (reduced) return 'none';
  if (!result) return 'none';
  // a first-time mark — the shown result OR a double roll's extra — always gets the full reveal
  if ([result, ...(result.extra || [])].some((r) => r && r.newMark)) return 'full';
  // the hit that stops AUTO ROLL always gets the full reveal
  if (autoUntil && autoShouldStop(result, autoUntil)) return 'full';
  return tierIndex(result.tier) < tierIndex(skipBelow) ? 'short' : 'full';
}
/** LEGENDARY+ on a full reveal gets the full-screen cutscene ("1 IN X" huge). */
export function hasCutscene(tier, mode = 'full') {
  return mode === 'full' && tierIndex(tier) >= tierIndex('legendary');
}
/** How dark the screen goes while the reel slows (EPIC+ only — rarer = darker). */
export const DIM = { rare: 0, epic: 0.5, legendary: 0.7, mythic: 0.8, secret: 0.88 };
export function dimFor(tier, mode = 'full') {
  return mode === 'full' ? DIM[tier] || 0 : 0;
}
/** The rarity light behind the landing cell (EPIC+ — glow belongs to EPIC up). */
export function hasLight(tier, mode = 'full') {
  return mode === 'full' && tierIndex(tier) >= tierIndex('epic');
}
/** Pooled particle burst size on the land (EPIC+). The pool holds BURST_POOL nodes. */
export const BURST_POOL = 18;
export const BURST = { rare: 0, epic: 10, legendary: 14, mythic: 16, secret: 18 };
export function burstCount(tier, mode = 'full') {
  return mode === 'full' ? BURST[tier] || 0 : 0;
}
/** Shake amplitude (px) on the land — scales with rarity. */
export const SHAKE_PX = { rare: 2, epic: 5, legendary: 9, mythic: 12, secret: 16 };
export function shakePx(tier, mode = 'full') {
  return mode === 'short' ? 0 : SHAKE_PX[tier] || 0;
}
/** The shake's keyframes (finite, transform only). [] when there is no shake. */
export function shakeFrames(px) {
  if (!(px > 0)) return [];
  const s = [1, -0.8, 0.6, -0.4, 0.2, 0];
  return [{ transform: 'translate3d(0,0,0)' }, ...s.map((k, i) => ({ transform: `translate3d(${(k * px).toFixed(1)}px,${(((i % 2) ? 1 : -1) * k * px * 0.5).toFixed(1)}px,0)` }))];
}
/** Pooled particle vectors: deterministic angles/distances so a burst never reads layout. */
export function burstVectors(n, spread = 1) {
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const a = (i / Math.max(1, n)) * Math.PI * 2 + (i % 3) * 0.21;
    const d = (110 + ((i * 37) % 70)) * spread;
    out.push({ x: Math.round(Math.cos(a) * d), y: Math.round(Math.sin(a) * d), r: ((i * 53) % 180) - 90, s: 0.7 + ((i * 17) % 6) / 10 });
  }
  return out;
}

// ---- HOLD TO ROLL (NIGHT oct8 R4 — Andy: "I liked hold-to-buy — greater satisfaction") ----
/** The charge: the ROLL button is HELD for CHARGE_MS (the fill crosses, the reel rattles harder), then the RELEASE
 *  is the spin (a slingshot: pull, let go). A release before full charge cancels (the fill drains, nothing is paid).
 *  A hold kept past full charge fires by itself after OVERHOLD_MS so the screen never feels stuck. */
export const CHARGE_MS = 500;
export const CHARGE_SHAKE_AT = 0.5; // the hard rattle starts at this share of the charge
export const OVERHOLD_MS = 1200;
/** The charge rattle on the reel (px): light while the fill crosses, hard once charged. Finite iterations. */
export const CHARGE_RATTLE = { light: 1.5, hard: 4 };
/**
 * THE TELL (research: Genshin's meteor colour / Overwatch's "late" hint): for EPIC+ the reel's last cells carry the
 * RARITY COLOUR before the card is shown — the pointer turns the tier colour and a flat plate over the band pulses it.
 * Honest: it never shows for RARE, it never lies about the colour, and it starts only once the reel is in
 * its last DIM_CELLS (the dim's own gate). Intensity encodes the tier: more pulses, a stronger peak, and LEGENDARY+
 * adds a low rumble under it.
 */
export const TELL = {
  epic: { pulses: 2, peak: 0.3, rumble: false },
  legendary: { pulses: 3, peak: 0.45, rumble: true },
  mythic: { pulses: 4, peak: 0.55, rumble: true },
  secret: { pulses: 5, peak: 0.65, rumble: true },
};
export function tellFor(tier, mode = 'full') {
  return mode === 'full' ? TELL[tier] || null : null;
}
/** The tell's opacity keyframes: `pulses` beats up to `peak`, ending high (the land's wash takes over). */
export function tellFrames(tier, mode = 'full') {
  const t = tellFor(tier, mode);
  if (!t) return [];
  const out = [{ opacity: 0, offset: 0 }];
  const n = t.pulses;
  for (let i = 0; i < n; i += 1) {
    const a = (i + 0.5) / n;
    const b = (i + 1) / n;
    out.push({ opacity: t.peak, offset: Math.min(0.999, a) });
    out.push({ opacity: i === n - 1 ? t.peak * 0.8 : t.peak * 0.25, offset: Math.min(1, b) });
  }
  return out;
}

// ---- auto roll ----
/** AUTO ROLL stops on a result (or its double-roll extra) at `until` or better. */
export function autoShouldStop(result, until = 'epic') {
  if (!result) return true;
  const goal = tierIndex(until);
  return [result, ...(result.extra || [])].some((r) => r && tierIndex(r.tier) >= goal);
}
/** The gap between AUTO ROLL spins after a land (ms) — enough to read the card. */
export const AUTO_GAP_MS = 420;

// ---- copy helpers (no new words) ----
/** The short-balance sentence, for screen readers only: "NEED 4 MORE GEMS" (the screen shows −4 + gem) (GEMS buy rolls — Andy oct5; wins never do). */
export function needMoreText(price, have, fmt = (n) => String(n)) {
  return `NEED ${fmt(Math.max(1, Math.ceil(price - have)))} MORE GEMS`;
}

// ---- ROLL v1 reveals (Andy oct5 mockup claude/mockups/roll-v1/Main.dc.html) ----
/**
 * Which reveal a landed roll gets — RARITY-SCALED: 'line' (every short / reduced-motion land: the result line under the
 * reel, no reveal), 'lite' (ROLL REVEAL v2: a RARE full reveal — the card flips over the reel and its stats
 * tick in, then it closes by itself), 'dim' (EPIC: the screen dims, "1 IN X" slams, the card flips), 'full'
 * (LEGENDARY+: full-screen rays, the rarity, "1 IN X" huge, the card, the screen shakes). 'dim' and 'full' stay up
 * until a tap. The layers each tier plays are revealPlan.js's.
 */
export function revealKind(tier, mode = 'full') {
  if (mode !== 'full') return 'line';
  const r = tierIndex(tier);
  if (r >= tierIndex('legendary')) return 'full';
  return r === tierIndex('epic') ? 'dim' : 'lite';
}
/** Under AUTO ROLL an EPIC dim reveal closes by itself after this long (the mockup's 1.3 s), then the next roll. */
export const AUTO_DIM_MS = 1300;
/** The rays turn only while a full reveal plays in (finite), then rest. */
export const RAYS_MS = 3200;
/**
 * The AUTO cycle (one button, Andy oct5 mockup): OFF → EPIC+ → LEGENDARY+ → OFF (GEAR POOL v2: RARE+
 * is gone — RARE is the floor, every roll is one). Each tap sets the target
 * (and starts rolling from OFF); a hit at the target or better stops it.
 */
export const AUTO_CYCLE = [null, 'epic', 'legendary'];
export function nextAutoTarget(cur) {
  const i = AUTO_CYCLE.indexOf(cur == null ? null : cur);
  return AUTO_CYCLE[i < 0 ? 1 : (i + 1) % AUTO_CYCLE.length];
}
