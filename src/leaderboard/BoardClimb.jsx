// BoardClimb — the end screen's board news (design research nov2, move 5 "post-run rank movement"; Duolingo leagues):
// after a run a CLAIMED player whose board rank went UP sees their row slide past the players they overtook (400 ms),
// then a ▲N chip stamps in. Nothing at all when they didn't move up, aren't claimed, or the board can't be read — never
// an error on an end screen.
//
// Data: this run's stats are pushed (the menu would push them on the way back anyway; the DB throttles a second push),
// then the new rank is read and compared with the rank this browser last SAW (the board's pending rankFrom, else the
// menu's lastRank). READ-ONLY beyond that push: the menu's rank-up banner + trophy badge still play on the way back.
// Motion: finite WAAPI one-shots (kitPlay — transform/opacity; reduced motion lands the final frame).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { LEADERBOARD_ENABLED, fetchMyRank, fetchRowsBelow, getLastRank, getMyProfile, getRankFrom, submitStats } from './client.js';
import { castFor, castSrc, heroById } from '../cast/cast.js';
import { kitPlay } from '../components/kit/motion.js';
import { formatNum } from '../format';
import './BoardClimb.css';

const SLIDE_MS = 400;
const LEAD_MS = 250; // the strip lands, then the climb plays

export default function BoardClimb() {
  const [climb, setClimb] = useState(null); // { from, to, me, passed: [{ rank, id, username }], heroes }
  useEffect(() => {
    const mine = getMyProfile();
    if (!LEADERBOARD_ENABLED || !mine || !mine.id) return undefined;
    const from = getRankFrom() || getLastRank();
    if (!from) return undefined;
    let live = true;
    (async () => {
      await submitStats(true);
      const to = await fetchMyRank();
      if (!live || !to || to >= from) return;
      const passed = (await fetchRowsBelow(to, Math.min(2, from - to))).filter((r) => r && r.id !== mine.id);
      let heroes = {};
      try { heroes = (await (await import('./showcase.js')).fetchPodium([mine.id, ...passed.map((r) => r.id)])).heroes || {}; } catch { heroes = {}; }
      if (live) setClimb({ from, to, me: mine, passed, heroes });
    })().catch(() => {});
    return () => { live = false; };
  }, []);

  const rowsRef = useRef(null);
  const chipRef = useRef(null);
  useLayoutEffect(() => {
    const ol = rowsRef.current;
    if (!climb || !ol) return;
    // one layout read when the strip lands (never per frame): the row pitch the slide travels
    const meEl = ol.querySelector('.bc-row.is-me');
    const pitch = meEl ? meEl.offsetHeight + 4 : 0;
    kitPlay(meEl, [{ transform: `translateY(${pitch * climb.passed.length}px)` }, { transform: 'translateY(0)' }], { duration: SLIDE_MS, delay: LEAD_MS, easing: 'cubic-bezier(.3,1.2,.5,1)', fill: 'backwards' });
    ol.querySelectorAll('.bc-row:not(.is-me)').forEach((el) => kitPlay(el, [{ transform: `translateY(${-pitch}px)` }, { transform: 'translateY(0)' }], { duration: SLIDE_MS, delay: LEAD_MS, easing: 'ease-out', fill: 'backwards' }));
    kitPlay(chipRef.current, [
      { transform: 'scale(1.9) rotate(-14deg)', opacity: 0 },
      { transform: 'scale(.9) rotate(-4deg)', opacity: 1, offset: 0.65 },
      { transform: 'scale(1) rotate(-6deg)', opacity: 1 },
    ], { duration: 280, delay: LEAD_MS + SLIDE_MS, easing: 'cubic-bezier(.3,1.3,.5,1)', fill: 'backwards' });
  }, [climb]);

  if (!climb) return null;
  const up = climb.from - climb.to;
  const face = (id, mine) => castSrc(heroById(climb.heroes[id]) ? climb.heroes[id] : castFor(id, mine).id);
  return (
    <div className="bc" role="status" aria-label={`Board: up ${up}, now number ${climb.to}`} data-testid="board-climb">
      <span className="bc-k" aria-hidden="true">BOARD</span>
      <ol className="bc-rows" ref={rowsRef} aria-hidden="true">
        <li className="bc-row is-me">
          <b>#{formatNum(climb.to)}</b><img src={face(climb.me.id, true)} alt="" draggable="false" /><span className="bc-name">YOU</span>
          {/* the news lands ON your row */}
          <span className="bc-up" ref={chipRef}><img src="/lb/arrow-up.webp" alt="" draggable="false" />{formatNum(up)}</span>
        </li>
        {climb.passed.map((r) => (
          <li key={r.id} className="bc-row"><b>#{formatNum(r.rank)}</b><img src={face(r.id, false)} alt="" draggable="false" /><span className="bc-name">{r.username}</span></li>
        ))}
      </ol>
    </div>
  );
}
