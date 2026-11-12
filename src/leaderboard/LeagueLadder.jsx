// LeagueLadder — every RANK LEAGUE at a glance (Andy nov9: "let the players be able to see what league is from ranks blank
// to blank"): best first, each league's badge, its name and the board places it spans (leagues.js rangeLabel — the cutoffs
// live in one place), yours marked. A sheet over the board: ✕, a tap outside or Esc closes it. The rows rise in once, a
// finite stagger (transform/opacity); nothing loops.
import { useEffect, useRef } from 'react';
import { LEAGUES, LEAGUE_ART, leagueOf } from './leagues.js';
import { rangeLabel } from './leagueRange.js';
import './LeagueLadder.css';

export default function LeagueLadder({ rank = null, onClose }) {
  const mine = leagueOf(rank);
  const closeRef = useRef(null);
  useEffect(() => { if (closeRef.current) closeRef.current.focus(); }, []);
  return (
    <div className="lgl" role="dialog" aria-modal="true" aria-label="All leagues" data-testid="league-ladder" onClick={onClose}>
      <div className="lgl-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="lgl-head">
          <h2 className="lgl-title">LEAGUES</h2>
          <button ref={closeRef} type="button" className="lgl-x" onClick={onClose} aria-label="Close leagues">✕</button>
        </div>
        <ol className="lgl-list">
          {LEAGUES.map((l, i) => (
            <li key={l.key} className={`lgl-row${mine === l ? ' is-me' : ''}`} data-league={l.key} style={{ '--i': i }}>
              <img className="lgl-art" src={LEAGUE_ART[l.key]} width="320" height="320" alt="" aria-hidden="true" draggable="false" />
              <span className="lgl-name">{l.name}</span>
              <span className="lgl-range" data-testid={`league-range-${l.key}`}>{rangeLabel(l)}</span>
              {mine === l ? <span className="lgl-you">YOU</span> : null}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
