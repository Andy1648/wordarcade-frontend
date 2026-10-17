// MainPick.jsx — YOUR MAIN, the menu's character SHOWCASE (Andy oct16 "the cosmetic thing with the avatars … looks pretty
// undeveloped on the right side of the screen"; research: the Fortnite / Brawl Stars lobby showcase). The character you
// play as stands big on a painted pedestal, always alive (its own idle beat), and a TAP plays its WIN pose. Painted
// arrows and a strip of the cast's faces switch it. Picking one is ownership (the avatar-customisation effect). Every
// visual is a painted asset (public/showcase, public/cast); CSS only places them; motion is finite WAAPI one-shots
// re-armed on a timer (CLAUDE.md: nothing infinite; transform / opacity only).
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CAST, ELITE, heroById, ownsHero, readMain, writeMain, CAST_BEATS, castBeatFrames } from '../../cast/cast.js';
import { buyHero } from '../../cast/heroShop.js';
import HeroCard from '../../cast/HeroCard.jsx';
import FitText from '../kit/FitText.jsx';
import { KitHoldButton, KitIcon } from '../kit/index.js';
import { getGems, subscribeGems } from '../../progress/gemsCore';
import { formatNum } from '../../format';
import { sndPurchase } from '../../audio/gameSounds';
import CastArt from '../../cast/CastArt.jsx';
import './MainPick.css';

const LAND = [
  { transform: 'translateY(-40%) scale(.9, 1.1)', opacity: 0 },
  { transform: 'translateY(3%) scale(1.14, .84)', opacity: 1, offset: 0.6 },
  { transform: 'translateY(-3%) scale(.96, 1.05)', offset: 0.8 },
  { transform: 'translateY(0) scale(1, 1)', opacity: 1 },
];
const CHEER = [
  { transform: 'scale(.82) rotate(-6deg)' },
  { transform: 'scale(1.12) rotate(3deg)', offset: 0.45 },
  { transform: 'scale(1) rotate(0deg)' },
];
const WIN_HOLD_MS = 1300;
const IDLE_REST_MS = 320;
const reduced = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function play(el, frames, opts) {
  if (!el || !el.animate || reduced()) return null;
  el.style.willChange = 'transform, opacity';
  const a = el.animate(frames, opts);
  const clear = () => { el.style.willChange = ''; };
  a.onfinish = clear;
  a.oncancel = clear;
  return a;
}

