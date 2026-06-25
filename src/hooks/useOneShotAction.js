// useOneShotAction.js
// One reusable guard for one-shot, server-acked buttons (rematch, reroll, set
// difficulty, add/remove bot, start/play-again). It gives every such button two
// guarantees:
//
//   1. Fires EXACTLY once per click burst. A ref-backed pending flag blocks
//      repeat clicks SYNCHRONOUSLY — the `pending` state lags a render, so the
//      ref (not the state value) is what actually swallows a fast double-tap.
//
//   2. ALWAYS recovers — it can never get permanently stuck. The button
//      re-enables the moment `resetSignal` changes. `resetSignal` MUST be a fresh
//      monotonic value (a counter/id App bumps on every server response OR error),
//      NOT a string that can repeat: the whole point is that an IDENTICAL repeated
//      error still re-enables, because the counter moved even though the error
//      string did not. (Gating re-enable on string inequality is the classic
//      stuck-button bug — same string in → no state change → no re-render → never
//      re-enabled.) A safety timeout (`ms`) is the hard backstop, so even a
//      dropped or duplicated ack can't strand the button.
//
// Usage:  const [pending, fire] = useOneShotAction(serverEventId);
//         <button disabled={pending} onClick={() => fire(() => doThing())}>
import { useEffect, useRef, useState } from 'react';

export function useOneShotAction(resetSignal, ms = 4000) {
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false); // synchronous mirror of `pending`
  const timerRef = useRef(null);
  const aliveRef = useRef(true);

  // Keep the ref and the state in lockstep so reads are synchronous but the UI
  // still re-renders (for the disabled/pending visual).
  const set = (v) => {
    pendingRef.current = v;
    setPending(v);
  };

  function fire(action) {
    if (pendingRef.current) return; // already in flight — swallow the repeat
    set(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (aliveRef.current) set(false);
    }, ms);
    action();
  }

  // Re-enable on the next server event. Both a success ack and an error bump the
  // counter, so this fires in either case — including a repeated identical error.
  // The mount run is a harmless no-op (pending already false).
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    set(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal]);

  useEffect(
    () => () => {
      aliveRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  return [pending, fire];
}
