// revealTimelines.js — PURE keyframe timelines for the MARK ROLL reveal (the oct3 review's hybrid on version A).
// RollReveal.jsx plays each step with WAAPI on a FIXED pool of nodes (it never creates a node per roll). Every
// keyframe is transform/opacity only, every step ends inside revealMs(tier), and every node that flips or
// shrinks to nothing also FADES to 0 (a node at scaleX(0.05) is a visible sliver — that was the stray "dot").
//
// Pool: back (the face-down coin), card (the result card), flash (a tier plate, rares), and the cutscene layer:
// cover, ladder (the tier bars' group), bar0..bar4 (the tiers below the result), final (the result's tier, huge),
// show (the mark's art + name, big) and stamp ("1 IN X", huge). The cutscene plays for LEGENDARY+ only.
import { revealMs, isHeavy } from './revealPlan.js';

export const LADDER = ['common', 'rare', 'epic', 'legendary', 'mythic', 'secret'];
const OUT = 'cubic-bezier(.2, .8, .2, 1)';
const IN = 'cubic-bezier(.6, 0, .9, .4)';

/** One animation over the whole reveal from [ms, frame] points — holds the first frame before the first
 *  point and the last after the last, so a node can wait, act, hold and leave in a single finite step. */
function track(node, D, points) {
  const frames = [];
  if (points[0][0] > 0) frames.push({ ...points[0][1], offset: 0 });
  for (const [t, f] of points) frames.push({ ...f, offset: Math.max(0, Math.min(1, t / D)) });
  if (points[points.length - 1][0] < D) frames.push({ ...points[points.length - 1][1], offset: 1 });
  return { node, delay: 0, duration: D, frames };
}
const backFlip = (delay, duration, from = 'rotate(0deg) scale(1, 1)') => ({
  node: 'back', delay, duration, easing: IN,
  frames: [
    { opacity: 1, transform: from },
    { opacity: 1, transform: 'rotate(0deg) scale(0.15, 1)', offset: 0.8 },
    { opacity: 0, transform: 'rotate(0deg) scale(0, 1)' },
  ],
});
const cardFlip = (delay, duration) => ({
  node: 'card', delay, duration, easing: OUT,
  frames: [
    { opacity: 0, transform: 'scale(0, 1)' },
    { opacity: 0, transform: 'scale(0.2, 1)', offset: 0.12 },
    { opacity: 1, transform: 'scale(0.5, 1)', offset: 0.3 },
    { opacity: 1, transform: 'scale(1.06, 1)', offset: 0.72 },
    { opacity: 1, transform: 'scale(1, 1)' },
  ],
});

/** The beats of the EPIC / LEGENDARY cutscene, in ms (exported for the test + the reduced-motion hold). */
export function cutsceneBeats(tier) {
  const D = revealMs(tier);
  const below = Math.max(0, LADDER.indexOf(tier)); // ladder bars under the result's tier
  const S = 220;
  const finalAt = 150 + below * S;
  const showAt = finalAt + 500;
  const stampAt = showAt + 340;
  return { D, below, S, finalAt, showAt, stampAt, outAt: D - 250 };
}

function cutscene(tier) {
  const { D, below, S, finalAt, showAt, stampAt, outAt } = cutsceneBeats(tier);
  const out = [
    track('cover', D, [[0, { opacity: 0 }], [150, { opacity: 1 }], [outAt, { opacity: 1 }], [D, { opacity: 0 }]]),
    track('back', D, [[0, { opacity: 0 }]]),
    track('ladder', D, [[showAt, { opacity: 1 }], [showAt + 150, { opacity: 0 }]]),
  ];
  for (let i = 0; i < LADDER.length - 1; i += 1) {
    if (i >= below) { out.push(track(`bar${i}`, D, [[0, { opacity: 0 }]])); continue; }
    const at = 150 + i * S;
    out.push(track(`bar${i}`, D, [[at, { opacity: 0, transform: 'scaleX(0)' }], [at + 200, { opacity: 1, transform: 'scaleX(1)' }]]));
  }
  // the FINAL tier: lands huge in its own colour, holds, then makes way for the mark itself
  out.push(track('final', D, [
    [finalAt, { opacity: 0, transform: 'scale(2.2)' }],
    [finalAt + 120, { opacity: 1, transform: 'scale(0.94)' }],
    [finalAt + 300, { opacity: 1, transform: 'scale(1)' }],
    [showAt, { opacity: 1, transform: 'scale(1)' }],
    [showAt + 150, { opacity: 0, transform: 'scale(1)' }],
  ]));
  // the mark's NAME + art, big
  out.push(track('show', D, [
    [showAt, { opacity: 0, transform: 'scale(0.6)' }],
    [showAt + 180, { opacity: 1, transform: 'scale(1.05)' }],
    [showAt + 280, { opacity: 1, transform: 'scale(1)' }],
  ]));
  // then "1 IN X"
  out.push({ ...track('stamp', D, [
    [stampAt, { opacity: 0, transform: 'scale(2.4) rotate(-10deg)' }],
    [stampAt + 300, { opacity: 1, transform: 'scale(1) rotate(-6deg)' }],
  ]), easing: 'linear' });
  // back to the panel: the card is already flipping open under the fading plate
  out.push(track('card', D, [[outAt, { opacity: 0, transform: 'scale(0, 1)' }], [outAt + 60, { opacity: 1, transform: 'scale(0.5, 1)' }], [D, { opacity: 1, transform: 'scale(1, 1)' }]]));
  return out;
}

/** The steps for one reveal. Reduced motion → [] (RollReveal holds a STATIC frame for the same revealMs). */
export function timeline(tier, reduced = false) {
  if (reduced) return [];
  const D = revealMs(tier);
  if (tier === 'common') {
    return [backFlip(0, 130), cardFlip(130, D - 130)];
  }
  if (tier === 'rare' || tier === 'epic') {
    // the same wobble build-up, stretched to the tier's window: EPIC holds the coin longer before the flip
    const B = Math.round(D * 0.77); // the build-up (rare 540 of 700)
    return [
      {
        node: 'back', delay: 0, duration: B, easing: 'linear',
        frames: [
          { opacity: 1, transform: 'rotate(0deg) scale(1, 1)' },
          { opacity: 1, transform: 'rotate(-4deg) scale(1.04, 1.04)', offset: 0.18 },
          { opacity: 1, transform: 'rotate(4deg) scale(1.08, 1.08)', offset: 0.38 },
          { opacity: 1, transform: 'rotate(-3deg) scale(1.1, 1.1)', offset: 0.58 },
          { opacity: 1, transform: 'rotate(0deg) scale(1.12, 1.12)', offset: 0.76 },
          { opacity: 1, transform: 'rotate(0deg) scale(0.15, 1.12)', offset: 0.94 },
          { opacity: 0, transform: 'rotate(0deg) scale(0, 1.12)' },
        ],
      },
      { node: 'flash', delay: B - 140, duration: 260, frames: [{ opacity: 0 }, { opacity: 0.85, offset: 0.3 }, { opacity: 0 }] },
      cardFlip(B, D - B),
    ];
  }
  if (!isHeavy(tier)) return [backFlip(0, 130), cardFlip(130, D - 130)];
  return cutscene(tier);
}
export { isHeavy };
