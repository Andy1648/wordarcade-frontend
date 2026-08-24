// StatsScreen.jsx — a read-only, static progression readout (no animation). Reachable from
// the STATS footer link. Styled like the mode dialog (thick black border, hard offset
// shadow, #1a0b2e panel). Scrolls internally on a short viewport; never breaks 100dvh.
import { useEffect, useRef } from 'react';
import './StatsScreen.css';
import {
  loadProgress,
  levelFromXp,
  getTaps,
  getRebirths,
  rebirthMult,
  rebirthThreshold,
} from '../progress/xp';
import { getWins, getWinsLifetime, getRounds } from '../progress/wins';
import { equippedPopStyleMult, equippedSoundPackMult } from '../progress/shop';

const fmt = (n) => (Number.isFinite(n) ? n : 0).toLocaleString();
const x = (n) => `×${n.toFixed(2)}`;

export default function StatsScreen({ onBack }) {
  const overlayRef = useRef(null);
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  // A11y: move focus into the dialog on open; Escape closes it (once on mount).
  useEffect(() => {
    overlayRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onBackRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const { xp, lifetimeLetters } = loadProgress();
  const level = levelFromXp(xp).level;
  const rounds = getRounds();
  const rebirths = getRebirths();

  const rbMult = rebirthMult(rebirths);
  const popMult = equippedPopStyleMult();
  const soundMult = equippedSoundPackMult();
  const totalMult = rbMult * popMult * soundMult; // the menu-typing stack (mode = ×1)

  const progression = [
    ['LEVEL', level],
    ['TOTAL XP', xp],
    ['REBIRTHS', rebirths],
    ['LETTERS TYPED', lifetimeLetters],
    ['TAPS', getTaps()],
    ['WINS BALANCE', getWins()],
    ['WINS EARNED (ALL-TIME)', getWinsLifetime()],
  ];
  const multipliers = [
    ['REBIRTH', x(rbMult)],
    ['POP STYLE', x(popMult)],
    ['SOUND PACK', x(soundMult)],
    ['TOTAL', x(totalMult)],
  ];
  const roundsPlayed = [
    ['WORD BOMB', rounds.wordBomb],
    ['CATEGORY BLITZ', rounds.blitz],
    ['SAT RUSH', rounds.satRush],
  ];

  return (
    <div className="stats-overlay" role="dialog" aria-modal="true" aria-label="Stats" tabIndex={-1} ref={overlayRef}>
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

          <h3 className="stats-subtitle">XP MULTIPLIER</h3>
          <dl className="stats-list">
            {multipliers.map(([k, v]) => (
              <div className="stats-row" key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          {/* Visible-but-locked from day one: the next rebirth target, always shown. */}
          <div className="stats-rebirth-at">REBIRTH AT LV {rebirthThreshold(rebirths)}</div>

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
