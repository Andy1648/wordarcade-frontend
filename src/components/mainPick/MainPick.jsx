// MainPick.jsx — YOUR MAIN (Andy oct16 "a good direction to go next is just the customizable section - that can go on the
// right side of the screen (with the empty space there)"). The menu's empty right column: the character you play as,
// big, standing on its plate, ◀ ▶ to switch. Picking one is ownership (the IKEA / avatar-customisation effect — players who
// customise an avatar come back more). Motion: one squash-land when a character arrives, a lean on hover; nothing at rest.
import { useEffect, useRef, useState } from 'react';
import { CAST, castSrc, readMain, writeMain } from '../../cast/cast.js';
import './MainPick.css';

const LAND = [
  { transform: 'translateY(-46px) scale(.9, 1.08)', opacity: 0 },
  { transform: 'translateY(4px) scale(1.12, .86)', opacity: 1, offset: 0.62 },
  { transform: 'translateY(-3px) scale(.97, 1.04)', offset: 0.82 },
  { transform: 'translateY(0) scale(1, 1)', opacity: 1 },
];

export default function MainPick() {
  const [id, setId] = useState(readMain);
  const artRef = useRef(null);
  const first = useRef(true);
  const i = Math.max(0, CAST.findIndex((c) => c.id === id));
  const c = CAST[i];
  useEffect(() => {
    if (first.current) { first.current = false; return undefined; }
    const el = artRef.current;
    if (!el || !el.animate || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) return undefined;
    el.style.willChange = 'transform, opacity';
    const a = el.animate(LAND, { duration: 420, easing: 'cubic-bezier(.2,1,.3,1)' });
    const clear = () => { el.style.willChange = ''; };
    a.onfinish = clear; a.oncancel = clear;
    return () => a.cancel();
  }, [id]);
  const go = (d) => {
    const next = CAST[(i + d + CAST.length) % CAST.length].id;
    writeMain(next);
    setId(next);
  };
  return (
    <section className="mp" style={{ '--mp-c': c.color, '--mp-d': c.dark }} aria-label="Your main character" data-testid="main-pick">
      <span className="mp-k">YOUR MAIN</span>
      <div className="mp-stage">
        <img ref={artRef} key={c.id} className="mp-art" src={castSrc(c.id, 'hero')} width="256" height="256" alt={c.name} draggable="false" />
        <span className="mp-plate" aria-hidden="true" />
      </div>
      <div className="mp-row">
        <button type="button" className="mp-arrow" onClick={() => go(-1)} aria-label="Previous character">◀</button>
        <span className="mp-name">{c.name}</span>
        <button type="button" className="mp-arrow" onClick={() => go(1)} aria-label="Next character">▶</button>
      </div>
      <span className="mp-tag">{c.tag}</span>
      <span className="mp-dots" aria-hidden="true">{CAST.map((x) => <i key={x.id} className={x.id === c.id ? 'is-on' : ''} />)}</span>
    </section>
  );
}
