// SoloLoadState.jsx — the loading / load-FAILURE state for the solo modes (Job 16). CHAIN + FUSE
// pull their word data as a lazy chunk; if that fetch fails (offline, flaky wifi, a dropped CDN),
// the old code left the player stuck on a bare "…" forever with no message and no exit. This shows a
// human-readable failure with a RETRY and an always-present EXIT, so the screen is never a dead end.
//
// The panel now HUGS its content (Solo.css), so this state carries `is-loadstate` for a sensible
// minimum box — otherwise a two-line message would collapse the frame to a sliver. The exit sits in
// the same HUD row as the play shell's, so the two screens put the control in the same place.
import './Solo.css';
import SoloExit from './SoloExit.jsx';

export default function SoloLoadState({ accent, error = false, onRetry, onExit }) {
  return (
    <div className="solo-root is-loadstate" style={{ '--solo-accent': accent }}>
      <div className="solo-hud">
        {/* The SAME labelled exit as the play shell (SoloExit.jsx) — the loading/failure screen is
            where a stranger is most likely to bail, so it gets the real control, not a glyph. */}
        <SoloExit onExit={onExit} />
        <div className="solo-hud-stats" />
      </div>
      {error ? (
        <div className="solo-loadstate" role="alert">
          <div className="solo-loadstate-title">COULDN'T LOAD WORDS</div>
          <div className="solo-loadstate-sub">Check your connection and try again.</div>
          <button type="button" className="solo-restart is-armed" onClick={onRetry}>
            RETRY
          </button>
        </div>
      ) : (
        // NOT .solo-center: that class is now the hero's four-layer letter stack, positioned
        // absolutely inside .solo-hero — which does not exist on this screen.
        <div className="solo-loadstate" aria-label="Loading">
          <div className="solo-loadstate-title">…</div>
        </div>
      )}
    </div>
  );
}
