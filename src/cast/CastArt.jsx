// CastArt.jsx — a cast member's pose, drawn LAYERED when cast.js CAST_LAYERS has the pose (a prop-less body + prop
// sprites), else the flat painted image. Drop-in for the old `<img src={castSrc(...)}>`: `className` + `artRef` land
// on the outer node, so a caller's idle beat (transform on that node) carries the props with the body.
// The GUM (GLITCH pilot): rests as a small bubble at the lips; every ~5–9 s it inflates, holds, POPS (the splat sprite
// flashes) and the splat sucks back into the mouth, then a fresh small bubble blows out. Finite WAAPI one-shots re-armed
// by a timer (nothing infinite), transform + opacity only, will-change only while playing (kitPlay), hidden tab skipped,
// reduce-motion = the resting small bubble.
import { useEffect, useRef } from 'react';
import { castSrc, castLayers, castFrames, heroById } from './cast.js';
import { kitPlay } from '../components/kit/motion.js';
import { flagDefaultOn } from '../lib/featureFlags.js';
import './CastArt.css';

const REST = 0.42; // the resting bubble (also the .cast-gum-b CSS scale)
const INFLATE = [
  { transform: `scale(${REST})` },
  { transform: 'scale(.62, .58)', offset: 0.35 },
  { transform: 'scale(.8, .84)', offset: 0.6 },
  { transform: 'scale(1.04, .97)', offset: 0.86 },
  { transform: 'scale(1)' },
];
const HOLD = [{ transform: 'scale(1)' }, { transform: 'scale(1.03, .98)', offset: 0.5 }, { transform: 'scale(1)' }];
const BURST = [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.18)', opacity: 0 }];
const SPLAT = [
  { transform: 'scale(.9)', opacity: 0 },
  { transform: 'scale(1.12)', opacity: 1, offset: 0.08 },
  { transform: 'scale(1)', opacity: 1, offset: 0.16 },
  { transform: 'scale(1)', opacity: 1, offset: 0.62 },
  { transform: 'scale(.12)', opacity: 0 },
];
const REGROW = [{ transform: 'scale(0)', opacity: 0 }, { transform: `scale(${REST * 1.1})`, opacity: 1, offset: 0.7 }, { transform: `scale(${REST})`, opacity: 1 }];
const T_INFLATE = 1900; // oct17 Andy: "slower … so the animations are easily seen"
const T_HOLD = 650;
const T_SPLAT = 1250;

function Gum({ box, live }) {
  const bRef = useRef(null);
  const pRef = useRef(null);
  useEffect(() => {
    if (!live) return undefined;
    const timers = [];
    let burst = null;
    const at = (ms, fn) => timers.push(setTimeout(fn, ms));
    const cycle = () => {
      const b = bRef.current;
      const p = pRef.current;
      if (b && p && document.visibilityState !== 'hidden') {
        kitPlay(b, INFLATE, { duration: T_INFLATE, easing: 'cubic-bezier(.3,.1,.4,1)' });
        at(T_INFLATE, () => kitPlay(b, HOLD, { duration: T_HOLD, easing: 'ease-in-out' }));
        at(T_INFLATE + T_HOLD, () => {
          burst = kitPlay(b, BURST, { duration: 70, easing: 'ease-out', fill: 'forwards', keep: true }); // held gone until the regrow
          kitPlay(p, SPLAT, { duration: T_SPLAT, easing: 'cubic-bezier(.5,0,.75,0)' });
        });
        at(T_INFLATE + T_HOLD + T_SPLAT - 120, () => {
          // the held burst must go explicitly (kitPlay forgets a FINISHED animation, so it would outlive the regrow)
          if (burst) { burst.cancel(); burst = null; }
          kitPlay(b, REGROW, { duration: 520, easing: 'cubic-bezier(.2,1.3,.4,1)' });
        });
      }
      at(T_INFLATE + T_HOLD + T_SPLAT + 500 + Math.random() * 400, cycle); // oct18 Andy: "a lot more continous" - the next bubble follows straight on
    };
    at(600 + Math.random() * 600, cycle);
    return () => { timers.forEach(clearTimeout); if (burst) burst.cancel(); };
  }, [live]);
  const style = { left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, transformOrigin: box.o };
  const pw = box.w * 1.12; // the splat is painted ~12% wider than the bubble; centred on it, it sucks back into the lips
  const splat = { left: `${box.x - (pw - box.w) / 2}%`, top: `${box.y - (pw - box.w) / 2}%`, width: `${pw}%`, transformOrigin: box.o, opacity: 0 };
  return (
    <>
      <img ref={pRef} className="cast-gum cast-gum-p" style={splat} src="/cast/props/gum-pop.webp" width="256" height="254" alt="" draggable="false" />
      <img ref={bRef} className="cast-gum cast-gum-b" style={style} src="/cast/props/gum-bubble.webp" width="256" height="254" alt="" draggable="false" />
    </>
  );
}

