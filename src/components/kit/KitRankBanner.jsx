// KitRankBanner.jsx — 02 RANK-UP BANNER (claude/mockups/v2/KitLevelUp.dc.html): "EDGES ONLY · NO CENTER POPUPS ·
// RANK = STATUS · NO REWARDS". A slab drops from the TOP edge (0.5 s in · 1.6 s hold · 0.4 s out), says RANK UP + the
// new rank's code, and shows the old plate dimming → the new plate slamming in. It pays nothing and takes no pointer.
//
//   pushRankUp({ from: { name: 'KEYMASH', req: 'R0' }, to: { name: 'CLACKER', req: 'R2' } })
//   pushRankUp({ head: 'BOARD', from: { name: '#12', req: 'R0' }, to: { name: '#7', req: 'R7', code: 'R8 · LV16' } })
//   (the leaderboard's own rank news rides the same slab: `head` replaces RANK UP, `code` the rank code, `req` only
//   picks the plate colour)
//
// PLATES (P9a): the 16 shaped v3 plates (KitRankPlate — horns, wings, crowns …), old one dimming → new one slamming
// in, then one sheen pass across the slab. The host, the store and the timing are P7's.
// ONE host (mount <KitRankBannerHost /> once); it portals to a zero-height strip pinned to the top edge.
// Motion: one finite WAAPI timeline per banner (transform/opacity only), skipped under REDUCE MOTION (the slab
// simply shows for the same 2.5 s). Nothing loops.
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { rankBanners, RANK_BANNER_MS } from './edgeStores.js';
import { kitPlay } from './motion.js';
import { KitRankPlate } from './KitRankPlate.jsx';
import { plateFor } from './rankPlates.js';
import './tokens.css';
import './KitRankBanner.css';

// The mockup's plate colour (c1) + text colour per rank code — v3/ranks.js RANKS_V3 `req` (rankPlates.js).
export const RANK_PLATE = Object.fromEntries(
  ['R0', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'R10', '★1', '★3', '★5', '★10', '★20'].map((r) => [r, [plateFor(r).c1, plateFor(r).txt]]),
);
const plateOf = (req) => RANK_PLATE[req] || RANK_PLATE.R0;

const DROP = [
  { transform: 'translateY(-118%)', easing: 'cubic-bezier(.2,1.3,.4,1)' },
  { transform: 'translateY(0)', offset: 0.2 },
  { transform: 'translateY(0)', offset: 0.84, easing: 'cubic-bezier(.6,0,.9,.5)' },
  { transform: 'translateY(-118%)' },
];
const NEW_IN = [{ transform: 'scale(1.5)', opacity: 0 }, { transform: 'scale(.9)', opacity: 1, offset: 0.6 }, { transform: 'scale(1)', opacity: 1 }];
const OLD_OUT = [{ transform: 'translateX(0)', opacity: 1 }, { transform: 'translateX(-6px) scale(.94)', opacity: 0.45 }];
const SHEEN = [{ transform: 'translateX(-120%) skewX(-20deg)' }, { transform: 'translateX(900%) skewX(-20deg)' }];

// A phone's slab is ~366 px: the pair shrinks so old → new still fits on one row (names stay ≥ 13 px).
const narrow = () => typeof window !== 'undefined' && window.innerWidth <= 420;

function Plate({ name, req, big, innerRef }) {
  const w = narrow() ? (big ? 156 : 124) : big ? 180 : 140;
  return <KitRankPlate rank={req} label={name} w={w} innerRef={innerRef} className={`krb-plate${big ? ' is-new' : ' is-old'}`} />;
}

function Banner({ b }) {
  const slab = useRef(null);
  const oldP = useRef(null);
  const newP = useRef(null);
  const sheen = useRef(null);
  useEffect(() => {
    // keep: the slab rests above the edge until the store unmounts it (no one-frame flash back to its CSS spot)
    kitPlay(slab.current, DROP, { duration: RANK_BANNER_MS, fill: 'both', keep: true });
    kitPlay(newP.current, NEW_IN, { duration: 320, delay: 420, easing: 'cubic-bezier(.2,1.2,.4,1)', fill: 'backwards' });
    kitPlay(oldP.current, OLD_OUT, { duration: 250, delay: 420, easing: 'ease-out', fill: 'forwards', keep: true });
    kitPlay(sheen.current, SHEEN, { duration: 500, delay: 600, easing: 'ease-in' });
  }, []);
  const [c] = plateOf(b.to.req);
  return (
    <div ref={slab} className="krb" style={{ '--krb-c': c }} data-rank={b.to.name}>
      <div className="krb-head">
        <span>{b.head || 'RANK UP'}</span>
        <span className="krb-code">{b.to.code || b.to.req}</span>
      </div>
      <div className="krb-row">
        {b.from ? <Plate name={b.from.name} req={b.from.req} innerRef={oldP} /> : null}
        {b.from ? (
          <svg className="krb-arrow" width="38" height="26" viewBox="0 0 70 44" aria-hidden="true" focusable="false">
            <path d="M4 16 L44 16 L44 4 L66 22 L44 40 L44 28 L4 28 Z" fill="#2EFFE0" stroke="#000" strokeWidth="6" strokeLinejoin="round" />
          </svg>
        ) : null}
        <Plate name={b.to.name} req={b.to.req} big innerRef={newP} />
      </div>
      <span ref={sheen} className="krb-sheen" aria-hidden="true" />
    </div>
  );
}

export function KitRankBannerHost({ store = rankBanners, contained = false }) {
  const list = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const live = list.filter((b) => !b.leaving);
  const host = (
    <div className={`krb-host${contained ? ' is-contained' : ''}`} role="status" aria-live="polite">
      {live.map((b) => (
        <Banner key={b.id} b={b} />
      ))}
      {live.length ? <span className="krb-sr">{`${live[live.length - 1].head || 'Rank up'}: ${live[live.length - 1].to.name}`}</span> : null}
    </div>
  );
  if (contained || typeof document === 'undefined') return host;
  return createPortal(host, document.body);
}
