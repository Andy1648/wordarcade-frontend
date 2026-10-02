// RankUpMoment — STEP 47: "#12 → #7" on the first menu visit after a claimed player's board rank
// improves (Duolingo-league style: the CHANGE is the reward). One finite card over the menu, shown
// after a short beat so it doesn't land on top of the mount-time achievement toasts.
//
// It never blocks the menu: the card is pointer-events:none (a tap meant for a mode card goes to the
// mode card), and the news doesn't depend on catching it — the trophy keeps a dot until the board is
// opened, and the board shows the rank. Announced to screen readers via a status line. Static card
// for the same duration under reduced motion.
import { useEffect, useRef, useState } from 'react';
import { myStats } from './client.js';
import { formatNum } from '../format';
import './RankUpMoment.css';

export const RANKUP_DELAY_MS = 1600; // after the 1.5 s level-up / tier-up card (MenuXpFx)
export const RANKUP_MS = 2200;

export default function RankUpMoment({ from, to, onDone }) {
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const [on, setOn] = useState(false);
  // Andy oct2 (later): the board ranks by LEVEL (after rebirths), so the moment names the level.
  const [level] = useState(() => myStats().level);
  useEffect(() => {
    const a = setTimeout(() => setOn(true), RANKUP_DELAY_MS);
    const b = setTimeout(() => doneRef.current && doneRef.current(), RANKUP_DELAY_MS + RANKUP_MS);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);
  return (
    <div className="lb-rankup-layer">
      <p className="lb-rankup-sr" role="status">{on ? `Leaderboard rank up: from number ${from} to number ${to}.` : ''}</p>
      {on && (
        <div className="lb-rankup" aria-hidden="true">
          <span className="lb-rankup-kicker">RANK UP</span>
          <span className="lb-rankup-line">
            <span className="lb-rankup-from">#{from}</span>
            <span className="lb-rankup-arrow">→</span>
            <span className="lb-rankup-to">#{to}</span>
          </span>
          <span className="lb-rankup-sub">LV {formatNum(Number(level) || 1)} · ON THE LEADERBOARD</span>
        </div>
      )}
    </div>
  );
}
