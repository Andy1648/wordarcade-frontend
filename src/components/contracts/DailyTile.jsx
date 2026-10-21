// contracts/DailyTile.jsx — the menu's DAILY tile: the streak FLAME CHIP + today's three contracts as pips + "1/3".
// It JOINS the corner rail (MenuRail's `daily` slot, under UPGRADES · GEARS · REBIRTH · STATS) — never its own fixed
// spot. A tap opens the CONTRACTS sheet (lazy). Static at rest (MENU MOTION LAW); the flame pops once when a contract
// finished while the menu is up.
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { today, CONTRACTS_CHANGE } from '../../progress/contracts/live.js';
import { getStreak } from '../../progress/streak.js';
import { kitPlay } from '../kit/motion.js';
import { formatNum } from '../../format';

const ContractsSheet = lazy(() => import('./ContractsSheet.jsx'));
const POP = [{ transform: 'scale(1)' }, { transform: 'scale(1.3) rotate(-8deg)', offset: 0.4 }, { transform: 'scale(1) rotate(0)' }];

export default function DailyTile({ onPlay, navigating = false }) {
  const [s, setS] = useState(() => today());
  const [streak, setStreak] = useState(() => getStreak().count);
  const [open, setOpen] = useState(false);
  const flame = useRef(null);
  const doneRef = useRef(s.done.length);
  useEffect(() => {
    const on = () => {
      const next = today();
      if (next.done.length > doneRef.current) kitPlay(flame.current, POP, { duration: 380, easing: 'cubic-bezier(.2,1.4,.4,1)' });
      doneRef.current = next.done.length;
      setS(next);
      setStreak(getStreak().count);
    };
    const vis = () => { if (document.visibilityState === 'visible') on(); };
    window.addEventListener(CONTRACTS_CHANGE, on);
    document.addEventListener('visibilitychange', vis);
    return () => { window.removeEventListener(CONTRACTS_CHANGE, on); document.removeEventListener('visibilitychange', vis); };
  }, []);
  const n = s.done.length;
  const of = s.picks.length;
  return (
    <>
      <button
        type="button"
        className={`hp-daily${n >= of ? ' is-swept' : ''}`}
        data-nav="contracts"
        disabled={navigating}
        onClick={() => setOpen(true)}
        aria-label={`Daily contracts — ${n} of ${of} done · ${streak} day streak`}
      >
        <span ref={flame} className={`hp-daily-flame${streak > 0 ? '' : ' is-cold'}`} aria-hidden="true">
          <img src="/cast/props/flame.webp" alt="" width="64" height="64" draggable="false" />
          <b className="hp-daily-n">{formatNum(streak)}</b>
        </span>
        <span className="hp-daily-txt" aria-hidden="true">
          <span className="hp-daily-k">CONTRACTS</span>
          <span className="hp-daily-row">
            <span className="hp-daily-pips">
              {s.picks.map((id) => <i key={id} className={s.done.includes(id) ? 'is-done' : ''} />)}
            </span>
            <span className="hp-daily-count">{n}/{of}</span>
          </span>
        </span>
      </button>
      {open ? (
        <Suspense fallback={null}>
          <ContractsSheet onClose={() => setOpen(false)} onPlay={onPlay ? (id, el) => { setOpen(false); onPlay(id, el); } : null} />
        </Suspense>
      ) : null}
    </>
  );
}
