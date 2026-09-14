// SoloLoadState.jsx — the loading / load-FAILURE state for the solo modes (Job 16). CHAIN + FUSE
// pull their word data as a lazy chunk; if that fetch fails (offline, flaky wifi, a dropped CDN),
// the old code left the player stuck on a bare "…" forever with no message and no exit. This shows a
// human-readable failure with a RETRY and an always-present EXIT, so the screen is never a dead end.
import './Solo.css';

export default function SoloLoadState({ accent, error = false, onRetry, onExit, audioSlot = null }) {
  return (
    <div className="solo-root" style={{ '--solo-accent': accent }}>
      {/* THE SAME CORNER CLUSTER THE SHELL HAS. This screen renders `.solo-root` too, so it
          looks like the mode — but it had EXIT and nothing else, which meant that for the
          whole of the lazy word-data fetch there was no sound control on the screen at all.
          That is the shape Batch 2 already rejected once: a fix for a collision that deletes
          the control from three screens is not a fix. (It is also what made the solo gate
          flake: it waited on `.solo-root`, which this state satisfies, and read the cluster
          before the real shell had mounted.) */}
      <div className="solo-corner">
        {audioSlot}
        <button type="button" className="solo-exit" onClick={onExit} aria-label="Exit">
          ✕
        </button>
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
        <div className="solo-center" aria-label="Loading">…</div>
      )}
    </div>
  );
}
