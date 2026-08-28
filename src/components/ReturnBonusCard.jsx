// ReturnBonusCard.jsx — the WELCOME BACK card (Job 6). A small, STATIC menu card shown once when a
// returning player (>= 6h away) is granted their daily return bonus. Dismissed on ANY keystroke (or
// tap, or its close button) — the spec's "dismissed on any keystroke," so it never blocks the menu's
// type-to-earn. Purely presentational; the wins were already granted by claimReturnBonus.
import { useEffect } from 'react';
import './ReturnBonusCard.css';
import { formatNum } from '../format';

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

  const hours = Math.round(bonus.hoursAway);
  return (
    <div className="return-bonus" role="status" aria-live="polite">
      <button type="button" className="return-bonus-close" onClick={onDismiss} aria-label="Dismiss">✕</button>
      <div className="return-bonus-title">WELCOME BACK</div>
      <div className="return-bonus-wins">+{formatNum(bonus.wins)} WINS</div>
      <div className="return-bonus-sub">
        {hours >= 12 ? '12+ HOURS AWAY' : `${hours} HOUR${hours === 1 ? '' : 'S'} AWAY`} · TAP OR TYPE TO DISMISS
      </div>
    </div>
  );
}
