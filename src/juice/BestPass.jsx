// BestPass.jsx — JUICE P3 (BEST CHASE): the moment a run passes your personal best. The painted trophy
// (/results/trophy.webp) drops onto a painted burst (/fx/burst-win.webp) with a NEW BEST plate under it, holds, and
// lifts away — one shot, ~1.2 s, once per run.
//
// Budget (CLAUDE.md): art is the two painted assets; motion is WAAPI transform/opacity only, every animation finite,
// three nodes created once per mount (the caller re-keys to replay), no layout reads. pointer-events:none, positioned
// by its parent (never its own fixed coordinates). Reduced motion: shows still for the same time.
import { useEffect, useRef, useState } from 'react';
import { reduceMotion } from '../lib/reduceMotion';
import { sndLucky } from '../audio/gameSounds.js';
import './BestPass.css';

const LIFE_MS = 1250;

export default function BestPass({ label = 'NEW BEST', sub = null, sound = true }) {
  const rootRef = useRef(null);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    const root = rootRef.current;
    const anims = [];
    if (sound) {
      try { sndLucky(); } catch { /* audio blocked */ }
    }
    if (root && !reduceMotion() && typeof root.animate === 'function') {
      const play = (sel, frames, opts) => {
        const el = root.querySelector(sel);
        if (!el) return;
        el.style.willChange = 'transform, opacity';
        const a = el.animate(frames, { fill: 'both', ...opts });
        a.onfinish = () => { el.style.willChange = ''; };
        anims.push(a);
      };
      // the burst opens behind, one quarter turn, and fades with the rest
      play('.bp-burst', [
        { transform: 'scale(0.2) rotate(-30deg)', opacity: 0 },
        { transform: 'scale(1.15) rotate(0deg)', opacity: 1, offset: 0.2 },
        { transform: 'scale(1) rotate(8deg)', opacity: 1, offset: 0.8 },
        { transform: 'scale(1.1) rotate(12deg)', opacity: 0 },
      ], { duration: LIFE_MS, easing: 'cubic-bezier(.2,.9,.3,1)' });
      // the trophy DROPS and squashes from its base (natural landing, not a spin)
      play('.bp-trophy', [
        { transform: 'translateY(-120%) scale(0.9, 1.1)', opacity: 0 },
        { transform: 'translateY(0) scale(1.18, 0.8)', opacity: 1, offset: 0.16 },
        { transform: 'translateY(-6%) scale(0.94, 1.08)', opacity: 1, offset: 0.26 },
        { transform: 'translateY(0) scale(1, 1)', opacity: 1, offset: 0.36 },
        { transform: 'translateY(0) scale(1, 1)', opacity: 1, offset: 0.8 },
        { transform: 'translateY(-30%) scale(0.9)', opacity: 0 },
      ], { duration: LIFE_MS, easing: 'ease-out' });
      play('.bp-plate', [
        { transform: 'translateX(-50%) scale(2.2) rotate(-6deg)', opacity: 0 },
        { transform: 'translateX(-50%) scale(0.94) rotate(-3deg)', opacity: 1, offset: 0.24 },
        { transform: 'translateX(-50%) scale(1) rotate(-3deg)', opacity: 1, offset: 0.32 },
        { transform: 'translateX(-50%) scale(1) rotate(-3deg)', opacity: 1, offset: 0.8 },
        { transform: 'translateX(-50%) translateY(-20px) scale(1) rotate(-3deg)', opacity: 0 },
      ], { duration: LIFE_MS, easing: 'ease-out' });
    }
    const t = setTimeout(() => setGone(true), LIFE_MS + 60);
    return () => {
      clearTimeout(t);
      anims.forEach((a) => a.cancel());
    };
    // one shot per mount: the caller re-keys to replay
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (gone) return null;
  return (
    <div className="bp" ref={rootRef} aria-hidden="true" data-testid="best-pass">
      <img className="bp-burst" src="/fx/burst-win.webp" width="256" height="256" alt="" draggable="false" />
      <img className="bp-trophy" src="/results/trophy.webp" width="256" height="256" alt="" draggable="false" />
      <div className="bp-plate">
        <span className="bp-label">{label}</span>
        {sub ? <span className="bp-sub">{sub}</span> : null}
      </div>
    </div>
  );
}
