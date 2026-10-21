// HeroUnlock.jsx — NEW HERO! (oct18, Andy: "more I WANT THAT … PRESENTATION"). The moment a hero becomes yours —
// bought in the preview, or earned by playing — gets its own reveal: the screen dims, rarity rays turn behind a
// face-down card, the card FLIPS to the hero's card, the win burst pops, the hero jumps out in its WIN pose, and the
// title slams in. A queue plays one hero at a time (NEXT), rarest last. Buttons: EQUIP NOW / LATER (a bought hero is
// already equipped: LET'S GO).
// Motion: finite WAAPI one-shots (kitPlay), transform / opacity only, nothing loops; reduce motion lands the final
// frame at once (kitPlay is a no-op and every layer's resting style is its end state). Rays = the roll screen's
// /art/rolls/rays.svg as a mask tinted in the hero's colour (a flat fill); card back = /fx/card-back.svg; burst =
// /fx/burst-win.webp. A modal overlay (not persistent UI), portalled like the profile popup.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { heroById } from './cast.js';
import { rarityOf } from './CastArt.jsx';
import CastArt from './CastArt.jsx';
import HeroCard from './HeroCard.jsx';
import FitText from '../components/kit/FitText.jsx';
import { kitPlay } from '../components/kit/motion.js';
import { sndRevealFlip, sndRollSting } from '../audio/rollSounds.js';
import { markHeroesSeen } from './heroSeen.js';
import './HeroUnlock.css';

const SND_TIER = { gold: 'epic', elite: 'legendary', legend: 'mythic' };
const TIER_WORD = { gold: 'GOLD HERO', elite: 'ELITE HERO', legend: 'LEGEND!' };
const T = { drop: 150, flip: 900, pop: 1180, title: 1300, btns: 1750 };
const EASE_POP = 'cubic-bezier(.2,1.4,.4,1)';

