// quests/QuestsSheet.jsx — the QUEST LIST (progression phase 1; lazy). Reached from a quest row / the nudge on the results
// card's PROGRESS PARADE, and from the menu's DAILY tile (the CONTRACTS sheet's QUESTS tab — it JOINS that door, no new
// fixed UI). Built on the CONTRACTS sheet's own stage (contracts.css cx3-*: the 1366×657 stage scaled to the window, a
// phone gets one fixed-height column — no scroll anywhere):
//   * header: KitBackButton · QUESTS · the CONTRACTS tab (when opened from the menu) · the reset clock;
//   * left, the RULES panel: what a quest pays (+50% of that game's wins + XP, never gems), the free reroll, the clock;
//   * right, the board: 3 DAILY cards (EASY / MEDIUM / HARD) + the WEEKLY — the game's art, the task, have / need, the
//     bar, the one free SWAP a day; a finished card takes the DONE stamp and says what it paid.
// Reads progress/questsLive.js; re-reads on QUESTS_CHANGE. Motion: the cards rise once (finite CSS), a swapped card
// flips once (WAAPI); nothing loops at rest.
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { today, reroll, msToReset, QUESTS_CHANGE } from '../../progress/questsLive.js';
import { board, TIER_WORD, WEEK, MODE_NAME, MODE_GAME, PAY_SHARE } from '../../progress/quests.js';
import { KitBackButton, KitGhostButton, KitStamp } from '../kit/index.js';
import { kitPlay } from '../kit/motion.js';
import { formatNum } from '../../format';
import { QUEST_ART, MODE_ART, MODE_TONE } from '../results/questArt.js';
import '../kit/tokens.css';
import '../contracts/contracts.css';
import './quests.css';

const FLIP = [{ transform: 'rotateY(90deg)', opacity: 0 }, { transform: 'rotateY(0)', opacity: 1 }];

