// KnifeSplit.jsx
// The intro -> menu reveal, rebuilt so the SLASH and the SCREEN-OPEN are two
// FULLY INDEPENDENT timelines (the previous version conflated them into one
// motion that never lined up). Each beat has its own named variables below, so
// you can retune one without touching the other.
//
// GEOMETRY (the part that earlier attempts got wrong):
//   Two cover PANELS (top + bottom), each MUCH larger than the viewport so their
//   OUTER edges are always far off-screen — the user only ever sees the inner cut
//   edge. Both panels are rotated to the same ANGLE around the viewport centre:
//     - top panel:    transform-origin center bottom; rotate(ANGLE)  (covers top)
//     - bottom panel: transform-origin center top;    rotate(ANGLE)  (covers bottom)
//   Their meeting edge IS the diagonal at ANGLE. The slash, the seam and the open
//   all share ANGLE, so the screen opens parallel to the slash. The panels part by
//   translating PERPENDICULAR to that diagonal (translateY inside the rotated
//   frame), travelling far enough to fully clear the screen.
//
// THE OPEN is slow (OPEN_TRAVEL). On mount the panels begin opening IMMEDIATELY
// (t=0). THE SLASH is an independent flourish fired at OPEN_OFFSET (4700ms after
// the open starts) — a quick white streak + screen-flash that draws, flashes and
// fades. It does not need to align with the gap; it rides on top.
//
// PLAY FREQUENCY: the full intro plays only on the FIRST visit per browser
// session (sessionStorage 'introPlayed'); same-session reloads skip straight to
// the menu. Tap/click/key anywhere skips instantly. prefers-reduced-motion skips
// the slow open entirely. In every case the component hands off cleanly via
// onComplete — it never leaves a stuck overlay or panels frozen mid-screen.
//
// Cosmetic + pointer-events:none — transform/opacity only, no per-frame repaints.
import { useEffect, useRef, useState } from 'react';
import './KnifeSplit.css';

// ===== OPEN — timing/geometry (independent of the slash flourish) =====
const ANGLE = 4; // deg — shared by slash, seam AND open so they stay parallel
const OPEN_TRAVEL = 10000; // ms — panels take this long to fully slide apart
const OPEN_OFFSET = 4700; // ms — open starts at t=0; the slash fires this much later
const OPEN_EASE = 'cubic-bezier(.45,0,.35,1)'; // panel-separation easing
const PANEL_TRAVEL = '120vh'; // perpendicular distance each panel clears (off-screen)

// ===== SLASH — timing (independent of the open above) =====
const SLASH_DRAW = 200; // ms — the streak draws across fast
const SLASH_FADE = 150; // ms — then immediately fades (no sustained hold)
const FLASH_DUR = 90; // ms — the white screen-punch as it crosses

// ===== SLASH — appearance (edit freely; touches no open/timing value) =====
const SLASH_THICK = 3; // px — line thickness
const SLASH_COLOR = '#fff'; // line colour
const FLASH_PEAK = 0.7; // peak opacity of the screen-flash

// Per-page-load fallback when sessionStorage is unavailable (private mode etc.):
// the intro then plays once per page-load instead of once per session.
let introPlayedMemory = false;

function hasPlayed() {
  try {
    return sessionStorage.getItem('introPlayed') === '1';
  } catch {
    return introPlayedMemory;
  }
}

function markPlayed() {
  introPlayedMemory = true;
  try {
    sessionStorage.setItem('introPlayed', '1');
  } catch {
    /* storage blocked — the in-memory flag above still gates this page-load */
  }
}

function prefersReduced() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export default function KnifeSplit({ onComplete }) {
  // Decide ONCE, on mount, whether the full intro plays. Same-session reloads and
  // reduced-motion both fall to the skip path (immediate, clean hand-off).
  const [play] = useState(() => !hasPlayed() && !prefersReduced());
  const doneRef = useRef(false);

  // Single guarded completion: marks the session flag and hands off exactly once.
  const finishRef = useRef(null);
  finishRef.current = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    markPlayed();
    if (onComplete) onComplete();
  };

  useEffect(() => {
    // Skip path: nothing to animate — hand straight off so the menu shows now.
    if (!play) {
      finishRef.current();
      return;
    }
    // The intro is starting: set the session flag immediately so a same-session
    // reload mid-intro won't replay the slow open.
    markPlayed();

    // The open fully completes at OPEN_TRAVEL; hand off then. (Belt-and-braces:
    // App also keeps a safety timer so the overlay can never get stuck.)
    const openTimer = setTimeout(() => finishRef.current(), OPEN_TRAVEL);

    // Tap/click/key anywhere skips instantly to the fully-revealed menu.
    const skip = () => finishRef.current();
    window.addEventListener('pointerdown', skip);
    window.addEventListener('keydown', skip);
    return () => {
      clearTimeout(openTimer);
      window.removeEventListener('pointerdown', skip);
      window.removeEventListener('keydown', skip);
    };
  }, [play]);

  if (!play) return null;

  // Single source of truth: the named consts above flow into the CSS as vars, so
  // the animations and the JS timers can never drift apart.
  const vars = {
    '--ks-angle': `${ANGLE}deg`,
    '--ks-open-travel': `${OPEN_TRAVEL}ms`,
    '--ks-open-offset': `${OPEN_OFFSET}ms`,
    '--ks-open-ease': OPEN_EASE,
    '--ks-panel-travel': PANEL_TRAVEL,
    '--ks-slash-draw': `${SLASH_DRAW}ms`,
    '--ks-slash-fade': `${SLASH_FADE}ms`,
    '--ks-slash-thick': `${SLASH_THICK}px`,
    '--ks-slash-color': SLASH_COLOR,
    '--ks-flash-dur': `${FLASH_DUR}ms`,
    '--ks-flash-peak': FLASH_PEAK,
    // Flash punches mid-streak (half-way through the draw), riding on OPEN_OFFSET.
    '--ks-flash-delay': `${OPEN_OFFSET + SLASH_DRAW / 2}ms`,
  };

  return (
    <div className="knife-split" style={vars} aria-hidden="true">
      <div className="knife-panel knife-panel-top" />
      <div className="knife-panel knife-panel-bottom" />
      <div className="knife-slash" />
      <div className="knife-flash" />
    </div>
  );
}
