// kitArt.js — a worn POP STYLE's KIT on the XP bar (oct27): the painted fill strip, the crit burst, the edge cap
// (public/shop/pop/bar|crit|edge-<id>.webp) + the bar's colours and its live layer. LAZY (oct28, the payload ratchet):
// the menu imports it only while a paid look is worn, and its styles (kitBar.css) ride with it. Which ids are painted
// lives in the kitIds.js leaf; a look not listed keeps its burst + the plain dress.
import '../components/kit/kitBar.css';
import { KIT_PAINTED, EDGE_PAINTED } from './kitIds.js';
import { kitPlay } from '../components/kit/motion.js'; // (a no-op under reduce motion)
export { KIT_PAINTED, EDGE_PAINTED };
/** The XP bar's painted fill while `id` is worn, or null. */
export const kitBarOf = (id) => (KIT_PAINTED.has(id) ? `/shop/pop/bar-${id}.webp` : null);

// THE KIT's BAR, end to end (oct27, Andy: "the progress bar still doesnt fit with the theme"): the frame is the look's
// coloured outline (a darker shade of its fill — the house rule), the empty channel its own dark well, the LV / goal
// plates its colours, the ghost and the level sweep its light, a painted cap rides the fill's leading edge, and a level
// wrap slams the look's crit art on the goal plate. edge = the outline · well = the channel · hi = numerals / light.
const THEME = {
  chrome: { edge: '#6B7790', well: '#161B26', hi: '#E8EEF6' },
  inferno: { edge: '#B8320A', well: '#240800', hi: '#FFB23D' },
  void: { edge: '#6A22C8', well: '#12052A', hi: '#C98CFF' },
  prism: { edge: '#B44CFF', well: '#160A28', hi: '#2EFFE0' },
  toxic: { edge: '#4C9A00', well: '#0B1A02', hi: '#9EFF2E' },
  ember: { edge: '#A8200F', well: '#1A0604', hi: '#FF6B3D' },
  frost: { edge: '#2A8CC0', well: '#061826', hi: '#C9F4FF' },
  gold: { edge: '#A87A00', well: '#1E1400', hi: '#FFD54A' },
  plasma: { edge: '#B0136A', well: '#22041A', hi: '#FF9AD5' },
  nova: { edge: '#C9A800', well: '#1A1A08', hi: '#FFFFFF' },
  eclipse: { edge: '#FF9A1F', well: '#050208', hi: '#FF9A1F' },
  legend: { edge: '#FF4FA3', well: '#1A0B2E', hi: '#FFE94A' },
};
const CAP_BUMP = [{ transform: 'scale(1) rotate(0deg)' }, { transform: 'scale(1.32) rotate(-14deg)', offset: 0.3 }, { transform: 'scale(1) rotate(0deg)' }];
const CAP_FLARE = [{ transform: 'scale(1) rotate(0deg)' }, { transform: 'scale(2.1) rotate(40deg)', offset: 0.25 }, { transform: 'scale(1) rotate(90deg)' }];
const KIT_SLAM = [
  { transform: 'translate(-50%,-50%) scale(.3) rotate(-30deg)', opacity: 0, easing: 'cubic-bezier(.2,1.5,.4,1)' },
  { transform: 'translate(-50%,-50%) scale(1.25) rotate(4deg)', opacity: 1, offset: 0.22, easing: 'ease-out' },
  { transform: 'translate(-50%,-50%) scale(1) rotate(10deg)', opacity: 1, offset: 0.5, easing: 'ease-in' },
  { transform: 'translate(-50%,-50%) scale(1.15) rotate(18deg)', opacity: 0 },
];
// THE KIT's LAYER on the XP bar (KitXpBar mounts it while a kit is worn): the painted fill on a child of the fill that
// counter-scales by 1/f (revealed, never stretched), the cap on the leading edge (translate x + f·w; the track's offset
// + width — offset* ignore the bar's skew — measured now and on resize only) and the crit art that slams on a wrap.
// Plain DOM nodes outside React's tree, removed on destroy; every motion a finite kitPlay one-shot.
function mount(kit, root, wrap, bar, tr, fill, f0) {
  const node = (tag, cls, src) => { const n = document.createElement(tag); n.className = cls; n.setAttribute('aria-hidden', 'true'); if (src) { n.src = src; n.alt = ''; n.draggable = false; } return n; };
  const cap = node('span', 'kx-cap'); const art = node('img', '', kit.cap); cap.appendChild(art);
  const slam = node('img', 'kx-slam', kit.crit);
  const skin = node('div', 'kx-fill-skin'); skin.style.backgroundImage = `url(${kit.fill})`;
  wrap.insertBefore(slam, wrap.firstChild); wrap.insertBefore(cap, wrap.firstChild);
  fill.classList.add('is-skin'); fill.insertBefore(skin, fill.firstChild);
  // the root wears the kit (data-kit + its colour vars — not React-managed, so a re-render never strips them)
  root.dataset.kit = kit.id;
  for (const k of ['edge', 'well', 'hi']) root.style.setProperty(`--kit-${k}`, kit[k]);
  const box = { x: 0, w: 0, f: f0 };
  const place = () => { cap.style.transform = `translate(${box.x + box.f * box.w}px,-50%)`; };
  const measure = () => { box.x = bar.offsetLeft + bar.clientLeft + tr.offsetLeft; box.w = tr.offsetWidth; place(); };
  const frame = (f) => { box.f = f; skin.style.transform = `scaleX(${1 / Math.max(f, 0.002)})`; place(); };
  frame(f0); measure();
  const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
  if (ro) ro.observe(bar);
  return {
    frame,
    hold: (on) => { cap.style.willChange = on ? 'transform' : ''; },
    bump: () => kitPlay(art, CAP_BUMP, { duration: 300, easing: 'cubic-bezier(.2,1.4,.4,1)' }),
    wrap: () => { kitPlay(slam, KIT_SLAM, { duration: 760 }); kitPlay(art, CAP_FLARE, { duration: 420, easing: 'cubic-bezier(.2,1.3,.4,1)' }); },
    destroy: () => { if (ro) ro.disconnect(); delete root.dataset.kit; cap.remove(); slam.remove(); skin.remove(); fill.classList.remove('is-skin'); },
  };
}
const FX = { mount };
/** The whole bar kit while `id` is worn (painted looks only), or null. */
export function kitOf(id) {
  if (!KIT_PAINTED.has(id) || !THEME[id]) return null;
  return {
    id,
    ...THEME[id],
    fx: FX,
    fill: `/shop/pop/bar-${id}.webp`,
    crit: `/shop/pop/crit-${id}.webp`,
    cap: EDGE_PAINTED.has(id) ? `/shop/pop/edge-${id}.webp` : `/shop/pop/burst-${id}.webp`,
  };
}
