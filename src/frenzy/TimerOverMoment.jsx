// TimerOverMoment — the FRENZY OVER / BOOST OVER moment itself (see TimerOver.jsx). Split out (G3) so the
// ~3KB of choreography + its CSS load only when a timer actually ends, not in every page's first payload.
import { useEffect, useRef } from 'react';
import './TimerOver.css';
import { reduceMotion } from '../lib/reduceMotion';

const LIFE_MS = 1200;
const WORDS = { frenzy: 'FRENZYOVER'.split(''), boost: 'BOOSTOVER'.split('') };
const COLOURS = {
  frenzy: ['#FFE94A', '#FF6B3D', '#FF4FA3', '#2EFFE0'],
  boost: ['#FFE94A', '#FFE94A', '#FF6B3D', '#FFE94A'],
};

export default function OverMoment({ kind, mult, onDone }) {
  const rootRef = useRef(null);
  useEffect(() => {
    const root = rootRef.current;
    const reduce = reduceMotion();
    const anims = [];
    if (root && !reduce && typeof root.animate === 'function') {
      const tiles = root.querySelectorAll('.tover-tile');
      tiles.forEach((el, i) => {
        const a = (i / tiles.length) * Math.PI * 2 + ((i * 37) % 11) / 30;
        const r = 44 + ((i * 53) % 9); // vmax: start at the edges
        const dx = Math.cos(a) * r;
        const dy = Math.sin(a) * r;
        anims.push(
          el.animate(
            [
              { transform: `translate(calc(-50% + ${dx}vmax), calc(-50% + ${dy}vmax)) rotate(${i % 2 ? 160 : -160}deg)`, opacity: 1 },
              { transform: 'translate(-50%, -50%) scale(0.9) rotate(0deg)', opacity: 1, offset: 0.55 },
              { transform: 'translate(-50%, -50%) scale(0.2) rotate(0deg)', opacity: 0 },
            ],
            { duration: 700, delay: (i % 5) * 20, easing: 'cubic-bezier(0.6, 0, 0.8, 0.4)', fill: 'forwards' }
          )
        );
      });
      root.querySelectorAll('.tover-half').forEach((el, i) => {
        const side = i === 0 ? -1 : 1;
        anims.push(
          el.animate(
            [
              { transform: 'translate(0, 0) rotate(0deg)', opacity: 0 },
              { transform: 'translate(0, 0) rotate(0deg)', opacity: 1, offset: 0.35 },
              { transform: 'translate(0, 0) rotate(0deg)', opacity: 1, offset: 0.6 },
              { transform: `translate(${side * 60}px, 140px) rotate(${side * 18}deg)`, opacity: 0 },
            ],
            { duration: LIFE_MS, easing: 'cubic-bezier(0.5, 0, 0.9, 0.5)', fill: 'forwards' }
          )
        );
      });
      const crack = root.querySelector('.tover-crack');
      if (crack) {
        anims.push(
          crack.animate(
            [
              { opacity: 0, transform: 'scaleY(0)' },
              { opacity: 0, transform: 'scaleY(0)', offset: 0.5 },
              { opacity: 1, transform: 'scaleY(1)', offset: 0.6 },
              { opacity: 0, transform: 'scaleY(1)' },
            ],
            { duration: LIFE_MS, fill: 'forwards' }
          )
        );
      }
    }
    const t = setTimeout(onDone, LIFE_MS + 60);
    return () => {
      clearTimeout(t);
      anims.forEach((x) => x.cancel());
    };
    // one-shot per mount (the caller re-keys to replay)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const title = kind === 'boost' ? 'BOOST OVER' : 'FRENZY OVER';
  const face = (
    <div className="tover-face">
      <div className="tover-title">{title}</div>
      <div className="tover-mult">×{mult} ENDED</div>
    </div>
  );
  return (
    <div className={`tover is-${kind}`} ref={rootRef} role="status" aria-label={title}>
      {WORDS[kind].map((ch, i) => (
        <span key={i} className="tover-tile" aria-hidden="true" style={{ background: COLOURS[kind][i % 4] }}>
          {ch}
        </span>
      ))}
      {/* the slab is drawn twice, each copy clipped to one half, so it can crack apart */}
      <div className="tover-slab" aria-hidden="true">
        <div className="tover-sizer">{face}</div>
        <div className="tover-half is-left">{face}</div>
        <div className="tover-half is-right">{face}</div>
        <div className="tover-crack" />
      </div>
    </div>
  );
}

