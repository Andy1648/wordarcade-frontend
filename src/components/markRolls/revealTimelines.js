// revealTimelines.js — PURE keyframe timelines for the three MARK ROLL reveals (?mrv=a|b|c). RollReveal.jsx
// plays each step with WAAPI on a FIXED pool of nodes (it never creates a node per roll). Every keyframe is
// transform/opacity only and every step ends inside revealMs(tier, version) — revealPlan.test.js checks both.
//
// Node names (the pool): back (the face-down card), card (the result card), flash (a tier-coloured plate),
// reel (the name strip, 6 slots), cover (the full-panel cutscene layer), bar0..bar3 (the tier ladder),
// tierWord (the tier stamp) and stamp (the big "1 IN X").
import { revealMs, isHeavy } from './revealPlan.js';

export const REEL_SLOTS = 6;
export const BAR_TIERS = ['common', 'rare', 'epic', 'legendary'];
const POP = 'cubic-bezier(.2, 1.3, .35, 1)';
const OUT = 'cubic-bezier(.2, .8, .2, 1)';
const IN = 'cubic-bezier(.6, 0, .9, .4)';
const SLOW = 'cubic-bezier(.08, .75, .15, 1)';

const hide = (node, D) => ({ node, delay: 0, duration: D, frames: [{ opacity: 0 }, { opacity: 0 }] });
const cardIn = (delay, duration) => ({
  node: 'card', delay, duration, easing: OUT,
  frames: [{ opacity: 0, transform: 'scaleX(0)' }, { opacity: 1, transform: 'scaleX(1.06)', offset: 0.7 }, { opacity: 1, transform: 'scaleX(1)' }],
});
const backOut = (delay, duration, from = 'scale(1, 1)') => ({
  node: 'back', delay, duration, easing: IN,
  frames: [{ opacity: 1, transform: `rotate(0deg) ${from}` }, { opacity: 1, transform: 'rotate(0deg) scale(0, 1)' }],
});
const cardHidden = (until) => ({ node: 'card', delay: 0, duration: until, frames: [{ opacity: 0 }, { opacity: 0 }] });
// the cutscene layer: in, hold, out — one animation over the whole reveal
const cover = (D, inAt, outAt, outTransform = 'scale(1)') => ({
  node: 'cover', delay: 0, duration: D,
  frames: [
    { opacity: 0, transform: 'scale(1)' },
    { opacity: 0, transform: 'scale(1)', offset: inAt / D },
    { opacity: 1, transform: 'scale(1)', offset: Math.min(1, (inAt + 150) / D) },
    { opacity: 1, transform: 'scale(1)', offset: outAt / D },
    { opacity: 0, transform: outTransform },
  ],
});
const stampHit = (node, delay, duration, from, to) => ({
  node, delay, duration, easing: POP,
  frames: [{ opacity: 0, transform: from }, { opacity: 1, transform: to }],
});

/** A: FLIP — a face-down card flips; rares wobble first; EPIC+ climbs the tier ladder (Starr-Drop). */
function versionA(tier, D) {
  if (tier === 'common') return [backOut(0, 130), cardHidden(130), cardIn(130, D - 130)];
  if (tier === 'rare') {
    return [
      {
        node: 'back', delay: 0, duration: 540, easing: 'linear',
        frames: [
          { opacity: 1, transform: 'rotate(0deg) scale(1, 1)' },
          { opacity: 1, transform: 'rotate(-4deg) scale(1.04, 1.04)', offset: 0.18 },
          { opacity: 1, transform: 'rotate(4deg) scale(1.08, 1.08)', offset: 0.38 },
          { opacity: 1, transform: 'rotate(-3deg) scale(1.1, 1.1)', offset: 0.58 },
          { opacity: 1, transform: 'rotate(0deg) scale(1.12, 1.12)', offset: 0.76 },
          { opacity: 1, transform: 'rotate(0deg) scale(0, 1.12)' },
        ],
      },
      { node: 'flash', delay: 400, duration: 260, frames: [{ opacity: 0 }, { opacity: 0.85, offset: 0.3 }, { opacity: 0 }] },
      cardHidden(540),
      cardIn(540, D - 540),
    ];
  }
  const steps = tier === 'legendary' ? 4 : 3;
  const S = (D - 1000) / steps;
  const out = [cover(D, 0, D - 260)];
  for (let i = 0; i < BAR_TIERS.length; i += 1) {
    if (i >= steps) { out.push(hide(`bar${i}`, D)); continue; }
    out.push({
      node: `bar${i}`, delay: 150 + i * S, duration: 240, easing: POP,
      frames: [{ opacity: 0, transform: 'scaleX(0)' }, { opacity: 1, transform: 'scaleX(1)' }],
    });
  }
  out.push(stampHit('stamp', D - 850, 300, 'scale(2.4) rotate(-10deg)', 'scale(1) rotate(-6deg)'));
  out.push(hide('tierWord', D));
  out.push(backOut(D - 300, 130));
  out.push(cardHidden(D - 170));
  out.push(cardIn(D - 170, 170));
  return out;
}

