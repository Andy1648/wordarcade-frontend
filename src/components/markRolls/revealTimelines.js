// revealTimelines.js — PURE keyframe timelines for the MARK ROLL reveal. RollReveal.jsx plays each step with
// WAAPI on a FIXED pool of nodes (it never creates a node per roll). Every keyframe is transform/opacity only,
// every step ends inside its reveal window, and every node that flips or shrinks to nothing also FADES to 0
// (a node at scaleX(0.05) is a visible sliver — that was the stray "dot").
//
// ANDY (oct3, rolls reveal): COMMON = small pop · RARE = colour flash · EPIC = screen dims + burst ·
// LEGENDARY / MYTHIC / SECRET = full-screen 1.5 s (rarity colour plate, particle burst, "1 IN X" huge).
// THREE FEELS of that one spec, switched with ?mrv= (revealPlan.revealVersion):
//   a  SLAM   — everything lands from too big, overshoots, and the layer shakes; particles blast radially.
//   b  FLIP   — a face-down card turns over in front of a slow ray fan (a STATIC SVG, only rotated); sparks drift.
//   c  REEL   — a CS-case / pack reel of tier names spins down and lands on the tier, then the pack tears open.
//
// Pool (RollReveal.jsx): stage → shake (the stage's inner group), flash, back (the face-down coin), card,
// shine (the SHINY sweep), srays (b), sreel (c), m0..m9 (the ×10 grid). Cover (portalled into the MARKS
// overlay) → cover, cshake, dim, plate, packL/packR (c), rays (b), reel (c), final (tier name), show (art +
// name), stamp ("1 IN X"), p0..p11 (particles).
import { revealMs, isHeavy, revealKind, multiPlan, MULTI_FLIP_MS, TIER_LADDER, revealVersion } from './revealPlan.js';

export const LADDER = TIER_LADDER;
export const PARTICLES = 12;
const OUT = 'cubic-bezier(.2, .8, .2, 1)';
const IN = 'cubic-bezier(.6, 0, .9, .4)';
const SLAM = 'cubic-bezier(.5, 0, .75, 0)';

/** One animation over the whole window from [ms, frame] points — holds the first frame before the first
 *  point and the last after the last, so a node can wait, act, hold and leave in a single finite step. */
function track(node, D, points, easing) {
  const frames = [];
  if (points[0][0] > 0) frames.push({ ...points[0][1], offset: 0 });
  for (const [t, f] of points) frames.push({ ...f, offset: Math.max(0, Math.min(1, t / D)) });
  if (points[points.length - 1][0] < D) frames.push({ ...points[points.length - 1][1], offset: 1 });
  const s = { node, delay: 0, duration: D, frames };
  if (easing) s.easing = easing;
  return s;
}
const hide = (node, D) => track(node, D, [[0, { opacity: 0 }]]);
/** A short hard shake (translate only) starting at `at`. */
const jolt = (at, px) => [
  [at, { transform: 'translate(0px, 0px)' }],
  [at + 40, { transform: `translate(${-px}px, ${Math.round(px / 2)}px)` }],
  [at + 80, { transform: `translate(${px}px, ${-Math.round(px / 2)}px)` }],
  [at + 120, { transform: `translate(${-Math.round(px / 2)}px, ${Math.round(px / 3)}px)` }],
  [at + 170, { transform: 'translate(0px, 0px)' }],
];
/** Hard shakes (translate only) — ONE track per node, so two jolts never fight over the same transform. */
const shake = (node, D, at, px = 8, at2 = null, px2 = px) => track(node, D, at2 == null ? jolt(at, px) : [...jolt(at, px), ...jolt(at2, px2)]);