// PROP STREAMS (oct18, Andy: "all animations need to be a lot smoother - like a lot more continous (the spray paint for
// example should almost constantly be spraying)" … "the rarer you get the better"). Each act is a set of STREAMS: one
// painted sprite (an index into the pose's cast.js sprites) drawn as a small fixed POOL of clones that each replay the
// same one-shot back-to-back, the clones staggered evenly across the cycle so their lives overlap — the effect never
// stops, it just flows. Every keyframe set fades in and out (no pops, so a seam is invisible); rising things ease out.
// Still the house motion law: finite WAAPI one-shots (kitPlay) re-armed on finish — nothing infinite — transform +
// opacity only, will-change only while a clone plays, pooled nodes (no node per cycle), the loop sleeps in a hidden tab,
// reduce motion = nothing plays. RARITY scales the pool (more overlapping clones = denser, richer motion): crew x1,
// GOLD x1.35, ELITE x1.5, LEGEND x2, and every rare tier also wears an AURA (gold glints / ghost trails, below).
// A stream: { i: sprite, n: clones at x1, ms: one clone's life, f: keyframes, e?: easing, at?: first-start offset ms }.
const UP = (x, y, s0 = 0.5, s1 = 1) => [
  { transform: `translate(0, 0) scale(${s0})`, opacity: 0 },
  { transform: `translate(${x * 0.3}%, ${y * 0.3}%) scale(${s1})`, opacity: 1, offset: 0.25 },
  { transform: `translate(${x * 0.7}%, ${y * 0.7}%) scale(${s1})`, opacity: 0.9, offset: 0.7 },
  { transform: `translate(${x}%, ${y}%) scale(${s1 * 0.9})`, opacity: 0 },
];
const POP = (peak = 1.15) => [{ transform: 'scale(.2)', opacity: 0 }, { transform: `scale(${peak})`, opacity: 1, offset: 0.2 }, { transform: 'scale(1)', opacity: 1, offset: 0.4 }, { transform: 'scale(1.1)', opacity: 0 }];
const TWINKLE = [{ transform: 'scale(0) rotate(0deg)', opacity: 0 }, { transform: 'scale(1.2) rotate(45deg)', opacity: 1, offset: 0.3 }, { transform: 'scale(.9) rotate(70deg)', opacity: 0.85, offset: 0.55 }, { transform: 'scale(0) rotate(90deg)', opacity: 0 }];
const ARC = (dx, m = 1) => [{ transform: `translate(0, 0) scale(${0.5 * m}, .5)`, opacity: 0 }, { transform: `translate(${dx * 0.3}%, 0) scale(${m}, 1)`, opacity: 1, offset: 0.3 }, { transform: `translate(${dx}%, 0) scale(${1.15 * m}, 1.15)`, opacity: 0 }];
const RAIN = [{ transform: 'translateY(20%) scale(.3)', opacity: 0 }, { transform: 'translateY(-30%) scale(1.1)', opacity: 1, offset: 0.25 }, { transform: 'translateY(30%) scale(1)', opacity: 0.9, offset: 0.65 }, { transform: 'translateY(90%) scale(1)', opacity: 0 }];
const EASE_OUT = 'cubic-bezier(.25,.6,.35,1)';
// a flame churning out of its base (`rot` turns it to point out of a nozzle); first frame = last frame, opaque throughout
const FLICKER = (rot, k = 1) => [
  { transform: `rotate(${rot}deg) scale(${k}, ${k})`, opacity: 1 },
  { transform: `rotate(${rot}deg) scale(${0.9 * k}, ${1.18 * k})`, opacity: 1, offset: 0.22 },
  { transform: `rotate(${rot}deg) scale(${1.06 * k}, ${0.86 * k})`, opacity: 1, offset: 0.48 },
  { transform: `rotate(${rot}deg) scale(${0.95 * k}, ${1.1 * k})`, opacity: 1, offset: 0.74 },
  { transform: `rotate(${rot}deg) scale(${k}, ${k})`, opacity: 1 },
];
// a puff of exhaust leaving a nozzle (`dir` -1 = out to the left, 1 = right), swelling and thinning as it rises
const EXHAUST = (dir) => [
  { transform: 'translate(0, 0) scale(.3)', opacity: 0 },
  { transform: `translate(${dir * 40}%, -15%) scale(.75)`, opacity: 0.85, offset: 0.18 },
  { transform: `translate(${dir * 120}%, -60%) scale(1.15)`, opacity: 0.5, offset: 0.6 },
  { transform: `translate(${dir * 170}%, -110%) scale(1.4)`, opacity: 0 },
];
// a quick glint (most of its life it rests unseen, so the scan reads as a blink across the visor, not a sparkle)
const GLINT = [{ transform: 'scale(0) rotate(0deg)', opacity: 0 }, { transform: 'scale(1.25) rotate(45deg)', opacity: 1, offset: 0.06 }, { transform: 'scale(0) rotate(90deg)', opacity: 0, offset: 0.16 }, { transform: 'scale(0) rotate(90deg)', opacity: 0 }];
const STREAMS = {
  // RIOT: the can never stops — three puffs always in flight off the nozzle, a small puff and paint drips between
  spray: [
    { i: 0, n: 3, ms: 1500, f: [{ transform: 'scale(.25)', opacity: 0 }, { transform: 'translate(-2%, -1%) scale(.9)', opacity: 0.95, offset: 0.2 }, { transform: 'translate(-8%, -5%) scale(1.05)', opacity: 0.8, offset: 0.6 }, { transform: 'translate(-16%, -9%) scale(1.15)', opacity: 0 }] },
    { i: 1, n: 2, ms: 1300, at: 300, f: [{ transform: 'translate(60%, 20%) scale(.2)', opacity: 0 }, { transform: 'translate(0, 0) scale(1)', opacity: 1, offset: 0.3 }, { transform: 'translate(-60%, -35%) scale(1.1)', opacity: 0 }] },
    { i: 2, n: 2, ms: 1200, at: 150, e: 'cubic-bezier(.4,0,.8,.6)', f: [{ transform: 'translate(0, 0) scale(.6)', opacity: 0 }, { transform: 'translate(-140%, -160%) scale(1)', opacity: 1, offset: 0.25 }, { transform: 'translate(-300%, 520%) scale(.9)', opacity: 0 }] },
  ],
  // HEX: the open book breathes magic — puffs rise off the pages, runes drift up, sparks twinkle
  magic: [
    { i: 4, n: 2, ms: 2000, f: UP(0, -40, 0.4, 1.15) },
    { i: 2, n: 1, ms: 2600, f: UP(12, -260, 0.5, 1) },
    { i: 3, n: 1, ms: 2600, at: 1300, f: UP(-30, -230, 0.5, 1) },
    { i: 0, n: 2, ms: 1600, at: 400, f: TWINKLE },
    { i: 1, n: 2, ms: 1400, at: 900, f: TWINKLE },
  ],
  // HYPE: never stops shouting — sound arcs roll off the face on a steady beat, confetti keeps raining off the finger
  shout: [
    { i: 0, n: 3, ms: 1200, f: ARC(40) },
    { i: 1, n: 2, ms: 2200, at: 400, e: 'cubic-bezier(.2,.7,.5,1)', f: RAIN },
  ],
  // BRAWL: a steady one-two — impacts land on a rhythm at the glove, sweat flicks off
  jab: [
    { i: 0, n: 2, ms: 1100, e: 'ease-out', f: POP(1.2) },
    { i: 1, n: 1, ms: 1500, at: 500, e: 'cubic-bezier(.3,0,.7,1)', f: [{ transform: 'translate(0, 0)', opacity: 0 }, { transform: 'translate(-80%, -60%)', opacity: 1, offset: 0.3 }, { transform: 'translate(-200%, 160%)', opacity: 0 }] },
  ],
  // DUD: the snore never ends — Z after Z drifts up off the nightcap, small to big
  snore: [
    { i: 0, n: 1, ms: 2700, f: UP(30, -40, 0.3, 1) },
    { i: 1, n: 1, ms: 2700, at: 900, f: UP(25, -45, 0.3, 1) },
    { i: 2, n: 1, ms: 2700, at: 1800, f: UP(20, -50, 0.3, 1) },
  ],
  // LEXI: the idea glows over the finger and bobs, dictionary pages keep fluttering out and away
  eureka: [
    { i: 0, n: 1, ms: 2400, e: 'ease-in-out', f: [{ transform: 'translateY(20%) scale(0)', opacity: 0 }, { transform: 'translateY(0) scale(1.1)', opacity: 1, offset: 0.15 }, { transform: 'translateY(-6%) scale(1)', opacity: 1, offset: 0.45 }, { transform: 'translateY(0) scale(1.03)', opacity: 1, offset: 0.75 }, { transform: 'translateY(-10%) scale(.9)', opacity: 0 }] },
    { i: 1, n: 2, ms: 2200, at: 300, e: 'cubic-bezier(.3,.6,.5,1)', f: [{ transform: 'translate(40%, 30%) rotate(10deg) scale(.5)', opacity: 0 }, { transform: 'translate(0, 0) rotate(-8deg) scale(1)', opacity: 1, offset: 0.25 }, { transform: 'translate(-60%, -90%) rotate(14deg) scale(1)', opacity: 1, offset: 0.6 }, { transform: 'translate(-110%, -200%) rotate(-10deg) scale(.9)', opacity: 0 }] },
  ],
  // BOO: wisps never stop curling off the tail, ghost-fire embers keep lifting off the fuse
  haunt: [
    { i: 0, n: 2, ms: 2600, f: UP(35, -45, 0.3, 1.15) },
    { i: 1, n: 2, ms: 2600, at: 650, f: [{ transform: 'translate(0, 0) scale(-.3, .3)', opacity: 0 }, { transform: 'translate(-10%, -12%) scale(-1, 1)', opacity: 1, offset: 0.3 }, { transform: 'translate(-35%, -50%) scale(-1.15, 1.15)', opacity: 0 }] },
    { i: 2, n: 2, ms: 1400, at: 150, f: UP(40, -160, 0.4, 0.6) },
    { i: 3, n: 2, ms: 1400, at: 850, f: UP(-30, -170, 0.4, 0.6) },
  ],
  // ROCKSTAR RIOT: the guitar keeps ringing — notes float up in a stream, the bolt crackles at the headstock
  rock: [
    { i: 0, n: 2, ms: 2400, f: UP(-5, -260, 0.4, 1) },
    { i: 1, n: 2, ms: 2400, at: 600, f: UP(10, -270, 0.4, 1) },
    { i: 2, n: 1, ms: 900, e: 'linear', f: [{ transform: 'scale(.5)', opacity: 0 }, { transform: 'scale(1.2)', opacity: 1, offset: 0.15 }, { transform: 'scale(1)', opacity: 0.3, offset: 0.35 }, { transform: 'scale(1.15)', opacity: 1, offset: 0.55 }, { transform: 'scale(1.3)', opacity: 0 }] },
  ],
  // MVP HYPE: the megaphone blasts on a beat (arcs out of the bell, mirrored), confetti rains twice over
  mvp: [
    { i: 0, n: 3, ms: 1100, f: ARC(-40, -1) },
    { i: 1, n: 2, ms: 2000, at: 300, e: 'cubic-bezier(.2,.7,.5,1)', f: RAIN },
    { i: 2, n: 2, ms: 2000, at: 1000, e: 'cubic-bezier(.2,.7,.5,1)', f: RAIN },
  ],
  // CHAMP BRAWL: the press never stops — camera flashes pop around the champ, out of step with each other
  champ: [
    { i: 0, n: 1, ms: 1300, e: 'ease-out', f: POP(1.25) },
    { i: 1, n: 1, ms: 1300, at: 430, e: 'ease-out', f: POP(1.25) },
    { i: 2, n: 1, ms: 1300, at: 870, e: 'ease-out', f: POP(1.25) },
  ],
  // ARCHMAGE HEX: the staff crystal twinkles, the book streams runes and puffs
  arcane: [
    { i: 0, n: 2, ms: 1500, f: TWINKLE },
    { i: 1, n: 2, ms: 1300, at: 500, f: TWINKLE },
    { i: 4, n: 2, ms: 2000, at: 200, f: UP(0, -40, 0.4, 1.15) },
    { i: 2, n: 1, ms: 2600, at: 700, f: UP(12, -260, 0.5, 1) },
    { i: 3, n: 1, ms: 2600, at: 2000, f: UP(-30, -230, 0.5, 1) },
  ],
  // SHH: the "..." bubble is almost always up — it swells from its tail, hangs, shrinks back unsaid, and swells again
  mime: [
    { i: 0, n: 1, ms: 2400, e: 'ease-in-out', f: [{ transform: 'scale(0)', opacity: 0 }, { transform: 'scale(1.12)', opacity: 1, offset: 0.14 }, { transform: 'scale(1)', opacity: 1, offset: 0.24 }, { transform: 'scale(1.04)', opacity: 1, offset: 0.55 }, { transform: 'scale(1)', opacity: 1, offset: 0.85 }, { transform: 'scale(0)', opacity: 0 }] },
  ],
  // SIZZLE: the flame never stops flickering, sauce keeps spitting up and arcing down, steam keeps rising
  sear: [
    { i: 0, n: 2, ms: 1000, e: 'ease-in-out', f: [{ transform: 'scale(.6)', opacity: 0 }, { transform: 'scale(1.25, 1.35)', opacity: 1, offset: 0.25 }, { transform: 'scale(.95, 1.1)', opacity: 1, offset: 0.5 }, { transform: 'scale(1.15, 1.25)', opacity: 1, offset: 0.7 }, { transform: 'scale(.8)', opacity: 0 }] },
    { i: 1, n: 1, ms: 1100, at: 200, e: 'cubic-bezier(.3,0,.7,1)', f: [{ transform: 'translate(0, 0) scale(.6)', opacity: 0 }, { transform: 'translate(-60%, -160%) scale(1)', opacity: 1, offset: 0.35 }, { transform: 'translate(-140%, 220%) scale(.9)', opacity: 0 }] },
    { i: 2, n: 1, ms: 1150, at: 750, e: 'cubic-bezier(.3,0,.7,1)', f: [{ transform: 'translate(0, 0) scale(.6)', opacity: 0 }, { transform: 'translate(40%, -200%) scale(1)', opacity: 1, offset: 0.35 }, { transform: 'translate(90%, 240%) scale(.9)', opacity: 0 }] },
    { i: 3, n: 2, ms: 1700, at: 400, f: UP(10, -130, 0.5, 1.25) },
  ],
  // MECHA (oct19, Andy: "mecha - it just doesn't really fit … QUALITY. (but ensure smoothness and theme)"): an engine
  // idling, not a campfire. Each flame is two pooled clones of one opaque flicker, half a cycle apart, whose first and
  // last frames match — so the flame never fades or pops, it just churns. The thrusters flicker SIDEWAYS (the rotation
  // rides every keyframe) and cough exhaust that drifts off and up; the beacon double-blinks; a glint scans the visor
  // left eye → right eye.
  boost: [
    { i: 0, n: 2, ms: 520, e: 'ease-in-out', f: FLICKER(-14, 1.05) },
    { i: 1, n: 2, ms: 360, e: 'ease-in-out', f: FLICKER(-90, 1) },
    { i: 2, n: 2, ms: 380, at: 90, e: 'ease-in-out', f: FLICKER(90, 1) },
    { i: 3, n: 1, ms: 1500, f: EXHAUST(-1) },
    { i: 4, n: 1, ms: 1500, at: 700, f: EXHAUST(1) },
    { i: 5, n: 0.5, ms: 2400, at: 500, e: 'linear', f: [{ transform: 'scale(0)', opacity: 0 }, { transform: 'scale(1.15)', opacity: 1, offset: 0.05 }, { transform: 'scale(.3)', opacity: 0, offset: 0.12 }, { transform: 'scale(1.15)', opacity: 1, offset: 0.19 }, { transform: 'scale(0)', opacity: 0, offset: 0.3 }, { transform: 'scale(0)', opacity: 0 }] },
    { i: 6, n: 0.5, ms: 3600, at: 1400, e: 'ease-out', f: GLINT },
    { i: 7, n: 0.5, ms: 3600, at: 1680, e: 'ease-out', f: GLINT },
  ],
  // GLITCH.EXE: it corrupts — bands of its own art tear sideways in short stepped bursts (a glitch should read glitchy,
  // so this one stays bursty on purpose): a tear somewhere every ~1.3 s
  glitch: [
    { i: 0, n: 1, ms: 2600, e: 'linear', f: [{ transform: 'translateX(-6%)', opacity: 1 }, { transform: 'translateX(5%)', opacity: 1, offset: 0.04 }, { transform: 'translateX(-2%)', opacity: 1, offset: 0.08 }, { transform: 'translateX(0)', opacity: 0, offset: 0.12 }, { transform: 'translateX(0)', opacity: 0 }] },
    { i: 1, n: 1, ms: 2600, at: 1300, e: 'linear', f: [{ transform: 'translateX(5%)', opacity: 1 }, { transform: 'translateX(-4%)', opacity: 1, offset: 0.05 }, { transform: 'translateX(0)', opacity: 0, offset: 0.1 }, { transform: 'translateX(0)', opacity: 0 }] },
    { i: 2, n: 1, ms: 2600, at: 1900, e: 'linear', f: [{ transform: 'translateX(-4%)', opacity: 1 }, { transform: 'translateX(3%)', opacity: 1, offset: 0.05 }, { transform: 'translateX(0)', opacity: 0, offset: 0.1 }, { transform: 'translateX(0)', opacity: 0 }] },
  ],
};
// AURA: what a rare tier wears around the body, always moving, one piece after another (never all at once) — GOLD
// twinkles gold glints and glint clusters, ELITE gold glints, LEGEND trails ghost-smoke comets rising past it. The art is
// painted (public/cast/props, oct18 round 2); the spots are % of the pose square.
const TRAIL = [ // the comet's head is painted bottom-left: turned half round it leads up-right, rising past the body
  { transform: 'translate(0, 0) rotate(180deg) scale(.6)', opacity: 0 },
  { transform: 'translate(10%, -25%) rotate(180deg) scale(1)', opacity: 0.95, offset: 0.25 },
  { transform: 'translate(35%, -90%) rotate(180deg) scale(1)', opacity: 0.8, offset: 0.7 },
  { transform: 'translate(55%, -140%) rotate(180deg) scale(.85)', opacity: 0 },
];
const CRACKLE = [
  { transform: 'scale(.6)', opacity: 0 }, { transform: 'scale(1.1)', opacity: 1, offset: 0.04 }, { transform: 'scale(.9)', opacity: 0.2, offset: 0.08 },
  { transform: 'scale(1.05)', opacity: 1, offset: 0.12 }, { transform: 'scale(1)', opacity: 0, offset: 0.2 }, { transform: 'scale(1)', opacity: 0 },
];
const AURAS = {
  gold: { ms: 1600, f: TWINKLE, e: 'ease-in-out', at: [
    ['/cast/props/glint-gold.webp', 12, 28, 9], ['/cast/props/glint-gold-cluster.webp', 72, 16, 12], ['/cast/props/glint-gold.webp', 72, 60, 8],
    ['/cast/props/glint-gold-cluster.webp', 16, 64, 11], ['/cast/props/glint-gold.webp', 46, 4, 8],
  ] },
  elite: { ms: 1700, f: TWINKLE, e: 'ease-in-out', at: [
    ['/cast/props/glint-gold.webp', 12, 30, 8], ['/cast/props/glint-gold.webp', 76, 18, 9], ['/cast/props/glint-gold.webp', 72, 62, 7],
    ['/cast/props/glint-gold.webp', 20, 66, 8], ['/cast/props/glint-gold.webp', 48, 6, 7],
  ] },
  // MECHA's own LEGEND aura (oct19): ghost smoke is BOO's — a machine crackles. A bolt arcs off a joint now and then,
  // flickering on-off like a short circuit, one joint after another.
  mecha: { ms: 2100, f: CRACKLE, e: 'linear', at: [
    ['/cast/props/bolt.webp', 5, 30, 6], ['/cast/props/bolt.webp', 88, 50, 6], ['/cast/props/bolt.webp', 25, 56, 5],
  ] },
  legend: { ms: 2600, f: TRAIL, e: 'cubic-bezier(.3,.5,.5,1)', at: [
    ['/cast/props/ghost-trail.webp', 4, 58, 16], ['/cast/props/ghost-trail.webp', 70, 64, 14], ['/cast/props/ghost-trail.webp', 10, 30, 12],
  ] },
};
/** How much richer a hero's motion is: its pool multiplier, and its tier ('gold' | 'elite' | 'legend' | null) — the
 *  tier picks the AURA here and the seat ring in game (GameScreen). */
