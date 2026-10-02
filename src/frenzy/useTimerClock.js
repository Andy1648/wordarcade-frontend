// useTimerClock — a live countdown for a wall-clock timer (BOOST, FRENZY) on any surface. A 1 Hz
// interval runs ONLY while the timer is live and is re-armed when one starts (TIMERS_EVENT), on focus
// and on storage events — so nothing ticks at rest. Not an animation: it re-renders a number.
import { useEffect, useState } from 'react';
import { TIMERS_EVENT } from '../progress/boost.js';

export function useTimerClock(remainingFn) {
  const [ms, setMs] = useState(() => remainingFn());
  const [arm, setArm] = useState(0);
  useEffect(() => {
    if (remainingFn() <= 0) {
      setMs(0);
      return undefined;
    }
    setMs(remainingFn());
    const id = setInterval(() => {
      const left = remainingFn();
      setMs(left);
      if (left <= 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
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
  return { ms, active: ms > 0 };
}
