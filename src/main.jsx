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
// [1, MAX_WIDTH_ZOOM] so phones / screens <=1400px are untouched and large
// monitors scale UP to fill the screen. The homepage cancels it (height-locked).
//
// The width zoom is then CAPPED by viewport height (heightCap) so a screen can
// never zoom taller than the viewport — that's the in-game no-vertical-scroll
// guarantee, and it stays in force regardless of the width ceiling below.

// TOKEN: the width-zoom ceiling. Raised from 1.6 -> 2.5 so big monitors fill the
// screen. This only lifts the WIDTH cap; the height cap (h / DESIGN_H) still
// binds, so in-game screens never grow a vertical scrollbar. Tune here.
const MAX_WIDTH_ZOOM = 2.5;

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
    // Zoom UP to fill wide monitors (>=1, capped at MAX_WIDTH_ZOOM), so content
    // never sits tiny in the fixed-width card. Screens <=1400px stay at 1.
    const widthZoom = Math.min(MAX_WIDTH_ZOOM, Math.max(1, (w * 0.95) / DESIGN_W));
    // fit-to-contain. Cap the zoom by viewport height so the scaled screen always
    // fits vertically; on short windows this pulls the scale below 1 so the core
    // screens shrink to fit instead of overflowing into a vertical scroll. This
    // height cap is the in-game no-scroll guarantee and is UNCHANGED.
    const heightCap = h / DESIGN_H;
    scale = Math.max(0.6, Math.min(widthZoom, heightCap));
  }
  document.documentElement.style.setProperty('--app-scale', scale.toFixed(3));
}
applyAppScale();
window.addEventListener('resize', applyAppScale);

// One-time viewport log (Andy's monitor size is unknown and needed to tune the
// scale ceiling). innerWidth × innerHeight + the resolved scale, once on load.
try {
  console.log(
    `[viewport] ${window.innerWidth}×${window.innerHeight} · --app-scale=${
      getComputedStyle(document.documentElement).getPropertyValue('--app-scale').trim()
    } (width-zoom ceiling ${MAX_WIDTH_ZOOM})`,
  );
} catch { /* never let a log throw */ }

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<CrashFallback />}>
      <App />
    </Sentry.ErrorBoundary>
  </React.StrictMode>,
)
