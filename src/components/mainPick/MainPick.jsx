// MainPick.jsx — YOUR MAIN, the menu's character SHOWCASE (Andy oct16 "the cosmetic thing with the avatars … looks pretty
// undeveloped on the right side of the screen"; research: the Fortnite / Brawl Stars lobby showcase). The character you
// play as stands big on a painted pedestal, always alive (its own idle beat), and a TAP plays its WIN pose. Painted
// arrows and a strip of the cast's faces switch it. Picking one is ownership (the avatar-customisation effect). Every
// visual is a painted asset (public/showcase, public/cast); CSS only places them; motion is finite WAAPI one-shots
// re-armed on a timer (CLAUDE.md: nothing infinite; transform / opacity only).
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CAST, castSrc, readMain, writeMain, CAST_BEATS, castBeatFrames } from '../../cast/cast.js';
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
  const i = Math.max(0, CAST.findIndex((c) => c.id === id));
  const c = CAST[i];

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
  const equip = (next) => {
    setOpen(false);
    if (next === id) return;
    writeMain(next);
    setCheering(false);
    setId(next);
  };
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open]);

  return (
    <section className="mp" style={{ '--mp-c': c.color, '--mp-d': c.dark }} aria-label="Your main character" data-testid="main-pick">
      <span className="mp-k">YOUR MAIN</span>
      <div className="mp-stage">
        <img className="mp-pedestal" src="/showcase/pedestal.webp" width="1234" height="590" alt="" aria-hidden="true" draggable="false" />
        <button type="button" className="mp-hero" onClick={() => setCheering(true)} aria-label={`${c.name}: tap to cheer`}>
          <img ref={artRef} key={c.id} className="mp-art" src={castSrc(c.id, cheering ? 'win' : 'hero')} width="512" height="512" alt={c.name} draggable="false" />
        </button>
      </div>
      <span className="mp-name">{c.name}</span>
      {/* the roster lives in a POPUP (Andy oct16 "a popup that can include all of that (kind of like equipping gear)") */}
      <button type="button" className="mp-change" onClick={() => setOpen(true)} aria-haspopup="dialog">CHANGE</button>
      {open ? createPortal(
        <div className="mpp" role="dialog" aria-modal="true" aria-label="Choose your main" onClick={() => setOpen(false)}>
          <div className="mpp-card" onClick={(e) => e.stopPropagation()}>
            <div className="mpp-head">
              <span className="mpp-title">CHOOSE YOUR MAIN</span>
              <button type="button" className="mpp-x" onClick={() => setOpen(false)} aria-label="Close">✕</button>
            </div>
            <div className="mpp-grid">
              {CAST.map((x) => (
                <button key={x.id} type="button" className={`mpp-hero${x.id === id ? ' is-on' : ''}`} style={{ '--f-c': x.color, '--f-d': x.dark }} onClick={() => equip(x.id)} aria-pressed={x.id === id}>
                  <img src={castSrc(x.id, 'hero')} width="512" height="512" alt="" draggable="false" />
                  <span className="mpp-name">{x.name}</span>
                  <span className="mpp-tag">{x.tag}</span>
                  <span className="mpp-act">{x.id === id ? 'EQUIPPED' : 'EQUIP'}</span>
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </section>
  );
}
