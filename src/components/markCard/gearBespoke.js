// gearBespoke.js — BESPOKE COMPONENTS for a few individual chase gears (Andy nov6: "that mythic thing … was badass, even though
// it was too extra, unique things like that were so cool"). What was wrong was a treatment on a whole RARITY and stacking it, so:
// this table is per GEAR ID, each gear gets ONE strong idea, and it REPLACES that card's tier frame variant (never on top of it).
// Every other card keeps the house look. Parts are painted art (public/gear/bespoke/), cut so nothing covers the card's text.
//   x / y / w   % of the frame box (.mc-frame-x: 228x348 card px, the card at 24,24), so the 24px border room holds (gear-borders)
//   o           transform-origin of the part's act: where it is anchored to the card
// The act is one finite transform per part (one shared cadence: cardShine's sweep, plus hover); nothing moves at rest.
export const GEAR_BESPOKE = Object.freeze({
  // KRAKEN: its tentacles come from behind the card and clench two corners, dragging it under
  'mk-kraken': { act: 'squeeze', parts: [
    { src: '/gear/bespoke/kraken-top-v1.webp', x: 60.82, y: 0.00, w: 39.18, o: '10% 60%' },
    { src: '/gear/bespoke/kraken-bot-v1.webp', x: 0.15, y: 71.84, w: 29.97, o: '90% 40%' },
  ] },
  // HYDRA: two more heads burst out through the card, fuses lit in their teeth ("CUT ONE FUSE. TWO MORE LIGHT.")
  'mk-hydra': { act: 'lunge', parts: [
    { src: '/gear/bespoke/hydra-left-v1.webp', x: 0.00, y: 17.82, w: 28.95, o: '70% 70%' },
    { src: '/gear/bespoke/hydra-right-v1.webp', x: 73.68, y: 12.64, w: 26.32, o: '30% 70%' },
  ] },
  // ORIGIN: the card is hatching: it sits in the broken shell of the egg it came from ("BEFORE THE FIRST WORD, THIS.")
  'mk-origin': { act: 'hatch', parts: [
    { src: '/gear/bespoke/origin-top-v1.webp', x: 0.00, y: 0.00, w: 100.00, o: '20% 100%' },
    { src: '/gear/bespoke/origin-bot-v1.webp', x: 0.00, y: 56.70, w: 100.00, o: '50% 100%', act: 'settle' },
  ] },
});

/** Keyframes of each act, by name: a transform-only one-shot. */
export const BESPOKE_ACTS = Object.freeze({
  // the cap of the shell pops up off the card and drops back; the bowl takes the landing
  hatch: { ms: 560, frames: [{ transform: 'translateY(0) rotate(0)' }, { transform: 'translateY(-7px) rotate(-3deg)', offset: 0.34 }, { transform: 'translateY(1px) rotate(1deg)', offset: 0.72 }, { transform: 'translateY(0) rotate(0)' }] },
  settle: { ms: 420, frames: [{ transform: 'scale(1)' }, { transform: 'scale(1.03, 0.96)', offset: 0.5 }, { transform: 'scale(1)' }] },
  // the head snaps forward and recoils
  lunge: { ms: 460, frames: [{ transform: 'scale(1) rotate(0)' }, { transform: 'scale(1.1) rotate(-4deg)', offset: 0.28 }, { transform: 'scale(0.97) rotate(2deg)', offset: 0.62 }, { transform: 'scale(1) rotate(0)' }] },
  // the tentacle clenches on the corner, then lets go a little
  squeeze: { ms: 520, frames: [{ transform: 'scale(1) rotate(0)' }, { transform: 'scale(1.07) rotate(-3deg)', offset: 0.3 }, { transform: 'scale(0.98) rotate(1deg)', offset: 0.65 }, { transform: 'scale(1) rotate(0)' }] },
});

export const bespokeOf = (id) => (id && Object.prototype.hasOwnProperty.call(GEAR_BESPOKE, id) ? GEAR_BESPOKE[id] : null);

/** A sweep plays the act only every Nth time, so a card on screen acts roughly every 10-13 s, never constantly. */
export const ACT_EVERY_SWEEPS = 3;

/** Play one gear's act on its part nodes (finite WAAPI; will-change only for the run). Returns the animations. */
export function playBespoke(spec, nodes) {
  if (!spec) return [];
  if (nodes.some((el) => el && el.getAnimations && el.getAnimations().length)) return []; // a hover during a sweep's act: let it finish
  return spec.parts.map((p, i) => {
    const el = nodes[i];
    const act = BESPOKE_ACTS[p.act || spec.act];
    if (!el || !act || typeof el.animate !== 'function') return null;
    el.style.willChange = 'transform';
    const run = el.animate(act.frames, { duration: act.ms, delay: i * 90, easing: 'cubic-bezier(.3,1.4,.5,1)' });
    const off = () => { el.style.willChange = ''; };
    run.finished.then(off, off);
    return run;
  }).filter(Boolean);
}
