// ConnectingContent.jsx
// The in-button connect feedback, shared by the Homepage CTAs and the ModeDialog
// CREATE / JOIN buttons (extracted here so both can reuse the one component
// without a Homepage <-> ModeDialog circular import).
//
// Phase 1 (cold=false): a spinning ink ring + CONNECTING…. Phase 2 (cold=true,
// after COLD_START_HINT_MS): the same spinner with WAKING THE SERVER… and a Space
// Mono reassurance sub-line. The spinner is FEEDBACK during an active wait (allowed
// under the menu's no-idle-motion law); reduced motion swaps the ring for a static
// ⏳ (handled in CSS). aria-live lets a screen reader announce the phase-1 →
// phase-2 shift.
//
// Styles live in Homepage.css (.connecting*), which is always mounted alongside
// both consumers (the ModeDialog only ever renders while the Homepage is up).
export default function ConnectingContent({ cold }) {
  return (
    <span className="connecting" aria-live="polite">
      <span className="connecting-spinner" aria-hidden="true" />
      <span className="connecting-spinner-rm" aria-hidden="true">⏳</span>
      <span className="connecting-text">
        <span className="connecting-main">
          {cold ? 'WAKING THE SERVER…' : 'CONNECTING…'}
        </span>
        {cold && (
          <span className="connecting-sub">free hosting naps — ~30s, game starts by itself</span>
        )}
      </span>
    </span>
  );
}
