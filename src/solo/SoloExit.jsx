// SoloExit.jsx — the way OUT of a solo mode, in one place.
//
// Was a bare 40x40 "✕" duplicated in SoloShell and SoloLoadState: under the 44px touch minimum,
// and meaningless to the visitor this screen most needs to keep — someone who arrived on a shared
// CHAIN/FUSE link, has never seen the menu, and for whom this button is the only door to the rest
// of the game. It is now a labelled >=44x44 target that names its destination.
//
// One component, used by BOTH the load state and the play shell, so the loading screen can never
// again be left holding the old glyph while the game screen has the real control.
//
// Positioning stays with .solo-exit in Solo.css: absolute at z-60, so it outranks the .solo-over
// run-over scrim (z-50) and is still reachable on the death card.

export default function SoloExit({ onExit }) {
  return (
    <button type="button" className="solo-exit" onClick={onExit}>
      <span className="solo-exit-arrow" aria-hidden="true">←</span>
      <span className="solo-exit-label">MENU</span>
    </button>
  );
}
