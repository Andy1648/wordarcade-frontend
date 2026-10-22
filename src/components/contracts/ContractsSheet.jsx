// contracts/ContractsSheet.jsx — the DAILY CONTRACTS screen (lazy: the menu's DAILY chip / flame icon opens it).
// Round 2 (Andy oct21: "the daily contracts look so AI generated … I don't like how you need to scroll there"): built
// like the house's own full screens (ACHIEVEMENTS / LEADERBOARD — the v2 kit on a 1366×657 stage scaled to the window,
// so a laptop or a Chromebook never scrolls):
//   * header: KitBackButton · DAILY CONTRACTS · the STREAK chip (the painted flame) · the GEMS KitPill;
//   * left, the STREAK panel: the flame big with today's count slammed on it, the ALL-3 bonus and the reset clock;
//   * right, the day's THREE CONTRACT CARDS dealt like a hand — each a KitStampCard in its game's colour: the strip
//     (game · pay), the game's own painted art on a tilted plate, the task, have / need, the bar, GO ▸ and the one
//     SWAP of the day. A finished card takes the kit DONE stamp.
// Reads contracts/live.js; re-reads on CONTRACTS_CHANGE. Motion: the cards rise once on open (finite CSS), a swapped
// card flips once (WAAPI); nothing loops at rest. Under 1000px it stacks unscaled into one fixed-height column —
// no scroll anywhere (Andy oct21).
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { today, reroll, msToReset, CONTRACTS_CHANGE } from '../../progress/contracts/live.js';
import { BY_ID, TIER_GEMS, SWEEP_GEMS, MODE_NAME, MODE_GAME, progressOf, allDone } from '../../progress/contracts/pool.js';
import { getStreak } from '../../progress/streak.js';
import { getGems, subscribeGems } from '../../progress/gemsCore.js';
import { KitBackButton, KitGhostButton, KitPill, KitStampCard, KitIcon } from '../kit/index.js';
import { kitPlay } from '../kit/motion.js';
import { formatNum } from '../../format';
import StreakCalendar from './StreakCalendar.jsx';
import '../kit/tokens.css';
import './contracts.css';

const FLIP = [{ transform: 'rotateY(90deg)', opacity: 0 }, { transform: 'rotateY(0)', opacity: 1 }];
const TIER_WORD = { 1: 'EASY', 2: 'MEDIUM', 3: 'HARD' };
// each game's own painted art (the menu card heroes, the cast props, the achievement glyphs) — art is an asset
const ART = {
  wb: '/cards/wb-hero.webp',
  blitz: '/cards/cb-hero.webp',
  sat: '/cast/props/spellbook.webp',
  chain: '/ach/chain.svg',
  fuse: '/cast/props/bolt.webp',
  race: '/cast/props/spark-big.webp',
  any: '/ach/key.svg',
};
const TONE = { wb: 'cyan', blitz: 'hot', sat: 'yellow', chain: 'purple', fuse: 'purple', race: 'pink', any: 'lilac' };
const TILT = [-1.6, 1.1, -0.7]; // dealt like a hand, never a straight table row

