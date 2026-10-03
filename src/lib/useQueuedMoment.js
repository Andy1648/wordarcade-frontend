// useQueuedMoment.js — a HEAVY in-game moment (FRENZY start, CLUTCH, FRENZY/BOOST OVER) played
// through the ONE moments queue (lib/moments.js), so two can never paint at once and there is a
// gap between them (next-passes-spec PASS 2 §2.3).
//
//   const [moment, play, finish] = useQueuedMoment();
//   play({ key, ...payload }, { id, priority, maxMs, expireMs });   // ask for a turn
//   {moment && <Burst key={moment.key} {...moment} onDone={finish} />} // render while it is ours
//
// `moment` is the payload while this moment holds the queue, else null. `finish` releases the queue
// (the component's onDone). Unmounting cancels anything still queued and releases a playing one, so
// leaving a game can never jam the queue (maxMs is the queue's own backstop for a lost callback).
import { useCallback, useEffect, useRef, useState } from 'react';
import { moments } from './moments';

export function useQueuedMoment(queue = moments) {
  const [moment, setMoment] = useState(null);
  const doneRef = useRef(null);
  const cancelsRef = useRef(new Set());
  const aliveRef = useRef(true);

  const play = useCallback(
    (payload, { id, priority, maxMs, expireMs } = {}) => {
      let cancel = null;
      cancel = queue.announce({
        id,
        priority,
        maxMs,
        expireMs,
        onExpire: () => cancelsRef.current.delete(cancel),
        start(done) {
          if (!aliveRef.current) {
            done();
            return;
          }
          doneRef.current = () => {
            cancelsRef.current.delete(cancel);
            done();
          };
          setMoment(payload);
        },
      });
      cancelsRef.current.add(cancel);
    },
    [queue]
  );

  const finish = useCallback(() => {
    const d = doneRef.current;
    doneRef.current = null;
    setMoment(null);
    if (d) d();
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    const cancels = cancelsRef.current;
    return () => {
      aliveRef.current = false;
      cancels.forEach((c) => {
        try {
          if (c) c();
        } catch {
          /* already released */
        }
      });
      cancels.clear();
    };
  }, []);

  return [moment, play, finish];
}
