// TransitionOverlay.jsx — the ONE screen-change transition (Job 12). A single directional wipe
// panel, TRANSFORM + OPACITY only, <=240ms, fired over every view change (the screen has already
// swapped underneath — this is purely cosmetic, position:fixed, pointer-events:none, so it can
// never gate which screen is shown). Direction encodes the nav sense:
//   forward (menu -> deeper: a mode, a dialog, the game) — the panel sweeps in from the RIGHT,
//   back    (returning to the menu)                       — the panel sweeps in from the LEFT.
// The small word keeps the app's character but is opacity-only. One enter + one exit, one language.
//
// WILL-CHANGE (fix/willchange-gate): the panel and the word used to carry `will-change` in CSS.
// A static declaration promotes the layer for as long as the rule matches, which the budget in
// CLAUDE.md forbids ("must NEVER sit on an idle / pooled / always-present node ... toggle it ON
// for the life of the animation and OFF at rest"). Here the hint is genuinely wanted — both nodes
// animate for their whole (short) mounted life — so it is applied from JS on mount and cleared
// the moment the animation ends, which is the shape the rule asks for.
import { useEffect, useRef } from 'react';
import './TransitionOverlay.css';

export default function TransitionOverlay({ word, dir = 'forward' }) {
  const rootRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const nodes = [...root.querySelectorAll('.transition-panel, .transition-word')];
    // Promote for the wipe...
    for (const el of nodes) el.style.willChange = 'transform, opacity';
    // ...and drop the layer as soon as it is done. `animationend` bubbles, so one listener on the
    // root covers both children; the fallback timer matters because a node whose animation never
    // fires (reduced-motion shortens it to 1ms, a dropped frame, an interrupted unmount) must not
    // be left promoted.
    const clear = () => { for (const el of nodes) el.style.willChange = ''; };
    root.addEventListener('animationend', clear);
    const t = window.setTimeout(clear, 600);
    return () => {
      root.removeEventListener('animationend', clear);
      window.clearTimeout(t);
      clear();
    };
  }, [word, dir]);

  return (
    <div className="transition-overlay" data-dir={dir} aria-hidden="true" ref={rootRef}>
      <div className="transition-panel" />
      {word && <div className="transition-word">{word}</div>}
    </div>
  );
}
