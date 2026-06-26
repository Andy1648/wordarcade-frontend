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
  // Height-fit cap. The scaled UI must never need a vertical scroll in-game, so we
  // cap the zoom by viewport HEIGHT: a screen can't zoom taller than DESIGN_H lets it.
  // DESIGN_H = the natural (zoom-1) height the TALLEST in-game screen must show, so
  // the no-scroll guarantee is `must-fit <= DESIGN_H` at every window height.
  // MEASURED (Chrome, zoom 1) the tallest in-game screen of each mode:
  //   Word Bomb stage 868px (input bottom 819) ← tallest, the binding constraint
  //   Imposter stage  471px · Category Blitz stage 378px (both far shorter)
  // 1040 reserved ~170px of dead headroom over the real 868, making the UI feel
  // small on big monitors. Lowered to 868 + ~52px safety margin so the app scales
  // UP (e.g. 2560x1328: 1.277 -> 1.443) while staying safely above the tallest
  // screen. Margin runs a touch over the usual 20-40 to buffer the states that
  // can't be exercised solo (Imposter voting at max players, CB at max answers).
  const DESIGN_H = 920;
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

// One-time log so the real monitor's size + the resolved scale can be read back
// (Andy's resolution is unknown; this prints the actual numbers). Never throws.
try {
  console.log(
    `[viewport] ${window.innerWidth}x${window.innerHeight} -> --app-scale=` +
    `${getComputedStyle(document.documentElement).getPropertyValue('--app-scale').trim()}`,
  );
} catch { /* never let a log break startup */ }

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<CrashFallback />}>
      <App />
    </Sentry.ErrorBoundary>
  </React.StrictMode>,
)
