// src/juice/index.js
// Shared game-feel ("juice") layer: a single import surface for squash, flash,
// burst, shake, hitStop, mark and synthesized sfx. Pure-additive and
// side-effect-free on import - canvases, the rAF loop and the AudioContext are
// all created lazily on first use. Accessibility (prefers-reduced-motion) and a
// global motion/sound flag are honored inside the module, so callers just call.
//
//   import { squash, flash, burst, sfx } from '../juice';
//   onPress(e) {
//     const el = e.currentTarget;
//     const r = el.getBoundingClientRect();
//     squash(el);
//     flash(el, '#FF2EC4');
//     burst(r.left + r.width / 2, r.top + r.height / 2, { count: 16 });
//     sfx('tap');
//   }

export { squash, flash, shake, hitStop, isHitStopped, setShakeRoot } from './motion';
export { burst, mark, clearMarks } from './particles';
export { sfx, unlockAudio } from './audio';
export {
  setMotion,
  setSound,
  setMuted,
  getSettings,
  prefersReducedMotion,
} from './settings';
