// gains/gainPlan.js — THE GAIN ANIMATION's numbers (NIGHT oct8 #3, Andy: gains are "especially lacking"). PURE: no DOM,
// no clock — GainLayer.jsx plays what this plans, and the unit test pins it.
//
//   a gain spawns N particles at its source (N = 5 / 10 / 20 by the size of the gain), each BURSTS out 200 ms
//   (ease-out-back), then CONVERGES on the target in 700–900 ms (ease-in, a shallow arc), 60–80 ms apart, shrinking
//   1 → 0.5 as it lands. The target pill bumps 1 → 1.12 → 1 (180 ms) on every landing, and its counter starts on the
//   FIRST landing and runs 400 + 150·log10(amount) ms (ease-out) — a big gain counts a little longer, never forever.

export const GAIN_POOL = 20; // the most particles one layer ever flies at once (the 20 of a big gain)
export const BURST_MS = 200;
export const CONVERGE_MIN_MS = 700;
export const CONVERGE_MAX_MS = 900;
export const STAGGER_MIN_MS = 60;
export const STAGGER_MAX_MS = 80;
export const LAND_SCALE = 0.5;
export const BUMP_MS = 180;
export const BUMP_SCALE = 1.12;
export const EASE_BURST = 'cubic-bezier(.34,1.56,.64,1)'; // ease-out-back
// the converge: x eases in, y eases in a touch later — the gap between the two IS the shallow arc
export const EASE_IN_X = 'cubic-bezier(.55,0,1,.45)';
export const EASE_IN_Y = 'cubic-bezier(.32,0,.95,.6)';
// the rebirth SHARD burst (one-shot, 600 ms whole): out fast, fade by the end
export const SHARD_MS = 600;
export const SHARD_COUNT = 14;

/** How many particles a gain of `amount` flies: 5 for a small one, 10 for a medium one, 20 for a big one. */
export function particleCount(amount) {
  const a = Number.isFinite(amount) ? Math.abs(amount) : 0;
  if (a < 100) return 5;
  if (a < 10000) return 10;
  return 20;
}

/** How long the target's counter runs, from the first landing: 400 + 150·log10(amount) ms. */
export function countMs(amount) {
  const a = Number.isFinite(amount) ? Math.abs(amount) : 0;
  return Math.round(400 + 150 * Math.log10(Math.max(1, a)));
}

/**
 * One flight's particles. `rng` is injectable (tests); every number is a plain ms / px.
 * Returns [{ ang, r, wait, flight, land }] — `wait` = when particle i starts converging (after its burst + stagger),
 * `land` = wait + flight (when it lands, from the call).
 */
export function planParticles(n, rng = Math.random) {
  const out = [];
  let wait = BURST_MS;
  for (let i = 0; i < n; i += 1) {
    const ang = (i / n) * Math.PI * 2 + (rng() * 0.8 - 0.4);
    const r = 40 + rng() * 36;
    const flight = CONVERGE_MIN_MS + rng() * (CONVERGE_MAX_MS - CONVERGE_MIN_MS);
    if (i > 0) wait += STAGGER_MIN_MS + rng() * (STAGGER_MAX_MS - STAGGER_MIN_MS);
    out.push({ ang, r, wait, flight, land: wait + flight });
  }
  return out;
}

/** The rebirth shards: evenly spread angles with a little jitter, a distance, a spin. */
export function planShards(n = SHARD_COUNT, rng = Math.random) {
  return Array.from({ length: n }, (_, i) => ({
    ang: (i / n) * Math.PI * 2 + (rng() * 0.5 - 0.25),
    r: 110 + rng() * 90,
    spin: rng() * 540 - 270,
    s: 0.7 + rng() * 0.6,
  }));
}