function countdown(ms) {
  const m = Math.max(0, Math.ceil(ms / 60000));
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}H ${m % 60}M` : `${m}M`;
}

function useStageScale(ref) {
  useEffect(() => {
    const set = () => {
      const w = window.innerWidth;
      const k = w >= 1000 ? Math.min(w / 1366, window.innerHeight / 657) : 1;
      if (ref.current) ref.current.style.setProperty('--cx-k', Math.min(1.25, k).toFixed(4));
    };
    set();
    window.addEventListener('resize', set);
    return () => window.removeEventListener('resize', set);
  }, [ref]);
}

function Card({ id, i, s, onPlay, onSwap, swapKey }) {
  const c = BY_ID[id];
  const cardRef = useRef(null);
  useEffect(() => {
    if (swapKey) kitPlay(cardRef.current, FLIP, { duration: 340, easing: 'cubic-bezier(.2,1.2,.4,1)' });
  }, [swapKey]);
  if (!c) return null;
  const p = progressOf(s, id);
  const done = s.done.includes(id);
  const game = MODE_GAME[c.mode];
  return (
    <li ref={cardRef} className={`cx-row cx3-cell${done ? ' is-done' : ''}`} data-mode={c.mode} data-contract={id} style={{ '--i': i, '--tilt': `${TILT[i] || 0}deg` }}>
      <KitStampCard stamped={done} kind="done" className="cx3-card" at={{ left: '50%', top: '30%' }}>
        <div className="cx3-strip">
          <span>{MODE_NAME[c.mode]}</span>
          <span className="cx3-strip-pay"><KitIcon name="gems" size={18} shadow={1} extras={false} />{formatNum(TIER_GEMS[c.tier])}</span>
        </div>
        <div className="cx3-body">
          <div className="cx3-art">
            <div className="cx3-plate" aria-hidden="true" />
            <img src={ART[c.mode]} alt="" aria-hidden="true" draggable="false" />
            <span className="cx3-tier">{TIER_WORD[c.tier]}</span>
          </div>
          <p className="cx3-task">{c.text}</p>
          <div className="cx3-nums">
            <span className="cx3-have">{formatNum(p)}</span>
            <span className="cx3-need">/ {formatNum(c.target)}</span>
          </div>
          <div className="cx3-bar" aria-hidden="true"><div className="cx3-bar-fill" style={{ transform: `scaleX(${(p / c.target).toFixed(3)})` }} /></div>
          <div className="cx3-foot">
            {done ? (
              <span className="cx3-paid"><KitIcon name="gems" size={22} shadow={1} extras={false} />+{formatNum(TIER_GEMS[c.tier])} PAID</span>
            ) : (
              <>
                {game && onPlay ? (
                  <KitGhostButton tone={TONE[c.mode]} className="cx3-go" label="GO ▸" ariaLabel={`Play ${MODE_NAME[c.mode]}`} onClick={(e) => onPlay(game, e.currentTarget)} />
                ) : (
                  <span className="cx3-anygame">ANY GAME</span>
                )}
                {onSwap ? (
                  <KitGhostButton tone="lilac" className="cx3-swap" label="SWAP" ariaLabel={`Swap this contract (one swap a day): ${c.text}`} onClick={onSwap} />
                ) : null}
              </>
            )}
          </div>
        </div>
      </KitStampCard>
    </li>
  );
}

export default function ContractsSheet({ onClose, onPlay }) {
  const [s, setS] = useState(() => today());
  const [left, setLeft] = useState(() => msToReset());
  const [gems, setGems] = useState(() => getGems());
  const [swapped, setSwapped] = useState({ slot: -1, key: 0 });
  const ref = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useStageScale(ref);
  useEffect(() => subscribeGems(setGems), []);
  useEffect(() => {
    const on = () => setS(today());
    window.addEventListener(CONTRACTS_CHANGE, on);
    const t = setInterval(() => setLeft(msToReset()), 30000); // the clock reads minutes — no per-second render
    ref.current?.focus();
    const key = (e) => { if (e.key === 'Escape') onCloseRef.current?.(); };
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener(CONTRACTS_CHANGE, on); clearInterval(t); window.removeEventListener('keydown', key); };
  }, []);
  const swap = useCallback((i) => { if (reroll(i)) setSwapped({ slot: i, key: Date.now() }); }, []);

  const streak = getStreak().count;
  const n = s.done.length;
  const swept = allDone(s);
  return createPortal(
    <div ref={ref} className="cx3-overlay" role="dialog" aria-modal="true" aria-label="Daily contracts" tabIndex={-1} data-testid="contracts-sheet">
      <div className="cx3-stripes" aria-hidden="true" />
      <div className="cx3-scale">
        <div className="cx3-screen">
          <header className="cx3-head">
            <KitBackButton label="MENU" ariaLabel="Back to menu" onClick={onClose} className="cx3-back" />
            <h2 className="cx3-title"><span className="cx3-title-daily">DAILY </span>CONTRACTS</h2>
            <div className="cx3-count" aria-label={`${n} of ${s.picks.length} done today`}><b>{n}</b><span>/{s.picks.length}</span><small>TODAY</small></div>
            <div className="cx3-gems"><KitPill kind="gems" value={gems} ariaLabel={`${formatNum(gems)} gems`} /></div>
          </header>

          <div className="cx3-body-grid">
            {/* STREAK CALENDAR (preview, Andy oct21): the week's seven rewards, the LEGENDARY roll on day 7 */}
            <StreakCalendar streak={streak} />

            <ol className="cx3-hand">
              {s.picks.map((id, i) => (
                <Card key={id} id={id} i={i} s={s} onPlay={onPlay}
                  onSwap={!s.rerolled && !s.done.includes(id) ? () => swap(i) : null}
                  swapKey={swapped.slot === i ? swapped.key : 0} />
              ))}
            </ol>

            <aside className={`cx3-sweep${swept ? ' is-done' : ''}`} aria-label="Finish all three">
              <span className="cx3-sweep-pips" aria-hidden="true">
                {s.picks.map((id) => <i key={id} className={s.done.includes(id) ? 'is-done' : ''} />)}
              </span>
              <span className="cx3-sweep-k">{swept ? 'ALL 3 PAID' : 'FINISH ALL 3'}</span>
              <span className="cx3-sweep-pay"><KitIcon name="gems" size={30} shadow={2} extras={false} />+{formatNum(SWEEP_GEMS)}</span>
              <span className="cx3-reset">NEW IN <b>{countdown(left)}</b></span>
            </aside>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
