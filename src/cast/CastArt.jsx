// CastArt.jsx — a cast member's pose, drawn LAYERED when cast.js CAST_LAYERS has the pose (a prop-less body + prop
// sprites), else the flat painted image. Drop-in for the old `<img src={castSrc(...)}>`: `className` + `artRef` land
// on the outer node, so a caller's idle beat (transform on that node) carries the props with the body.
// The GUM (GLITCH pilot): rests as a small bubble at the lips; every ~5–9 s it inflates, holds, POPS (the splat sprite
// flashes) and the splat sucks back into the mouth, then a fresh small bubble blows out. Finite WAAPI one-shots re-armed
// by a timer (nothing infinite), transform + opacity only, will-change only while playing (kitPlay), hidden tab skipped,
// reduce-motion = the resting small bubble.
import { useEffect, useRef } from 'react';
import { castSrc, castLayers } from './cast.js';
import { kitPlay } from '../components/kit/motion.js';
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
      at(T_INFLATE + T_HOLD + T_SPLAT + 1600 + Math.random() * 1400, cycle); // oct17: a shorter gap between bubbles
    };
    at(1800 + Math.random() * 2400, cycle);
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

// PROP ACTS (oct17, Andy: "do the same idea (components) for others"): a pose can carry painted FX sprites that rest
// invisible and play a short choreography on a timer — RIOT's spray can fires a paint puff. Each step is
// [sprite, delayMs, keyframes, options]; transform / opacity only, finite one-shots via kitPlay (will-change only while
// playing), hidden tab skipped, reduce motion = nothing plays. The sprite boxes live in cast.js CAST_LAYERS.
const ACTS = {
  spray: [
    [0, 0, [{ transform: 'scale(.12)', opacity: 0 }, { transform: 'scale(1.1)', opacity: 1, offset: 0.15 }, { transform: 'translate(-4%, -3%) scale(1)', opacity: 1, offset: 0.62 }, { transform: 'translate(-14%, -8%) scale(1.06)', opacity: 0 }], { duration: 1900, easing: 'cubic-bezier(.2,.8,.3,1)' }],
    [1, 160, [{ transform: 'translate(60%, 20%) scale(.2)', opacity: 0 }, { transform: 'translate(0, 0) scale(1)', opacity: 1, offset: 0.3 }, { transform: 'translate(-50%, -30%) scale(1.1)', opacity: 0 }], { duration: 1300, easing: 'cubic-bezier(.2,.8,.3,1)' }],
    [2, 90, [{ transform: 'translate(0, 0) scale(.6)', opacity: 0 }, { transform: 'translate(-140%, -160%) scale(1)', opacity: 1, offset: 0.25 }, { transform: 'translate(-300%, 520%) scale(.9)', opacity: 0 }], { duration: 950, easing: 'cubic-bezier(.3,0,.7,1)' }],
  ],
  // HEX: the floating spellbook breathes magic — a purple puff off the pages, two runes rise, sparkles pop
  magic: [
    [4, 0, [{ transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1)', opacity: 0.9, offset: 0.3 }, { transform: 'translate(0, -35%) scale(1.25)', opacity: 0 }], { duration: 1200, easing: 'ease-out' }],
    [2, 150, [{ transform: 'translate(0, 0) scale(.5)', opacity: 0 }, { transform: 'translate(0, -60%) scale(1)', opacity: 1, offset: 0.3 }, { transform: 'translate(12%, -260%) scale(.9)', opacity: 0 }], { duration: 1600, easing: 'cubic-bezier(.2,.7,.4,1)' }],
    [3, 480, [{ transform: 'translate(0, 0) scale(.5)', opacity: 0 }, { transform: 'translate(-10%, -50%) scale(1)', opacity: 1, offset: 0.3 }, { transform: 'translate(-30%, -230%) scale(.9)', opacity: 0 }], { duration: 1600, easing: 'cubic-bezier(.2,.7,.4,1)' }],
    [0, 260, [{ transform: 'scale(0)', opacity: 0 }, { transform: 'scale(1.25)', opacity: 1, offset: 0.25 }, { transform: 'scale(1)', opacity: 1, offset: 0.5 }, { transform: 'translate(0, -45%) scale(.5)', opacity: 0 }], { duration: 1100, easing: 'ease-out' }],
    [1, 640, [{ transform: 'scale(0)', opacity: 0 }, { transform: 'scale(1.3)', opacity: 1, offset: 0.25 }, { transform: 'scale(1)', opacity: 1, offset: 0.5 }, { transform: 'translate(0, -50%) scale(.5)', opacity: 0 }], { duration: 1000, easing: 'ease-out' }],
  ],
  // HYPE: shouts — two arc pulses roll off the face, confetti pops off the foam finger
  shout: [
    [0, 0, [{ transform: 'translateX(0) scale(.5)', opacity: 0 }, { transform: 'translateX(12%) scale(1)', opacity: 1, offset: 0.3 }, { transform: 'translateX(40%) scale(1.15)', opacity: 0 }], { duration: 650, easing: 'ease-out' }],
    [0, 680, [{ transform: 'translateX(0) scale(.5)', opacity: 0 }, { transform: 'translateX(12%) scale(1)', opacity: 1, offset: 0.3 }, { transform: 'translateX(40%) scale(1.15)', opacity: 0 }], { duration: 650, easing: 'ease-out' }],
    [1, 220, [{ transform: 'translateY(30%) scale(.3)', opacity: 0 }, { transform: 'translateY(-25%) scale(1.1)', opacity: 1, offset: 0.3 }, { transform: 'translateY(70%) scale(1)', opacity: 0 }], { duration: 1300, easing: 'cubic-bezier(.2,.7,.5,1)' }],
  ],
  // BRAWL: a jab lands — an impact burst at the glove, a sweat drop flicks off
  jab: [
    [0, 0, [{ transform: 'scale(.2)', opacity: 0 }, { transform: 'scale(1.15)', opacity: 1, offset: 0.25 }, { transform: 'scale(1)', opacity: 1, offset: 0.55 }, { transform: 'scale(1.25)', opacity: 0 }], { duration: 560, easing: 'ease-out' }],
    [0, 900, [{ transform: 'scale(.2)', opacity: 0 }, { transform: 'scale(.95)', opacity: 1, offset: 0.25 }, { transform: 'scale(1.1)', opacity: 0 }], { duration: 480, easing: 'ease-out' }],
    [1, 120, [{ transform: 'translate(0, 0)', opacity: 0 }, { transform: 'translate(-80%, -60%)', opacity: 1, offset: 0.3 }, { transform: 'translate(-200%, 160%)', opacity: 0 }], { duration: 800, easing: 'cubic-bezier(.3,0,.7,1)' }],
  ],
  // ROCKSTAR RIOT: the guitar rings — notes drift up off the body, a bolt cracks at the headstock
  rock: [
    [0, 0, [{ transform: 'translate(0, 0) scale(.4)', opacity: 0 }, { transform: 'translate(-10%, -60%) scale(1)', opacity: 1, offset: 0.25 }, { transform: 'translate(15%, -150%) scale(1)', opacity: 1, offset: 0.6 }, { transform: 'translate(-5%, -260%) scale(.9)', opacity: 0 }], { duration: 1800, easing: 'ease-out' }],
    [1, 420, [{ transform: 'translate(0, 0) scale(.4)', opacity: 0 }, { transform: 'translate(15%, -60%) scale(1)', opacity: 1, offset: 0.25 }, { transform: 'translate(-15%, -160%) scale(1)', opacity: 1, offset: 0.6 }, { transform: 'translate(10%, -270%) scale(.9)', opacity: 0 }], { duration: 1800, easing: 'ease-out' }],
    [2, 150, [{ transform: 'scale(.5)', opacity: 0 }, { transform: 'scale(1.2)', opacity: 1, offset: 0.2 }, { transform: 'scale(1)', opacity: 0.2, offset: 0.4 }, { transform: 'scale(1.15)', opacity: 1, offset: 0.6 }, { transform: 'scale(1.3)', opacity: 0 }], { duration: 650, easing: 'linear' }],
  ],
  // MVP HYPE: the megaphone blasts (arcs fly up-left out of the bell), confetti rains twice
  mvp: [
    [0, 0, [{ transform: 'translate(0, 0) scale(-.5, .5)', opacity: 0 }, { transform: 'translate(-12%, -8%) scale(-1, 1)', opacity: 1, offset: 0.3 }, { transform: 'translate(-40%, -25%) scale(-1.15, 1.15)', opacity: 0 }], { duration: 650, easing: 'ease-out' }],
    [0, 680, [{ transform: 'translate(0, 0) scale(-.5, .5)', opacity: 0 }, { transform: 'translate(-12%, -8%) scale(-1, 1)', opacity: 1, offset: 0.3 }, { transform: 'translate(-40%, -25%) scale(-1.15, 1.15)', opacity: 0 }], { duration: 650, easing: 'ease-out' }],
    [1, 200, [{ transform: 'translateY(20%) scale(.3)', opacity: 0 }, { transform: 'translateY(-30%) scale(1.1)', opacity: 1, offset: 0.25 }, { transform: 'translateY(90%) scale(1)', opacity: 0 }], { duration: 1500, easing: 'cubic-bezier(.2,.7,.5,1)' }],
    [2, 480, [{ transform: 'translateY(20%) scale(.3)', opacity: 0 }, { transform: 'translateY(-30%) scale(1.1)', opacity: 1, offset: 0.25 }, { transform: 'translateY(90%) scale(1)', opacity: 0 }], { duration: 1500, easing: 'cubic-bezier(.2,.7,.5,1)' }],
  ],
  // CHAMP BRAWL: the press is here — camera flashes pop around the champ
  champ: [
    [0, 0, [{ transform: 'scale(0)', opacity: 0 }, { transform: 'scale(1.2)', opacity: 1, offset: 0.2 }, { transform: 'scale(.9)', opacity: 0 }], { duration: 420, easing: 'ease-out' }],
    [1, 320, [{ transform: 'scale(0)', opacity: 0 }, { transform: 'scale(1.2)', opacity: 1, offset: 0.2 }, { transform: 'scale(.9)', opacity: 0 }], { duration: 420, easing: 'ease-out' }],
    [2, 560, [{ transform: 'scale(0)', opacity: 0 }, { transform: 'scale(1.2)', opacity: 1, offset: 0.2 }, { transform: 'scale(.9)', opacity: 0 }], { duration: 420, easing: 'ease-out' }],
    [0, 900, [{ transform: 'scale(0)', opacity: 0 }, { transform: 'scale(1)', opacity: 1, offset: 0.2 }, { transform: 'scale(.8)', opacity: 0 }], { duration: 380, easing: 'ease-out' }],
  ],
  // ARCHMAGE HEX: the staff crystal twinkles, the book breathes runes
  arcane: [
    [0, 0, [{ transform: 'scale(0)', opacity: 0 }, { transform: 'scale(1.35)', opacity: 1, offset: 0.3 }, { transform: 'scale(1)', opacity: 1, offset: 0.55 }, { transform: 'scale(0)', opacity: 0 }], { duration: 900, easing: 'ease-out' }],
    [1, 320, [{ transform: 'scale(0)', opacity: 0 }, { transform: 'scale(1.3)', opacity: 1, offset: 0.3 }, { transform: 'scale(0)', opacity: 0 }], { duration: 700, easing: 'ease-out' }],
    [4, 500, [{ transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1)', opacity: 0.9, offset: 0.3 }, { transform: 'translate(0, -35%) scale(1.25)', opacity: 0 }], { duration: 1200, easing: 'ease-out' }],
    [2, 650, [{ transform: 'translate(0, 0) scale(.5)', opacity: 0 }, { transform: 'translate(0, -60%) scale(1)', opacity: 1, offset: 0.3 }, { transform: 'translate(12%, -260%) scale(.9)', opacity: 0 }], { duration: 1600, easing: 'cubic-bezier(.2,.7,.4,1)' }],
    [3, 950, [{ transform: 'translate(0, 0) scale(.5)', opacity: 0 }, { transform: 'translate(-10%, -50%) scale(1)', opacity: 1, offset: 0.3 }, { transform: 'translate(-30%, -230%) scale(.9)', opacity: 0 }], { duration: 1600, easing: 'cubic-bezier(.2,.7,.4,1)' }],
  ],
  // DUD: a slow snore — each Z swells in near the cap and drifts up and right, small to big, then fades
  snore: [
    [0, 0, [{ transform: 'translate(-30%, 40%) scale(.3)', opacity: 0 }, { transform: 'translate(0, 0) scale(1)', opacity: 1, offset: 0.35 }, { transform: 'translate(20%, -40%) scale(1)', opacity: 0 }], { duration: 1400, easing: 'ease-out' }],
    [1, 500, [{ transform: 'translate(-30%, 40%) scale(.3)', opacity: 0 }, { transform: 'translate(0, 0) scale(1)', opacity: 1, offset: 0.35 }, { transform: 'translate(20%, -40%) scale(1)', opacity: 0 }], { duration: 1400, easing: 'ease-out' }],
    [2, 1000, [{ transform: 'translate(-30%, 40%) scale(.3)', opacity: 0 }, { transform: 'translate(0, 0) scale(1)', opacity: 1, offset: 0.35 }, { transform: 'translate(20%, -40%) scale(1)', opacity: 0 }], { duration: 1500, easing: 'ease-out' }],
  ],
  // LEXI: the idea lands — the bulb pops up off the fingertip and wobbles lit; a dictionary page flutters out and away
  eureka: [
    [0, 0, [{ transform: 'translateY(30%) scale(0)', opacity: 0 }, { transform: 'translateY(0) scale(1.15)', opacity: 1, offset: 0.2 }, { transform: 'scale(.95)', opacity: 1, offset: 0.32 }, { transform: 'scale(1.04)', opacity: 1, offset: 0.44 }, { transform: 'scale(1)', opacity: 1, offset: 0.8 }, { transform: 'translateY(-15%) scale(.9)', opacity: 0 }], { duration: 1500, easing: 'ease-out' }],
    [1, 300, [{ transform: 'translate(40%, 30%) rotate(10deg) scale(.5)', opacity: 0 }, { transform: 'translate(0, 0) rotate(-8deg) scale(1)', opacity: 1, offset: 0.25 }, { transform: 'translate(-60%, -90%) rotate(14deg) scale(1)', opacity: 1, offset: 0.6 }, { transform: 'translate(-110%, -200%) rotate(-10deg) scale(.9)', opacity: 0 }], { duration: 1600, easing: 'cubic-bezier(.3,.6,.5,1)' }],
  ],
  // BOO: it haunts — two smoke wisps curl off the tail and drift away, ghost-fire embers lift off the fuse and gutter out
  haunt: [
    [0, 0, [{ transform: 'translate(-20%, -10%) scale(.3)', opacity: 0 }, { transform: 'translate(0, 0) scale(1)', opacity: 1, offset: 0.3 }, { transform: 'translate(35%, -45%) scale(1.15)', opacity: 0 }], { duration: 1800, easing: 'cubic-bezier(.2,.7,.4,1)' }],
    [1, 450, [{ transform: 'translate(20%, -10%) scale(-.3, .3)', opacity: 0 }, { transform: 'translate(0, 0) scale(-1, 1)', opacity: 1, offset: 0.3 }, { transform: 'translate(-35%, -50%) scale(-1.15, 1.15)', opacity: 0 }], { duration: 1800, easing: 'cubic-bezier(.2,.7,.4,1)' }],
    [2, 150, [{ transform: 'translate(0, 60%) scale(.4)', opacity: 0 }, { transform: 'translate(0, 0) scale(1)', opacity: 1, offset: 0.3 }, { transform: 'translate(40%, -160%) scale(.5)', opacity: 0 }], { duration: 1100, easing: 'ease-out' }],
    [3, 600, [{ transform: 'translate(0, 60%) scale(.4)', opacity: 0 }, { transform: 'translate(0, 0) scale(1)', opacity: 1, offset: 0.3 }, { transform: 'translate(-30%, -170%) scale(.5)', opacity: 0 }], { duration: 1100, easing: 'ease-out' }],
  ],
  // GLITCH.EXE: it corrupts — bands of its own painted art tear sideways for a few frames (steps, not a smooth slide)
  glitch: [
    [0, 0, [{ transform: 'translateX(-6%)', opacity: 1 }, { transform: 'translateX(5%)', opacity: 1, offset: 0.35 }, { transform: 'translateX(-2%)', opacity: 1, offset: 0.7 }, { transform: 'translateX(0)', opacity: 0 }], { duration: 300, easing: 'steps(4)' }],
    [1, 60, [{ transform: 'translateX(5%)', opacity: 1 }, { transform: 'translateX(-4%)', opacity: 1, offset: 0.4 }, { transform: 'translateX(0)', opacity: 0 }], { duration: 260, easing: 'steps(3)' }],
    [2, 120, [{ transform: 'translateX(-4%)', opacity: 1 }, { transform: 'translateX(3%)', opacity: 1, offset: 0.5 }, { transform: 'translateX(0)', opacity: 0 }], { duration: 240, easing: 'steps(3)' }],
    [0, 900, [{ transform: 'translateX(4%)', opacity: 1 }, { transform: 'translateX(-3%)', opacity: 1, offset: 0.5 }, { transform: 'translateX(0)', opacity: 0 }], { duration: 220, easing: 'steps(3)' }],
  ],
};

const ACT_SLOW = 1.6; // oct17 Andy: "make the animations slower (and have less gap between) so the animations are easily seen and appreciated"
const actLength = (steps) => Math.max(...steps.map(([, d, , o]) => (d + o.duration) * ACT_SLOW));

function Act({ act, sprites, live }) {
  const refs = useRef([]);
  useEffect(() => {
    if (!live || !ACTS[act]) return undefined;
    const timers = [];
    const cycle = () => {
      if (document.visibilityState !== 'hidden') {
        for (const [i, delay, frames, opts] of ACTS[act]) timers.push(setTimeout(() => kitPlay(refs.current[i], frames, { ...opts, duration: opts.duration * ACT_SLOW }), delay * ACT_SLOW));
      }
      timers.push(setTimeout(cycle, actLength(ACTS[act]) + 1400 + Math.random() * 1400));
    };
    timers.push(setTimeout(cycle, 900 + Math.random() * 1200));
    return () => timers.forEach(clearTimeout);
  }, [act, live]);
  return sprites.map((sp, i) => (
    <img key={`${sp.src}-${i}`} ref={(el) => { refs.current[i] = el; }} className="cast-fx" src={sp.src} alt="" draggable="false"
      style={{ left: `${sp.x}%`, top: `${sp.y}%`, width: `${sp.w}%`, transformOrigin: sp.o || '50% 50%', clipPath: sp.clip || undefined }} />
  ));
}

/** `live` = run the prop one-shots (the big showcase / podium); false = the static resting look (small thumbnails). */
export default function CastArt({ id, pose = 'hero', className = '', artRef, alt = '', live = true, ...rest }) {
  const L = castLayers(id, pose);
  if (!L) return <img ref={artRef} className={className} src={castSrc(id, pose)} width="512" height="512" alt={alt} draggable="false" {...rest} />;
  return (
    <span ref={artRef} className={`${className} cast-layered`} role={alt ? 'img' : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : 'true'} {...rest}>
      <img className="cast-body" src={L.base || castSrc(id, pose)} width="512" height="512" alt="" draggable="false" />
      {L.gum ? <Gum box={L.gum} live={live} /> : null}
      {L.act ? <Act act={L.act} sprites={L.sprites} live={live} /> : null}
    </span>
  );
}
