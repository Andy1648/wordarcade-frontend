// RouteFallback.jsx — the Suspense fallback for the main screen router (game/room/lobby/
// browse/credits/solo/sat). It renders NOTHING for the first `delay` ms, then a minimal
// centered "LOADING…" panel.
//
// Why delayed: on the common path the route chunk is idle-prefetched and resolves in well
// under `delay`, and the screen-wipe overlay already covers the swap — so the fallback stays
// null and behavior is byte-identical to the old `fallback={null}`. The loader appears ONLY
// when a genuinely cold/slow chunk fetch outlasts the wipe, where the old code showed a blank.
//
// Budget: static only. No infinite/idle animation (house rule + the build-failing perf test) —
// a spinner would loop forever, so this is a still label. transform/opacity untouched.
import { useEffect, useState } from 'react';
import './RouteFallback.css';

export default function RouteFallback({ delay = 450 }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setShow(true), delay);
    return () => window.clearTimeout(t);
  }, [delay]);

  if (!show) return null;
  return (
    <div className="route-fallback" role="status" aria-busy="true" aria-label="Loading">
      <span className="route-fallback-label">LOADING…</span>
    </div>
  );
}
