// ComboMeter.jsx
// The escalating combo/streak HUD, shared by Word Bomb and Category Blitz. It is
// PURELY a readout of the local `useCombo` state - it renders nothing about
// score, points or who's winning. Absolutely positioned + pointer-events:none so
// it floats over the input area without blocking it or reflowing on every key.
import { useState } from 'react';
import { heatTier } from '../juice/ladder';
import { LevelUpChip } from './FeelLadder';
import './ComboMeter.css';

// Streak length -> intensity tier. Below 2 there's no combo to show. The thresholds (2/4/7/10) ARE
// the escalation ladder's (juice/ladder.js) — one table, so the meter and the feel always agree.
const TIER_NAMES = [null, 'warm', 'hot', 'fire', 'max'];
function tierOf(n) {
  return TIER_NAMES[heatTier(n)];
}

// The shatter shown when a streak breaks - self-removes after its drop animation. Exported so the
// solo modes (SoloShell) say a broken T2+ streak the same way.
export function ComboShatter({ count }) {
  const [done, setDone] = useState(false);
  if (done) return null;
  return (
    <div
      className="combo-shatter"
      onAnimationEnd={() => setDone(true)}
      aria-hidden="true"
    >
      <span className="combo-shatter-count">{count} HITS</span>
      <span className="combo-shatter-label">LOST</span>
    </div>
  );
}

export default function ComboMeter({ count, brk }) {
  const tier = tierOf(count);
  return (
    <div className="combo-meter" aria-hidden="true">
      {/* Mid-game LEVEL-UP: a small finite "LV n" punch beside the streak (renders nothing until a
          game word crosses a level). It joins this cluster — never its own fixed UI. */}
      <LevelUpChip />
      {tier && (
        // The tier class (on the persistent badge) owns the per-tier colour +
        // idle shake; the inner .combo-pop is re-keyed by `count` so the grow-pop
        // replays on every increment without restarting the idle shake.
        <div className={`combo-badge combo-${tier}`}>
          {/* Sparks are a FINITE burst on tier ENTRY (3 iterations, then still) — never a loop at
              rest (ANIMATION BUDGET). Keyed by tier so crossing fire -> max replays them. */}
          {(tier === 'fire' || tier === 'max') && (
            <span key={tier} className="combo-sparks">
              <span className="combo-spark s0" />
              <span className="combo-spark s1" />
              <span className="combo-spark s2" />
            </span>
          )}
          <div key={count} className="combo-pop">
            <span className="combo-flame">{count >= 7 ? '🔥' : '✦'}</span>
            {/* H6/H12: a COUNT, said as one ("5 HITS"; "IN A ROW" widened the 1024px band into SKIP). "COMBO ×5" sat beside the receipt's real COMBO ×1.5
                multiplier on the same screen; "×" is reserved for multipliers. */}
            <span className="combo-count">{count}</span>
            <span className="combo-label">HITS</span>
          </div>
        </div>
      )}
      {brk.key > 0 && <ComboShatter key={brk.key} count={brk.count} />}
    </div>
  );
}
