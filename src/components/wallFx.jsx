// wallFx.jsx — N4 (Andy oct2): the wall-tier RE-FORM choreography + the level stamp. Lazy: WallScene
// imports it only when a wall tier is crossed (once per 100 levels), so none of this is in a page's
// initial payload. `a` / `b` are the pieces' old / new positions ({ top, left } in % of the wall).
import { createPortal } from 'react-dom';
import { sfx } from '../juice/audio';
import { WALL_LEVELS_PER_TIER } from '../progress/wallTier';
import { WALL_FX_MS } from './WallScene';
import './wallFx.css';

export function landSound() {
  sfx('win');
}
/** H2b: the whoosh as the pieces lift (Web Audio synth, honours mute). */
export function liftSound() {
  sfx('slash');
}
// The SAME pieces fly from where they were to where the new tier puts them, through a choreography
// (QUALITY PROTOCOL: three versions, an adversarial reviewer picks). transform/opacity only, finite,
// will-change only while it runs; the pane size is read ONCE at the start, never per frame.
// QUALITY PROTOCOL (N4): A scatter→re-form / B arc shuffle / C vacuum→burst were built; the adversarial
// reviewer (claude/finetune/n4/) picked B — the only one where every word can be FOLLOWED from its old
// spot to its new one — with must-fixes applied: the flight fills 150-1000ms (stagger ≤300ms), the new
// wall HOLDS lit to ~1350ms before it dims, arcs bow away from the card band and stay inside the frame,
// and a level STAMP lands so the moment means "you reached LV N". ?wallfx=a|c still plays the others.
const WALL_FX = (() => {
  try {
    const q = new URLSearchParams(window.location.search).get('wallfx');
    return q === 'a' || q === 'c' ? q : 'b';
  } catch {
    return 'b';
  }
})();
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
/** Light the wall: each piece's art rises to full strength for the moment, then settles back. */
function lightArt(el, duration, delay = 0) {
  const art = el.firstElementChild;
  if (!art) return;
  const base = Number.parseFloat(art.style.opacity);
  const op = Number.isFinite(base) ? base : 1;
  art.animate(
    [{ opacity: op }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.82 }, { opacity: op }],
    { duration, delay, easing: 'ease-in-out' },
  );
}
export function runWallFx(pane, a, b, { reduce = false, variant = WALL_FX } = {}) {
  if (!pane) return;
  const W = pane.clientWidth;
  const H = pane.clientHeight;
  if (!W || !H) return;
  const cx = W / 2;
  const cy = H / 2;
  for (const el of pane.querySelectorAll('.wall-piece')) {
    const i = Number(el.dataset.i);
    if (!a[i] || !b[i]) continue;
    // reduced motion: no flight — the wall lights up in its NEW layout and settles (opacity only)
    lightArt(el, WALL_FX_MS);
    if (reduce) continue;
    const ox = (a[i].left / 100) * W;
    const oy = (a[i].top / 100) * H;
    const nx = (b[i].left / 100) * W;
    const ny = (b[i].top / 100) * H;
    const dx = ox - nx;
    const dy = oy - ny;
    const spin = (i % 2 ? 1 : -1) * (14 + ((i * 7) % 22));
    let frames;
    let opts;
    if (variant === 'a') {
      const vx = ox - cx;
      const vy = oy - cy;
      const len = Math.max(1, Math.hypot(vx, vy));
      const push = Math.max(W, H) * 0.28;
      frames = [
        { transform: `translate(${dx}px, ${dy}px) scale(1)` },
        { transform: `translate(${dx + (vx / len) * push}px, ${dy + (vy / len) * push}px) scale(1.3) rotate(${spin}deg)`, offset: 0.4, easing: 'cubic-bezier(.3,0,.5,1)' },
        { transform: 'translate(0px, 0px) scale(1)', easing: 'cubic-bezier(.2,1.25,.35,1)' },
      ];
      opts = { duration: 1100, delay: 150 + ((i * 13) % 200), easing: 'cubic-bezier(.2,.8,.2,1)' };
    } else if (variant === 'c') {
      frames = [
        { transform: `translate(${dx}px, ${dy}px) scale(1)` },
        { transform: `translate(${cx - nx}px, ${cy - ny}px) scale(0.15) rotate(${spin * 3}deg)`, offset: 0.38, easing: 'cubic-bezier(.6,0,.9,.4)' },
        { transform: `translate(${cx - nx}px, ${cy - ny}px) scale(0.15)`, offset: 0.48 },
        { transform: 'translate(0px, 0px) scale(1)', easing: 'cubic-bezier(.2,1.4,.4,1)' },
      ];
      opts = { duration: 1300, delay: 100, easing: 'linear' };
    } else {
      // B — ARC SHUFFLE: lift, swing along a curve, land with a small pop. The arc bows AWAY from the
      // card band (the middle of the screen) and its apex is kept inside the frame.
      const mx = (ox + nx) / 2;
      const my = (oy + ny) / 2;
      const bow = Math.min(H * 0.22, 40 + Math.hypot(dx, dy) * 0.3) * (my < cy ? -1 : 1);
      const ax = clamp(mx, W * 0.03, W * 0.95) - nx;
      const ay = clamp(my + bow, H * 0.04, H * 0.94) - ny;
      frames = [
        { transform: `translate(${dx}px, ${dy}px) scale(1)` },
        { transform: `translate(${dx}px, ${dy}px) scale(1.18)`, offset: 0.12 },
        { transform: `translate(${ax}px, ${ay}px) scale(1.24) rotate(${spin / 2}deg)`, offset: 0.55 },
        { transform: 'translate(0px, 0px) scale(1.12)', offset: 0.86 },
        { transform: 'translate(0px, 0px) scale(1)' },
      ];
      opts = { duration: 850, delay: 150 + ((i * 41) % 300), easing: 'cubic-bezier(.45,0,.2,1)' };
    }
    el.style.willChange = 'transform';
    const anim = el.animate(frames, { ...opts, fill: 'backwards' });
    const done = () => { el.style.willChange = ''; };
    anim.onfinish = done;
    anim.oncancel = done;
  }
  // …and the menu steps back while it happens (html[data-wallfx], WallScene.css)
  const html = document.documentElement;
  html.setAttribute('data-wallfx', '1');
  clearTimeout(runWallFx.t);
  runWallFx.t = setTimeout(() => html.removeAttribute('data-wallfx'), WALL_FX_MS - 250);
}

/** The level stamp that names the moment — portalled above the (stepped-back) menu. Finite. */
export function WallStamp({ fx }) {
  if (!fx) return null;
  return createPortal(
    <div className="wall-stamp" key={fx.key} aria-live="polite">
      <div className="wall-stamp-lv">LV {(fx.to * WALL_LEVELS_PER_TIER).toLocaleString('en-US')}</div>
      <div className="wall-stamp-sub">NEW WALL</div>
    </div>,
    document.body,
  );
}

