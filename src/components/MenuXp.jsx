// MenuXp.jsx — the menu/splash XP UI: a progress bar (MenuXpBar) and the feedback layer
// (MenuXpFx). All motion is finite, transform/opacity only, nothing animates at rest, and
// there is NO will-change anywhere. The fx-layer size + XP bar box are measured on
// mount/resize and cached (never per keystroke); each pop then picks a continuous random
// position, kept off the layer edge and out of the bar box, so the readout is never covered.
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import './MenuXp.css';
import { formatNum } from '../format';

// The progress bar: a "LV n" chip overlapping the left cap · a track holding the fill,
// a leading-edge marker, and a centred "1,240 / 3,162" readout (XP into the level / cost).
// The fill is scaleX (never width) and glides via a rAF exponential ease that is
// framerate-independent (k = 1 − exp(−dt/90), dt clamped to 50ms), not a CSS transition —
// the loop only runs while it has ground to cover and stops at rest (nothing scheduled
// between keystrokes). The readout's left number counts up off the same `displayed` value.
// On a level-up the displayed value SNAPS to 0 (no backwards glide) and fills forward,
// flashing yellow for 180ms. Fill colour keys off the rebirth count (class/attr swap only).
// `variant="mini"` (splash) drops the readout and shrinks the track.
export function MenuXpBar({ level, toNext, frac, variant = 'full', wins = null, intoLevel = 0, cost = 0, rebirths = 0, onWinsClick = null, streak = 0 }) {
  const fillRef = useRef(null);
  const markerRef = useRef(null);
  const trackRef = useRef(null);
  const readoutNumRef = useRef(null);
  const displayedRef = useRef(0);
  const targetRef = useRef(0);
  const rafRef = useRef(0);
  const lastFrameRef = useRef(null);
  const trackWRef = useRef(0);
  const costRef = useRef(cost);
  const prevLevelRef = useRef(level);

  // Mirror `cost` so the rAF frame can read it without a stale closure (the loop
  // outlives any single render). Assigned during render — a plain mirror ref.
  costRef.current = cost;

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
    // Count the readout's left number up smoothly off `displayed` (not the stepped
    // prop). Absent on the mini variant → guarded.
    const num = readoutNumRef.current;
    if (num) num.textContent = formatNum(Math.max(0, Math.round(v * costRef.current)));
  }
  // Framerate-independent exponential smoothing: with the rAF timestamp as `now`,
  // the same wall-clock ease plays whether the display runs at 60/120/30Hz.
  function tick(now) {
    const last = lastFrameRef.current;
    lastFrameRef.current = now;
    const target = targetRef.current;
    const dt = Math.min((last == null ? 16 : now - last), 50);
    const k = 1 - Math.exp(-dt / 90);
    let d = displayedRef.current + (target - displayedRef.current) * k;
    if (Math.abs(target - d) < 0.0005) {
      displayedRef.current = target; // snap
      writeFrame(target);
      rafRef.current = 0; // converged — schedule nothing at rest
      lastFrameRef.current = null;
      return;
    }
    displayedRef.current = d;
    writeFrame(d);
    rafRef.current = requestAnimationFrame(tick);
  }
  function startLoop() {
    if (rafRef.current) return; // already gliding
    lastFrameRef.current = null; // seed the first frame's dt from a nominal 16ms
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

  // The mini (splash) bar is fully decorative → aria-hidden. The full bar exposes ONLY the
  // wins button (an interactive shop entry) to assistive tech; the LV/fill/readout stay
  // aria-hidden so the deliberately-decorative progress chrome isn't announced.
  return (
    <div className={`menu-xp-bar${variant === 'mini' ? ' is-mini' : ''}`} aria-hidden={variant === 'mini' ? 'true' : undefined}>
      {variant !== 'mini' && wins != null && (
        onWinsClick ? (
          <button type="button" className="menu-wins-chip" onClick={onWinsClick} aria-label={`${wins} wins. Open shop`}>
            <span className="menu-wins-coin" aria-hidden="true" />
            {formatNum(wins)}
          </button>
        ) : (
          <span className="menu-wins-chip" aria-label={`${wins} wins`}>
            <span className="menu-wins-coin" aria-hidden="true" />
            {formatNum(wins)}
          </span>
        )
      )}
      {/* Daily-streak chip — only once the streak is worth showing (>= 2 days). Flame emoji
          as content (house allows emoji-as-content, cf. the ⚡ DAILY link), tiny + inline so
          it adds no bar height. Announced to AT; the rest of the bar chrome stays decorative. */}
      {variant !== 'mini' && Number(streak) >= 2 && (
        <span className="menu-streak-chip" aria-label={`${streak} day streak`}>
          <span className="menu-streak-flame" aria-hidden="true">🔥</span>
          {formatNum(streak)}
        </span>
      )}
      {/* Static "LEVEL" kicker so a newcomer reads the "LV n · into/cost" chrome as the
          leveling bar it is (the audit flagged it as unexplained). Full bar only. */}
      {variant !== 'mini' && <span className="menu-xp-label" aria-hidden="true">LEVEL</span>}
      <span className="menu-xp-lv" aria-hidden="true">LV {level}</span>
      <span className="menu-xp-track" ref={trackRef} aria-hidden="true">
        <span className="menu-xp-fill" ref={fillRef} data-reb={reb} />
        <span className="menu-xp-marker" ref={markerRef} />
        {variant !== 'mini' && (
          <span className="menu-xp-readout">
            <span ref={readoutNumRef}>{formatNum(Math.max(0, Math.round(intoLevel)))}</span>
            {' '}/ {formatNum(Math.max(0, Math.round(cost)))}
          </span>
        )}
      </span>
    </div>
  );
}

