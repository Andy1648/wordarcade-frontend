// Reel.jsx — the ROLL screen's reel + every land effect (ROLL v1, Andy oct5 mockup claude/mockups/roll-v1/Main.dc.html).
// A FIXED POOL of nodes mounted once with the screen: REEL_LEN cells (each a full MarkCard), the pointer, the rarity
// light, BURST_POOL particles, and — portalled INTO the ROLL overlay (a layer of that overlay, never its own fixed
// element) — the slowdown dim and the REVEAL layer with its own particle pool.
//
// THE STRIP: a full-width band of cards that bleeds to the screen edges, a yellow pointer through the middle. The
// reel rests at a random spot INSIDE the result cell, then settles to centre (reelPlan.restOffset). On the land the
// other cards fade back so the result stands alone.
// RARITY-SCALED REVEALS (reelPlan.revealKind): a SHORT land → the result LINE under the reel (RollScreen) only;
// COMMON / RARE → the LITE reveal (closes by itself); EPIC → the DIM reveal ("1 IN X" slams); LEGENDARY+ → the FULL
// reveal (rays, the rarity, "1 IN X" huge). ROLL REVEAL v2 (revealPlan.js): in every one the CARD BACK (asset) flips
// and each rarity ADDS a layer — RARE a sheen pass + sparkles, EPIC a pre-flip shake + a burst, LEGENDARY the
// telegraph (the back's edge in the rarity colour before the flip) + a slam + a small shake, MYTHIC a colour flash + a
// second ring, SECRET the lights dim + a long spin-up — then the STATS EXTENSION (RevealStats.jsx) ticks the stats in.
// DIM / FULL stay up until a tap ("TAP TO KEEP"); under AUTO ROLL the dim closes itself; a tap closes any reveal.
// TAP: a tap mid-spin jumps to the land (the reveal still plays); a tap on a reveal closes it.
// REPLAY GUARD: the `played` ref is owned by RollScreen, so a remount (coming back from the INDEX) never replays a spin.
//
// RULES (CLAUDE.md ANIMATION BUDGET): the spin is ONE compositor animation (the easing curve sampled into keyframes on
// the track's transform, in % — nothing is measured, ever; no per-frame main-thread work); every other effect is a finite WAAPI one-shot on transform/opacity (the mockup's
// endless rays / blink are FINITE here: the rays turn for RAYS_MS then rest, the "TAP TO KEEP" blinks twice);
// will-change is ON only while a node animates and cleared when it stops; nothing loops. Every non-rectangle shape is
// an asset (/art/rolls/rays.svg as a tinted mask, /art/rolls/{shard,spark,blob}.svg particles, the inline pointer SVG).
// REDUCED MOTION: mode 'none' — no spin, no shake, no burst, no reveal layer: the reel sits on the result and the
// line shows at once.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import MarkCard from '../markCard/MarkCard';
import { CARD_RAR, cardTier } from '../markCard/palette.js';
import { tierLabel } from '../markCard/cardModel.js';
import { rollMarkById } from '../../progress/markRolls';
import {
  sndReelTick, sndRollSting, sndRollSwell, sndCutStamp, sndRollTell, sndShardBurst, sndRevealFlip, sndRevealRise, sndRevealArp,
  sndStatTick,
} from '../../audio/rollSounds';
import { formatNum } from '../../format';
import RevealStats, { revealStatsOf } from './RevealStats';
import {
  revealTimeline, extensionPlan, extensionAt, revealDoneMs, selfCloseMs, SPARK_POOL, SPARK_SPOTS, SCREEN_SHAKE, PRE_RATTLE,
  DIM_LIGHTS, FLASH_PEAK,
} from './revealPlan.js';
import {
  REEL_LEN, LAND_AT, BURST_POOL, DIM_CELLS, RAYS_MS, spinMs, easePow, spinFrom, reelPos, timeAt, tickTimes,
  tierIndex, revealKind, dimFor, hasLight, burstCount, shakePx, shakeFrames, burstVectors, NEAR_MISS_TICKS, FLASH_TIERS, WASH_TIERS,
  KEEP_HOLD_MS, CHARGE_MS, CHARGE_SHAKE_AT, OVERHOLD_MS, CHARGE_RATTLE, tellFor, tellFrames,
} from './reelPlan.js';

