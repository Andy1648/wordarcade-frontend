// MenuXp.jsx — the menu/splash XP UI: a progress bar (MenuXpBar) and the feedback layer
// (MenuXpFx). All motion is finite, transform/opacity only, nothing animates at rest, and
// there is NO will-change anywhere. Pop spawn SLOTS are measured on mount/resize and cached
// (never per keystroke); the only exclusion is the XP bar's box, so the readout is never
// covered.
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import './MenuXp.css';

// The progress bar: "LV 7" · fill · "142 TO LV 8". Fill is scaleX (never width) and EASES
// (200ms). On a level-up the frac drops from ~1 to ~0; we suppress the transition for that
// one committed frame (data-jump) so it snaps back, and flash the fill yellow for 180ms.
// `variant="mini"` (splash) drops the "TO LV" line and shrinks the track.
export function MenuXpBar({ level, toNext, frac, variant = 'full', wins = null }) {
  const fillRef = useRef(null);
  const prevLevelRef = useRef(level);
  useLayoutEffect(() => {
    const el = fillRef.current;
    if (!el) return undefined;
    const clamped = Math.max(0, Math.min(1, frac));
    if (level > prevLevelRef.current) {
      el.setAttribute('data-jump', '');
      el.style.transform = `scaleX(${clamped})`;
      el.classList.add('is-levelflash');
      const raf = requestAnimationFrame(() => el.removeAttribute('data-jump'));
      const flash = setTimeout(() => el.classList.remove('is-levelflash'), 180);
      prevLevelRef.current = level;
      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(flash);
      };
    }
    el.style.transform = `scaleX(${clamped})`;
    prevLevelRef.current = level;
    return undefined;
  }, [level, frac]);

  return (
    <div className={`menu-xp-bar${variant === 'mini' ? ' is-mini' : ''}`} aria-hidden="true">
      <span className="menu-xp-lv">LV {level}</span>
      {variant !== 'mini' && wins != null && (
        <span className="menu-wins-chip" aria-label={`${wins} wins`}>
          <span className="menu-wins-coin" aria-hidden="true" />
          {wins}
        </span>
      )}
      <span className="menu-xp-track">
        <span className="menu-xp-fill" ref={fillRef} />
      </span>
      {variant !== 'mini' && (
        <span className="menu-xp-next">
          {toNext} TO LV {level + 1}
        </span>
      )}
    </div>
  );
}

const CENTER = 'translate(-50%,-50%) ';

// ONE combined pop per keystroke: "[LETTER] [+N]". Single pool of 16, cap 12 running.
const POP_MS = 260;
const POP_POOL = 16;
const POP_CAP = 12; // 12 pops + fill transition 1 + one edge pulse 1 = the 14 menu budget
const GRID_COLS = 6;
const GRID_ROWS = 4;
const JITTER = 12; // ±px per spawn
const POP_HALF = 30; // keep grid slots this far off the bar box

// Screen-edge pulse on a streak-tier crossing. Pool 2 (crossings never overlap). 260ms.
const EDGE_MS = 260;
const EDGE_POOL = 2;

const LEVELUP_MS = 700; // ~100ms appear + 420ms hold + 180ms fade
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

