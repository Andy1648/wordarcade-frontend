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
import { useTimerClock } from '../frenzy/useTimerClock';
import { liveBoostRemaining } from '../progress/liveBoost';
import '../frenzy/MechanicScale.css';
import { perWordRateNow, modeKey, WEIGHTED_MODES } from '../progress/wins';
import { roundWordXp } from '../progress/xp';
import { formatRate, formatMultExact } from '../format';
import './LiveStack.css';

// ANDY OCT2 — "never overcrowded with useless info". The standing BASE / MODE / DIFFICULTY /
// REBIRTH / STREAK / BONUS rows went: they never change during a run, and the end-of-round
// receipt (WHERE YOUR WINS CAME FROM) names every one of them with what it actually paid. While
// playing, the chip says the things that MOVE: the rate, a live COMBO (Word Bomb + Blitz only — the modes
// whose per-word weight pays, as a BOOST factor), FUSE FRENZY and a live BOOST.
// less-is-more (Andy oct3): the standing "LONGER WORDS PAY MORE" row went too — the mode card, the
// mode dialog and the teach strip already say it; mid-game it was a fourth copy of a rule.
// formatMultExact — the RECEIPT's formatter (×1.05, not the one-decimal ×1.1 the game does not apply).
const mult = (m) => `×${formatMultExact(m)}`;

function LiveStack({ mode, difficulty, combo = 1, compact = false }) {
  // Rebirth Rush OVERDRIVE can START mid-run (the letter flush rolls it) while this memoised chip's props
  // stay the same — subscribe to its clock so the rate and the OVERDRIVE pill appear (and leave) on time.
  // 1 Hz only while a timer runs; nothing ticks at rest.
  // BUG (Andy oct8, "XP boost item ×10 lasts until new screen and not timer"): the UPGRADES ×10 OVERDRIVE item is a
  // code BOOST (boost.js startBoost → taw.boost), NOT the Rebirth Rush overdrive clock — so this chip only watched
  // overdriveRemaining(), saw 0, armed nothing, and the BOOST ×10 row + rate sat on screen past the 5 minutes until
  // the next screen re-rendered it. The WINS actually paid always followed the clock (wins.js reads boostMult per
  // word). Watch BOTH timers: the longer one is the moment this chip must change.
  useTimerClock(liveBoostRemaining);
  const now = perWordRateNow({ mode, difficulty });
  const frenzy = Number.isFinite(now.factors.frenzy) && now.factors.frenzy > 1 ? now.factors.frenzy : 0;
  const boost = Number.isFinite(now.factors.boost) && now.factors.boost > 1 ? now.factors.boost : 0;

  // The live COMBO is what the player is doing right now — the one row that moves while they type.
  // Word Bomb + Blitz only: the other modes do not pay it.
  const live = combo > 1 && WEIGHTED_MODES.has(modeKey(mode)) ? { key: 'combo', label: 'COMBO', value: combo } : null;
  // With a live combo the word's XP is re-rounded on the same whole-XP grid the award uses, so the
  // headline is the tenth-exact number a common word would bank right now.
  const shown = live ? roundWordXp(now.xp * combo) / 10 : now.rate;

  return (
    <div className={`lstack${compact ? ' lstack--compact' : ''}`} aria-hidden="true">
      <div className="lstack-head">
        <span className="lstack-rate">{formatRate(shown)}</span>
        <span className="lstack-per">{compact ? '/ WORD' : 'WINS / WORD'}</span>{/* compact = the WB/Blitz receipt rail, beside the WINS pill: the longer unit widened the 1024px band into SKIP */}
      </div>
      {(frenzy > 0 || boost > 0 || live) && <div className="lstack-rows">
        {frenzy > 0 && (
          <div className="lstack-row lstack-row--frenzy">
            <span className="lstack-label">FRENZY</span>
            <span className="lstack-val">{mult(frenzy)}</span>
          </div>
        )}
        {/* R5 oct8: the BOOST DOCK (#304, bottom-right) owns boost CLOCKS now. This row was still rendering a
            BoostPill with its own countdown, so in-game the same boost showed two clocks ticking in sync —
            "BOOST x3 6:48" top-left and "x3 BOOST 6:48" bottom-right. The stack states the FACTOR, like every
            other row in it; the dock states the time left. */}
        {boost > 0 && (
          <div className="lstack-row lstack-row--boost">
            <span className="lstack-label">BOOST</span>
            <span className="lstack-val">{mult(boost)}</span>
          </div>
        )}
        {live && (
          <div className="lstack-row lstack-row--live" key="combo">
            <span className="lstack-label">{live.label}</span>
            <span className="lstack-val">{mult(live.value)}</span>
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
