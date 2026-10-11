// cardShine.js — THE CARD SHINE LADDER (Andy oct11: "i dont see the vertical lines concept animation for the legendary
// gear card. need something like that for the rest"). Every live gear card sweeps its tier's shine asset
// (public/fx/shine-<tier>.svg — the approved two-band "fat + thin" pass, quieter below LEGENDARY, louder above) across
// its face, on a cadence that climbs with rarity.
//
// ONE shared scheduler for every card on screen (INDEX, EQUIP, GEAR SHEET, the roll's landed card): one setTimeout
// tick; each tick starts at most MAX_PER_TICK sweeps (so a grid of cards staggers instead of flashing in unison);
// off-screen cards (IntersectionObserver) and a hidden tab are skipped. Each sweep is a FINITE WAAPI transform with
// will-change set for the run only — nothing loops in CSS, nothing runs with no cards registered.
export const SHINE_EVERY_MS = Object.freeze({ rare: 9000, epic: 7000, legendary: 5200, mythic: 4400, secret: 3600 });
export const SHINE_MS = Object.freeze({ rare: 800, epic: 850, legendary: 900, mythic: 950, secret: 1000 });
export const SHINE_TIERS = Object.keys(SHINE_EVERY_MS);
const TICK_MS = 600;
const MAX_PER_TICK = 2;

export const shineSrc = (tier) => `/fx/shine-${SHINE_EVERY_MS[tier] ? tier : 'legendary'}.svg`;

const hosts = new Map(); // clip el → { band, tier, due, run }
const visible = new Set();
let io = null;
let timer = null;

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const every = (tier) => SHINE_EVERY_MS[tier] || SHINE_EVERY_MS.legendary;

/** The hosts whose sweep is due, in due order, capped — pure (the unit test drives it). */
export function dueHosts(list, t, isVisible, cap = MAX_PER_TICK) {
  return list.filter((h) => h.due <= t && isVisible(h)).sort((a, b) => a.due - b.due).slice(0, cap);
}

function sweep(clip, h, t) {
  // jitter the next one so cards of a tier drift apart instead of syncing up
  h.due = t + every(h.tier) * (0.85 + Math.random() * 0.3);
  const band = h.band;
  if (!band || typeof band.animate !== 'function') return;
  band.style.willChange = 'transform';
  h.run = band.animate([{ transform: 'translateX(-110%)' }, { transform: 'translateX(110%)' }], {
    duration: SHINE_MS[h.tier] || SHINE_MS.legendary,
    easing: 'cubic-bezier(.45,0,.25,1)',
  });
  const off = () => { band.style.willChange = ''; h.run = null; };
  h.run.finished.then(off, off);
}

function tick() {
  timer = hosts.size ? setTimeout(tick, TICK_MS) : null;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
  const t = now();
  const list = [...hosts.entries()].map(([clip, h]) => Object.assign(h, { clip }));
  for (const h of dueHosts(list, t, (x) => visible.has(x.clip))) sweep(h.clip, h, t);
}

/** Register a card's shine clip + band; returns the unregister. */
export function shineHost(clip, band, tier) {
  if (!clip || !band) return () => {};
  const t = now();
  hosts.set(clip, { band, tier, due: t + 400 + Math.random() * every(tier) * 0.6, run: null });
  if (typeof IntersectionObserver === 'function') {
    if (!io) io = new IntersectionObserver((es) => { for (const e of es) { if (e.isIntersecting) visible.add(e.target); else visible.delete(e.target); } });
    io.observe(clip);
  } else visible.add(clip);
  if (!timer) timer = setTimeout(tick, TICK_MS);
  return () => {
    const h = hosts.get(clip);
    if (h && h.run) { try { h.run.cancel(); } catch { /* gone */ } }
    hosts.delete(clip);
    visible.delete(clip);
    if (io) io.unobserve(clip);
    if (!hosts.size && timer) { clearTimeout(timer); timer = null; }
  };
}
