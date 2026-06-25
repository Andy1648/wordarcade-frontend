// KnifeSplit.jsx
// The intro -> menu reveal: a cheap, decisive sword-swipe that REPLACES the old
// intro explosion (shockwave rings + counter-rotating SVG starbursts + 14 shards).
// It reads as a single knife cut, in three legible beats:
//   1. A thin bright WHITE line streaks fast ACROSS the screen along a shallow,
//      near-horizontal diagonal (the stroke) - drawn by a ::before edge on each half.
//   2. The line HOLDS for a beat (the completed cut registers - the seam).
//   3. The two dark pieces SEPARATE perpendicular to the cut - top lifts up, bottom
//      drops down - and the white cut RIDES OUTWARD on each piece as its glowing
//      leading border, splitting the single line into two as the menu is revealed.
// Everything here is transform / clip-path / opacity only - three plain divs (the
// white cut is a ::before on each half, no separate blade element), no particles,
// SVG, or per-frame repaints - so it's far lighter than what it replaced.
//
// Cosmetic + pointer-events:none. App mounts it for ~480ms when the intro
// finishes; under prefers-reduced-motion App skips it entirely and just cuts to
// the menu (and the CSS belt-and-braces no-ops the animations too).
import './KnifeSplit.css';

export default function KnifeSplit() {
  return (
    <div className="knife-split" aria-hidden="true">
      {/* Two dark pieces cover the just-mounted menu, clipped on the SAME shallow
          diagonal cut line so the seam lines up, then widen apart (top lifts up,
          bottom drops down) to reveal it. Each carries a bright WHITE leading edge
          (::before in KnifeSplit.css) on its parting side: the edges draw the cut
          across as one line, then ride outward with the halves - the single slash
          splitting into two glowing borders. No separate blade element. */}
      <div className="knife-half knife-half-top" />
      <div className="knife-half knife-half-bottom" />
      {/* Quick white flash punched as the cut lands. */}
      <div className="knife-flash" />
    </div>
  );
}
