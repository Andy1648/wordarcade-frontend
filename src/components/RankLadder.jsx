// RankLadder.jsx — the RANK ladder overlay (fix/card-polish task 4). Opened by clicking the
// rank title in the menu XP bar. A read-only, static readout of all ten ranks in order: the
// level each unlocks at, which one you hold now, and which is next. EARNED ranks render solid;
// FUTURE ranks are silhouettes with their unlock level — the "visible-but-locked content"
// pattern, same register as the Stats overlay (flat #1a0b2e panel, thick black border, hard
// offset shadow, Bungee headings). ZERO animation. Escape / backdrop / the X all close it.
import { useCallback, useRef } from 'react';
import './RankLadder.css';
import useModalFocus from './useModalFocus';
import { RANKS, rankFor } from '../progress/rank';

// The top of each band (one below the next band's min; the last band is open-ended).
function bandTop(i) {
  return i < RANKS.length - 1 ? RANKS[i + 1].min - 1 : Infinity;
}

export default function RankLadder({ level = 1, onClose }) {
  const overlayRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const handleClose = useCallback(() => onCloseRef.current && onCloseRef.current(), []);

  // CLASSIFICATION (fix/modal-contract): this presents no CHOICE — it is a player-INVOKED
  // read-only screen (you click your rank to see the ladder), not an interruption. It keeps
  // `aria-modal` because it genuinely is modal in behaviour: an opaque full-bleed backdrop that
  // blocks the menu. What it was NOT doing was honouring that claim — 8 of 12 Tabs walked out
  // onto the live menu, and closing it dropped focus on BODY.
  useModalFocus(overlayRef, { onEscape: handleClose, restoreFocus: true });

  const current = rankFor(level);

  return (
    <div
      className="rank-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Rank ladder"
      tabIndex={-1}
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) handleClose();
      }}
    >
      <div className="rank-panel">
        <div className="rank-header">
          <h2 className="rank-title">RANKS</h2>
          <button type="button" className="rank-close" onClick={handleClose} aria-label="Back to menu">
            ✕
          </button>
        </div>
        <p className="rank-caption">YOUR RANK CLIMBS WITH YOUR LEVEL</p>
        {/* tabIndex=0: the ladder is a SCROLL REGION with no focusable children. Chrome gives
            such a node implicit focus, but the containment ring above only knows about nodes the
            focusable selector matches — without this the list becomes unscrollable by keyboard
            on a short viewport. */}
        <ol className="rank-list" tabIndex={0} aria-label="All ranks">
          {RANKS.map((r, i) => {
            const earned = level >= r.min;
            const isCurrent = r.name === current.name;
            // The next rank = the first band above the current one.
            const isNext = !earned && r.min > level && RANKS.findIndex((q) => !(level >= q.min)) === i;
            const top = bandTop(i);
            const range = top === Infinity ? `LV ${r.min}+` : `LV ${r.min}–${top}`;
            const cls =
              `rank-row${earned ? ' is-earned' : ' is-locked'}` +
              `${isCurrent ? ' is-current' : ''}${isNext ? ' is-next' : ''}`;
            const aria = earned
              ? `Rank ${i + 1}, ${r.name}, ${range}${isCurrent ? ', your current rank' : ', earned'}`
              : `Rank ${i + 1}, ${r.name}, locked, unlocks at LV ${r.min}${isNext ? ', next up' : ''}`;
            return (
              <li key={r.name} className={cls} aria-label={aria}>
                <span className="rank-num" aria-hidden="true">{i + 1}</span>
                <span className="rank-name">
                  {earned ? r.name : <span className="rank-silhouette" aria-hidden="true" />}
                </span>
                <span className="rank-range">{range}</span>
                {isCurrent && <span className="rank-tag rank-tag--you">YOU</span>}
                {isNext && <span className="rank-tag rank-tag--next">NEXT</span>}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
