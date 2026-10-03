// UnlockTutorial.jsx — T (Andy oct2): the ONE shared unlock tutorial. A big-type card, 1–3 steps, NEXT / GOT IT,
// SKIP on every step. A step may point at the thing it names: a ring is drawn round that element (measured
// ONCE when the step shows, never per frame). Menu-only (Homepage mounts it), so it can never block a game.
// Motion: one finite pop per step (transform/opacity); reduced motion shows the same card still.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './UnlockTutorial.css';

export default function UnlockTutorial({ tutorial, snapshot, onDone }) {
  const [i, setI] = useState(0);
  const [ring, setRing] = useState(null);
  const btnRef = useRef(null);
  const step = tutorial.steps[Math.min(i, tutorial.steps.length - 1)];
  const last = i >= tutorial.steps.length - 1;

  useLayoutEffect(() => {
    setRing(null);
    if (!step.target) return;
    const el = [...document.querySelectorAll(step.target)].find((n) => n.getBoundingClientRect().width > 0);
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRing({ left: r.left - 8, top: r.top - 8, width: r.width + 16, height: r.height + 16 });
  }, [i, step.target]);

  useEffect(() => {
    try { btnRef.current && btnRef.current.focus({ preventScroll: true }); } catch { /* */ }
    const onKey = (e) => { if (e.key === 'Escape') onDone(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [i, onDone]);

  const sub = typeof step.sub === 'function' ? step.sub(snapshot || {}) : step.sub;
  return createPortal(
    <div className="ut-overlay" role="dialog" aria-modal="true" aria-label={`${step.title} — tutorial`} data-tut={tutorial.id}>
      {ring && <div className="ut-ring" style={ring} aria-hidden="true" />}
      <div className="ut-card" key={i}>
        {tutorial.steps.length > 1 && (
          <div className="ut-steps" aria-hidden="true">
            {tutorial.steps.map((_, n) => <span key={n} className={`ut-dot${n === i ? ' is-on' : ''}`} />)}
          </div>
        )}
        <div className="ut-title">{step.title}</div>
        <div className="ut-line">{step.line}</div>
        {sub && <div className="ut-sub">{sub}</div>}
        <div className="ut-actions">
          <button type="button" className="ut-skip" onClick={onDone}>SKIP</button>
          <button type="button" className="ut-next" ref={btnRef} onClick={() => (last ? onDone() : setI((n) => n + 1))}>
            {last ? 'GOT IT' : 'NEXT'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
