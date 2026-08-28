// SoloLoadState.jsx — the loading / load-FAILURE state for the solo modes (Job 16). CHAIN + FUSE
// pull their word data as a lazy chunk; if that fetch fails (offline, flaky wifi, a dropped CDN),
// the old code left the player stuck on a bare "…" forever with no message and no exit. This shows a
// human-readable failure with a RETRY and an always-present EXIT, so the screen is never a dead end.
import './Solo.css';

export default function SoloLoadState({ accent, error = false, onRetry, onExit }) {
  return (
    <div className="solo-root" style={{ '--solo-accent': accent }}>
      <button type="button" className="solo-exit" onClick={onExit} aria-label="Exit">
        ✕
      </button>
      {error ? (
        <div className="solo-loadstate" role="alert">
          <div className="solo-loadstate-title">COULDN'T LOAD WORDS</div>
          <div className="solo-loadstate-sub">Check your connection and try again.</div>
          <button type="button" className="solo-restart is-armed" onClick={onRetry}>
            RETRY
          </button>
        </div>
      ) : (
        <div className="solo-center" aria-label="Loading">…</div>
      )}
    </div>
  );
}
