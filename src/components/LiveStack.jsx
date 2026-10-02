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
import BoostPill from '../frenzy/BoostPill';
import { perWordRateNow } from '../progress/wins';
import { roundWordXp } from '../progress/xp';
import { formatRate, formatMultExact } from '../format';
import './LiveStack.css';

// ANDY OCT2 — "never overcrowded with useless info". The standing BASE / MODE / DIFFICULTY /
// REBIRTH / STREAK / BONUS rows went: they never change during a run, and the end-of-round
// receipt (WHERE YOUR WINS CAME FROM) names every one of them with what it actually paid. While
// playing, the chip says the three things that MOVE: the rate, a live COMBO, and FUSE FRENZY.
// formatMultExact — the RECEIPT's formatter (×1.05, not the one-decimal ×1.1 the game does not apply).
const mult = (m) => `×${formatMultExact(m)}`;

export default function LiveStack({ mode, difficulty, combo = 1, compact = false }) {
  const now = perWordRateNow({ mode, difficulty });
  const frenzy = Number.isFinite(now.factors.frenzy) && now.factors.frenzy > 1 ? now.factors.frenzy : 0;
  const boost = Number.isFinite(now.factors.boost) && now.factors.boost > 1 ? now.factors.boost : 0;

  // The live COMBO is what the player is doing right now — the one row that moves while they type.
  const live = combo > 1 ? { key: 'combo', label: 'COMBO', value: combo } : null;
  // With a live combo the word's XP is re-rounded on the same whole-XP grid the award uses, so the
  // headline is the tenth-exact number a common word would bank right now.
  const shown = live ? roundWordXp(now.xp * combo) / 10 : now.rate;

  return (
    <div className={`lstack${compact ? ' lstack--compact' : ''}`} aria-hidden="true">
      <div className="lstack-head">
        <span className="lstack-rate">{formatRate(shown)}</span>
        <span className="lstack-per">/ WORD</span>
      </div>
      <div className="lstack-rows">
        <div className="lstack-row lstack-row--base">
          <span className="lstack-label">LONGER = MORE</span>
        </div>
        {frenzy > 0 && (
          <div className="lstack-row lstack-row--frenzy">
            <span className="lstack-label">FRENZY</span>
            <span className="lstack-val">{mult(frenzy)}</span>
          </div>
        )}
        {boost > 0 && (
          <div className="lstack-row lstack-row--boost">
            <BoostPill />
          </div>
        )}
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
