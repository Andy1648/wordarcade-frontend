// ScreenBoundary.jsx — a PER-SCREEN error boundary (fix/error-boundaries). One global boundary means
// a single screen's crash blanks the whole app (exactly what the Stats ReferenceError and React #310
// did). Wrapping the menu, each game screen, and each overlay in its own boundary keeps a crash LOCAL:
// the broken screen shows an inline "THIS SCREEN BROKE — GO BACK" panel (with a working back action)
// and reports to Sentry, while the rest of the app stays mounted and interactive.
//
// Built on the plain ErrorBoundary (perf/first-load — Sentry is no longer a boot import). It catches
// + renders the fallback regardless of Sentry; the report goes through captureException, which
// queues until Sentry is lazily initialised (the DSN only decides whether it is actually SENT).
import ErrorBoundary from './ErrorBoundary.js';
import './ScreenBoundary.css';

// TEST SEAM (same family as ?soloms= / ?coldstart= / window.__TAW_*): `?boom=<name>` makes the
// boundary whose name matches throw during render, so an e2e can force a crash in a specific screen
// and assert the panel shows + the rest of the app still works. Self-inflicted + recoverable (it only
// crashes the current viewer's own screen), never a real hazard.
function boomActive(name) {
  try {
    if (typeof window !== 'undefined' && window.__TAW_BOOM === name) return true;
    return typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('boom') === name;
  } catch {
    return false;
  }
}
function Boom({ name }) {
  throw new Error(`forced crash (test seam) in screen "${name}"`);
}

export default function ScreenBoundary({ name = 'screen', onBack = null, children }) {
  return (
    <ErrorBoundary
      // Tag the report with which screen broke, so Sentry groups per-screen.
      captureContext={{ tags: { screen: name } }}
      fallback={({ resetError }) => (
        <div className="screen-boundary" role="alert" aria-live="assertive">
          <div className="sb-panel">
            <div className="sb-emoji" aria-hidden="true">🧨</div>
            <div className="sb-title">THIS SCREEN BROKE</div>
            <div className="sb-sub">A quick step back usually fixes it. Your progress is safe.</div>
            <button
              type="button"
              className="sb-back"
              onClick={() => { try { resetError && resetError(); } catch { /* noop */ } if (onBack) onBack(); else { try { window.location.reload(); } catch { /* noop */ } } }}
            >
              ← GO BACK
            </button>
          </div>
        </div>
      )}
    >
      {boomActive(name) ? <Boom name={name} /> : null}
      {children}
    </ErrorBoundary>
  );
}
