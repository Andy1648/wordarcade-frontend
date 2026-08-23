// MenuXp.jsx — the menu XP UI: a persistent progress row (MenuXpBar, lives INSIDE the
// menu panel) and the feedback layer (MenuXpFx, lives in the outer backdrop margin,
// OUTSIDE the panel border). All motion is finite, transform/opacity only, and nothing
// animates at rest. No will-change anywhere (the site-wide budget is exactly two
// elements). No getBoundingClientRect in the per-keystroke path — spawn zones are
// measured on mount/resize and cached.
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import './MenuXp.css';

// The persistent bar: "LV 7" · fill · "142 TO LV 8". Fill is scaleX, never width.
export function MenuXpBar({ level, toNext, frac }) {
  return (
    <div className="menu-xp-bar" aria-hidden="true">
      <span className="menu-xp-lv">LV {level}</span>
      <span className="menu-xp-track">
        <span className="menu-xp-fill" style={{ transform: `scaleX(${Math.max(0, Math.min(1, frac))})` }} />
      </span>
      <span className="menu-xp-next">
        {toNext} TO LV {level + 1}
      </span>
    </div>
  );
}

const POP_MS = 320;
const POP_EASE = 'cubic-bezier(.2,.7,.2,1)';
const LEVELUP_MS = 480;
const CENTER = 'translate(-50%,-50%) ';
const POOL = 4;
// Rough popup half-size, used only to keep a spawn OUTSIDE the panel border (never a
// per-keystroke measurement).
const HALF_W = 12;
const HALF_H = 10;
const PAD = 4;

// MenuXpFx — imperative: popup('+1') per credited keystroke, celebrate() on level-up.
export const MenuXpFx = forwardRef(function MenuXpFx(_props, ref) {
  const layerRef = useRef(null);
  const popRefs = useRef([]);
  const levelupRef = useRef(null);
  const popAnimsRef = useRef([]);
  const levelupAnimRef = useRef(null);
  const bandsRef = useRef([]);
  const nextRef = useRef(0);

  // Measure the margin bands (areas of the backdrop OUTSIDE the panel) on mount + resize.
  // The layer is inset:0 within .homepage-wrap, so its own rect is the wrap's box.
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return undefined;

    const measure = () => {
      const stage = document.querySelector('.homepage-stage');
      if (!stage) return;
      const wrap = layer.getBoundingClientRect();
      const s = stage.getBoundingClientRect();
      const W = wrap.width;
      const H = wrap.height;
      const sL = s.left - wrap.left;
      const sR = s.right - wrap.left;
      const sT = s.top - wrap.top;
      const sB = s.bottom - wrap.top;
      // Each band is a CENTER-position range that keeps the popup box outside the panel
      // border (clipping at the viewport edge by overflow:hidden is fine).
      const bands = [];
      if (sL > PAD) bands.push({ x0: -HALF_W, x1: sL - PAD - HALF_W, y0: HALF_H, y1: H - HALF_H }); // left gutter
      if (W - sR > PAD) bands.push({ x0: sR + PAD + HALF_W, x1: W + HALF_W, y0: HALF_H, y1: H - HALF_H }); // right gutter
      if (sT > PAD + 2 * HALF_H) bands.push({ x0: HALF_W, x1: W - HALF_W, y0: HALF_H, y1: sT - PAD - HALF_H }); // top
      if (H - sB > PAD + 2 * HALF_H) bands.push({ x0: HALF_W, x1: W - HALF_W, y0: sB + PAD + HALF_H, y1: H - HALF_H }); // bottom
      // Keep only bands with a real span.
      bandsRef.current = bands.filter((b) => b.x1 > b.x0 && b.y1 > b.y0);
    };

    measure();
    const raf = requestAnimationFrame(measure); // after fonts/layout settle
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
    };
  }, []);

  // Create the pooled WAAPI animations ONCE (idle at rest). Keyframes are constant; the
  // spawn point is set per call via left/top (not via keyframes).
  useEffect(() => {
    const opts = { duration: POP_MS, easing: POP_EASE, fill: 'both' };
    popAnimsRef.current = popRefs.current.map((el) => {
      const a = el.animate(
        [
          { transform: `${CENTER}translateY(4px)`, opacity: 0, offset: 0 },
          { transform: `${CENTER}translateY(-4px)`, opacity: 1, offset: 0.25 },
          { transform: `${CENTER}translateY(-22px)`, opacity: 0, offset: 1 },
        ],
        opts
      );
      a.cancel();
      return a;
    });
    if (levelupRef.current) {
      const a = levelupRef.current.animate(
        [
          { transform: `${CENTER}scale(0.6)`, opacity: 0, offset: 0 },
          { transform: `${CENTER}scale(1.15)`, opacity: 1, offset: 0.4 },
          { transform: `${CENTER}scale(1)`, opacity: 1, offset: 0.72 },
          { transform: `${CENTER}scale(1)`, opacity: 0, offset: 1 },
        ],
        { duration: LEVELUP_MS, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' }
      );
      a.cancel();
      levelupAnimRef.current = a;
    }
    return undefined;
  }, []);

  useImperativeHandle(ref, () => ({
    popup(text) {
      const bands = bandsRef.current;
      const anims = popAnimsRef.current;
      if (!bands.length || !anims.length) return;
      // Pick a node while HARD-CAPPING concurrent finite animations at 3 (the site budget):
      // prefer a free node; but once 3 pops are already running, recycle the oldest-running
      // one instead of lighting the 4th — the 4th node stays as spare headroom.
      const running = [];
      let free = -1;
      for (let n = 0; n < anims.length; n++) {
        if (anims[n].playState === 'running') running.push(n);
        else if (free === -1) free = n;
      }
      let i;
      if (running.length >= 3) {
        i = running.reduce((oldest, n) => ((anims[n].startTime ?? 0) < (anims[oldest].startTime ?? 0) ? n : oldest), running[0]);
      } else {
        i = free !== -1 ? free : nextRef.current % POOL;
      }
      nextRef.current = (i + 1) % POOL;
      const el = popRefs.current[i];
      const anim = anims[i];
      if (!el || !anim) return;
      const band = bands[(Math.random() * bands.length) | 0];
      el.textContent = text;
      el.style.left = `${band.x0 + Math.random() * (band.x1 - band.x0)}px`;
      el.style.top = `${band.y0 + Math.random() * (band.y1 - band.y0)}px`;
      anim.cancel();
      anim.play();
    },
    celebrate() {
      const a = levelupAnimRef.current;
      if (!a) return;
      a.cancel();
      a.play();
    },
  }));

  return (
    <div className="menu-xp-fx" ref={layerRef} aria-hidden="true">
      {Array.from({ length: POOL }, (_, i) => (
        <span
          key={i}
          className="menu-xp-pop"
          ref={(n) => {
            popRefs.current[i] = n;
          }}
        />
      ))}
      <div className="menu-xp-levelup" ref={levelupRef}>
        LEVEL UP
      </div>
    </div>
  );
});
