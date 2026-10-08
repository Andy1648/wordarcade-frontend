// BoostDockMount — the EAGER gate in front of the (lazy) BOOST DOCK.
//
// App.jsx renders the dock on every screen, so a static import put BoostDock.jsx + BoostDock.css straight into
// the homepage's initial payload — and tripped the ratchet (e2e/payload-budget.spec.js: 977,079 > 975,000). A
// cold visitor has no boost running, so none of that markup can be on screen: the dock is worth exactly 0 bytes
// to them.
//
// This file is the only eager part. It watches the one clock (anyTimerRemaining — liveTimers.js imports nothing
// that is not already eager) and imports the dock itself only once a timer is actually live. No boost, no chunk.
import { lazy, Suspense } from 'react';
import { anyTimerRemaining } from '../progress/anyTimer';
import { useTimerClock } from './useTimerClock';

const BoostDock = lazy(() => import('./BoostDock.jsx'));

export default function BoostDockMount(props) {
  const { active } = useTimerClock(anyTimerRemaining);
  if (!active) return null;
  return (
    <Suspense fallback={null}>
      <BoostDock {...props} />
    </Suspense>
  );
}
