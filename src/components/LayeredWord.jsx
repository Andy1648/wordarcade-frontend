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
// Both of those call sites are now migrated onto this component, and each kept only what is
// genuinely its own: the SIZE, the tracking (--lw-ls), the mode colour, and --lw-inline-alpha.
// They gained the Shade metric correction below in the process, which is the part a hand copy
// never carried.
//
// ORDER IS LOAD-BEARING — Shade (the extrude) at the back, then the solid face in the mode's
// ACCENT, then Bungee Inline's white highlight, then Outline's black keyline on top. Any other
// order buries a layer: the accent must not composite last, because Bungee Inline is very
// nearly a solid face (21.00% ink against Bungee's 22.17% — a thin groove is the whole
// difference), so a solid face painted over it hides the highlight completely.
// The highlight's strength is therefore controlled by its ALPHA, not by the stacking — see
// --lw-inline-alpha in LayeredWord.css.
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
      <span className="lw-face lw-fill">{text}</span>
      <span className="lw-face lw-inline">{text}</span>
      <span className="lw-face lw-outline">{text}</span>
    </span>
  );
}
