// Reel.jsx — the ROLL screen's reel + every land effect (Andy oct5). A FIXED POOL of nodes mounted once with the
// screen: REEL_LEN cells (each a mark in its rarity fill), the rarity light, BURST_POOL particles, and — portalled
// INTO the ROLL overlay (a layer of that overlay, never its own fixed element) — the screen dim and the LEGENDARY+
// cutscene with its own particle pool.
//
// THREE FEELS behind ?rsv= (reelPlan.reelVersion): a = a horizontal case strip, b = a vertical slot reel, c = an arc
// carousel (a big wheel whose top arc shows through the window). All three play the same reelPlan numbers.
//
// RULES (CLAUDE.md ANIMATION BUDGET): ONE rAF loop while the reel spins, writes only (transform strings in % / deg —
// nothing is measured, ever); every other effect is a finite WAAPI one-shot on transform/opacity; will-change is ON
// only while a node animates and cleared when it stops; nothing loops. Every non-rectangle shape is an asset
// (/art/rolls/rays.svg as a tinted mask, /art/rolls/{shard,spark,blob}.svg particles).
// REDUCED MOTION: mode 'none' — no spin, no shake, no burst: the reel sits on the result and the card shows at once.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import MarkBadge from '../MarkBadge';
import { MARK_TIERS } from '../../progress/marks';
import { markEntry, rollMarkById } from '../../progress/markRolls';
import { rarityClass } from '../../lib/rarityStyle.js';
import { sndReelTick, sndRollSting } from '../../audio/gameSounds';
import { formatNum } from '../../format';
import {
  REEL_LEN, LAND_AT, BURST_POOL, CUTSCENE_MS, spinMs, easePow, spinFrom, reelPos, tierIndex, hasCutscene, dimFor,
  hasLight, burstCount, shakePx, shakeFrames, burstVectors,
} from './reelPlan.js';

const ART = '/art/rolls/';
const PARTICLE_ART = ['shard.svg', 'spark.svg', 'blob.svg'];
const CELLS = Array.from({ length: REEL_LEN }, (_, i) => i);
const PARTS = Array.from({ length: BURST_POOL }, (_, i) => i);
const VEC = burstVectors(BURST_POOL);
const VEC_BIG = burstVectors(BURST_POOL, 2.6);
const ARC_STEP = 8; // c: degrees between cells on the wheel
const tierName = (t) => (MARK_TIERS[t] ? MARK_TIERS[t].name : String(t || '').toUpperCase());
const tierOfId = (id) => (rollMarkById(id) || {}).tier || 'common';
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** The transform string for a reel position (cells) — pure writes, per version. */
export function reelTransform(version, p) {
  if (version === 'b') return `translate3d(0,${(-(p / REEL_LEN) * 100).toFixed(4)}%,0)`;
  if (version === 'c') return `rotate(${(-p * ARC_STEP).toFixed(3)}deg)`;
  return `translate3d(${(-(p / REEL_LEN) * 100).toFixed(4)}%,0,0)`;
}

