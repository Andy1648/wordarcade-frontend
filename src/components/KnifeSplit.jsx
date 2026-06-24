// KnifeSplit.jsx
// The intro -> menu reveal: a cheap, decisive "blade" slice that REPLACES the old
// intro explosion (shockwave rings + counter-rotating SVG starbursts + 14 shards).
// A bright slash streaks down the split axis (the knife), a quick white flash
// marks the cut, then the screen splits into two dark halves that slam apart along
// a diagonal to reveal the menu mounted behind. Everything here is transform/
// opacity only - four plain divs, no particles, SVG, or per-frame repaints - so
// it's far lighter than what it replaced.
//
// Cosmetic + pointer-events:none. App mounts it for ~480ms when the intro
// finishes; under prefers-reduced-motion App skips it entirely and just cuts to
// the menu (and the CSS belt-and-braces no-ops the animations too).
import './KnifeSplit.css';

export default function KnifeSplit() {
  return (
    <div className="knife-split" aria-hidden="true">
      {/* Two dark halves cover the just-mounted menu, then slide apart (A up-left,
          B down-right) along the diagonal seam to reveal it. */}
      <div className="knife-half knife-half-a" />
      <div className="knife-half knife-half-b" />
      {/* Quick white flash on the cut instant. */}
      <div className="knife-flash" />
      {/* The blade: a thin bright line that streaks down the seam first. */}
      <div className="knife-slash" />
    </div>
  );
}
