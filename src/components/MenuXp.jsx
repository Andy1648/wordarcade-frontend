// MenuXp.jsx — the splash's mini XP bar (MenuXpBar) and the menu's feedback layer
// (MenuXpFx). All motion is finite, transform/opacity only, nothing animates at rest. The only
// will-change is set per-shard in spawnShards for its ~360ms flight and cleared on finish (never
// parked on the idle pool). The fx-layer size + XP bar box are measured on
// mount/resize and cached (never per keystroke); each pop then picks a continuous random
// position, kept off the layer edge and out of the bar box, so the readout is never covered.
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import './MenuXp.css';
import { formatNum } from '../format';
import { useLevelBar } from '../hooks/useLevelBar';
import { tierFx, MILESTONE_FX } from '../progress/menuTier';
import { CARD_MS } from '../lib/menuMoments';
import { rebirthMult } from '../progress/xp';
import { reduceMotion } from '../lib/reduceMotion';

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

// Level-up: 1500ms total — scale 1.7→1 over 260ms (overshoot to 1.06 at 200ms, settle by
// 320ms), hold 900ms, fade 280ms. Offsets below are ÷1500.
const LEVELUP_MS = CARD_MS; // 1500 — lib/menuMoments.js (the moments queue releases on it)
// The punch-in curve, applied PER KEYFRAME. It used to sit on the whole effect, which eases the
// entire 1500ms timeline — so the "900ms hold" was actually crossing its fade keyframe ~500ms in
// and the level-up flashed by. Linear effect timing + an eased entry keeps the hold a hold.
const EASE_OUT = 'cubic-bezier(.2,.8,.2,1)';
const WINSSTAMP_MS = 700; // wins stamp keeps its own shorter envelope
const WINSHINT_MS = 3000; // one-time "WINS BUY UPGRADES IN THE SHOP" explainer — a full 3s read
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
export const MenuXpFx = forwardRef(function MenuXpFx({ menuTier = 0 }, ref) {
  const layerRef = useRef(null);
  // STEP 22 / A1: the MENU TIER (level + rebirth) lengthens and enriches every pop. Read through
  // a ref so a level-up mid-typing re-tiers the very next keystroke without re-creating the pool.
  const tierRef = useRef(tierFx(menuTier));
  tierRef.current = tierFx(menuTier);
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

    // Wins EXPLAINER — the one-time "WINS BUY UPGRADES IN THE SHOP" banner. 3s envelope
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
      el.style.background = colour;
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

  useImperativeHandle(ref, () => ({
    letterPop(letter, plusText, scale = 1, colour = '#2EFFE0', feelTier = 0) {
      const { w, h } = layerSizeRef.current;
      const anims = popAnimsRef.current;
      if (!w || !h || !anims.length) return; // not measured yet, or no pool
      const levelup = popCapRef.current && levelupAnimRef.current && levelupAnimRef.current.playState === 'running';
      const i = pickIndex(anims, POP_POOL, levelup ? 1 : POP_CAP, popNextRef);
      const el = popElsRef.current[i];
      const anim = anims[i];
      if (!el || !anim) return;
      const pos = pickPosition(w, h, barBoxRef.current, recentPosRef.current);
      el.classList.remove('is-tap'); // reset if this node was last used for a tap
      // KEY TIER tier (item 1) drives the visible/audible escalation the player BOUGHT:
      // T1-T4 teal, T5+ gold (overrides the streak colour); T3+ a hard offset shadow;
      // T2+ particle shards. All finite/pooled; particles skip under reduced motion.
      const tierColour = feelTier >= 5 ? TIER_GOLD : feelTier >= 1 ? TIER_TEAL : colour;
      // children: [0] = letter (tier colour), [1] = "+N" (always yellow, via CSS)
      el.children[0].textContent = letter;
      el.children[0].style.color = tierColour;
      el.children[0].style.textShadow = feelTier >= 3 ? '2px 2px 0 #000' : '';
      el.children[1].textContent = plusText;
      el.children[1].style.color = ''; // back to CSS yellow
      el.style.left = `${pos.x}px`;
      el.style.top = `${pos.y}px`;
      // Shards: KEY TIER T2+ throws its 4; the MENU TIER throws its own from T2 — whichever
      // is richer wins, so neither purchase nor progress is ever invisible.
      const tfx = tierRef.current;
      const shardN = Math.max(feelTier >= 2 ? SHARD_PER_POP : 0, tfx.shards);
      if (shardN > 0 && !prefersReducedMotion()) spawnShards(pos.x, pos.y, tierColour, shardN, 1 + tfx.tier * 0.12);
      // Streak tier scales the pop via the TRANSFORM (not font-size); per-pop variance adds a
      // small random rotation + scale multiplier on top so no two pops read identical.
      const rot = Math.random() * 20 - 10; // [-10°, +10°]
      const s = scale * (0.92 + Math.random() * 0.16); // ×[0.92, 1.08]
      // LONGER at higher menu tiers (Andy A1): the pop lives 600ms at T0 up to ~1.2s, rises
      // further, and lands with a punch (overshoot) before it floats off.
      const tf = tierRef.current;
      anim.effect.updateTiming({ duration: tf.popMs });
      anim.effect.setKeyframes([
        { transform: `${CENTER}rotate(${rot}deg) scale(${s}) translateY(8.96px)`, opacity: 0, offset: 0 },
        { transform: `${CENTER}rotate(${rot}deg) scale(${s * (1 + tf.tier * 0.05)}) translateY(-8.96px)`, opacity: 1, offset: 0.18 },
        { transform: `${CENTER}rotate(${rot}deg) scale(${s}) translateY(-14px)`, opacity: 1, offset: 0.3 },
        { transform: `${CENTER}rotate(${rot}deg) scale(${s}) translateY(-${tf.popRise}px)`, opacity: 0, offset: 1 },
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
      const levelup = popCapRef.current && levelupAnimRef.current && levelupAnimRef.current.playState === 'running';
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
      // LONGER at higher menu tiers (Andy A1): the pop lives 600ms at T0 up to ~1.2s, rises
      // further, and lands with a punch (overshoot) before it floats off.
      const tf = tierRef.current;
      anim.effect.updateTiming({ duration: tf.popMs });
      anim.effect.setKeyframes([
        { transform: `${CENTER}rotate(${rot}deg) scale(${s}) translateY(8.96px)`, opacity: 0, offset: 0 },
        { transform: `${CENTER}rotate(${rot}deg) scale(${s * (1 + tf.tier * 0.05)}) translateY(-8.96px)`, opacity: 1, offset: 0.18 },
        { transform: `${CENTER}rotate(${rot}deg) scale(${s}) translateY(-14px)`, opacity: 1, offset: 0.3 },
        { transform: `${CENTER}rotate(${rot}deg) scale(${s}) translateY(-${tf.popRise}px)`, opacity: 0, offset: 1 },
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
    // Rebirth Rush one-time conversion: "YOUR LEVELS BECAME +N REBIRTHS" (econMigrate rebirthRushNotice).
    // The new rebirth count is the headline; Andy's line rides the sub (it wraps on a phone).
    rebirthRush(added, rebirths) {
      const a = levelupAnimRef.current;
      if (!a) return;
      for (const p of popAnimsRef.current) p.cancel();
      popCapRef.current = true;
      resetMilestoneCard();
      if (levelTitleRef.current) levelTitleRef.current.textContent = `REBIRTH ${formatNum(rebirths)}`;
      if (levelSubRef.current) levelSubRef.current.textContent = `YOUR LEVELS BECAME +${formatNum(added)} REBIRTHS`;
      if (levelDetailRef.current) levelDetailRef.current.textContent = `×${formatNum(rebirthMult(rebirths))} XP & WINS`;
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
      {Array.from({ length: SHARD_POOL }, (_, i) => (
        <span
          key={`s${i}`}
          className="menu-xp-shard"
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
