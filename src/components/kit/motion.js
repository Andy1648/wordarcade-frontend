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
// The entries the MENU plays (icon / rail buttons, currency pills, the XP bar). Every other kit effect
// is added to this same table by motionMore.js, which each other kit component imports — so the
// homepage chunk carries only these.
export const FX = {
  bump: { frames: [{ transform: 'scale(1)' }, { transform: 'scale(1.22) rotate(-4deg)', offset: 0.35 }, { transform: 'scale(1)' }], opts: { duration: 320, easing: E.bounce } },
  slamSmall: { frames: [{ transform: 'scale(1.9)', opacity: 0 }, { transform: 'scale(.94)', opacity: 1, offset: 0.65 }, { transform: 'scale(1)', opacity: 1 }], opts: { duration: 300, easing: E.slam, fill: 'backwards' } },
  dotIn: { frames: [{ transform: 'scale(0)' }, { transform: 'scale(1.25)', offset: 0.6 }, { transform: 'scale(1)' }], opts: { duration: 300, easing: 'cubic-bezier(.2,1.5,.4,1)', fill: 'backwards' } },
  // the mockup's 1.4s infinite dot pulse, as ONE beat after the dot lands
  dotBeat: { frames: [{ transform: 'scale(1)' }, { transform: 'scale(1.12)', offset: 0.5 }, { transform: 'scale(1)' }], opts: { duration: 1400, easing: 'ease-in-out', delay: 300 } },
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
  // KitBars
  barFlash: { frames: [{ opacity: 0.95 }, { opacity: 0 }], opts: { duration: 260, easing: 'ease-out' } },
  barBump: { frames: [{ transform: 'scale(1)' }, { transform: 'scale(1.16) rotate(-3deg)', offset: 0.3 }, { transform: 'scale(1)' }], opts: { duration: 280, easing: E.bounce } },
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