export function rarityOf(h) {
  if (!h) return { k: 1, tier: null };
  if (h.legend) return { k: 2, tier: 'legend' };
  if (h.elite) return { k: 1.5, tier: 'elite' };
  if (h.gold) return { k: 1.35, tier: 'gold' };
  return { k: 1, tier: null };
}

/** Run one pooled clone: play, and on finish play again — each a finite one-shot. Returns its stop. */
function loopClone(el, frames, ms, easing, startAt, alive) {
  let t = 0;
  const run = () => {
    if (!alive.on || !el) return;
    if (document.visibilityState === 'hidden') { t = setTimeout(run, 1000); return; } // sleep in a hidden tab
    const a = kitPlay(el, frames, { duration: ms, easing: easing || EASE_OUT });
    if (!a) return; // reduce motion (or no WAAPI): stay at rest
    a.finished.then(run, () => { /* cancelled: unmount / restart */ });
  };
  t = setTimeout(run, startAt);
  return () => clearTimeout(t);
}
const stopAll = (els) => els.forEach((el) => { const an = el && el.__kitAnim; if (an) an.cancel(); });

function Streams({ act, sprites, rarity, live }) {
  const refs = useRef({});
  const streams = STREAMS[act] || [];
  // the pool: each stream's clone count scaled by rarity — fixed per hero, never grows at runtime
  const pools = streams.map((st) => Math.max(1, Math.round(st.n * rarity.k)));
  useEffect(() => {
    if (!live || !streams.length) return undefined;
    const alive = { on: true };
    const els = refs.current;
    const stops = [];
    streams.forEach((st, s) => {
      for (let c = 0; c < pools[s]; c++) {
        stops.push(loopClone(els[`${s}-${c}`], st.f, st.ms, st.e, 300 + (st.at || 0) + (c * st.ms) / pools[s], alive));
      }
    });
    return () => { alive.on = false; stops.forEach((f) => f()); stopAll(Object.values(els)); };
  }, [act, live, rarity.k]); // eslint-disable-line react-hooks/exhaustive-deps
  return streams.flatMap((st, s) => {
    const sp = sprites[st.i];
    if (!sp) return [];
    return Array.from({ length: pools[s] }, (_, c) => (
      <img key={`${s}-${c}`} ref={(el) => { refs.current[`${s}-${c}`] = el; }} className="cast-fx" src={sp.src} alt="" draggable="false"
        style={{ left: `${sp.x}%`, top: `${sp.y}%`, width: `${sp.w}%`, transformOrigin: sp.o || '50% 50%', clipPath: sp.clip || undefined }} />
    ));
  });
}