const CENTER = 'translate(-50%,-50%) ';

// ONE combined pop per keystroke: "[LETTER] [+N]". Single pool of 20, cap 18 running.
// At 30 keys/sec × 0.6s = 18 concurrent, so the cap sits exactly there (Economy v3 slows
// pops to 600ms for a longer, floatier read).
const POP_MS = 600;
const POP_POOL = 20;
const POP_CAP = 18; // 18 pops + fill transition 1 + one edge pulse 1 = the 20 menu budget
const POP_HALF = 30; // keep a pop this far off the fx-layer edge and the bar box
const POP_MIN_GAP = 90; // reject a candidate within this many px of the last few spawns
const RECENT_POS = 6; // ring buffer: reject against the last N accepted positions
const POP_TRIES = 12; // random attempts before accepting the last candidate anyway

// Screen-edge pulse on a streak-tier crossing. Pool 2 (crossings never overlap). 260ms.
const EDGE_MS = 260;
const EDGE_POOL = 2;

// Level-up: 1500ms total — scale 1.7→1 over 260ms (overshoot to 1.06 at 200ms, settle by
// 320ms), hold 900ms, fade 280ms. Offsets below are ÷1500.
const LEVELUP_MS = 1500;
const WINSSTAMP_MS = 700; // wins stamp keeps its own shorter envelope
const WINSHINT_MS = 3000; // one-time "WINS BUY UPGRADES IN THE SHOP" explainer — a full 3s read
const LEVEL_PHRASES = ['WARMING UP', 'PICKING UP SPEED', 'COOKING', 'UNREAL', 'MENACE'];

