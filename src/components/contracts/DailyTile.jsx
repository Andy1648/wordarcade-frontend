// contracts/DailyTile.jsx — the menu's DAILY tile: the streak FLAME CHIP + today's three contracts as pips + "1/3".
// Two faces, both JOINING an existing cluster (never their own fixed spot — Andy oct21 "put the dailies on right side
// where profile is"): `chip` (default) in the paged desktop's right column under the icons, `icon` as the icon
// cluster's first tile (narrow desktop + phone). A tap opens the CONTRACTS sheet (lazy). Static at rest (MENU MOTION LAW); the flame pops once when a contract
// finished while the menu is up. It reads storage through the eager bus only — the pool + rules (contracts/live.js) load
// on the first gesture, deal a new day and say so on CONTRACTS_CHANGE (payload ratchet: the homepage carries none of it).
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { peekToday, loadLive, CONTRACTS_CHANGE } from '../../progress/contracts/bus.js';
import { getStreak } from '../../progress/streak.js';
import { kitPlay } from '../kit/motion.js';
import { KitIconButton } from '../kit/KitNavButton.jsx';
import { formatNum } from '../../format';

const ContractsSheet = lazy(() => import('./ContractsSheet.jsx'));
const EMPTY = { picks: ['a', 'b', 'c'], done: [] }; // three empty pips until today is dealt
const POP = [{ transform: 'scale(1)' }, { transform: 'scale(1.3) rotate(-8deg)', offset: 0.4 }, { transform: 'scale(1) rotate(0)' }];

export default function DailyTile({ onPlay, navigating = false, variant = 'chip' }) {
  const [s, setS] = useState(() => peekToday() || EMPTY);
  const [streak, setStreak] = useState(() => getStreak().count);
  const [open, setOpen] = useState(false);
  const flame = useRef(null);
  const doneRef = useRef(s.done.length);
  useEffect(() => {
    const on = () => {
      const next = peekToday() || EMPTY;
      if (next.done.length > doneRef.current) kitPlay(flame.current, POP, { duration: 380, easing: 'cubic-bezier(.2,1.4,.4,1)' });
      doneRef.current = next.done.length;
      setS(next);
      setStreak(getStreak().count);
    };
    const vis = () => { if (document.visibilityState === 'visible') on(); };
    window.addEventListener(CONTRACTS_CHANGE, on);
    document.addEventListener('visibilitychange', vis);
    // deal today on the first gesture (writes + fires CONTRACTS_CHANGE on a new day) — never before one (payload ratchet)
    const deal = () => { off(); loadLive().then((m) => { m.today(); on(); }, () => {}); };
    const off = () => { window.removeEventListener('pointerdown', deal, true); window.removeEventListener('keydown', deal, true); };
    window.addEventListener('pointerdown', deal, true);
    window.addEventListener('keydown', deal, true);
    return () => { off(); window.removeEventListener(CONTRACTS_CHANGE, on); document.removeEventListener('visibilitychange', vis); };
  }, []);
  const n = s.done.length;
  const of = s.picks.length;
  const label = `Daily contracts — ${n} of ${of} done · ${streak} day streak`;
  const sheet = open ? (
    <Suspense fallback={null}>
      <ContractsSheet onClose={() => setOpen(false)} onPlay={onPlay ? (id, el) => { setOpen(false); onPlay(id, el); } : null} />
    </Suspense>
  ) : null;
  if (variant === 'icon') {
    return (
      <>
        <KitIconButton art="/cast/props/flame.webp" tone="hot" className="hp-ico is-daily" data-nav="contracts" tag={`${n}/${of}`}
          dot={n === 0 ? 1 : undefined} disabled={navigating} onClick={() => setOpen(true)} ariaLabel={label} title="Daily contracts" />
        {sheet}
      </>
    );
  }
  return (
    <>
      <button
        type="button"
        className={`hp-daily${n >= of ? ' is-swept' : ''}`}
        data-nav="contracts"
        disabled={navigating}
        onClick={() => setOpen(true)}
        aria-label={label}
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
      {sheet}
    </>
  );
}
