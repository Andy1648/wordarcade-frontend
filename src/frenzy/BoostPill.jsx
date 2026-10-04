// BoostPill — R10: the gold "BOOST ×3 · 9:41" pill while a BOOST code's timer runs. It JOINS existing
// clusters (the menu's XP bar row, the phone menu's top row, the in-game rate stack) — never an orphan
// fixed element. In the last 10 s it pulses red: a FINITE animation (10 iterations of 1 s), never an
// infinite loop.
//
// Rebirth Rush: OVERDRIVE (overdrive.js, random ×10 XP & wins for 5 min) rides the SAME slot, as a bigger
// pink "OVERDRIVE ×10 · 4:59" pill in front of the boost pill — every surface that shows a boost shows it
// with no new fixed UI. The boost pill names the CODE boost alone (codeBoostMult), so the two never
// double-count (boostMult() now folds OVERDRIVE in).
import { boostRemaining, codeBoostMult } from '../progress/boost.js';
import { overdriveRemaining, OVERDRIVE_MULT } from '../progress/overdrive.js';
import { formatFrenzy } from '../progress/frenzy.js';
import { formatNum } from '../format.js';
import { useTimerClock } from './useTimerClock.js';
import './BoostPill.css';
import './MechanicScale.css';

export function OverdrivePill({ className = '' }) {
  const { ms, active } = useTimerClock(overdriveRemaining);
  if (!active) return null;
  const ending = ms <= 10000;
  return (
    <span
      className={`boost-pill od-pill${ending ? ' is-ending' : ''} ${className}`}
      role="status"
      aria-label={`Overdrive times ${OVERDRIVE_MULT} for ${formatFrenzy(ms)}`}
      data-testid="overdrive-pill"
    >
      <span className="boost-pill-name">OVERDRIVE ×{formatNum(OVERDRIVE_MULT)}</span>
      <span className="boost-pill-clock">{formatFrenzy(ms)}</span>
    </span>
  );
}

function CodeBoostPill({ className = '' }) {
  const { ms, active } = useTimerClock(boostRemaining);
  if (!active) return null;
  const ending = ms <= 10000;
  const m = codeBoostMult();
  return (
    <span className={`boost-pill${ending ? ' is-ending' : ''} ${className}`} role="status" aria-label={`Boost times ${m} for ${formatFrenzy(ms)}`}>
      <span className="boost-pill-name">BOOST ×{formatNum(m)}</span>
      <span className="boost-pill-clock">{formatFrenzy(ms)}</span>
    </span>
  );
}

export default function BoostPill({ className = '' }) {
  return (
    <>
      <OverdrivePill className={className} />
      <CodeBoostPill className={className} />
    </>
  );
}
