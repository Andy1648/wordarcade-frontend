// ComboPill.jsx — the live WINS-COMBO readout (Job 2). A climbing ×N.N shown next to the
// wins pill during play. PURE readout of the combo state passed in; it changes NO score.
// The only motion is a FINITE 200ms shake fired on a real break (re-keyed by `breaks`) —
// no idle/infinite animation, so the concurrent-animation budget is unchanged.
import './ComboPill.css';

export default function ComboPill({ mult = 1, breaks = 0 }) {
  const m = Number.isFinite(mult) && mult > 0 ? mult : 1;
  const hot = m >= 2; // ×2.0+ gets the hot colour treatment (pure CSS, no new loop)
  return (
    <div className="combo-pill" aria-hidden="true">
      {/* key={breaks} re-mounts ONLY on a break, replaying the finite shake once. The shake
          class is gated to breaks>0 so the very first mount (breaks 0) never shakes. */}
      <div key={breaks} className={`combo-pill-inner${breaks > 0 ? ' is-break' : ''}${hot ? ' is-hot' : ''}`}>
        <span className="combo-pill-x">×{m.toFixed(1)}</span>
        <span className="combo-pill-label">WIN COMBO</span>
      </div>
    </div>
  );
}