/** @param ids heroes to reveal (in order) · @param equipped the hero already on (a purchase) · @param onEquip(id) · @param onClose */
export default function HeroUnlock({ ids, equipped = null, onEquip, onClose }) {
  const [ix, setIx] = useState(0);
  const h = heroById(ids[ix]);
  const n = useRef({});
  const reg = (k) => (el) => { n.current[k] = el; };
  const r = rarityOf(h);

  useEffect(() => { markHeroesSeen(ids); }, [ids]);
  useEffect(() => {
    if (!h) return undefined;
    const e = n.current;
    const timers = [];
    kitPlay(e.scrim, [{ opacity: 0 }, { opacity: 1 }], { duration: 260 });
    const rayOp = r.tier ? 0.32 : 0.2; // = the CSS resting value (the end state)
    kitPlay(e.rays, [{ transform: 'rotate(0deg) scale(.5)', opacity: 0 }, { transform: 'rotate(10deg) scale(1)', opacity: rayOp * 1.6, offset: 0.12 }, { transform: 'rotate(70deg) scale(1.08)', opacity: rayOp }], { duration: 6000, easing: 'cubic-bezier(.2,.6,.3,1)' });
    // the face-down card: ONE animation from the drop through the hold to the flip edge-on (its resting style is hidden —
    // the end state — so two separate one-shots would blink it out in the gap)
    const span = T.flip + 160 - T.drop;
    const at = (ms) => (ms - T.drop) / span;
    kitPlay(e.back, [
      { transform: 'perspective(900px) translateY(-70%) rotate(-8deg) rotateY(0deg) scale(.8)', opacity: 0 },
      { transform: 'perspective(900px) translateY(4%) rotate(2deg) rotateY(0deg) scale(1.04, .94)', opacity: 1, offset: at(T.drop + 340), easing: 'ease-out' },
      { transform: 'perspective(900px) translateY(0) rotate(0deg) rotateY(0deg) scale(1)', opacity: 1, offset: at(T.drop + 520) },
      { transform: 'perspective(900px) translateY(0) rotate(0deg) rotateY(0deg) scale(1)', opacity: 1, offset: at(T.flip), easing: 'cubic-bezier(.5,0,.9,.5)' },
      { transform: 'perspective(900px) translateY(0) rotate(0deg) rotateY(90deg) scale(1)', opacity: 1, offset: 0.999 },
      { transform: 'perspective(900px) translateY(0) rotate(0deg) rotateY(90deg) scale(1)', opacity: 0 },
    ], { duration: span, delay: T.drop, easing: 'cubic-bezier(.3,1.2,.5,1)', fill: 'backwards' });
    // the pre-flip rattle builds the wait
    kitPlay(e.rattle, [
      { transform: 'rotate(0deg)' }, { transform: 'rotate(-3deg)', offset: 0.2 }, { transform: 'rotate(3deg)', offset: 0.4 },
      { transform: 'rotate(-4deg)', offset: 0.6 }, { transform: 'rotate(4deg)', offset: 0.8 }, { transform: 'rotate(0deg)' },
    ], { duration: 260, delay: T.flip - 280 });
    // THE FLIP: (the back turned edge-on above) the hero's card turns in — a slam for the rarer tiers
    kitPlay(e.face, [{ transform: 'perspective(900px) rotateY(-90deg) scale(1)', opacity: 0 }, { transform: 'perspective(900px) rotateY(-90deg) scale(1)', opacity: 1, offset: 0.01 }, { transform: 'perspective(900px) rotateY(0deg) scale(1.12)', opacity: 1, offset: 0.7 }, { transform: 'perspective(900px) rotateY(0deg) scale(1)', opacity: 1 }],
      { duration: 380, delay: T.flip + 160, easing: r.tier ? 'cubic-bezier(.2,1.25,.45,1)' : 'cubic-bezier(.1,.6,.3,1)', fill: 'backwards' });
    timers.push(setTimeout(() => sndRevealFlip(SND_TIER[r.tier] || 'rare'), T.flip));
    timers.push(setTimeout(() => sndRollSting(SND_TIER[r.tier] || 'rare'), T.pop));
    kitPlay(e.burst, [{ transform: 'scale(.3) rotate(-10deg)', opacity: 0 }, { transform: 'scale(1.15) rotate(4deg)', opacity: 1, offset: 0.35 }, { transform: 'scale(1) rotate(0deg)', opacity: 1 }], { duration: 520, delay: T.pop, easing: EASE_POP, fill: 'backwards' });
    kitPlay(e.hero, [
      { transform: 'translateY(30%) scale(.4)', opacity: 0 },
      { transform: 'translateY(-12%) scale(1.12, .92)', opacity: 1, offset: 0.55 },
      { transform: 'translateY(0) scale(.96, 1.05)', opacity: 1, offset: 0.8 },
      { transform: 'translateY(0) scale(1)', opacity: 1 },
    ], { duration: 560, delay: T.pop + 60, easing: 'ease-out', fill: 'backwards' });
    kitPlay(e.title, [{ transform: 'scale(2.4) rotate(-6deg)', opacity: 0 }, { transform: 'scale(.92) rotate(-3deg)', opacity: 1, offset: 0.6 }, { transform: 'scale(1) rotate(-3deg)', opacity: 1 }], { duration: 420, delay: T.title, easing: 'cubic-bezier(.3,1.3,.5,1)', fill: 'backwards' });
    kitPlay(e.name, [{ transform: 'translateY(30%)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], { duration: 300, delay: T.title + 160, easing: 'ease-out', fill: 'backwards' });
    kitPlay(e.btns, [{ transform: 'translateY(20px)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], { duration: 280, delay: T.btns, easing: 'ease-out', fill: 'backwards' });
    return () => timers.forEach(clearTimeout);
  }, [h && h.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (ev) => { if (ev.key === 'Escape') { ev.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  if (!h) return null;
  const last = ix >= ids.length - 1;
  const next = () => (last ? onClose() : setIx(ix + 1));
  const isOn = equipped === h.id;
  return createPortal(
    <div className={`hu is-${r.tier || 'crew'}`} role="dialog" aria-modal="true" aria-label={`New hero: ${h.name}`} data-testid="hero-unlock" data-hero={h.id}
      style={{ '--hu-c': h.color, '--hu-d': h.dark }} onClick={(ev) => ev.stopPropagation()} /* a portal still bubbles through React: never let a tap here reach the host's scrim */>
      <div ref={reg('scrim')} className="hu-scrim" />
      <div className="hu-stage">
        <div ref={reg('rays')} className="hu-rays" aria-hidden="true" />
        <img ref={reg('burst')} className="hu-burst" src="/fx/burst-win.webp" alt="" aria-hidden="true" draggable="false" />
        <div ref={reg('rattle')} className="hu-cardbox">
          <img ref={reg('back')} className="hu-back" src="/fx/card-back.svg" alt="" aria-hidden="true" draggable="false" />
          <div ref={reg('face')} className="hu-face"><HeroCard hero={h} live /></div>
        </div>
        <div ref={reg('hero')} className="hu-hero" aria-hidden="true"><CastArt className="hu-art" id={h.id} pose="win" /></div>
      </div>
      <div className="hu-text">
        <div ref={reg('title')} className="hu-title">{TIER_WORD[r.tier] || 'NEW HERO!'}</div>
        <div ref={reg('name')} className="hu-namebox">
          <FitText className="hu-name fit-center">{h.name}</FitText>
          <span className="hu-tag">{h.tag}</span>
        </div>
        <div ref={reg('btns')} className="hu-btns">
          {isOn ? (
            <button type="button" className="hu-btn is-main" onClick={next}>{last ? "LET'S GO" : 'NEXT'}</button>
          ) : (
            <>
              <button type="button" className="hu-btn is-main" onClick={() => { onEquip(h.id); next(); }}>EQUIP NOW</button>
              <button type="button" className="hu-btn" onClick={next}>{last ? 'LATER' : 'NEXT'}</button>
            </>
          )}
        </div>
        {ids.length > 1 ? <span className="hu-count">{ix + 1} / {ids.length}</span> : null}
      </div>
    </div>,
    document.body,
  );
}