function Aura({ tier, hero, live }) {
  const refs = useRef([]);
  const A = AURAS[hero] || AURAS[tier]; // a hero can wear its own aura (MECHA) instead of its tier's
  useEffect(() => {
    if (!live || !A) return undefined;
    const alive = { on: true };
    const els = refs.current;
    const stops = A.at.map((_, k) => loopClone(els[k], A.f, A.ms, A.e, 200 + (k * A.ms) / A.at.length, alive));
    return () => { alive.on = false; stops.forEach((f) => f()); stopAll(els); };
  }, [live, tier, hero]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!A) return null;
  return A.at.map(([src, x, y, w], k) => (
    <img key={k} ref={(el) => { refs.current[k] = el; }} className="cast-fx" src={src} alt="" draggable="false" style={{ left: `${x}%`, top: `${y}%`, width: `${w}%` }} />
  ));
}

// `?props=0` (or storage taw.flag.props = '0'): the bare prop-less bodies, every slot empty — the shared flag helper
// remembers the query as the page loaded (the app tidies the address bar before this lazy chunk runs)

function Slot({ sp }) {
  return <img className={`cast-slot${sp.under ? ' is-under' : ''}`} src={sp.src} alt="" draggable="false" data-slot={sp.slot}
    style={{ left: `${sp.x}%`, top: `${sp.y}%`, width: `${sp.w}%` }} />;
}