// ---- the result card landing, one per feel -----------------------------------------------------------
function cardLand(v, D, at) {
  const L = D - at;
  if (v === 'a') {
    return track('card', D, [
      [at, { opacity: 0, transform: 'scale(1.7) rotate(-6deg)' }],
      [at + L * 0.5, { opacity: 1, transform: 'scale(0.92) rotate(-1deg)' }],
      [D, { opacity: 1, transform: 'scale(1) rotate(0deg)' }],
    ], SLAM);
  }
  if (v === 'c') {
    return track('card', D, [
      [at, { opacity: 0, transform: 'translateY(-40%) scale(0.9)' }],
      [at + L * 0.6, { opacity: 1, transform: 'translateY(4%) scale(1.04)' }],
      [D, { opacity: 1, transform: 'translateY(0%) scale(1)' }],
    ], OUT);
  }
  return track('card', D, [
    [at, { opacity: 0, transform: 'scale(0, 1)' }],
    [at + L * 0.12, { opacity: 0, transform: 'scale(0.2, 1)' }],
    [at + L * 0.3, { opacity: 1, transform: 'scale(0.5, 1)' }],
    [at + L * 0.72, { opacity: 1, transform: 'scale(1.06, 1)' }],
    [D, { opacity: 1, transform: 'scale(1, 1)' }],
  ], OUT);
}

/** The reel (c): two copies of the ladder stacked, so it spins one full lap and lands on `tier` in the 2nd.
 *  translateY in % of the reel's OWN height — no layout read. */
export function reelStop(tier) {
  const rows = LADDER.length * 2;
  return -((LADDER.length + Math.max(0, LADDER.indexOf(tier))) * 100) / rows;
}
function reelSpin(node, D, from, landAt, tier, fadeAt) {
  const stop = reelStop(tier);
  const pts = [
    [from, { opacity: 1, transform: 'translateY(0%)' }],
    [from + (landAt - from) * 0.55, { opacity: 1, transform: `translateY(${(stop * 0.86).toFixed(3)}%)` }],
    [landAt - 40, { opacity: 1, transform: `translateY(${(stop - 1.2).toFixed(3)}%)` }],
    [landAt, { opacity: 1, transform: `translateY(${stop.toFixed(3)}%)` }],
  ];
  if (fadeAt != null) pts.push([fadeAt, { opacity: 1, transform: `translateY(${stop.toFixed(3)}%)` }], [fadeAt + 80, { opacity: 0, transform: `translateY(${stop.toFixed(3)}%)` }]);
  return track(node, D, pts);
}

/** Particle i's flight vector (deterministic: no Math.random in a timeline). */
export function particleVector(i, v) {
  const a = ((i * 30 + (i % 3) * 11 - 8) * Math.PI) / 180;
  const r = (v === 'a' ? 170 : v === 'b' ? 130 : 150) + (i % 4) * 26;
  return { dx: Math.round(Math.cos(a) * r), dy: Math.round(Math.sin(a) * r * 0.8), rot: (i % 2 ? 1 : -1) * (90 + i * 23) };
}
function particles(D, at, v) {
  const out = [];
  const life = v === 'a' ? 460 : v === 'b' ? 620 : 560;
  const end = Math.min(D, at + life);
  for (let i = 0; i < PARTICLES; i += 1) {
    const { dx, dy, rot } = particleVector(i, v);
    let mid;
    let fin;
    if (v === 'c') { // confetti: up and out, then falls
      mid = `translate(${dx}px, ${dy - 70}px) rotate(${Math.round(rot / 2)}deg) scale(1)`;
      fin = `translate(${Math.round(dx * 1.15)}px, ${dy + 90}px) rotate(${rot}deg) scale(0.8)`;
    } else if (v === 'b') { // sparks: drift outward and up
      mid = `translate(${Math.round(dx * 0.7)}px, ${Math.round(dy * 0.7) - 20}px) rotate(${Math.round(rot / 3)}deg) scale(1)`;
      fin = `translate(${dx}px, ${dy - 50}px) rotate(${Math.round(rot / 2)}deg) scale(0.6)`;
    } else { // shards: a hard radial blast
      mid = `translate(${Math.round(dx * 0.8)}px, ${Math.round(dy * 0.8)}px) rotate(${Math.round(rot * 0.7)}deg) scale(1.1)`;
      fin = `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(0.7)`;
    }
    out.push(track(`p${i}`, D, [
      [at, { opacity: 0, transform: 'translate(0px, 0px) rotate(0deg) scale(0.4)' }],
      [at + 20, { opacity: 1, transform: 'translate(0px, 0px) rotate(0deg) scale(0.6)' }],
      [at + (end - at) * 0.45, { opacity: 1, transform: mid }],
      [end, { opacity: 0, transform: fin }],
    ], v === 'c' ? 'linear' : OUT));
  }
  return out;
}

