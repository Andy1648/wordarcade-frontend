// SpotlightTutorial.jsx — the ONE tutorial style (Andy oct5): "screen dims, the one target glows, tap anywhere
// to continue. No OK-button popups." A dim wash with a bright hole cut round the target, a glow ring on the
// hole's edge, one short line beside it. Tap ANYWHERE (or Escape / Enter) and it is done - and a tap ON the lit target
// is a real tap on it (nov3: the GEARS tip ate the first tap on the very tile it pointed at, so a new player had to tap
// GEARS twice): the hole lets clicks through to the target, which finishes the tip as it opens.
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


// A line fitted into a `clear` band never goes under this (Bungee on a plate; the phone 16px floor + a margin)
const FIT_MIN_PX = 18;

export default function SpotlightTutorial({ tutorial, onDone }) {
  const [layout, setLayout] = useState(null);
  const [fitPx, setFitPx] = useState(null); // the fitted font size (px) when the line had to shrink into its band
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
  // A tutorial with a `clear` selector keeps its line OFF that content (the ROLL screen's reel): the line lives in the
  // band between it and the hole, and when the band is shorter than the line the font steps down (to FIT_MIN_PX) until
  // it fits — a handful of synchronous reads, on show and on resize only.
  useLayoutEffect(() => {
    const measure = () => {
      const vw = window.innerWidth, vh = window.innerHeight;
      const el = findTarget(tutorial.target);
      const r = el ? el.getBoundingClientRect() : null;
      const clearEl = tutorial.clear ? findTarget(tutorial.clear) : null;
      const clearBottom = clearEl ? clearEl.getBoundingClientRect().bottom : null;
      const line = lineRef.current;
      let fit = null;
      let capH = 0;
      if (line) {
        line.style.fontSize = ''; // natural size first (a resize may have room again)
        line.classList.remove('is-fit');
        capH = line.offsetHeight;
        const room = spotlightLayout(r, vw, vh, capH, tutorial.pad, clearBottom).caption.room;
        if (room != null && capH > room) {
          line.classList.add('is-fit');
          let lo = FIT_MIN_PX;
          let hi = parseFloat(getComputedStyle(line).fontSize) || FIT_MIN_PX;
          for (let i = 0; i < 8 && hi - lo > 0.5; i += 1) {
            const mid = (lo + hi) / 2;
            line.style.fontSize = `${mid}px`;
            if (line.offsetHeight <= room) lo = mid; else hi = mid;
          }
          fit = Math.floor(lo);
          line.style.fontSize = `${fit}px`;
          capH = line.offsetHeight;
        }
        // leave the DOM exactly as the next render will draw it (React diffs props, not the DOM: an unchanged fitPx
        // after a resize would never re-apply a size cleared here)
        line.style.fontSize = fit ? `${fit}px` : '';
        if (fit == null) line.classList.remove('is-fit');
      }
      setFitPx(fit);
      setLayout(spotlightLayout(r, vw, vh, capH, tutorial.pad, clearBottom));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [tutorial.target, tutorial.pad, tutorial.clear]);

  // focus in, and back out to whatever had it
  useEffect(() => {
    const prev = document.activeElement;
    rootRef.current?.focus({ preventScroll: true });
    return () => {
      try { if (prev && prev.focus && document.contains(prev)) prev.focus({ preventScroll: true }); } catch { /* gone */ }
    };
  }, []);

  // A tap ON the lit target goes through to it (the hole has no catcher) - and finishes the tip on its way (capture, so
  // the tip is done before the target's own handler runs; nothing is prevented)
  useEffect(() => {
    const onClick = (e) => {
      const el = findTarget(tutorial.target);
      if (el && e.target instanceof Node && el.contains(e.target)) finish();
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [tutorial.target, finish]);

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
  const lineStyle = cap && cap.top != null ? { top: `${cap.top}px`, ...(fitPx ? { fontSize: `${fitPx}px` } : null) } : null;
  // the tap CATCHERS: four strips round the hole take "tap anywhere" - the hole itself catches nothing, so the target
  // under it gets its own tap
  const catchers = hole ? [
    { left: 0, top: 0, width: '100vw', height: `${Math.max(0, hole.top)}px` },
    { left: 0, top: `${hole.top + hole.height}px`, width: '100vw', bottom: 0 },
    { left: 0, top: `${hole.top}px`, width: `${Math.max(0, hole.left)}px`, height: `${hole.height}px` },
    { left: `${hole.left + hole.width}px`, top: `${hole.top}px`, right: 0, height: `${hole.height}px` },
  ] : [];

  // onClick (not pointerdown): a tap on a catcher / the line / the dim lands on this layer and finishes the tip, so it can
  // never fall through to a button underneath once the layer is gone (only the lit target is meant to get its tap)
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
          {catchers.map((c, i) => <div key={i} className="ut-catch" style={c} aria-hidden="true" />)}
        </>
      ) : (
        <div className="ut-dim" aria-hidden="true" />
      )}
      <div ref={lineRef} className={`ut-line${lineStyle ? '' : ' is-centered'}${fitPx ? ' is-fit' : ''}`} style={lineStyle || undefined} aria-live="polite">
        {tutorial.line}
      </div>
    </div>,
    document.body,
  );
}