// Pick a CONTINUOUS random spawn position inside the fx layer (inset by POP_HALF),
// rejecting a candidate that overlaps the XP bar box (expanded by POP_HALF) or lands
// within POP_MIN_GAP of any of the last RECENT_POS accepted positions — so pops read as
// scattered, never as marching rows. Up to POP_TRIES attempts; if all fail the last
// candidate is accepted. Records the accepted position in the `recent` ring buffer.
function pickPosition(w, h, box, recent) {
  const minX = POP_HALF;
  const minY = POP_HALF;
  const spanX = Math.max(0, w - POP_HALF * 2);
  const spanY = Math.max(0, h - POP_HALF * 2);
  const gap2 = POP_MIN_GAP * POP_MIN_GAP;
  let cand = { x: minX + spanX / 2, y: minY + spanY / 2 };
  for (let tries = 0; tries < POP_TRIES; tries++) {
    const x = minX + Math.random() * spanX;
    const y = minY + Math.random() * spanY;
    cand = { x, y };
    if (box && x > box.l - POP_HALF && x < box.r + POP_HALF && y > box.t - POP_HALF && y < box.bt + POP_HALF) {
      continue; // over the bar box
    }
    let tooClose = false;
    for (let n = 0; n < recent.length; n++) {
      const dx = x - recent[n].x;
      const dy = y - recent[n].y;
      if (dx * dx + dy * dy < gap2) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;
    break; // accepted
  }
  recent.push(cand);
  if (recent.length > RECENT_POS) recent.shift();
  return cand;
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
  const winsHintRef = useRef(null);
  const popAnimsRef = useRef([]);
  const edgeAnimsRef = useRef([]);
  const levelupAnimRef = useRef(null);
  const winsStampAnimRef = useRef(null);
  const winsHintAnimRef = useRef(null);
  const layerSizeRef = useRef({ w: 0, h: 0 }); // fx-layer px size (mount/resize only)
  const recentPosRef = useRef([]); // ring buffer of the last few accepted {x,y} (anti-repeat)
  const popNextRef = useRef(0);
  const edgeNextRef = useRef(0);
  const layerRectRef = useRef({ left: 0, top: 0 }); // for converting tap client coords
  const barBoxRef = useRef(null); // XP bar box (layer-local) — taps must not cover it

  // Cache the fx-layer's pixel size and the XP bar's box (layer-local), so per-keystroke
  // pop placement is a pure random pick with no layout reads. On mount + resize only —
  // never per keystroke.
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return undefined;
    const measure = () => {
      const wrap = layer.getBoundingClientRect();
      layerRectRef.current = { left: wrap.left, top: wrap.top };
      layerSizeRef.current = { w: wrap.width, h: wrap.height };
      const bar = document.querySelector('.menu-xp-bar');
      let box = null;
      if (bar) {
        const b = bar.getBoundingClientRect();
        box = { l: b.left - wrap.left, t: b.top - wrap.top, r: b.right - wrap.left, bt: b.bottom - wrap.top };
      }
      barBoxRef.current = box;
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
          { transform: `${CENTER}translateY(8.96px)`, opacity: 0, offset: 0 },
          { transform: `${CENTER}translateY(-8.96px)`, opacity: 1, offset: 0.25 },
          { transform: `${CENTER}translateY(-49.28px)`, opacity: 0, offset: 1 },
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

    // Wins EXPLAINER — the one-time "WINS BUY UPGRADES IN THE SHOP" banner. 3s envelope
    // (pop in 0-0.08, hold, fade out over the last 0.15) so a newcomer can actually read it.
    if (winsHintRef.current) {
      const a = winsHintRef.current.animate(
        [
          { transform: `${CENTER}rotate(-2deg) scale(1.35)`, opacity: 0, offset: 0 },
          { transform: `${CENTER}rotate(-2deg) scale(1)`, opacity: 1, offset: 0.08 },
          { transform: `${CENTER}rotate(-2deg) scale(1)`, opacity: 1, offset: 0.85 },
          { transform: `${CENTER}rotate(-2deg) scale(1)`, opacity: 0, offset: 1 },
        ],
        { duration: WINSHINT_MS, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' }
      );
      a.cancel();
      winsHintAnimRef.current = a;
    }
    return undefined;
  }, []);

  useImperativeHandle(ref, () => ({
    letterPop(letter, plusText, scale = 1, colour = '#2EFFE0') {
      const { w, h } = layerSizeRef.current;
      const anims = popAnimsRef.current;
      if (!w || !h || !anims.length) return; // not measured yet, or no pool
      const levelup = levelupAnimRef.current && levelupAnimRef.current.playState === 'running';
      const i = pickIndex(anims, POP_POOL, levelup ? 1 : POP_CAP, popNextRef);
      const el = popElsRef.current[i];
      const anim = anims[i];
      if (!el || !anim) return;
      const pos = pickPosition(w, h, barBoxRef.current, recentPosRef.current);
      el.classList.remove('is-tap'); // reset if this node was last used for a tap
      // children: [0] = letter (tier colour), [1] = "+N" (always yellow, via CSS)
      el.children[0].textContent = letter;
      el.children[0].style.color = colour;
      el.children[1].textContent = plusText;
      el.children[1].style.color = ''; // back to CSS yellow
      el.style.left = `${pos.x}px`;
      el.style.top = `${pos.y}px`;
      // Streak tier scales the pop via the TRANSFORM (not font-size); per-pop variance adds a
      // small random rotation + scale multiplier on top so no two pops read identical.
      const rot = Math.random() * 20 - 10; // [-10°, +10°]
      const s = scale * (0.92 + Math.random() * 0.16); // ×[0.92, 1.08]
      anim.effect.setKeyframes([
        { transform: `${CENTER}rotate(${rot}deg) scale(${s}) translateY(8.96px)`, opacity: 0, offset: 0 },
        { transform: `${CENTER}rotate(${rot}deg) scale(${s}) translateY(-8.96px)`, opacity: 1, offset: 0.25 },
        { transform: `${CENTER}rotate(${rot}deg) scale(${s}) translateY(-49.28px)`, opacity: 0, offset: 1 },
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
        { transform: `${CENTER}rotate(${rot}deg) scale(${s}) translateY(8.96px)`, opacity: 0, offset: 0 },
        { transform: `${CENTER}rotate(${rot}deg) scale(${s}) translateY(-8.96px)`, opacity: 1, offset: 0.25 },
        { transform: `${CENTER}rotate(${rot}deg) scale(${s}) translateY(-49.28px)`, opacity: 0, offset: 1 },
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
      // Economy v3: level-ups no longer pay wins, so there is no "+N WINS" reward line here.
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
    // One-time WINS explainer — shown the first time the player earns any wins (3s). Copy is
    // fixed; the caller owns the "only once" gate (a localStorage flag).
    winsHint() {
      const a = winsHintAnimRef.current;
      if (!a || !winsHintRef.current) return;
      winsHintRef.current.textContent = 'WINS BUY UPGRADES IN THE SHOP';
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
      <div className="menu-xp-winshint" ref={winsHintRef} />
    </div>
  );
});