/** The beats of the cover layer (EPIC dim + burst, LEGENDARY+ full-screen), in ms. Exported for the test. */
export function coverBeats(tier, v = 'a') {
  const D = revealMs(tier);
  const full = isHeavy(tier);
  if (v === 'c') {
    const landAt = full ? 480 : 380;
    return { D, full, landAt, tearAt: landAt + 60, showAt: landAt + 120, burstAt: landAt + 120, stampAt: landAt + 360, outAt: D - 220 };
  }
  if (v === 'b') {
    return { D, full, finalAt: 120, showAt: 220, burstAt: 420, stampAt: 640, outAt: D - 220 };
  }
  return { D, full, finalAt: 80, showAt: full ? 420 : 160, burstAt: full ? 180 : 160, stampAt: 720, outAt: D - 220 };
}

function coverReveal(tier, v) {
  const b = coverBeats(tier, v);
  const { D, full, outAt } = b;
  const out = [
    track('cover', D, [[0, { opacity: 0 }], [80, { opacity: 1 }], [outAt, { opacity: 1 }], [D, { opacity: 0 }]]),
    hide('back', D),
  ];
  // EPIC: the screen DIMS (the MARKS layer under a dark sheet). LEGENDARY+: the RARITY COLOUR fills it.
  if (full) {
    out.push(hide('dim', D));
    if (v === 'a') out.push(track('plate', D, [[0, { opacity: 0, transform: 'scale(1.2)' }], [90, { opacity: 1, transform: 'scale(1)' }]], SLAM));
    else out.push(track('plate', D, [[0, { opacity: 0 }], [v === 'c' ? b.tearAt : 140, { opacity: v === 'c' ? 0 : 1 }], [v === 'c' ? b.tearAt + 1 : 141, { opacity: 1 }]]));
  } else {
    out.push(track('dim', D, [[0, { opacity: 0 }], [140, { opacity: 0.78 }]]));
    out.push(hide('plate', D));
  }
  // FINAL tier name (a slams it, b drops it in; c's reel IS the tier name)
  if (v === 'a') {
    out.push(track('final', D, [
      [b.finalAt, { opacity: 0, transform: 'scale(3) rotate(-8deg)' }],
      [b.finalAt + 110, { opacity: 1, transform: 'scale(0.9) rotate(-3deg)' }],
      [b.finalAt + 170, { opacity: 1, transform: 'scale(1) rotate(-3deg)' }],
    ], SLAM));
    out.push(shake('cshake', D, b.finalAt + 110, full ? 12 : 8, full ? b.stampAt + 110 : null, 10));
  } else if (v === 'b') {
    out.push(track('final', D, [[b.finalAt, { opacity: 0, transform: 'translateY(-30px)' }], [b.finalAt + 200, { opacity: 1, transform: 'translateY(0px)' }]], OUT));
    out.push(hide('cshake', D));
  } else {
    out.push(hide('final', D));
    out.push(hide('cshake', D));
  }
  // the mark itself (art + name)
  if (v === 'a') {
    out.push(track('show', D, [
      [b.showAt, { opacity: 0, transform: 'scale(2.2)' }],
      [b.showAt + 120, { opacity: 1, transform: 'scale(0.94)' }],
      [b.showAt + 180, { opacity: 1, transform: 'scale(1)' }],
    ], SLAM));
  } else if (v === 'b') {
    out.push(track('show', D, [
      [b.showAt, { opacity: 0, transform: 'scale(0, 1)' }],
      [b.showAt + 40, { opacity: 0, transform: 'scale(0.2, 1)' }],
      [b.showAt + 110, { opacity: 1, transform: 'scale(0.5, 1)' }],
      [b.showAt + 260, { opacity: 1, transform: 'scale(1.06, 1)' }],
      [b.showAt + 320, { opacity: 1, transform: 'scale(1, 1)' }],
    ], OUT));
  } else {
    out.push(track('show', D, [
      [b.showAt, { opacity: 0, transform: 'translateY(30px) scale(0.6)' }],
      [b.showAt + 160, { opacity: 1, transform: 'translateY(-6px) scale(1.05)' }],
      [b.showAt + 240, { opacity: 1, transform: 'translateY(0px) scale(1)' }],
    ], OUT));
  }
  // b: the ray fan (a static SVG) opens behind the mark and turns a few degrees — once
  if (v === 'b') {
    out.push(track('rays', D, [
      [100, { opacity: 0, transform: 'scale(0.4) rotate(0deg)' }],
      [400, { opacity: 1, transform: 'scale(1) rotate(20deg)' }],
      [D, { opacity: 1, transform: 'scale(1.1) rotate(60deg)' }],
    ], OUT));
  } else out.push(hide('rays', D));
  // c: the reel spins down and lands on the tier; then the PACK halves tear apart
  if (v === 'c') {
    out.push(reelSpin('reel', D, 60, b.landAt, tier, b.tearAt));
    out.push(track('packL', D, [[0, { opacity: 0, transform: 'translateX(0%) rotate(0deg)' }], [60, { opacity: 1, transform: 'translateX(0%) rotate(0deg)' }], [b.tearAt, { opacity: 1, transform: 'translateX(0%) rotate(0deg)' }], [b.tearAt + 200, { opacity: 0, transform: 'translateX(-70%) rotate(-8deg)' }]], IN));
    out.push(track('packR', D, [[0, { opacity: 0, transform: 'translateX(0%) rotate(0deg)' }], [60, { opacity: 1, transform: 'translateX(0%) rotate(0deg)' }], [b.tearAt, { opacity: 1, transform: 'translateX(0%) rotate(0deg)' }], [b.tearAt + 200, { opacity: 0, transform: 'translateX(70%) rotate(8deg)' }]], IN));
  } else {
    out.push(hide('reel', D), hide('packL', D), hide('packR', D));
  }
  // "1 IN X" — LEGENDARY+ only, huge
  if (full) {
    const s = b.stampAt;
    if (v === 'a') {
      out.push(track('stamp', D, [[s, { opacity: 0, transform: 'scale(3) rotate(-14deg)' }], [s + 110, { opacity: 1, transform: 'scale(0.95) rotate(-6deg)' }], [s + 170, { opacity: 1, transform: 'scale(1) rotate(-6deg)' }]], SLAM));
    } else if (v === 'b') {
      out.push(track('stamp', D, [[s, { opacity: 0, transform: 'translateY(40px) rotate(-6deg)' }], [s + 220, { opacity: 1, transform: 'translateY(0px) rotate(-6deg)' }]], OUT));
    } else {
      out.push(track('stamp', D, [[s, { opacity: 0, transform: 'scale(0.4) rotate(4deg)' }], [s + 160, { opacity: 1, transform: 'scale(1.08) rotate(-4deg)' }], [s + 240, { opacity: 1, transform: 'scale(1) rotate(-4deg)' }]], OUT));
    }
  } else out.push(hide('stamp', D));
  out.push(...particles(D, b.burstAt, v));
  // back to the panel: the card lands under the fading layer
  out.push(cardLand(v, D, outAt));
  return out;
}