/** B: REEL — Sol's RNG: names spin past and slow onto the result; EPIC+ cuts to a dark plate + stamps. */
function versionB(tier, D) {
  const land = tier === 'common' ? D - 60 : tier === 'rare' ? D - 140 : D - 1100;
  const reel = {
    node: 'reel', delay: 0, duration: land, easing: tier === 'common' ? OUT : SLOW,
    frames: [{ opacity: 1, transform: 'translateY(0%)' }, { opacity: 1, transform: `translateY(${(-100 * (REEL_SLOTS - 1)) / REEL_SLOTS}%)` }],
  };
  const out = [hide('back', D), reel];
  if (tier === 'common' || tier === 'rare') {
    if (tier === 'rare') out.push({ node: 'flash', delay: land - 120, duration: 200, frames: [{ opacity: 0 }, { opacity: 0.85, offset: 0.35 }, { opacity: 0 }] });
    out.push({ node: 'reelOut', delay: land, duration: D - land, frames: [{ opacity: 1 }, { opacity: 0 }] });
    out.push(cardHidden(land));
    out.push({ node: 'card', delay: land, duration: D - land, easing: OUT, frames: [{ opacity: 0, transform: 'scale(0.9)' }, { opacity: 1, transform: 'scale(1)' }] });
    return out;
  }
  out.push(cover(D, land, D - 250));
  out.push(stampHit('tierWord', D - 950, 260, 'scale(2.2) rotate(8deg)', 'scale(1) rotate(-4deg)'));
  out.push(stampHit('stamp', D - 700, 300, 'scale(2.6) rotate(-12deg)', 'scale(1) rotate(-6deg)'));
  for (let i = 0; i < BAR_TIERS.length; i += 1) out.push(hide(`bar${i}`, D));
  out.push({ node: 'reelOut', delay: land, duration: 120, frames: [{ opacity: 1 }, { opacity: 0 }] });
  out.push(cardHidden(D - 250));
  out.push({ node: 'card', delay: D - 250, duration: 250, easing: POP, frames: [{ opacity: 0, transform: 'scale(1.3)' }, { opacity: 1, transform: 'scale(1)' }] });
  return out;
}

/** C: STAMP — the bounty press: the card drops and squashes; EPIC+ slams "1 IN X" first, then the tier. */
function versionC(tier, D) {
  const drop = (delay, duration) => ({
    node: 'card', delay, duration, easing: 'linear',
    frames: [
      { opacity: 0, transform: 'translateY(-28px) scale(1.18, 1.18)' },
      { opacity: 1, transform: 'translateY(0px) scale(1.06, 0.9)', offset: 0.6 },
      { opacity: 1, transform: 'translateY(0px) scale(0.98, 1.03)', offset: 0.82 },
      { opacity: 1, transform: 'translateY(0px) scale(1, 1)' },
    ],
  });
  if (tier === 'common') return [hide('back', D), drop(0, D)];
  if (tier === 'rare') {
    return [
      hide('back', D),
      { node: 'flash', delay: 0, duration: 380, easing: OUT, frames: [{ opacity: 1, transform: 'translateX(-110%)' }, { opacity: 1, transform: 'translateX(110%)' }] },
      cardHidden(380),
      drop(380, D - 380),
    ];
  }
  const out = [hide('back', D), cover(D, 0, D - 350, 'scale(0.6)')];
  out.push(stampHit('stamp', 150, 320, 'scale(3) rotate(0deg)', 'scale(1) rotate(-6deg)'));
  out.push(stampHit('tierWord', D - 900, 280, 'scale(2.2) rotate(-14deg)', 'scale(1) rotate(-8deg)'));
  for (let i = 0; i < BAR_TIERS.length; i += 1) out.push(hide(`bar${i}`, D));
  out.push(cardHidden(D - 300));
  out.push(drop(D - 300, 300));
  return out;
}

/** The steps for one reveal. Reduced motion → [] (the static card holds for the same revealMs). */
export function timeline(version, tier, reduced = false) {
  if (reduced) return [];
  const D = revealMs(tier, version);
  const fn = version === 'b' ? versionB : version === 'c' ? versionC : versionA;
  return fn(tier, D);
}
export { isHeavy };
