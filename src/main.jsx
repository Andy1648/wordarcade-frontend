// FIRST: translate a clean path (/sat-rush, /room/CODE, …) into the query the entry-param readers
// expect, BEFORE App and its config modules import (feat/router). Side-effect import — must precede
// './App.jsx' so LAUNCH_INTENT / solo / cg / satRush configs read the bridged search.
import './routerBoot'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './theme/themes.css'
import { initTheme } from './theme/themes'
import { initAnalytics, initSentry, Sentry } from './lib/analytics'
import { firstVisit, refreshSessionProps } from './lib/events'
import { loadProgress, getRebirths } from './progress/xp'
import { getStreak } from './progress/streak'

// Apply the persisted menu theme BEFORE React mounts, so the first paint is already in the
// player's palette (no default-then-swap flash). Guarded internally; a blocked store → default.
try { initTheme() } catch { /* never block startup */ }

// ---- Third-party boot (perf/first-load): NOTHING third-party runs on the critical path. ----
// gtag (GA4), Sentry's init and PostHog all start from ONE idle callback scheduled after the
// window 'load' event. Before that:
//  - a dataLayer/gtag stub queues any early gtag() calls (analytics.track fires them), so the
//    real tag processes them on arrival — the standard GA snippet pattern, just later;
//  - a tiny error shim records uncaught errors / unhandled rejections so the gap between boot
//    and Sentry.init loses nothing — they are replayed into Sentry once it is up.
// The Sentry.ErrorBoundary below still wraps the tree from the first render (its module is part
// of the bundle; only init is deferred), so a render crash still shows the on-brand fallback.
const GA_ID = 'G-BZ7DLWLDMR';
window.dataLayer = window.dataLayer || [];
if (typeof window.gtag !== 'function') {
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
}

const earlyErrors = [];
const shimError = (e) => { earlyErrors.push(e && (e.error || e.message) ? (e.error || e.message) : e); };
const shimRejection = (e) => { earlyErrors.push(e && e.reason !== undefined ? e.reason : e); };
window.addEventListener('error', shimError);
window.addEventListener('unhandledrejection', shimRejection);

function bootSentry() {
  initSentry();
  window.removeEventListener('error', shimError);
  window.removeEventListener('unhandledrejection', shimRejection);
  for (const err of earlyErrors.splice(0)) {
    try { Sentry.captureException(err instanceof Error ? err : new Error(String(err))) } catch { /* never throw */ }
  }
}

// Inject gtag.js and fire the ONE page_view per visit ourselves (send_page_view:false stops the
// config call from double-counting it). Queue order: js → config → page_view, then the script.
function bootGtag() {
  if (document.querySelector('script[src*="googletagmanager.com/gtag/js"]')) return;
  window.gtag('js', new Date());
  window.gtag('config', GA_ID, { send_page_view: false });
  window.gtag('event', 'page_view', {
    page_location: window.location.href,
    page_path: window.location.pathname + window.location.search,
    page_title: document.title,
  });
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(s);
}

const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1));
const afterLoad = (fn) => {
  if (document.readyState === 'complete') fn();
  else window.addEventListener('load', fn, { once: true });
};
afterLoad(() => idle(() => {
  try { bootSentry() } catch { /* never block startup */ }
  try { bootGtag() } catch { /* never block startup */ }
  // Init analytics, THEN fire first_visit (once) + attach the progression session props, so the very
  // first events are already segmented. All guarded — analytics can never block or crash startup.
  Promise.resolve(initAnalytics())
    .then(() => {
      try {
        firstVisit();
        const prog = loadProgress();
        refreshSessionProps({ level: prog.level, rebirths: getRebirths(), streak: getStreak().count });
      } catch { /* analytics never blocks */ }
    })
    .catch(() => {});
}));

// On-brand crash screen shown by the Sentry error boundary if a render throws, so
// a crash reports to Sentry AND shows this instead of a blank white page.
function CrashFallback() {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: '20px',
        background: '#0d0618', color: '#ff4fa3', fontFamily: "'Bungee', cursive",
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

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<CrashFallback />}>
      <App />
    </Sentry.ErrorBoundary>
  </React.StrictMode>,
)
