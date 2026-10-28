// popMotion.js — every POP STYLE moves like its theme (oct27, Andy: "better animations … on the key pops", "i want the
// keys to be more special"). The +N no longer shares one arc with a different paint job: CHROME drops like a steel plate,
// INFERNO flares up and burns out, VOID spirals in and gets sucked away, FROST slides in and freezes dead … Each motion is
// one finite keyframe list for the SAME pooled pop node (MenuXp letterPop / tapPop) — transform + opacity only.
//
//   motion(C, rot, s, peak, rise) → { frames, ms, hit, spin }
//     frames — the pop's keyframes (C = the node's centring prefix)
//     ms     — × the pop's tier length (on top of POP_STRETCH)
//     hit    — the fraction of the pop where it LANDS (the painted burst slams in then)
//     spin   — degrees the painted burst turns over its life
// Every frame of a motion keeps the same transform function list, so rotations past 180° interpolate as written.

const k = (C, x, y, r, sx, sy, o, offset, easing) => {
  const f = { transform: `${C}translate(${x}px,${y}px) rotate(${r}deg) scale(${sx},${sy})`, opacity: o, offset };
  if (easing) f.easing = easing;
  return f;
};
const POP_IN = 'cubic-bezier(.2,1.4,.4,1)';
const DROP = 'cubic-bezier(.55,0,1,.45)';

