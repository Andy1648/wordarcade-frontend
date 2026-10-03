// useCountUp — the React face of src/juice/countUp.js (THE one count-up). Returns the number to
// show, the gain since the current chain began (for a big "+amount" beside it), whether a count is
// in flight, and whether the "+amount" should still be on screen (the count + a short hold).
// A new `target` mid-count retargets the same count (no stacking); a drop and reduced motion are
// instant. Re-renders once per frame only WHILE counting; nothing runs at rest.
import { useEffect, useRef, useState } from 'react';
import { createCountUp } from '../juice/countUp';

/**
 * @param {number} target
 * @param {object} [opts]
 * @param {number} [opts.from]  the first render's starting number (default: target → no count on
 *                              mount; pass 0 to count up from nothing on mount)
 * @param {number} [opts.minMs] / [opts.maxMs] / [opts.fixedMs]  see createCountUp
 * @param {number} [opts.holdMs=0]  keep `showGain` true this long after the count lands
 * @param {boolean} [opts.enabled=true]  false = always instant
 * @returns {{ shown: number, gain: number, counting: boolean, showGain: boolean, chain: number }}
 *   `chain` increments when a NEW chain starts — key the "+amount" node on it so it pops in once
 *   per chain, not once per retarget.
 */
export function useCountUp(target, { from, minMs, maxMs, fixedMs, holdMs = 0, enabled = true } = {}) {
  const start = Number.isFinite(from) ? from : Number.isFinite(target) ? target : 0;
  const [state, setState] = useState({ shown: start, gain: 0, counting: false, showGain: false, chain: 0 });
  const ctlRef = useRef(null);
  const holdRef = useRef(0);
  const chainRef = useRef(0);
  if (ctlRef.current === null) {
    ctlRef.current = createCountUp({
      initial: start,
      minMs,
      maxMs,
      fixedMs,
      onFrame: (shown, gain) => {
        if (holdRef.current) {
          clearTimeout(holdRef.current);
          holdRef.current = 0;
        }
        setState({ shown, gain, counting: true, showGain: gain > 0, chain: chainRef.current });
      },
      onDone: (value, gain) => {
        setState({ shown: value, gain, counting: false, showGain: gain > 0 && holdMs > 0, chain: chainRef.current });
        if (gain > 0 && holdMs > 0) {
          if (holdRef.current) clearTimeout(holdRef.current);
          holdRef.current = setTimeout(() => {
            holdRef.current = 0;
            setState((s) => ({ ...s, showGain: false }));
          }, holdMs);
        }
      },
    });
  }
  useEffect(() => {
    const c = ctlRef.current;
    if (!Number.isFinite(target)) return;
    if (!enabled) {
      c.set(target);
      return;
    }
    if (!c.running && target > c.value) chainRef.current += 1; // a fresh chain begins
    c.to(target);
  }, [target, enabled]);
  useEffect(
    () => () => {
      if (ctlRef.current) ctlRef.current.cancel();
      if (holdRef.current) clearTimeout(holdRef.current);
    },
    []
  );
  return state;
}
