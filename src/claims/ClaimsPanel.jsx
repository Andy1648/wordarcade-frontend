// ClaimsPanel.jsx — the REWARDS inbox (Andy oct2: non-game rewards are CLAIMED). Every pending
// claim with what it is and what it pays, a CLAIM per row and CLAIM ALL. Claiming pays through the
// labelled ledger (claims.js → grantWins), so the wins toast + the balance tick exactly as before —
// the difference is the player pressed the button.
import { useEffect, useRef, useState } from 'react';
import { claim, claimAll, CLAIM_KINDS } from '../progress/claims.js';
import { useClaims } from './useClaims.js';
import { formatNum } from '../format.js';
import './ClaimsPanel.css';

export const KIND_COLOUR = {
  achievement: '#FFE94A',
  collection: '#2EFFE0',
  welcome: '#2EFFE0',
  rank: '#FF4FA3',
  mark: '#C58BFF',
  layer: '#FF6B3D',
};

export default function ClaimsPanel({ onClose, onReveal }) {
  const list = useClaims();
  const [paid, setPaid] = useState(null); // { key, wins } for the stamp after a claim
  const closeRef = useRef(null);
  useEffect(() => {
    if (closeRef.current) closeRef.current.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const total = list.reduce((a, c) => a + (c.amount || 0), 0);
  const stamp = (wins) => setPaid({ key: Date.now(), wins });
  return (
    <div
      className="claims-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Rewards to claim"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="claims-panel">
        <div className="claims-head">
          <h2 className="claims-title">REWARDS</h2>
          <button ref={closeRef} type="button" className="claims-close" onClick={onClose} aria-label="Close rewards">
            ✕
          </button>
        </div>
        {list.length === 0 ? (
          <div className="claims-empty">ALL CLAIMED — PLAY TO EARN MORE</div>
        ) : (
          <>
            <ul className="claims-list">
              {list
                .slice()
                .reverse()
                .map((c) => (
                  <li key={c.id} className="claims-row" style={{ '--k': KIND_COLOUR[c.kind] || '#FFE94A' }}>
                    <span className="claims-kind">{CLAIM_KINDS[c.kind] || 'REWARD'}</span>
                    <span className="claims-label">{c.label.replace(/^[A-Z ]+ — /, '')}</span>
                    <button
                      type="button"
                      className="claims-btn"
                      onClick={() => {
                        const r = claim(c.id);
                        if (r && r.amount) stamp(r.amount);
                        if (r && (r.kind === 'layer' || r.kind === 'mark') && onReveal) onReveal(r);
                      }}
                    >
                      {c.amount > 0 ? `CLAIM +${formatNum(c.amount)}` : 'CLAIM'}
                    </button>
                  </li>
                ))}
            </ul>
            {list.length > 1 && (
              <button
                type="button"
                className="claims-all"
                onClick={() => {
                  const reveals = list.filter((c) => c.kind === 'layer' || c.kind === 'mark');
                  const r = claimAll();
                  if (r.wins) stamp(r.wins);
                  if (reveals.length && onReveal) onReveal(reveals[reveals.length - 1]);
                }}
              >
                CLAIM ALL{total > 0 ? ` +${formatNum(total)} WINS` : ''}
              </button>
            )}
          </>
        )}
        {paid && (
          <div key={paid.key} className="claims-stamp" aria-live="polite">
            +{formatNum(paid.wins)} WINS
          </div>
        )}
      </div>
    </div>
  );
}
