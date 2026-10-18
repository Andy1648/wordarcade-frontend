// HeroShowcase.jsx — your hero on its painted pedestal, alive (oct16 YOUR MAIN → oct17 inside the PROFILE popup). It
// plays the member's SIGNATURE idle (cast.js CAST_IDLE — each one moves its own way; nothing else in the game uses
// these), its layered props (CastArt), squash-lands on a switch, and a TAP plays the WIN pose. Every visual is a
// painted asset; motion is finite WAAPI one-shots re-armed on a timer (nothing infinite; transform / opacity only;
// hidden tab skipped; reduce motion = still).
import { useEffect, useRef, useState } from 'react';
import { heroById, CAST, CAST_IDLE, castIdleFrames } from './cast.js';
import { kitPlay } from '../components/kit/motion.js';
import CastArt from './CastArt.jsx';
import './HeroShowcase.css';

const LAND = [
  { transform: 'translateY(-40%) scale(.9, 1.1)', opacity: 0 },
  { transform: 'translateY(3%) scale(1.14, .84)', opacity: 1, offset: 0.6 },
  { transform: 'translateY(-3%) scale(.96, 1.05)', offset: 0.8 },
  { transform: 'translateY(0) scale(1, 1)', opacity: 1 },
];
const CHEER = [
  { transform: 'translateY(0) scale(1.12, .86)' },
  { transform: 'translateY(-10%) scale(.92, 1.1)', offset: 0.45 },
  { transform: 'translateY(0) scale(1, 1)' },
];
const WIN_HOLD_MS = 1300;

/** `cheer` (a number) bumps from outside to play the WIN pose (a purchase landing). */
export default function HeroShowcase({ id, cheer = 0, className = '' }) {
  const [cheering, setCheering] = useState(false);
  const artRef = useRef(null);
  const first = useRef(true);
  const busy = useRef(false);
  const h = heroById(id) || CAST[0];

  useEffect(() => {
    if (first.current) { first.current = false; return undefined; }
    busy.current = true;
    kitPlay(artRef.current, LAND, { duration: 420, easing: 'cubic-bezier(.2,1,.3,1)' });
    const t = setTimeout(() => { busy.current = false; }, 440);
    return () => clearTimeout(t);
  }, [id]);

  useEffect(() => {
    let timer = 0;
    const loop = () => {
      const b = CAST_IDLE[h.id] || CAST_IDLE.hype;
      if (!busy.current && document.visibilityState !== 'hidden') kitPlay(artRef.current, castIdleFrames(b), { duration: b.ms, easing: 'ease-in-out' });
      timer = setTimeout(loop, b.ms + b.rest); // oct18 Andy: "a lot more continous" — each move flows straight into the next (rest 0)
    };
    timer = setTimeout(loop, 700);
    return () => clearTimeout(timer);
  }, [h.id]);

  useEffect(() => { if (cheer) setCheering(true); }, [cheer]);
  useEffect(() => {
    if (!cheering) return undefined;
    busy.current = true;
    kitPlay(artRef.current, CHEER, { duration: 360, easing: 'cubic-bezier(.2,1.4,.4,1)' });
    const t = setTimeout(() => { setCheering(false); busy.current = false; }, WIN_HOLD_MS);
    return () => clearTimeout(t);
  }, [cheering]);

  return (
    <div className={`hs ${className}`} style={{ '--hs-c': h.color }}>
      <img className="hs-pedestal" src="/showcase/pedestal.webp" width="1234" height="590" alt="" aria-hidden="true" draggable="false" />
      <button type="button" className="hs-hero" onClick={() => setCheering(true)} aria-label={`${h.name}: tap to cheer`}>
        <CastArt artRef={artRef} key={h.id} className="hs-art" id={h.id} pose={cheering ? 'win' : 'hero'} alt={h.name} />
      </button>
    </div>
  );
}
