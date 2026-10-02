// TimerOver — R10 (Andy oct2): "FRENZY OVER" / "BOOST OVER". When a FRENZY or BOOST clock reaches 0
// while the app is open (mid-run or on the menu), the FrenzyBurst plays in reverse: the letters fly
// IN from the edges and implode at the centre, the ×N slab lands, cracks in two and falls away —
// ~1.2 s, transform/opacity only, finite. Reduced motion: the slab shows still for the same time,
// so the fact still reads. Mounted ONCE (App), position:fixed + pointer-events:none — a transient
// moment over everything, never a control (CLAUDE.md NO ORPHAN FIXED UI is about persistent UI).
//
// Timing: one setTimeout per live timer, aimed at its expiry, re-armed when a timer starts
// (TIMERS_EVENT), on focus and on storage — nothing polls at rest.
import { useEffect, useRef, useState } from 'react';
import { boostRemaining, boostMult, TIMERS_EVENT } from '../progress/boost.js';
import { frenzyRemaining, FRENZY_MULT } from '../progress/frenzy.js';
import './TimerOver.css';

const LIFE_MS = 1200;
const WORDS = { frenzy: 'FRENZYOVER'.split(''), boost: 'BOOSTOVER'.split('') };
const COLOURS = {
  frenzy: ['#FFE94A', '#FF6B3D', '#FF4FA3', '#2EFFE0'],
  boost: ['#FFE94A', '#FFE94A', '#FF6B3D', '#FFE94A'],
};

function useExpiry(remainingFn, onExpire) {
  const cb = useRef(onExpire);
  cb.current = onExpire;
  const [arm, setArm] = useState(0);
  useEffect(() => {
    const left = remainingFn();
    if (left <= 0) return undefined;
    const t = setTimeout(() => {
      if (remainingFn() <= 0) cb.current();
      else setArm((n) => n + 1); // the clock moved (extended): aim again
    }, left + 40);
    return () => clearTimeout(t);
    // remainingFn is a module function (stable)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arm]);
  useEffect(() => {
    const re = () => setArm((n) => n + 1);
    window.addEventListener(TIMERS_EVENT, re);
    window.addEventListener('focus', re);
    window.addEventListener('storage', re);
    return () => {
      window.removeEventListener(TIMERS_EVENT, re);
      window.removeEventListener('focus', re);
      window.removeEventListener('storage', re);
    };
  }, []);
}

function OverMoment({ kind, mult, onDone }) {
  const rootRef = useRef(null);
  useEffect(() => {
    const root = rootRef.current;
    const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const anims = [];
    if (root && !reduce && typeof root.animate === 'function') {
      const tiles = root.querySelectorAll('.tover-tile');
      tiles.forEach((el, i) => {
        const a = (i / tiles.length) * Math.PI * 2 + ((i * 37) % 11) / 30;
        const r = 44 + ((i * 53) % 9); // vmax: start at the edges
        const dx = Math.cos(a) * r;
        const dy = Math.sin(a) * r;
        anims.push(
          el.animate(
            [
              { transform: `translate(calc(-50% + ${dx}vmax), calc(-50% + ${dy}vmax)) rotate(${i % 2 ? 160 : -160}deg)`, opacity: 1 },
              { transform: 'translate(-50%, -50%) scale(0.9) rotate(0deg)', opacity: 1, offset: 0.55 },
              { transform: 'translate(-50%, -50%) scale(0.2) rotate(0deg)', opacity: 0 },
            ],
            { duration: 700, delay: (i % 5) * 20, easing: 'cubic-bezier(0.6, 0, 0.8, 0.4)', fill: 'forwards' }
          )
        );
      });
      root.querySelectorAll('.tover-half').forEach((el, i) => {
        const side = i === 0 ? -1 : 1;
        anims.push(
          el.animate(
            [
              { transform: 'translate(0, 0) rotate(0deg)', opacity: 0 },
              { transform: 'translate(0, 0) rotate(0deg)', opacity: 1, offset: 0.35 },
              { transform: 'translate(0, 0) rotate(0deg)', opacity: 1, offset: 0.6 },
              { transform: `translate(${side * 60}px, 140px) rotate(${side * 18}deg)`, opacity: 0 },
            ],
            { duration: LIFE_MS, easing: 'cubic-bezier(0.5, 0, 0.9, 0.5)', fill: 'forwards' }
          )
        );
      });
      const crack = root.querySelector('.tover-crack');
      if (crack) {
        anims.push(
          crack.animate(
            [
              { opacity: 0, transform: 'scaleY(0)' },
              { opacity: 0, transform: 'scaleY(0)', offset: 0.5 },
              { opacity: 1, transform: 'scaleY(1)', offset: 0.6 },
              { opacity: 0, transform: 'scaleY(1)' },
            ],
            { duration: LIFE_MS, fill: 'forwards' }
          )
        );
      }
    }
    const t = setTimeout(onDone, LIFE_MS + 60);
    return () => {
      clearTimeout(t);
      anims.forEach((x) => x.cancel());
    };
    // one-shot per mount (the caller re-keys to replay)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const title = kind === 'boost' ? 'BOOST OVER' : 'FRENZY OVER';
  const face = (
    <div className="tover-face">
      <div className="tover-title">{title}</div>
      <div className="tover-mult">×{mult} ENDED</div>
    </div>
  );
  return (
    <div className={`tover is-${kind}`} ref={rootRef} role="status" aria-label={title}>
      {WORDS[kind].map((ch, i) => (
        <span key={i} className="tover-tile" aria-hidden="true" style={{ background: COLOURS[kind][i % 4] }}>
          {ch}
        </span>
      ))}
      {/* the slab is drawn twice, each copy clipped to one half, so it can crack apart */}
      <div className="tover-slab" aria-hidden="true">
        <div className="tover-sizer">{face}</div>
        <div className="tover-half is-left">{face}</div>
        <div className="tover-half is-right">{face}</div>
        <div className="tover-crack" />
      </div>
    </div>
  );
}

export default function TimerOver() {
  const [show, setShow] = useState(null); // { kind, mult, key }
  const lastBoost = useRef(boostMult());
  useEffect(() => {
    const re = () => {
      const m = boostMult();
      if (m > 1) lastBoost.current = m;
    };
    window.addEventListener(TIMERS_EVENT, re);
    return () => window.removeEventListener(TIMERS_EVENT, re);
  }, []);
  useExpiry(frenzyRemaining, () => setShow({ kind: 'frenzy', mult: FRENZY_MULT, key: Date.now() }));
  useExpiry(boostRemaining, () => setShow({ kind: 'boost', mult: lastBoost.current > 1 ? lastBoost.current : 3, key: Date.now() }));
  if (!show) return null;
  return <OverMoment key={show.key} kind={show.kind} mult={show.mult} onDone={() => setShow(null)} />;
}
