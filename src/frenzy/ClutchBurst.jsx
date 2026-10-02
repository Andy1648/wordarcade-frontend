// ClutchBurst.jsx — FUSE CLUTCH (STEP 56, Andy oct2: "a word accepted with ≤2s left triggers a
// CLUTCH moment — big, satisfying, spread-out animation + payout bonus, shown on the receipt").
//
// SPREAD OUT: the six letters C-L-U-T-C-H start at six different screen edges and corners and SLAM
// together into the word at the centre, the seconds you had left stamp under it, and the bonus
// pops. ~1.3 s, then gone. Same budget as FrenzyBurst: six fixed nodes per moment, transform +
// opacity only, finite WAAPI, no layout reads (the start points are vw/vh offsets), pointer-events
// none. Reduced motion: the word shows still for the same time.
import { useEffect, useRef, useState } from 'react';
import { formatNum } from '../format.js';
import './ClutchBurst.css';

const LETTERS = ['C', 'L', 'U', 'T', 'C', 'H'];
// Where each letter flies in FROM (vw, vh offsets from its final place) — six different edges.
const FROM = [
  [-60, -40], [-30, 55], [5, -60], [15, 60], [45, -50], [65, 30],
];
const LIFE_MS = 1300;

export default function ClutchBurst({ leftMs = 0, bonus = 0, onDone }) {
  const rootRef = useRef(null);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    const root = rootRef.current;
    const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const anims = [];
    if (root && !reduce && typeof root.animate === 'function') {
      root.querySelectorAll('.clutch-letter').forEach((el, i) => {
        const [x, y] = FROM[i];
        const spin = i % 2 ? 160 : -160;
        anims.push(
          el.animate(
            [
              { transform: `translate(${x}vw, ${y}vh) rotate(${spin}deg) scale(0.6)`, opacity: 0 },
              { transform: 'translate(0, 0) rotate(-6deg) scale(1.25)', opacity: 1, offset: 0.32 },
              { transform: 'translate(0, 0) rotate(-6deg) scale(1)', opacity: 1, offset: 0.42 },
              { transform: 'translate(0, 0) rotate(-6deg) scale(1)', opacity: 1, offset: 0.82 },
              { transform: 'translate(0, -30px) rotate(-6deg) scale(1)', opacity: 0 },
            ],
            { duration: LIFE_MS, delay: i * 25, easing: 'cubic-bezier(0.2, 0.8, 0.25, 1)', fill: 'both' }
          )
        );
      });
      const tag = root.querySelector('.clutch-tag');
      if (tag) {
        anims.push(
          tag.animate(
            [
              { transform: 'translate(-50%, 0) scale(2)', opacity: 0 },
              { transform: 'translate(-50%, 0) scale(2)', opacity: 0, offset: 0.34 },
              { transform: 'translate(-50%, 0) scale(1)', opacity: 1, offset: 0.46 },
              { transform: 'translate(-50%, 0) scale(1)', opacity: 1, offset: 0.82 },
              { transform: 'translate(-50%, -30px) scale(1)', opacity: 0 },
            ],
            { duration: LIFE_MS, easing: 'ease-out', fill: 'both' }
          )
        );
      }
    }
    const t = setTimeout(() => {
      setGone(true);
      if (onDone) onDone();
    }, LIFE_MS + 120);
    return () => {
      clearTimeout(t);
      anims.forEach((a) => a.cancel());
    };
    // One-shot per mount: the caller re-keys to replay.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (gone) return null;
  return (
    <div className="clutch-burst" ref={rootRef} aria-hidden="true">
      <div className="clutch-word">
        {LETTERS.map((ch, i) => (
          <span key={i} className="clutch-letter">
            {ch}
          </span>
        ))}
      </div>
      <div className="clutch-tag">
        {(leftMs / 1000).toFixed(1)}S LEFT
        {bonus > 0 && <b> · +{formatNum(bonus)} WINS</b>}
      </div>
    </div>
  );
}
