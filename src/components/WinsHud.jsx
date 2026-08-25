// WinsHud.jsx — the shared live "+N WINS" HUD pill and the game-over "WINS EARNED" total.
// Used by EVERY mode (Word Bomb, Blitz, SAT Rush, CHAIN, FUSE) so the wins feedback is one
// component in one position everywhere. Purely presentational; both hide when the amount is 0
// (the pill stays hidden until the payout gate of 3 words is crossed).
import './WinsHud.css';

export function WinsHudPill({ amount }) {
  if (!amount || amount <= 0) return null;
  return (
    <div className="wins-hud" aria-live="polite" aria-label={`${amount} wins so far`}>
      <span className="wins-hud-plus">+{amount}</span>
      <span className="wins-hud-label">WINS</span>
    </div>
  );
}

export function WinsEarnedTotal({ amount }) {
  if (!amount || amount <= 0) return null;
  return (
    <div className="wins-earned">
      <span className="wins-earned-num">+{amount}</span>
      <span className="wins-earned-label">WINS EARNED</span>
    </div>
  );
}
