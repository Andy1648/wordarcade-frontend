// KitRankBanner.jsx — 02 RANK-UP BANNER (claude/mockups/v2/KitLevelUp.dc.html): "EDGES ONLY · NO CENTER POPUPS ·
// RANK = STATUS · NO REWARDS". A slab drops from the TOP edge (0.5 s in · 1.6 s hold · 0.4 s out), says RANK UP + the
// new rank's code, and shows the old plate dimming → the new plate slamming in. It pays nothing and takes no pointer.
//
//   pushRankUp({ from: { name: 'INKLING', req: 'R0' }, to: { name: 'CLACKER', req: 'R2' } })
//   pushRankUp({ head: 'BOARD', from: { name: '#12', req: 'R0' }, to: { name: '#7', req: 'R7', code: 'R8 · LV16' } })
//   (the leaderboard's own rank news rides the same slab: `head` replaces RANK UP, `code` the rank code, `req` only
//   picks the plate colour)
//   pushRankUp({ head: 'PROMOTED', league: 'gold', promo: true, from: { name: '#812' }, to: { name: '#790', code: 'GOLD' } })
//   (nov3 RANK LEAGUES: a `league` slab shows #from -> the league's PAINTED badge + #to instead of the retired title
//   plates. `promo`: the badge SLAMS in and, on impact, the host throws the league's painted shards (gains/ShardBurst,
//   its own lazy chunk) from behind it — one idea, done by ~900 ms. `drop`: the badge just settles in, no shards.)
//
// PLATES (P9a): the 16 shaped v3 plates (KitRankPlate — horns, wings, crowns …), old one dimming → new one slamming
// in, then one sheen pass across the slab. The host, the store and the timing are P7's.
// ONE host (mount <KitRankBannerHost /> once); it portals to a zero-height strip pinned to the top edge.
// Motion: one finite WAAPI timeline per banner (transform/opacity only), skipped under REDUCE MOTION (the slab
// simply shows for the same 2.5 s). Nothing loops.
import { lazy, Suspense, useEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { rankBanners, RANK_BANNER_MS } from './edgeStores.js';
import { kitPlay } from './motion.js';
import { KitRankPlate } from './KitRankPlate.jsx';
import { plateFor } from './rankPlates.js';
import { LEAGUES, LEAGUE_ART, LEAGUE_COLOR, LEAGUE_SHARDS } from '../../leaderboard/leagues.js';
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
// the PROMOTION slam: the badge drops in big and tilted, overshoots, lands (impact at the end — the shards go then)
const SLAM = [
  { transform: 'scale(2.3) rotate(-14deg)', opacity: 0, easing: 'cubic-bezier(.5,0,.9,.4)' },
  { transform: 'scale(.86) rotate(3deg)', opacity: 1, offset: 0.62, easing: 'cubic-bezier(.2,1.4,.4,1)' },
  { transform: 'scale(1) rotate(0deg)', opacity: 1 },
];
const SETTLE = [{ transform: 'translateY(8px)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }];
const SLAM_AT = 420; // the slab has nearly landed (DROP's 20% = 500 ms) — the slam lands on it at ~800 ms
// the painted shards: their own chunk, fetched only when a promotion slab shows (never on the first menu paint)
const ShardBurst = lazy(() => import('../gains/ShardBurst.jsx'));
const SHEEN = [{ transform: 'translateX(-120%) skewX(-20deg)' }, { transform: 'translateX(900%) skewX(-20deg)' }];

// A phone's slab is ~366 px: the pair shrinks so old → new still fits on one row (names stay ≥ 13 px).
const narrow = () => typeof window !== 'undefined' && window.innerWidth <= 420;

function Plate({ name, req, big, innerRef }) {
  const w = narrow() ? (big ? 156 : 124) : big ? 180 : 140;
  return <KitRankPlate rank={req} label={name} w={w} innerRef={innerRef} className={`krb-plate${big ? ' is-new' : ' is-old'}`} />;
}

function Banner({ b, onImpact }) {
  const slab = useRef(null);
  const oldP = useRef(null);
  const newP = useRef(null);
  const sheen = useRef(null);
  const impactRef = useRef(onImpact);
  impactRef.current = onImpact;
  const league = b.league && LEAGUE_ART[b.league] ? b.league : null;
  useEffect(() => {
    // keep: the slab rests above the edge until the store unmounts it (no one-frame flash back to its CSS spot)
    kitPlay(slab.current, DROP, { duration: RANK_BANNER_MS, fill: 'both', keep: true });
    kitPlay(oldP.current, OLD_OUT, { duration: 250, delay: SLAM_AT, easing: 'ease-out', fill: 'forwards', keep: true });
    if (league && b.promo) {
      const a = kitPlay(newP.current, SLAM, { duration: 380, delay: SLAM_AT, fill: 'backwards' });
      // on impact: one rect read (a one-shot, not a frame loop) for where the host throws the shards from
      if (a) a.addEventListener('finish', () => {
        const el = newP.current && newP.current.querySelector('.krb-league-art');
        if (!el || !impactRef.current) return;
        const r = el.getBoundingClientRect();
        impactRef.current({ x: r.left + r.width / 2, y: r.top + r.height / 2 }, { w: r.width, h: r.height, set: LEAGUE_SHARDS[league] });
      }, { once: true });
    } else if (league) {
      kitPlay(newP.current, SETTLE, { duration: 280, delay: SLAM_AT, easing: 'ease-out', fill: 'backwards' });
    } else {
      kitPlay(newP.current, NEW_IN, { duration: 320, delay: SLAM_AT, easing: 'cubic-bezier(.2,1.2,.4,1)', fill: 'backwards' });
    }
    if (!b.drop) kitPlay(sheen.current, SHEEN, { duration: 500, delay: 600, easing: 'ease-in' });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one timeline per banner: its payload is fixed for its life
  }, []);
  const [c] = plateOf(b.to.req);
  if (league) {
    const name = (LEAGUES.find((l) => l.key === league) || {}).name;
    return (
      <div ref={slab} className={`krb is-league${b.promo ? ' is-promo' : ''}${b.drop ? ' is-drop' : ''}`} style={{ '--krb-c': LEAGUE_COLOR[league] }} data-rank={b.to.name} data-league={league}>
        <div className="krb-head">
          <span>{b.head || 'BOARD'}</span>
          {b.to.code ? <span className="krb-code">{b.to.code}</span> : null}
        </div>
        <div className="krb-row">
          {b.from ? <span ref={oldP} className="krb-from">{b.from.name}</span> : null}
          {b.from ? (
            <svg className="krb-arrow" width="38" height="26" viewBox="0 0 70 44" aria-hidden="true" focusable="false">
              <path d="M4 16 L44 16 L44 4 L66 22 L44 40 L44 28 L4 28 Z" fill={b.drop ? '#8a7aa8' : '#2EFFE0'} stroke="#000" strokeWidth="6" strokeLinejoin="round" />
            </svg>
          ) : null}
          <span ref={newP} className="krb-league">
            <img className="krb-league-art" src={LEAGUE_ART[league]} width="512" height="512" alt="" aria-hidden="true" draggable="false" />
            <span className="krb-league-t">
              <b className="krb-league-name">{name}</b>
              <b className="krb-to">{b.to.name}</b>
            </span>
          </span>
        </div>
        <span ref={sheen} className="krb-sheen" aria-hidden="true" />
      </div>
    );
  }
  return (
    <div ref={slab} className="krb" style={{ '--krb-c': c }} data-rank={b.to.name}>
      <div className="krb-head">
        <span>{b.head || 'NEW TITLE'}</span>
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
  const burstRef = useRef(null);
  // a PROMOTION slab mounts the shard layer (lazy) with its league's set, so the sprites load while the slab drops in
  const promo = live.filter((b) => b.promo && LEAGUE_SHARDS[b.league]).pop();
  const impact = (at, box) => { if (burstRef.current) burstRef.current.burst(at, box); };
  const host = (
    <div className={`krb-host${contained ? ' is-contained' : ''}`} role="status" aria-live="polite">
      {live.map((b) => (
        <Banner key={b.id} b={b} onImpact={impact} />
      ))}
      {promo ? <Suspense fallback={null}><ShardBurst ref={burstRef} set={LEAGUE_SHARDS[promo.league]} className="krb-burst" /></Suspense> : null}
      {live.length ? <span className="krb-sr">{`${live[live.length - 1].head || 'New title'}: ${live[live.length - 1].to.name}`}</span> : null}
    </div>
  );
  if (contained || typeof document === 'undefined') return host;
  return createPortal(host, document.body);
}
