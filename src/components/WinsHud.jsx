// WinsHud.jsx — the shared live "+N WINS" HUD pill and the game-over "WINS EARNED" total.
// Used by EVERY mode (Word Bomb, Blitz, SAT Rush, CHAIN, FUSE) so the wins feedback is one
// component in one position everywhere. Purely presentational.
//
// The pill is visible from the FIRST word of a run (it no longer hides at 0). Below the
// MIN_WORDS payout gate it makes the gate explicit — "3 WORDS TO EARN" — then flips to the
// running "+N WINS" once the gate is crossed, so a player is never left staring at nothing.
import './WinsHud.css';
import { MIN_WORDS } from '../progress/wins';
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
          <span className="wins-hud-plus">+{amount}</span>
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

/**
 * The end-of-run payout, ITEMISED.
 *
 * ANDY: "I be here getting like 800 but it gives like over 2k." He was right, and this component
 * was half the reason: it printed ONE number — the per-word total — while the balance had also
 * taken an achievement payout and/or a collection milestone. Measured on a 20-word run: the card
 * said +15,010 and taw.wins moved 20,010.
 *
 * So the total is now the sum of NAMED LINES, and the words are just the first line. A bonus that
 * can only be known at the end still gets its own row; nothing is ever folded into the total
 * silently. `lines` comes from the wins ledger (progress/wins.js), which is the same source the
 * moment-of-credit toast reads — so the two can never disagree.
 *
 * The data-wins-* attributes are the gate's handle (e2e/no-hidden-wins.spec.js sums them and
 * asserts the sum equals the delta in taw.wins). They are on the rendered rows on purpose: a gate
 * that reads component state could pass while the player sees nothing.
 */
export function WinsEarnedTotal({ amount, lines = [] }) {
  const bonus = lines.filter((l) => l && l.kind === 'bonus' && l.amount > 0);
  const words = Number.isFinite(amount) && amount > 0 ? amount : 0;
  const total = words + bonus.reduce((a, l) => a + l.amount, 0);
  if (total <= 0) return null;
  return (
    <div className="wins-earned">
      {words > 0 && (
        <div className="wins-earned-line" data-wins-line="WORDS" data-wins-amount={words}>
          <span className="wins-earned-line-label">WORDS</span>
          <span className="wins-earned-line-amt">+{words}</span>
        </div>
      )}
      {bonus.map((l) => (
        <div className="wins-earned-line" key={l.id} data-wins-line={l.label} data-wins-amount={l.amount}>
          <span className="wins-earned-line-label">{l.label}</span>
          <span className="wins-earned-line-amt">+{l.amount}</span>
        </div>
      ))}
      <span className="wins-earned-num">+{total}</span>
      <span className="wins-earned-label">WINS EARNED</span>
    </div>
  );
}