const ART = '/art/rolls/';
const PARTICLE_ART = ['shard.svg', 'spark.svg', 'blob.svg'];
const CELLS = Array.from({ length: REEL_LEN }, (_, i) => i);
const PARTS = Array.from({ length: BURST_POOL }, (_, i) => i);
const VEC = burstVectors(BURST_POOL);
const VEC_BIG = burstVectors(BURST_POOL, 2.6);
const markOf = (id) => rollMarkById(id) || { id, tier: 'common', name: '' };
const lineOf = (tier) => CARD_RAR[cardTier(tier)].line;
const SPIN_KEYS = 64; // keyframes the spin curve is sampled into (linear between: smooth at any refresh rate)
const SPARK_SLOTS = Array.from({ length: SPARK_POOL }, (_, i) => i);
// the pointer KICK on each of the last NEAR_MISS_TICKS crossings (NIGHT oct8 #4) — transform only, ~110 ms
const KICK = [{ transform: 'translateX(0) rotate(0deg)' }, { transform: 'translateX(5px) rotate(4deg)', offset: 0.35 }, { transform: 'translateX(0) rotate(0deg)' }];
/** REVEAL v2: the card back's pre-flip rattle — a jitter that BUILDS (40% → 100% of `px`) over `ms`, transform only. */
function buildRattle(px, ms) {
  const n = Math.max(4, Math.round(ms / 55));
  const out = [{ transform: 'translate3d(0,0,0) rotate(0deg)' }];
  for (let i = 1; i < n; i += 1) {
    const k = px * (0.4 + (0.6 * i) / n);
    const sx = i % 2 ? -1 : 1;
    out.push({ transform: `translate3d(${(sx * k).toFixed(1)}px,${(((i % 3) - 1) * k * 0.5).toFixed(1)}px,0) rotate(${(sx * k * 0.45).toFixed(2)}deg)` });
  }
  out.push({ transform: 'translate3d(0,0,0) rotate(0deg)' });
  return out;
}
const SLAM = [
  { transform: 'scale(3)', opacity: 0 },
  { transform: 'scale(0.92)', opacity: 1, offset: 0.7 },
  { transform: 'scale(1)', opacity: 1 },
];

/** The transform string for a reel position (cells) — pure writes. */
export function reelTransform(p) {
  return `translate3d(${(-(p / REEL_LEN) * 100).toFixed(4)}%,0,0)`;
}

/** The pointer: a plain bar (CSS) between two triangles (inline vector art — a triangle is not a rectangle).
 *  THE TELL (R4): a second pointer in the tier colour sits over it at opacity 0 and fades in with the tell (EPIC+). */
function Pointer({ ptrRef, tellRef, color }) {
  return (
    <div className="rs-ptr" aria-hidden="true" ref={ptrRef}>
      <svg className="rs-ptr-tri is-top" width="44" height="30" viewBox="0 0 44 30"><path d="M2 2 L42 2 L22 28 Z" fill="#FFE94A" stroke="#000" strokeWidth="4" strokeLinejoin="round" /></svg>
      <span className="rs-ptr-bar" />
      <svg className="rs-ptr-tri is-bot" width="44" height="30" viewBox="0 0 44 30"><path d="M2 28 L42 28 L22 2 Z" fill="#FFE94A" stroke="#000" strokeWidth="4" strokeLinejoin="round" /></svg>
      <div className="rs-ptr-tell" ref={tellRef} style={{ color }}>
        <svg className="rs-ptr-tri is-top" width="44" height="30" viewBox="0 0 44 30"><path d="M2 2 L42 2 L22 28 Z" fill="currentColor" stroke="#000" strokeWidth="4" strokeLinejoin="round" /></svg>
        <span className="rs-ptr-bar is-tell" />
        <svg className="rs-ptr-tri is-bot" width="44" height="30" viewBox="0 0 44 30"><path d="M2 28 L42 28 L22 2 Z" fill="currentColor" stroke="#000" strokeWidth="4" strokeLinejoin="round" /></svg>
      </div>
    </div>
  );
}
/** The charge rattle's keyframes (transform only): a 4-step jitter of `px`, played for finite iterations. */
const rattle = (px) => [
  { transform: 'translate3d(0,0,0)' },
  { transform: `translate3d(${-px}px,${px * 0.6}px,0)`, offset: 0.25 },
  { transform: `translate3d(${px}px,${-px * 0.5}px,0)`, offset: 0.5 },
  { transform: `translate3d(${-px * 0.7}px,${-px * 0.6}px,0)`, offset: 0.75 },
  { transform: 'translate3d(0,0,0)' },
];

