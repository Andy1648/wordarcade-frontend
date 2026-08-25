// StatsScreen.jsx — a read-only, static progression readout (no animation). Reachable from
// the STATS footer link. Styled like the mode dialog (thick black border, hard offset
// shadow, #1a0b2e panel). Scrolls internally on a short viewport; never breaks 100dvh.
import { useEffect, useRef, useState } from 'react';
import './StatsScreen.css';
import {
  loadProgress,
  getTaps,
  getRebirths,
  rebirthMult,
  getKeyTier,
  keyTierXp,
  need,
} from '../progress/xp';
import { getWins, getWinsLifetime, getRounds } from '../progress/wins';
import { formatNum } from '../format';

const fmt = (n) => formatNum(Number.isFinite(n) ? n : 0);
const x = (n) => `×${formatNum(Number.isFinite(n) ? n : 0)}`; // formatNum so ×1e11 stays compact

// RESET ALL PROGRESS: wipe every taw.* key (xp, level, wins, purchases, rebirths, lifetime
// stats — all live under the taw. namespace) and hard-reload so every screen re-reads zeros.
// Wrapped so a blocked/absent store can't throw; the reload still fires.
function resetAllProgress() {
  try {
    const doomed = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && k.startsWith('taw.')) doomed.push(k);
    }
    doomed.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* storage blocked — nothing to clear */
  }
  try {
    window.location.reload();
  } catch {
    /* non-browser env — no-op */
  }
}

export default function StatsScreen({ onBack }) {
  const overlayRef = useRef(null);
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  // Two-step guard for the destructive reset: the button reveals a confirm panel that names
  // exactly what is destroyed; only its second button actually wipes.
  const [confirmingReset, setConfirmingReset] = useState(false);
  // A11y: move focus into the dialog on open; Escape closes it (once on mount).
  useEffect(() => {
    overlayRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onBackRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Economy v5 storage: {level, intoLevel}. There is no cumulative "total XP" any more (that
  // was the number that hit the float64 cliff), so the readout shows XP INTO the current level.
  const { level, intoLevel, lifetimeLetters } = loadProgress();
  const rounds = getRounds();
  const rebirths = getRebirths();

  const rbMult = rebirthMult(rebirths);
  const keyTier = getKeyTier();
  const baseXp = keyTierXp(keyTier); // Key Power TIER's XP per letter
  const menuXp = Math.round((baseXp * rbMult) / 10) * 10; // per menu keystroke (mode ×1), ×10

  const progression = [
    ['LEVEL', level],
    ['XP INTO LEVEL', intoLevel],
    ['XP TO NEXT LEVEL', Math.max(0, need(level) - intoLevel)],
    ['REBIRTHS', rebirths],
    ['LETTERS TYPED', lifetimeLetters],
    ['TAPS', getTaps()],
    ['WINS BALANCE', getWins()],
    ['WINS EARNED (ALL-TIME)', getWinsLifetime()],
  ];
  // XP stack is now Key Power (base) × rebirth. Cosmetics are pure flair — not shown here.
  const multipliers = [
    ['KEY POWER', `LV ${keyPower}`],
    ['BASE XP / LETTER', fmt(baseXp)],
    ['REBIRTH', x(rbMult)],
    ['MENU XP / LETTER', fmt(menuXp)],
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

          <h3 className="stats-subtitle">XP STACK</h3>
          <dl className="stats-list">
            {multipliers.map(([k, v]) => (
              <div className="stats-row" key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
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

          {/* DANGER ZONE — hard-separated from everything above so RESET is never a mis-tap. */}
          <div className="stats-danger">
            {confirmingReset ? (
              <div className="stats-danger-confirm" role="alertdialog" aria-label="Confirm reset">
                <p className="stats-danger-warn">
                  This <b>permanently destroys</b> your XP, level, wins, all purchases,
                  rebirths, and every lifetime stat. It cannot be undone.
                </p>
                <div className="stats-danger-actions">
                  <button type="button" className="stats-reset-confirm" onClick={resetAllProgress}>
                    YES, WIPE EVERYTHING
                  </button>
                  <button type="button" className="stats-reset-cancel" onClick={() => setConfirmingReset(false)}>
                    CANCEL
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="stats-reset" onClick={() => setConfirmingReset(true)}>
                RESET ALL PROGRESS
              </button>
            )}
          </div>
        </div>

        <button type="button" className="stats-back" onClick={onBack}>
          ← BACK TO MENU
        </button>
      </div>
    </div>
  );
}
