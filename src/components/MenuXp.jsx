// MenuXp.jsx — the menu XP UI: a persistent progress bar (MenuXpBar, INSIDE the panel)
// and the feedback layer (MenuXpFx, in the outer backdrop + over centre). All motion is
// finite, transform/opacity only, nothing animates at rest, and there is NO will-change
// anywhere (the site-wide budget is exactly two elements). No getBoundingClientRect in
// any per-keystroke path — letter-pop slots are measured on mount/resize and cached; the
// centre XP pops + level-up position off CSS % so they need no measurement.
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
      el.classList.add('is-levelflash'); // flash the fill to yellow (no colour transition)
      const raf = requestAnimationFrame(() => el.removeAttribute('data-jump'));
      const flash = setTimeout(() => el.classList.remove('is-levelflash'), 180);
      prevLevelRef.current = level;
      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(flash);
      };
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

const CENTER = 'translate(-50%,-50%) ';

// Letter pops — the typed char, in the outer panel margin. Pool 16, cap 8 running.
const LETTER_MS = 260;
const LETTER_POOL = 16;
const LETTER_CAP = 8;
const SLOTS_PER_SIDE = 6;
const HALF_W = 22;
const HALF_H = 22;
const PAD = 6;

// XP pops — "+N", small, near screen centre with a slight random offset. Pool 8, cap 4.
const XP_MS = 220;
const XP_POOL = 8;
const XP_CAP = 4;

// Screen-edge pulse on a streak-tier crossing. Pool 2 (crossings never overlap). 260ms.
const EDGE_MS = 260;
const EDGE_POOL = 2;

// Budget: letter cap 8 + xp cap 4 + fill transition 1 + one edge pulse 1 = the menu's
// 14-concurrent finite budget. During a level-up the pop caps drop to 1 and celebrate()
// clears in-flight pops, so the whole layer stays within 14.
const LEVELUP_MS = 700; // ~100ms appear + 420ms hold + 180ms fade

// One line under "LEVEL N", indexed by level and cycling.
const LEVEL_PHRASES = ['WARMING UP', 'PICKING UP SPEED', 'COOKING', 'UNREAL', 'MENACE'];

function pickIndex(anims, poolSize, cap, nextRef) {
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
    i = free !== -1 ? free : nextRef.current % poolSize;
  }
  nextRef.current = (i + 1) % poolSize;
  return i;
}

