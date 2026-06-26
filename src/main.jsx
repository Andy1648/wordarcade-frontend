import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { initAnalytics, initSentry, Sentry } from './lib/analytics'

// Stand up analytics + monitoring BEFORE the app mounts. Both are graceful no-ops
// when their env keys are unset and are internally wrapped; the extra try/catch
// here is belt-and-suspenders so a bad SDK load can never block startup.
try { initAnalytics() } catch { /* never block startup */ }
try { initSentry() } catch { /* never block startup */ }

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
  // Natural height of the tallest CORE screen (the in-game stage, ~960-980px +
  // padding). Used to cap the zoom by viewport HEIGHT so a wide screen can't zoom
  // content taller than the viewport and force a vertical scroll.
  const DESIGN_H = 1040;
  const w = window.innerWidth;
  const h = window.innerHeight;
  let scale;
  if (w <= 600) {
    // Phones: the dedicated mobile CSS owns the layout — never zoom it.
    scale = 1;
  } else {
    // Original behaviour: zoom UP to fill wide monitors (>=1, capped at 1.6), so
    // content never sits tiny in the fixed-width card. Screens <=1400px stay at 1.
    const widthZoom = Math.min(1.6, Math.max(1, (w * 0.95) / DESIGN_W));
    // NEW: fit-to-contain. Cap the zoom by viewport height so the scaled screen
    // always fits vertically; on short windows this pulls the scale below 1 so the
    // core screens shrink to fit instead of overflowing into a vertical scroll.
    const heightCap = h / DESIGN_H;
    scale = Math.max(0.6, Math.min(widthZoom, heightCap));
  }
  document.documentElement.style.setProperty('--app-scale', scale.toFixed(3));
}
applyAppScale();
window.addEventListener('resize', applyAppScale);

// [night/spring-sandbox] Throwaway demo route. Reachable ONLY at `/#spring-sandbox`
// (hash → no server rewrite needed, and the real app never matches it). Lazy-loaded
// so the demo's code is code-split out of the normal app bundle. Remove this guard
// (and the SpringSandbox component) before any merge to main.
const isSpringSandbox =
  typeof window !== 'undefined' &&
  (window.location.hash === '#spring-sandbox' ||
    window.location.pathname === '/spring-sandbox');

const root = ReactDOM.createRoot(document.getElementById('root'));

if (isSpringSandbox) {
  const SpringSandbox = React.lazy(() => import('./components/SpringSandbox.jsx'));
  root.render(
    <React.StrictMode>
      <Sentry.ErrorBoundary fallback={<CrashFallback />}>
        <React.Suspense fallback={null}>
          <SpringSandbox />
        </React.Suspense>
      </Sentry.ErrorBoundary>
    </React.StrictMode>,
  );
} else {
  root.render(
    <React.StrictMode>
      <Sentry.ErrorBoundary fallback={<CrashFallback />}>
        <App />
      </Sentry.ErrorBoundary>
    </React.StrictMode>,
  )
}
