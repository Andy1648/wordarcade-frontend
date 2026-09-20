// LayeredWord.jsx — the app's chromatic Bungee letterform, as one shared component.
//
// Bungee ships as a CHROMATIC FAMILY: Shade, regular, Inline and Outline are four faces drawn
// to stack in register. Layering them gives real typographic depth from the font itself — which
// is why the house rule (CLAUDE.md: ART VS MOTION, and the CANONICAL MENU TITLE law) prefers it
// to a text-shadow stack, and why every giant display word in the app is built this way.
//
// WHY THIS FILE EXISTS: that four-span stack was written out by hand on each screen that wanted
// it — `solo-cl-*` in solo/SoloShell.jsx (CHAIN + FUSE), `room-code-*` in RoomScreen.jsx — with
// the same four font-families and the same four colours re-declared each time. This is that
// recipe extracted ONCE so the next screen composes it instead of copying it.
//
// The existing call sites are deliberately NOT migrated in this branch: they are on other
// screens, and this branch has to prove a byte-identical desktop menu. Migrating them is a
// clean follow-up, and nothing here changes their rendering in the meantime.
//
// ORDER IS LOAD-BEARING, and it is not the order it first looks like it should be. Back to
// front: Shade (the extrude), Outline (the black keyline), the plain solid face carrying the
// BEVEL highlight, and Bungee Inline carrying the mode ACCENT on top.
//
// Two measured facts drive that (both derived in LayeredWord.css):
//  1. Bungee Inline is very nearly a SOLID face — 21.00% ink against Bungee's 22.17%, a thin
//     groove being the whole difference — so whichever of the two is painted second covers the
//     other almost entirely. The accent therefore rides INLINE, not the solid face: painting
//     white over the accent washed #2EFFE0 to #B0FBF3.
//  2. Bungee Outline's stroke sits ON the same contour the groove follows, so with Outline on
//     top it paints over the groove and the highlight disappears (measured: 0 white pixels).
//     Dropping it under the bevel leaves the highlight visible (332px) while the outer half of
//     its stroke still reads as the black keyline (934px).
import './LayeredWord.css';

/**
 * @param text       the word(s). A "\n" renders as a line break (the faces use pre-line, so all
 *                   four break identically and stay in register).
 * @param accent     the fill colour — the one layer that changes per mode.
 * @param className  extra class on the stack root (sizing/positioning live on the caller).
 *
 * The stack is aria-hidden: four copies of the same string would otherwise be announced four
 * times over. Callers MUST carry the accessible name themselves (aria-label on the link/button).
 */
export default function LayeredWord({ text, accent, className = '' }) {
  return (
    <span
      className={`lw ${className}`.trim()}
      style={accent ? { '--lw-accent': accent } : undefined}
      aria-hidden="true"
    >
      <span className="lw-face lw-shade">{text}</span>
      <span className="lw-face lw-outline">{text}</span>
      <span className="lw-face lw-bevel">{text}</span>
      <span className="lw-face lw-fill">{text}</span>
    </span>
  );
}
