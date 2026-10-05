// kit/motion.js — every one-shot the v2 kit plays, and the ONE way it plays them.
//
// The mockups (claude/mockups/v2/Kit*.dc.html) drive their effects by re-adding CSS keyframe
// classes. Here each effect is a WAAPI animation on a node the component already owns, so:
//   - nothing is created per event (the node is the pool),
//   - only transform + opacity are animated (every keyframe below is one or both),
//   - will-change is switched ON for the life of the animation and cleared when it ends,
//   - REDUCE MOTION (the in-game toggle, lib/reduceMotion.js) skips the animation outright:
//     the node simply sits in its end state.
// Every effect is FINITE. Where a mockup loops something at rest (pulse / throb / nudge / shake /
// stripe crawl) the kit plays a short burst on the EVENT instead — see the PR's deviation list.
import { reduceMotion } from '../../lib/reduceMotion.js';

/**
 * Play a one-shot on `el`. A previous kit animation on the same element is cancelled first, so a
 * re-trigger restarts cleanly instead of stacking. Returns the Animation, or null when skipped.
 */
export function kitPlay(el, frames, opts) {
  if (!el || typeof el.animate !== 'function') return null;
  if (reduceMotion()) return null;
  const prev = el.__kitAnim;
  if (prev) {
    try { prev.cancel(); } catch { /* gone */ }
  }
  const props = new Set();
  for (const f of frames) {
    if ('transform' in f) props.add('transform');
    if ('opacity' in f) props.add('opacity');
  }
  // __kitHold: a component has promoted this node for a whole sequence (an XP climb); leave it be
  if (!el.__kitHold) el.style.willChange = [...props].join(', ');
  // A held end-state (fill forwards/both) is RELEASED when the effect ends, unless `keep` — a
  // finished animation that keeps filling stays in document.getAnimations() for good. Every kit
  // effect ends where the node's own style already rests (offscreen / opacity 0), so this is invisible.
  const { keep, ...o } = opts || {};
  const release = !keep && (o.fill === 'forwards' || o.fill === 'both');
  let a;
  try {
    a = el.animate(frames, o);
  } catch {
    if (!el.__kitHold) el.style.willChange = '';
    return null;
  }
  el.__kitAnim = a;
  const clear = () => {
    if (el.__kitAnim === a) {
      el.__kitAnim = null;
      if (!el.__kitHold) el.style.willChange = '';
    }
  };
  a.onfinish = () => {
    clear();
    if (release) {
      try { a.cancel(); } catch { /* gone */ }
    }
  };
  a.oncancel = clear;
  return a;
}

/**
 * Promote nodes for the life of a SEQUENCE (e.g. a 30-level climb fires 30 one-shots ~33 ms apart):
 * one layer for the whole run instead of a layer created + destroyed per beat. Call with false at rest.
 */
export function kitHold(els, on) {
  for (const el of els) {
    if (!el) continue;
    el.__kitHold = !!on;
    el.style.willChange = on ? 'transform, opacity' : '';
  }
}

/** Cancel whatever kit animation `el` is running (unmount / reduce-motion flip). */
export function kitStop(el) {
  const a = el && el.__kitAnim;
  if (a) {
    try { a.cancel(); } catch { /* gone */ }
  }
}

const E = {
  bounce: 'cubic-bezier(.2,1.4,.4,1)',
  slam: 'cubic-bezier(.2,1.3,.4,1)',
  settle: 'cubic-bezier(.3,.7,.4,1)',
};

