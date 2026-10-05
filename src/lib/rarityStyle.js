// rarityStyle.js — THE RARITY IDENTITY (Andy oct5): "rarity must be legible EVERYWHERE, not just plain borders".
// One table says what each tier LOOKS like; every surface (roll reel, result card, INDEX, MAIN, menu chip,
// leaderboard ticker, end-game receipt — and app-wide, KEY tiers / rebirths / levels) reads it through the
// helpers below + the finish classes in src/components/rarity/RarityFin.css.
//
//   COMMON grey · RARE blue · EPIC purple · LEGENDARY gold · MYTHIC red-pink · SECRET black + rainbow.
//   glow grows with rarity · shimmer on EPIC+ · particles on LEGENDARY+ · GOLD / RAINBOW dupes add a finish.
//
// DOCUMENTED EXCEPTION (Andy oct5): rarity fills / gradients / glow are allowed for rarity + tier identity,
// despite the house "flat colours, no gradients, no glow". Shimmer and the SECRET rainbow are FINITE one-shot
// sweeps (on appear / hover), never loops. Pure — no DOM, no storage.

export const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary', 'mythic', 'secret'];

/**
 * fill  — the surface colour (solid chips, reel bars, the reveal plate)
 * hi    — the light end of the fill gradient
 * line  — the darker outline shade (house rule: coloured outlines)
 * ink   — text ON the solid fill
 * text  — the tier as an ACCENT on a dark panel (readable on #1a0b2e)
 * glow  — blur radius in px of the tier glow (grows with rarity; 0 = none)
 * glowColour — the glow's colour
 * shimmer / particles / rainbow — the effects the tier earns
 */
export const RARITY = Object.freeze({
  common: Object.freeze({ fill: '#B9B3C6', hi: '#E6E1EE', line: '#5E5770', ink: '#0d0618', text: '#C9C2D6', glow: 0, glowColour: '#B9B3C6', shimmer: false, particles: false, rainbow: false }),
  rare: Object.freeze({ fill: '#3D8BFF', hi: '#9CC6FF', line: '#1B4A9E', ink: '#0d0618', text: '#5EA2FF', glow: 6, glowColour: '#3D8BFF', shimmer: false, particles: false, rainbow: false }),
  epic: Object.freeze({ fill: '#9A1AFF', hi: '#C98BFF', line: '#5c0fa3', ink: '#ffffff', text: '#B65CFF', glow: 10, glowColour: '#9A1AFF', shimmer: true, particles: false, rainbow: false }),
  legendary: Object.freeze({ fill: '#FFD54A', hi: '#FFF3B0', line: '#A8800F', ink: '#0d0618', text: '#FFD54A', glow: 14, glowColour: '#FFC21A', shimmer: true, particles: true, rainbow: false }),
  mythic: Object.freeze({ fill: '#FF3D6E', hi: '#FF9DB6', line: '#A3173A', ink: '#ffffff', text: '#FF5C84', glow: 18, glowColour: '#FF3D6E', shimmer: true, particles: true, rainbow: false }),
  secret: Object.freeze({ fill: '#0d0618', hi: '#2a1648', line: '#000000', ink: '#ffffff', text: '#FFFFFF', glow: 22, glowColour: '#FF4FA3', shimmer: true, particles: true, rainbow: true }),
});

/** The house palette in rainbow order — the SECRET edge and the RAINBOW finish (flat stops, palette only). */
export const RAINBOW_STOPS = Object.freeze(['#FF4FA3', '#FF6B3D', '#FFE94A', '#2EFFE0', '#9A1AFF']);

/** The finishes a duped mark can carry on top of its tier. */
export const FINISHES = Object.freeze(['base', 'gold', 'rainbow']);

/** Any tier id → a RARITY key. PERMANENT reads as LEGENDARY (rarest by how you get it); unknown → COMMON. */
export function rarityKey(tier) {
  if (tier === 'permanent') return 'legendary';
  return Object.prototype.hasOwnProperty.call(RARITY, tier) ? tier : 'common';
}
/** 0 (COMMON) … 5 (SECRET). */
export function rarityRank(tier) {
  return RARITY_ORDER.indexOf(rarityKey(tier));
}
/** The style entry for a tier (always defined). */
export function rarityOf(tier) {
  return RARITY[rarityKey(tier)];
}
function finishKey(finish) {
  return finish === 'gold' || finish === 'rainbow' ? finish : 'base';
}
/**
 * The finish classes for a host element: "rarity-fin is-epic", + " is-tint" (a dark panel washed in the tier,
 * keeps light text) + " is-gold" / " is-rainbow" (a dupe finish on top).
 */
export function rarityClass(tier, { finish = 'base', tint = false } = {}) {
  const f = finishKey(finish);
  return `rarity-fin is-${rarityKey(tier)}${tint ? ' is-tint' : ''}${f !== 'base' ? ` is-${f}` : ''}`;
}
/** Which effects a tier + finish earns — what <RarityFx> draws. */
export function rarityFx(tier, finish = 'base') {
  const s = rarityOf(tier);
  const f = finishKey(finish);
  return {
    shimmer: s.shimmer,
    particles: s.particles,
    rainbow: s.rainbow || f === 'rainbow',
    gold: f === 'gold',
  };
}

// ------------------------------------------------------------------------------- app-wide tier ramps
// "Anything with a tier must look its tier at a glance" — each ladder maps onto the SAME six identities, so a
// player learns the colours once. A ramp is ascending thresholds: value ≥ ramp[i] → RARITY_ORDER[i].
export const KEY_RAMP = Object.freeze([0, 2, 4, 6, 8, 10]); // KEY T0–1 · T2–3 · T4–5 · T6–7 · T8–9 · T10+
export const REBIRTH_RAMP = Object.freeze([1, 1, 3, 5, 10, 20]); // R1–2 RARE · R3 EPIC · R5 LEGENDARY · R10 MYTHIC · R20 SECRET
export const LEVEL_RAMP = Object.freeze([1, 10, 25, 50, 100, 200]); // LV 1 · 10 · 25 · 50 · 100 · 200

/** value → rarity key on a ramp; null below the first step. */
export function rampRarity(value, ramp) {
  const v = Number(value);
  if (!Number.isFinite(v) || !Array.isArray(ramp) || !ramp.length || v < ramp[0]) return null;
  let k = null;
  for (let i = 0; i < ramp.length && i < RARITY_ORDER.length; i += 1) if (v >= ramp[i]) k = RARITY_ORDER[i];
  return k;
}
/** KEY tier → rarity (T0 is COMMON). */
export function keyRarity(tier) {
  return rampRarity(Math.max(0, Math.floor(Number(tier) || 0)), KEY_RAMP);
}
/** Rebirth count → rarity; null at R0 (an R0 player has no rebirth tier to show). */
export function rebirthRarity(rebirths) {
  return rampRarity(Math.floor(Number(rebirths) || 0), REBIRTH_RAMP);
}
/** Level → rarity (LV 1 is COMMON). */
export function levelRarity(level) {
  return rampRarity(Math.max(1, Math.floor(Number(level) || 1)), LEVEL_RAMP);
}