function panelReveal(tier, v) {
  const D = revealMs(tier);
  const kind = revealKind(tier);
  if (kind === 'pop') {
    if (v === 'b') {
      return [
        { node: 'back', delay: 0, duration: 130, easing: IN, frames: [{ opacity: 1, transform: 'scale(1, 1)' }, { opacity: 1, transform: 'scale(0.15, 1)', offset: 0.8 }, { opacity: 0, transform: 'scale(0, 1)' }] },
        cardLand('b', D, 130),
      ];
    }
    if (v === 'c') return [hide('back', D), reelSpin('sreel', D, 0, 170, tier, 180), cardLand('c', D, 170)];
    return [hide('back', D), track('card', D, [[0, { opacity: 0, transform: 'scale(0.5)' }], [150, { opacity: 1, transform: 'scale(1.12)' }], [D, { opacity: 1, transform: 'scale(1)' }]], OUT)];
  }
  // RARE: a COLOUR FLASH (the stage flashes the tier colour)
  if (v === 'a') {
    return [
      track('back', D, [[0, { opacity: 1, transform: 'rotate(0deg) scale(1)' }], [120, { opacity: 1, transform: 'rotate(-6deg) scale(1.08)' }], [240, { opacity: 1, transform: 'rotate(5deg) scale(1.14)' }], [300, { opacity: 0, transform: 'rotate(0deg) scale(1.4)' }]]),
      track('flash', D, [[280, { opacity: 0 }], [330, { opacity: 0.9 }], [560, { opacity: 0 }]]),
      cardLand('a', D, 300),
      shake('shake', D, 450, 6),
    ];
  }
  if (v === 'b') {
    return [
      { node: 'back', delay: 0, duration: 220, easing: IN, frames: [{ opacity: 1, transform: 'scale(1, 1)' }, { opacity: 1, transform: 'scale(0.15, 1)', offset: 0.8 }, { opacity: 0, transform: 'scale(0, 1)' }] },
      track('flash', D, [[180, { opacity: 0 }], [240, { opacity: 0.85 }], [480, { opacity: 0 }]]),
      track('srays', D, [[160, { opacity: 0, transform: 'scale(0.5) rotate(0deg)' }], [400, { opacity: 0.9, transform: 'scale(1) rotate(15deg)' }], [D, { opacity: 0, transform: 'scale(1.1) rotate(35deg)' }]], OUT),
      cardLand('b', D, 220),
    ];
  }
  return [
    hide('back', D),
    reelSpin('sreel', D, 0, 420, tier, 430),
    track('flash', D, [[420, { opacity: 0 }], [460, { opacity: 0.9 }], [640, { opacity: 0 }]]),
    cardLand('c', D, 440),
  ];
}

