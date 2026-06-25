import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

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
    <App />
  </React.StrictMode>,
)
