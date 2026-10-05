// Reel.jsx — the ROLL screen's reel + every land effect (ROLL v1, Andy oct5 mockup claude/mockups/roll-v1/Main.dc.html).
// A FIXED POOL of nodes mounted once with the screen: REEL_LEN cells (each a full MarkCard), the pointer, the rarity
// light, BURST_POOL particles, and — portalled INTO the ROLL overlay (a layer of that overlay, never its own fixed
// element) — the slowdown dim and the REVEAL layer with its own particle pool.
//
// THE STRIP: a full-width band of cards that bleeds to the screen edges, a yellow pointer through the middle. The
// reel rests at a random spot INSIDE the result cell, then settles to centre (reelPlan.restOffset). On the land the
// other cards fade back so the result stands alone.
// RARITY-SCALED REVEALS (reelPlan.revealKind): COMMON / RARE → the result LINE under the reel (RollScreen);
// EPIC → the DIM reveal ("1 IN X" slams, the card pops); LEGENDARY+ → the FULL reveal (rays, the rarity, "1 IN X"
// huge, the card, a shake). DIM / FULL stay up until a tap ("TAP TO KEEP"); under AUTO ROLL the dim closes itself.
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
import { sndReelTick, sndRollSting, sndRollSwell, sndCutStamp } from '../../audio/rollSounds';
import { formatNum } from '../../format';
import {
  REEL_LEN, LAND_AT, BURST_POOL, DIM_CELLS, AUTO_DIM_MS, RAYS_MS, spinMs, easePow, spinFrom, reelPos, timeAt, tickTimes,
  tierIndex, revealKind, dimFor, hasLight, burstCount, shakePx, shakeFrames, burstVectors,
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
const POP = [
  { transform: 'scale(0.2) rotate(-8deg)', opacity: 0 },
  { transform: 'scale(1.12) rotate(2deg)', opacity: 1, offset: 0.6 },
  { transform: 'scale(1) rotate(0deg)', opacity: 1 },
];
const SLAM = [
  { transform: 'scale(3)', opacity: 0 },
  { transform: 'scale(0.92)', opacity: 1, offset: 0.7 },
  { transform: 'scale(1)', opacity: 1 },
];

/** The transform string for a reel position (cells) — pure writes. */
export function reelTransform(p) {
  return `translate3d(${(-(p / REEL_LEN) * 100).toFixed(4)}%,0,0)`;
}

/** The pointer: a plain bar (CSS) between two triangles (inline vector art — a triangle is not a rectangle). */
function Pointer() {
  return (
    <div className="rs-ptr" aria-hidden="true">
      <svg className="rs-ptr-tri is-top" width="44" height="30" viewBox="0 0 44 30"><path d="M2 2 L42 2 L22 28 Z" fill="#FFE94A" stroke="#000" strokeWidth="4" strokeLinejoin="round" /></svg>
      <span className="rs-ptr-bar" />
      <svg className="rs-ptr-tri is-bot" width="44" height="30" viewBox="0 0 44 30"><path d="M2 28 L42 28 L22 2 Z" fill="#FFE94A" stroke="#000" strokeWidth="4" strokeLinejoin="round" /></svg>
    </div>
  );
}

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
    const k = burstCount(tier, mode);
    for (let i = 0; i < k; i += 1) {
      const v = VEC[i];
      anim(n[`p${i}`], [
        { opacity: 1, transform: 'translate3d(0,0,0) scale(0.4) rotate(0deg)' },
        { opacity: 0, transform: `translate3d(${v.x}px,${v.y}px,0) scale(${v.s}) rotate(${v.r}deg)` },
      ], { duration: 650 + (i % 4) * 60, easing: 'cubic-bezier(.15,.8,.3,1)' });
    }
    const kind = revealKind(tier, mode);
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
    }
    const first = Math.ceil(from + 0.5);
    tickTimes({ dur, pow, from, land: goal }).forEach((t, i) => later(() => sndReelTick(ranks[first + i] || 0), t));
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

  // ---- the REVEAL (EPIC dim / LEGENDARY+ full): plays in once, then rests until a tap ----
  const cutRes = cut && cut.res;
  useLayoutEffect(() => {
    if (!cutRes) return;
    const n = nodes.current;
    const tier = cutRes.tier;
    const full = cut.kind === 'full';
    anim(n.cut, [{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
    anim(n.dim, [{ opacity: dimFor(tier) }, { opacity: 0 }], { duration: 250 }); // the reveal brings its own backdrop
    anim(n.cutStamp, SLAM, { duration: 500, delay: full ? 80 : 0, easing: 'cubic-bezier(.2,1.2,.4,1)' });
    anim(n.cutMark, POP, { duration: 550, delay: full ? 160 : 60, easing: 'cubic-bezier(.2,1.4,.4,1)' });
    later(() => sndCutStamp(tier), full ? 80 : 0);
    if (full) {
      anim(n.cutRays, [
        { transform: 'rotate(0deg) scale(0.6)', opacity: 0 },
        { transform: 'rotate(8deg) scale(1)', opacity: 0.32, offset: 0.1 },
        { transform: 'rotate(60deg) scale(1)', opacity: 0.32 },
      ], { duration: RAYS_MS, easing: 'cubic-bezier(.2,.6,.3,1)' });
      anim(n.cutTier, SLAM, { duration: 500, easing: 'cubic-bezier(.2,1.2,.4,1)' });
      anim(n.cutShake, shakeFrames(shakePx(tier)), { duration: 400, delay: 120, iterations: 2 });
      anim(n.cutKeep, [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 0.35, offset: 0.45 }, { opacity: 1, offset: 0.7 }, { opacity: 0.35, offset: 0.85 }, { opacity: 1 }], { duration: 2000, delay: 700, easing: 'ease-in-out' });
      const k = burstCount(tier);
      for (let i = 0; i < k; i += 1) {
        const v = VEC_BIG[i];
        anim(n[`q${i}`], [
          { opacity: 0, transform: 'translate3d(0,0,0) scale(0.5)' },
          { opacity: 1, transform: 'translate3d(0,0,0) scale(0.8)', offset: 0.01 },
          { opacity: 0, transform: `translate3d(${v.x}px,${v.y}px,0) scale(${v.s * 1.6}) rotate(${v.r * 2}deg)` },
        ], { duration: 1100 + (i % 5) * 90, delay: 160, easing: 'cubic-bezier(.15,.8,.3,1)' });
      }
    } else if (cbs.current.auto) {
      later(finishCut, AUTO_DIM_MS);
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
  if (ctl) ctl.current = { finish, busy };

  useEffect(() => () => { stopAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const strip = spin ? spin.strip : idle;
  const tier = spin ? spin.result.tier : 'common';
  const cr = cutRes;
  const crm = cr ? markOf(cr.markId) : null;
  const kind = cut ? cut.kind : 'full';

  const cover = (
    <>
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
        <div className="rs-cut-shake" ref={reg('cutShake')}>
          <div className="rs-cut-tier" ref={reg('cutTier')}>{cr ? tierLabel(cr.tier) : ''}</div>
          <div className="rs-cut-stamp" ref={reg('cutStamp')} data-testid="roll-cutscene-odds">
            {cr ? `1 IN ${formatNum(cr.oneInX)}` : ''}
          </div>
          <div className="rs-cut-mark" ref={reg('cutMark')}>
            {cr ? (
              <MarkCard key={cut.seq} id={cr.markId} tier={crm.tier} name={crm.name} state={view} shiny={!!cr.shiny} fx className="rs-cut-card" />
            ) : null}
          </div>
          <div className="rs-cut-keep" ref={reg('cutKeep')}>TAP TO KEEP</div>
        </div>
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
          <div className="rs-shade is-l" ref={reg('shadeL')} />
          <div className="rs-shade is-r" ref={reg('shadeR')} />
          <Pointer />
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
