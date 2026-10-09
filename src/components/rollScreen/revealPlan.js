// revealPlan.js — PURE numbers for the gear ROLL REVEAL v2 (research: rarity-shine-research.md §4). No DOM, no React:
// Reel.jsx plays these. Unit-tested in revealPlan.test.js.
//
// ESCALATION PRINCIPLE: each tier ADDS a layer — never "more of the same" only:
//   common     flip
//   rare       + one sheen pass + sparkles
//   epic       + a pre-flip shake + a burst
//   legendary  + a TELEGRAPH (the rarity colour shows BEFORE the flip: the back's edge glints in it and rattles)
//              + the flip lands as a SLAM (squash) + a small screen shake
//   mythic     + a colour flash + a second burst ring
//   secret     + the lights dim + a longer spin-up
// The reveal lasts ~0.25 / 0.5 / 1.0 / 1.6 / 2.2 / 3.0 s. Then the STATS EXTENSION (≤ 1.2 s) ticks the gear's stats in.
// A tap closes the reveal at any point (the result line under the reel already holds the result).

export const REVEAL_TIERS = ['common', 'rare', 'epic', 'legendary', 'mythic', 'secret'];

/** Which layers each tier plays, in ladder order (each tier = the one below + its own). */
export const LAYERS = {
  common: ['flip'],
  rare: ['flip', 'sheen', 'sparkles'],
  epic: ['flip', 'sheen', 'sparkles', 'preShake', 'burst'],
  legendary: ['flip', 'sheen', 'sparkles', 'preShake', 'burst', 'telegraph', 'slam', 'screenShake'],
  mythic: ['flip', 'sheen', 'sparkles', 'preShake', 'burst', 'telegraph', 'slam', 'screenShake', 'flash', 'ring2'],
  secret: ['flip', 'sheen', 'sparkles', 'preShake', 'burst', 'telegraph', 'slam', 'screenShake', 'flash', 'ring2', 'dimLights', 'spinUp'],
};
export const hasLayer = (tier, layer) => (LAYERS[tier] || LAYERS.common).includes(layer);

/** The sparkle pool (pooled 4-point stars, WAAPI) and how many each tier fires. SECRET fires the pool twice. */
export const SPARK_POOL = 8;
export const SPARKS = { common: 0, rare: 4, epic: 6, legendary: 8, mythic: 8, secret: 12 };
/** Where the pool's sparkles sit, as % of the card box (fixed spots: a spawn is a pure write — no measuring). */
export const SPARK_SPOTS = [
  { x: 8, y: 10, s: 1.1, r: 12 }, { x: 92, y: 18, s: 0.8, r: -20 }, { x: 96, y: 62, s: 1.2, r: 30 }, { x: 6, y: 72, s: 0.9, r: -8 },
  { x: 50, y: -3, s: 1, r: 45 }, { x: 78, y: 96, s: 1.1, r: -35 }, { x: 22, y: 98, s: 0.8, r: 18 }, { x: -4, y: 40, s: 1, r: -40 },
];
/** The shake on the screen when a slam lands (px) — small, it is the card's weight, not an earthquake. */
export const SCREEN_SHAKE = { legendary: 4, mythic: 5, secret: 6 };
/** The pre-flip rattle of the card back (px). */
export const PRE_RATTLE = { epic: 3, legendary: 3.5, mythic: 4, secret: 4.5 };
/** The SECRET lights-dim level, and the colour flash peak. */
export const DIM_LIGHTS = 0.72;
export const FLASH_PEAK = 0.6;

/**
 * The reveal TIMELINE for a tier (ms from the reveal opening). Every span is { at, ms }; a layer the tier does not
 * play is null. `land` = the instant the face is fully turned (the stamp, the burst and the stats hang off it);
 * `total` = when the last layer is done.
 */