// MenuXpFx — imperative: letterPop(char) + xpPop("+N") per credited keystroke,
// celebrate(level) on a level-up.
export const MenuXpFx = forwardRef(function MenuXpFx(_props, ref) {
  const layerRef = useRef(null);
  const letterElsRef = useRef([]);
  const xpElsRef = useRef([]);
  const edgeElsRef = useRef([]);
  const levelupRef = useRef(null);
  const levelTitleRef = useRef(null);
  const levelSubRef = useRef(null);
  const letterAnimsRef = useRef([]);
  const xpAnimsRef = useRef([]);
  const edgeAnimsRef = useRef([]);
  const levelupAnimRef = useRef(null);
  const slotsRef = useRef([]);
  const slotIdxRef = useRef(0);
  const letterNextRef = useRef(0);
  const xpNextRef = useRef(0);
  const edgeNextRef = useRef(0);
  const rngRef = useRef(0); // deterministic-ish jitter cursor for the centre XP pops

  // Measure a ROTATING SET OF SPAWN SLOTS in the backdrop margin OUTSIDE the panel, on
  // mount + resize. Slots anchor just past the L/R panel borders, stepped down the panel;
  // consecutive slots alternate sides so pops alive together never overlap.
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
      const leftX = sL - PAD - HALF_W;
      const rightX = sR + PAD + HALF_W;
      const y0 = HALF_H + PAD;
      const y1 = H - HALF_H - PAD;
      const span = Math.max(0, y1 - y0);
      const slots = [];
      for (let r = 0; r < SLOTS_PER_SIDE; r++) {
        const yl = y0 + (span * (r + 0.5)) / SLOTS_PER_SIDE;
        const yr = y0 + (span * (r + 1)) / SLOTS_PER_SIDE;
        if (hasLeft) slots.push({ x: leftX, y: yl });
        if (hasRight) slots.push({ x: rightX, y: yr });
      }
      slotsRef.current = slots;
    };
    measure();
    const raf = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
    };
  }, []);

  // Create the pooled WAAPI animations ONCE (idle at rest). Keyframes are constant; the
  // spawn point is set per call via left/top (letter slots) or a CSS-% base (XP pops).
  useEffect(() => {
    const letterOpts = { duration: LETTER_MS, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'both' };
    letterAnimsRef.current = letterElsRef.current.map((el) => {
      const a = el.animate(
        [
          { transform: `${CENTER}translateY(4px)`, opacity: 0, offset: 0 },
          { transform: `${CENTER}translateY(-4px)`, opacity: 1, offset: 0.25 },
          { transform: `${CENTER}translateY(-22px)`, opacity: 0, offset: 1 },
        ],
        letterOpts
      );
      a.cancel();
      return a;
    });

    const xpOpts = { duration: XP_MS, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'both' };
    xpAnimsRef.current = xpElsRef.current.map((el) => {
      const a = el.animate(
        [
          { transform: `${CENTER}translateY(0)`, opacity: 1, offset: 0 },
          { transform: `${CENTER}translateY(-18px)`, opacity: 0, offset: 1 },
        ],
        xpOpts
      );
      a.cancel();
      return a;
    });

    const edgeOpts = { duration: EDGE_MS, easing: 'ease-out', fill: 'both' };
    edgeAnimsRef.current = edgeElsRef.current.map((el) => {
      const a = el.animate(
        [
          { opacity: 0, offset: 0 },
          { opacity: 0.35, offset: 0.4 },
          { opacity: 0, offset: 1 },
        ],
        edgeOpts
      );
      a.cancel();
      return a;
    });

    if (levelupRef.current) {
      const a = levelupRef.current.animate(
        [
          { transform: `${CENTER}rotate(-3deg) scale(1.6)`, opacity: 0, offset: 0 },
          { transform: `${CENTER}rotate(-3deg) scale(1)`, opacity: 1, offset: 0.143 },
          { transform: `${CENTER}rotate(-3deg) scale(1)`, opacity: 1, offset: 0.743 },
          { transform: `${CENTER}rotate(-3deg) scale(1)`, opacity: 0, offset: 1 },
        ],
        { duration: LEVELUP_MS, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' }
      );
      a.cancel();
      levelupAnimRef.current = a;
    }
    return undefined;
  }, []);

  useImperativeHandle(ref, () => ({
    letterPop(text, scale = 1, colour = '#2EFFE0') {
      const slots = slotsRef.current;
      const anims = letterAnimsRef.current;
      if (!slots.length || !anims.length) return;
      const levelup = levelupAnimRef.current && levelupAnimRef.current.playState === 'running';
      const i = pickIndex(anims, LETTER_POOL, levelup ? 1 : LETTER_CAP, letterNextRef);
      const el = letterElsRef.current[i];
      const anim = anims[i];
      if (!el || !anim) return;
      const slot = slots[slotIdxRef.current % slots.length];
      slotIdxRef.current = (slotIdxRef.current + 1) % slots.length;
      el.textContent = text;
      el.style.color = colour; // tier colour (fill; the black stroke stays)
      el.style.left = `${slot.x}px`;
      el.style.top = `${slot.y}px`;
      // Streak tier scales the pop via the TRANSFORM (not font-size) — baked into the
      // keyframes so it composes with the translate/centring the animation already owns.
      anim.effect.setKeyframes([
        { transform: `${CENTER}scale(${scale}) translateY(4px)`, opacity: 0, offset: 0 },
        { transform: `${CENTER}scale(${scale}) translateY(-4px)`, opacity: 1, offset: 0.25 },
        { transform: `${CENTER}scale(${scale}) translateY(-22px)`, opacity: 0, offset: 1 },
      ]);
      anim.cancel();
      anim.play();
    },
    xpPop(text) {
      const anims = xpAnimsRef.current;
      if (!anims.length) return;
      const levelup = levelupAnimRef.current && levelupAnimRef.current.playState === 'running';
      const i = pickIndex(anims, XP_POOL, levelup ? 1 : XP_CAP, xpNextRef);
      const el = xpElsRef.current[i];
      const anim = anims[i];
      if (!el || !anim) return;
      // Small jitter around centre so consecutive XP pops don't stack. Cheap LCG cursor,
      // no getBoundingClientRect (positions off CSS % base).
      rngRef.current = (rngRef.current * 1103515245 + 12345) & 0x7fffffff;
      const ox = ((rngRef.current % 91) - 45); // -45..45 px
      const oy = (((rngRef.current >> 8) % 61) - 30); // -30..30 px
      el.textContent = text;
      el.style.left = `calc(50% + ${ox}px)`;
      el.style.top = `calc(48% + ${oy}px)`;
      anim.cancel();
      anim.play();
    },
    edgePulse(colour) {
      const anims = edgeAnimsRef.current;
      if (!anims.length) return;
      const i = edgeNextRef.current % EDGE_POOL;
      edgeNextRef.current = (i + 1) % EDGE_POOL;
      const el = edgeElsRef.current[i];
      const anim = anims[i];
      if (!el || !anim) return;
      el.style.boxShadow = `inset 0 0 64px 14px ${colour}`;
      anim.cancel();
      anim.play();
    },
    celebrate(level) {
      const a = levelupAnimRef.current;
      if (!a) return;
      // Clear in-flight pops so the big centre moment OWNS the budget; the dynamic cap (1
      // per pool while celebrating) keeps pops + fill + level-up within the 14 budget.
      for (const p of letterAnimsRef.current) p.cancel();
      for (const p of xpAnimsRef.current) p.cancel();
      if (levelTitleRef.current) levelTitleRef.current.textContent = `LEVEL ${level}`;
      if (levelSubRef.current) {
        levelSubRef.current.textContent = LEVEL_PHRASES[(Math.max(1, level) - 1) % LEVEL_PHRASES.length];
      }
      a.cancel();
      a.play();
    },
  }));

  return (
    <div className="menu-xp-fx" ref={layerRef} aria-hidden="true">
      {Array.from({ length: LETTER_POOL }, (_, i) => (
        <span
          key={`l${i}`}
          className="menu-xp-pop"
          ref={(n) => {
            letterElsRef.current[i] = n;
          }}
        />
      ))}
      {Array.from({ length: XP_POOL }, (_, i) => (
        <span
          key={`x${i}`}
          className="menu-xp-xppop"
          ref={(n) => {
            xpElsRef.current[i] = n;
          }}
        />
      ))}
      {Array.from({ length: EDGE_POOL }, (_, i) => (
        <div
          key={`e${i}`}
          className="menu-xp-edge"
          ref={(n) => {
            edgeElsRef.current[i] = n;
          }}
        />
      ))}
      <div className="menu-xp-levelup" ref={levelupRef}>
        <span className="menu-xp-levelup-title" ref={levelTitleRef}>
          LEVEL UP
        </span>
        <span className="menu-xp-levelup-sub" ref={levelSubRef} />
      </div>
    </div>
  );
});
