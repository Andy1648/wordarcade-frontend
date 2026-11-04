// frameFx.js — the AVATAR FRAMES' painted COMPONENTS (Andy nov4: "for the frames i told you i want components … shards
// etc … the static ones look slop"). PURE: which component a frame wears and the keyframes it plays — FrameFx.jsx owns
// the nodes + the shared scheduler. Every frame tier is a DIFFERENT STRUCTURE, more dramatic each step (design
// research move 3), on top of #616's square frames (plain band < corner brackets < the art breaks the frame):
//   T1 band      (frost / graffiti / flame)   MOTES — 3 painted shards in the frame's colour rise off the bottom edge
//   T2 brackets  (the 5 mastery frames)       CORNERS — a painted crystal cluster GROWS out of each corner and cracks
//   T3 breaks    (arcade / jackpot)           CORNERS + an ORBIT — a ring of 6 painted blades laps the frame once
// One breath per frame every few seconds, one frame per scheduler tick (a leaderboard full of frames ripples, never
// fires at once); transform/opacity only; nothing loops.
export const FRAME_TIER = {
  frost: 1, graffiti: 1, flame: 1,
  bomb: 2, bolt: 2, scholar: 2, chain: 2, defuser: 2,
  arcade: 3, jackpot: 3,
};
/** The painted colour set a frame's components wear (fx/shards sets + the corner clusters). */
export const FRAME_SET = {
  frost: 'cyan', graffiti: 'pink', flame: 'gold',
  bomb: 'gold', bolt: 'cyan', scholar: 'gold', chain: 'cyan', defuser: 'cyan',
  arcade: 'violet', jackpot: 'gold',
};
export const CLUSTER_SETS = ['cyan', 'gold', 'violet'];
export const frameTier = (id) => FRAME_TIER[id] || 0;
export const frameSet = (id) => FRAME_SET[id] || 'cyan';
export const clusterSrc = (set) => `/fx/frame/cluster-${CLUSTER_SETS.includes(set) ? set : 'cyan'}-v1.webp`;

// the shared scheduler's rhythm (FrameFx.jsx): a frame breathes at most every BREATHE_EVERY_MS, one per tick
export const TICK_MS = 700;
export const BREATHE_EVERY_MS = 5600;
export const MOTE_MS = 1300;
export const CORNER_MS = 1000;
export const ORBIT_MS = 2000;
// below this slot size (px) a frame only wears its tier's lightest piece — a leaderboard face stays calm
export const SMALL_PX = 48;

/** The pieces a frame wears at a slot size: { motes, corners, orbit } counts. */
export function piecesFor(id, px = 100) {
  const t = frameTier(id);
  const small = px < SMALL_PX;
  if (t === 1) return { motes: small ? 2 : 3, corners: 0, orbit: 0 };
  if (t === 2) return { motes: 0, corners: small ? 2 : 4, orbit: 0 };
  if (t === 3) return { motes: 0, corners: small ? 2 : 4, orbit: small ? 0 : 6 };
  return { motes: 0, corners: 0, orbit: 0 };
}

const r1 = (n) => Math.round(n * 10) / 10;
/** A T1 MOTE: rises OUTSIDE the frame — up its left / right side drifting outward, or off its top — with a slow turn,
 *  then fades; it never crosses the face (k = the slot: 0 left side, 1 right side, 2 the top). */
export function moteFrames(k) {
  if (k === 2) {
    return [
      { opacity: 0, transform: 'translate(0%, 0%) rotate(-30deg) scale(0.4)', easing: 'cubic-bezier(.15,.7,.3,1)' },
      { opacity: 1, transform: 'translate(10%, -90%) rotate(-8deg) scale(1)', offset: 0.3, easing: 'cubic-bezier(.4,0,.6,1)' },
      { opacity: 1, transform: 'translate(25%, -190%) rotate(14deg) scale(0.9)', offset: 0.72, easing: 'ease-in' },
      { opacity: 0, transform: 'translate(35%, -260%) rotate(30deg) scale(0.55)' },
    ];
  }
  const side = k % 2 ? 1 : -1;
  const turn = side * (20 + k * 9);
  return [
    { opacity: 0, transform: `translate(0%, 0%) rotate(${-turn}deg) scale(0.4)`, easing: 'cubic-bezier(.15,.7,.3,1)' },
    { opacity: 1, transform: `translate(${r1(side * 20)}%, -120%) rotate(0deg) scale(1)`, offset: 0.3, easing: 'cubic-bezier(.4,0,.6,1)' },
    { opacity: 1, transform: `translate(${r1(side * 45)}%, -260%) rotate(${r1(turn * 0.6)}deg) scale(0.9)`, offset: 0.72, easing: 'ease-in' },
    { opacity: 0, transform: `translate(${r1(side * 60)}%, -360%) rotate(${turn}deg) scale(0.55)` },
  ];
}
/** A T2/T3 CORNER: the cluster GROWS out of its corner (overshoot), holds a beat, then CRACKS — a quick swell + fade. */
export function cornerFrames() {
  return [
    { opacity: 0, transform: 'scale(0.15)', easing: 'cubic-bezier(.2,1.5,.4,1)' },
    { opacity: 1, transform: 'scale(1.08)', offset: 0.28, easing: 'ease-out' },
    { opacity: 1, transform: 'scale(1)', offset: 0.62, easing: 'cubic-bezier(.5,0,.9,.5)' },
    { opacity: 0, transform: 'scale(1.22)' },
  ];
}
/** The T3 ORBIT: the blade ring fades in, laps the frame once, fades out (one finite turn). */
export function orbitFrames() {
  return [
    { opacity: 0, transform: 'rotate(0deg) scale(0.92)', easing: 'cubic-bezier(.35,.1,.5,.9)' },
    { opacity: 1, transform: 'rotate(70deg) scale(1)', offset: 0.18 },
    { opacity: 1, transform: 'rotate(290deg) scale(1)', offset: 0.82, easing: 'cubic-bezier(.5,.1,.65,.9)' },
    { opacity: 0, transform: 'rotate(360deg) scale(1.06)' },
  ];
}
