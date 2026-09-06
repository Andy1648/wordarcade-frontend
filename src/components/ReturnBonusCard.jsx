// ReturnBonusCard.jsx — the WELCOME BACK card. A small, STATIC menu card shown once when a
// returning player (>= 6h away) is granted their daily return bonus. Dismissed on ANY keystroke (or
// tap, or its close button) — the spec's "dismissed on any keystroke," so it never blocks the menu's
// type-to-earn. Purely presentational; the wins were already granted by claimReturnBonus.
//
// It states the REAL absence ("BACK AFTER 2 WEEKS" / "8 HOURS AWAY", not a flat "12+ HOURS AWAY")
// and the permanent progress that the absence never touched (level + total wins, and the streak
// when it still stands), so a returner feels specifically welcomed rather than generically greeted.
import { useEffect } from 'react';
import './ReturnBonusCard.css';
import { formatNum } from '../format';
import { absenceLabel } from '../progress/returnBonus';
import { loadProgress } from '../progress/xp';
import { getWins } from '../progress/wins';
import { getStreak } from '../progress/streak';

export default function ReturnBonusCard({ bonus, onDismiss }) {
  useEffect(() => {
    // Any keystroke or pointer press anywhere dismisses it. Capture phase so it fires even if the
    // menu's own handlers see the event too (they still run — this only hides the card).
    const dismiss = () => onDismiss();
    window.addEventListener('keydown', dismiss, { once: true, capture: true });
    window.addEventListener('pointerdown', dismiss, { once: true, capture: true });
    return () => {
      window.removeEventListener('keydown', dismiss, { capture: true });
      window.removeEventListener('pointerdown', dismiss, { capture: true });
    };
  }, [onDismiss]);

  // Real absence phrasing: hours read "N HOURS AWAY"; a day or more reads "BACK AFTER <label>".
  const label = absenceLabel(bonus.hoursAway);
  const awayLine = bonus.hoursAway >= 24 ? `BACK AFTER ${label}` : `${label} AWAY`;

  // What survived the absence — permanent progress the game never decays. Guarded reads; any
  // failure just drops that chip.
  let level = 0;
  let wins = 0;
  let streak = 0;
  try { level = loadProgress().level; } catch { /* no level chip */ }
  try { wins = getWins(); } catch { /* no wins chip */ }
  try { streak = getStreak().count; } catch { /* no streak chip */ }

  const kept = [];
  if (level >= 1) kept.push(`LV ${level}`);
  if (wins > 0) kept.push(`${formatNum(wins)} WINS`);
  if (streak >= 2) kept.push(`${streak}-DAY STREAK`); // shown on the menu from 2, matching the HUD

  return (
    <div className="return-bonus" role="status" aria-live="polite">
      <button type="button" className="return-bonus-close" onClick={onDismiss} aria-label="Dismiss">✕</button>
      <div className="return-bonus-title">WELCOME BACK</div>
      <div className="return-bonus-away">{awayLine}</div>
      <div className="return-bonus-wins">+{formatNum(bonus.wins)} WINS</div>
      {kept.length > 0 && (
        <div className="return-bonus-kept">STILL YOURS · {kept.join(' · ')}</div>
      )}
      <div className="return-bonus-sub">TAP OR TYPE TO DISMISS</div>
    </div>
  );
}