export default function Reel({ version = 'a', spin, idle = null, coverHost, ctl, onLand, onDone, children }) {
  const nodes = useRef({});
  const anims = useRef([]);
  const raf = useRef(0);
  const timers = useRef([]);
  const phase = useRef('idle'); // idle | spin (rAF) | landed (land effects) | cut (LEGENDARY+ cutscene) | done
  const cbs = useRef({});
  cbs.current = { onLand, onDone };
  const [cut, setCut] = useState(null); // the LEGENDARY+ result whose cutscene is up
  const reg = (name) => (el) => { if (el) nodes.current[name] = el; };

  const anim = (el, frames, opts) => {
    if (!el || typeof el.animate !== 'function') return null;
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
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = 0;
    clearTimers();
    for (const a of anims.current) { try { a.cancel(); } catch { /* gone */ } }
    anims.current = [];
    for (const el of Object.values(nodes.current)) if (el && el.style) el.style.willChange = '';
  };
  const place = (p) => {
    const tr = nodes.current.track;
    if (tr) tr.style.transform = reelTransform(version, p);
  };

  // ---- the land: sting, shake, light, burst; the cutscene for LEGENDARY+ ----
  const land = (res, mode, quiet = false) => {
    phase.current = 'landed';
    place(LAND_AT);
    const tier = res.tier;
    sndRollSting(tier);
    cbs.current.onLand && cbs.current.onLand(res);
    if (quiet || mode === 'none') { finishCut(); return; }
    const n = nodes.current;
    const px = shakePx(tier, mode);
    if (px > 0) anim(n.shake, shakeFrames(px), { duration: 220 + px * 18 });
    const cell = n[`c${LAND_AT}`];
    anim(cell, [{ transform: 'scale(1)' }, { transform: 'scale(1.22)', offset: 0.35 }, { transform: 'scale(1.08)' }], { duration: 320, easing: 'cubic-bezier(.2,1.4,.4,1)' });
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
    if (hasCutscene(tier, mode)) {
      phase.current = 'cut';
      setCut(res);
      return; // the cutscene effect plays + ends it
    }
    // the dim lifts once the card has landed
    const d = dimFor(tier, mode);
    if (d > 0) anim(n.dim, [{ opacity: d }, { opacity: 0 }], { duration: 700, delay: 900 });
    later(finishCut, mode === 'short' ? 60 : 420);
  };
  function finishCut() {
    if (phase.current === 'done' || phase.current === 'idle') return;
    phase.current = 'done';
    setCut(null);
    cbs.current.onDone && cbs.current.onDone();
  }

  // ---- PLAY a spin (layout effect: the first frame is the frame the tap paints) ----
  useLayoutEffect(() => {
    if (!spin || !spin.seq) return undefined;
    stopAll();
    setCut(null);
    const { result: res, mode, strip } = spin;
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
    const ranks = strip.map((id) => tierIndex(tierOfId(id)));
    phase.current = 'spin';
    place(from);
    if (n.track) n.track.style.willChange = 'transform';
    const d = dimFor(res.tier, mode);
    // rarer = the screen darkens through the slowdown (the last half of the spin)
    if (d > 0) anim(n.dim, [{ opacity: 0 }, { opacity: d }], { duration: dur * 0.5, delay: dur * 0.5, easing: 'ease-in' });
    const t0 = now();
    let lastCell = Math.floor(from + 0.5);
    const frame = (ts) => {
      const t = (Number.isFinite(ts) ? ts : now()) - t0;
      const p = reelPos(t, { dur, pow, from, land: LAND_AT });
      place(p);
      const c = Math.floor(p + 0.5);
      if (c !== lastCell) {
        lastCell = c;
        sndReelTick(ranks[c] || 0);
      }
      if (t >= dur) {
        raf.current = 0;
        if (n.track) n.track.style.willChange = '';
        land(res, mode);
        return;
      }
      raf.current = requestAnimationFrame(frame);
    };
    raf.current = requestAnimationFrame(frame);
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spin && spin.seq]);

  // ---- the CUTSCENE (LEGENDARY+): plate, rays, the mark, its name and "1 IN X" huge, a big burst ----
  useLayoutEffect(() => {
    if (!cut) return;
    const n = nodes.current;
    const hold = CUTSCENE_MS[cut.tier] || CUTSCENE_MS.legendary;
    anim(n.cut, [{ opacity: 0 }, { opacity: 1, offset: 0.06 }, { opacity: 1, offset: 0.9 }, { opacity: 0 }], { duration: hold });
    anim(n.cutRays, [{ transform: 'scale(0.5) rotate(0deg)', opacity: 0 }, { transform: 'scale(1) rotate(10deg)', opacity: 1, offset: 0.15 }, { transform: 'scale(1.15) rotate(50deg)', opacity: 0.6 }], { duration: hold, easing: 'cubic-bezier(.2,.7,.3,1)' });
    anim(n.cutMark, [{ transform: 'scale(0.2)', opacity: 0 }, { transform: 'scale(1.15)', opacity: 1, offset: 0.12 }, { transform: 'scale(1)', opacity: 1, offset: 0.2 }, { transform: 'scale(1)', opacity: 1 }], { duration: hold, easing: 'cubic-bezier(.2,1.2,.4,1)' });
    anim(n.cutStamp, [{ transform: 'scale(2.4)', opacity: 0 }, { transform: 'scale(2.4)', opacity: 0, offset: 0.2 }, { transform: 'scale(0.94)', opacity: 1, offset: 0.3 }, { transform: 'scale(1)', opacity: 1 }], { duration: hold, easing: 'cubic-bezier(.3,1.3,.5,1)' });
    anim(n.cutShake, shakeFrames(shakePx(cut.tier)), { duration: 420, delay: hold * 0.24 });
    const k = burstCount(cut.tier);
    for (let i = 0; i < k; i += 1) {
      const v = VEC_BIG[i];
      anim(n[`q${i}`], [
        { opacity: 0, transform: 'translate3d(0,0,0) scale(0.5)' },
        { opacity: 1, transform: 'translate3d(0,0,0) scale(0.8)', offset: 0.01 },
        { opacity: 0, transform: `translate3d(${v.x}px,${v.y}px,0) scale(${v.s * 1.6}) rotate(${v.r * 2}deg)` },
      ], { duration: 1100 + (i % 5) * 90, delay: hold * 0.24, easing: 'cubic-bezier(.15,.8,.3,1)' });
    }
    anim(n.dim, [{ opacity: dimFor(cut.tier) }, { opacity: dimFor(cut.tier), offset: 0.85 }, { opacity: 0 }], { duration: hold + 500 });
    later(finishCut, hold);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cut]);

  // ---- TAP: jump straight to the result (the card), whatever is playing ----
  const finish = () => {
    if (!spin || phase.current === 'idle' || phase.current === 'done') return false;
    const wasSpin = phase.current === 'spin';
    stopAll();
    const n = nodes.current;
    if (n.dim) n.dim.style.opacity = '0';
    if (n.track) n.track.style.willChange = '';
    if (wasSpin) land(spin.result, spin.mode, true);
    else finishCut();
    return true;
  };
  const busy = () => phase.current === 'spin' || phase.current === 'landed' || phase.current === 'cut';
  if (ctl) ctl.current = { finish, busy };

  useEffect(() => () => { stopAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const strip = spin ? spin.strip : idle;
  const tier = spin ? spin.result.tier : 'common';
  const cutMark = cut ? markEntry(cut.markId) : null;

  const cover = (
    <>
      <div className="rs-dim" ref={reg('dim')} aria-hidden="true" />
      <div className={`rs-cut is-${cut ? cut.tier : 'none'}${cut ? ' is-on' : ''}`} ref={reg('cut')} aria-hidden={cut ? undefined : 'true'} data-testid="roll-cutscene" data-tier={cut ? cut.tier : undefined}>
        <div className={`rs-cut-wash ${rarityClass(cut ? cut.tier : 'legendary')}`} />
        <div className="rs-cut-rays" ref={reg('cutRays')} style={cut ? { '--rs-tier': (MARK_TIERS[cut.tier] || {}).colour } : undefined}><div className="rs-rays-ink" /></div>
        <div className="rs-cut-shake" ref={reg('cutShake')}>
          <div className="rs-cut-mark" ref={reg('cutMark')}>
            <MarkBadge mark={cutMark} size={180} className="rs-cut-art" />
            <div className={`rs-cut-name rarity-ink is-${cut ? cut.tier : 'legendary'}`}>{cutMark ? cutMark.name : ''}</div>
            <div className="rs-cut-tier">{cut ? tierName(cut.tier) : ''}</div>
          </div>
          <div className={`rs-cut-stamp rarity-ink is-${cut ? cut.tier : 'legendary'}`} ref={reg('cutStamp')} data-testid="roll-cutscene-odds">
            {cut ? `1 IN ${formatNum(cut.oneInX)}` : ''}
          </div>
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
    <div className="rs-shake" ref={reg('shake')} data-v={version} data-tier={spin ? tier : undefined}>
      <div className={`rs-reel is-${version}`} aria-hidden="true" data-testid="roll-reel">
        <div className="rs-light" ref={reg('light')} style={{ '--rs-tier': (MARK_TIERS[tier] || {}).colour }}><div className="rs-rays-ink" /></div>
        <div className="rs-win">
          <div className="rs-track" ref={reg('track')} style={{ transform: reelTransform(version, LAND_AT) }}>
            {CELLS.map((i) => {
              const id = strip ? strip[i] : null;
              const t = id ? tierOfId(id) : 'common';
              const m = id ? markEntry(id) : null;
              return (
                <div key={i} className="rs-slot" style={version === 'c' ? { '--rs-a': `${i * ARC_STEP}deg` } : undefined}>
                  <div
                    ref={reg(`c${i}`)}
                    className={`rs-cell ${rarityClass(t)}${id ? '' : ' is-blank'}${i === LAND_AT ? ' is-land' : ''}`}
                    data-tier={id ? t : undefined}
                  >
                    <MarkBadge mark={m} locked={!m} size={64} className="rs-cell-art" />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="rs-line" />
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