/** `live` = run the prop streams (the big showcase / podium / in-game seat); false = the static resting look (thumbnails). */
/** FLIPBOOK (cast.js CAST_FRAMES): the frames stacked, frame 0 resting visible. One play = each frame layer gets ONE
 *  finite opacity animation whose keyframes switch it on/off at its steps (step easing — hard swaps like a Flash
 *  timeline, nothing tweened); a timer re-arms the play after `rest`. Opacity only, nothing infinite, hidden tab
 *  skipped, reduce motion = frame 0 (kitPlay no-ops). */
function Flipbook({ id, F, live }) {
  const refs = useRef([]);
  useEffect(() => {
    if (!live) return undefined;
    const total = F.seq.reduce((t, [, ms]) => t + ms, 0);
    let t = 0;
    const play = () => {
      if (document.visibilityState !== 'hidden') {
        for (let k = 0; k < F.n; k++) {
          const frames = [];
          let at = 0;
          for (const [f, ms] of F.seq) { frames.push({ offset: at / total, opacity: f === k ? 1 : 0, easing: 'step-end' }); at += ms; }
          frames.push({ offset: 1, opacity: k === 0 ? 1 : 0 });
          kitPlay(refs.current[k], frames, { duration: total, easing: 'linear' });
        }
      }
      t = setTimeout(play, total + F.rest);
    };
    t = setTimeout(play, 600 + Math.random() * 900);
    return () => clearTimeout(t);
  }, [id, F, live]);
  // frame 0 is ALWAYS the same node (a card that turns live under the pointer must not swap the element being clicked);
  // the other frames mount only while live
  return Array.from({ length: live ? F.n : 1 }, (_, k) => (
    <img key={k} ref={(el) => { refs.current[k] = el; }} className={`cast-frame${k === 0 ? ' is-rest' : ''}`} src={`/cast/anim/${F.file}-${k}.webp`} width="512" height="512" alt="" draggable="false" />
  ));
}

