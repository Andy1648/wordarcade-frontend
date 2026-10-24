// cardActs.js — THE CARD ACTS (Andy oct24: "the idea of components ABSOLUTELY saved the game card designs … redesign
// chain and fuse"). A painted card is built from separate layers (backdrop / hero / FX / PARTS); every so often ONE
// card performs its ACT — its parts move on their own (a flash, a whip, flying links, a spark flare) — then sits
// still again. One shared setTimeout chain for the whole grid (never a CSS loop, never a timer per card): every
// ACT_GAP_MS the next eligible card (on screen, not locked, rested ≥ ACT_REST_MS) plays; a hidden tab is skipped.
// Every move is a finite WAAPI one-shot on transform / opacity; will-change is set for the run and cleared on finish.
// No layout reads: on-screen comes from one shared IntersectionObserver. REDUCE MOTION: never started.
// Kept free of any CSS / React import so node:test can load it.

export const ACT_FIRST_MS = 1400;
export const ACT_GAP_MS = 3400;
export const ACT_REST_MS = 8200;

const EASE_POP = 'cubic-bezier(.2,1.4,.4,1)';
const EASE_OUT = 'cubic-bezier(.2,.9,.3,1)';

/** A part bursting out of its spot: pops in, overshoots, fades as it keeps growing. */
export function burstFrames(peak = 1.15, spin = 0) {
  return [
    { transform: `scale(0.4) rotate(${-spin}deg)`, opacity: 0 },
    { transform: `scale(${peak}) rotate(0deg)`, opacity: 1, offset: 0.35 },
    { transform: `scale(${peak + 0.12}) rotate(${spin / 2}deg)`, opacity: 0 },
  ];
}
/** A part flung from its spot by (dx, dy) % of its own size, spinning, fading at the end of its flight. */
export function flingFrames(dx, dy, spin) {
  return [
    { transform: 'translate(0,0) rotate(0deg) scale(0.6)', opacity: 0 },
    { transform: `translate(${dx * 0.35}%,${dy * 0.35}%) rotate(${spin * 0.35}deg) scale(1)`, opacity: 1, offset: 0.2 },
    { transform: `translate(${dx * 0.8}%,${dy * 0.8}%) rotate(${spin * 0.8}deg) scale(1)`, opacity: 1, offset: 0.7 },
    { transform: `translate(${dx}%,${dy}%) rotate(${spin}deg) scale(0.9)`, opacity: 0 },
  ];
}

// Each act is data: which layer moves, how, when. `hero` = the actor wrapper around the hero (its CSS pose stays on
// the img inside, so the act composes with the hover lean); anything else is a part id from gameData artLayers.parts.
export const ACTS = {
  // CHAIN — the link WHIPS its lasso: a wind-up, the crack (the vault flash blows out behind it), two links fly off.
  chain: [
    { el: 'hero', at: 0, ms: 760, ease: 'cubic-bezier(.3,1.25,.5,1)', frames: [
      { transform: 'translate(0,0) rotate(0deg) scale(1)' },
      { transform: 'translate(1.5%,1%) rotate(5deg) scale(0.97,1.03)', offset: 0.22 },
      { transform: 'translate(-2.5%,-3%) rotate(-9deg) scale(1.05,0.96)', offset: 0.46 },
      { transform: 'translate(0.5%,0) rotate(2deg) scale(1)', offset: 0.72 },
      { transform: 'translate(0,0) rotate(0deg) scale(1)' },
    ] },
    { el: 'flash', at: 260, ms: 520, ease: EASE_POP, frames: burstFrames(1.12, 24) },
    { el: 'link', at: 300, ms: 760, ease: EASE_OUT, frames: flingFrames(-170, 40, -260) },
    { el: 'links', at: 340, ms: 780, ease: EASE_OUT, frames: flingFrames(170, 70, 240) },
    { el: 'shards', at: 280, ms: 460, ease: EASE_POP, frames: burstFrames(1.05, -30) },
  ],
  // FUSE — the firecracker SNEAKS: a tiptoe two-step in place, the fuse FLARES (a gold flash, the spark bursts, a puff of smoke).
  fuse: [
    { el: 'hero', at: 0, ms: 900, ease: 'ease-in-out', frames: [
      { transform: 'translate(0,0) rotate(0deg)' },
      { transform: 'translate(1.5%,-2.2%) rotate(4deg)', offset: 0.2 },
      { transform: 'translate(2.5%,0) rotate(1deg)', offset: 0.4 },
      { transform: 'translate(1%,-2.2%) rotate(-4deg)', offset: 0.62 },
      { transform: 'translate(-0.5%,0) rotate(-1deg)', offset: 0.82 },
      { transform: 'translate(0,0) rotate(0deg)' },
    ] },
    { el: 'flash', at: 330, ms: 440, ease: EASE_POP, frames: burstFrames(1, 30) },
    { el: 'spark', at: 360, ms: 560, ease: EASE_POP, frames: burstFrames(1.25, 70) },
    { el: 'shards', at: 420, ms: 480, ease: EASE_POP, frames: burstFrames(1.05, 20) },
    { el: 'smoke', at: 520, ms: 900, ease: EASE_OUT, frames: flingFrames(-40, -120, -25) },
  ],
};

/** The run's length (pure — unit-tested): when the last step ends. */
export function actLength(name) {
  return (ACTS[name] || []).reduce((m, s) => Math.max(m, s.at + s.ms), 0);
}

const hosts = []; // { node, act, els: { hero, [partId] }, seen, locked, last }
let timer = null;
let turn = 0;
let io = null;
const runs = new Set();

function play(h) {
  h.last = Date.now();
  for (const step of ACTS[h.act] || []) {
    const el = h.els[step.el];
    if (!el || typeof el.animate !== 'function') continue;
    el.style.willChange = 'transform, opacity';
    const a = el.animate(step.frames, { duration: step.ms, delay: step.at, easing: step.ease });
    runs.add(a);
    const off = () => { el.style.willChange = ''; runs.delete(a); };
    a.finished.then(off, off);
  }
}

function tick() {
  timer = setTimeout(tick, ACT_GAP_MS);
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
  const now = Date.now();
  for (let i = 0; i < hosts.length; i++) {
    const h = hosts[(turn + i) % hosts.length];
    if (h.seen && !h.locked && now - h.last >= ACT_REST_MS) {
      turn = (turn + i + 1) % hosts.length;
      play(h);
      return;
    }
  }
}

/** Register a layered card. Returns its unregister. `locked` may be updated through the returned host. */
export function registerCardAct(node, act, els, locked) {
  if (!node || !ACTS[act]) return { host: null, off: () => {} };
  const h = { node, act, els, seen: false, locked: !!locked, last: Date.now() - ACT_REST_MS };
  hosts.push(h);
  if (typeof IntersectionObserver === 'function') {
    if (!io) {
      io = new IntersectionObserver((entries) => {
        for (const e of entries) {
          const x = hosts.find((k) => k.node === e.target);
          if (x) x.seen = e.isIntersecting;
        }
      }, { threshold: 0.4 });
    }
    io.observe(node);
  } else {
    h.seen = true;
  }
  if (!timer) timer = setTimeout(tick, ACT_FIRST_MS);
  const off = () => {
    const at = hosts.indexOf(h);
    if (at >= 0) hosts.splice(at, 1);
    if (io) io.unobserve(node);
    if (!hosts.length) {
      clearTimeout(timer);
      timer = null;
      for (const a of [...runs]) { try { a.cancel(); } catch { /* gone */ } }
      runs.clear();
    }
  };
  return { host: h, off };
}
