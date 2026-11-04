// fx/shards/shardPlan.js — PAINTED CRYSTAL BLADE SHARDS (Andy nov2: "shards (im thinking the mobile legends aamon rn)"):
// the art + flight of the painted shard sprites. PURE: no DOM, no clock — the pools that play it (Reel.jsx's reveal
// burst, …) only feed these keyframes to WAAPI, and shardPlan.test.js pins them.
//
// THE ART: public/fx/shards/<set>-<n>.webp — four painted crystal slivers per colour set (needle, leaf blade, hook
// blade, splinter), one ChatGPT set drawn together so line weight and facets match, cut with scripts/split-sheet.py.
// Every sprite is drawn with its TIP up-right (TIP_DEG), so a shard is turned to point ALONG its flight.
//
// THE FLIGHT (one finite one-shot, transform/opacity only): the blade SNAPS out tip-first (the first ~35 %, ease-out),
// HANGS and drifts sideways with a slow turn (the Aamon float), then shrinks and fades. Snappy, never floaty: the
// travel is over inside ~200 ms; the short hang is the read.

export const SHARD_PIECES = 4;
// mission control nov2: ONE strong idea per moment — 8–14 blades, the whole flight under 600 ms (no stacked bursts)
export const SHARD_MS = 580; // a flight's ceiling; pools stagger BELOW it, never past it
export const SHARD_MAX = 14;
export const SHARD_SETS = ['violet', 'gold', 'pink', 'cyan', 'prism'];
/** Which painted set(s) a rarity throws. MYTHIC mixes its two colours (pink + cyan, like its aura). */
export const TIER_SETS = {
  epic: ['violet'],
  legendary: ['gold'],
  mythic: ['pink', 'cyan'],
  secret: ['prism'],
};
// the tip's direction in each sprite as drawn (degrees, screen coords: 0 = right, -90 = up)
export const TIP_DEG = [-50, -48, -72, -40];

/** The sprite URL for pool slot `i` of a burst in one painted colour set (unknown set → violet). */
export function setSrc(set, i) {
  return `/fx/shards/${SHARD_SETS.includes(set) ? set : 'violet'}-${i % SHARD_PIECES}.webp`;
}

/** The sprite URL for pool slot `i` of a burst in `tier`'s colours. */
export function shardSrc(tier, i) {
  const sets = TIER_SETS[tier] || TIER_SETS.epic;
  return setSrc(sets[i % sets.length], i);
}

const r1 = (n) => Math.round(n * 10) / 10;

/**
 * The keyframes for one blade flying along the vector `v` = { x, y } px (from the burst centre), sized `s`.
 * `turn` = the extra spin it picks up while hanging (deg, signed), `drift` = the sideways float (px, signed).
 */
export function bladeFrames(v, { s = 1, turn = 24, drift = 10, piece = 0 } = {}) {
  const ang = (Math.atan2(v.y, v.x) * 180) / Math.PI;
  const base = r1(ang - TIP_DEG[piece % SHARD_PIECES]); // the sprite's tip turned onto the flight line
  const len = Math.hypot(v.x, v.y) || 1;
  // the sideways float is perpendicular to the flight
  const px = (-v.y / len) * drift;
  const py = (v.x / len) * drift;
  const at = (k, d, rot, sc) => `translate3d(${r1(v.x * k + px * d)}px,${r1(v.y * k + py * d)}px,0) rotate(${r1(base + rot)}deg) scale(${r1(sc * 100) / 100})`;
  return [
    { offset: 0, opacity: 0, transform: at(0, 0, -turn * 0.5, s * 0.35), easing: 'cubic-bezier(.05,.7,.2,1)' },
    { offset: 0.06, opacity: 1, transform: at(0.12, 0, -turn * 0.4, s * 0.9), easing: 'cubic-bezier(.1,.75,.25,1)' },
    { offset: 0.36, opacity: 1, transform: at(0.8, 0.3, 0, s), easing: 'cubic-bezier(.35,0,.65,1)' },
    { offset: 0.78, opacity: 1, transform: at(0.92, 0.85, turn * 0.7, s * 0.96), easing: 'cubic-bezier(.5,0,.9,.6)' },
    { offset: 1, opacity: 0, transform: at(1, 1, turn, s * 0.55) },
  ];
}

/**
 * `n` flight vectors that CLEAR a w×h box centred on the burst (the reveal card the blades burst from behind): each
 * runs to where its ray leaves the box, plus `reach` px (min..max), so a blade aimed up or down is seen too, not only
 * the ones aimed at the card's sides. Angles evenly spread with a fixed jitter; `s` = a size per slot.
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
 * Where the ray along `v` leaves a w×h box centred on the burst — an EDGE burst starts each blade there, so it cracks
 * OUT of the box's rim and never crosses its face (the shop's SOLD! stamp, a price).
 */
