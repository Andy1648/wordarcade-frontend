// WinsHud.jsx — the shared live "+N WINS" HUD pill and the game-over "WINS EARNED" total.
// Used by EVERY mode (Word Bomb, Blitz, SAT Rush, CHAIN, FUSE) so the wins feedback is one
// component in one position everywhere. Purely presentational.
//
// The pill is visible from the FIRST word of a run (it no longer hides at 0). Below the
// MIN_WORDS payout gate it makes the gate explicit — "3 WORDS TO EARN" — then flips to the
// running "+N WINS" once the gate is crossed, so a player is never left staring at nothing.
import './WinsHud.css';
import { MIN_WORDS } from '../progress/wins';
import { formatNum } from '../format';
import LiveWpm from './LiveWpm';

// showWpm: the live typing-speed readout only rides along in modes where it MEANS something —
// the continuous-typing modes (SAT Rush, CHAIN, FUSE) + the menu. Word Bomb and Category Blitz are
// turn-based (you spend the round waiting for your turn), so wall-clock-free WPM there is noise;
// they pass showWpm={false} and get the wins pill without it (§2).
export function WinsHudPill({ amount = 0, words = 0, showWpm = true }) {
  const earning = words >= MIN_WORDS && amount > 0;
  return (
    <>
      {earning ? (
        <div className="wins-hud" aria-live="polite" aria-label={`${amount} wins so far`}>
          {/* format.js's rule, not a raw integer: this pill and the total below are the two
              most-seen numbers in the game, and both printed the number exactly. At R10 a run's
              wins are ~1e10, so the game-over card read "+16384927364710 WINS". */}
          <span className="wins-hud-plus">+{formatNum(amount)}</span>
          <span className="wins-hud-label">WINS</span>
        </div>
      ) : (
        // Pre-gate: advertise what it takes to start earning.
        <div
          className="wins-hud wins-hud--gate"
          aria-live="polite"
          aria-label={`${MIN_WORDS} words to start earning wins`}
        >
          <span className="wins-hud-plus">{MIN_WORDS}</span>
          <span className="wins-hud-label">WORDS TO EARN</span>
        </div>
      )}
      {/* WPM (§2): live typing speed, under the wins pill — only in the continuous-typing modes. */}
      {showWpm && (
        <div className="wpm-hud">
          <LiveWpm />
        </div>
      )}
    </>
  );
}

export function WinsEarnedTotal({ amount }) {
  if (!amount || amount <= 0) return null;
  return (
    <div className="wins-earned">
      <span className="wins-earned-num">+{formatNum(amount)}</span>
      <span className="wins-earned-label">WINS EARNED</span>
    </div>
  );
}
