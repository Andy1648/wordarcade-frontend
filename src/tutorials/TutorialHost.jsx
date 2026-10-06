// TutorialHost.jsx — decides WHICH menu tutorial to show and shows it, one at a time, as a spotlight
// (SpotlightTutorial). Lazy (Homepage mounts it only on a settled menu, past LV1) so none of this is in a
// first visit's payload. It never covers another overlay or a big moment: H5 — it ANNOUNCES itself on the ONE
// moments queue (lib/moments.js) at PRIORITY.TUTORIAL, the lowest, so the wall, a tier-up, a rank-up or the
// claim popup always play first, and an open panel (which holds the queue) keeps it waiting. No polling.
// Menu-only by construction — a game in progress never sees it. (MARKS and SHOP host their own.)
import { useEffect, useMemo, useState } from 'react';
import SpotlightTutorial from './SpotlightTutorial.jsx';
import { dueTutorial, hasSeenTutorial, markTutorialSeen, initTutorials } from './registry.js';
import { hasVisibleTarget } from './spotlightLayout.js';
import { marksRevealed } from '../progress/marks.js';
import { rebirthThreshold } from '../progress/xp.js';
import { useMomentSlot } from '../lib/useMomentSlot.js';
import { momentOpts } from '../lib/menuMoments.js';
import { SEASON2, V3 } from '../progress/season.js'; // P7: V3.toast = the kit's right-edge toast (v3 chunk)

// P7 POPUP PURGE (SEASON2 only): "unlocks = edge toasts". A due menu tutorial is said ONCE as a right-edge toast
// (KitEdgeToast, hosted by the menu's S2Notify) instead of a screen-dimming spotlight; it is marked seen the same way.
// (Season-2 copy: a rebirth is ×2 there, so the live "×5" line is not reused.) Flag OFF: the spotlight, unchanged.
const S2_TIP = {
  rebirth: { head: 'READY', code: '×2', label: 'REBIRTH', icon: 'rebirth', tile: '#FF3D7F' },
  gems: { head: 'NEW', label: 'GEMS PAY FOR ROLLS', icon: 'gems', tile: '#2EFFE0' },
};

function snapshotFor(level, rebirths) {
  return {
    level,
    rebirths,
    marksRevealed: !!marksRevealed(),
    rebirthReady: level >= rebirthThreshold(rebirths),
  };
}

export default function TutorialHost({ level, rebirths }) {
  const snapshot = useMemo(() => snapshotFor(level, rebirths), [level, rebirths]);
  const [tick, setTick] = useState(0); // re-pick after one is done
  // init FIRST (synchronously, before the first pick): an existing player's already-reached features are
  // marked seen before anything can be chosen
  useState(() => initTutorials(snapshot));
  // tick re-picks after a tutorial is marked seen (the seen flags live in storage, not in state). A
  // `needsTarget` tutorial (gems) is only picked when its target is on screen — one DOM query per pick.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const due = useMemo(() => dueTutorial(snapshot, hasSeenTutorial, hasVisibleTarget), [snapshot, tick]);
  // its turn on the queue: one tutorial at a time, after every heavier moment (the id changes per tutorial,
  // so the next due one queues afresh once this one is marked seen)
  const opts = useMemo(() => momentOpts('tutorial', due ? `tutorial:${due.id}` : 'tutorial'), [due]);
  const [on, release] = useMomentSlot(!!due, opts);
  useEffect(() => {
    if (!SEASON2 || !due || !on) return;
    V3.toast(S2_TIP[due.id] || { head: 'NEW', label: due.line, icon: 'levels', tile: '#FFE94A' });
    markTutorialSeen(due.id);
    release();
    setTick((n) => n + 1);
  }, [due, on, release]);
  if (SEASON2 || !due || !on) return null;
  return (
    <SpotlightTutorial
      key={due.id}
      tutorial={due}
      onDone={() => { markTutorialSeen(due.id); release(); setTick((n) => n + 1); }}
    />
  );
}
