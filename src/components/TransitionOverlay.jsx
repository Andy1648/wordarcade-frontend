// TransitionOverlay.jsx — the ONE pooled screen-change wipe. Mounted ONCE by App (never keyed, never
// remounted); lib/navWipe.js replays this same node through WAAPI for every major navigation: every
// `view` change (shop / stats / leaderboard / daily blitz / the games …) and the menu's own sheets
// (GEARS / ROLL, CONTRACTS, REWARDS, PROFILE). Purely cosmetic: position:fixed, pointer-events:none,
// laid over a screen that has ALREADY swapped — it can never gate which screen is shown.
// LOOK = the ORIGINAL (pre-#514) wipe, restored (Andy oct25 "not as clean as the original one"): ONE
// full-screen purple→pink→orange panel sweeping across in 240ms, the white Bungee word riding the cover peak.
//   forward (menu -> deeper) — the panel sweeps in from the LEFT and clears to the right;
//   back    (returning)      — mirrored, right→left.
import { useEffect, useRef } from 'react';
import { registerWipe } from '../lib/navWipe';
import './TransitionOverlay.css';

export default function TransitionOverlay() {
  const root = useRef(null);
  const panel = useRef(null);
  const word = useRef(null);
  useEffect(() => registerWipe({ root: root.current, panel: panel.current, word: word.current }), []);
  return (
    <div ref={root} className="transition-overlay" data-state="idle" data-dir="forward" aria-hidden="true">
      <div ref={panel} className="transition-panel" />
      <div ref={word} className="transition-word" />
    </div>
  );
}
