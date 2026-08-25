// LockedPreviewDialog.jsx — the preview shown when a LOCKED (level-gated) mode card is
// clicked. Same panel styling as the mode dialog (thick colored border, hard offset shadow,
// #1a0b2e panel) but read-only: mode name, one line of rules, what it pays per word, and the
// unlock gate against the player's current level. No PLAY button — it's a teaser, not an entry.
import { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './LockedPreviewDialog.css';
import ModeExample from './ModeExample';

export default function LockedPreviewDialog({ game, level = 0, onClose }) {
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const handleClose = useCallback(() => onCloseRef.current && onCloseRef.current(), []);

  // Focus the panel on open; Escape closes.
  useEffect(() => {
    panelRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleClose]);

  if (!game) return null;
  const name = String(game.name || '').replace('\n', ' ');
  const accent = game.baseColor || '#2EFFE0';

  const overlay = (
    <div className="lp-overlay" role="presentation">
      <div className="lp-scrim" onClick={handleClose} />
      <div
        className="lp-panel"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${name} — locked preview`}
        tabIndex={-1}
        style={{ borderColor: accent }}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="lp-close" onClick={handleClose} aria-label="Close">
          ✕
        </button>

        <div className="lp-lock" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="34" height="34">
            <path d="M7 11V8a5 5 0 0 1 10 0v3" fill="none" stroke="#000" strokeWidth="2.4" strokeLinecap="round" />
            <rect x="4.5" y="11" width="15" height="10" rx="2.5" fill="#FFE94A" stroke="#000" strokeWidth="2.4" />
            <circle cx="12" cy="15.5" r="1.6" fill="#000" />
            <rect x="11.15" y="15.5" width="1.7" height="4" fill="#000" />
          </svg>
        </div>

        <div className="lp-name" style={{ color: accent }}>{name}</div>
        <div className="lp-rules">{game.description}</div>

        {/* Real worked example + wins rate + round length (item 2) — same block the unlocked
            dialog shows, so locked and unlocked read as siblings. */}
        <ModeExample mode={game.id} accent={accent} />

        <div className="lp-gate">
          UNLOCKS AT LV {game.unlockLevel}
          <span className="lp-gate-cur">YOU'RE LV {level}</span>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
