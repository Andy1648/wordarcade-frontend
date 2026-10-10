// gearShowcase.js — THE YOUR GEAR SHOWCASE (gear UI v3, Andy oct9 22:56: "maybe make the menu 'your gear' animation even
// more attractive (for legendary ones). since it's a really important animation why dont we really fine tune those").
// The menu's ONE sanctioned showcase (CLAUDE.md MENU MOTION LAW keeps the menu still otherwise; this is part of the
// RARE-GEAR GLOW exception): every SHOWCASE_EVERY_MS the worn gear performs once —
//   LEGENDARY+  the aura FLARES (GearFx `gfx:flare`: a breath + a radial mote burst; mythic's two colours, secret's
//               rainbow swap + glitch tear + orbit ring), the face FLASHES its tier colour, a burst RING (the reveal's
//               asset) blows out behind the glyph as it POPS (a wind-up, an overshoot, a settle — secret spins a full
//               turn), the sheen SWEEPS the slot, and the stat NUMBER PUNCHES once as the sweep crosses it
//   EPIC        the lighter version: a smaller glyph pop + number punch, no sheen, no burst (its aura keeps the shared
//               breath)
// Everything is a finite WAAPI one-shot on transform / opacity, scheduled by one setTimeout chain per slot (never a
// CSS loop); will-change is set for the run and cleared on finish. A hidden tab is skipped. No layout reads.
// REDUCED MOTION: never started (MenuNav) — the slot stays static.
// LAZY: MenuNav imports this only once an EPIC+ gear is worn (payload ratchet).

import './gearShowcase.css';

export const SHOWCASE_EVERY_MS = { epic: 8000, legendary: 7000, mythic: 7000, secret: 6500 };
export const SHOWCASE_FIRST_MS = 1600;
const HERO = new Set(['legendary', 'mythic', 'secret']);

/** The glyph pop per tier — the louder the tier, the bigger the wind-up and the overshoot. */
export function popFrames(tier) {
  if (tier === 'secret') {
    return [
      { transform: 'scale(1) rotate(0deg)' },
      { transform: 'scale(0.86) rotate(-20deg)', offset: 0.14 },
      { transform: 'scale(1.42) rotate(200deg)', offset: 0.45 },
      { transform: 'scale(0.94) rotate(350deg)', offset: 0.72 },
      { transform: 'scale(1) rotate(360deg)' },
    ];
  }
  const big = tier === 'mythic' ? 1.4 : tier === 'legendary' ? 1.32 : 1.16;
  const tilt = tier === 'epic' ? 6 : 14;
  return [
    { transform: 'scale(1) rotate(0deg)' },
    { transform: `scale(0.88) rotate(${tilt}deg)`, offset: 0.16 },
    { transform: `scale(${big}) rotate(-${tilt}deg)`, offset: 0.42 },
    { transform: 'scale(0.95) rotate(3deg)', offset: 0.7 },
    { transform: 'scale(1) rotate(0deg)' },
  ];
}
/** The stat number's punch: once, as the sheen crosses it. */
export function punchFrames(tier) {
  const k = tier === 'epic' ? 1.16 : tier === 'legendary' ? 1.3 : 1.38;
  return [
    { transform: 'scale(1) translateY(0)' },
    { transform: `scale(${k}) translateY(-3px)`, offset: 0.3 },
    { transform: 'scale(0.95) translateY(1px)', offset: 0.6 },
    { transform: 'scale(1) translateY(0)' },
  ];
}
/** The run's beats, in ms from its start (pure — unit-tested). */
export function showcasePlan(tier) {
  const hero = HERO.has(tier);
  return {
    flare: hero ? 0 : null,
    pop: { at: hero ? 60 : 0, ms: tier === 'secret' ? 1000 : hero ? 760 : 560 },
    sheen: hero ? { at: 260, ms: 820 } : null,
    punch: { at: hero ? 520 : 240, ms: hero ? 560 : 440 },
    ring: hero ? { at: 180, ms: 620, scale: tier === 'legendary' ? 2 : 2.5 } : null,
    flash: hero ? { at: 150, ms: 420, peak: tier === 'legendary' ? 0.22 : 0.32 } : null,
  };
}

/** Start the showcase on a YOUR GEAR slot; returns stop(). */
export function startShowcase(slot, tier) {
  if (!slot || typeof slot.animate !== 'function' || !SHOWCASE_EVERY_MS[tier]) return () => {};
  const runs = new Set();
  let timer = null;
  const play = (node, frames, opts, wc = 'transform') => {
    if (!node || typeof node.animate !== 'function') return;
    node.style.willChange = wc;
    const a = node.animate(frames, { fill: 'none', ...opts });
    runs.add(a);
    const off = () => { node.style.willChange = ''; runs.delete(a); };
    a.finished.then(off, off);
  };
  const run = () => {
    timer = setTimeout(run, SHOWCASE_EVERY_MS[tier]);
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    const plan = showcasePlan(tier);
    if (plan.flare != null) {
      const gfx = slot.querySelector('.gfx');
      if (gfx && typeof CustomEvent === 'function') gfx.dispatchEvent(new CustomEvent('gfx:flare'));
    }
    play(slot.querySelector('.hp-gear-cog'), popFrames(tier), { duration: plan.pop.ms, delay: plan.pop.at, easing: 'cubic-bezier(.3,.7,.35,1)' });
    if (plan.sheen) {
      play(slot.querySelector('.hp-gear-sheen-band'), [{ transform: 'translateX(-110%)' }, { transform: 'translateX(160%)' }], { duration: plan.sheen.ms, delay: plan.sheen.at, easing: 'cubic-bezier(.45,0,.25,1)' });
    }
    play(slot.querySelector('.hp-gear-big'), punchFrames(tier), { duration: plan.punch.ms, delay: plan.punch.at, easing: 'cubic-bezier(.25,.8,.35,1)' });
    if (plan.ring) {
      play(slot.querySelector('.hp-gear-ring'), [
        { opacity: 0, transform: 'scale(0.35) rotate(0deg)' },
        { opacity: 1, transform: 'scale(1.1) rotate(18deg)', offset: 0.3 },
        { opacity: 0, transform: `scale(${plan.ring.scale}) rotate(40deg)` },
      ], { duration: plan.ring.ms, delay: plan.ring.at, easing: 'cubic-bezier(.2,.8,.3,1)' }, 'transform, opacity');
    }
    if (plan.flash) {
      play(slot.querySelector('.hp-gear-flash'), [{ opacity: 0 }, { opacity: plan.flash.peak, offset: 0.25 }, { opacity: 0 }], { duration: plan.flash.ms, delay: plan.flash.at, easing: 'ease-out' }, 'opacity');
    }
  };
  timer = setTimeout(run, SHOWCASE_FIRST_MS);
  return () => {
    clearTimeout(timer);
    runs.forEach((a) => { try { a.cancel(); } catch { /* gone */ } });
  };
}
