// UnlistedSlot.jsx — THE UNLISTED stamp for the modes WITHOUT GameScreen's reaction slot (CHAIN / FUSE, SAT / FRENCH
// RUSH, RACE — oct20: every mode can find a gear now). It sits ABSOLUTELY above its host (the mode's input / typing row,
// which is position:relative) — anchored to that element, never a fixed orphan (CLAUDE.md) — and renders nothing until
// a reveal fires. The stamp itself (UnlistedStamp.jsx) loads lazily on the find, as in GameScreen.
import { lazy, Suspense } from 'react';
import { useUnlistedReveal } from './useUnlistedReveal.js';
import './UnlistedSlot.css';

const UnlistedStamp = lazy(() => import('./UnlistedStamp.jsx'));

export default function UnlistedSlot({ reduced = false }) {
  const rv = useUnlistedReveal();
  if (!rv) return null;
  return (
    <div className="uls-slot" data-testid="unlisted-slot">
      <Suspense fallback={null}><UnlistedStamp rv={rv} reduced={reduced} /></Suspense>
    </div>
  );
}
