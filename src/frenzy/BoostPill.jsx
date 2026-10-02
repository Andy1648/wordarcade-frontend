// BoostPill — R10: the gold "BOOST ×3 · 9:41" pill while a BOOST code's timer runs. It JOINS existing
// clusters (the menu's XP bar row, the in-game rate stack) — never an orphan fixed element. In the
// last 10 s it pulses red: a FINITE animation (10 iterations of 1 s), never an infinite loop.
import { boostRemaining, boostMult } from '../progress/boost.js';
import { formatFrenzy } from '../progress/frenzy.js';
import { useTimerClock } from './useTimerClock.js';
import './BoostPill.css';

export default function BoostPill({ className = '' }) {
  const { ms, active } = useTimerClock(boostRemaining);
  if (!active) return null;
  const ending = ms <= 10000;
  return (
    <span className={`boost-pill${ending ? ' is-ending' : ''} ${className}`} role="status" aria-label={`Boost times ${boostMult()} for ${formatFrenzy(ms)}`}>
      <span className="boost-pill-name">BOOST ×{boostMult()}</span>
      <span className="boost-pill-clock">{formatFrenzy(ms)}</span>
    </span>
  );
}
