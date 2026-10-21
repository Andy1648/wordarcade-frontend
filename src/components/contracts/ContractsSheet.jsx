// contracts/ContractsSheet.jsx — the DAILY CONTRACTS sheet (lazy: the rail's DAILY tile opens it). The streak strip,
// today's three tasks (mode tag · the task · a progress bar · the gem pay · GO into that mode · the day's one SWAP),
// the ALL-3 sweep bonus, and the reset countdown. Reads contracts/live.js; re-reads on CONTRACTS_CHANGE.
// Motion: the panel pops and the rows rise once on open (finite WAAPI, kitPlay); a swapped row flips once. Nothing loops.
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { today, reroll, msToReset, CONTRACTS_CHANGE } from '../../progress/contracts/live.js';
import { BY_ID, TIER_GEMS, SWEEP_GEMS, MODE_NAME, MODE_GAME, progressOf, allDone } from '../../progress/contracts/pool.js';
import { getStreak } from '../../progress/streak.js';
import { GemIcon } from '../gems/GemChip.jsx';
import { kitPlay } from '../kit/motion.js';
import { formatNum } from '../../format';
import '../kit/tokens.css';
import './contracts.css';

const POP = [{ transform: 'scale(.88)', opacity: 0 }, { transform: 'scale(1.02)', opacity: 1, offset: 0.65 }, { transform: 'scale(1)', opacity: 1 }];
const RISE = [{ transform: 'translateY(-16px)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }];
const FLIP = [{ transform: 'rotateX(90deg)', opacity: 0 }, { transform: 'rotateX(0)', opacity: 1 }];
const TIER_WORD = { 1: 'EASY', 2: 'MEDIUM', 3: 'HARD' };

function countdown(ms) {
  const m = Math.max(0, Math.ceil(ms / 60000));
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}H ${m % 60}M` : `${m}M`;
}

export default function ContractsSheet({ onClose, onPlay }) {
  const [s, setS] = useState(() => today());
  const [left, setLeft] = useState(() => msToReset());
  const sheet = useRef(null);
  const swapped = useRef(null);
  const closeRef = useRef(null);
  useEffect(() => {
    const on = () => setS(today());
    window.addEventListener(CONTRACTS_CHANGE, on);
    const t = setInterval(() => setLeft(msToReset()), 30000); // the countdown reads minutes — no per-second render
    return () => { window.removeEventListener(CONTRACTS_CHANGE, on); clearInterval(t); };
  }, []);
  useEffect(() => {
    const el = sheet.current;
    if (!el) return;
    kitPlay(el, POP, { duration: 260, easing: 'cubic-bezier(.2,1.2,.4,1)', fill: 'backwards' });
    el.querySelectorAll('.cx-row').forEach((r, i) => kitPlay(r, RISE, { duration: 300, delay: 120 + i * 70, easing: 'cubic-bezier(.2,1.2,.4,1)', fill: 'backwards' }));
    if (closeRef.current) closeRef.current.focus();
  }, []);
  useEffect(() => {
    const key = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);
  useEffect(() => {
    if (swapped.current == null || !sheet.current) return;
    const row = sheet.current.querySelectorAll('.cx-row')[swapped.current];
    swapped.current = null;
    kitPlay(row, FLIP, { duration: 320, easing: 'cubic-bezier(.2,1.2,.4,1)' });
  }, [s]);
  const swap = useCallback((i) => {
    swapped.current = i;
    if (!reroll(i)) swapped.current = null;
  }, []);

  const streak = getStreak().count;
  const sweepDone = allDone(s);
  return createPortal(
    <div className="cx-scrim" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={sheet} className="cx-sheet" role="dialog" aria-modal="true" aria-labelledby="cx-title" data-testid="contracts-sheet">
        <div className="cx-head">
          <img src="/cast/props/page.webp" alt="" width="54" height="54" draggable="false" />
          <h2 id="cx-title" className="cx-title">DAILY CONTRACTS</h2>
          <button ref={closeRef} type="button" className="cx-x" onClick={onClose} aria-label="Close contracts">✕</button>
        </div>
        <div className={`cx-streak${streak > 0 ? '' : ' is-cold'}`}>
          <img src="/cast/props/flame.webp" alt="" width="44" height="44" draggable="false" />
          <span className="cx-streak-n">{formatNum(streak)}</span>
          <span className="cx-streak-k">DAY STREAK<small>one word a day keeps it</small></span>
        </div>
        <ol className="cx-list">
          {s.picks.map((id, i) => {
            const c = BY_ID[id];
            if (!c) return null;
            const p = progressOf(s, id);
            const done = s.done.includes(id);
            const game = MODE_GAME[c.mode];
            return (
              <li key={id} className={`cx-row${done ? ' is-done' : ''}`} data-mode={c.mode} data-contract={id}>
                <span className="cx-tag">{MODE_NAME[c.mode]}<span className="cx-tier">{TIER_WORD[c.tier]}</span></span>
                <span className="cx-pay"><GemIcon size={22} />+{formatNum(TIER_GEMS[c.tier])}</span>
                <p className="cx-text">{c.text}</p>
                <span className="cx-bar-wrap">
                  <span className="cx-bar" aria-hidden="true"><i className="cx-fill" style={{ transform: `scaleX(${p / c.target})` }} /></span>
                  <span className="cx-num">{formatNum(p)}/{formatNum(c.target)}</span>
                </span>
                {done ? (
                  <span className="cx-stamp">DONE</span>
                ) : (
                  <span className="cx-act">
                    {!s.rerolled ? (
                      <button type="button" className="cx-btn is-swap" onClick={() => swap(i)} aria-label={`Swap this contract (one swap a day): ${c.text}`}>SWAP</button>
                    ) : null}
                    {game && onPlay ? (
                      <button type="button" className="cx-btn" onClick={(e) => onPlay(game, e.currentTarget)} aria-label={`Play ${MODE_NAME[c.mode]}`}>GO ▸</button>
                    ) : null}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
        <div className={`cx-sweep${sweepDone ? ' is-done' : ''}`}>
          <span>{sweepDone ? 'ALL 3 DONE — PAID' : 'FINISH ALL 3'}</span>
          <b><GemIcon size={22} />+{formatNum(SWEEP_GEMS)}</b>
        </div>
        <p className="cx-foot">NEW CONTRACTS IN <b>{countdown(left)}</b>{s.rerolled ? '' : ' · ONE SWAP A DAY'}</p>
      </div>
    </div>,
    document.body,
  );
}
