// fx/shards/shardPlan.js — the limits and flight vectors of a shard burst. PURE: no DOM, no clock — the pools that play
// it (Reel.jsx's reveal burst, gains/ShardBurst.jsx) feed these to WAAPI, and shardPlan.test.js pins them.
// The shards themselves are FLAT (nov5, Andy "extra": the painted crystal blades in public/fx/shards are retired).

// mission control nov2: ONE strong idea per moment — 8–14 shards, the whole flight under 600 ms (no stacked bursts)
export const SHARD_MS = 580; // a flight's ceiling; pools stagger BELOW it, never past it
export const SHARD_MAX = 14;

/**
 * `n` flight vectors that CLEAR a w×h box centred on the burst: each runs to where its ray leaves the box, plus `reach`
 * px (min..max), so a shard aimed up or down is seen too, not only the ones aimed at the box's sides. Angles evenly
 * spread with a fixed jitter; `s` = a size per slot.
 */
export function clearVectors(n, w, h, { reach = [50, 150] } = {}) {
  const hw = Math.max(1, w / 2);
  const hh = Math.max(1, h / 2);
  return Array.from({ length: n }, (_, i) => {
    const a = (i / Math.max(1, n)) * Math.PI * 2 + 0.3 + ((i * 7) % 5) * 0.09;
    const c = Math.abs(Math.cos(a)) || 1e-6;
    const sn = Math.abs(Math.sin(a)) || 1e-6;
    const exit = Math.min(hw / c, hh / sn);
    const d = exit + reach[0] + (((i * 37) % 11) / 10) * (reach[1] - reach[0]);
    return { x: Math.round(Math.cos(a) * d), y: Math.round(Math.sin(a) * d), s: (8 + ((i * 17) % 5)) / 10 };
  });
}

/**
 * Shortens any vector that would carry a shard (burst at `from`, viewport px) past the viewport edge (minus `pad`), so
 * no shard is cut off by the screen — the direction is kept, only the reach shrinks (never below `min` px).
 */
export function fitInside(vs, from, vw, vh, { pad = 36, min = 40 } = {}) {
  return vs.map((v) => {
    const d = Math.hypot(v.x, v.y) || 1;
    const ux = v.x / d;
    const uy = v.y / d;
    const room = Math.min(
      ux > 0 ? (vw - pad - from.x) / ux : ux < 0 ? (from.x - pad) / -ux : Infinity,
      uy > 0 ? (vh - pad - from.y) / uy : uy < 0 ? (from.y - pad) / -uy : Infinity,
    );
    const k = Math.max(min, Math.min(d, room)) / d;
    return k === 1 ? v : { ...v, x: Math.round(v.x * k), y: Math.round(v.y * k) };
  });
}
