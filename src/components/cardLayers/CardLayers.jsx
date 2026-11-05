// CardLayers.jsx — a PAINTED game card, built from separate layers (Andy oct14 art run; COMPONENTS oct24).
//   backdrop   the scene (always)
//   parts      painted pieces that sit INVISIBLE at rest and only appear in the card's ACT (cardActs.js) — `under`
//              parts sit behind the hero, `onHero` parts ride the hero's own frame (a spark on its fuse)
//   FX         loads on the first hover and bursts in on hover (GameCard.css .gc-l-fx)
//   hero       the character; it pops in once, leans on hover, and its ACTOR wrapper is what the act moves
// A card with no `act` (WORD BOMB, BLITZ) renders exactly the three layers it always had.
import { useEffect, useRef } from 'react';
import { registerCardAct } from './cardActs.js';
import { registerCardArt } from './cardsReady.js';
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

// LOAD ORDER (Andy nov4, "the game cards take a while to load"): the backdrop + hero ship a 400px cut (`-400.webp`,
// via srcset — a 1x Chromebook card is ~250px wide; a big / 2x screen still picks the 640). The menu's FIRST PAGE is
// `priority` (fetchpriority high, and its art fades in together — cardsReady.js); every other card is lazy, so the
// cards one flip away never compete with the ones on screen.
const small = (src) => src.replace(/\.webp$/, '-400.webp');
const SIZES = '(min-width: 1600px) 320px, 250px';

function Layer({ className, src, priority, imgRef }) {
  return (
    <img
      ref={imgRef}
      className={className}
      src={src}
      srcSet={`${small(src)} 400w, ${src} 640w`}
      sizes={SIZES}
      alt=""
      aria-hidden="true"
      draggable="false"
      decoding="async"
      loading={priority ? 'eager' : 'lazy'}
      fetchpriority={priority ? 'high' : 'low'}
    />
  );
}

export default function CardLayers({ layers, fxOn, locked = false, priority = false }) {
  const rootRef = useRef(null);
  const bgRef = useRef(null);
  const heroRef = useRef(null);
  // a priority card reports when its backdrop + hero have decoded, so the first page shows together
  useEffect(() => {
    if (!priority) return;
    const dec = (img) => (img && typeof img.decode === 'function' ? img.decode().catch(() => {}) : Promise.resolve());
    registerCardArt(Promise.all([dec(bgRef.current), dec(heroRef.current)]));
  }, [priority]);
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
      className={`game-card-art gc-layers${priority ? ' is-prio' : ''}`}
      style={{ '--gc-hy': layers.heroY || '-11%', '--gc-hs': layers.heroScale || 0.76 }}
    >
      <Layer className="gc-l gc-l-bg" src={layers.bg} priority={priority} imgRef={bgRef} />
      {parts.filter((p) => p.under).map((p) => <Part key={p.id} p={p} refs={els} />)}
      {fxOn && layers.fx ? <img className="gc-l gc-l-fx" src={layers.fx} alt="" aria-hidden="true" draggable="false" decoding="async" /> : null}
      {act ? (
        <div className="gc-actor" ref={(el) => { els.current.hero = el; }}>
          <Layer className="gc-l gc-l-hero" src={layers.hero} priority={priority} imgRef={heroRef} />
          <div className="gc-heroframe">
            {parts.filter((p) => p.onHero).map((p) => <Part key={p.id} p={p} refs={els} />)}
          </div>
        </div>
      ) : (
        <Layer className="gc-l gc-l-hero" src={layers.hero} priority={priority} imgRef={heroRef} />
      )}
      {parts.filter((p) => !p.under && !p.onHero).map((p) => <Part key={p.id} p={p} refs={els} />)}
    </div>
  );
}