// MenuXpFx — imperative: letterPop(char, "+N", scale, colour), edgePulse(colour) per
// keystroke, celebrate(level) on a level-up.
export const MenuXpFx = forwardRef(function MenuXpFx(_props, ref) {
  const layerRef = useRef(null);
  const popElsRef = useRef([]);
  const edgeElsRef = useRef([]);
  const levelupRef = useRef(null);
  const levelTitleRef = useRef(null);
  const levelSubRef = useRef(null);
  const winsStampRef = useRef(null);
  const popAnimsRef = useRef([]);
  const edgeAnimsRef = useRef([]);
  const levelupAnimRef = useRef(null);
  const winsStampAnimRef = useRef(null);
  const slotsRef = useRef([]);
  const slotIdxRef = useRef(0);
  const popNextRef = useRef(0);
  const edgeNextRef = useRef(0);
  const layerRectRef = useRef({ left: 0, top: 0 }); // for converting tap client coords
  const barBoxRef = useRef(null); // XP bar box (layer-local) — taps must not cover it

  // Measure a 6×4 grid of spawn slots across the WHOLE fx area (panel included), excluding
  // any slot that would overlap the XP bar's box (so the readout is never covered). On
  // mount + resize only — never per keystroke.
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return undefined;
    const measure = () => {
      const wrap = layer.getBoundingClientRect();
      layerRectRef.current = { left: wrap.left, top: wrap.top };
      const W = wrap.width;
      const H = wrap.height;
      const bar = document.querySelector('.menu-xp-bar');
      let box = null;
      if (bar) {
        const b = bar.getBoundingClientRect();
        box = { l: b.left - wrap.left, t: b.top - wrap.top, r: b.right - wrap.left, bt: b.bottom - wrap.top };
      }
      barBoxRef.current = box;
      const slots = [];
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          const x = ((c + 0.5) / GRID_COLS) * W;
          const y = ((r + 0.5) / GRID_ROWS) * H;
          if (box && x > box.l - POP_HALF && x < box.r + POP_HALF && y > box.t - POP_HALF && y < box.bt + POP_HALF) {
            continue; // never cover the bar
          }
          slots.push({ x, y });
        }
      }
      slotsRef.current = slots.length ? slots : [{ x: W / 2, y: H * 0.25 }];
    };
    measure();
    const raf = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
    };
  }, []);

  // Create the pooled WAAPI animations ONCE (idle at rest).
  useEffect(() => {
    const popOpts = { duration: POP_MS, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'both' };
    popAnimsRef.current = popElsRef.current.map((el) => {
      const a = el.animate(
        [
          { transform: `${CENTER}translateY(4px)`, opacity: 0, offset: 0 },
          { transform: `${CENTER}translateY(-4px)`, opacity: 1, offset: 0.25 },
          { transform: `${CENTER}translateY(-22px)`, opacity: 0, offset: 1 },
        ],
        popOpts
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

    // Wins stamp — same pooled-element pattern as the level-up (finite, ≤700ms, one node).
    if (winsStampRef.current) {
      const a = winsStampRef.current.animate(
        [
          { transform: `${CENTER}rotate(-4deg) scale(1.5)`, opacity: 0, offset: 0 },
          { transform: `${CENTER}rotate(-4deg) scale(1)`, opacity: 1, offset: 0.16 },
          { transform: `${CENTER}rotate(-4deg) scale(1)`, opacity: 1, offset: 0.7 },
          { transform: `${CENTER}rotate(-4deg) scale(1)`, opacity: 0, offset: 1 },
        ],
        { duration: LEVELUP_MS, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' }
      );
      a.cancel();
      winsStampAnimRef.current = a;
    }
    return undefined;
  }, []);

  useImperativeHandle(ref, () => ({
    letterPop(letter, plusText, scale = 1, colour = '#2EFFE0') {
      const slots = slotsRef.current;
      const anims = popAnimsRef.current;
      if (!slots.length || !anims.length) return;
      const levelup = levelupAnimRef.current && levelupAnimRef.current.playState === 'running';
      const i = pickIndex(anims, POP_POOL, levelup ? 1 : POP_CAP, popNextRef);
      const el = popElsRef.current[i];
      const anim = anims[i];
      if (!el || !anim) return;
      const slot = slots[slotIdxRef.current % slots.length];
      slotIdxRef.current = (slotIdxRef.current + 1) % slots.length;
      const jx = Math.random() * (JITTER * 2) - JITTER;
      const jy = Math.random() * (JITTER * 2) - JITTER;
      el.classList.remove('is-tap'); // reset if this node was last used for a tap
      // children: [0] = letter (tier colour), [1] = "+N" (always yellow, via CSS)
      el.children[0].textContent = letter;
      el.children[0].style.color = colour;
      el.children[1].textContent = plusText;
      el.children[1].style.color = ''; // back to CSS yellow
      el.style.left = `${slot.x + jx}px`;
      el.style.top = `${slot.y + jy}px`;
      // Streak tier scales the pop via the TRANSFORM (not font-size), baked into keyframes.
      anim.effect.setKeyframes([
        { transform: `${CENTER}scale(${scale}) translateY(4px)`, opacity: 0, offset: 0 },
        { transform: `${CENTER}scale(${scale}) translateY(-4px)`, opacity: 1, offset: 0.25 },
        { transform: `${CENTER}scale(${scale}) translateY(-22px)`, opacity: 0, offset: 1 },
      ]);
      anim.cancel();
      anim.play();
    },
    // Tap pop: no letter — the "+N" ALONE, at the letter's size (via .is-tap CSS), in the
    // tier colour, spawned AT the tap client coords (converted to layer-local), still kept
    // out of the XP bar's box.
    tapPop(plusText, scale = 1, colour = '#2EFFE0', clientX = 0, clientY = 0) {
      const anims = popAnimsRef.current;
      if (!anims.length) return;
      const lr = layerRectRef.current;
      let x = clientX - lr.left;
      let y = clientY - lr.top;
      const box = barBoxRef.current;
      if (box && x > box.l && x < box.r && y > box.t && y < box.bt) {
        // tap landed on the readout → nudge the pop just clear of it (above, else below)
        y = box.t - POP_HALF > 0 ? box.t - POP_HALF : box.bt + POP_HALF;
      }
      const levelup = levelupAnimRef.current && levelupAnimRef.current.playState === 'running';
      const i = pickIndex(anims, POP_POOL, levelup ? 1 : POP_CAP, popNextRef);
      const el = popElsRef.current[i];
      const anim = anims[i];
      if (!el || !anim) return;
      el.classList.add('is-tap'); // hides the letter span, upsizes the "+N" (CSS)
      el.children[1].textContent = plusText;
      el.children[1].style.color = colour; // tier colour for the tap
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      anim.effect.setKeyframes([
        { transform: `${CENTER}scale(${scale}) translateY(4px)`, opacity: 0, offset: 0 },
        { transform: `${CENTER}scale(${scale}) translateY(-4px)`, opacity: 1, offset: 0.25 },
        { transform: `${CENTER}scale(${scale}) translateY(-22px)`, opacity: 0, offset: 1 },
      ]);
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
      for (const p of popAnimsRef.current) p.cancel(); // celebration owns the budget
      if (levelTitleRef.current) levelTitleRef.current.textContent = `LEVEL ${level}`;
      if (levelSubRef.current) {
        levelSubRef.current.textContent = LEVEL_PHRASES[(Math.max(1, level) - 1) % LEVEL_PHRASES.length];
      }
      a.cancel();
      a.play();
    },
    // One finite "+N WINS" stamp (menu return after a paying round). Same pooled pattern.
    winsStamp(amount) {
      const a = winsStampAnimRef.current;
      if (!a || !winsStampRef.current) return;
      winsStampRef.current.textContent = `+${amount} WINS`;
      a.cancel();
      a.play();
    },
  }));

  return (
    <div className="menu-xp-fx" ref={layerRef} aria-hidden="true">
      {Array.from({ length: POP_POOL }, (_, i) => (
        <span
          key={`p${i}`}
          className="menu-xp-pop"
          ref={(n) => {
            popElsRef.current[i] = n;
          }}
        >
          <span className="menu-xp-pop-letter" />
          <span className="menu-xp-pop-plus" />
        </span>
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
      <div className="menu-xp-winsstamp" ref={winsStampRef} />
    </div>
  );
});