const MOTIONS = {
  // a steel plate DROPS from above, lands with a heavy squash, barely bounces, then shutters closed
  chrome: (C, r, s, p, rise) => ({ ms: 1, hit: 0.12, spin: 0, frames: [
    k(C, 0, -80, r * 0.3, s * 1.25, s * 1.25, 0, 0, DROP),
    k(C, 0, 0, r * 0.3, s * 1.3 * p, s * 0.68, 1, 0.12, 'ease-out'),
    k(C, 0, -12, r * 0.3, s * 0.94, s * 1.08, 1, 0.2, 'ease-in-out'),
    k(C, 0, 0, r * 0.3, s, s, 1, 0.27, 'linear'),
    k(C, 0, -6, r * 0.3, s, s, 1, 0.74, 'ease-in'),
    k(C, 0, -rise * 0.5, r * 0.3, s * 1.12, s * 0.05, 0, 1),
  ] }),
  // a FLARE: shoots up stretched, flickers while it is read, then burns out rising
  inferno: (C, r, s, p, rise) => ({ ms: 1, hit: 0.12, spin: 14, frames: [
    k(C, 0, 26, r, s * 0.4, s * 0.6, 0, 0, POP_IN),
    k(C, 0, -16, r, s * 0.84, s * 1.3 * p, 1, 0.12, 'ease-out'),
    k(C, 0, -20, r, s * 1.08, s * 0.94, 1, 0.22, 'ease-in-out'),
    k(C, 0, -23, r, s * 0.97, s * 1.06, 1, 0.33, 'ease-in-out'),
    k(C, 0, -26, r, s * 1.04, s * 0.97, 1, 0.46, 'ease-in-out'),
    k(C, 0, -30, r, s, s, 1, 0.7, 'ease-in'),
    k(C, 0, -rise * 2, r, s * 0.5, s * 1.25, 0, 1),
  ] }),
  // a VORTEX: spins in from nothing, holds, gets sucked back out spinning the other way
  void: (C, r, s, p) => ({ ms: 1.05, hit: 0.18, spin: 160, frames: [
    k(C, 0, 0, r - 240, s * 0.08, s * 0.08, 0, 0, 'cubic-bezier(.2,1.2,.4,1)'),
    k(C, 0, -6, r + 12, s * 1.16 * p, s * 1.16 * p, 1, 0.18, 'ease-out'),
    k(C, 0, -10, r, s, s, 1, 0.28, 'linear'),
    k(C, 0, -14, r - 4, s, s, 1, 0.7, 'cubic-bezier(.6,0,1,.6)'),
    k(C, 0, -10, r + 300, s * 0.04, s * 0.04, 0, 1),
  ] }),
  // SHARDS: snaps in jittering between facets, settles, then SHATTERS flat
  prism: (C, r, s, p) => ({ ms: 1, hit: 0.06, spin: 30, frames: [
    k(C, -30, 0, r - 8, s * 0.6, s * 0.6, 0, 0, 'ease-out'),
    k(C, 16, -6, r + 6, s * 1.12 * p, s * 0.9, 1, 0.06, 'ease-out'),
    k(C, -9, -10, r - 4, s * 0.94, s * 1.06, 1, 0.12, 'ease-out'),
    k(C, 5, -12, r + 2, s * 1.03, s * 1.03, 1, 0.18, 'ease-out'),
    k(C, 0, -14, r, s, s, 1, 0.24, 'linear'),
    k(C, 0, -20, r, s, s, 1, 0.72, 'ease-in'),
    k(C, 7, -22, r + 3, s * 1.14, s * 1.14, 1, 0.82, 'ease-in'),
    k(C, -5, -26, r - 3, s * 1.7, s * 0.3, 0, 1),
  ] }),
  // a GLOOP: splats in flat, wobbles like jelly, then DRIPS down off the screen
  toxic: (C, r, s, p, rise) => ({ ms: 1.05, hit: 0.12, spin: 0, frames: [
    k(C, 0, 10, r, s * 1.6, s * 0.3, 0, 0, 'ease-out'),
    k(C, 0, -8, r, s * 0.76, s * 1.32 * p, 1, 0.12, 'ease-in-out'),
    k(C, 0, -12, r, s * 1.2, s * 0.84, 1, 0.22, 'ease-in-out'),
    k(C, 0, -14, r, s * 0.92, s * 1.08, 1, 0.32, 'ease-in-out'),
    k(C, 0, -14, r, s * 1.04, s * 0.97, 1, 0.42, 'ease-out'),
    k(C, 0, -14, r, s, s, 1, 0.72, 'cubic-bezier(.6,0,.9,.5)'),
    k(C, 0, rise * 1.1, r, s * 0.78, s * 1.4, 0, 1),
  ] }),
  // a SPARK: launched on a ballistic arc out of the key, hangs, then tumbles away the other side
  ember: (C, r, s, p, rise) => {
    const d = r >= 0 ? 1 : -1;
    return { ms: 1, hit: 0.14, spin: 40 * d, frames: [
      k(C, -36 * d, 24, r - 24 * d, s * 0.5, s * 0.5, 0, 0, 'ease-out'),
      k(C, -12 * d, -26, r - 6 * d, s * 1.12 * p, s * 1.12 * p, 1, 0.14, 'ease-out'),
      k(C, 0, -32, r, s, s, 1, 0.26, 'linear'),
      k(C, 8 * d, -36, r + 5 * d, s, s, 1, 0.7, 'cubic-bezier(.4,0,1,.7)'),
      k(C, 46 * d, rise * 0.6, r + 60 * d, s * 0.6, s * 0.6, 0, 1),
    ] };
  },
  // a SLIDE that FREEZES: skates in fast, overshoots, stops dead — then nothing moves until it cracks and is gone
  frost: (C, r, s, p) => {
    const d = r >= 0 ? 1 : -1;
    return { ms: 1, hit: 0.1, spin: 0, frames: [
      k(C, -80 * d, 0, r * 0.3, s * 1.5, s * 0.72, 0, 0, 'cubic-bezier(.1,.9,.2,1)'),
      k(C, 8 * d, 0, r * 0.3, s * 0.9 * p, s * 1.1, 1, 0.1, 'ease-out'),
      k(C, 0, 0, r * 0.3, s, s, 1, 0.16, 'linear'),
      k(C, 0, 0, r * 0.3, s, s, 1, 0.8, 'ease-in'),
      k(C, 2 * d, 0, r * 0.3 + 2 * d, s * 1.1, s * 1.1, 1, 0.86, 'ease-in'),
      k(C, 0, 8, r * 0.3, s * 0.94, s * 0.94, 0, 1),
    ] };
  },
  // a COIN: flips up (rotateY), falls back and bounces on the table, then flips away
  gold: (C, r, s, p, rise) => {
    const g = (y, ry, sx, sy, o, offset, easing) => {
      const f = { transform: `${C}translate(0px,${y}px) perspective(500px) rotateY(${ry}deg) rotate(${r * 0.4}deg) scale(${sx},${sy})`, opacity: o, offset };
      if (easing) f.easing = easing;
      return f;
    };
    return { ms: 1.1, hit: 0.34, spin: 0, frames: [
      g(20, -720, s * 0.5, s * 0.5, 0, 0, 'cubic-bezier(.2,.8,.4,1)'),
      g(-36, -60, s * p, s * p, 1, 0.24, 'cubic-bezier(.6,0,1,.6)'),
      g(-6, 0, s * 1.12, s * 0.86, 1, 0.34, 'ease-out'),
      g(-16, 0, s * 0.97, s * 1.04, 1, 0.42, 'ease-in-out'),
      g(-12, 0, s, s, 1, 0.48, 'linear'),
      g(-16, 0, s, s, 1, 0.76, 'ease-in'),
      g(-rise, 360, s * 0.9, s * 0.9, 0, 1),
    ] };
  },
  // a ZAP: teleports in as hard jumps (stepped), crackles once mid-read, then zaps out flat
  plasma: (C, r, s, p) => ({ ms: 1, hit: 0.15, spin: 0, frames: [
    k(C, -20, 10, r, s, s, 0, 0, 'steps(1, end)'),
    k(C, 16, -14, r + 6, s * 1.1, s * 1.1, 0.6, 0.05, 'steps(1, end)'),
    k(C, -9, -4, r - 6, s * 0.9, s * 0.9, 1, 0.1, 'steps(1, end)'),
    k(C, 0, -14, r, s * 1.24 * p, s * 1.24 * p, 1, 0.15, 'ease-out'),
    k(C, 0, -14, r, s, s, 1, 0.25, 'linear'),
    k(C, 0, -17, r, s, s, 1, 0.6, 'steps(1, end)'),
    k(C, 4, -17, r + 3, s * 1.06, s * 1.06, 0.5, 0.64, 'steps(1, end)'),
    k(C, 0, -18, r, s, s, 1, 0.68, 'linear'),
    k(C, 0, -19, r, s, s, 1, 0.84, 'ease-in'),
    k(C, 0, -20, r, s * 2.3, s * 0.05, 0, 1),
  ] }),
  // a SUPERNOVA: ignites from a point to a huge flash, holds, collapses a little — then blows outward
  nova: (C, r, s, p) => ({ ms: 1.05, hit: 0.14, spin: 22, frames: [
    k(C, 0, 0, r, s * 0.05, s * 0.05, 0, 0, 'cubic-bezier(.2,1.6,.4,1)'),
    k(C, 0, -6, r, s * 1.75 * p, s * 1.75 * p, 1, 0.14, 'ease-out'),
    k(C, 0, -12, r, s, s, 1, 0.3, 'linear'),
    k(C, 0, -16, r, s * 1.02, s * 1.02, 1, 0.72, 'ease-in'),
    k(C, 0, -18, r, s * 0.82, s * 0.82, 1, 0.84, 'ease-in'),
    k(C, 0, -20, r, s * 2.5, s * 2.5, 0, 1),
  ] }),
  // a SLOW RISE AND SET: climbs up on a tilt like a moon, hangs, sets back down the other side
  eclipse: (C, r, s, p) => ({ ms: 1.18, hit: 0.3, spin: -40, frames: [
    k(C, -18, 44, r - 30, s * 0.7, s * 0.7, 0, 0, 'ease-out'),
    k(C, -4, -10, r - 4, s * 1.08 * p, s * 1.08 * p, 1, 0.3, 'ease-in-out'),
    k(C, 0, -14, r, s, s, 1, 0.4, 'linear'),
    k(C, 4, -20, r + 4, s, s, 1, 0.74, 'ease-in'),
    k(C, 22, 34, r + 30, s * 0.7, s * 0.7, 0, 1),
  ] }),
  // a TITLE DROP: slams down from huge, shakes the screen, holds the longest, then spins off into the sky
  legend: (C, r, s, p, rise) => ({ ms: 1.2, hit: 0.1, spin: 60, frames: [
    k(C, 0, -54, r - 14, s * 2.4, s * 2.4, 0, 0, 'cubic-bezier(.5,0,.9,.4)'),
    k(C, 0, 0, r, s * 1.14 * p, s * 0.84, 1, 0.1, 'linear'),
    k(C, -8, 0, r, s * 1.05, s * 1.05, 1, 0.14, 'linear'),
    k(C, 7, 0, r, s, s, 1, 0.18, 'linear'),
    k(C, -3, -4, r, s * 1.02, s * 1.02, 1, 0.22, 'ease-out'),
    k(C, 0, -6, r, s, s, 1, 0.26, 'linear'),
    k(C, 0, -12, r, s, s, 1, 0.74, 'ease-in'),
    k(C, 0, -20, r, s * 1.1, s * 1.1, 1, 0.84, 'ease-in'),
    k(C, 0, -rise * 1.5, r + 360, s * 0.3, s * 0.3, 0, 1),
  ] }),
};

/** The look's own pop motion, or null (CLASSIC and unknown ids keep the shared arc). */
export function popMotionOf(id) {
  return (id && MOTIONS[id]) || null;
}
export const POP_MOTION_IDS = Object.keys(MOTIONS);