function countdown(ms) {
  const m = Math.max(0, Math.ceil(ms / 60000));
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}H ${m % 60}M` : `${m}M`;
}

function useStageScale(ref) {
  useEffect(() => {
    const set = () => {
      const w = window.innerWidth;
      const k = w >= 700 ? Math.min(w / 1366, window.innerHeight / 657) : 1;
      if (ref.current) ref.current.style.setProperty('--cx-k', Math.min(1.25, k).toFixed(4));
    };
    set();
    window.addEventListener('resize', set);
    return () => window.removeEventListener('resize', set);
  }, [ref]);
}

function Card({ item, i, onSwap, onPlay, swapKey }) {
  const { id, q, have, done, paid } = item;
  const ref = useRef(null);
  useEffect(() => {
    if (swapKey) kitPlay(ref.current, FLIP, { duration: 340, easing: 'cubic-bezier(.2,1.2,.4,1)' });
  }, [swapKey]);
  const weekly = q.tier === WEEK;
  const game = MODE_GAME[q.mode];
  return (
    <li ref={ref} className={`qs-card${done ? ' is-done' : ''}${weekly ? ' is-weekly' : ''}`} data-mode={q.mode} data-quest={id} style={{ '--i': i }}>
      <div className="qs-strip">
        <span>{weekly ? 'WEEKLY' : MODE_NAME[q.mode]}</span>
        <span className="qs-tier">{TIER_WORD[q.tier]}</span>
      </div>
      <div className="qs-body">
        {/* two rows on a phone (art · task · count / bar · actions); one centred column on the laptop stage */}
        <div className="qs-top">
          <div className="qs-art" aria-hidden="true">
            <img src={weekly && QUEST_ART.weekly ? QUEST_ART.weekly : MODE_ART[q.mode] || MODE_ART.any} alt="" width="96" height="96" draggable="false" />
          </div>
          <p className="qs-task">{q.text}</p>
          <div className="qs-nums">
            <span className="qs-have">{formatNum(have)}</span>
            <span className="qs-need">/ {formatNum(q.target)}</span>
          </div>
        </div>
        <span className="qs-bar" aria-hidden="true"><span className="qs-fill" style={{ transform: `scaleX(${Math.min(1, have / q.target)})` }} /></span>
        <div className="qs-foot">
          {done ? (
            <span className="qs-paid">{paid ? `+${formatNum(paid.wins)} WINS · +${formatNum(paid.xp)} XP` : 'PAYS AT GAME END'}</span>
          ) : (
            <>
              {game && onPlay ? <KitGhostButton tone={MODE_TONE[q.mode]} className="qs-go" label="GO ▸" ariaLabel={`Play ${MODE_NAME[q.mode]}`} onClick={(e) => onPlay(game, e.currentTarget)} /> : <span className="qs-any">{weekly ? 'ALL WEEK' : 'ANY GAME'}</span>}
              {onSwap ? <KitGhostButton tone="lilac" className="qs-swap" label="SWAP" ariaLabel={`Swap this quest (one free swap a day): ${q.text}`} onClick={onSwap} /> : null}
            </>
          )}
        </div>
      </div>
      {done ? (
        <span className="qs-stamp" aria-hidden="true">
          {QUEST_ART.doneStamp ? <img src={QUEST_ART.doneStamp} alt="" width="512" height="256" draggable="false" /> : <KitStamp kind="done" angle={-11} />}
        </span>
      ) : null}
    </li>
  );
}

/**
 * @param {Function} p.onClose
 * @param {Function} [p.onPlay]   (gameId, el) → open that mode (the menu passes its dialog opener)
 * @param {Function} [p.onTab]    → the CONTRACTS sheet (only from the menu's DAILY door)
 */
export default function QuestsSheet({ onClose, onPlay = null, onTab = null }) {
  const [s, setS] = useState(() => today());
  const [left, setLeft] = useState(() => msToReset());
  const [swapped, setSwapped] = useState({ slot: -1, key: 0 });
  const ref = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useStageScale(ref);
  useEffect(() => {
    const on = () => setS(today());
    window.addEventListener(QUESTS_CHANGE, on);
    const t = setInterval(() => { setLeft(msToReset()); on(); }, 30000); // minutes on the clock; a midnight deals the new day
    ref.current?.focus();
    const key = (e) => { if (e.key === 'Escape') onCloseRef.current?.(); };
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener(QUESTS_CHANGE, on); clearInterval(t); window.removeEventListener('keydown', key); };
  }, []);
  const swap = useCallback((slot) => { if (reroll(slot)) setSwapped({ slot, key: Date.now() }); }, []);
  const items = board(s);
  const n = items.filter((x) => x.done && x.tier !== WEEK).length;
  // a pointerdown here must not reach the results card under it (its tap-to-skip listens on the card)
  const stop = (e) => e.stopPropagation();
  return createPortal(
    <div ref={ref} className="cx3-overlay qs-overlay" role="dialog" aria-modal="true" aria-label="Quests" tabIndex={-1} data-testid="quests-sheet" onPointerDown={stop}>
      <div className="cx3-stripes" aria-hidden="true" />
      <div className="cx3-scale">
        <div className="cx3-screen">
          <header className="cx3-head">
            <KitBackButton label="BACK" ariaLabel="Close the quest list" onClick={onClose} className="cx3-back" />
            <h2 className="cx3-title qs-title">QUESTS</h2>
            {onTab ? <KitGhostButton tone="hot" className="qs-tab" label="CONTRACTS" ariaLabel="Daily contracts" onClick={onTab} /> : null}
            <div className="cx3-count" aria-label={`${n} of 3 daily quests done`}><b>{n}</b><span>/3</span><small>TODAY</small></div>
          </header>
          <div className="cx3-body-grid qs-grid">
            <section className="qs-rules" aria-label="How quests pay">
              <span className="qs-rules-k">QUESTS</span>
              <p className="qs-rule"><b>+{Math.round(PAY_SHARE * 100)}%</b> OF THE WINS FROM THE GAME THAT FINISHES ONE</p>
              <p className="qs-rule"><b>+XP</b> ON YOUR LEVEL BAR</p>
              <p className="qs-rule qs-rule--dim">ONE GAME CAN FINISH TWO</p>
              <p className="qs-rule qs-rule--dim">ONE FREE SWAP A DAY</p>
              <span className="cx3-reset qs-reset">NEW QUESTS IN <b>{countdown(left)}</b></span>
            </section>
            <ol className="qs-hand">
              {items.map((it, i) => (
                <Card key={it.id} item={it} i={i} onPlay={onPlay}
                  onSwap={it.tier !== WEEK && !s.rerolled && !it.done ? () => swap(it.slot) : null}
                  swapKey={swapped.slot === it.slot && it.slot >= 0 ? swapped.key : 0} />
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
