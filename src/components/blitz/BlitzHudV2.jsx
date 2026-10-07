// blitz/BlitzHudV2.jsx — the SEASON 2 CATEGORY BLITZ board pieces (claude/mockups/v2/BlitzImposter.dc.html, BLITZ tab;
// SEASON2-QUEUE P10 10f). CategoryBlitzScreen (GameScreen.jsx) lays them out under SEASON2 and keeps every handler,
// the input and the socket path exactly where they were.
//
//   <BlitzHero category round rounds found total />  the category HUGE on a tilted band, the AI BUILT ribbon (the
//                                                    category LISTS are AI-built — the ribbon never says AI JUDGES:
//                                                    Blitz answers are checked against the list, STEP 9), ROUND n/3,
//                                                    and FOUND n (/ total when the server sends the list size).
//   <BlitzTimer seconds max counting />              30 segments + the seconds box. One re-render per timer_tick.
//   <BlitzTiles answers info />                      every accepted answer lands as a tile: its rarity band's colour
//                                                    and the wins it banked (its own line, "+N"), newest last.
// Motion: a new tile lands once (kitPlay, transform/opacity); nothing loops; REDUCE MOTION skips it.
import { useEffect, useRef } from 'react';
import { kitPlay } from '../kit/motion.js';
import { formatNum } from '../../format';
import './BlitzHudV2.css';

const NSEG = 30;

/** PURE: lit segments for the round timer (a running round always shows one). */
export function litSegs(seconds, max) {
  const r = max > 0 ? Math.max(0, Math.min(1, seconds / max)) : 0;
  return r <= 0 ? 0 : Math.max(1, Math.ceil(r * NSEG));
}

export function BlitzHero({ category, round, rounds, solo, found, total }) {
  const name = String(category || '').toUpperCase();
  const long = name.length > 18 ? ' is-long' : name.length > 11 ? ' is-mid' : '';
  return (
    <div className="bz2-hero">
      <span className="bz2-ribbon">✦ AI BUILT</span>
      <div className={`bz2-cat${long}`} translate="no">{name}</div>
      <div className="bz2-found" aria-label={`Found ${formatNum(found)}${total ? ` of ${formatNum(total)}` : ''}`}>
        <span className="bz2-found-k">FOUND</span>
        <span className="bz2-found-n" translate="no">
          {formatNum(found)}
          {total ? <small>/{formatNum(total)}</small> : null}
        </span>
        <span className="bz2-round" translate="no">{solo ? 'SOLO' : `ROUND ${formatNum(round)}/${formatNum(rounds)}`}</span>
      </div>
    </div>
  );
}

export function BlitzTimer({ seconds, max, counting }) {
  const lit = counting ? NSEG : litSegs(seconds, max);
  const low = !counting && seconds <= 5;
  return (
    <div className={`bz2-timer${low ? ' is-low' : ''}`} aria-hidden="true" data-lit={lit}>
      <span className="bz2-secs game-timer-num" translate="no">{formatNum(Math.max(0, seconds))}</span>
      <div className="bz2-segs">
        {Array.from({ length: NSEG }, (_, i) => <i key={i} className={i < lit ? 'is-on' : ''} />)}
      </div>
    </div>
  );
}

const LAND = [
  { transform: 'translateY(-18px) scale(1.15) rotate(-3deg)', opacity: 0 },
  { transform: 'translateY(2px) scale(.97)', opacity: 1, offset: 0.6 },
  { transform: 'translateY(0) scale(1)', opacity: 1 },
];

function Tile({ word, band, color, wins, fresh }) {
  const ref = useRef(null);
  useEffect(() => {
    if (fresh) kitPlay(ref.current, LAND, { duration: 300, easing: 'cubic-bezier(.2,1.3,.4,1)' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <li ref={ref} className="bz2-tile cb-answer-chip" style={{ '--rc': color || '#A9B4C8' }} data-band={band}>
      <span className="bz2-tile-w" translate="no">{wins > 0 ? `+${formatNum(wins)}` : String(band || 'COMMON').toUpperCase()}</span>
      <span className="bz2-tile-a" translate="no">{String(word || '').toUpperCase()}</span>
    </li>
  );
}

/** `info(answer)` → { band, color, wins } (wins 0 before the 3-word gate). NEWEST FIRST: the latest answer lands at
 *  the head of the pile, so a long round clips its OLDEST tiles at the floor, never the one just played. */
export function BlitzTiles({ answers, info }) {
  const n = answers.length;
  return (
    <ol className="bz2-tiles" aria-label={`Your answers (${n})`}>
      {n === 0 ? <li className="bz2-empty">GO! TYPE ANYTHING THAT FITS</li> : null}
      {answers.map((a, i) => ({ a, i })).reverse().map(({ a, i }) => {
        const x = info(a) || {};
        return <Tile key={`${a}-${i}`} word={a} band={x.band} color={x.color} wins={x.wins || 0} fresh={i === n - 1} />;
      })}
    </ol>
  );
}
