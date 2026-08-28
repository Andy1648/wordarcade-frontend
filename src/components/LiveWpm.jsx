// LiveWpm.jsx — the HUD typing-speed readout, shared by every mode + the menu. It reads the
// live tracker (wpmLive) on a 250ms interval and writes its own text node directly, so the
// number refreshes at most ~4×/sec (never jitters) and never re-renders its parent. Purely a
// readout — it owns no game state.
import { useEffect, useRef } from 'react';
import { wpmCurrent } from '../progress/wpmLive';
import './LiveWpm.css';

export default function LiveWpm({ active = true, hideZero = false, className = '' }) {
  const numRef = useRef(null);
  const wrapRef = useRef(null);
  useEffect(() => {
    if (!active) return undefined;
    const tick = () => {
      const el = numRef.current;
      if (!el) return;
      const v = wpmCurrent();
      el.textContent = String(v);
      // hideZero: keep the readout out of the way until the player has actually typed (menu).
      if (wrapRef.current) wrapRef.current.style.visibility = hideZero && v <= 0 ? 'hidden' : 'visible';
    };
    tick();
    const id = setInterval(tick, 250); // ≤4×/sec
    return () => clearInterval(id);
  }, [active, hideZero]);
  return (
    <span ref={wrapRef} className={`live-wpm${className ? ' ' + className : ''}`} aria-hidden="true">
      <b ref={numRef}>0</b>
      <span className="live-wpm-unit">WPM</span>
    </span>
  );
}
