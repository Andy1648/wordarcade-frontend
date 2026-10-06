// KitBanner.jsx — 06 TOP BANNERS (claude/mockups/v2/KitCurrency.dc.html): "FROM THE TOP · NEVER
// CENTER". STACKS 3 DEEP · 4S EACH · TAP A BANNER TO CLOSE.
//
//   pushBanner({ name: 'ZAP', verb: 'ROLLED MYTHIC', chip: '1 IN 10K', who: 'KAI_77 · WHOLE SERVER SEES THIS',
//                tone: 'hot', fill: '#4a0a22', glyph: 'bolt' })
//
// ONE host renders the stack. There was no banner host in the app, so this is it: mount
// <KitBannerHost /> ONCE (screens mount it in their top cluster). By default it portals into a
// top-centre strip of the viewport — the TOP edge, never a centre popup; it holds no layout space
// and takes no pointer except on a banner itself. `contained` renders it inside its parent instead
// (the kit gallery). Banners are the queue in bannerStore.js; this file only draws them.
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { banners as defaultStore } from './bannerStore.js';
import { FX, fx } from './motion.js';
import './motionMore.js';
import './tokens.css';
import './KitBanner.css';

export const BANNER_TONES = {
  hot: { c: '#FF3D7F', fill: '#4a0a22', glyph: '#FFE94A' },
  white: { c: '#FFFFFF', fill: '#050208', glyph: '#FFFFFF' },
  yellow: { c: '#FFE94A', fill: '#3d2a05', glyph: '#FFE94A' },
  cyan: { c: '#2EFFE0', fill: '#06302b', glyph: '#2EFFE0' },
  purple: { c: '#D88BFF', fill: '#2a0e4a', glyph: '#FFE94A' },
};
export const BANNER_STEP = 92; // px between stacked banners
export const BANNER_TOP = 12;

function Glyph({ kind, color }) {
  return (
    <svg viewBox="0 0 100 100" width="54" height="54" aria-hidden="true" focusable="false" style={{ overflow: 'visible' }}>
      <g stroke="#000" strokeWidth="8" strokeLinejoin="round">
        {kind === 'eye' ? (
          <>
            <path d="M6 50 C24 20 76 20 94 50 C76 80 24 80 6 50 Z" fill={color} />
            <circle cx="50" cy="50" r="16" fill="#000" />
            <circle cx="44" cy="44" r="5" fill="#fff" stroke="none" />
          </>
        ) : (
          <path d="M60 6 L24 56 L46 56 L36 94 L78 38 L56 38 Z" fill={color} transform="rotate(-8 50 50)" />
        )}
      </g>
    </svg>
  );
}

function Banner({ b, rank, store }) {
  const btnRef = useRef(null);
  const drainRef = useRef(null);
  const t = BANNER_TONES[b.tone] || BANNER_TONES.hot;
  useEffect(() => {
    fx(btnRef.current, FX.bannerIn);
    fx(drainRef.current, FX.drain(b.lifeMs || 4000));
  }, [b.lifeMs]);
  useEffect(() => {
    if (b.leaving) fx(btnRef.current, FX.bannerOut);
  }, [b.leaving]);
  return (
    <div className={`kbn${b.leaving ? ' is-leaving' : ''}`} style={{ transform: `translateY(${BANNER_TOP + rank * BANNER_STEP}px)` }}>
      <button
        ref={btnRef}
        type="button"
        className="kbn-card"
        style={{ '--kbn-c': t.c, '--kbn-fill': b.fill || t.fill }}
        onClick={() => store.close(b.id)}
        aria-label={`${b.name} ${b.verb}${b.chip ? `, ${b.chip}` : ''}. Dismiss`}
      >
        <span className="kbn-stripe">
          <Glyph kind={b.glyph} color={b.glyphColor || t.glyph} />
        </span>
        <span className="kbn-text">
          <span className="kbn-line">
            <span className="kbn-name">{b.name}</span>
            <span className="kbn-verb">{b.verb}</span>
          </span>
          {b.who ? <span className="kbn-who">{b.who}</span> : null}
        </span>
        {b.chip ? <span className="kbn-chip">{b.chip}</span> : null}
        <span ref={drainRef} className="kbn-drain" />
      </button>
    </div>
  );
}

export function KitBannerHost({ store = defaultStore, contained = false, className }) {
  const list = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const live = list.filter((b) => !b.leaving);
  const host = (
    <div className={`kbn-host${contained ? ' is-contained' : ''}${className ? ` ${className}` : ''}`} role="status" aria-live="polite">
      {list.map((b) => {
        const rank = live.filter((o) => o.id > b.id).length;
        return <Banner key={b.id} b={b} rank={rank} store={store} />;
      })}
    </div>
  );
  if (contained || typeof document === 'undefined') return host;
  return createPortal(host, document.body);
}
