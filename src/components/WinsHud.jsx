// WinsHud.jsx — the shared live "+N WINS" HUD pill and the game-over "WINS EARNED" total.
// Used by EVERY mode (Word Bomb, Blitz, SAT Rush, CHAIN, FUSE) so the wins feedback is one
// component in one position everywhere. Purely presentational.
//
// The pill is visible from the FIRST word of a run (it no longer hides at 0). Below the
// MIN_WORDS payout gate it makes the gate explicit — "3 WORDS TO EARN" — then flips to the
// running "+N WINS" once the gate is crossed, so a player is never left staring at nothing.
import './WinsHud.css';
import { MIN_WORDS } from '../progress/wins';

export function WinsHudPill({ amount = 0, words = 0 }) {
  const earning = words >= MIN_WORDS && amount > 0;
  if (earning) {
    return (
      <div className="wins-hud" aria-live="polite" aria-label={`${amount} wins so far`}>
        <span className="wins-hud-plus">+{amount}</span>
        <span className="wins-hud-label">WINS</span>
      </div>
    );
  }
  // Pre-gate: advertise what it takes to start earning.
  return (
    <div
      className="wins-hud wins-hud--gate"
      aria-live="polite"
      aria-label={`${MIN_WORDS} words to start earning wins`}
    >
      <span className="wins-hud-plus">{MIN_WORDS}</span>
      <span className="wins-hud-label">WORDS TO EARN</span>
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
