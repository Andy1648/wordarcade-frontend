// kit/motionMore.js — the rest of the kit's keyframe library (timings + easings verbatim from the
// mockups), added to motion.js's FX table. Split out so a screen using only the menu's kit pieces
// does not carry it; every kit component that plays one of these imports this module.
import { FX } from './motion.js';

const E = {
  bounce: 'cubic-bezier(.2,1.4,.4,1)',
  slam: 'cubic-bezier(.2,1.3,.4,1)',
  settle: 'cubic-bezier(.3,.7,.4,1)',
};

Object.assign(FX, {
  // KitButtons
  deny: { frames: [{ transform: 'translateX(0)' }, { transform: 'translateX(-9px)', offset: 0.15 }, { transform: 'translateX(8px)', offset: 0.35 }, { transform: 'translateX(-6px)', offset: 0.55 }, { transform: 'translateX(4px)', offset: 0.75 }, { transform: 'translateX(0)' }], opts: { duration: 380, easing: 'linear' } },
  flash: { frames: [{ opacity: 0.95 }, { opacity: 0 }], opts: { duration: 450, easing: 'ease-out' } },
  float: { frames: [{ transform: 'translateY(0) scale(.6)', opacity: 0 }, { transform: 'translateY(-6px) scale(1.15)', opacity: 1, offset: 0.15 }, { transform: 'translateY(-54px) scale(1)', opacity: 0 }], opts: { duration: 850, easing: 'ease-out' } },
  squash: { frames: [{ transform: 'scaleX(1)' }, { transform: 'scaleX(1.12) scaleY(.88)', offset: 0.4 }, { transform: 'scaleX(1)' }], opts: { duration: 300, easing: E.bounce } },
  // hold-to-confirm rattle: the mockup's 90ms / 60ms loops, run for exactly the hold window
  holdShake1: { frames: [{ transform: 'translate(0,0)' }, { transform: 'translate(-1px,1px)', offset: 0.25 }, { transform: 'translate(1px,-1px)', offset: 0.5 }, { transform: 'translate(-1px,-1px)', offset: 0.75 }, { transform: 'translate(0,0)' }], opts: { duration: 90, easing: 'linear' } },
  holdShake2: { frames: [{ transform: 'translate(0,0)' }, { transform: 'translate(-3px,2px)', offset: 0.25 }, { transform: 'translate(3px,-2px)', offset: 0.5 }, { transform: 'translate(-2px,-3px)', offset: 0.75 }, { transform: 'translate(0,0)' }], opts: { duration: 60, easing: 'linear' } },
  popS: { frames: [{ transform: 'translate(-50%,-50%) translateY(12px) scale(.5)', opacity: 0 }, { transform: 'translate(-50%,-50%) translateY(-6px) scale(1.15)', opacity: 1, offset: 0.15 }, { transform: 'translate(-50%,-50%) translateY(-10px) scale(1)', opacity: 1, offset: 0.3 }, { transform: 'translate(-50%,-50%) translateY(-64px) scale(1)', opacity: 0 }], opts: { duration: 800, easing: 'ease-out' } },
  popM: { frames: [{ transform: 'translate(-50%,-50%) scale(0) rotate(-16deg)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(1.26) rotate(4deg)', offset: 0.22 }, { transform: 'translate(-50%,-50%) scale(.94) rotate(-5deg)', offset: 0.36 }, { transform: 'translate(-50%,-50%) scale(1) rotate(-4deg)', offset: 0.48 }, { transform: 'translate(-50%,-50%) translateY(-6px) rotate(-4deg)', opacity: 1, offset: 0.85 }, { transform: 'translate(-50%,-50%) translateY(-34px) rotate(-4deg)', opacity: 0 }], opts: { duration: 1300, easing: 'ease-out' } },
  popL: { frames: [{ transform: 'translate(-50%,-50%) scale(2.7)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(.86)', opacity: 1, offset: 0.14 }, { transform: 'translate(-50%,-50%) scale(1.07)', offset: 0.22 }, { transform: 'translate(-50%,-50%) scale(1)', offset: 0.3 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.82 }, { transform: 'translate(-50%,-50%) translateY(-26px) scale(1.04)', opacity: 0 }], opts: { duration: 1700, easing: 'cubic-bezier(.3,.8,.4,1)' } },
  popXL: { frames: [{ transform: 'translate(-50%,-50%) scale(4) rotate(-10deg)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(.84) rotate(-3deg)', opacity: 1, offset: 0.1 }, { transform: 'translate(-50%,-50%) scale(1.09) rotate(-3deg)', offset: 0.14 }, { transform: 'translate(-50%,-50%) scale(1) rotate(-3deg)', offset: 0.18 }, { transform: 'translate(-50%,-50%) scale(1) rotate(-3deg)', offset: 0.72 }, { transform: 'translate(-50%,-50%) scale(1.05) rotate(-3deg)', opacity: 1, offset: 0.8 }, { transform: 'translate(-50%,-50%) scale(1.5) rotate(-3deg)', opacity: 0 }], opts: { duration: 2300, easing: 'linear' } },
  chev: (delay) => ({ frames: [{ transform: 'translateY(40px)', opacity: 0 }, { opacity: 1, offset: 0.25 }, { transform: 'translateY(-70px)', opacity: 0 }], opts: { duration: 1100, easing: 'ease-out', delay, fill: 'both' } }),
  subIn: { frames: [{ transform: 'translateX(160px) skewX(-12deg)', opacity: 0 }, { transform: 'translateX(0) skewX(-12deg)', opacity: 1 }], opts: { duration: 320, easing: E.bounce, delay: 300, fill: 'both' } },
  band: (delay) => ({ frames: [{ transform: 'translateX(-130%) skewX(-24deg)' }, { transform: 'translateX(130%) skewX(-24deg)' }], opts: { duration: 550, easing: 'cubic-bezier(.6,0,.3,1)', delay, fill: 'both' } }),
  stageFlash: { frames: [{ opacity: 0 }, { opacity: 0, offset: 0.08 }, { opacity: 1, offset: 0.12 }, { opacity: 0 }], opts: { duration: 900, easing: 'linear' } },
  stageShake1: { frames: [{ transform: 'translate(0,0)' }, { transform: 'translate(-4px,2px)', offset: 0.25 }, { transform: 'translate(3px,-3px)', offset: 0.5 }, { transform: 'translate(-2px,2px)', offset: 0.75 }, { transform: 'translate(0,0)' }], opts: { duration: 280, easing: 'linear', delay: 220 } },
  stageShake2: { frames: [{ transform: 'translate(0,0)' }, { transform: 'translate(-12px,6px) rotate(-1deg)', offset: 0.15 }, { transform: 'translate(10px,-8px) rotate(1deg)', offset: 0.3 }, { transform: 'translate(-8px,-4px)', offset: 0.45 }, { transform: 'translate(6px,6px)', offset: 0.6 }, { transform: 'translate(-3px,2px)', offset: 0.8 }, { transform: 'translate(0,0)' }], opts: { duration: 450, easing: 'linear', delay: 220 } },
  badgeIn: { frames: [{ transform: 'scale(0)' }, { transform: 'scale(1.4)', offset: 0.55 }, { transform: 'scale(.88)', offset: 0.78 }, { transform: 'scale(1)' }], opts: { duration: 400, easing: E.slam, fill: 'backwards' } },
  badgeBump: { frames: [{ transform: 'scale(1)' }, { transform: 'scale(1.45)', offset: 0.35 }, { transform: 'scale(.9)', offset: 0.65 }, { transform: 'scale(1)' }], opts: { duration: 380, easing: E.slam } },
  badgeOut: { frames: [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.35)', opacity: 1, offset: 0.35 }, { transform: 'scale(0)', opacity: 0 }], opts: { duration: 240, easing: 'ease-in', fill: 'forwards', keep: true } },
  // the mockup's 2.8s infinite nudge: only its active 18% (≈500ms) wiggle, played ONCE on arrival
  nudge: { frames: [{ transform: 'rotate(0) scale(1)' }, { transform: 'rotate(-16deg) scale(1.12)', offset: 0.22 }, { transform: 'rotate(12deg) scale(1.12)', offset: 0.44 }, { transform: 'rotate(-6deg)', offset: 0.67 }, { transform: 'rotate(2deg)', offset: 0.83 }, { transform: 'rotate(0) scale(1)' }], opts: { duration: 504, easing: 'ease-in-out', delay: 420 } },
  no: { frames: [{ transform: 'rotate(0)' }, { transform: 'rotate(-7deg)', offset: 0.25 }, { transform: 'rotate(5deg)', offset: 0.6 }, { transform: 'rotate(0)' }], opts: { duration: 300, easing: 'ease-out' } },
  stampSlam: { frames: [{ transform: 'scale(2.9)', opacity: 0 }, { transform: 'scale(.88)', opacity: 1, offset: 0.58 }, { transform: 'scale(1.05)', opacity: 1, offset: 0.76 }, { transform: 'scale(1)', opacity: 1 }], opts: { duration: 400, easing: 'cubic-bezier(.5,0,.6,1)', fill: 'backwards' } },
  jolt: { frames: [{ transform: 'translate(0,0) scale(1)' }, { transform: 'translate(0,0) scale(1)', offset: 0.55 }, { transform: 'translate(0,4px) scale(.965)', offset: 0.66 }, { transform: 'translate(0,-1px) scale(1.01)', offset: 0.82 }, { transform: 'translate(0,0) scale(1)' }], opts: { duration: 500, easing: 'linear' } },
  spat: { frames: [{ transform: 'translateX(34px) scaleX(0)', opacity: 0 }, { transform: 'translateX(34px) scaleX(0)', opacity: 1, offset: 0.01 }, { transform: 'translateX(58px) scaleX(1)', opacity: 1, offset: 0.45 }, { transform: 'translateX(80px) scaleX(.2)', opacity: 0 }], opts: { duration: 450, easing: 'ease-out', delay: 230, fill: 'both' } },
  bannerIn: { frames: [{ transform: 'translateY(-150%)' }, { transform: 'translateY(0)' }], opts: { duration: 500, easing: 'cubic-bezier(.2,1.35,.4,1)', fill: 'backwards' } },
  bannerOut: { frames: [{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(-170%)', opacity: 0 }], opts: { duration: 260, easing: 'ease-in', fill: 'forwards', keep: true } },
  drain: (ms) => ({ frames: [{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], opts: { duration: ms, easing: 'linear', fill: 'forwards', keep: true } }),
  slamBig: { frames: [{ transform: 'scale(2.6)', opacity: 0 }, { transform: 'scale(.92)', opacity: 1, offset: 0.65 }, { transform: 'scale(1)', opacity: 1 }], opts: { duration: 450, easing: 'cubic-bezier(.2,1.2,.4,1)', fill: 'backwards' } },
  // the mockup's infinite .7s throb / .8s pulse / .14s shake, as event bursts (n beats, then rest)
  throb: (n = 3) => ({ frames: [{ transform: 'scale(1)' }, { transform: 'scale(1.12)', offset: 0.5 }, { transform: 'scale(1)' }], opts: { duration: 700, easing: 'ease-in-out', iterations: n } }),
  pulse: (n = 1) => ({ frames: [{ opacity: 1 }, { opacity: 0.4, offset: 0.5 }, { opacity: 1 }], opts: { duration: 800, easing: 'ease-in-out', iterations: n } }),
  tickShake: { frames: [{ transform: 'translate(0,0)' }, { transform: 'translate(-2px,1px)', offset: 0.25 }, { transform: 'translate(2px,-1px)', offset: 0.5 }, { transform: 'translate(-1px,-2px)', offset: 0.75 }, { transform: 'translate(0,0)' }], opts: { duration: 140, easing: 'linear', iterations: 3 } },
  stickerIn: { frames: [{ transform: 'translateY(8px) scale(.7)', opacity: 0 }, { transform: 'translateY(0) scale(1)', opacity: 1 }], opts: { duration: 220, easing: E.bounce, fill: 'backwards' } },
});