export function edgeStart(v, w, h) {
  const d = Math.hypot(v.x, v.y) || 1;
  const c = Math.abs(v.x / d) || 1e-6;
  const sn = Math.abs(v.y / d) || 1e-6;
  const exit = Math.min(Math.max(1, w / 2) / c, Math.max(1, h / 2) / sn, d);
  return { x: Math.round((v.x / d) * exit), y: Math.round((v.y / d) * exit) };
}

/**
 * Shortens any vector that would carry a blade (burst at `from`, viewport px) past the viewport edge (minus `pad`), so
 * no blade is cut off by the screen — the direction is kept, only the reach shrinks (never below `min` px).
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

/** Per-slot flavour for a pool of `n`: the spin and float alternate sides so the burst never reads as a pinwheel. */
export function bladeFlavour(i) {
  const side = i % 2 ? 1 : -1;
  return { piece: i % SHARD_PIECES, turn: side * (14 + ((i * 29) % 22)), drift: -side * (6 + ((i * 13) % 10)) };
}

// THE AAMON ORBIT (Andy nov3: "aamon spins them around"): the blades form a RING round the card, LAP it tip-first
// (spinning up), then LASH outward tip-first. The ring path is a superellipse (p = 6) just outside the w×h card, so it
// hugs the corners instead of cutting through them. All blades share one ring and one direction: it reads as ONE
// spinning crown, never a spray.
const SE_P = 6;
function ringPoint(a, rx, ry) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: Math.sign(c) * Math.abs(c) ** (2 / SE_P) * rx, y: Math.sign(s) * Math.abs(s) ** (2 / SE_P) * ry };
}
const deg = (x, y) => (Math.atan2(y, x) * 180) / Math.PI;
const near = (a, prev) => a + 360 * Math.round((prev - a) / 360); // unwrap onto the previous angle

/**
 * The keyframes for ring slot `i` of `n` round a w×h card: appear on the ring, lap `sweep` degrees (clockwise on
 * screen, spinning up), then lash out `reach` px past the ring tip-first and fade. Transform/opacity only; `lashAt`
 * (0..1) is when the lap ends — pools nudge it per slot so the ring lets go as a ripple, not one pop.
 */
export function orbitLashFrames(i, n, w, h, { pad = 26, sweep = 210, reach = 120, s = 1, piece = i % SHARD_PIECES, lashAt = 0.6 } = {}) {
  const rx = Math.max(1, w / 2) + pad;
  const ry = Math.max(1, h / 2) + pad;
  const a0 = (i / Math.max(1, n)) * Math.PI * 2 - Math.PI / 2;
  const sw = (sweep * Math.PI) / 180;
  const tip = TIP_DEG[piece % SHARD_PIECES];
  const STEPS = 6; // keyframes along the lap — enough that the chords read as a curve
  const frames = [];
  let rot = null;
  for (let k = 0; k <= STEPS; k += 1) {
    const t = k / STEPS;
    const a = a0 + sw * t ** 1.6; // spin UP: slow out of the form, whipping by the lash
    const p = ringPoint(a, rx, ry);
    const q = ringPoint(a + 0.02, rx, ry);
    const r = near(deg(q.x - p.x, q.y - p.y) - tip, rot == null ? 0 : rot);
    rot = r;
    const sc = k === 0 ? s * 0.3 : s * (0.78 + 0.12 * t);
    frames.push({ offset: r1(t * lashAt * 1000) / 1000, opacity: k === 0 ? 0 : 1, transform: `translate3d(${r1(p.x)}px,${r1(p.y)}px,0) rotate(${r1(r)}deg) scale(${r1(sc * 100) / 100})`, easing: 'linear' });
  }
  frames[1].offset = Math.max(frames[1].offset, 0.06);
  // the LASH: turn onto the outward line and snap out (most of the travel in the first third), then fade
  const end = ringPoint(a0 + sw, rx, ry);
  const len = Math.hypot(end.x, end.y) || 1;
  const ux = end.x / len;
  const uy = end.y / len;
  const out = near(deg(ux, uy) - tip, rot);
  const at = (d, sc) => `translate3d(${r1(end.x + ux * d)}px,${r1(end.y + uy * d)}px,0) rotate(${r1(out)}deg) scale(${r1(sc * 100) / 100})`;
  frames[frames.length - 1].easing = 'cubic-bezier(.1,.8,.25,1)';
  frames.push({ offset: r1((lashAt + (1 - lashAt) * 0.45) * 1000) / 1000, opacity: 1, transform: at(reach * 0.85, s * 1.08), easing: 'cubic-bezier(.4,0,.9,.6)' });
  frames.push({ offset: 1, opacity: 0, transform: at(reach, s * 0.6) });
  return frames;
}
