// MenuXp.jsx — the menu XP UI: a persistent progress row (MenuXpBar, lives INSIDE the
// menu panel) and the feedback layer (MenuXpFx, lives in the outer backdrop margin,
// OUTSIDE the panel border). All motion is finite, transform/opacity only, and nothing
// animates at rest. No will-change anywhere (the site-wide budget is exactly two
// elements). No getBoundingClientRect in the per-keystroke path — spawn zones are
// measured on mount/resize and cached.
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import './MenuXp.css';

// The persistent bar: "LV 7" · fill · "142 TO LV 8". Fill is scaleX (never width) and
// EASES between values (200ms). On a level-up the frac drops from ~1 to ~0; we suppress
// the transition for that one committed frame (data-jump) so it snaps back instead of
// sweeping backwards, re-enabling it on the next rAF — no offsetWidth reflow hack.
export function MenuXpBar({ level, toNext, frac }) {
  const fillRef = useRef(null);
  const prevLevelRef = useRef(level);
  useLayoutEffect(() => {
    const el = fillRef.current;
    if (!el) return undefined;
    const clamped = Math.max(0, Math.min(1, frac));
    if (level > prevLevelRef.current) {
      el.setAttribute('data-jump', ''); // transition:none for this frame
      el.style.transform = `scaleX(${clamped})`; // commits instantly (no ease-back)
      const raf = requestAnimationFrame(() => el.removeAttribute('data-jump'));
      prevLevelRef.current = level;
      return () => cancelAnimationFrame(raf);
    }
    el.style.transform = `scaleX(${clamped})`; // normal eased update
    prevLevelRef.current = level;
    return undefined;
  }, [level, frac]);

  return (
    <div className="menu-xp-bar" aria-hidden="true">
      <span className="menu-xp-lv">LV {level}</span>
      <span className="menu-xp-track">
        <span className="menu-xp-fill" ref={fillRef} />
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
const POOL = 8;
const POP_CAP = 5; // 5 pops + 1 fill transition = the menu's 6-concurrent finite budget
// Rough popup half-size (now larger — font clamp(22,4vw,34)), used only to keep spawns
// OUTSIDE the panel border and to space the slots (never a per-keystroke measurement).
const HALF_W = 22;
const HALF_H = 22;
const PAD = 6;
// Vertical slots per side gutter. Consecutive slots alternate sides + step down the
// panel, so any run of pops alive together (≤POP_CAP) lands on distinct, non-overlapping
// spots instead of random x/y that could stack while both are visible.
const SLOTS_PER_SIDE = 6;

// MenuXpFx — imperative: popup('+1') per credited keystroke, celebrate() on level-up.
export const MenuXpFx = forwardRef(function MenuXpFx(_props, ref) {
  const layerRef = useRef(null);
  const popRefs = useRef([]);
  const levelupRef = useRef(null);
  const popAnimsRef = useRef([]);
  const levelupAnimRef = useRef(null);
  const slotsRef = useRef([]);
  const slotIdxRef = useRef(0);
  const nextRef = useRef(0);

  // Measure a ROTATING SET OF SPAWN SLOTS in the backdrop margin OUTSIDE the panel, on
  // mount + resize. The layer is inset:0 within .homepage-wrap, so its own rect is the
  // wrap's box. Slots are anchored just past the L/R panel borders and stepped down the
  // panel; consecutive slots alternate sides so any pops alive together are separated.
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return undefined;

    const measure = () => {
      const stage = document.querySelector('.homepage-stage');
      if (!stage) return;
      const wrap = layer.getBoundingClientRect();
      const s = stage.getBoundingClientRect();
      const H = wrap.height;
      const sL = s.left - wrap.left;
      const sR = s.right - wrap.left;
      const hasLeft = sL > PAD;
      const hasRight = wrap.width - sR > PAD;
      const leftX = sL - PAD - HALF_W; // center just outside the left border
      const rightX = sR + PAD + HALF_W; // center just outside the right border
      const y0 = HALF_H + PAD;
      const y1 = H - HALF_H - PAD;
      const span = Math.max(0, y1 - y0);
      const slots = [];
      for (let r = 0; r < SLOTS_PER_SIDE; r++) {
        // stagger left vs right rows by half a step so they never share a y
        const yl = y0 + (span * (r + 0.5)) / SLOTS_PER_SIDE;
        const yr = y0 + (span * (r + 1)) / SLOTS_PER_SIDE;
        if (hasLeft) slots.push({ x: leftX, y: yl });
        if (hasRight) slots.push({ x: rightX, y: yr });
      }
      slotsRef.current = slots;
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
      const slots = slotsRef.current;
      const anims = popAnimsRef.current;
      if (!slots.length || !anims.length) return;
      // Pick a node while HARD-CAPPING the whole menu-xp layer at 6 concurrent running
      // animations. The bar's fill transition counts as 1, so pops are capped at 5; and
      // while the one-shot level-up is celebrating (another running animation) pops drop
      // to 1, so pops + fill + level-up can never exceed 6. Prefer a free node; at the cap
      // recycle the oldest-running pop.
      const levelupRunning =
        levelupAnimRef.current && levelupAnimRef.current.playState === 'running';
      const cap = levelupRunning ? 1 : POP_CAP;
      const running = [];
      let free = -1;
      for (let n = 0; n < anims.length; n++) {
        if (anims[n].playState === 'running') running.push(n);
        else if (free === -1) free = n;
      }
      let i;
      if (running.length >= cap) {
        i = running.reduce((oldest, n) => ((anims[n].startTime ?? 0) < (anims[oldest].startTime ?? 0) ? n : oldest), running[0]);
      } else {
        i = free !== -1 ? free : nextRef.current % POOL;
      }
      nextRef.current = (i + 1) % POOL;
      const el = popRefs.current[i];
      const anim = anims[i];
      if (!el || !anim) return;
      // Rotate through the fixed slots so consecutive pops never share a spot (no visual
      // overlap even though the glyphs are large). Pure index rotation — no random x/y.
      const slot = slots[slotIdxRef.current % slots.length];
      slotIdxRef.current = (slotIdxRef.current + 1) % slots.length;
      el.textContent = text;
      el.style.left = `${slot.x}px`;
      el.style.top = `${slot.y}px`;
      anim.cancel();
      anim.play();
    },
    celebrate() {
      const a = levelupAnimRef.current;
      if (!a) return;
      // Clear any in-flight pops so the celebration OWNS the concurrency budget: at the
      // level-up instant this drops pops to 0, and the dynamic cap (1 while celebrating)
      // keeps pops + fill + level-up ≤ 3 for the rest of the 480ms.
      for (const p of popAnimsRef.current) p.cancel();
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
