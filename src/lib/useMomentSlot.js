// useMomentSlot.js — H5: a MENU moment that renders while it holds the ONE moments queue (lib/moments.js).
//
//   const [on, done] = useMomentSlot(want, momentOpts('claim-pop'));
//   if (!on) return null;           // not its turn yet (or nothing to show)
//   …render the moment; call done() when it has finished playing
//
// `want` = this moment has something to show. While true it holds a place in the queue; when its turn comes
// `on` turns true. done() releases the queue. If `want` goes false, or the component unmounts, a queued
// moment is dropped and a playing one released — leaving the menu can never jam the queue. An
// `interruptible` moment that a higher-priority one pushes aside hides (on=false) and queues itself again,
// so it comes back after. A new `id` (the next tutorial) queues afresh.
//
// useMomentHold(active): a panel/overlay holds the queue while it is up — nothing new starts under it.
import { useCallback, useEffect, useRef, useState } from 'react';
import { moments } from './moments';

export function useMomentSlot(want, opts, queue = moments) {
  const [on, setOn] = useState(false);
  const [epoch, setEpoch] = useState(0); // bumped by an interrupt → queue again
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const doneRef = useRef(null);
  const id = opts && opts.id;
  useEffect(() => {
    if (!want) return undefined;
    let alive = true;
    const o = optsRef.current || {};
    const cancel = queue.announce({
      id: o.id,
      priority: o.priority,
      maxMs: o.maxMs,
      interruptible: !!o.interruptible,
      start(done) {
        if (!alive) {
          done();
          return;
        }
        doneRef.current = done;
        setOn(true);
      },
      onInterrupt() {
        doneRef.current = null;
        if (!alive) return;
        setOn(false);
        setEpoch((n) => n + 1);
      },
    });
    return () => {
      alive = false;
      doneRef.current = null;
      setOn(false);
      cancel();
    };
  }, [want, id, epoch, queue]);
  const done = useCallback(() => {
    const d = doneRef.current;
    doneRef.current = null;
    setOn(false);
    if (d) d();
  }, []);
  return [!!want && on, done];
}

export function useMomentHold(active, queue = moments) {
  useEffect(() => {
    if (!active) return undefined;
    return queue.hold();
  }, [active, queue]);
}
