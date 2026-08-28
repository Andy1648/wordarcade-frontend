// TransitionOverlay.jsx — the ONE screen-change transition (Job 12). A single directional wipe
// panel, TRANSFORM + OPACITY only, <=240ms, fired over every view change (the screen has already
// swapped underneath — this is purely cosmetic, position:fixed, pointer-events:none, so it can
// never gate which screen is shown). Direction encodes the nav sense:
//   forward (menu -> deeper: a mode, a dialog, the game) — the panel sweeps in from the RIGHT,
//   back    (returning to the menu)                       — the panel sweeps in from the LEFT.
// The small word keeps the app's character but is opacity-only. One enter + one exit, one language.
import './TransitionOverlay.css';

export default function TransitionOverlay({ word, dir = 'forward' }) {
  return (
    <div className="transition-overlay" data-dir={dir} aria-hidden="true">
      <div className="transition-panel" />
      {word && <div className="transition-word">{word}</div>}
    </div>
  );
}
