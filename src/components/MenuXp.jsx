// MenuXp.jsx — the menu/splash XP UI: a progress bar (MenuXpBar) and the feedback layer
// (MenuXpFx). All motion is finite, transform/opacity only, nothing animates at rest, and
// there is NO will-change anywhere. Pop spawn SLOTS are measured on mount/resize and cached
// (never per keystroke); the only exclusion is the XP bar's box, so the readout is never
// covered.
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import './MenuXp.css';

// The progress bar: a "LV n" chip overlapping the left cap · a track holding the fill,
// a leading-edge marker, and a centred "1,240 / 3,162" readout (XP into the level / cost).
// The fill is scaleX (never width) and glides via a rAF LERP (displayed += (target −
// displayed)·0.18), not a CSS transition — the loop only runs while it has ground to cover
// and stops at rest (nothing scheduled between keystrokes). On a level-up the displayed
// value SNAPS to 0 (no backwards glide) and fills forward, flashing yellow for 180ms. Fill
// colour keys off the rebirth count (class/attr swap only). `variant="mini"` (splash) drops
// the readout and shrinks the track.
export function MenuXpBar({ level, toNext, frac, variant = 'full', wins = null, intoLevel = 0, cost = 0, rebirths = 0 }) {
  const fillRef = useRef(null);
  const markerRef = useRef(null);
  const trackRef = useRef(null);
  const displayedRef = useRef(0);
  const targetRef = useRef(0);
  const rafRef = useRef(0);
  const trackWRef = useRef(0);
  const prevLevelRef = useRef(level);

  // Cache the track's pixel width so the leading-edge marker can ride the fill via a
  // TRANSFORM (translateX), not a layout property. Measured on mount + resize only.
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;
    const measure = () => {
      trackWRef.current = track.clientWidth;
    };
    measure();
    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measure);
      ro.observe(track);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // One rAF writing one transform (plus the marker, riding the same displayed value). Reads
  // and writes only refs, so a stale instance left over from a re-render behaves identically.
  function writeFrame(v) {
    const fill = fillRef.current;
    if (fill) fill.style.transform = `scaleX(${v})`;
    const marker = markerRef.current;
    if (marker) {
      let w = trackWRef.current;
      if (!w && trackRef.current) {
        w = trackRef.current.clientWidth;
        trackWRef.current = w;
      }
      marker.style.transform = `translateX(${v * w - 2}px)`;
      marker.style.opacity = v > 0.004 ? '1' : '0';
    }
  }
  function tick() {
    const target = targetRef.current;
    let d = displayedRef.current + (targetRef.current - displayedRef.current) * 0.18;
    if (Math.abs(target - d) < 0.0005) {
      displayedRef.current = target; // snap
      writeFrame(target);
      rafRef.current = 0; // converged — schedule nothing at rest
      return;
    }
    displayedRef.current = d;
    writeFrame(d);
    rafRef.current = requestAnimationFrame(tick);
  }
  function startLoop() {
    if (rafRef.current) return; // already gliding
    rafRef.current = requestAnimationFrame(tick);
  }

  // Retarget on level/frac change; kick the loop only when the target actually moves.
  useLayoutEffect(() => {
    const fill = fillRef.current;
    if (!fill) return undefined;
    const clamped = Math.max(0, Math.min(1, Number.isFinite(frac) ? frac : 0));
    if (level > prevLevelRef.current) {
      // Level-up: snap the fill to empty instantly, then glide forward into the new level.
      displayedRef.current = 0;
      writeFrame(0);
      fill.classList.add('is-levelflash');
      const flash = setTimeout(() => fill.classList.remove('is-levelflash'), 180);
      prevLevelRef.current = level;
      targetRef.current = clamped;
      startLoop();
      return () => clearTimeout(flash);
    }
    prevLevelRef.current = level;
    targetRef.current = clamped;
    startLoop();
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, frac]);

  // Cancel any in-flight glide on unmount.
  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  const reb = Math.min(3, Math.max(0, Math.floor(rebirths) || 0));

  return (
    <div className={`menu-xp-bar${variant === 'mini' ? ' is-mini' : ''}`} aria-hidden="true">
      {variant !== 'mini' && wins != null && (
        <span className="menu-wins-chip" aria-label={`${wins} wins`}>
          <span className="menu-wins-coin" aria-hidden="true" />
          {wins}
        </span>
      )}
      <span className="menu-xp-lv">LV {level}</span>
      <span className="menu-xp-track" ref={trackRef}>
        <span className="menu-xp-fill" ref={fillRef} data-reb={reb} />
        <span className="menu-xp-marker" ref={markerRef} />
        {variant !== 'mini' && (
          <span className="menu-xp-readout">
            {Math.max(0, Math.round(intoLevel)).toLocaleString()} / {Math.max(0, Math.round(cost)).toLocaleString()}
          </span>
        )}
      </span>
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
const JITTER = 22; // ±px per spawn
const POP_HALF = 30; // keep grid slots this far off the bar box
const RECENT_SLOTS = 4; // reject a slot used by the last N spawns (no visible repeat/march)

// Screen-edge pulse on a streak-tier crossing. Pool 2 (crossings never overlap). 260ms.
const EDGE_MS = 260;
const EDGE_POOL = 2;

// Level-up: 1500ms total — scale 1.7→1 over 260ms (overshoot to 1.06 at 200ms, settle by
// 320ms), hold 900ms, fade 280ms. Offsets below are ÷1500.
const LEVELUP_MS = 1500;
const WINSSTAMP_MS = 700; // wins stamp keeps its own shorter envelope
const LEVEL_PHRASES = ['WARMING UP', 'PICKING UP SPEED', 'COOKING', 'UNREAL', 'MENACE'];

// Pick a spawn slot at RANDOM, rejecting any used by the last few spawns (so pops neither
// repeat a spot nor march in a visible pattern). Records the choice in `recent`.
function pickSlot(slots, recent) {
  if (slots.length <= 1) return 0;
  const ban = new Set(recent.slice(-Math.min(RECENT_SLOTS, slots.length - 1)));
  let idx = 0;
  for (let tries = 0; tries < 24; tries++) {
    idx = Math.floor(Math.random() * slots.length);
    if (!ban.has(idx)) break;
  }
  recent.push(idx);
  if (recent.length > RECENT_SLOTS) recent.shift();
  return idx;
}

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
  const levelDetailRef = useRef(null);
  const winsStampRef = useRef(null);
  const popAnimsRef = useRef([]);
  const edgeAnimsRef = useRef([]);
  const levelupAnimRef = useRef(null);
  const winsStampAnimRef = useRef(null);
  const slotsRef = useRef([]);
  const recentSlotsRef = useRef([]); // indices of the last few chosen slots (anti-repeat)
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
          { transform: `${CENTER}rotate(-3deg) scale(1.7)`, opacity: 0, offset: 0 }, // 0ms
          { transform: `${CENTER}rotate(-3deg) scale(1.2)`, opacity: 1, offset: 0.1 }, // 150ms — in
          { transform: `${CENTER}rotate(-3deg) scale(1.06)`, opacity: 1, offset: 0.1333 }, // 200ms — overshoot
          { transform: `${CENTER}rotate(-3deg) scale(1)`, opacity: 1, offset: 0.2133 }, // 320ms — settle
          { transform: `${CENTER}rotate(-3deg) scale(1)`, opacity: 1, offset: 0.8133 }, // 1220ms — hold end
          { transform: `${CENTER}rotate(-3deg) scale(1)`, opacity: 0, offset: 1 }, // 1500ms — fade out
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
        { duration: WINSSTAMP_MS, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' }
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
      const slot = slots[pickSlot(slots, recentSlotsRef.current)];
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
      // Streak tier scales the pop via the TRANSFORM (not font-size); per-pop variance adds a
      // small random rotation + scale multiplier on top so no two pops read identical.
      const rot = Math.random() * 20 - 10; // [-10°, +10°]
      const s = scale * (0.92 + Math.random() * 0.16); // ×[0.92, 1.08]
      anim.effect.setKeyframes([
        { transform: `${CENTER}rotate(${rot}deg) scale(${s}) translateY(4px)`, opacity: 0, offset: 0 },
        { transform: `${CENTER}rotate(${rot}deg) scale(${s}) translateY(-4px)`, opacity: 1, offset: 0.25 },
        { transform: `${CENTER}rotate(${rot}deg) scale(${s}) translateY(-22px)`, opacity: 0, offset: 1 },
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
      const rot = Math.random() * 20 - 10; // [-10°, +10°]
      const s = scale * (0.92 + Math.random() * 0.16); // ×[0.92, 1.08]
      anim.effect.setKeyframes([
        { transform: `${CENTER}rotate(${rot}deg) scale(${s}) translateY(4px)`, opacity: 0, offset: 0 },
        { transform: `${CENTER}rotate(${rot}deg) scale(${s}) translateY(-4px)`, opacity: 1, offset: 0.25 },
        { transform: `${CENTER}rotate(${rot}deg) scale(${s}) translateY(-22px)`, opacity: 0, offset: 1 },
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
      if (levelDetailRef.current) levelDetailRef.current.textContent = `LV ${level - 1} → LV ${level}`;
      a.cancel();
      a.play();
    },
    // One finite "REBIRTH N" celebration, reusing the level-up pooled element (1500ms).
    rebirthCelebration(n) {
      const a = levelupAnimRef.current;
      if (!a) return;
      for (const p of popAnimsRef.current) p.cancel();
      if (levelTitleRef.current) levelTitleRef.current.textContent = `REBIRTH ${n}`;
      if (levelSubRef.current) levelSubRef.current.textContent = 'PERMANENT MULTIPLIER';
      if (levelDetailRef.current) levelDetailRef.current.textContent = ''; // no LV→LV line on a rebirth
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
        <span className="menu-xp-levelup-detail" ref={levelDetailRef} />
      </div>
      <div className="menu-xp-winsstamp" ref={winsStampRef} />
    </div>
  );
});
