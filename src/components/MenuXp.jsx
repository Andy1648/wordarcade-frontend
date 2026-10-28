// MenuXp.jsx — the splash's mini XP bar (MenuXpBar) and the menu's feedback layer
// (MenuXpFx). All motion is finite, transform/opacity only, nothing animates at rest. The only
// will-change is set per-shard in spawnShards for its ~360ms flight and cleared on finish (never
// parked on the idle pool). The fx-layer size + XP bar box are measured on
// mount/resize and cached (never per keystroke); each pop then picks a continuous random
// position, kept off the layer edge and out of the bar box, so the readout is never covered.
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import './MenuXp.css';
import { formatNum } from '../format';
import { useLevelBar } from '../hooks/useLevelBar';
import { tierFx, MILESTONE_FX } from '../progress/menuTier';
import { CARD_MS } from '../lib/menuMoments';
import { rebirthMult, loadProgress, getRebirths, tableRebirthThreshold } from '../progress/xp';
import { careerLevel, popGrowth } from '../progress/popGrowth';
import { reduceMotion } from '../lib/reduceMotion';
import { V3 } from '../progress/season'; // P7 (SEASON2 only): V3.fx turns the centre cards below into edge toasts

// MenuXpBar — the SPLASH's mini level bar ("LV n" + a bare track). The menu's bar is the v2 kit's
// KitXpBar now (Homepage); this is all that is left of the old dense bar. lib/barPlan via useLevelBar:
// a multi-level climb flashes once per level, the fill is scaleX only, no layout reads, finite.
export function MenuXpBar({ level, frac }) {
  const bar = useLevelBar(level, frac);
  return (
    <div className="menu-xp-bar is-mini" aria-hidden="true">
      <span className="menu-xp-lv">LV {formatNum(bar.shownLevel)}</span>
      <span className="menu-xp-track">
        <span className="menu-xp-clip">
          <span className="menu-xp-fill" ref={bar.fillRef} />
        </span>
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
const POP_CAP = 18; // pool sizing (NOT the retired concurrent-count budget — see CLAUDE.md
// ANIMATION BUDGET): caps live pops so a mash REUSES pooled nodes instead of growing the pool.
const POP_HALF = 30; // keep a pop this far off the fx-layer edge and the bar box
const POP_MIN_GAP = 90; // reject a candidate within this many px of the last few spawns
const RECENT_POS = 6; // ring buffer: reject against the last N accepted positions
const POP_TRIES = 12; // random attempts before accepting the last candidate anyway

// Screen-edge pulse on a streak-tier crossing. Pool 2 (crossings never overlap). 260ms.
const EDGE_MS = 260;
const EDGE_POOL = 2;

// KEY TIER tier feedback (feat/purchase-feel item 1). Per-keystroke escalation the
// player BUYS: T2+ throws pooled particle shards on each pop. transform/opacity only,
// finite (<=400ms), pooled — zero new infinite animations.
const SHARD_MS = 360; // 300-400ms per spec
const SHARD_PER_POP = 4; // <=6 per spec
const SHARD_POOL = 32; // SHARD_PER_POP × ~8 concurrent pops
// Feel-tier colours: T1-T4 teal, T5+ gold. (T0 keeps the streak colour it's given.)
const TIER_TEAL = '#2EFFE0';
const TIER_GOLD = '#FFD54A';
const prefersReducedMotion = reduceMotion; // the in-game REDUCE MOTION toggle, not the OS

// CRIT KEY (Andy oct8, prototype "A + B"): the key's pop flashes CRIT YELLOW with a scale punch (1.35 → 0.92 → 1 in
// ~260ms) and a bigger "CRIT +N", over a yellow ink STARBURST (the real asset public/fx/crit-burst.svg — never CSS
// shapes). The bursts are a FIXED POOL reused round-robin: WAAPI scale / rotate / opacity, finite, will-change on for
// the flight only. Placement reuses the pop's cached-size random position — no layout read per key.
// oct27 (Andy: "make the key animations last slightly longer"): every key pop lives POP_STRETCH × its tier length on a
// fuller arc (a wind-up from small, an overshoot squash, a settle, a long readable LINGER, then the float-off); the crit
// and the look's painted burst stretch with it. Still one finite pooled WAAPI per pop, transform / opacity only.
const POP_STRETCH = 1.5; // oct28 ×1.5 (was 1.3): the longer entrance needs the room
// oct28 (Andy: "dont do anything with the number boxes bc when they disappear (like stretch or smthn) it looks goofy"):
// the +N box NEVER scales or stretches — one size for its whole life, it fades in, holds, and fades out on a small
// STRAIGHT upward drift (translateY sits before the tilt, so the drift is screen-up whatever the tilt). Every pop takes
// this one arc — CLASSIC, every worn look, the crit. The ring, sparkle and painted burst keep their own motion.
const POP_HIT = 0.12; // where the fade-in lands (the ring / painted burst slam in then)
const POP_DRIFT = 18; // px the +N rises over its whole life
// THE KIT's MOTION (oct27, Andy: "better animations … on the key pops"): a worn look's +N moves like its theme
// (progress/popMotion.js, carried on the lazy look as look.motion) — same pooled node, same finite WAAPI, its own keyframes; CLASSIC keeps popArc.
const KIT_POP_SCALE = 1.35;
// A worn look keeps its pop LENGTH and its burst's spin (popMotion.js) — but its +N moves on the same flat arc as CLASSIC.
function kitArc(look, rot, s, peak, rise, baseMs) {
  const m = look && look.motion;
  if (!m) return { frames: popArc(CENTER, rot, s), ms: baseMs, hit: POP_HIT, spin: 22 };
  const o = m(CENTER, rot, s, peak, rise);
  return { frames: popArc(CENTER, rot, s * KIT_POP_SCALE), ms: Math.round(baseMs * o.ms), hit: POP_HIT, spin: o.spin }; // a paid look's pop is the bigger one
}
const POP_BURST_MS = 560; // the look's painted burst under a +N (was 420)
// The +N's one arc: constant scale `s` (its size — streak × career growth — never animates), opacity in → hold → out,
// and a small straight rise.
const popArc = (CENTER, rot, s) => {
  const k = (y, opacity, offset, easing) => ({ transform: `${CENTER}translateY(${y}px) rotate(${rot}deg) scale(${s})`, opacity, offset, easing });
  return [
    k(0, 0, 0, 'ease-out'),
    k(-POP_DRIFT * 0.2, 1, POP_HIT, 'linear'),
    k(-POP_DRIFT * 0.6, 1, 0.74, 'ease-in'), // the LINGER: the +N is read
    k(-POP_DRIFT, 0, 1, 'linear'),
  ];
};
// KEY GROWTH (Andy oct28: "larger scaling up with level"): every pop is sized x popGrowth(career level) — the levels
// this player has ever climbed (a rebirth banks them, so the keys never shrink). Capped (progress/popGrowth.js), and the
// whole pop (streak x growth) is clamped so a phone never gets a +N wider than its screen. From career LV10 a CLASSIC
// pop throws the painted burst RING (public/fx/burst-ring.svg as a mask, tinted the pop's flat colour) behind its +N,
// from LV100 a SPARKLE (public/fx/sparkle.svg), from LV1000 the ring goes gold. Both are pooled children of the pooled
// pop node with ONE WAAPI each, created on mount and replayed — transform / opacity only, will-change only in flight.
const POP_SCALE_MAX = 1.6; // Andy oct28 "tone it down a lot" (was 2.6 / 1.6)
const POP_SCALE_MAX_NARROW = 1.3;
const CHAR_HALF_PX = 7.5; // ≈ half a Bungee glyph at the pop's size: a +N's half-width is estimated from its text, never measured
const NARROW_W = 560; // fx-layer px below which the phone ceiling applies
const RING_MS = 440;
const SPARK_MS = 420;
const SPARK_SRC = '/fx/sparkle.svg';
export function currentCareer() {
  return careerLevel(loadProgress().level, getRebirths(), tableRebirthThreshold);
}
const CRIT_BURST_MS = 1700; // oct27 ×1.3 (was 1300) // Andy oct9 "slightly longer so user can see how much xp": the crit key holds ~1s // Andy oct8 "a bit longer": the burst slams in, HOLDS, then fades (was 380)
const CRIT_SHAKE_MS = 200;
const CRIT_SHAKE_PX = 10; // Andy oct28 "screen shake slightly larger for crit" (was 7)
const CRIT_PUNCH_MS = 140; // Andy oct9 "cleaner": ONE slam 1.5 → 1, no wobble (was 380: 1.6 → 0.88 → 1.08 → 1)
const CRIT_SAFE = 90; // px: a crit's burst stays this far inside the layer edges
const CRIT_TOP = 120; // px: and below the header band (the coin/gem pills and corner tiles)

// Level-up: 1500ms total — scale 1.7→1 over 260ms (overshoot to 1.06 at 200ms, settle by
// 320ms), hold 900ms, fade 280ms. Offsets below are ÷1500.
const LEVELUP_MS = CARD_MS; // 1500 — lib/menuMoments.js (the moments queue releases on it)
// The punch-in curve, applied PER KEYFRAME. It used to sit on the whole effect, which eases the
// entire 1500ms timeline — so the "900ms hold" was actually crossing its fade keyframe ~500ms in
// and the level-up flashed by. Linear effect timing + an eased entry keeps the hold a hold.
const EASE_OUT = 'cubic-bezier(.2,.8,.2,1)';
const WINSSTAMP_MS = 700; // wins stamp keeps its own shorter envelope
const WINSHINT_MS = 3000; // one-time "SPEND WINS IN UPGRADES" explainer — a full 3s read
const LEVEL_PHRASES = ['WARMING UP', 'PICKING UP SPEED', 'COOKING', 'UNREAL', 'MENACE'];
// The level-up card's timeline (shared by every card that reuses the element).
const LEVELUP_FRAMES = [
  // STEP 50 / Andy N2 ("bigger text includes animated text: level-ups"): the card now SETTLES
  // at ×1.2 (was ×1) — bigger for the whole hold — and slams in from ×2.
  { transform: `${CENTER}rotate(-3deg) scale(2)`, opacity: 0, offset: 0, easing: EASE_OUT }, // 0ms
  { transform: `${CENTER}rotate(-3deg) scale(1.4)`, opacity: 1, offset: 0.1 }, // 150ms — in
  { transform: `${CENTER}rotate(-3deg) scale(1.26)`, opacity: 1, offset: 0.1333 }, // 200ms — overshoot
  { transform: `${CENTER}rotate(-3deg) scale(1.2)`, opacity: 1, offset: 0.2133 }, // 320ms — settle
  { transform: `${CENTER}rotate(-3deg) scale(1.2)`, opacity: 1, offset: 0.8133 }, // 1220ms — hold end
  // ends back at ×1: `fill: both` HOLDS this frame, and a held ×1.2 box (invisible, but still
  // laid out) overhung the fx layer at 360px (viewport-integrity).
  { transform: `${CENTER}rotate(-3deg) scale(1)`, opacity: 0, offset: 1 }, // 1500ms — fade out
];
// MILESTONE MOMENTS (dormant, ?milestones=1): the SAME card, slammed harder (peak × size) and held
// longer, then settling to the everyday ×1.2 — so a peak never sits over the 360px fx layer for the
// hold. Built once per size; transform/opacity only, finite.
const MILESTONE_CARD = Object.fromEntries(
  Object.entries(MILESTONE_FX).map(([size, m]) => {
    const ms = LEVELUP_MS + m.holdMs;
    const at = (t) => t / ms;
    const k = m.peak;
    return [
      size,
      {
        ms,
        frames: [
          { transform: `${CENTER}rotate(-3deg) scale(${2 * k})`, opacity: 0, offset: 0, easing: EASE_OUT },
          { transform: `${CENTER}rotate(-3deg) scale(${1.4 * k})`, opacity: 1, offset: at(150) }, // in
          { transform: `${CENTER}rotate(-3deg) scale(${1.26 * k})`, opacity: 1, offset: at(200) }, // the bigger punch
          { transform: `${CENTER}rotate(-3deg) scale(1.2)`, opacity: 1, offset: at(420), easing: EASE_OUT }, // settle
          { transform: `${CENTER}rotate(-3deg) scale(1.2)`, opacity: 1, offset: at(1220 + m.holdMs) }, // longer hold
          { transform: `${CENTER}rotate(-3deg) scale(1)`, opacity: 0, offset: 1 },
        ],
      },
    ];
  })
);

// Pick a CONTINUOUS random spawn position inside the fx layer (inset by POP_HALF),
// rejecting a candidate that overlaps the XP bar box (expanded by POP_HALF) or lands
// within POP_MIN_GAP of any of the last RECENT_POS accepted positions — so pops read as
// scattered, never as marching rows. Up to POP_TRIES attempts; if all fail the last
// candidate is accepted. Records the accepted position in the `recent` ring buffer.
function pickPosition(w, h, box, recent, half = POP_HALF, halfX = half) {
  const hx = Math.min(halfX, w / 2);
  const minX = hx;
  const minY = half;
  const spanX = Math.max(0, w - hx * 2);
  const spanY = Math.max(0, h - half * 2);
  const gap2 = POP_MIN_GAP * POP_MIN_GAP;
  let cand = { x: minX + spanX / 2, y: minY + spanY / 2 };
  for (let tries = 0; tries < POP_TRIES; tries++) {
    const x = minX + Math.random() * spanX;
    const y = minY + Math.random() * spanY;
    cand = { x, y };
    if (box && x > box.l - half && x < box.r + half && y > box.t - half && y < box.bt + half) {
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
export const MenuXpFx = forwardRef(function MenuXpFx({ menuTier = 0, career }, ref) {
  const layerRef = useRef(null);
  // STEP 22 / A1: the MENU TIER (level + rebirth) lengthens and enriches every pop. Read through
  // a ref so a level-up mid-typing re-tiers the very next keystroke without re-creating the pool.
  const tierRef = useRef(tierFx(menuTier));
  tierRef.current = tierFx(menuTier);
  // KEY GROWTH: the career level (Homepage passes it live; the splash / shop try-on read the save once) -> the size +
  // dressing stage. Through refs, like the tier, so a level-up re-sizes the next key without touching the pool.
  const [savedCareer] = useState(() => (career == null ? currentCareer() : 0));
  const narrowRef = useRef(false);
  const careerRef = useRef(1);
  careerRef.current = career == null ? savedCareer : career;
  const growthRef = useRef(null);
  growthRef.current = popGrowth(careerRef.current, narrowRef.current);
  const ringElsRef = useRef([]);
  const ringAnimsRef = useRef([]);
  const sparkElsRef = useRef([]);
  const sparkAnimsRef = useRef([]);
  const burstRef = useRef(null);
  // Only a LEVEL-UP / REBIRTH owns the pop budget while it plays; the tier-up name card (which
  // can fire on menu open) must never mute the player's first keystrokes.
  const popCapRef = useRef(true);
  const burstAnimRef = useRef(null);
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
  // MILESTONE MOMENTS: set only by a milestone celebrate() (flag on), so with the flag off the card's
  // keyframes, attributes and timing are never touched.
  const milestoneCardRef = useRef(false); // the card currently carries milestone keyframes / data-milestone
  const milestoneEndsAtRef = useRef(0); // performance.now() when the milestone card finishes
  const winsStampAnimRef = useRef(null);
  const winsHintAnimRef = useRef(null);
  const layerSizeRef = useRef({ w: 0, h: 0 }); // fx-layer px size (mount/resize only)
  const recentPosRef = useRef([]); // ring buffer of the last few accepted {x,y} (anti-repeat)
  const popNextRef = useRef(0);
  const edgeNextRef = useRef(0);
  // Pooled particle shards (KEY TIER tier T2+).
  const shardElsRef = useRef([]);
  const shardAnimsRef = useRef([]);
  const shardNextRef = useRef(0);
  // CRIT starbursts (pooled, round-robin)
  const critShakeRef = useRef(null);
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
      narrowRef.current = wrap.width > 0 && wrap.width < NARROW_W;
      growthRef.current = popGrowth(careerRef.current, narrowRef.current);
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

    // KEY GROWTH dressing: one idle WAAPI per pooled ring / sparkle (keyframes re-set per spawn for a fresh angle).
    const idle = (el, ms) => {
      const a = el.animate([{ opacity: 0 }, { opacity: 0 }], { duration: ms, easing: 'linear', fill: 'both' });
      a.cancel();
      a.onfinish = () => { el.style.willChange = ''; };
      return a;
    };
    ringAnimsRef.current = ringElsRef.current.map((el) => idle(el, RING_MS));
    sparkAnimsRef.current = sparkElsRef.current.map((el) => idle(el, SPARK_MS));

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

    // Pooled particle shards — keyframes are re-set per spawn (direction varies), so
    // create them idle. transform/opacity only, finite SHARD_MS, fill:both.
    shardAnimsRef.current = shardElsRef.current.map((el) => {
      const a = el.animate(
        [
          { transform: 'translate(0,0) scale(1)', opacity: 1, offset: 0 },
          { transform: 'translate(0,-20px) scale(0)', opacity: 0, offset: 1 },
        ],
        { duration: SHARD_MS, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'both' }
      );
      a.cancel();
      // Drop the compositor hint once the shard lands — will-change lives only for the
      // airborne window (set in spawnShards), never on the idle pooled node.
      a.onfinish = () => {
        el.style.willChange = '';
      };
      return a;
    });

    // the whole fx layer JOLTS on a crit (the key "hits" the screen) — one finite transform shake
    const fxLayer = layerRef.current;
    critShakeRef.current = fxLayer
      ? fxLayer.animate([{ transform: 'none' }, { transform: 'none' }], { duration: CRIT_SHAKE_MS, easing: 'linear' })
      : null;
    if (critShakeRef.current) critShakeRef.current.cancel();

    if (levelupRef.current) {
      const a = levelupRef.current.animate(
        LEVELUP_FRAMES,
        { duration: LEVELUP_MS, easing: 'linear', fill: 'both' } // ease per-keyframe (below), NOT per-effect
      );
      a.cancel();
      levelupAnimRef.current = a;
    }

    // LEVEL-UP STARBURST (STEP 22): the comic burst asset spins up behind LEVEL N, once.
    if (burstRef.current) {
      const a = burstRef.current.animate(
        [
          { transform: `${CENTER}rotate(-20deg) scale(0.2)`, opacity: 0, offset: 0, easing: EASE_OUT },
          { transform: `${CENTER}rotate(4deg) scale(1.15)`, opacity: 1, offset: 0.3 },
          { transform: `${CENTER}rotate(12deg) scale(1)`, opacity: 1, offset: 0.7 },
          { transform: `${CENTER}rotate(18deg) scale(1.1)`, opacity: 0, offset: 1 },
        ],
        { duration: LEVELUP_MS, easing: 'linear', fill: 'both' } // ease per-keyframe (below), NOT per-effect
      );
      a.cancel();
      burstAnimRef.current = a;
    }

    // Wins stamp — same pooled-element pattern as the level-up (finite, ≤700ms, one node).
    if (winsStampRef.current) {
      const a = winsStampRef.current.animate(
        [
          { transform: `${CENTER}rotate(-4deg) scale(1.5)`, opacity: 0, offset: 0, easing: EASE_OUT },
          { transform: `${CENTER}rotate(-4deg) scale(1)`, opacity: 1, offset: 0.16 },
          { transform: `${CENTER}rotate(-4deg) scale(1)`, opacity: 1, offset: 0.7 },
          { transform: `${CENTER}rotate(-4deg) scale(1)`, opacity: 0, offset: 1 },
        ],
        { duration: WINSSTAMP_MS, easing: 'linear', fill: 'both' }
      );
      a.cancel();
      winsStampAnimRef.current = a;
    }

    // Wins EXPLAINER — the one-time "SPEND WINS IN UPGRADES" banner. 3s envelope
    // (pop in 0-0.08, hold, fade out over the last 0.15) so a newcomer can actually read it.
    if (winsHintRef.current) {
      const a = winsHintRef.current.animate(
        [
          { transform: `${CENTER}rotate(-2deg) scale(1.35)`, opacity: 0, offset: 0, easing: EASE_OUT },
          { transform: `${CENTER}rotate(-2deg) scale(1)`, opacity: 1, offset: 0.08 },
          { transform: `${CENTER}rotate(-2deg) scale(1)`, opacity: 1, offset: 0.85 },
          { transform: `${CENTER}rotate(-2deg) scale(1)`, opacity: 0, offset: 1 },
        ],
        { duration: WINSHINT_MS, easing: 'linear', fill: 'both' }
      );
      a.cancel();
      winsHintAnimRef.current = a;
    }
    return undefined;
  }, []);

  // Throw SHARD_PER_POP pooled shards from (x,y) — KEY TIER tier T2+ (item 1).
  function spawnShards(x, y, colour, count = SHARD_PER_POP, reach = 1) {
    const anims = shardAnimsRef.current;
    if (!anims.length) return;
    for (let k = 0; k < count; k += 1) {
      const i = shardNextRef.current % SHARD_POOL;
      shardNextRef.current = (i + 1) % SHARD_POOL;
      const el = shardElsRef.current[i];
      const anim = anims[i];
      if (!el || !anim) continue;
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.style.background = Array.isArray(colour) ? colour[k % colour.length] : colour; // a LOOK throws its own colours
      el.style.willChange = 'transform, opacity'; // promote for the airborne window only
      const ang = (k / count) * Math.PI * 2 + Math.random() * 0.8;
      const dist = (18 + Math.random() * 16) * reach;
      const dx = Math.cos(ang) * dist;
      const dy = Math.sin(ang) * dist - 6; // slight upward bias
      const rot = Math.random() * 180 - 90;
      anim.effect.setKeyframes([
        { transform: `${CENTER}translate(0,0) scale(1) rotate(0deg)`, opacity: 1, offset: 0 },
        { transform: `${CENTER}translate(${dx}px,${dy}px) scale(0.2) rotate(${rot}deg)`, opacity: 0, offset: 1 },
      ]);
      anim.cancel();
      anim.play();
    }
  }

  // The level-up's finite starburst + a gold shard ring, for the rebirth cards (pooled nodes; no layout read).
  function bigBurst() {
    if (prefersReducedMotion()) return;
    if (burstAnimRef.current) {
      burstAnimRef.current.cancel();
      burstAnimRef.current.play();
    }
    const { w, h } = layerSizeRef.current;
    if (w && h) spawnShards(w / 2, h * 0.46, TIER_GOLD, SHARD_POOL, 4);
  }

  // Put the shared card back to its everyday timeline after a milestone played on it. A no-op until a
  // milestone has (so with the flag off nothing here ever runs).
  function resetMilestoneCard() {
    if (!milestoneCardRef.current) return;
    milestoneCardRef.current = false;
    if (levelupRef.current) delete levelupRef.current.dataset.milestone;
    const a = levelupAnimRef.current;
    if (a && a.effect && a.effect.setKeyframes) {
      a.effect.setKeyframes(LEVELUP_FRAMES);
      a.effect.updateTiming({ duration: LEVELUP_MS });
    }
  }

  // P7 POPUP PURGE (SEASON2 only): V3.fx (v3/notify.js wrapFx, the lazy v3 chunk) swaps every CENTRE card on this
  // handle (LEVEL N, NEW FRAME, REBIRTH, +N WINS, the wins hint, mark/automation) for an edge toast or nothing.
  // Flag OFF: V3.fx is never installed, the handle is exactly as before.
  // THE LOOK (popLooks.js, Andy oct19): the equipped POP STYLE dresses a +N gain pop — fill (cycled pop to pop), its
  // coloured outline and hard offset shadow (static styles on the pooled node, set per spawn — no animated property).
  // null (CLASSIC, a word-rarity band pop) clears back to the CSS dress. Returns the fill used.
  const lookNextRef = useRef(0);
  // the painted burst under the number: shown + slammed in for a look, hidden otherwise (a pooled child, finite WAAPI)
  function dressArt(pop, look, crit = false, delay = 90, spin = 22) {
    const img = pop.children[2];
    if (!img) return;
    const src = look && (crit ? look.crit : look.art);
    if (!src || prefersReducedMotion()) { img.style.display = 'none'; return; }
    if (img.getAttribute('src') !== src) img.setAttribute('src', src);
    img.style.display = 'block'; // the CSS rests it at display:none
    dressNum(pop.children[1], look);
    const rot = Math.random() * 60 - 30;
    if (img.__burst) { try { img.__burst.cancel(); } catch { /* gone */ } }
    img.style.willChange = 'transform, opacity'; // only for the burst's life
    img.__burst = img.animate([
      // a crisp slam (easing per step — a whole-run ease-out raced it through its hold): pops to 1.18 at full opacity,
      // settles, HOLDS, then a quick fade — 420 ms, finite
      { transform: `translate(-50%, -50%) rotate(${rot}deg) scale(.35)`, opacity: 0, easing: 'cubic-bezier(.2,1.5,.4,1)' },
      { transform: `translate(-50%, -50%) rotate(${rot + spin * 0.36}deg) scale(1.18)`, opacity: 1, offset: 0.2, easing: 'ease-out' },
      { transform: `translate(-50%, -50%) rotate(${rot + spin * 0.55}deg) scale(1)`, opacity: 1, offset: 0.36, easing: 'linear' },
      { transform: `translate(-50%, -50%) rotate(${rot + spin * 0.73}deg) scale(1.02)`, opacity: 1, offset: 0.74, easing: 'ease-in' },
      { transform: `translate(-50%, -50%) rotate(${rot + spin}deg) scale(1.12)`, opacity: 0 },
    ], { duration: crit ? CRIT_BURST_MS : POP_BURST_MS, delay: crit ? 0 : delay, fill: 'backwards', easing: 'linear' }); // lands as the pop itself reaches full opacity
    img.__burst.onfinish = () => { img.style.willChange = ''; img.__burst = null; };
  }
  // THE KIT's NUMBER (oct27): the +N sits on a chip of the look's own painted texture (its bar art) edged in the look's
  // outline colour — static styles on the pooled node, set per spawn (MenuXp.css .is-kit).
  function dressNum(node, look) {
    if (look && look.chip) return look.chip(node); // a painted kit: its textured chip (popLooks.js, lazy)
    clearNum(node);
    // a look without its kit art yet: the oct25 dress — white over a heavy black outline, so it reads on its burst
    if (look) { node.style.color = '#FFFFFF'; node.style.webkitTextStroke = '5px #000'; node.style.textShadow = '3px 3px 0 #000'; }
  }
  function clearNum(node) {
    if (!node.classList.contains('is-kit')) return;
    node.classList.remove('is-kit');
    node.style.backgroundImage = '';
    node.style.borderColor = '';
  }
  function dressPop(node, look, colour, hardShadow) {
    clearNum(node);
    if (!look) {
      node.style.color = colour;
      node.style.webkitTextStroke = '';
      node.style.textShadow = hardShadow ? '2px 2px 0 #000' : '';
      return colour;
    }
    const fill = look.fill[lookNextRef.current++ % look.fill.length];
    node.style.color = fill;
    node.style.webkitTextStroke = `3px ${look.stroke}`;
    node.style.textShadow = `3px 3px 0 ${look.shadow}`;
    return fill;
  }

  // KEY GROWTH dressing on pop node i: the burst ring (stage 1+) and sparkle (stage 2+) land as the +N hits. `colour`
  // null = stand down (a worn look paints its own burst; a crit has its own dress) — cancels whatever ran on this node.
  function dressGrowth(i, colour, hitMs = 90) {
    const ra = ringAnimsRef.current[i];
    const sa = sparkAnimsRef.current[i];
    const ring = ringElsRef.current[i];
    const spark = sparkElsRef.current[i];
    if (ra) ra.cancel();
    if (sa) sa.cancel();
    if (ring) ring.style.willChange = ''; // a cancel never fires onfinish — drop the hint here
    if (spark) spark.style.willChange = '';
    const g = growthRef.current;
    if (!colour || g.stage < 1 || prefersReducedMotion() || !ring || !ra) return;
    if (layerRef.current && !layerRef.current.classList.contains('is-grown')) layerRef.current.classList.add('is-grown');
    const rot = Math.random() * 40 - 20;
    ring.style.backgroundColor = g.stage >= 3 ? TIER_GOLD : colour;
    ring.style.willChange = 'transform, opacity';
    ra.effect.setKeyframes([
      { transform: `translate(-50%, -50%) rotate(${rot}deg) scale(.3)`, opacity: 0, easing: 'cubic-bezier(.2,1.4,.4,1)' },
      { transform: `translate(-50%, -50%) rotate(${rot + 8}deg) scale(1.08)`, opacity: 0.9, offset: 0.3, easing: 'ease-out' },
      { transform: `translate(-50%, -50%) rotate(${rot + 14}deg) scale(1.3)`, opacity: 0 },
    ]);
    ra.effect.updateTiming({ delay: hitMs });
    ra.play();
    if (g.stage < 2 || !spark || !sa) return;
    if (!spark.getAttribute('src')) spark.setAttribute('src', SPARK_SRC); // fetched on the first stage-2 pop, never at paint
    const flip = Math.random() < 0.5 ? -1 : 1;
    spark.style.willChange = 'transform, opacity';
    sa.effect.setKeyframes([
      { transform: 'translate(-50%, -50%) rotate(0deg) scale(0)', opacity: 0, easing: 'cubic-bezier(.2,1.5,.4,1)' },
      { transform: `translate(-50%, -50%) rotate(${flip * 35}deg) scale(1.15)`, opacity: 1, offset: 0.4, easing: 'ease-in' },
      { transform: `translate(-50%, -50%) rotate(${flip * 90}deg) scale(0)`, opacity: 0 },
    ]);
    sa.effect.updateTiming({ delay: hitMs + 60 });
    sa.play();
  }
  // streak scale x the career growth (`share` of it), clamped (the phone ceiling is lower)
  const grownScale = (scale, share = 1) => {
    const g = growthRef.current;
    return Math.min(narrowRef.current ? POP_SCALE_MAX_NARROW : POP_SCALE_MAX, scale * (1 + (g.scale - 1) * share));
  };

  useImperativeHandle(ref, () => (V3.fx || Object)({
    letterPop(letter, plusText, scale = 1, colour = '#2EFFE0', feelTier = 0, look = null) {
      const { w, h } = layerSizeRef.current;
      const anims = popAnimsRef.current;
      if (!w || !h || !anims.length) return; // not measured yet, or no pool
      const levelup = popCapRef.current && levelupAnimRef.current && levelupAnimRef.current.playState === 'running';
      const i = pickIndex(anims, POP_POOL, levelup ? 1 : POP_CAP, popNextRef);
      const el = popElsRef.current[i];
      const anim = anims[i];
      if (!el || !anim) return;
      const sz = grownScale(scale);
      // a grown pop keeps its whole (estimated) width on screen — text length x glyph half-width x size, no layout read
      const label = !plusText ? letter : /XP/.test(plusText) ? plusText : `${plusText} XP`;
      const pos = pickPosition(w, h, barBoxRef.current, recentPosRef.current, POP_HALF * Math.max(1, sz), Math.max(POP_HALF, label.length * CHAR_HALF_PX * sz));
      el.classList.remove('is-crit'); // reset if this node was last used for a crit
      // Andy oct10 ("why are there neon letters … those arent explained"): a key pops what it PAID — "+N XP", in the
      // tap pop's dress (no typed letter). The CRIT keeps its key: CRIT +N says what happened.
      el.classList.add('is-tap');
      // KEY TIER tier (item 1) drives the visible/audible escalation the player BOUGHT:
      // T1-T4 teal, T5+ gold (overrides the streak colour); T3+ a hard offset shadow;
      // T2+ particle shards. All finite/pooled; particles skip under reduced motion.
      const tierColour = feelTier >= 5 ? TIER_GOLD : feelTier >= 1 ? TIER_TEAL : colour;
      // children: [0] = (empty — the typed letter is not shown), [1] = "+N XP" in the tier colour
      el.children[0].textContent = '';
      // a band-only pop (useXpCapture: a menu WORD's rarity band, no +N) still shows its band word
      el.children[1].textContent = label;
      const lk = plusText ? look : null; // a word-rarity band pop keeps its band colour
      dressPop(el.children[1], lk, tierColour, feelTier >= 3);
      const tf0 = tierRef.current;
      const mo = kitArc(lk, Math.random() * 20 - 10, sz * (0.92 + Math.random() * 0.16), 1 + tf0.tier * 0.05, tf0.popRise, Math.round(tf0.popMs * POP_STRETCH));
      dressArt(el, lk, false, Math.round(mo.hit * mo.ms), mo.spin);
      dressGrowth(i, plusText && !lk ? tierColour : null, Math.round(mo.hit * mo.ms));
      el.style.left = `${pos.x}px`;
      el.style.top = `${pos.y}px`;
      // Shards: KEY TIER T2+ throws its 4; the MENU TIER throws its own from T2 — whichever
      // is richer wins, so neither purchase nor progress is ever invisible.
      const tfx = tierRef.current;
      const shardN = Math.min(6, Math.max(feelTier >= 2 ? SHARD_PER_POP : 0, tfx.shards, lk ? lk.n : 0));
      if (shardN > 0 && !prefersReducedMotion()) spawnShards(pos.x, pos.y, lk ? lk.shards : tierColour, shardN, 1 + tfx.tier * 0.12);
      // Streak tier scales the pop via the TRANSFORM (not font-size); per-pop variance adds a
      // small random rotation + scale multiplier on top so no two pops read identical.
      // per-pop variance (a small rotation + scale, picked in kitArc's call above) so no two pops read identical;
      // LONGER at higher menu tiers (Andy A1), ×POP_STRETCH (oct27), and a worn look's own motion (kitArc)
      anim.effect.updateTiming({ duration: mo.ms });
      anim.effect.setKeyframes(mo.frames);
      anim.cancel();
      anim.play();
    },
    // CRIT KEY pop (Andy oct8 "A + B"): the SAME pooled pop node as letterPop, in its crit dress (.is-crit — the key
    // CRIT YELLOW with a darker-yellow outline, "CRIT +N" big in Bungee), a scale PUNCH 1.35 → 0.92 → 1 over
    // CRIT_PUNCH_MS before it floats off, a pooled ink STARBURST behind it and a ring of yellow shards. All finite,
    // transform / opacity only, no layout read (the cached layer size + the pop's own random position).
    // Arm the crit art: the menu session can crit (a RARE+ gear is worn), so the burst pool loads its asset now —
    // once, on mount, never per key.
    critArm() {
      // nothing to download any more (the crit is type + motion only); kept so callers don't change
    },
    critPop(letter, critText, scale = 1, look = null) {
      const { w, h } = layerSizeRef.current;
      const anims = popAnimsRef.current;
      if (!w || !h || !anims.length) return;
      const levelup = popCapRef.current && levelupAnimRef.current && levelupAnimRef.current.playState === 'running';
      const i = pickIndex(anims, POP_POOL, levelup ? 1 : POP_CAP, popNextRef);
      const el = popElsRef.current[i];
      const anim = anims[i];
      if (!el || !anim) return;
      // Andy oct9: a crit lands in the OPEN — under the XP bar, across the bar's width (over the mode cards), never under
      // the rail tiles or half off-screen. Falls back to the safe-margin random spot when the bar isn't measured.
      const box = barBoxRef.current;
      let pos;
      if (box && box.r - box.l > CRIT_SAFE * 2) {
        const x = box.l + CRIT_SAFE + Math.random() * (box.r - box.l - CRIT_SAFE * 2);
        const y = box.bt + CRIT_SAFE + Math.random() * CRIT_SAFE * 1.6;
        pos = { x, y: Math.min(y, Math.max(CRIT_TOP, h - CRIT_SAFE)) };
      } else {
        const raw = pickPosition(w, h, box, recentPosRef.current);
        pos = {
          x: Math.min(Math.max(raw.x, CRIT_SAFE), Math.max(CRIT_SAFE, w - CRIT_SAFE)),
          y: Math.min(Math.max(raw.y, CRIT_TOP), Math.max(CRIT_TOP, h - CRIT_SAFE)),
        };
      }
      dressGrowth(i, null);
      el.classList.remove('is-tap');
      el.classList.add('is-crit');
      el.children[0].textContent = letter;
      el.children[0].style.color = ''; // CSS crit yellow
      el.children[0].style.textShadow = '';
      el.children[1].textContent = critText;
      el.children[1].style.color = '';
      el.children[1].style.textShadow = '';
      el.children[1].style.webkitTextStroke = ''; // the crit dress (CSS) unless a LOOK dresses it below
      clearNum(el.children[1]);
      // THE KIT's CRIT (oct27): a worn look throws its own painted CRIT burst behind the hit, its textured number, and
      // a full ring of its shards; without one the crit keeps its own dress and no burst
      el.classList.toggle('is-kit-crit', !!look);
      if (look) {
        dressArt(el, look, true);
        if (!prefersReducedMotion()) spawnShards(pos.x, pos.y, look.shards, 6, 1.4);
      } else if (el.children[2]) el.children[2].style.display = 'none';
      el.style.left = `${pos.x}px`;
      el.style.top = `${pos.y}px`;
      const still = prefersReducedMotion();
      // the fx layer jolts on a crit (the pink/cyan RGB copies are gone — Andy oct11: they doubled the crit animation)
      if (!still) {
        const sh = critShakeRef.current;
        if (sh && sh.effect) {
          const k = CRIT_SHAKE_PX;
          sh.effect.setKeyframes([
            { transform: 'none' },
            { transform: `translate(${k}px, ${-k * 0.6}px)` },
            { transform: `translate(${-k * 0.8}px, ${k * 0.5}px)` },
            { transform: `translate(${k * 0.4}px, ${k * 0.3}px)` },
            { transform: 'none' },
          ]);
          sh.cancel();
          sh.play();
        }
      }
      // the key: no slam or squash (Andy oct28 — the number box never stretches): a quick fade in at its size, a long
      // readable HOLD (so the +N is seen), then it fades off on the same small straight rise. The hit is the shake + burst.
      const dur = CRIT_BURST_MS;
      const s = grownScale(scale, 0.5); // a crit is already the big one — it takes half the career growth
      anim.effect.updateTiming({ duration: dur });
      anim.effect.setKeyframes([
        { transform: `${CENTER}translateY(0px) scale(${s})`, opacity: 0, offset: 0, easing: 'ease-out' },
        { transform: `${CENTER}translateY(${-POP_DRIFT * 0.1}px) scale(${s})`, opacity: 1, offset: Math.min(0.2, CRIT_PUNCH_MS / dur) },
        { transform: `${CENTER}translateY(${-POP_DRIFT * 0.5}px) scale(${s})`, opacity: 1, offset: 0.8, easing: 'ease-in' },
        { transform: `${CENTER}translateY(${-POP_DRIFT}px) scale(${s})`, opacity: 0, offset: 1 },
      ]);
      anim.cancel();
      anim.play();
    },
    // Tap pop: no letter — the "+N" ALONE, at the letter's size (via .is-tap CSS), in the
    // tier colour, spawned AT the tap client coords (converted to layer-local), still kept
    // out of the XP bar's box.
    tapPop(plusText, scale = 1, colour = '#2EFFE0', clientX = 0, clientY = 0, look = null) {
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
      const levelup = popCapRef.current && levelupAnimRef.current && levelupAnimRef.current.playState === 'running';
      const i = pickIndex(anims, POP_POOL, levelup ? 1 : POP_CAP, popNextRef);
      const el = popElsRef.current[i];
      const anim = anims[i];
      if (!el || !anim) return;
      el.classList.remove('is-crit');
      el.classList.add('is-tap'); // hides the letter span, upsizes the "+N" (CSS)
      el.children[1].textContent = plusText;
      dressPop(el.children[1], look, colour, false); // tier colour for the tap, or the equipped LOOK
      const tf0 = tierRef.current;
      const mo = kitArc(look, Math.random() * 20 - 10, grownScale(scale) * (0.92 + Math.random() * 0.16), 1 + tf0.tier * 0.05, tf0.popRise, Math.round(tf0.popMs * POP_STRETCH));
      dressArt(el, look, false, Math.round(mo.hit * mo.ms), mo.spin);
      dressGrowth(i, look ? null : colour, Math.round(mo.hit * mo.ms));
      if (look && !prefersReducedMotion()) spawnShards(x, y, look.shards, Math.min(6, look.n));
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      anim.effect.updateTiming({ duration: mo.ms });
      anim.effect.setKeyframes(mo.frames);
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
    // `size` ('S' | 'M' | 'L' | 'XL', MILESTONE MOMENTS) is only ever passed with the flag on.
    celebrate(level, size) {
      const a = levelupAnimRef.current;
      if (!a) return;
      for (const p of popAnimsRef.current) p.cancel(); // celebration owns the budget
      popCapRef.current = true;
      const m = size ? MILESTONE_FX[size] : null;
      if (m) {
        // Same card, same copy (the title and LV line stay); the kicker reads MILESTONE. Reduced
        // motion keeps the copy but not the bigger slam / longer hold.
        const card = !prefersReducedMotion() && MILESTONE_CARD[size];
        if (levelupRef.current) levelupRef.current.dataset.milestone = size;
        if (a.effect && a.effect.setKeyframes) {
          a.effect.setKeyframes(card ? card.frames : LEVELUP_FRAMES);
          a.effect.updateTiming({ duration: card ? card.ms : LEVELUP_MS });
        }
        milestoneCardRef.current = true;
        milestoneEndsAtRef.current = performance.now() + (card ? card.ms : LEVELUP_MS);
      } else {
        resetMilestoneCard();
      }
      if (levelTitleRef.current) levelTitleRef.current.textContent = `LEVEL ${level}`;
      if (levelSubRef.current) {
        levelSubRef.current.textContent = m ? 'MILESTONE' : LEVEL_PHRASES[(Math.max(1, level) - 1) % LEVEL_PHRASES.length];
      }
      // Economy v3: level-ups no longer pay wins, so there is no "+N WINS" reward line here.
      // CLUTTER PASS (Andy oct3): no "LV n-1 → LV n" — the LEVEL n title right above it says it (:empty hides the row).
      if (levelDetailRef.current) levelDetailRef.current.textContent = '';
      a.cancel();
      a.play();
      // BIGGER at higher tiers: the starburst from T1, and a ring of shards that grows per tier.
      const tf = tierRef.current;
      if (!prefersReducedMotion()) {
        if (tf.levelUpBurst && burstAnimRef.current) {
          burstAnimRef.current.cancel();
          burstAnimRef.current.play();
        }
        const { w, h } = layerSizeRef.current;
        if (w && h) spawnShards(w / 2, h * 0.46, tf.tier >= 5 ? TIER_GOLD : TIER_TEAL, Math.min(SHARD_POOL, tf.levelUpShards + (m ? m.shards : 0)), 3 + tf.tier * 0.6);
      }
    },
    // MILESTONE MOMENTS: ms left on a milestone card (0 otherwise) — the tier-up card waits it out
    // instead of overwriting the bigger LEVEL N on the shared element. A clock read, not a layout read.
    milestoneBusyMs() {
      return milestoneCardRef.current ? Math.max(0, milestoneEndsAtRef.current - performance.now()) : 0;
    },
    // STEP 21: a generic one-shot name card on the level-up element (mark rank-ups). Same finite
    // play + starburst as tierUp; never mutes typing.
    announce(title, sub = '', detail = '') {
      const a = levelupAnimRef.current;
      if (!a) return;
      popCapRef.current = false;
      resetMilestoneCard();
      if (levelTitleRef.current) levelTitleRef.current.textContent = title;
      if (levelSubRef.current) levelSubRef.current.textContent = sub;
      if (levelDetailRef.current) levelDetailRef.current.textContent = detail;
      a.cancel();
      a.play();
      if (burstAnimRef.current && !prefersReducedMotion()) {
        burstAnimRef.current.cancel();
        burstAnimRef.current.play();
      }
    },
    // STEP 22: crossing into a new MENU TIER names the frame the player just earned. Reuses
    // the level-up element + starburst (one finite play each).
    tierUp(name) {
      const a = levelupAnimRef.current;
      if (!a) return;
      popCapRef.current = false;
      resetMilestoneCard();
      // The tier NAME is the headline (≤6 letters, like "LEVEL 9" it fits a 320px menu); "NEW
      // FRAME" rides the sub line. "STEEL FRAME" as the title overflowed the fx layer at 360px.
      if (levelTitleRef.current) levelTitleRef.current.textContent = name;
      if (levelSubRef.current) levelSubRef.current.textContent = 'NEW FRAME UNLOCKED';
      if (levelDetailRef.current) levelDetailRef.current.textContent = '';
      a.cancel();
      a.play();
      if (burstAnimRef.current && !prefersReducedMotion()) {
        burstAnimRef.current.cancel();
        burstAnimRef.current.play();
      }
    },
    // One finite "REBIRTH N" celebration, reusing the level-up pooled element (1500ms). Rebirth Rush (Andy:
    // "Big moment"): it says the ×5 jump plainly with the new total (5^R), and its last line is the ONE
    // rebuy-spree cue — the KEY went back to T0 and the wins were kept. Same finite starburst + gold shard
    // ring the level-up throws (pooled; skipped under reduced motion).
    rebirthCelebration(n) {
      const a = levelupAnimRef.current;
      if (!a) return;
      for (const p of popAnimsRef.current) p.cancel();
      popCapRef.current = true;
      resetMilestoneCard();
      const total = rebirthMult(n);
      if (levelTitleRef.current) levelTitleRef.current.textContent = `REBIRTH ${formatNum(n)}`;
      if (levelSubRef.current) levelSubRef.current.textContent = n > 1 ? `×5 XP & WINS · NOW ×${formatNum(total)}` : '×5 XP & WINS';
      if (levelDetailRef.current) levelDetailRef.current.textContent = '';
      a.cancel();
      a.play();
      bigBurst();
    },
    // One finite "+N WINS" stamp (menu return after a paying round). Same pooled pattern.
    winsStamp(amount) {
      const a = winsStampAnimRef.current;
      if (!a || !winsStampRef.current) return;
      winsStampRef.current.textContent = `+${formatNum(amount)} WINS`;
      a.cancel();
      a.play();
    },
    // One-time WINS explainer — shown the first time the player earns any wins (3s). Copy is
    // fixed; the caller owns the "only once" gate (a localStorage flag).
    winsHint() {
      const a = winsHintAnimRef.current;
      if (!a || !winsHintRef.current) return;
      winsHintRef.current.textContent = 'SPEND WINS IN UPGRADES';
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
          {/* [2] the worn POP STYLE's painted burst (popLooks art) — src set per spawn, hidden without a look */}
          <img className="menu-xp-pop-art" alt="" draggable="false" />
          {/* [3] / [4] KEY GROWTH dressing: the burst ring (a mask, tinted per spawn) and the sparkle — idle at rest */}
          <span
            className="menu-xp-pop-ring"
            ref={(n) => {
              ringElsRef.current[i] = n;
            }}
          />
          <img
            className="menu-xp-pop-spark"
            alt=""
            draggable="false"
            ref={(n) => {
              sparkElsRef.current[i] = n;
            }}
          />
        </span>
      ))}
      {Array.from({ length: EDGE_POOL }, (_, i) => (
        <div
          key={`e${i}`}
          className="menu-xp-edge"
          aria-hidden="true"
          ref={(n) => {
            edgeElsRef.current[i] = n;
          }}
        />
      ))}
      {Array.from({ length: SHARD_POOL }, (_, i) => (
        <span
          key={`s${i}`}
          className="menu-xp-shard"
          aria-hidden="true"
          ref={(n) => {
            shardElsRef.current[i] = n;
          }}
        />
      ))}
      <div className="menu-xp-levelburst" ref={burstRef} />
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
