// ladder.js — THE ESCALATION LADDER (next-passes-spec PASS 2 §2.3, the recommended V2 "ARCADE").
//
// Pure data + pure functions, no DOM, no React — shared by Word Bomb, Category Blitz, CHAIN, FUSE
// and (pitch only, drawn in ink) SAT RUSH. The tiers REUSE ComboMeter's thresholds (2 / 4 / 7 / 10)
// so the meter and the feel always agree:
//
//   T0 0–1 · T1 2–3 · T2 4–6 · T3 7–9 · T4 10+
//
// Per ACCEPT the word gets the tier's PUNCH, particle count, ring radius, hype size and cue pitch.
// Per TIER-UP (the count crosses a threshold) ONE slam + ONE screen flash + a stinger fire. The
// full-screen flash is NEVER per word any more (it was a ~5120x2880 fill on every accept at 2560
// DPR2, and a photosensitivity concern at 110 WPM).
//
// Everything is CAPPED: the old feel scaled particles and ring radius with the raw combo count, so
// combo 20 sprayed 144 particles. Here the top tier is the ceiling.

/** Combo counts at which T1..T4 begin. Same numbers as ComboMeter.tierOf(). */
export const TIER_THRESHOLDS = Object.freeze([2, 4, 7, 10]);
export const MAX_TIER = TIER_THRESHOLDS.length; // 4

/** Hard per-accept particle ceiling, whatever the tier table says. */
export const PARTICLE_CAP = 40;

/** The tier slam's timing: 320ms in, 500ms hold, 200ms out. */
export const SLAM_MS = Object.freeze({ in: 320, hold: 500, out: 200 });
export const SLAM_TOTAL_MS = SLAM_MS.in + SLAM_MS.hold + SLAM_MS.out;

/** The PUNCH length per accept. */
export const PUNCH_MS = 280;

// One row per tier. `hype` is the --fs-* token for the hype word; `edge` the static board-edge
// colour (null = no frame); `semis` the validCue pitch offset in semitones (T4 = an octave, capped).
export const LADDER = Object.freeze([
  Object.freeze({ tier: 0, punch: 1.06, particles: 10, ring: 110, hype: 'h2', edge: null, semis: 0, flash: 0, label: '' }),
  Object.freeze({ tier: 1, punch: 1.09, particles: 16, ring: 130, hype: 'h2', edge: '#2EFFE0', semis: 2, flash: 0.1, label: 'HEATING UP' }),
  Object.freeze({ tier: 2, punch: 1.12, particles: 22, ring: 150, hype: 'h1', edge: '#FFE94A', semis: 4, flash: 0.12, label: 'HOT' }),
  Object.freeze({ tier: 3, punch: 1.16, particles: 30, ring: 170, hype: 'h1', edge: '#FF6B3D', semis: 7, flash: 0.14, label: 'ON FIRE' }),
  Object.freeze({ tier: 4, punch: 1.2, particles: 40, ring: 190, hype: 'hero', edge: '#FF4FA3', semis: 12, flash: 0.16, label: 'UNSTOPPABLE' }),
]);

/** Combo count -> tier 0..4. Non-numbers / negatives are T0. */
export function heatTier(count) {
  const n = Number.isFinite(count) ? count : 0;
  let t = 0;
  for (let i = 0; i < TIER_THRESHOLDS.length; i++) if (n >= TIER_THRESHOLDS[i]) t = i + 1;
  return t;
}

/** The ladder row for a combo count. */
export function ladderFor(count) {
  return LADDER[heatTier(count)];
}

/**
 * Did going from `prev` to `next` cross UP into a new tier? Returns the new tier (1..4) or 0.
 * A jump that skips tiers (a test seam, a server batch) still fires ONCE, for the tier landed in.
 * Going down (a break, a rollback) is never a crossing.
 */
export function tierCrossed(prev, next) {
  const a = heatTier(prev);
  const b = heatTier(next);
  return b > a ? b : 0;
}

/** Particles for one accept at this combo count — never above PARTICLE_CAP. */
export function particleCount(count) {
  return Math.min(PARTICLE_CAP, ladderFor(count).particles);
}

/** validCue pitch multiplier for a combo count (2^(semis/12)); T4 is exactly one octave. */
export function pitchRatio(count) {
  return Math.pow(2, ladderFor(count).semis / 12);
}

/** The slam label for a tier (1..4); '' for T0 / out of range. */
export function slamLabel(tier) {
  return (LADDER[tier] && LADDER[tier].label) || '';
}
