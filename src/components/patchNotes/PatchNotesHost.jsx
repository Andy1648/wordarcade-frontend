// PatchNotesHost.jsx — LAZY (Homepage loads it only while this release is unseen): decides WHEN the lazy PatchNotes popup shows. Once per release
// (patchNotesData PATCH_ID), EVERY player (Andy oct12 — a first-timer once the menu spotlight is done), after the intro knife-split has opened (SLICE_WAIT_MS after the menu's first mount this page load), on
// its turn in the ONE menu moments queue (never over a rank-up / wall / claim).
import { lazy, Suspense, useEffect, useState } from 'react';
import { useMomentSlot } from '../../lib/useMomentSlot';
import { momentOpts } from '../../lib/menuMoments';
import { patchSeen } from './patchSeen.js';

const PatchNotes = lazy(() => import('./PatchNotes.jsx'));
const SLICE_WAIT_MS = 2600; // KnifeSplit ≈ 2.0 s slash + hold + open (its own safety net is 2.5 s)
const OPTS = momentOpts('patch');
let waited = false; // the knife-split only plays on the first menu of a page load

export default function PatchNotesHost({ blocked }) {
  const [due, setDue] = useState(() => !patchSeen());
  const [ready, setReady] = useState(waited);
  useEffect(() => {
    if (ready || !due) return undefined;
    const t = setTimeout(() => { waited = true; setReady(true); }, SLICE_WAIT_MS);
    return () => clearTimeout(t);
  }, [ready, due]);
  const [on, done] = useMomentSlot(due && ready && !blocked, OPTS);
  if (!on) return null;
  return (
    <Suspense fallback={null}>
      <PatchNotes onClose={() => { setDue(false); done(); }} />
    </Suspense>
  );
}
