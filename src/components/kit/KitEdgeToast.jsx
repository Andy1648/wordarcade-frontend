// KitEdgeToast.jsx — 04 UNLOCK TOAST (claude/mockups/v2/KitLevelUp.dc.html): "RIGHT EDGE · 2.4S · STACKS DOWN".
// A thing that just opened (a rebirth unlock, a new frame, a bought item) slides in from the RIGHT edge, says
// UNLOCKED + its code, names it, and slides back out. Never centre-screen, never a claim, takes no pointer.
//
//   pushToast({ code: 'R1', label: 'ROLL SCREEN', tile: '#FFC23D', icon: 'roll' })
//   pushToast({ code: 'R3', label: 'BOOST SLOT', tile: '#FF3D7F', icon: 'boost', badge: '2' })   (P9a: the slot-count badge)
//
// ONE host (mount <KitEdgeToastHost /> once). Up to 3 stack downward; a 4th retires the oldest. Motion: one finite
// WAAPI slide per toast + one icon wiggle (transform only), skipped under REDUCE MOTION (the toast simply shows for
// the same 2.4 s). Nothing loops. P7 builds the minimal piece; P9a (KitLevelUp) extends it, never duplicates it.
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { edgeToasts, TOAST_MS } from './edgeStores.js';
import { kitPlay } from './motion.js';
import KitIcon from './KitIcon.jsx';
import './tokens.css';
import './KitEdgeToast.css';

export const TOAST_STEP = 80; // px between stacked toasts

const SLIDE = [
  { transform: 'translateX(120%)', easing: 'cubic-bezier(.2,1.3,.4,1)' },
  { transform: 'translateX(0)', offset: 0.17 },
  { transform: 'translateX(0)', offset: 0.85, easing: 'cubic-bezier(.6,0,.9,.5)' },
  { transform: 'translateX(120%)' },
];
const WIGGLE = [{ transform: 'rotate(0) scale(1)' }, { transform: 'rotate(-12deg) scale(1.18)', offset: 0.3 }, { transform: 'rotate(8deg) scale(1)', offset: 0.6 }, { transform: 'rotate(0) scale(1)' }];

function Toast({ t, rank }) {
  const card = useRef(null);
  const icon = useRef(null);
  useEffect(() => {
    kitPlay(card.current, SLIDE, { duration: TOAST_MS, fill: 'both', keep: true });
    kitPlay(icon.current, WIGGLE, { duration: 400, delay: 350, easing: 'ease-out' });
  }, []);
  return (
    <div className="ket" style={{ top: `${rank * TOAST_STEP}px`, '--ket-c': t.tile || '#2EFFE0' }}>
      <div ref={card} className="ket-card" data-toast={t.code || ''}>
        <span className="ket-tile">
          <span ref={icon} className="ket-icon">
            <KitIcon name={t.icon || 'levels'} size={44} />
          </span>
          {t.badge ? <span className="ket-badge">{t.badge}</span> : null}
        </span>
        <span className="ket-text">
          <span className="ket-head">
            {t.head || 'UNLOCKED'}
            {t.code ? <span className="ket-code">{t.code}</span> : null}
          </span>
          <span className="ket-label">{t.label}</span>
        </span>
      </div>
    </div>
  );
}

export function KitEdgeToastHost({ store = edgeToasts, contained = false }) {
  const list = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const live = list.filter((t) => !t.leaving);
  const host = (
    <div className={`ket-host${contained ? ' is-contained' : ''}`} role="status" aria-live="polite">
      {live.map((t, i) => (
        <Toast key={t.id} t={t} rank={i} />
      ))}
    </div>
  );
  if (contained || typeof document === 'undefined') return host;
  return createPortal(host, document.body);
}
