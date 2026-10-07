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
import { boostRemaining, codeBoostMult, TIMERS_EVENT } from '../progress/boost.js';
import { isOverdriveActive, OVERDRIVE_MULT, OVERDRIVE_MIN } from '../progress/overdrive.js';
import { formatNum } from '../format.js';
import { frenzyRemaining, FRENZY_MULT } from '../progress/frenzy.js';
import { useQueuedMoment } from '../lib/useQueuedMoment';
import { GAME_PRIORITY } from '../lib/moments';
// SEASON 2 — THE ONE-NOTICE RULE (Andy oct6): no centre moments for timers (OVERDRIVE START, BOOST / FRENZY OVER). The
// edge pill (BoostPill → OverdrivePill) carries every timer. OFF = unchanged.
import { SEASON2 } from '../progress/season.js';
// the moment (and its CSS) is a lazy chunk — it only loads when a FRENZY / BOOST clock actually ends
const OverMoment = lazyWithReload(() => import('./TimerOverMoment.jsx'), 'TimerOverMoment');
// Rebirth Rush OVERDRIVE START: the FUSE FRENZY blast, re-titled — also a lazy chunk, loaded only when one starts
const StartBurst = lazyWithReload(() => import('./FrenzyBurst.jsx'), 'FrenzyBurst');

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
  return SEASON2 ? null : <TimerOverLive />;
}

function TimerOverLive() {
  // FEEL LADDER (PASS 2): the OVER moment no longer mounts on its own over whatever is playing — it
  // asks the ONE moments queue for a turn (lib/moments.js), behind a running FRENZY / CLUTCH burst,
  // with the queue's gap between. A turn that cannot come within 5s is dropped (stale), not late.
  const [show, play, finish] = useQueuedMoment(); // { kind, mult, key } while it holds the queue
  const setShow = (m) =>
    play(m, { id: `timer-over-${m.kind}-${m.key}`, priority: GAME_PRIORITY.TIMER_OVER, maxMs: 1800, expireMs: 5000 });
  // the CODE boost's ×N (boostMult() now folds OVERDRIVE in — a BOOST OVER must not say ×30)
  const lastBoost = useRef(codeBoostMult());
  useEffect(() => {
    const re = () => {
      const m = codeBoostMult();
      if (m > 1) lastBoost.current = m;
    };
    window.addEventListener(TIMERS_EVENT, re);
    return () => window.removeEventListener(TIMERS_EVENT, re);
  }, []);
  // OVERDRIVE START (Andy: "Big obvious banner + timer"): when OVERDRIVE flips on while the app is open — in a
  // game or on the menu, it is rolled by the letter flush and announced on TIMERS_EVENT — the FRENZY blast
  // plays once with the OVERDRIVE slab, through the same queue at FRENZY_START priority (the biggest game
  // moment). The pill (BoostPill → OverdrivePill) then carries the timer. A reload mid-OVERDRIVE does not
  // replay it: only an inactive → active edge seen by this mount counts.
  const odWas = useRef(isOverdriveActive());
  useEffect(() => {
    const re = () => {
      const on = isOverdriveActive();
      if (on && !odWas.current) {
        const key = Date.now();
        play({ kind: 'overdrive-start', key }, { id: `overdrive-start-${key}`, priority: GAME_PRIORITY.FRENZY_START, maxMs: 2400, expireMs: 8000 });
      }
      odWas.current = on;
    };
    window.addEventListener(TIMERS_EVENT, re);
    window.addEventListener('storage', re);
    return () => {
      window.removeEventListener(TIMERS_EVENT, re);
      window.removeEventListener('storage', re);
    };
  }, [play]);
  useExpiry(frenzyRemaining, () => setShow({ kind: 'frenzy', mult: FRENZY_MULT, key: Date.now() }));
  useExpiry(boostRemaining, () => setShow({ kind: 'boost', mult: lastBoost.current > 1 ? lastBoost.current : 3, key: Date.now() }));
  if (!show) return null;
  if (show.kind === 'overdrive-start') {
    return (
      <Suspense fallback={null}>
        <StartBurst
          key={show.key}
          variant="overdrive"
          title="OVERDRIVE"
          line={`×${formatNum(OVERDRIVE_MULT)} XP & WINS · ${OVERDRIVE_MIN} MIN`}
          onDone={finish}
        />
      </Suspense>
    );
  }
  return (
    <Suspense fallback={null}>
      <OverMoment key={show.key} kind={show.kind} mult={show.mult} onDone={finish} />
    </Suspense>
  );
}
