// RankUpMoment — STEP 47: "#12 → #7" on the first menu visit after a claimed player's board rank
// improves (Duolingo-league style: the CHANGE is the reward). One finite card over the menu. H5: it is
// mounted only when its turn comes on the ONE moments queue (Homepage announces it at PRIORITY.LEVEL), so
// it plays at once — the old 1.6 s RANKUP_DELAY_MS guess at the level-up card's length is gone.
//
// It never blocks the menu: the card is pointer-events:none (a tap meant for a mode card goes to the
// mode card), and the news doesn't depend on catching it — the trophy keeps a dot until the board is
// opened, and the board shows the rank. Announced to screen readers via a status line. Static card
// for the same duration under reduced motion.
import { useEffect, useRef, useState } from 'react';
import { myStats } from './client.js';
import { formatNum } from '../format';
import PodiumIcon from '../components/PodiumIcon';
import { RANKUP_MS } from '../lib/menuMoments.js';
import './RankUpMoment.css';

export { RANKUP_MS };
// the "#to" pops at 30-40% of the card (lb-rankup-pop): the menu's podium bounces + ticks on the same beat
export const RANKUP_POP_MS = Math.round(RANKUP_MS * 0.36);

export default function RankUpMoment({ from, to, onDone, onPop }) {
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const popRef = useRef(onPop);
  popRef.current = onPop;
  // Andy oct2 (later): the board ranks by LEVEL (after rebirths), so the moment names the level.
  const [level] = useState(() => myStats().level);
  // a live region announces a CHANGE, so the status line fills a beat after the region mounts
  const [said, setSaid] = useState(false);
  useEffect(() => {
    const a = setTimeout(() => setSaid(true), 60);
    const b = setTimeout(() => doneRef.current && doneRef.current(), RANKUP_MS);
    const c = setTimeout(() => popRef.current && popRef.current(), RANKUP_POP_MS);
    return () => { clearTimeout(a); clearTimeout(b); clearTimeout(c); };
  }, []);
  return (
    <div className="lb-rankup-layer">
      <p className="lb-rankup-sr" role="status">{said ? `Leaderboard rank up: from number ${from} to number ${to}.` : ''}</p>
      <div className="lb-rankup" aria-hidden="true">
        {/* the same podium glyph as the menu's golden button — one symbol for the leaderboard. It wears the
            STAR here, not the rank: "#to" is already the line right under it */}
        <PodiumIcon size={64} className="lb-rankup-podium" />
        <span className="lb-rankup-kicker">RANK UP</span>
        <span className="lb-rankup-line">
          <span className="lb-rankup-from">#{from}</span>
          <span className="lb-rankup-arrow">→</span>
          <span className="lb-rankup-to">#{to}</span>
        </span>
        <span className="lb-rankup-sub">LV {formatNum(Number(level) || 1)} · ON THE LEADERBOARD</span>
      </div>
    </div>
  );
}