export default function MainPick() {
  const [id, setId] = useState(readMain);
  const [cheering, setCheering] = useState(false);
  const artRef = useRef(null);
  const first = useRef(true);
  const busy = useRef(false); // a land / cheer is playing: the idle waits
  const c = heroById(id) || CAST[0];

  // arrival: squash-land on a switch
  useEffect(() => {
    if (first.current) { first.current = false; return undefined; }
    busy.current = true;
    const a = play(artRef.current, LAND, { duration: 420, easing: 'cubic-bezier(.2,1,.3,1)' });
    const t = setTimeout(() => { busy.current = false; }, 440);
    return () => { clearTimeout(t); if (a) a.cancel(); };
  }, [id]);

  // the idle: this member's beat, re-armed after a short rest (skipped while hidden / mid-land / mid-cheer)
  useEffect(() => {
    let timer = 0;
    const loop = () => {
      const beat = CAST_BEATS[id] || CAST_BEATS.hype;
      if (!busy.current && document.visibilityState !== 'hidden') play(artRef.current, castBeatFrames(beat), { duration: beat.ms, easing: 'ease-in-out' });
      timer = setTimeout(loop, beat.ms + IDLE_REST_MS);
    };
    timer = setTimeout(loop, 700);
    return () => clearTimeout(timer);
  }, [id]);

  // TAP → the WIN pose for a moment (the lobby "emote")
  useEffect(() => {
    if (!cheering) return undefined;
    busy.current = true;
    play(artRef.current, CHEER, { duration: 320, easing: 'cubic-bezier(.2,1.4,.4,1)' });
    const t = setTimeout(() => { setCheering(false); busy.current = false; }, WIN_HOLD_MS);
    return () => clearTimeout(t);
  }, [cheering]);

  const [open, setOpen] = useState(false);
  const [buying, setBuying] = useState(null); // a LOCKED elite tapped: the hold-to-buy bar shows for it
  const [gems, setGems] = useState(getGems);
  useEffect(() => subscribeGems((v) => setGems(typeof v === 'number' ? v : getGems())), []);
  const close = () => { setOpen(false); setBuying(null); };
  const equip = (next) => {
    close();
    if (next === id) return;
    writeMain(next);
    setCheering(false);
    setId(next);
  };
  const pick = (h) => (ownsHero(h.id) ? equip(h.id) : setBuying(h.id === buying ? null : h.id));
  const buy = () => {
    const r = buyHero(buying);
    if (!r.ok) return;
    sndPurchase();
    const next = buying;
    close();
    setCheering(false);
    setId(next);
    setTimeout(() => setCheering(true), 450); // the unlock lands, then it cheers
  };
  const want = buying ? heroById(buying) : null;
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); setBuying(null); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open]);

  return (
    <section className="mp" style={{ '--mp-c': c.color, '--mp-d': c.dark }} aria-label="Your main character" data-testid="main-pick">
      <span className="mp-k">YOUR MAIN</span>
      <div className="mp-stage">
        <img className="mp-pedestal" src="/showcase/pedestal.webp" width="1234" height="590" alt="" aria-hidden="true" draggable="false" />
        <button type="button" className="mp-hero" onClick={() => setCheering(true)} aria-label={`${c.name}: tap to cheer`}>
          <CastArt artRef={artRef} key={c.id} className="mp-art" id={c.id} pose={cheering ? 'win' : 'hero'} alt={c.name} />
        </button>
      </div>
      <FitText className="mp-name fit-center">{c.name}</FitText>
      {/* the roster lives in a POPUP (Andy oct16 "a popup that can include all of that (kind of like equipping gear)") */}
      <button type="button" className="mp-change" onClick={() => setOpen(true)} aria-haspopup="dialog">CHANGE</button>
      {open ? createPortal(
        <div className="mpp" role="dialog" aria-modal="true" aria-label="Choose your main" onClick={close}>
          <div className="mpp-card" onClick={(e) => e.stopPropagation()}>
            <div className="mpp-head">
              <span className="mpp-title">CHOOSE YOUR MAIN</span>
              <span className="mpp-gems"><KitIcon name="gems" size={22} shadow={2} extras={false} />{formatNum(gems)}</span>
              <button type="button" className="mpp-x" onClick={close} aria-label="Close">✕</button>
            </div>
            <span className="mpp-sec">THE CREW</span>
            <div className="mpp-grid">
              {CAST.map((x) => (
                <HeroCard key={x.id} hero={x} on={x.id === id} onClick={() => pick(x)}>
                  <span className="mpp-tag">{x.tag}</span>
                  <span className={`mpp-act${x.id === id ? ' is-on' : ''}`}>{x.id === id ? 'EQUIPPED' : 'EQUIP'}</span>
                </HeroCard>
              ))}
            </div>
            <span className="mpp-sec is-elite">ELITE · {ELITE.filter((x) => ownsHero(x.id)).length}/{ELITE.length} OWNED</span>
            <div className="mpp-grid">
              {ELITE.map((x, k) => {
                const owned = ownsHero(x.id);
                return (
                  <HeroCard key={x.id} hero={x} locked={!owned} on={x.id === id} sel={x.id === buying} delay={k * 520} onClick={() => pick(x)}>
                    <span className="mpp-tag">{x.tag}</span>
                    {owned ? (
                      <span className={`mpp-act${x.id === id ? ' is-on' : ''}`}>{x.id === id ? 'EQUIPPED' : 'EQUIP'}</span>
                    ) : (
                      <span className="mpp-act is-price"><KitIcon name="gems" size={18} shadow={2} extras={false} />{formatNum(x.price)}</span>
                    )}
                  </HeroCard>
                );
              })}
            </div>
            {want ? (
              <div className="mpp-buy">
                <span className="mpp-buy-t">{want.name}</span>
                <KitHoldButton tone="gold" width={260} labelSize={22} label={gems >= want.price ? 'HOLD TO BUY' : 'NOT ENOUGH GEMS'}
                  sub={gems >= want.price ? `${formatNum(want.price)} GEMS` : `NEED ${formatNum(want.price - gems)} MORE`}
                  disabled={gems < want.price} confirmText="UNLOCKED!" onConfirm={buy} ariaLabel={`Hold to unlock ${want.name} for ${formatNum(want.price)} gems`} />
              </div>
            ) : null}
          </div>
        </div>,
        document.body,
      ) : null}
    </section>
  );
}