// ---- the keyframe library (timings + easings verbatim from the mockups) ----
export const FX = {
  // KitButtons
  deny: { frames: [{ transform: 'translateX(0)' }, { transform: 'translateX(-9px)', offset: 0.15 }, { transform: 'translateX(8px)', offset: 0.35 }, { transform: 'translateX(-6px)', offset: 0.55 }, { transform: 'translateX(4px)', offset: 0.75 }, { transform: 'translateX(0)' }], opts: { duration: 380, easing: 'linear' } },
  bump: { frames: [{ transform: 'scale(1)' }, { transform: 'scale(1.22) rotate(-4deg)', offset: 0.35 }, { transform: 'scale(1)' }], opts: { duration: 320, easing: E.bounce } },
  slamSmall: { frames: [{ transform: 'scale(1.9)', opacity: 0 }, { transform: 'scale(.94)', opacity: 1, offset: 0.65 }, { transform: 'scale(1)', opacity: 1 }], opts: { duration: 300, easing: E.slam, fill: 'backwards' } },
  flash: { frames: [{ opacity: 0.95 }, { opacity: 0 }], opts: { duration: 450, easing: 'ease-out' } },
  float: { frames: [{ transform: 'translateY(0) scale(.6)', opacity: 0 }, { transform: 'translateY(-6px) scale(1.15)', opacity: 1, offset: 0.15 }, { transform: 'translateY(-54px) scale(1)', opacity: 0 }], opts: { duration: 850, easing: 'ease-out' } },
  dotIn: { frames: [{ transform: 'scale(0)' }, { transform: 'scale(1.25)', offset: 0.6 }, { transform: 'scale(1)' }], opts: { duration: 300, easing: 'cubic-bezier(.2,1.5,.4,1)', fill: 'backwards' } },
  // the mockup's 1.4s infinite dot pulse, as ONE beat after the dot lands
  dotBeat: { frames: [{ transform: 'scale(1)' }, { transform: 'scale(1.12)', offset: 0.5 }, { transform: 'scale(1)' }], opts: { duration: 1400, easing: 'ease-in-out', delay: 300 } },
  squash: { frames: [{ transform: 'scaleX(1)' }, { transform: 'scaleX(1.12) scaleY(.88)', offset: 0.4 }, { transform: 'scaleX(1)' }], opts: { duration: 300, easing: E.bounce } },
  // hold-to-confirm rattle: the mockup's 90ms / 60ms loops, run for exactly the hold window
  holdShake1: { frames: [{ transform: 'translate(0,0)' }, { transform: 'translate(-1px,1px)', offset: 0.25 }, { transform: 'translate(1px,-1px)', offset: 0.5 }, { transform: 'translate(-1px,-1px)', offset: 0.75 }, { transform: 'translate(0,0)' }], opts: { duration: 90, easing: 'linear' } },
  holdShake2: { frames: [{ transform: 'translate(0,0)' }, { transform: 'translate(-3px,2px)', offset: 0.25 }, { transform: 'translate(3px,-2px)', offset: 0.5 }, { transform: 'translate(-2px,-3px)', offset: 0.75 }, { transform: 'translate(0,0)' }], opts: { duration: 60, easing: 'linear' } },

  // KitCurrency
  squashIcon: { frames: [{ transform: 'scale(1,1)' }, { transform: 'scale(1.34,.66)', offset: 0.18 }, { transform: 'scale(.82,1.24)', offset: 0.4 }, { transform: 'scale(1.08,.94)', offset: 0.62 }, { transform: 'scale(.98,1.02)', offset: 0.8 }, { transform: 'scale(1,1)' }], opts: { duration: 420, easing: E.settle } },
  dip: { frames: [{ transform: 'translateY(0)' }, { transform: 'translateY(5px) scale(1.08,.84)', offset: 0.3 }, { transform: 'translateY(0)' }], opts: { duration: 300, easing: 'ease-out' } },
  land: (dir) => ({ frames: [{ transform: 'scale(1)' }, { transform: `scale(1.3) rotate(${dir * 3}deg)`, offset: 0.3 }, { transform: 'scale(.93)', offset: 0.55 }, { transform: 'scale(1.04)', offset: 0.75 }, { transform: 'scale(1)' }], opts: { duration: 380, easing: E.bounce } }),
  shake: { frames: [{ transform: 'translateX(0)' }, { transform: 'translateX(-10px) rotate(-1.5deg)', offset: 0.12 }, { transform: 'translateX(9px) rotate(1deg)', offset: 0.26 }, { transform: 'translateX(-7px)', offset: 0.4 }, { transform: 'translateX(5px)', offset: 0.55 }, { transform: 'translateX(-3px)', offset: 0.7 }, { transform: 'translateX(2px)', offset: 0.85 }, { transform: 'translateX(0)' }], opts: { duration: 420, easing: 'linear' } },
  flashHot: { frames: [{ opacity: 0.9 }, { opacity: 0.15, offset: 0.3 }, { opacity: 0.7, offset: 0.45 }, { opacity: 0 }], opts: { duration: 500, easing: 'linear' } },
  sheen: { frames: [{ transform: 'translateX(-140%) skewX(-22deg)' }, { transform: 'translateX(620%) skewX(-22deg)' }], opts: { duration: 500, easing: 'ease-out' } },
  popUp: { frames: [{ transform: 'translate(-50%,16px) scale(.3)', opacity: 0 }, { transform: 'translate(-50%,-8px) scale(1.32)', opacity: 1, offset: 0.16 }, { transform: 'translate(-50%,-14px) scale(1)', opacity: 1, offset: 0.32 }, { transform: 'translate(-50%,-24px) scale(1)', opacity: 1, offset: 0.75 }, { transform: 'translate(-50%,-46px) scale(.9)', opacity: 0 }], opts: { duration: 1000, easing: 'ease-out' } },
  popDown: { frames: [{ transform: 'translate(-50%,-10px) scale(1.3)', opacity: 0 }, { transform: 'translate(-50%,0) scale(1)', opacity: 1, offset: 0.14 }, { transform: 'translate(-50%,10px) scale(1)', opacity: 1, offset: 0.7 }, { transform: 'translate(-50%,30px) scale(.85)', opacity: 0 }], opts: { duration: 1000, easing: 'ease-in' } },
  need: { frames: [{ transform: 'translate(-50%,-12px)', opacity: 0 }, { transform: 'translate(-50%,3px)', opacity: 1, offset: 0.1 }, { transform: 'translate(-50%,0)', opacity: 1, offset: 0.18 }, { transform: 'translate(-50%,0)', opacity: 1, offset: 0.85 }, { transform: 'translate(-50%,0)', opacity: 0 }], opts: { duration: 1500, easing: 'ease-out' } },
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

  // KitBars
  barFlash: { frames: [{ opacity: 0.95 }, { opacity: 0 }], opts: { duration: 260, easing: 'ease-out' } },
  barBump: { frames: [{ transform: 'scale(1)' }, { transform: 'scale(1.16) rotate(-3deg)', offset: 0.3 }, { transform: 'scale(1)' }], opts: { duration: 280, easing: E.bounce } },
  slamBig: { frames: [{ transform: 'scale(2.6)', opacity: 0 }, { transform: 'scale(.92)', opacity: 1, offset: 0.65 }, { transform: 'scale(1)', opacity: 1 }], opts: { duration: 450, easing: 'cubic-bezier(.2,1.2,.4,1)', fill: 'backwards' } },
  // the mockup's infinite .7s throb / .8s pulse / .14s shake, as event bursts (n beats, then rest)
  throb: (n = 3) => ({ frames: [{ transform: 'scale(1)' }, { transform: 'scale(1.12)', offset: 0.5 }, { transform: 'scale(1)' }], opts: { duration: 700, easing: 'ease-in-out', iterations: n } }),
  pulse: (n = 1) => ({ frames: [{ opacity: 1 }, { opacity: 0.4, offset: 0.5 }, { opacity: 1 }], opts: { duration: 800, easing: 'ease-in-out', iterations: n } }),
  tickShake: { frames: [{ transform: 'translate(0,0)' }, { transform: 'translate(-2px,1px)', offset: 0.25 }, { transform: 'translate(2px,-1px)', offset: 0.5 }, { transform: 'translate(-1px,-2px)', offset: 0.75 }, { transform: 'translate(0,0)' }], opts: { duration: 140, easing: 'linear', iterations: 3 } },
  stickerIn: { frames: [{ transform: 'translateY(8px) scale(.7)', opacity: 0 }, { transform: 'translateY(0) scale(1)', opacity: 1 }], opts: { duration: 220, easing: E.bounce, fill: 'backwards' } },
};

/** Play a named FX entry (or a built entry) on an element. */
export function fx(el, entry) {
  if (!entry) return null;
  return kitPlay(el, entry.frames, entry.opts);
}

/**
 * An INFORMATIONAL one-shot (a pop that says "+75", a "NEED 41 MORE" tag): play it — or, with
 * REDUCE MOTION on, show the node still for `ms` (it carries information, so it must not vanish).
 */
export function fxOrShow(el, entry, ms) {
  if (!el) return null;
  if (!reduceMotion()) return fx(el, entry);
  el.classList.add('kit-static-on');
  clearTimeout(el.__kitShowT);
  el.__kitShowT = setTimeout(() => el.classList.remove('kit-static-on'), ms || (entry && entry.opts && entry.opts.duration) || 1000);
  return null;
}
