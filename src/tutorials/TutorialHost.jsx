// TutorialHost.jsx — T (Andy oct2): decides WHICH unlock tutorial to show and shows it, one at a time. Lazy
// (Homepage mounts it only on a settled menu, past LV1) so none of this is in a first visit's payload.
// It never covers another overlay or a big moment: H5 — it ANNOUNCES itself on the ONE moments queue
// (lib/moments.js) at PRIORITY.TUTORIAL, the lowest, so the wall, a tier-up, a rank-up or the claim popup
// always play first, and an open panel (which holds the queue) keeps it waiting. No polling. Menu-only by
// construction — a game in progress never sees it.
import { useMemo, useState } from 'react';
import UnlockTutorial from './UnlockTutorial.jsx';
import { dueTutorial, hasSeenTutorial, markTutorialSeen, initTutorials } from './registry.js';
import { getWallTier } from '../progress/wallTier.js';
import { marksRevealed } from '../progress/marks.js';
import { isFrenzyActive } from '../progress/frenzy.js';
import { isBoostActive } from '../progress/boost.js';
import { getMyProfile } from '../leaderboard/client.js';
import { rebirthThreshold } from '../progress/xp.js';
import { pv10NoticePending } from '../progress/econMigrate.js';
import { GAMES } from '../gameData.js';
import { useMomentSlot } from '../lib/useMomentSlot.js';
import { momentOpts } from '../lib/menuMoments.js';

function snapshotFor(level, rebirths) {
  const lvOf = (id) => (GAMES.find((g) => g.id === id) || {}).unlockLevel || Infinity;
  let profile = null;
  try { profile = getMyProfile(); } catch { profile = null; }
  return {
    level,
    rebirths,
    wallTier: getWallTier(),
    marksRevealed: !!marksRevealed(),
    frenzyActive: isFrenzyActive(),
    boostActive: isBoostActive(),
    hasProfile: !!profile,
    rebirthReady: level >= rebirthThreshold(rebirths),
    chainLevel: lvOf('chain'),
    fuseLevel: lvOf('fuse'),
    pv10Notice: pv10NoticePending(),
  };
}

export default function TutorialHost({ level, rebirths }) {
  const snapshot = useMemo(() => snapshotFor(level, rebirths), [level, rebirths]);
  const [tick, setTick] = useState(0); // re-pick after one is done
  // init FIRST (synchronously, before the first pick): an existing player's already-reached features are
  // marked seen before anything can be chosen
  useState(() => initTutorials(snapshot));
  // tick re-picks after a tutorial is marked seen (the seen flags live in storage, not in state)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const due = useMemo(() => dueTutorial(snapshot, hasSeenTutorial), [snapshot, tick]);
  // its turn on the queue: one tutorial at a time, after every heavier moment (the id changes per tutorial,
  // so the next due one queues afresh once this one is marked seen)
  const opts = useMemo(() => momentOpts('tutorial', due ? `tutorial:${due.id}` : 'tutorial'), [due]);
  const [on, release] = useMomentSlot(!!due, opts);
  if (!due || !on) return null;
  return (
    <UnlockTutorial
      key={due.id}
      tutorial={due}
      snapshot={snapshot}
      onDone={() => { markTutorialSeen(due.id); release(); setTick((n) => n + 1); }}
    />
  );
}
