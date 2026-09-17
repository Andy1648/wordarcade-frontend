// LiveStack.jsx — WHAT A WORD IS WORTH RIGHT NOW, AND WHY. Docked, live, in EVERY mode.
//
// ANDY: "Multipliers should SHOW." / "idk where the thing comes from."
//
// The per-word receipt (<WordPayout>) only exists AFTER a word lands, and only in Word Bomb and
// Blitz — so for the first three words of a run, and for the whole of CHAIN / FUSE / SAT RUSH,
// nothing on screen said what the player's multipliers were. This is the standing readout: the
// PERMANENT stack the player has built, always on, updating as it changes, in the same docked slot
// the per-word receipt uses.
//
// It reads `perWordRateNow()` — the same perWordFactors() the payout itself uses — so it can never
// quote a multiplier the game will not pay. The headline is the resolved rate, not a base the
// player has to multiply out themselves.
//
// Factors at exactly x1 are omitted: a list where half the rows say "x1" teaches nothing and
// crowds out the rows that matter. `WordPayout` already handles the "an upgrade is doing nothing
// on THIS word" case with its own inactive list.
import { perWordRateNow } from '../progress/wins';
import { formatNum } from '../format';
import './LiveStack.css';

const LABELS = {
  mode: 'MODE',
  difficulty: 'DIFFICULTY',
  level: 'LEVEL',
  rebirth: 'REBIRTH',
  momentum: 'MOMENTUM',
  mark: 'MARK',
};
const ORDER = ['mode', 'difficulty', 'level', 'rebirth', 'momentum', 'mark'];
const mult = (m) => `×${Number(m.toFixed(2))}`;

export default function LiveStack({ mode, difficulty, combo = 1, compact = false }) {
  const now = perWordRateNow({ mode, difficulty });
  const rows = ORDER
    .filter((k) => Number.isFinite(now.factors[k]) && now.factors[k] !== 1)
    .map((k) => ({ key: k, label: LABELS[k], value: now.factors[k] }));

  // The live COMBO is not permanent — it is what the player is doing right now — so it rides at the
  // bottom, visually separated, and is the one row that moves while they type.
  const live = combo > 1 ? { key: 'combo', label: 'COMBO', value: combo } : null;
  const shown = live ? now.rate * combo : now.rate;

  return (
    <div className={`lstack${compact ? ' lstack--compact' : ''}`} aria-hidden="true">
      <div className="lstack-head">
        <span className="lstack-rate">{formatNum(Math.round(shown))}</span>
        <span className="lstack-per">/ WORD</span>
      </div>
      <div className="lstack-rows">
        <div className="lstack-row lstack-row--base">
          <span className="lstack-label">BASE</span>
          <span className="lstack-val">{formatNum(now.base)}</span>
        </div>
        {rows.map((r) => (
          <div className="lstack-row" key={r.key}>
            <span className="lstack-label">{r.label}</span>
            <span className="lstack-val">{mult(r.value)}</span>
          </div>
        ))}
        {live && (
          <div className="lstack-row lstack-row--live" key="combo">
            <span className="lstack-label">{live.label}</span>
            <span className="lstack-val">{mult(live.value)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
