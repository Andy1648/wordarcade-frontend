// badgeFrames.js — the STICKER-BADGE avatar frames (art nov21, Andy: "frames look static and cropped … ANIMATED with
// layered moving parts"). Direction A of the nov12 sheet: each frame is a die-cut sticker badge the WHOLE hero stands on
// (no square crop), with its own free painted PROPS around it that move. Every part is a separate painted asset, so
// nothing has to line up with anything else: the badge, the hero, each prop.
// Geometry in % of the frame box: the badge fills it; the hero stands on its lower half; each prop is { src, x, y, w,
// flip, act } (x/y = its CENTRE). PURE data + one shared idle scheduler (no React) so node:test can load it.
export const BADGE_FRAMES = Object.freeze({
  flame: { badge: '/cast/badge/flame-badge-v1.webp', props: [
    { src: '/cast/badge/flame-tongue-v1.webp', x: 14, y: 22, w: 26, flip: true, act: 'lick' },
    { src: '/cast/badge/flame-tongue-v1.webp', x: 86, y: 16, w: 30, act: 'lick' },
  ] },
  frost: { badge: '/cast/badge/frost-badge-v1.webp', props: [
    { src: '/cast/badge/ice-shard-v1.webp', x: 12, y: 30, w: 22, flip: true, act: 'glint' },
    { src: '/cast/badge/ice-shard-v1.webp', x: 88, y: 20, w: 26, act: 'glint' },
  ] },
  jackpot: { badge: '/cast/badge/jackpot-badge-v1.webp', props: [
    { src: '/cast/badge/gold-coin-v1.webp', x: 16, y: 18, w: 24, act: 'flip' },
    { src: '/cast/badge/gold-coin-v1.webp', x: 86, y: 30, w: 20, act: 'flip' },
  ] },
});
export const badgeFrameOf = (id) => (id && Object.prototype.hasOwnProperty.call(BADGE_FRAMES, id) ? BADGE_FRAMES[id] : null);

// Every act: ONE finite transform/opacity one-shot (WAAPI), ≤ 700 ms. Played on appear (equip / try-on), on hover/tap,
// and as the idle burst below — never looping, never at rest.
export const BADGE_ACTS = Object.freeze({
  // the badge lands: dropped on, squashes, settles
  land: { ms: 460, frames: [{ transform: 'translateY(-18%) scale(1.15)', opacity: 0 }, { transform: 'translateY(3%) scale(.94,1.06)', opacity: 1, offset: 0.55 }, { transform: 'none', opacity: 1 }] },
  // the badge wobbles under the burst (a sticker flexing)
  wobble: { ms: 480, frames: [{ transform: 'rotate(0deg) scale(1)' }, { transform: 'rotate(-6deg) scale(1.05)', offset: 0.3 }, { transform: 'rotate(4deg) scale(.98)', offset: 0.6 }, { transform: 'rotate(0deg) scale(1)' }] },
  // the hero hops on the badge
  hop: { ms: 420, frames: [{ transform: 'none' }, { transform: 'translateY(-15%) scale(.94,1.07)', offset: 0.35 }, { transform: 'translateY(2%) scale(1.07,.93)', offset: 0.7 }, { transform: 'none' }] },
  // a flame tongue licks up: stretches tall from its base, kinks, snaps back
  lick: { ms: 560, frames: [{ transform: 'scale(1,1) skewX(0deg)' }, { transform: 'scale(.85,1.5) skewX(-14deg)', offset: 0.3 }, { transform: 'scale(1.1,.82) skewX(10deg)', offset: 0.6 }, { transform: 'scale(1,1) skewX(0deg)' }] },
  // an ice shard glints: a quick turn and a bright pulse (opacity dip-and-back reads as the light catching it)
  glint: { ms: 520, frames: [{ transform: 'rotate(0deg) scale(1)', opacity: 1 }, { transform: 'rotate(-24deg) scale(1.32)', opacity: 0.5, offset: 0.35 }, { transform: 'rotate(10deg) scale(.94)', opacity: 1, offset: 0.7 }, { transform: 'rotate(0deg) scale(1)', opacity: 1 }] },
  // a coin flips: turns edge-on and back while it hops
  flip: { ms: 620, frames: [{ transform: 'translateY(0) scaleX(1)' }, { transform: 'translateY(-55%) scaleX(.08)', offset: 0.35 }, { transform: 'translateY(-40%) scaleX(-1)', offset: 0.55 }, { transform: 'translateY(6%) scaleX(.1)', offset: 0.8 }, { transform: 'translateY(0) scaleX(1)' }] },
});

/** Play one act on `el` (finite WAAPI; will-change only for the run). Skips a node already mid-act. */
export function playAct(el, act, delay = 0) {
  const a = BADGE_ACTS[act];
  if (!el || !a || typeof el.animate !== 'function') return null;
  if (el.getAnimations && el.getAnimations().length) return null;
  el.style.willChange = 'transform, opacity';
  const run = el.animate(a.frames, { duration: a.ms, delay, easing: 'cubic-bezier(.3,1.3,.5,1)', fill: 'backwards' });
  const off = () => { el.style.willChange = ''; };
  run.finished.then(off, off);
  return run;
}

// THE IDLE BURST: ONE shared setTimeout chain for every badge frame on screen (never a timer per frame, never a CSS loop).
// Every GAP_MS the next eligible frame (on screen, rested ≥ REST_MS) plays its props + a hop; a hidden tab skips.
export const IDLE_GAP_MS = 1800;
export const IDLE_REST_MS = 4000;
const hosts = []; // { node, play, seen, last }
let timer = null; let turn = 0; let io = null;
function tick() {
  timer = setTimeout(tick, IDLE_GAP_MS);
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
  const now = Date.now();
  for (let i = 0; i < hosts.length; i += 1) {
    const h = hosts[(turn + i) % hosts.length];
    if (h.seen && now - h.last >= IDLE_REST_MS) { turn = (turn + i + 1) % hosts.length; h.last = now; h.play(); return; }
  }
}
/** Register a mounted badge frame for idle bursts; returns its unregister. `play` runs its burst. */
export function registerBadgeIdle(node, play) {
  if (!node) return () => {};
  const h = { node, play, seen: typeof IntersectionObserver !== 'function', last: Date.now() };
  hosts.push(h);
  if (typeof IntersectionObserver === 'function') {
    if (!io) io = new IntersectionObserver((es) => { for (const e of es) { const x = hosts.find((k) => k.node === e.target); if (x) x.seen = e.isIntersecting; } }, { threshold: 0.4 });
    io.observe(node);
  }
  if (!timer) timer = setTimeout(tick, IDLE_GAP_MS);
  return () => {
    const at = hosts.indexOf(h);
    if (at >= 0) hosts.splice(at, 1);
    if (io) io.unobserve(node);
    if (!hosts.length) { clearTimeout(timer); timer = null; }
  };
}