/** The steps for one reveal. Reduced motion → [] (RollReveal holds a STATIC frame for the same revealMs). */
export function timeline(tier, reduced = false, v = revealVersion(), { shiny = false } = {}) {
  if (reduced) return [];
  const kind = revealKind(tier);
  const steps = kind === 'burst' || kind === 'full' ? coverReveal(tier, v) : panelReveal(tier, v);
  if (shiny) {
    // SHINY: one gold sweep across the landed card (a static streak asset, moved once)
    const D = revealMs(tier);
    const at = Math.max(0, D - 260);
    steps.push(track('shine', D, [[at, { opacity: 0, transform: 'translateX(-120%)' }], [at + 30, { opacity: 1, transform: 'translateX(-90%)' }], [D, { opacity: 0, transform: 'translateX(120%)' }]], 'linear'));
  }
  return steps;
}

/** One ×10 tile flipping in (the feel follows the version). */
function tileIn(node, at, v) {
  const frames = v === 'a'
    ? [{ opacity: 0, transform: 'scale(1.6)' }, { opacity: 1, transform: 'scale(0.92)', offset: 0.6 }, { opacity: 1, transform: 'scale(1)' }]
    : v === 'c'
      ? [{ opacity: 0, transform: 'translateY(-60%)' }, { opacity: 1, transform: 'translateY(6%)', offset: 0.7 }, { opacity: 1, transform: 'translateY(0%)' }]
      : [{ opacity: 0, transform: 'scale(0, 1)' }, { opacity: 1, transform: 'scale(0.5, 1)', offset: 0.35 }, { opacity: 1, transform: 'scale(1, 1)' }];
  return { node, delay: at, duration: MULTI_FLIP_MS, easing: OUT, frames };
}

/**
 * ×10: the other nine flip in 80 ms apart, then the BEST card gets its tier's full reveal LAST — the same
 * timeline a single roll of that tier plays, shifted to multiPlan().bestAt, with the card = the best tile.
 */
export function multiTimeline(results, reduced = false, v = revealVersion()) {
  if (reduced || !results || !results.length) return [];
  const plan = multiPlan(results);
  const best = results[plan.best];
  const steps = plan.flips.map((f) => tileIn(`m${f.idx}`, f.at, v));
  for (const s of timeline(best.tier, false, v)) {
    if (s.node === 'back' || s.node === 'shine') continue; // no coin, no big-card sweep in the grid
    steps.push({ ...s, node: s.node === 'card' ? `m${plan.best}` : s.node, delay: s.delay + plan.bestAt });
  }
  return steps;
}
export { isHeavy };
