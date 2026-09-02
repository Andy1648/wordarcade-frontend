// Spotlight.jsx — a ONE-STEP first-run coach mark (fix/logic-and-onboarding).
//
// Dims the screen, cuts a bright hole over one target element, and shows a single caption.
// Dismissed by the FIRST keystroke or pointer-down anywhere. Deliberately built so it can
// NEVER block that first input:
//   • the whole overlay is pointer-events:none — clicks/taps pass straight through to the app
//   • the dismiss listeners never call preventDefault/stopPropagation — the key/tap still
//     reaches the app (so the first keystroke both dismisses the coach mark AND counts)
//   • it never takes focus, so a game input keeps the caret
// It is a pure presentation layer: it reads/measures, it never gates app state.
//
// Props:
//   targetSelector : CSS selector of the element to spotlight (measured on mount + resize)
//   caption        : the single line of coach copy (the mode rule, or "TYPE OR CLICK ANYWHERE")
//   sub            : optional smaller line under the caption
//   onDismiss      : called once, on the first key/pointer (caller persists the "seen" flag)
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import './Spotlight.css';

const PAD = 8; // breathing room around the target inside the bright hole

export default function Spotlight({ targetSelector, caption, sub, onDismiss }) {
  const [rect, setRect] = useState(null); // {left,top,width,height} of the target, or null
  const doneRef = useRef(false);

  // Measure the target (and re-measure on resize / next frame so a just-mounted layout settles).
  useLayoutEffect(() => {
    let raf = 0;
    const measure = () => {
      const el = targetSelector ? document.querySelector(targetSelector) : null;
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({ left: r.left, top: r.top, width: r.width, height: r.height });
    };
    measure();
    raf = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
    };
  }, [targetSelector]);

  // Dismiss on the FIRST key/pointer — without ever swallowing it (no preventDefault).
  useEffect(() => {
    const fire = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      onDismiss?.();
    };
    // capture:true so we hear it even if the app stops propagation later; passive so we
    // physically cannot preventDefault (the input is never blocked).
    window.addEventListener('keydown', fire, { capture: true, passive: true });
    window.addEventListener('pointerdown', fire, { capture: true, passive: true });
    return () => {
      window.removeEventListener('keydown', fire, { capture: true });
      window.removeEventListener('pointerdown', fire, { capture: true });
    };
  }, [onDismiss]);

  // Place the caption above the target when the target sits in the lower half, else below.
  const below = rect ? rect.top + rect.height / 2 < window.innerHeight / 2 : true;
  const holeStyle = rect
    ? {
        left: `${rect.left - PAD}px`,
        top: `${rect.top - PAD}px`,
        width: `${rect.width + PAD * 2}px`,
        height: `${rect.height + PAD * 2}px`,
      }
    : null;
  const capStyle = rect
    ? below
      ? { top: `${rect.top + rect.height + PAD + 14}px` }
      : { bottom: `${window.innerHeight - rect.top + PAD + 14}px` }
    : {}; // no target → caption centres via CSS

  return (
    <div className="spotlight-overlay" aria-hidden="true">
      {holeStyle ? (
        <div className="spotlight-hole" style={holeStyle} />
      ) : (
        <div className="spotlight-dim" />
      )}
      <div className={`spotlight-caption${rect ? '' : ' is-centered'}`} style={capStyle}>
        <span className="spotlight-caption-text">{caption}</span>
        {sub && <span className="spotlight-caption-sub">{sub}</span>}
      </div>
    </div>
  );
}
