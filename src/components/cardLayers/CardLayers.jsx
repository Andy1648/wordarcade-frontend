// CardLayers.jsx — a PAINTED game card, built from separate layers (Andy oct14 art run; COMPONENTS oct24).
//   backdrop   the scene (always)
//   parts      painted pieces that sit INVISIBLE at rest and only appear in the card's ACT (cardActs.js) — `under`
//              parts sit behind the hero, `onHero` parts ride the hero's own frame (a spark on its fuse)
//   FX         loads on the first hover and bursts in on hover (GameCard.css .gc-l-fx)
//   hero       the character; it pops in once, leans on hover, and its ACTOR wrapper is what the act moves
// A card with no `act` (WORD BOMB, BLITZ) renders exactly the three layers it always had.
import { useEffect, useRef } from 'react';
import { registerCardAct } from './cardActs.js';
import { reduceMotion, onReduceMotionChange } from '../../lib/reduceMotion';
import './CardLayers.css';

function Part({ p, refs }) {
  return (
    <img
      ref={(el) => { refs.current[p.id] = el; }}
      className="gc-p"
      data-part={p.id}
      src={p.src}
      alt=""
      aria-hidden="true"
      draggable="false"
      decoding="async"
      loading="lazy"
      style={{ left: `${p.x}%`, top: `${p.y}%`, width: `${p.w}%` }}
    />
  );
}

export default function CardLayers({ layers, fxOn, locked = false }) {
  const rootRef = useRef(null);
  const els = useRef({});
  const hostRef = useRef(null);
  const parts = layers.parts || [];
  const act = layers.act || null;

  useEffect(() => {
    const node = rootRef.current;
    if (!act || !node) return undefined;
    let reg = null;
    const start = () => {
      if (reg || reduceMotion()) return;
      reg = registerCardAct(node, act, els.current, locked);
      hostRef.current = reg.host;
    };
    const stop = () => { if (reg) reg.off(); reg = null; hostRef.current = null; };
    start();
    const unsub = onReduceMotionChange((on) => (on ? stop() : start()));
    return () => { unsub(); stop(); };
    // `locked` is synced below without re-registering (re-registering would reset the card's rest clock)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [act]);
  useEffect(() => { if (hostRef.current) hostRef.current.locked = locked; }, [locked]);

  return (
    <div
      ref={rootRef}
      className="game-card-art gc-layers"
      style={{ '--gc-hy': layers.heroY || '-11%', '--gc-hs': layers.heroScale || 0.76 }}
    >
      <img className="gc-l gc-l-bg" src={layers.bg} alt="" aria-hidden="true" draggable="false" decoding="async" />
      {parts.filter((p) => p.under).map((p) => <Part key={p.id} p={p} refs={els} />)}
      {fxOn && layers.fx ? <img className="gc-l gc-l-fx" src={layers.fx} alt="" aria-hidden="true" draggable="false" decoding="async" /> : null}
      {act ? (
        <div className="gc-actor" ref={(el) => { els.current.hero = el; }}>
          <img className="gc-l gc-l-hero" src={layers.hero} alt="" aria-hidden="true" draggable="false" decoding="async" />
          <div className="gc-heroframe">
            {parts.filter((p) => p.onHero).map((p) => <Part key={p.id} p={p} refs={els} />)}
          </div>
        </div>
      ) : (
        <img className="gc-l gc-l-hero" src={layers.hero} alt="" aria-hidden="true" draggable="false" decoding="async" />
      )}
      {parts.filter((p) => !p.under && !p.onHero).map((p) => <Part key={p.id} p={p} refs={els} />)}
    </div>
  );
}