export function revealTimeline(tier) {
  const t = REVEAL_TIERS.includes(tier) ? tier : 'common';
  const on = (l) => hasLayer(t, l);
  // BEFORE the flip: secret dims + spins up (with the telegraph glinting through it); legendary / mythic telegraph;
  // epic only rattles
  const dim = on('dimLights') ? { at: 0, ms: 420 } : null;
  const spinUp = on('spinUp') ? { at: 300, ms: 1300 } : null;
  let telegraph = null;
  if (on('telegraph')) telegraph = spinUp ? { at: 800, ms: 800 } : { at: 0, ms: t === 'mythic' ? 850 : 650 };
  let preShake = null;
  if (on('preShake')) preShake = telegraph ? { ...telegraph } : { at: 0, ms: 300 };
  const pre = spinUp ? spinUp.at + spinUp.ms : telegraph ? telegraph.at + telegraph.ms : preShake ? preShake.ms : 0;
  const flipMs = on('slam') ? 300 : 250;
  const flip = { at: pre, ms: flipMs };
  const land = pre + flipMs;
  const slam = on('slam') ? { at: land - 60, ms: 360 } : null;
  const screenShake = on('screenShake') ? { at: land, ms: 200 } : null;
  const flash = on('flash') ? { at: land - 20, ms: 140 } : null;
  const burst = on('burst') ? { at: land, ms: 420 } : null;
  const ring2 = on('ring2') ? { at: land + 200, ms: 520 } : null;
  // the sheen sweeps once the card has landed (after the slam's squash on a slam tier)
  const sheenAt = t === 'rare' ? land - 70 : on('slam') ? land + 220 : land;
  const sheenMs = t === 'rare' ? 320 : 420;
  const sheen = on('sheen') ? { at: sheenAt, ms: sheenMs } : null;
  const sparkles = on('sparkles') ? { at: t === 'rare' ? land - 50 : land + 30, ms: t === 'rare' ? 300 : 420, n: SPARKS[t] } : null;
  const stampAt = land + (on('slam') ? 60 : 0);
  // the TARGET durations (research §4) pad the tail so every tier's reveal reads as its own length
  const TARGET = { common: 250, rare: 500, epic: 1000, legendary: 1600, mythic: 2200, secret: 3000 };
  const ends = [flip, slam, screenShake, flash, burst, ring2, sheen, sparkles, dim, spinUp, telegraph, preShake]
    .filter(Boolean).map((s) => s.at + s.ms);
  const total = Math.max(TARGET[t], ...ends);
  return { tier: t, dim, spinUp, telegraph, preShake, flip, land, slam, screenShake, flash, burst, ring2, sheen, sparkles, stampAt, total };
}

/**
 * The STATS EXTENSION (Andy: "when a card gets rolled, there can be a 2nd animation showing the stats"): the MAIN stat
 * slams in big, each extra stat then the perk tick in one after another (~120 ms apart), then the dupe ★ pips fill.
 * → { main: { at, ms }, extras: [{ at, ms }], perk, dupe, stars: [{ at, ms }], total } — total ≤ EXT_MAX_MS.
 */
export const EXT_MAX_MS = 1200;
export const EXT_STAGGER = 120;
export function extensionPlan({ extras = 0, perk = false, dupe = false, stars = 0 } = {}) {
  const main = { at: 0, ms: 300 };
  let at = 220;
  const ex = [];
  for (let i = 0; i < extras; i += 1) { ex.push({ at, ms: 220 }); at += EXT_STAGGER; }
  const pk = perk ? { at, ms: 260 } : null;
  if (perk) at += EXT_STAGGER;
  const dp = dupe ? { at, ms: 220 } : null;
  const st = [];
  if (dupe) {
    const n = Math.max(0, Math.min(5, stars));
    const step = n > 1 ? Math.min(70, Math.floor((EXT_MAX_MS - at - 320) / (n - 1))) : 0;
    for (let i = 0; i < n; i += 1) st.push({ at: at + 80 + i * step, ms: 240 });
  }
  const ends = [main, ...ex, pk, dp, ...st].filter(Boolean).map((s) => s.at + s.ms);
  return { main, extras: ex, perk: pk, dupe: dp, stars: st, total: Math.min(EXT_MAX_MS, Math.max(...ends)) };
}

/** When the stats extension starts: once the card has LANDED (a beat after the face turns — past a slam's squash). */
export const EXT_AFTER_LAND = 240;
export function extensionAt(tier) {
  return revealTimeline(tier).land + EXT_AFTER_LAND;
}
/** When everything (the reveal's tail and the stats) is done. */
export function revealDoneMs(tier, ext) {
  return Math.max(revealTimeline(tier).total, extensionAt(tier) + (ext ? ext.total : 0));
}
/** How long a reveal stays up by itself before it closes (COMMON / RARE always; EPIC under AUTO): all done + a beat. */
export const SELF_CLOSE_HOLD = { lite: 700, auto: 350 };
export function selfCloseMs(tier, ext, { auto = false } = {}) {
  return revealDoneMs(tier, ext) + (auto ? SELF_CLOSE_HOLD.auto : SELF_CLOSE_HOLD.lite);
}

// ---- the INDEX idle sheen: LEGENDARY+ only, ONE card at a time, ONE shared timer (markCard/idleSheen.js) ----
export { IDLE_SHEEN_TIERS, IDLE_SHEEN_EVERY_MS, IDLE_SHEEN_MS, nextIdleSheen } from '../markCard/idleSheen.js';