export default function Reel({ spin, idle = null, view = null, auto = false, coverHost, ctl, played, onLand, onDone, children }) {
  const nodes = useRef({});
  const anims = useRef([]);
  const timers = useRef([]);
  const phase = useRef('idle'); // idle | spin (rAF) | landed (land effects) | cut (a DIM / FULL reveal is up) | done
  const cbs = useRef({});
  cbs.current = { onLand, onDone, auto };
  const [cut, setCut] = useState(null); // { res, kind: 'dim' | 'full', seq } — the reveal that is up
  const reg = (name) => (el) => { if (el) nodes.current[name] = el; };

  const anim = (el, frames, opts) => {
    if (!el || typeof el.animate !== 'function' || !frames.length) return null;
    el.style.willChange = 'transform, opacity';
    const a = el.animate(frames, { fill: 'both', easing: 'linear', ...opts });
    anims.current.push(a);
    const off = () => { if (el.style) el.style.willChange = ''; };
    a.finished.then(off, off);
    return a;
  };
  const clearTimers = () => { for (const t of timers.current) clearTimeout(t); timers.current = []; };
  const later = (fn, ms) => { timers.current.push(setTimeout(fn, ms)); };
  const stopAll = () => {
    clearTimers();
    for (const a of anims.current) { try { a.cancel(); } catch { /* gone */ } }
    anims.current = [];
    for (const el of Object.values(nodes.current)) if (el && el.style) el.style.willChange = '';
  };
  // ---- the CHARGE (HOLD TO ROLL, R4): the reel rattles while the button is held — light while the fill crosses,
  // hard once charged. Its own animation slot (never part of a spin), finite iterations sized to the hold. ----
  const chargeAnim = useRef(null);
  const charge = (phase) => {
    const el = nodes.current.shake;
    if (chargeAnim.current) { try { chargeAnim.current.cancel(); } catch { /* gone */ } chargeAnim.current = null; }
    if (!el || !phase || typeof el.animate !== 'function') { if (el && el.style) el.style.willChange = ''; return; }
    const hard = phase === 2;
    const px = hard ? CHARGE_RATTLE.hard : CHARGE_RATTLE.light;
    const step = hard ? 70 : 100;
    const span = hard ? OVERHOLD_MS : CHARGE_MS * CHARGE_SHAKE_AT;
    el.style.willChange = 'transform';
    const a = el.animate(rattle(px), { duration: step, iterations: Math.max(1, Math.ceil(span / step)), easing: 'linear' });
    chargeAnim.current = a;
    const off = () => { if (chargeAnim.current === a) chargeAnim.current = null; if (el.style) el.style.willChange = ''; };
    a.finished.then(off, off);
  };
  const place = (p) => {
    const tr = nodes.current.track;
    if (tr) tr.style.transform = reelTransform(p);
  };
  // TWO pooled SHADES (left / right of the landing slot) fade the other cards: during the slowdown (EPIC+) to 22%,
  // once landed to 35% so the result stands alone. One opacity animation per shade — compositor work, never a
  // per-card transition (43 cards fading repainted the whole strip every frame). instant = no animation (reduced).
  const SHADE = { dim: 0.78, landed: 0.65 };
  const shade = (to, { instant = false, duration = 300, delay = 0 } = {}) => {
    for (const k of ['shadeL', 'shadeR']) {
      const el = nodes.current[k];
      if (!el) continue;
      if (instant || !to) { el.style.opacity = to ? String(to) : ''; continue; }
      const from = Number(el.style.opacity) || 0;
      el.style.opacity = String(to);
      anim(el, [{ opacity: from }, { opacity: to }], { duration, delay, easing: 'ease-in' });
    }
  };

  // ---- the land: settle, sting, shake, light, burst; the DIM / FULL reveal for EPIC+ ----
  // quiet = skip every effect (leaving for the INDEX); jump = a tap mid-spin (effects play, no settle bounce)
  const land = (res, mode, { quiet = false, jump = false, rest = 0 } = {}) => {
    phase.current = 'landed';
    place(LAND_AT);
    const tier = res.tier;
    sndRollSting(tier);
    cbs.current.onLand && cbs.current.onLand(res);
    if (quiet || mode === 'none') { shade(SHADE.landed, { instant: true }); finishCut(); return; }
    shade(SHADE.landed);
    const n = nodes.current;
    if (!jump && rest) anim(n.track, [{ transform: reelTransform(LAND_AT + rest) }, { transform: reelTransform(LAND_AT) }], { duration: 280, easing: 'cubic-bezier(.3,1.3,.5,1)' });
    const px = shakePx(tier, mode);
    if (px > 0) anim(n.shake, shakeFrames(px), { duration: 220 + px * 18 });
    anim(n[`c${LAND_AT}`], [{ transform: 'scale(1)' }, { transform: 'scale(1.14)', offset: 0.35 }, { transform: 'scale(1.06)' }], { duration: 320, easing: 'cubic-bezier(.2,1.4,.4,1)' });
    if (hasLight(tier, mode)) {
      anim(n.light, [
        { opacity: 0, transform: 'scale(0.6) rotate(0deg)' },
        { opacity: 0.95, transform: 'scale(1.05) rotate(14deg)', offset: 0.18 },
        { opacity: 0, transform: 'scale(1.25) rotate(44deg)' },
      ], { duration: 1800, easing: 'cubic-bezier(.2,.7,.3,1)' });
    }
    // RARE: one flash over the band; EPIC+: a rarity-colour wash over the whole screen (the dim / reveal sit on top)
    if (FLASH_TIERS.has(tier)) anim(n.flash, [{ opacity: 0.75 }, { opacity: 0 }], { duration: 260, easing: 'ease-out', fill: 'none' });
    if (WASH_TIERS.has(tier)) anim(n.wash, [{ opacity: 0 }, { opacity: 0.4, offset: 0.25 }, { opacity: 0 }], { duration: 650, easing: 'ease-out', fill: 'none' });
    const kind = revealKind(tier, mode);
    // REVEAL v2: a land that opens a reveal leaves the burst to the reveal (one burst, on the card, after its flip)
    const k = kind === 'line' ? burstCount(tier, mode) : 0;
    for (let i = 0; i < k; i += 1) {
      const v = VEC[i];
      anim(n[`p${i}`], [
        { opacity: 1, transform: 'translate3d(0,0,0) scale(0.4) rotate(0deg)' },
        { opacity: 0, transform: `translate3d(${v.x}px,${v.y}px,0) scale(${v.s}) rotate(${v.r}deg)` },
      ], { duration: 650 + (i % 4) * 60, easing: 'cubic-bezier(.15,.8,.3,1)' });
    }
    if (kind !== 'line') {
      phase.current = 'cut';
      setCut((c) => ({ res, kind, seq: (c ? c.seq : 0) + 1 }));
      return; // the reveal effect plays; a tap (or AUTO, for a dim) ends it
    }
    later(finishCut, mode === 'short' ? 60 : 420);
  };
  function finishCut() {
    if (phase.current === 'done' || phase.current === 'idle') return;
    phase.current = 'done';
    setCut((c) => (c ? { ...c, res: null } : c));
    cbs.current.onDone && cbs.current.onDone();
  }

  // ---- PLAY a spin (layout effect: the first frame is the frame the tap paints) ----
  useLayoutEffect(() => {
    if (!spin || !spin.seq) return undefined;
    // a remount (back from the INDEX) with a spin that already played: sit on its result, play nothing
    if (played && played.current >= spin.seq) {
      place(LAND_AT);
      shade(SHADE.landed, { instant: true });
      phase.current = 'done';
      return undefined;
    }
    if (played) played.current = spin.seq;
    stopAll();
    setCut((c) => (c ? { ...c, res: null } : c));
    shade(0);
    const { result: res, mode, strip } = spin;
    const rest = mode === 'none' ? 0 : spin.rest || 0;
    const n = nodes.current;
    if (n.dim) n.dim.style.opacity = '0';
    if (mode === 'none') {
      phase.current = 'spin';
      land(res, mode);
      return undefined;
    }
    const dur = spinMs(res.tier, mode);
    const pow = easePow(res.tier, mode);
    const from = spinFrom(mode);
    const goal = LAND_AT + rest;
    const ranks = strip.map((id) => tierIndex(markOf(id).tier));
    phase.current = 'spin';
    // THE SPIN IS A COMPOSITOR ANIMATION: the easing curve (reelPos) sampled into SPIN_KEYS linear keyframes on the
    // track's transform — no per-frame main-thread work at all (an rAF loop restyled the track every frame, which on
    // a 4x-throttled Chromebook was most of the frame budget). The inline transform already holds the rest spot, so
    // the track stays there when the animation ends; the ticks are timers at the exact cell-crossing times.
    place(goal);
    const keys = [];
    for (let i = 0; i <= SPIN_KEYS; i += 1) {
      const f = i / SPIN_KEYS;
      keys.push({ transform: reelTransform(reelPos(f * dur, { dur, pow, from, land: goal })), offset: f });
    }
    const d = dimFor(res.tier, mode);
    // rarer = the screen darkens — only once the reel enters its last few cells (never early enough to spoil it)
    if (d > 0) {
      const at = timeAt(goal - DIM_CELLS, { dur, pow, from, land: goal });
      anim(n.dim, [{ opacity: 0 }, { opacity: d }], { duration: Math.max(200, dur - at), delay: at, easing: 'ease-in' });
      shade(SHADE.dim, { duration: 360, delay: at });
      later(() => { sndRollSwell(res.tier, dur - at); }, at);
      // THE TELL (R4): the pointer turns the tier colour and the band plate pulses it — the colour says WHICH
      // rarity before the card does; more pulses + a stronger peak for rarer; LEGENDARY+ rumbles under it
      const tell = tellFor(res.tier, mode);
      if (tell) {
        const span = Math.max(200, dur - at);
        anim(n.tell, tellFrames(res.tier, mode), { duration: span, delay: at, easing: 'ease-in-out', fill: 'none' });
        anim(n.ptrTell, [{ opacity: 0 }, { opacity: 1, offset: 0.35 }, { opacity: 1 }], { duration: span, delay: at, easing: 'ease-out' });
        if (tell.rumble) later(() => { sndRollTell(res.tier, span); }, at);
      }
    }
    const first = Math.ceil(from + 0.5);
    const ticks = tickTimes({ dur, pow, from, land: goal });
    ticks.forEach((t, i) => later(() => {
      sndReelTick(ranks[first + i] || 0);
      // the last few crossings are the "will it tip over" crawl: the pointer kicks on each one
      if (i >= ticks.length - NEAR_MISS_TICKS) anim(n.ptr, KICK, { duration: 110, easing: 'cubic-bezier(.2,1.4,.4,1)', fill: 'none' });
    }, t));
    const seq = spin.seq;
    const run = anim(n.track, keys, { duration: dur, easing: 'linear', fill: 'none' });
    const done = () => {
      if (phase.current !== 'spin' || !spin || spin.seq !== seq) return;
      land(res, mode, { rest });
    };
    if (run) run.finished.then(done, () => { /* cancelled: a tap / leaving already landed it */ });
    else later(done, dur);
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spin && spin.seq]);

  // ---- the REVEAL v2 (revealPlan.js): the card back flips, each rarity ADDS a layer; then the STATS EXTENSION ticks
  // the gear's stats in. LITE (COMMON / RARE) closes by itself; EPIC (dim) closes by itself under AUTO; LEGENDARY+
  // (full) rests on "TAP TO KEEP". A tap closes any of them at once (the result line already holds the result). ----
  const cutRes = cut && cut.res;
  const cutStats = cutRes ? revealStatsOf(cutRes, view) : null;
  const statsRef = useRef(null);
  statsRef.current = cutStats;
  useLayoutEffect(() => {
    if (!cutRes) return;
    const n = nodes.current;
    const tier = cutRes.tier;
    const kind = cut.kind;
    const full = kind === 'full';
    const tl = revealTimeline(tier);
    const st = statsRef.current;
    const ext = extensionPlan({ extras: st ? st.crit.length : 0, perk: !!(st && st.perks.length), dupe: !!(st && st.dupe), stars: st ? st.pips : 0 });
    const xAt = extensionAt(tier);
    const ease = { in: 'cubic-bezier(.5,0,.9,.5)', out: 'cubic-bezier(.1,.6,.3,1)', pop: 'cubic-bezier(.2,1.4,.4,1)' };
    anim(n.cut, [{ opacity: 0 }, { opacity: 1 }], { duration: tier === 'common' ? 120 : 200 });
    anim(n.dim, [{ opacity: dimFor(tier) }, { opacity: 0 }], { duration: 250 }); // the reveal brings its own backdrop
    if (full) {
      anim(n.cutRays, [
        { transform: 'rotate(0deg) scale(0.6)', opacity: 0 },
        { transform: 'rotate(8deg) scale(1)', opacity: 0.32, offset: 0.1 },
        { transform: 'rotate(60deg) scale(1)', opacity: 0.32 },
      ], { duration: RAYS_MS, easing: 'cubic-bezier(.2,.6,.3,1)' });
    }
    // SECRET: the lights go down first (over the rays), stay down through the spin-up, and come back up on the flash
    if (tl.dim) {
      const span = tl.land + 420;
      anim(n.rvDim, [
        { opacity: 0 },
        { opacity: DIM_LIGHTS, offset: tl.dim.ms / span },
        { opacity: DIM_LIGHTS, offset: tl.flip.at / span },
        { opacity: 0 },
      ], { duration: span, easing: 'ease-in-out', fill: 'none' });
    }
    // BEFORE the flip: EPIC rattles; LEGENDARY+ telegraph — the back's edge lights in the RARITY COLOUR and the rattle
    // builds; SECRET spins the back up (faster and faster) with the edge glinting through it
    if (tl.preShake) {
      anim(n.rvRattle, buildRattle(PRE_RATTLE[tier] || 3, tl.preShake.ms), { duration: tl.preShake.ms, delay: tl.preShake.at, fill: 'none' });
      later(() => sndRevealRise(tier, tl.spinUp ? tl.spinUp.ms + 300 : tl.preShake.ms), tl.spinUp ? tl.spinUp.at : tl.preShake.at);
    }
    if (tl.telegraph) {
      anim(n.rvEdge, [
        { opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 0.5, offset: 0.36 }, { opacity: 1, offset: 0.52 },
        { opacity: 0.7, offset: 0.68 }, { opacity: 1, offset: 0.82 }, { opacity: 1 },
      ], { duration: tl.telegraph.ms, delay: tl.telegraph.at, easing: 'ease-in-out' });
    }
    // THE FLIP: the back turns edge-on (ease-in), the face turns in from the other side (ease-out — a slam tier
    // overshoots). Real 3D turn, transform only. SECRET's back reaches edge-on at the end of its spin-up.
    const half = tl.flip.ms / 2;
    if (tl.spinUp) {
      anim(n.rvBack, [
        { transform: 'perspective(900px) rotateY(0deg)', opacity: 1 },
        { transform: 'perspective(900px) rotateY(990deg)', opacity: 1, offset: 0.999 },
        { transform: 'perspective(900px) rotateY(990deg)', opacity: 0 },
      ], { duration: tl.spinUp.ms, delay: tl.spinUp.at, easing: 'cubic-bezier(.55,0,.75,.35)' });
    } else {
      anim(n.rvBack, [
        { transform: 'perspective(900px) rotateY(0deg)', opacity: 1 },
        { transform: 'perspective(900px) rotateY(90deg)', opacity: 1, offset: 0.999 },
        { transform: 'perspective(900px) rotateY(90deg)', opacity: 0 },
      ], { duration: half, delay: tl.flip.at, easing: ease.in });
    }
    anim(n.rvFace, [
      { transform: 'perspective(900px) rotateY(-90deg)', opacity: 0 },
      { transform: 'perspective(900px) rotateY(-90deg)', opacity: 1, offset: 0.001 },
      { transform: 'perspective(900px) rotateY(0deg)', opacity: 1 },
    ], { duration: tl.spinUp ? tl.flip.ms : half, delay: tl.spinUp ? tl.flip.at : tl.flip.at + half, easing: tl.slam ? 'cubic-bezier(.2,1.25,.45,1)' : ease.out });
    later(() => sndRevealFlip(tier), tl.flip.at);
    // LEGENDARY+: the flip lands as a SLAM — the card swells as it turns, then squashes on the land and settles
    if (tl.slam) {
      anim(n.rvCard, [
        { transform: 'scale(1)' },
        { transform: 'scale(1.2)', offset: 0.17 },
        { transform: 'scale(1.16, 0.84)', offset: 0.42 },
        { transform: 'scale(0.95, 1.06)', offset: 0.68 },
        { transform: 'scale(1)' },
      ], { duration: tl.slam.ms, delay: tl.slam.at, easing: 'ease-out', fill: 'none' });
    }
    if (tl.screenShake) anim(n.cutShake, shakeFrames(SCREEN_SHAKE[tier] || 4), { duration: tl.screenShake.ms, delay: tl.screenShake.at, fill: 'none' });
    if (tl.flash) {
      anim(n.rvFlash, [{ opacity: 0 }, { opacity: FLASH_PEAK, offset: 0.3 }, { opacity: 0 }], { duration: tl.flash.ms, delay: tl.flash.at, easing: 'ease-out', fill: 'none' });
    }
    // the stamp ("1 IN X") and the rarity land WITH the card, never before it (the telegraph is colour only)
    if (kind === 'lite') anim(n.cutStamp, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 220, delay: tl.stampAt, easing: ease.out });
    else anim(n.cutStamp, SLAM, { duration: 460, delay: tl.stampAt, easing: 'cubic-bezier(.2,1.2,.4,1)' });
    if (full) anim(n.cutTier, SLAM, { duration: 460, delay: tl.land, easing: 'cubic-bezier(.2,1.2,.4,1)' });
    if (kind !== 'lite') later(() => sndCutStamp(tier), tl.stampAt);
    if (tier !== 'common') later(() => sndRevealArp(tier), tl.land);
    // EPIC+: the BURST — the jagged ring (tinted the rarity) + the shard pool; MYTHIC+ a second, wider ring
    if (tl.burst) {
      anim(n.rvRing0, [{ transform: 'scale(0.3)', opacity: 1 }, { transform: 'scale(1)', opacity: 1, offset: 0.55 }, { transform: 'scale(1.25)', opacity: 0 }], { duration: tl.burst.ms, delay: tl.burst.at, easing: ease.out });
      const k = burstCount(tier);
      const far = full ? 1.6 : 1.1;
      for (let i = 0; i < k; i += 1) {
        const v = VEC_BIG[i];
        anim(n[`q${i}`], [
          { opacity: 0, transform: 'translate3d(0,0,0) scale(0.5)' },
          { opacity: 1, transform: 'translate3d(0,0,0) scale(0.8)', offset: 0.01 },
          { opacity: 0, transform: `translate3d(${v.x * (far / 1.6)}px,${v.y * (far / 1.6)}px,0) scale(${v.s * far}) rotate(${v.r * 2}deg)` },
        ], { duration: (full ? 1100 : 760) + (i % 5) * 90, delay: tl.burst.at, easing: 'cubic-bezier(.15,.8,.3,1)' });
      }
      if (full) later(() => sndShardBurst(tier), tl.burst.at);
    }
    if (tl.ring2) anim(n.rvRing1, [{ transform: 'scale(0.4) rotate(0deg)', opacity: 1 }, { transform: 'scale(1.35) rotate(10deg)', opacity: 1, offset: 0.55 }, { transform: 'scale(1.7) rotate(14deg)', opacity: 0 }], { duration: tl.ring2.ms, delay: tl.ring2.at, easing: ease.out });
    // RARE+: ONE sheen pass — the wide band asset swept across the clipped face (transform only)
    const band = tl.sheen && n.cutMark ? n.cutMark.querySelector('.mc-sheen-band') : null;
    if (band) anim(band, [{ transform: 'translateX(-110%)' }, { transform: 'translateX(110%)' }], { duration: tl.sheen.ms, delay: tl.sheen.at, easing: 'cubic-bezier(.45,0,.25,1)', fill: 'none' });
    // RARE+: the pooled sparkles pop on fixed spots round the card; SECRET plays the pool twice
    if (tl.sparkles) {
      for (let i = 0; i < tl.sparkles.n; i += 1) {
        const slot = i % SPARK_POOL;
        const wave = Math.floor(i / SPARK_POOL);
        const s = SPARK_SPOTS[slot];
        anim(n[`sp${slot}`], [
          { opacity: 0, transform: `scale(0) rotate(${s.r}deg)` },
          { opacity: 1, transform: `scale(${s.s * 1.15}) rotate(${s.r + 45}deg)`, offset: 0.35 },
          { opacity: 0, transform: `scale(${s.s * 0.4}) rotate(${s.r + 90}deg)` },
        ], { duration: tl.sparkles.ms, delay: tl.sparkles.at + slot * Math.round(tl.sparkles.ms / 10) + wave * 420, easing: ease.out, fill: 'none' });
      }
    }
    // ---- the STATS EXTENSION: main slams in, extras + perk tick in ~120 ms apart, dupe ★ pips fill ----
    if (st) {
      anim(n.xMain, [
        { opacity: 0, transform: 'scale(2.1) rotate(-5deg)' },
        { opacity: 1, transform: 'scale(0.92) rotate(1deg)', offset: 0.6 },
        { opacity: 1, transform: 'scale(1) rotate(0deg)' },
      ], { duration: ext.main.ms, delay: xAt + ext.main.at, easing: ease.out });
      later(() => sndStatTick(0), xAt + ext.main.at + 120);
      ext.extras.forEach((e, i) => {
        anim(n[`xEx${i}`], [{ opacity: 0, transform: 'translateX(-16px)' }, { opacity: 1, transform: 'translateX(0)' }], { duration: e.ms, delay: xAt + e.at, easing: ease.out });
        later(() => sndStatTick(i + 1), xAt + e.at);
      });
      if (ext.perk) {
        anim(n.xPerk, [{ opacity: 0, transform: 'translateY(10px) scale(0.94)' }, { opacity: 1, transform: 'translateY(0) scale(1)' }], { duration: ext.perk.ms, delay: xAt + ext.perk.at, easing: ease.pop });
        later(() => sndStatTick(ext.extras.length + 2), xAt + ext.perk.at);
      }
      if (ext.dupe) {
        anim(n.xDupe, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: ext.dupe.ms, delay: xAt + ext.dupe.at, easing: ease.out });
        ext.stars.forEach((s, i) => {
          const newest = st.pipUp && i === ext.stars.length - 1;
          anim(n[`xStar${i}`], [
            { opacity: 0, transform: 'scale(0) rotate(-40deg)' },
            { opacity: 1, transform: `scale(${newest ? 1.7 : 1.3}) rotate(8deg)`, offset: 0.6 },
            { opacity: 1, transform: 'scale(1) rotate(0deg)' },
          ], { duration: newest ? s.ms + 120 : s.ms, delay: xAt + s.at, easing: ease.out });
        });
      }
    }
    const done = revealDoneMs(tier, ext);
    if (full) {
      // the card, the odds, the stats are all in before it asks for the tap
      anim(n.cutKeep, [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 0.35, offset: 0.45 }, { opacity: 1, offset: 0.7 }, { opacity: 0.35, offset: 0.85 }, { opacity: 1 }], { duration: 2000, delay: Math.max(KEEP_HOLD_MS, done + 150), easing: 'ease-in-out' });
    } else if (kind === 'lite' || cbs.current.auto) {
      later(finishCut, selfCloseMs(tier, ext, { auto: !!cbs.current.auto }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cutRes]);

  // ---- TAP: mid-spin → jump to the land (its reveal still plays); a reveal up → close it.
  // hard = skip everything at once (leaving for the INDEX, starting AUTO ROLL) ----
  const finish = (hard = false) => {
    if (!spin || phase.current === 'idle' || phase.current === 'done') return false;
    const wasSpin = phase.current === 'spin';
    stopAll();
    const n = nodes.current;
    if (n.dim) n.dim.style.opacity = '0';
    if (wasSpin) land(spin.result, spin.mode, hard ? { quiet: true } : { jump: true });
    else finishCut();
    return true;
  };
  const busy = () => phase.current === 'spin' || phase.current === 'landed' || phase.current === 'cut';
  if (ctl) ctl.current = { finish, busy, charge };

  useEffect(() => () => { stopAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const strip = spin ? spin.strip : idle;
  const tier = spin ? spin.result.tier : 'common';
  const cr = cutRes;
  const crm = cr ? markOf(cr.markId) : null;
  const kind = cut ? cut.kind : 'full';

  const cover = (
    <>
      <div className="rs-wash" ref={reg('wash')} aria-hidden="true" style={{ '--rs-tier': lineOf(tier) }} />
      <div className="rs-dim" ref={reg('dim')} aria-hidden="true" />
      <div
        className={`rs-cut is-${kind}${cr ? ` is-on is-${cr.tier}` : ''}`}
        ref={reg('cut')}
        aria-hidden={cr ? undefined : 'true'}
        data-testid="roll-cutscene"
        data-tier={cr ? cr.tier : undefined}
        data-kind={cr ? kind : undefined}
        style={cr ? { '--rs-tier': lineOf(cr.tier) } : undefined}
      >
        <div className="rs-cut-rays" ref={reg('cutRays')}><div className="rs-rays-ink" /></div>
        {/* SECRET's lights-down (a flat black plate over the rays) and the MYTHIC+ colour flash (over everything) */}
        <div className="rv-dim" ref={reg('rvDim')} />
        <div className="rs-cut-shake" ref={reg('cutShake')}>
          <div className="rs-cut-tier" ref={reg('cutTier')}>{cr ? tierLabel(cr.tier) : ''}</div>
          <div className="rs-cut-stamp" ref={reg('cutStamp')} data-testid="roll-cutscene-odds">
            {cr ? `1 IN ${formatNum(cr.oneInX)}` : ''}
          </div>
          <div className="rv-body">
            <div className="rs-cut-mark" ref={reg('cutMark')}>
              {/* the burst rings: the jagged ring asset as a mask, tinted the rarity (EPIC+ one, MYTHIC+ two) */}
              <span className="rv-ring" ref={reg('rvRing0')} />
              <span className="rv-ring is-2" ref={reg('rvRing1')} />
              <div className="rv-rattle" ref={reg('rvRattle')}>
                <div className="rv-card" ref={reg('rvCard')}>
                  {/* the FACE-DOWN card (asset) — its edge (a mask asset) lights in the rarity colour on a telegraph */}
                  <div className="rv-back" ref={reg('rvBack')}>
                    <img className="rv-back-art" src="/fx/card-back.svg" alt="" draggable="false" />
                    <span className="rv-edge" ref={reg('rvEdge')} />
                  </div>
                  <div className="rv-face" ref={reg('rvFace')}>
                    {cr ? (
                      <MarkCard key={cut.seq} id={cr.markId} tier={crm.tier} name={crm.name} state={view} shiny={!!cr.shiny} fx sheen className="rs-cut-card" />
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="rv-sparks">
                {SPARK_SLOTS.map((i) => (
                  <img
                    key={i}
                    className="rv-spark"
                    ref={reg(`sp${i}`)}
                    src="/fx/sparkle.svg"
                    alt=""
                    draggable="false"
                    style={{ left: `${SPARK_SPOTS[i].x}%`, top: `${SPARK_SPOTS[i].y}%` }}
                  />
                ))}
              </div>
            </div>
            {cr ? <RevealStats key={cut.seq} stats={cutStats} reg={reg} /> : null}
          </div>
          <div className="rs-cut-keep" ref={reg('cutKeep')}>TAP TO KEEP</div>
        </div>
        <div className="rv-flash" ref={reg('rvFlash')} style={cr ? { background: cr.tier === 'secret' ? '#fff' : lineOf(cr.tier) } : undefined} />
        <div className="rs-parts is-cut">
          {PARTS.map((i) => (
            <img key={i} className="rs-part" ref={reg(`q${i}`)} src={`${ART}${PARTICLE_ART[i % PARTICLE_ART.length]}`} alt="" draggable="false" />
          ))}
        </div>
      </div>
    </>
  );

  return (
    <div className="rs-shake" ref={reg('shake')} data-tier={spin ? tier : undefined}>
      <div className="rs-reel" aria-hidden="true" data-testid="roll-reel">
        <div className="rs-light" ref={reg('light')} style={{ '--rs-tier': lineOf(tier) }}><div className="rs-rays-ink" /></div>
        <div className="rs-win">
          <div className="rs-track" ref={reg('track')} style={{ transform: reelTransform(LAND_AT) }}>
            {CELLS.map((i) => {
              const id = strip ? strip[i] : null;
              const m = id ? markOf(id) : null;
              return (
                <div key={i} className="rs-slot">
                  <div
                    ref={reg(`c${i}`)}
                    className={`rs-cell${id ? '' : ' is-blank'}${i === LAND_AT ? ' is-land' : ''}`}
                    data-tier={id ? m.tier : undefined}
                    data-mark={id || undefined}
                  >
                    {m ? <MarkCard id={id} tier={m.tier} name={m.name} still /> : null}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="rs-flash" ref={reg('flash')} />
          <div className="rs-shade is-l" ref={reg('shadeL')} />
          <div className="rs-shade is-r" ref={reg('shadeR')} />
          {/* THE TELL plate: a flat tier-colour rectangle over the band, opacity pulses only (EPIC+) */}
          <div className="rs-tell" ref={reg('tell')} data-testid="roll-tell" style={{ '--rs-tier': lineOf(tier) }} />
          <Pointer ptrRef={reg('ptr')} tellRef={reg('ptrTell')} color={lineOf(tier)} />
        </div>
        <div className="rs-parts">
          {PARTS.map((i) => (
            <img key={i} className="rs-part" ref={reg(`p${i}`)} src={`${ART}${PARTICLE_ART[i % PARTICLE_ART.length]}`} alt="" draggable="false" />
          ))}
        </div>
      </div>
      {children}
      {coverHost ? createPortal(cover, coverHost) : null}
    </div>
  );
}
