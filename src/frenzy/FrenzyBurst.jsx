// FrenzyBurst.jsx — the FUSE FRENZY trigger moment (STEP 20 / Andy oct2: "big, satisfying,
// spread-out"). The 26 strip letters BLOW OUT from the centre to the screen edges, a FRENZY ×5
// slab slams in under them with the trigger bonus, then the whole thing clears in ~1.8 s.
//
// Budget (CLAUDE.md): transform/opacity only, every animation finite, the 26 letter nodes are a
// FIXED set created once per trigger (not per keystroke), no layout reads — the spread vectors
// are pure trig. position:fixed + pointer-events:none, so it can never block the input. Reduced
// motion: the slab shows still for the same duration and the letters stay hidden.
import { useEffect, useRef, useState } from 'react';
import { FRENZY_MULT, frenzyMinutes } from '../progress/frenzy.js';
import { formatNum } from '../format.js';
import './FrenzyBurst.css';
import { reduceMotion } from '../lib/reduceMotion';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const COLOURS = ['#FFE94A', '#FF6B3D', '#FF4FA3', '#2EFFE0'];
const LIFE_MS = 1800;

// `title` / `line` / `variant` (Rebirth Rush): the SAME blast announces OVERDRIVE starting (TimerOver.jsx),
// with its own slab copy and a pink slab (`variant="overdrive"`). FUSE passes none of them.
export default function FrenzyBurst({ bonus = 0, started = true, onDone, title, line, variant }) {
  const rootRef = useRef(null);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    const root = rootRef.current;
    const reduce = reduceMotion();
    const anims = [];
    if (root && !reduce && typeof root.animate === 'function') {
      const tiles = root.querySelectorAll('.frenzy-tile');
      tiles.forEach((el, i) => {
        // An even ring with a little jitter so it reads as a blast, not a clock face.
        const a = (i / tiles.length) * Math.PI * 2 + ((i * 37) % 11) / 30;
        const r = 46 + ((i * 53) % 9); // vmax
        const dx = Math.cos(a) * r;
        const dy = Math.sin(a) * r;
        const spin = ((i % 2 ? 1 : -1) * (90 + ((i * 29) % 180)));
        anims.push(
          el.animate(
            [
              { transform: 'translate(-50%, -50%) scale(0.4) rotate(0deg)', opacity: 0 },
              { transform: 'translate(-50%, -50%) scale(1.25) rotate(0deg)', opacity: 1, offset: 0.12 },
              { transform: `translate(calc(-50% + ${dx}vmax), calc(-50% + ${dy}vmax)) scale(0.9) rotate(${spin}deg)`, opacity: 0 },
            ],
            { duration: 1100, delay: (i % 6) * 18, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)', fill: 'forwards' }
          )
        );
      });
      const slab = root.querySelector('.frenzy-slab');
      if (slab) {
        anims.push(
          slab.animate(
            [
              { transform: 'translate(-50%, -50%) scale(2.2) rotate(-8deg)', opacity: 0 },
              { transform: 'translate(-50%, -50%) scale(0.92) rotate(-4deg)', opacity: 1, offset: 0.18 },
              { transform: 'translate(-50%, -50%) scale(1.04) rotate(-4deg)', opacity: 1, offset: 0.28 },
              { transform: 'translate(-50%, -50%) scale(1) rotate(-4deg)', opacity: 1, offset: 0.8 },
              { transform: 'translate(-50%, -64%) scale(1) rotate(-4deg)', opacity: 0 },
            ],
            { duration: LIFE_MS, easing: 'ease-out', fill: 'forwards' }
          )
        );
      }
    }
    const t = setTimeout(() => {
      setGone(true);
      if (onDone) onDone();
    }, LIFE_MS + 60);
    return () => {
      clearTimeout(t);
      anims.forEach((x) => x.cancel());
    };
    // One-shot per mount: the caller re-keys to replay.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (gone) return null;
  return (
    <div className={`frenzy-burst${variant ? ` is-${variant}` : ''}`} ref={rootRef} aria-hidden="true">
      {LETTERS.map((ch, i) => (
        <span key={ch} className="frenzy-tile" style={{ background: COLOURS[i % COLOURS.length] }}>
          {ch}
        </span>
      ))}
      <div className="frenzy-slab">
        <div className="frenzy-slab-title">{title || (started ? 'FRENZY' : 'FULL STRIP')}</div>
        <div className="frenzy-slab-mult">{line || (started ? `×${FRENZY_MULT} WINS · ${frenzyMinutes()} MIN` : `FRENZY STILL ×${FRENZY_MULT}`)}</div>
        {bonus > 0 && <div className="frenzy-slab-bonus">+{formatNum(bonus)} WINS</div>}
      </div>
    </div>
  );
}
