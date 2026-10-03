// TutorialHost.jsx — T (Andy oct2): decides WHICH unlock tutorial to show and shows it, one at a time. Lazy
// (Homepage mounts it only on a settled menu, past LV1) so none of this is in a first visit's payload.
// It never covers another overlay or the wall moment: it waits (a 1s check, not per-frame) until the menu
// is clear. Menu-only by construction — a game in progress never sees it.
import { useEffect, useMemo, useState } from 'react';
import UnlockTutorial from './UnlockTutorial.jsx';
import { dueTutorial, hasSeenTutorial, markTutorialSeen, initTutorials } from './registry.js';
import { getWallTier } from '../progress/wallTier.js';
import { marksRevealed } from '../progress/marks.js';
import { isFrenzyActive } from '../progress/frenzy.js';
import { isBoostActive } from '../progress/boost.js';
import { getMyProfile } from '../leaderboard/client.js';
import { rebirthThreshold } from '../progress/xp.js';
import { GAMES } from '../gameData.js';

const BUSY = '.stats-panel, .shop-panel, .lb-body, .claims-panel, .claim-pop, .mode-dialog-shell, .mx-panel, .lp-panel, .rank-ladder, .sticker-overlay, .wall-stamp';

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
  };
}

export default function TutorialHost({ level, rebirths }) {
  const snapshot = useMemo(() => snapshotFor(level, rebirths), [level, rebirths]);
  const [tick, setTick] = useState(0); // re-pick after one is done
  const [clear, setClear] = useState(false);
  // init FIRST (synchronously, before the first pick): an existing player's already-reached features are
  // marked seen before anything can be chosen
  useState(() => initTutorials(snapshot));
  // tick re-picks after a tutorial is marked seen (the seen flags live in storage, not in state)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const due = useMemo(() => dueTutorial(snapshot, hasSeenTutorial), [snapshot, tick]);
  useEffect(() => {
    if (!due) return undefined;
    const busy = () => document.documentElement.hasAttribute('data-wallfx') || !!document.querySelector(BUSY);
    setClear(!busy());
    const t = setInterval(() => setClear(!busy()), 1000);
    return () => clearInterval(t);
  }, [due]);
  if (!due || !clear) return null;
  return (
    <UnlockTutorial
      key={due.id}
      tutorial={due}
      snapshot={snapshot}
      onDone={() => { markTutorialSeen(due.id); setTick((n) => n + 1); }}
    />
  );
}
