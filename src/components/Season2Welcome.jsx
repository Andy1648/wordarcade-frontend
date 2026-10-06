// Season2Welcome.jsx — THE SEASON 2 WELCOME (claude/mockups/v2/Season2.dc.html; PROGRESSION v3 phase 4, the reset).
// LAZY (its own chunk): v3/season2Boot.js mounts it once, after the server reset, for a player whose welcome is pending.
// A FULL-SCREEN MOMENT (never a centre popup): SEASON 2 slams in · "SORRY FOR THE MAINTENANCE · EVERYONE STARTS FRESH" ·
// YOUR OLD RUN R{n} → YOU GET {gems} · {rolls} ROLLS (· EPIC+ GUARANTEED from 50 rolls) · COLLECT → the gems fly into
// the wallet pill (KitFlyLayer → KitPill counts up) → PLAY closes it. Built only from the v2 kit (KitPill, KitIcon,
// KitButton, KitGhostButton, KitFlyLayer). The credit itself happens in collect() (season2Boot.collectWelcome) — ONLY
// on the server's ok; the flight is the display of it. Every motion is a one-shot transform/opacity (no idle loop);
// REDUCE MOTION: no slam/rise, the gems land at once (KitFlyLayer).
import { useEffect, useRef, useState } from 'react';
import { KitPill, KitIcon, KitButton, KitGhostButton, KitFlyLayer, useCachedCenter } from './kit/index.js';
import { formatNum } from '../format.js';
import { rollsLine } from '../leaderboard/season2Rules.js';
import { useMomentHold } from '../lib/useMomentSlot';
import './Season2Welcome.css';

/** Split `total` into ≤ n flying chunks that sum to it exactly. */
export function flyChunks(total, n = 10) {
  const t = Math.max(0, Math.floor(total));
  if (!t) return [];
  const k = Math.min(n, t);
  const base = Math.floor(t / k);
  return Array.from({ length: k }, (_, i) => base + (i < t - base * k ? 1 : 0));
}

export default function Season2Welcome({ plan, startWallet = 0, collect, onClose }) {
  // idle → busy → done | claimed | retry
  const [phase, setPhase] = useState('idle');
  const [wallet, setWallet] = useState(startWallet);
  const pill = useRef(null);
  const fly = useRef(null);
  const giftRef = useRef(null);
  const btnRef = useRef(null);
  const from = useCachedCenter(giftRef);
  const live = useRef(true);
  useMomentHold(true); // no queued menu moment starts under the welcome
  useEffect(() => {
    live.current = true;
    // the menu types on keystrokes: while the welcome is up, keys belong to it (Enter/Space still press its button)
    const stop = (e) => {
      if (e.target && e.target.closest && e.target.closest('.s2w')) return;
      e.stopImmediatePropagation();
    };
    window.addEventListener('keydown', stop, true);
    if (btnRef.current && btnRef.current.focus) btnRef.current.focus({ preventScroll: true });
    return () => {
      live.current = false;
      window.removeEventListener('keydown', stop, true);
    };
  }, []);

  const gems = plan.gems;
  const onCollect = async () => {
    if (phase === 'busy') return;
    if (phase === 'done' || phase === 'claimed') {
      onClose();
      return;
    }
    setPhase('busy');
    const r = await collect();
    if (!live.current) return;
    if (r && r.ok) {
      setPhase('done');
      const target = startWallet + r.gems;
      if (fly.current) {
        fly.current.fly({
          from: from.current,
          amounts: flyChunks(r.gems),
          onLand: (amt) => setWallet((w) => Math.min(target, w + amt)),
          onDone: () => setWallet(target),
        });
      } else setWallet(target);
    } else if (r && r.retry) setPhase('retry');
    else setPhase('claimed');
  };

  const label = phase === 'done' || phase === 'claimed' ? 'PLAY' : phase === 'retry' ? 'TRY AGAIN' : phase === 'busy' ? 'COLLECTING' : 'COLLECT';
  const tone = phase === 'done' || phase === 'claimed' ? 'yellow' : 'cyan';
  return (
    <div className="s2w" role="dialog" aria-modal="true" aria-labelledby="s2w-title" data-testid="season2-welcome" data-phase={phase}>
      <div className="s2w-band" aria-hidden="true" />
      <div className="s2w-wallet">
        <KitPill ref={pill} kind="gems" value={wallet} ariaLabel={`Gems: ${formatNum(wallet)}`} />
      </div>
      <header className="s2w-head">
        <h1 id="s2w-title" className="s2w-title s2w-slam">SEASON 2</h1>
        <p className="s2w-sub s2w-rise" style={{ '--s2w-d': '300ms' }}>SORRY FOR THE MAINTENANCE · EVERYONE STARTS FRESH</p>
      </header>
      <div className="s2w-trade">
        <div className="s2w-col s2w-rise" style={{ '--s2w-d': '450ms' }}>
          <span className="s2w-cap">YOUR OLD RUN</span>
          <span className="s2w-oldr" data-testid="season2-old-run">R{formatNum(plan.oldR)}</span>
        </div>
        <span className="s2w-arrow s2w-rise" style={{ '--s2w-d': '550ms' }} aria-hidden="true">
          <svg width="84" height="50" viewBox="0 0 70 44" focusable="false">
            <path d="M4 16 L44 16 L44 4 L66 22 L44 40 L44 28 L4 28 Z" fill="#2EFFE0" stroke="#000" strokeWidth="5" strokeLinejoin="round" />
          </svg>
        </span>
        <div className="s2w-col s2w-rise" style={{ '--s2w-d': '650ms' }}>
          <span className="s2w-cap">YOU GET</span>
          <span className="s2w-gift" ref={giftRef}>
            <KitIcon name="gems" size={68} />
            <span className="s2w-gems" data-testid="season2-gems">{formatNum(gems)}</span>
          </span>
          <span className="s2w-rolls" data-testid="season2-rolls">{rollsLine(gems, formatNum)}</span>
        </div>
      </div>
      <div className="s2w-foot">
        <KitButton ref={btnRef} tone={tone} label={label} labelSize={38} width={360} onClick={onCollect} data-testid="season2-collect" />
        {phase === 'claimed' && <p className="s2w-note" role="status">ALREADY COLLECTED — NOTHING NEW TO ADD</p>}
        {phase === 'retry' && (
          <>
            <p className="s2w-note" role="status">COULDN&apos;T REACH THE SERVER — YOUR GEMS ARE SAFE</p>
            <KitGhostButton label="LATER" tone="cyan" onClick={onClose} />
          </>
        )}
        {(phase === 'idle' || phase === 'busy') && <p className="s2w-once">SHOWS ONCE</p>}
      </div>
      <KitFlyLayer ref={fly} target={() => pill.current && pill.current.iconEl()} />
    </div>
  );
}
