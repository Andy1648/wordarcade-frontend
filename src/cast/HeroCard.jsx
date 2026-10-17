// HeroCard.jsx — a cast member as a COLLECTIBLE CARD (Andy oct17: "a card (im kind of thinking like a pokemon card)
// and not the hero just out there raw"). Painted frame (public/cards/frame.webp — Gemini; the ELITE one is the gold
// trophy frame), the hero standing in the art window on its colour, the name on the plate. Plain rectangles of the
// hero's colour sit BEHIND the frame's cut-out windows (flat fills only; every shape is the painted frame).
// ELITE is noticeably better: the gold frame, a premium redesign, an ELITE ribbon chip and a SHINE that sweeps the art
// window on a timer (finite one-shots via kitPlay — transform/opacity only, will-change only while it plays).
// A LOCKED elite shows the hero as a black silhouette.
import { useEffect, useRef } from 'react';
import { castSrc } from './cast.js';
import { kitPlay } from '../components/kit/motion.js';
import FitText from '../components/kit/FitText.jsx';
import './HeroCard.css';

const SHINE = [{ transform: 'translateX(-130%) skewX(-18deg)', opacity: 0 }, { transform: 'translateX(-60%) skewX(-18deg)', opacity: 1, offset: 0.15 }, { transform: 'translateX(330%) skewX(-18deg)', opacity: 1, offset: 0.85 }, { transform: 'translateX(400%) skewX(-18deg)', opacity: 0 }];

/** `delay` staggers the elite shine so a row of cards never flashes in lockstep. */
export default function HeroCard({ hero, locked = false, on = false, sel = false, delay = 0, onClick, children }) {
  const shineRef = useRef(null);
  useEffect(() => {
    if (!hero.elite) return undefined;
    let t = 0;
    const loop = () => {
      if (document.visibilityState !== 'hidden') kitPlay(shineRef.current, SHINE, { duration: 900, easing: 'cubic-bezier(.4,0,.2,1)' });
      t = setTimeout(loop, 3600);
    };
    t = setTimeout(loop, 700 + delay);
    return () => clearTimeout(t);
  }, [hero.elite, delay]);
  const cls = `hc${hero.elite ? ' is-elite' : ''}${locked ? ' is-locked' : ''}${on ? ' is-on' : ''}${sel ? ' is-sel' : ''}`;
  // a card can sit inside a bigger button (the menu's PROFILE tile) — then it is a plain span, not a nested button
  const Tag = onClick ? 'button' : 'span';
  const btn = onClick ? { type: 'button', onClick, 'aria-pressed': on, 'aria-label': `${hero.name}${hero.elite ? ', elite' : ''}${locked ? ', locked' : on ? ', equipped' : ''}` } : { 'aria-hidden': 'true' };
  return (
    <Tag className={cls} style={{ '--hc-c': hero.color, '--hc-d': hero.dark }} {...btn} data-hero={hero.id}>
      <span className="hc-card">
        <span className="hc-art">
          <img className="hc-hero" src={castSrc(hero.id, 'hero')} width="512" height="512" alt="" aria-hidden="true" draggable="false" />
          {hero.elite ? <span ref={shineRef} className="hc-shine" aria-hidden="true" /> : null}
        </span>
        <span className="hc-plate" aria-hidden="true" />
        <img className="hc-frame" src={hero.elite ? '/cards/frame-elite.webp' : '/cards/frame.webp'} alt="" aria-hidden="true" draggable="false" />
        <FitText className="hc-name fit-center">{hero.name}</FitText>
      </span>
      {children}
    </Tag>
  );
}
