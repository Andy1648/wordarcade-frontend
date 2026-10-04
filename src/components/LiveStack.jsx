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
import { memo } from 'react';
import BoostPill from '../frenzy/BoostPill';
import '../frenzy/MechanicScale.css';
import { perWordRateNow } from '../progress/wins';
import { formatRate, formatMultExact } from '../format';
import './LiveStack.css';

// ANDY OCT2 — "never overcrowded with useless info". The standing BASE / MODE / DIFFICULTY /
// REBIRTH / STREAK / BONUS rows went: they never change during a run, and the end-of-round
// receipt (WHERE YOUR WINS CAME FROM) names every one of them with what it actually paid. While
// playing, the chip says the things that MOVE: the rate, FUSE FRENZY and a live BOOST. (COMBO left the
// payout in Rebirth Rush — the HUD's HITS counter still shows it, with no multiplier.)
// less-is-more (Andy oct3): the standing "LONGER WORDS PAY MORE" row went too — the mode card, the
// mode dialog and the teach strip already say it; mid-game it was a fourth copy of a rule.
// formatMultExact — the RECEIPT's formatter (×1.05, not the one-decimal ×1.1 the game does not apply).
const mult = (m) => `×${formatMultExact(m)}`;

function LiveStack({ mode, difficulty, combo = 1, compact = false }) {
  const now = perWordRateNow({ mode, difficulty });
  const frenzy = Number.isFinite(now.factors.frenzy) && now.factors.frenzy > 1 ? now.factors.frenzy : 0;
  const boost = Number.isFinite(now.factors.boost) && now.factors.boost > 1 ? now.factors.boost : 0;

  // REBIRTH RUSH: COMBO no longer multiplies wins, so it is not a row and does not move the rate.
  // (`combo` is still accepted so callers don't churn.)
  void combo;
  const shown = now.rate;

  return (
    <div className={`lstack${compact ? ' lstack--compact' : ''}`} aria-hidden="true">
      <div className="lstack-head">
        <span className="lstack-rate">{formatRate(shown)}</span>
        <span className="lstack-per">{compact ? '/ WORD' : 'WINS / WORD'}</span>{/* compact = the WB/Blitz receipt rail, beside the WINS pill: the longer unit widened the 1024px band into SKIP */}
      </div>
      {(frenzy > 0 || boost > 0) && <div className="lstack-rows">
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
      </div>}
    </div>
  );
}

// Batch A (input latency): the HUD rate chip re-reads the whole payout stack (localStorage + JSON for
// marks, mastery, streak, stars, forge, frenzy, boost) on every render. Its parent re-renders on EVERY
// keystroke (the input's draft lives there), so memo it: same mode / difficulty / combo → no re-read.
export default memo(LiveStack);
