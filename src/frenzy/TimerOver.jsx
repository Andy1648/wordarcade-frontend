// TimerOver — R10 (Andy oct2): "FRENZY OVER" / "BOOST OVER". When a FRENZY or BOOST clock reaches 0
// while the app is open (mid-run or on the menu), the FrenzyBurst plays in reverse: the letters fly
// IN from the edges and implode at the centre, the ×N slab lands, cracks in two and falls away —
// ~1.2 s, transform/opacity only, finite. Reduced motion: the slab shows still for the same time,
// so the fact still reads. Mounted ONCE (App), position:fixed + pointer-events:none — a transient
// moment over everything, never a control (CLAUDE.md NO ORPHAN FIXED UI is about persistent UI).
//
// Timing: one setTimeout per live timer, aimed at its expiry, re-armed when a timer starts
// (TIMERS_EVENT), on focus and on storage — nothing polls at rest.
import { Suspense, useEffect, useRef, useState } from 'react';
import { lazyWithReload } from '../lib/chunkReload';
import { boostRemaining, boostMult, TIMERS_EVENT } from '../progress/boost.js';
import { frenzyRemaining, FRENZY_MULT } from '../progress/frenzy.js';
// the moment (and its CSS) is a lazy chunk — it only loads when a FRENZY / BOOST clock actually ends
const OverMoment = lazyWithReload(() => import('./TimerOverMoment.jsx'), 'TimerOverMoment');

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
  return (
    <Suspense fallback={null}>
      <OverMoment key={show.key} kind={show.kind} mult={show.mult} onDone={() => setShow(null)} />
    </Suspense>
  );
}
