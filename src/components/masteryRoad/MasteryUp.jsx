// MasteryUp.jsx — the MASTERY UP end-card line (MODE MASTERY ROADS, progress/masteryRoad.js) + the hooks that mark a
// game's starting mastery level. Its own file + CSS so the game chunks never pull in the road (MasteryRoad.jsx).
import { useEffect, useRef, useState } from 'react';
import { roadStatus, masteryMark, ROAD_MODES } from '../../progress/masteryRoad.js';
import { formatNum } from '../../format';
import './MasteryUp.css';

const words = (n) => `${formatNum(n)} ${n === 1 ? 'WORD' : 'WORDS'}`;

/** The mastery level when a game / run started: re-marked on every not-playing → playing flip (a solo run, a race). */
export function useMasteryRunMark(mode, playing) {
  const [since, setSince] = useState(() => masteryMark(mode));
  const was = useRef(!!playing);
  useEffect(() => {
    if (playing && !was.current) setSince(masteryMark(mode));
    was.current = !!playing;
  }, [playing, mode]);
  return since;
}
/** The mastery level when a game started: re-marked whenever `resetKey` changes (a multiplayer game nonce). */
export function useMasteryGameMark(mode, resetKey) {
  const [since, setSince] = useState(() => masteryMark(mode));
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setSince(masteryMark(mode));
  }, [resetKey, mode]);
  return since;
}

/** END CARD: "MASTERY UP" when this game crossed a mastery level — null otherwise (nothing to say, no row). */
export function MasteryUpLine({ mode, since, className = '' }) {
  const s = roadStatus(mode);
  if (!s || !(since > 0) || s.level <= since) return null;
  const m = ROAD_MODES[mode];
  const ready = s.nodes.find((n) => n.state === 'ready');
  const show = ready || s.next;
  return (
    <div className={`mr-up ${className}`} style={{ '--mr-c': m.color }} data-testid="mastery-up" data-level={s.level}>
      <span className="mr-up-k">MASTERY UP</span>
      <span className="mr-up-lv">{m.name} <b>{formatNum(s.level)}</b></span>
      {show ? (
        <span className={`mr-up-next${ready ? ' is-ready' : ''}`}>
          <img className="mr-up-art" src={show.reward.art} width="36" height="36" alt="" aria-hidden="true" draggable="false" />
          {ready ? <span><b>{show.reward.name}</b> READY</span> : <span>{show.reward.name} · {words(show.toGo)}</span>}
        </span>
      ) : null}
    </div>
  );
}
