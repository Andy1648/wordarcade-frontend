// RankLadder.jsx — the RANK ladder overlay (fix/card-polish task 4). Opened by clicking the
// rank title in the menu XP bar. A read-only, static readout of all ten ranks in order: the
// level each unlocks at, which one you hold now, and which is next. EARNED ranks render solid;
// FUTURE ranks are silhouettes with their unlock level — the "visible-but-locked content"
// pattern, same register as the Stats overlay (flat #1a0b2e panel, thick black border, hard
// offset shadow, Bungee headings). ZERO animation. Escape / backdrop / the X all close it.
import { useEffect, useRef } from 'react';
import './RankLadder.css';
import { RANKS, rankFor } from '../progress/rank';

// The top of each band (one below the next band's min; the last band is open-ended).
function bandTop(i) {
  return i < RANKS.length - 1 ? RANKS[i + 1].min - 1 : Infinity;
}

export default function RankLadder({ level = 1, onClose }) {
  const overlayRef = useRef(null);

  // Focus the panel on open and trap Escape to close — matches the Stats overlay's a11y.
  useEffect(() => {
    overlayRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

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
        if (e.target === overlayRef.current) onClose?.();
      }}
    >
      <div className="rank-panel">
        <div className="rank-header">
          <h2 className="rank-title">RANKS</h2>
          <button type="button" className="rank-close" onClick={onClose} aria-label="Back to menu">
            ✕
          </button>
        </div>
        <p className="rank-caption">YOUR RANK CLIMBS WITH YOUR LEVEL</p>
        <ol className="rank-list">
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
