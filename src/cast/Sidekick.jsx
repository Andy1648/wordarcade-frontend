// Sidekick.jsx — your SIDEKICK (kit.js) standing at your hero's feet. Two painted frames (rest + action) stacked; every
// ~4–7 s it ACTS: a hop off the ground (squash → up → land) with a hard swap to its action frame for the airtime, like
// a Flash timeline. A tap acts on the spot. Finite WAAPI one-shots re-armed by one timer (nothing infinite), transform +
// opacity only, will-change only while playing (kitPlay), hidden tab skipped, reduce motion = the resting frame.
import { useEffect, useRef } from 'react';
import { kitById, kitSrc } from './kit.js';
import { kitPlay } from '../components/kit/motion.js';
import './Sidekick.css';

const HOP = [
  { transform: 'translateY(0) scale(1, 1)' },
  { transform: 'translateY(0) scale(1.12, .86)', offset: 0.14 },
  { transform: 'translateY(-16%) scale(.94, 1.08)', offset: 0.36 },
  { transform: 'translateY(-19%) scale(1, 1)', offset: 0.5 },
  { transform: 'translateY(0) scale(1.1, .9)', offset: 0.78 },
  { transform: 'translateY(0) scale(1, 1)' },
];
const HOP_MS = 820;
// the action frame shows for the airtime + a beat on landing (hard swaps, step easing)
const ACT_ON = [{ opacity: 0, easing: 'step-end' }, { opacity: 1, offset: 0.14, easing: 'step-end' }, { opacity: 0, offset: 0.9 }, { opacity: 0 }];
const REST_OFF = [{ opacity: 1, easing: 'step-end' }, { opacity: 0, offset: 0.14, easing: 'step-end' }, { opacity: 1, offset: 0.9 }, { opacity: 1 }];

/** `live` = act on a timer (false = still, e.g. a thumbnail). `side` 'left' | 'right' = which foot of the hero. */
export default function Sidekick({ id, live = true, className = '', side = 'left' }) {
  const s = kitById(id);
  const bodyRef = useRef(null);
  const restRef = useRef(null);
  const actRef = useRef(null);
  const act = () => {
    if (document.visibilityState === 'hidden') return;
    kitPlay(bodyRef.current, HOP, { duration: HOP_MS, easing: 'cubic-bezier(.3,.1,.4,1)' });
    kitPlay(actRef.current, ACT_ON, { duration: HOP_MS * 1.5, easing: 'linear' });
    kitPlay(restRef.current, REST_OFF, { duration: HOP_MS * 1.5, easing: 'linear' });
  };
  useEffect(() => {
    if (!live || !s) return undefined;
    let t = 0;
    const loop = () => { act(); t = setTimeout(loop, 4000 + Math.random() * 3000); };
    t = setTimeout(loop, 1200 + Math.random() * 1500);
    return () => clearTimeout(t);
  }, [id, live]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!s) return null;
  return (
    <span className={`sk is-${side} ${className}`} data-sidekick={s.id}>
      <button type="button" className="sk-tap" onClick={(e) => { e.stopPropagation(); act(); }} aria-label={`${s.name}, your sidekick`}>
        <span ref={bodyRef} className="sk-body">
          <img ref={restRef} className="sk-f" src={kitSrc(s.id, 0)} width="256" height="256" alt="" draggable="false" />
          {live ? <img ref={actRef} className="sk-f is-act" src={kitSrc(s.id, 1)} width="256" height="256" alt="" draggable="false" /> : null}
        </span>
      </button>
    </span>
  );
}
