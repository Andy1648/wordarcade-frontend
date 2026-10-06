// KitRankBanner.jsx — 02 RANK-UP BANNER (claude/mockups/v2/KitLevelUp.dc.html): "EDGES ONLY · NO CENTER POPUPS ·
// RANK = STATUS · NO REWARDS". A slab drops from the TOP edge (0.5 s in · 1.6 s hold · 0.4 s out), says RANK UP + the
// new rank's code, and shows the old plate dimming → the new plate slamming in. It pays nothing and takes no pointer.
//
//   pushRankUp({ from: { name: 'KEYMASH', req: 'R0' }, to: { name: 'CLACKER', req: 'R2' } })
//   pushRankUp({ head: 'BOARD', from: { name: '#12', req: 'R0' }, to: { name: '#7', req: 'R7', code: 'R8 · LV16' } })
//   (the leaderboard's own rank news rides the same slab: `head` replaces RANK UP, `code` the rank code, `req` only
//   picks the plate colour)
//
// MINIMAL PLATES (P7): the plates are flat rectangles in the rank's colour. The 16 shaped plates (horns, wings,
// crowns …) are P9a's job — it swaps <Plate> for the real art; the host, the store and the timing stay.
// ONE host (mount <KitRankBannerHost /> once); it portals to a zero-height strip pinned to the top edge.
// Motion: one finite WAAPI timeline per banner (transform/opacity only), skipped under REDUCE MOTION (the slab
// simply shows for the same 2.5 s). Nothing loops.
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { rankBanners, RANK_BANNER_MS } from './edgeStores.js';
import { kitPlay } from './motion.js';
import './tokens.css';
import './KitRankBanner.css';

// The mockup's plate colour (c1) + text colour per rank code — v3/ranks.js RANKS_V3 `req`.
export const RANK_PLATE = {
  R0: ['#a08cc0', '#fff'], R1: ['#c9b8e8', '#000'], R2: ['#2EFFE0', '#000'], R3: ['#FFC23D', '#000'],
  R4: ['#D88BFF', '#fff'], R5: ['#ffffff', '#000'], R6: ['#FF3D7F', '#fff'], R7: ['#FFE94A', '#000'],
  R8: ['#2EFFE0', '#000'], R9: ['#D88BFF', '#000'], R10: ['#FF3D7F', '#fff'], '★1': ['#D88BFF', '#000'],
  '★3': ['#FFE94A', '#000'], '★5': ['#2EFFE0', '#000'], '★10': ['#FF3D7F', '#FFE94A'], '★20': ['#FFE94A', '#000'],
};
const plateOf = (req) => RANK_PLATE[req] || RANK_PLATE.R0;

const DROP = [
  { transform: 'translateY(-118%)', easing: 'cubic-bezier(.2,1.3,.4,1)' },
  { transform: 'translateY(0)', offset: 0.2 },
  { transform: 'translateY(0)', offset: 0.84, easing: 'cubic-bezier(.6,0,.9,.5)' },
  { transform: 'translateY(-118%)' },
];
const NEW_IN = [{ transform: 'scale(1.5)', opacity: 0 }, { transform: 'scale(.9)', opacity: 1, offset: 0.6 }, { transform: 'scale(1)', opacity: 1 }];
const OLD_OUT = [{ transform: 'translateX(0)', opacity: 1 }, { transform: 'translateX(-6px) scale(.94)', opacity: 0.45 }];

function Plate({ name, req, big, innerRef }) {
  const [c, txt] = plateOf(req);
  return (
    <span ref={innerRef} className={`krb-plate${big ? ' is-new' : ' is-old'}`} style={{ '--krb-c': c, '--krb-t': txt }}>
      {name}
    </span>
  );
}

function Banner({ b }) {
  const slab = useRef(null);
  const oldP = useRef(null);
  const newP = useRef(null);
  useEffect(() => {
    // keep: the slab rests above the edge until the store unmounts it (no one-frame flash back to its CSS spot)
    kitPlay(slab.current, DROP, { duration: RANK_BANNER_MS, fill: 'both', keep: true });
    kitPlay(newP.current, NEW_IN, { duration: 320, delay: 420, easing: 'cubic-bezier(.2,1.2,.4,1)', fill: 'backwards' });
    kitPlay(oldP.current, OLD_OUT, { duration: 250, delay: 420, easing: 'ease-out', fill: 'forwards', keep: true });
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