/** `keepFrames`: render the flipbook's resting frame even while not live (a picker card that goes live on hover keeps its node). */
export default function CastArt({ id, pose = 'hero', className = '', artRef, alt = '', live = true, keepFrames = false, ...rest }) {
  const rarity = rarityOf(heroById(id));
  const F = live || keepFrames ? castFrames(id, pose) : null;
  if (F) {
    return (
      <span ref={artRef} className={`${className} cast-layered cast-flip`} role={alt ? 'img' : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : 'true'} {...rest}>
        <Flipbook id={id} F={F} live={live} />
      </span>
    );
  }
  const L = castLayers(id, pose) || (rarity.tier ? {} : null);
  if (!L) return <img ref={artRef} className={className} src={castSrc(id, pose)} width="512" height="512" alt={alt} draggable="false" {...rest} />;
  const slots = flagDefaultOn('props') ? L.slots || [] : [];
  return (
    <span ref={artRef} className={`${className} cast-layered`} role={alt ? 'img' : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : 'true'} {...rest}>
      {slots.filter((sp) => sp.under).map((sp) => <Slot key={sp.slot} sp={sp} />)}
      <img className="cast-body" src={L.base || castSrc(id, pose)} width="512" height="512" alt="" draggable="false" />
      {slots.filter((sp) => !sp.under).map((sp) => <Slot key={sp.slot} sp={sp} />)}
      {L.gum ? <Gum box={L.gum} live={live} /> : null}
      {L.act ? <Streams act={L.act} sprites={L.sprites} rarity={rarity} live={live} /> : null}
      {rarity.tier ? <Aura tier={rarity.tier} hero={id} live={live} /> : null}
    </span>
  );
}
