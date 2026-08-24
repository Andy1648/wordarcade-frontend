// StatsScreen.jsx — a read-only, static progression readout (no animation). Reachable from
// the STATS footer link. Styled like the mode dialog (thick black border, hard offset
// shadow, #1a0b2e panel). Scrolls internally on a short viewport; never breaks 100dvh.
import './StatsScreen.css';
import { loadProgress, levelFromXp, getTaps } from '../progress/xp';
import { getWins, getWinsLifetime, getRounds } from '../progress/wins';

const fmt = (n) => (Number.isFinite(n) ? n : 0).toLocaleString();

export default function StatsScreen({ onBack }) {
  const { xp, lifetimeLetters } = loadProgress();
  const level = levelFromXp(xp).level;
  const rounds = getRounds();

  const progression = [
    ['LEVEL', level],
    ['TOTAL XP', xp],
    ['LETTERS TYPED', lifetimeLetters],
    ['TAPS', getTaps()],
    ['WINS BALANCE', getWins()],
    ['WINS EARNED (ALL-TIME)', getWinsLifetime()],
  ];
  const roundsPlayed = [
    ['WORD BOMB', rounds.wordBomb],
    ['CATEGORY BLITZ', rounds.blitz],
    ['SAT RUSH', rounds.satRush],
  ];

  return (
    <div className="stats-overlay" role="dialog" aria-label="Stats">
      <div className="stats-panel">
        <div className="stats-header">
          <h2 className="stats-title">STATS</h2>
          <button type="button" className="stats-close" onClick={onBack} aria-label="Back to menu">
            ✕
          </button>
        </div>

        <div className="stats-body">
          <dl className="stats-list">
            {progression.map(([k, v]) => (
              <div className="stats-row" key={k}>
                <dt>{k}</dt>
                <dd>{fmt(v)}</dd>
              </div>
            ))}
          </dl>

          <h3 className="stats-subtitle">ROUNDS PLAYED</h3>
          <dl className="stats-list">
            {roundsPlayed.map(([k, v]) => (
              <div className="stats-row" key={k}>
                <dt>{k}</dt>
                <dd>{fmt(v)}</dd>
              </div>
            ))}
          </dl>
        </div>

        <button type="button" className="stats-back" onClick={onBack}>
          ← BACK TO MENU
        </button>
      </div>
    </div>
  );
}
