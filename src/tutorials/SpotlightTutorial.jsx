// SpotlightTutorial.jsx — the ONE tutorial style (Andy oct5): "screen dims, the one target glows, tap anywhere
// to continue. No OK-button popups." A dim wash with a bright hole cut round the target, a glow ring on the
// hole's edge, one short line beside it. Tap ANYWHERE (or Escape / Enter) and it is done.
//
// Measurement: the target's rect + the line's height are read ONCE when it shows and again only on resize
// (never per frame); the geometry itself is the pure spotlightLayout(). Motion: one finite fade-in of the
// layer + one ring settle (opacity/transform only, no loops); reduced motion shows it still.
// Hosted by the moments queue (TutorialHost) or by the panel that owns the target (MARKS, SHOP), portalled to
// <body> like the tutorial card it replaces so a panel's own transform can never misplace the fixed hole.
// A11y: a labelled dialog; focus moves onto it when it shows and back to where it was when it goes; the line
// is in an aria-live region.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { spotlightLayout, findVisibleTarget as findTarget } from './spotlightLayout.js';
import './SpotlightTutorial.css';


export default function SpotlightTutorial({ tutorial, onDone }) {
  const [layout, setLayout] = useState(null);
  const rootRef = useRef(null);
  const lineRef = useRef(null);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone; // the parent's onDone is a fresh arrow each render — never an effect dep
  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDoneRef.current?.();
  }, []);

  // measure once on show + on resize only
  useLayoutEffect(() => {
    const measure = () => {
      const el = findTarget(tutorial.target);
      const r = el ? el.getBoundingClientRect() : null;
      const capH = lineRef.current ? lineRef.current.offsetHeight : 0;
      setLayout(spotlightLayout(r, window.innerWidth, window.innerHeight, capH));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [tutorial.target]);

  // focus in, and back out to whatever had it
  useEffect(() => {
    const prev = document.activeElement;
    rootRef.current?.focus({ preventScroll: true });
    return () => {
      try { if (prev && prev.focus && document.contains(prev)) prev.focus({ preventScroll: true }); } catch { /* gone */ }
    };
  }, []);

  // Escape / Enter finish it. Capture + stop so the panel underneath (MARKS / SHOP close on Escape) never sees it.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape' && e.key !== 'Enter') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      finish();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [finish]);

  const hole = layout && layout.hole;
  const cap = layout ? layout.caption : null;
  const holeStyle = hole ? { left: `${hole.left}px`, top: `${hole.top}px`, width: `${hole.width}px`, height: `${hole.height}px` } : null;
  const lineStyle = cap && cap.top != null ? { top: `${cap.top}px` } : null;

  // onClick (not pointerdown): the tap's click lands on this layer, so it can never fall through to the
  // button underneath once the layer is gone
  return createPortal(
    <div
      ref={rootRef}
      className="ut-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`Tip: ${tutorial.line}`}
      tabIndex={-1}
      data-tut={tutorial.id}
      onClick={finish}
    >
      {holeStyle ? (
        <>
          <div className="ut-hole" style={holeStyle} aria-hidden="true" />
          <div className="ut-ring" style={holeStyle} aria-hidden="true" />
        </>
      ) : (
        <div className="ut-dim" aria-hidden="true" />
      )}
      <div ref={lineRef} className={`ut-line${lineStyle ? '' : ' is-centered'}`} style={lineStyle || undefined} aria-live="polite">
        {tutorial.line}
        <span className="ut-tap" aria-hidden="true">TAP ANYWHERE</span>
      </div>
    </div>,
    document.body,
  );
}
