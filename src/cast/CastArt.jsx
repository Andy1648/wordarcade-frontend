// CastArt.jsx — a cast member's pose, drawn LAYERED when cast.js CAST_LAYERS has the pose (a prop-less body + prop
// sprites), else the flat painted image. Drop-in for the old `<img src={castSrc(...)}>`: `className` + `artRef` land
// on the outer node, so a caller's idle beat (transform on that node) carries the props with the body.
// The GUM (GLITCH pilot): rests as a small bubble at the lips; every ~5–9 s it inflates, holds, POPS (the splat sprite
// flashes) and the splat sucks back into the mouth, then a fresh small bubble blows out. Finite WAAPI one-shots re-armed
// by a timer (nothing infinite), transform + opacity only, will-change only while playing (kitPlay), hidden tab skipped,
// reduce-motion = the resting small bubble.
import { useEffect, useRef } from 'react';
import { castSrc, castLayers } from './cast.js';
import { kitPlay } from '../components/kit/motion.js';
import './CastArt.css';

const REST = 0.32; // the resting bubble (also the .cast-gum-b CSS scale)
const INFLATE = [
  { transform: `scale(${REST})` },
  { transform: 'scale(.62, .58)', offset: 0.35 },
  { transform: 'scale(.8, .84)', offset: 0.6 },
  { transform: 'scale(1.04, .97)', offset: 0.86 },
  { transform: 'scale(1)' },
];
const HOLD = [{ transform: 'scale(1)' }, { transform: 'scale(1.03, .98)', offset: 0.5 }, { transform: 'scale(1)' }];
const BURST = [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.18)', opacity: 0 }];
const SPLAT = [
  { transform: 'scale(.9)', opacity: 0 },
  { transform: 'scale(1.12)', opacity: 1, offset: 0.08 },
  { transform: 'scale(1)', opacity: 1, offset: 0.16 },
  { transform: 'scale(1)', opacity: 1, offset: 0.62 },
  { transform: 'scale(.12)', opacity: 0 },
];
const REGROW = [{ transform: 'scale(0)', opacity: 0 }, { transform: `scale(${REST * 1.1})`, opacity: 1, offset: 0.7 }, { transform: `scale(${REST})`, opacity: 1 }];
const T_INFLATE = 1300;
const T_HOLD = 420;
const T_SPLAT = 900;

function Gum({ box, live }) {
  const bRef = useRef(null);
  const pRef = useRef(null);
  useEffect(() => {
    if (!live) return undefined;
    const timers = [];
    let burst = null;
    const at = (ms, fn) => timers.push(setTimeout(fn, ms));
    const cycle = () => {
      const b = bRef.current;
      const p = pRef.current;
      if (b && p && document.visibilityState !== 'hidden') {
        kitPlay(b, INFLATE, { duration: T_INFLATE, easing: 'cubic-bezier(.3,.1,.4,1)' });
        at(T_INFLATE, () => kitPlay(b, HOLD, { duration: T_HOLD, easing: 'ease-in-out' }));
        at(T_INFLATE + T_HOLD, () => {
          burst = kitPlay(b, BURST, { duration: 70, easing: 'ease-out', fill: 'forwards', keep: true }); // held gone until the regrow
          kitPlay(p, SPLAT, { duration: T_SPLAT, easing: 'cubic-bezier(.5,0,.75,0)' });
        });
        at(T_INFLATE + T_HOLD + T_SPLAT - 120, () => {
          // the held burst must go explicitly (kitPlay forgets a FINISHED animation, so it would outlive the regrow)
          if (burst) { burst.cancel(); burst = null; }
          kitPlay(b, REGROW, { duration: 380, easing: 'cubic-bezier(.2,1.3,.4,1)' });
        });
      }
      at(T_INFLATE + T_HOLD + T_SPLAT + 4200 + Math.random() * 3600, cycle);
    };
    at(1800 + Math.random() * 2400, cycle);
    return () => { timers.forEach(clearTimeout); if (burst) burst.cancel(); };
  }, [live]);
  const style = { left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, transformOrigin: box.o };
  const pw = box.w * 1.12; // the splat is painted ~12% wider than the bubble; centred on it, it sucks back into the lips
  const splat = { left: `${box.x - (pw - box.w) / 2}%`, top: `${box.y - (pw - box.w) / 2}%`, width: `${pw}%`, transformOrigin: box.o, opacity: 0 };
  return (
    <>
      <img ref={pRef} className="cast-gum cast-gum-p" style={splat} src="/cast/props/gum-pop.webp" width="256" height="254" alt="" draggable="false" />
      <img ref={bRef} className="cast-gum cast-gum-b" style={style} src="/cast/props/gum-bubble.webp" width="256" height="254" alt="" draggable="false" />
    </>
  );
}

/** `live` = run the prop one-shots (the big showcase / podium); false = the static resting look (small thumbnails). */
export default function CastArt({ id, pose = 'hero', className = '', artRef, alt = '', live = true, ...rest }) {
  const L = castLayers(id, pose);
  if (!L) return <img ref={artRef} className={className} src={castSrc(id, pose)} width="512" height="512" alt={alt} draggable="false" {...rest} />;
  return (
    <span ref={artRef} className={`${className} cast-layered`} role={alt ? 'img' : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : 'true'} {...rest}>
      <img className="cast-body" src={L.base} width="512" height="512" alt="" draggable="false" />
      {L.gum ? <Gum box={L.gum} live={live} /> : null}
    </span>
  );
}
