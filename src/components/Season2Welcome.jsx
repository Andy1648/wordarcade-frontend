// Season2Welcome.jsx — THE EDITOR'S NOTE: the season-2 welcome and THE ONE NOTICE in the whole game (SEASON 2 checklist
// step 2, Andy oct6; claude/mockups/v2/Season2.dc.html). LAZY (its own chunk): v3/season2Boot.js mounts it ONCE, after the
// server reset, for a player whose welcome is pending.
// A FULL-SCREEN MOMENT in the house style (never a plain box): EDITOR'S NOTE slams in · "SORRY FOR RESCALING THE
// PROGRESSION — HERE'S SOME GEMS" · YOUR OLD RUN R{n} → YOU GET {gems} (round5(300 + 40 × old R), the server's grant) ·
// {rolls} ROLLS · COLLECT → the gems burst out of the gift and converge on the gem pill on the LEFT (gains/GainLayer —
// NIGHT oct8 #3) while its counter runs from the first landing and every landing bumps it (KitPill) → PLAY closes it. Built only from the v2 kit (KitPill, KitIcon,
// KitButton, KitGhostButton, KitFlyLayer). The credit itself happens in collect() (season2Boot.collectWelcome) — ONLY
// on the server's ok; the flight is the display of it. Every motion is a one-shot transform/opacity (no idle loop);
// REDUCE MOTION: no slam/rise, the gems land at once (KitFlyLayer).
import { useEffect, useRef, useState } from 'react';
import { KitPill, KitIcon, KitButton, KitGhostButton, useCachedCenter } from './kit/index.js';
import GainLayer from './gains/GainLayer.jsx';
import { countMs } from './gains/gainPlan.js';
import { formatNum } from '../format.js';
import { rollsLine } from '../leaderboard/season2Rules.js';
import { useMomentHold } from '../lib/useMomentSlot';
import './Season2Welcome.css';


export default function Season2Welcome({ plan, startWallet = 0, collect, onClose }) {
  // idle → busy (server) → flying (the gems are in the air; the button is dead) → done | claimed | retry
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
    if (phase === 'busy' || phase === 'flying') return;
    if (phase === 'done' || phase === 'claimed') {
      onClose();
      return;
    }
    setPhase('busy');
    const r = await collect();
    if (!live.current) return;
    if (r && r.ok) {
      const target = startWallet + r.gems;
      // NIGHT oct8 #3 — THE GAIN ANIMATION (gains/GainLayer): the gems burst out of the gift and converge on the pill;
      // the pill's counter starts on the FIRST landing (it TICKS up over countMs(gems)) and every landing BUMPS the
      // pill. The button is DEAD (hatched, taps deny) until the last gem lands — PLAY must never close the welcome
      // under gems still in the air (R2 oct8 #1). REDUCE MOTION: every gem lands at once → done in the same tick.
      if (fly.current) {
        setPhase('flying');
        fly.current.gain({
          from: from.current,
          amount: r.gems,
          onFirstLand: () => {
            if (pill.current) pill.current.countNext(countMs(r.gems));
            setWallet(target);
          },
          onLand: () => pill.current && pill.current.bump(),
          onDone: () => {
            setWallet(target);
            if (live.current) setPhase('done');
          },
        });
      } else {
        setWallet(target);
        setPhase('done');
      }
    } else if (r && r.retry) setPhase('retry');
    else setPhase('claimed');
  };

  const label = phase === 'done' || phase === 'claimed' ? 'PLAY' : phase === 'retry' ? 'TRY AGAIN' : phase === 'busy' || phase === 'flying' ? 'COLLECTING' : 'COLLECT';
  const tone = phase === 'done' || phase === 'claimed' ? 'yellow' : 'cyan';
  const dead = phase === 'busy' || phase === 'flying'; // the kit's disabled face (hatch, dead 3px press) — no lock chip
  return (
    <div className="s2w" role="dialog" aria-modal="true" aria-labelledby="s2w-title" data-testid="season2-welcome" data-phase={phase}>
      <div className="s2w-band" aria-hidden="true" />
      <div className="s2w-wallet">
        <KitPill ref={pill} kind="gems" value={wallet} ariaLabel={`Gems: ${formatNum(wallet)}`} />
      </div>
      <header className="s2w-head">
        <h1 id="s2w-title" className="s2w-title s2w-slam">EDITOR&apos;S NOTE</h1>
        <p className="s2w-sub s2w-rise" style={{ '--s2w-d': '300ms' }}>SORRY FOR RESCALING THE PROGRESSION — HERE&apos;S SOME GEMS</p>
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
        <KitButton ref={btnRef} tone={tone} label={label} labelSize={38} width={360} disabled={dead} onClick={onCollect} data-testid="season2-collect" />
        {phase === 'claimed' && <p className="s2w-note" role="status">ALREADY COLLECTED — NOTHING NEW TO ADD</p>}
        {phase === 'retry' && (
          <>
            <p className="s2w-note" role="status">COULDN&apos;T REACH THE SERVER — YOUR GEMS ARE SAFE</p>
            <KitGhostButton label="LATER" tone="cyan" onClick={onClose} />
          </>
        )}
        {(phase === 'idle' || phase === 'busy' || phase === 'flying') && <p className="s2w-once">SHOWS ONCE</p>}
      </div>
      <GainLayer ref={fly} icon="gems" target={() => pill.current && pill.current.iconEl()} />
    </div>
  );
}
