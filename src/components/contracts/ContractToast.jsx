// contracts/ContractToast.jsx — the DAILY CONTRACTS live toasts (lazy: contracts/live.js loads this on the first tick).
// The house EDGE TOAST (kit/KitEdgeToast — right edge, below the corner cluster, slides in and out, takes no pointer),
// with painted art instead of a kit glyph:
//   tick   the page + "CONTRACT 7/10" + the goal                (a long count speaks at each quarter only)
//   done   a gem + "CONTRACT DONE +15" + the goal
//   kept   THE STREAK KEPT MOMENT — the first task finished today: the flame SLAMS in, "STREAK KEPT · DAY 5"
//   sweep  all three done: "ALL 3 DONE +25"
// ONE host, mounted on first use into its own body node (a transient overlay, like KitEdgeToastHost's portal — never
// a persistent control). Up to 2 stack; a 3rd retires the oldest. Motion: one finite WAAPI slide per toast + one art
// pop (transform/opacity, will-change only while playing — kitPlay); REDUCE MOTION shows it still for the same time.
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { createBannerStore } from '../kit/bannerStore.js';
import { kitPlay } from '../kit/motion.js';
import { GemIcon } from '../gems/GemChip.jsx';
import { formatNum } from '../../format';
import '../kit/tokens.css';
import './contracts.css';

export const CONTRACT_TOAST_MS = 2400;
const KEPT_MS = 3200;
const store = createBannerStore({ lifeMs: CONTRACT_TOAST_MS, leaveMs: 0, max: 2 });
const keptStore = createBannerStore({ lifeMs: KEPT_MS, leaveMs: 0, max: 1 });

const SLIDE = (ms) => [
  { transform: 'translateX(120%)', easing: 'cubic-bezier(.2,1.3,.4,1)' },
  { transform: 'translateX(0)', offset: 400 / ms },
  { transform: 'translateX(0)', offset: 1 - 360 / ms, easing: 'cubic-bezier(.6,0,.9,.5)' },
  { transform: 'translateX(120%)' },
];
const POP = [{ transform: 'scale(.4) rotate(-14deg)', opacity: 0 }, { transform: 'scale(1.25) rotate(6deg)', opacity: 1, offset: 0.6 }, { transform: 'scale(1) rotate(0)', opacity: 1 }];
const SLAM = [{ transform: 'scale(2.2) rotate(-12deg)', opacity: 0 }, { transform: 'scale(.85) rotate(4deg)', opacity: 1, offset: 0.55 }, { transform: 'scale(1.08) rotate(-2deg)', offset: 0.8 }, { transform: 'scale(1) rotate(0)', opacity: 1 }];
const PUNCH = [{ transform: 'scale(1)' }, { transform: 'scale(1.35)', offset: 0.4 }, { transform: 'scale(1)' }];

const PAGE = '/cast/props/page.webp';
const FLAME = '/cast/props/flame.webp';

function Toast({ t, rank }) {
  const card = useRef(null);
  const art = useRef(null);
  const num = useRef(null);
  const kept = t.kind === 'kept';
  useEffect(() => {
    const ms = kept ? KEPT_MS : CONTRACT_TOAST_MS;
    // REDUCE MOTION (kitPlay plays nothing): the card shows still, in place, for the same time
    if (!kitPlay(card.current, SLIDE(ms), { duration: ms, fill: 'both', keep: true }) && card.current) card.current.style.transform = 'none';
    kitPlay(art.current, kept ? SLAM : POP, { duration: kept ? 520 : 380, delay: 260, easing: 'cubic-bezier(.2,1.2,.4,1)', fill: 'backwards' });
    kitPlay(num.current, PUNCH, { duration: 300, delay: kept ? 720 : 520, easing: 'cubic-bezier(.2,1.4,.4,1)' });
  }, [kept]);
  let head = 'CONTRACT';
  let code = '';
  let label = t.goal || '';
  let pic = <img src={PAGE} alt="" width="48" height="48" draggable="false" />;
  if (t.kind === 'tick') code = `${formatNum(t.to)}/${formatNum(t.target)}`;
  if (t.kind === 'done') { head = 'CONTRACT DONE'; code = `+${formatNum(t.gems)}`; pic = <GemIcon size={44} />; }
  if (t.kind === 'sweep') { head = 'ALL 3 DONE'; code = `+${formatNum(t.gems)}`; label = 'DAILY SWEEP'; pic = <GemIcon size={44} />; }
  if (kept) { head = `CONTRACT DONE · +${formatNum(t.gems)}`; code = `DAY ${formatNum(t.streak)}`; label = 'STREAK KEPT'; pic = <img src={FLAME} alt="" width="56" height="56" draggable="false" />; }
  return (
    <div className={`cxt${kept ? ' is-kept' : ''}`} style={{ top: `${rank * 82}px` }} data-kind={t.kind}>
      <div ref={card} className="cxt-card">
        <span className="cxt-tile"><span ref={art} className="cxt-art">{pic}</span></span>
        <span className="cxt-text">
          <span className="cxt-head">
            {head}
            {code ? <span ref={num} className="cxt-code">{code}</span> : null}
          </span>
          <span className="cxt-label">{label}</span>
        </span>
      </div>
    </div>
  );
}

function Host() {
  const list = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const kept = useSyncExternalStore(keptStore.subscribe, keptStore.getSnapshot, keptStore.getSnapshot);
  const live = [...kept, ...list].filter((t) => !t.leaving);
  return (
    <div className="cxt-host" role="status" aria-live="polite">
      {live.map((t, i) => <Toast key={`${t.kind}-${t.id}`} t={t} rank={i} />)}
    </div>
  );
}

let mounted = false;
function mount() {
  if (mounted || typeof document === 'undefined') return;
  mounted = true;
  const node = document.createElement('div');
  node.className = 'cxt-root';
  document.body.appendChild(node);
  createRoot(node).render(<Host />);
}

/** Show one contract toast ({ kind: 'tick' | 'done' | 'kept' | 'sweep', … } — contracts/live.js). */
export function pushContractToast(t) {
  mount();
  if (t && t.kind === 'kept') keptStore.push(t);
  else store.push(t);
}
