import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { initSentry, Sentry } from './sentry'
import { initAnalytics } from './analytics'

// Stand up monitoring + analytics BEFORE the app mounts. Both are graceful no-ops
// when their env keys are unset, and both are fully wrapped, so neither can block
// or break startup.
initSentry()
initAnalytics()

// On-brand crash screen shown by the Sentry error boundary if a render throws, so
// a crash reports to Sentry AND shows this instead of a blank white page.
function CrashFallback() {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: '20px',
        background: '#0d0618', color: '#FF2EC4', fontFamily: "'Bungee', cursive",
        textAlign: 'center', padding: '24px',
      }}
    >
      <div style={{ fontSize: '40px' }}>SOMETHING BROKE.</div>
      <div style={{ color: '#2EFFE0', fontFamily: "'Space Mono', monospace", fontSize: '16px' }}>
        The page hit a snag. A quick reload usually fixes it.
      </div>
      <button
        onClick={() => window.location.reload()}
        style={{
          fontFamily: "'Bungee', cursive", fontSize: '18px', color: '#0d0618',
          background: '#FFE94A', border: 'none', borderRadius: '8px',
          padding: '14px 28px', boxShadow: '5px 5px 0 #000', cursor: 'pointer',
          minHeight: '44px',
        }}
      >
        RELOAD
      </button>
    </div>
  )
}

// Responsive scale anchor. On large monitors every screen's content card caps
// at a fixed width (~1400px) and its type is largely fixed-px, so the UI ends up
// in a small central band with tiny text and huge empty margins. We expose ONE
// factor, --app-scale, that the live screen zooms by (see .view-screen), so the
// whole UI grows proportionally with the viewport. The factor is fit-to-1400 (a
// scaled screen never exceeds ~95vw -> no horizontal scrollbar) and clamped to
// [1, 1.6] so phones / screens <=1400px are untouched and ultrawides don't
// balloon. The homepage cancels it (it's height-locked to one screen).
function applyAppScale() {
  const DESIGN_W = 1400;
  const scale = Math.min(1.6, Math.max(1, (window.innerWidth * 0.95) / DESIGN_W));
  document.documentElement.style.setProperty('--app-scale', scale.toFixed(3));
}
applyAppScale();
window.addEventListener('resize', applyAppScale);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<CrashFallback />}>
      <App />
    </Sentry.ErrorBoundary>
  </React.StrictMode>,
)
