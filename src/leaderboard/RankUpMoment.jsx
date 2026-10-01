// RankUpMoment — STEP 47: "#12 → #7" on the first menu visit after a claimed player's board rank
// improves (Duolingo-league style: the CHANGE is the reward). One finite 2.2s card over the menu;
// tap to dismiss; static card for the same 2.2s under reduced motion. The trophy button keeps a
// badge until the board is opened (Homepage / MobileMenu), so the news is never lost to a blink.
import { useEffect, useRef } from 'react';
import './RankUpMoment.css';

export const RANKUP_MS = 2200;

export default function RankUpMoment({ from, to, onDone }) {
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    const t = setTimeout(() => doneRef.current && doneRef.current(), RANKUP_MS);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="lb-rankup-layer">
      <button type="button" className="lb-rankup" onClick={() => doneRef.current && doneRef.current()} aria-label={`Rank up: from number ${from} to number ${to}. Dismiss`}>
        <span className="lb-rankup-kicker">RANK UP</span>
        <span className="lb-rankup-line" aria-hidden="true">
          <span className="lb-rankup-from">#{from}</span>
          <span className="lb-rankup-arrow">→</span>
          <span className="lb-rankup-to">#{to}</span>
        </span>
        <span className="lb-rankup-sub">ON THE LEADERBOARD 🏆</span>
      </button>
    </div>
  );
}
