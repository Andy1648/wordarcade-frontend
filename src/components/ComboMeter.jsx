// ComboMeter.jsx
// The escalating combo/streak HUD, shared by Word Bomb and Category Blitz. It is
// PURELY a readout of the local `useCombo` state - it renders nothing about
// score, points or who's winning. Absolutely positioned + pointer-events:none so
// it floats over the input area without blocking it or reflowing on every key.
import { useState } from 'react';
import './ComboMeter.css';

// Streak length -> intensity tier. Below 2 there's no combo to show.
function tierOf(n) {
  if (n >= 10) return 'max';
  if (n >= 7) return 'fire';
  if (n >= 4) return 'hot';
  if (n >= 2) return 'warm';
  return null;
}

// The shatter shown when a streak breaks - self-removes after its drop animation.
function ComboShatter({ count }) {
  const [done, setDone] = useState(false);
  if (done) return null;
  return (
    <div
      className="combo-shatter"
      onAnimationEnd={() => setDone(true)}
      aria-hidden="true"
    >
      <span className="combo-shatter-count">×{count}</span>
      <span className="combo-shatter-label">COMBO LOST</span>
    </div>
  );
}

export default function ComboMeter({ count, brk }) {
  const tier = tierOf(count);
  return (
    <div className="combo-meter" aria-hidden="true">
      {tier && (
        // The tier class (on the persistent badge) owns the per-tier colour +
        // idle shake; the inner .combo-pop is re-keyed by `count` so the grow-pop
        // replays on every increment without restarting the idle shake.
        <div className={`combo-badge combo-${tier}`}>
          {(tier === 'fire' || tier === 'max') && (
            <>
              <span className="combo-spark s0" />
              <span className="combo-spark s1" />
              <span className="combo-spark s2" />
            </>
          )}
          <div key={count} className="combo-pop">
            <span className="combo-flame">{count >= 7 ? '🔥' : '✦'}</span>
            <span className="combo-label">COMBO</span>
            <span className="combo-count">×{count}</span>
          </div>
        </div>
      )}
      {brk.key > 0 && <ComboShatter key={brk.key} count={brk.count} />}
    </div>
  );
}
