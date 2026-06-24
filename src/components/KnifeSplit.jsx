// KnifeSplit.jsx
// The intro -> menu reveal: a cheap, decisive sword-swipe that REPLACES the old
// intro explosion (shockwave rings + counter-rotating SVG starbursts + 14 shards).
// It reads as a single knife cut, in three legible beats:
//   1. A thin bright blade streaks fast ACROSS the screen along a shallow,
//      near-horizontal diagonal (the stroke).
//   2. The screen splits ALONG that exact cut line into two dark pieces (a top
//      piece and a bottom piece, clipped on the same diagonal so they line up).
//   3. The two pieces SEPARATE perpendicular to the cut - the top lifts up, the
//      bottom drops down - opening like a wound to reveal the menu behind.
// Everything here is transform / clip-path / opacity only - four plain divs, no
// particles, SVG, or per-frame repaints - so it's far lighter than what it
// replaced.
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
          bottom drops down) to reveal it. */}
      <div className="knife-half knife-half-top" />
      <div className="knife-half knife-half-bottom" />
      {/* Quick white flash on the cut instant. */}
      <div className="knife-flash" />
      {/* The blade: a thin bright line that streaks across the cut line first. */}
      <div className="knife-slash" />
    </div>
  );
}
