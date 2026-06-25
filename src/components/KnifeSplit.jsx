// KnifeSplit.jsx
// The intro -> menu reveal. A charcoal cover sits over the menu; a bright slash
// streaks across the cut line; then the cover splits ALONG THAT SAME LINE and the
// two halves part perpendicular (top up, bottom down) to reveal the menu.
//
// ALIGNMENT (the bug we keep hitting): the slash and the split seam MUST derive
// from ONE shared angle so they are guaranteed collinear — never computed apart.
//   - The seam is two full-viewport cover copies clipped to opposite sides of the
//     same diagonal edge. That edge is defined by --ks-d, the vertical offset of
//     the line at the screen edges: d = (viewportWidth / 2) * tan(cut-angle).
//   - The slash is the same line, just rotated by the SAME --ks-cut-angle.
//   Same angle in, same line out → the seam sits exactly where the slash was.
//   (--ks-d is precomputed in JS here rather than via CSS tan() in calc(), for
//   browser safety.)
//
// ORDER: slash draws (quick flash, no hold) -> tiny beat -> cover opens. The open
// delay = slash-delay + slash-dur + open-delay, so the split reads as caused by
// the slash. Slash and open timing are SEPARATE named vars (slash independently
// editable). Total ~1.13s.
//
// GATING: plays once per browser session (sessionStorage); same-session reloads
// skip to the menu. Tap/click/key skips instantly. prefers-reduced-motion skips
// entirely. Every path hands off cleanly via onComplete — never a stuck overlay.
//
// Cosmetic + pointer-events:none. Transform/opacity/clip only.
import { useEffect, useRef, useState } from 'react';
import './KnifeSplit.css';

// ===== Shared geometry =====
const CUT_ANGLE = 4; // deg — drives BOTH the slash rotation AND the seam clip

// ===== SLASH — timing (independent of the open) =====
// This mounts right as the title lands; SLASH_DELAY is the tight gap after that.
const SLASH_DELAY = 180; // ms — title-land → slash start (tight)
const SLASH_DRAW = 260; // ms — the streak draws across
const SLASH_HOLD = 260; // ms — HOLDS bright so it's actually seen (the fix)
const SLASH_FADE = 220; // ms — then fades, as the open begins

// ===== OPEN — timing =====
const OPEN_GAP = 100; // ms — slash → open
const OPEN_DUR = 1100; // ms — halves drift apart perpendicular, off-screen (slow)
const OPEN_EASE = 'cubic-bezier(.4,0,.2,1)'; // smooth deceleration into place

// ===== Appearance =====
const COVER_COLOR = '#14161b'; // solid charcoal cover over the menu

// The open begins after the slash has drawn AND held (so the cut is registered),
// plus the small open-gap. The slash then fades AS the open starts.
const OPEN_START = SLASH_DELAY + SLASH_DRAW + SLASH_HOLD + OPEN_GAP; // 800ms
// Whole gesture, slash start through open end (~1.71s) + the lead-in gap.
const TOTAL = OPEN_START + OPEN_DUR; // ~1900ms

// Per-page-load fallback when sessionStorage is unavailable (private mode etc.).
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
    if (!play) {
      finishRef.current();
      return;
    }
    markPlayed(); // set as the intro STARTS, so a mid-intro reload won't replay it

    const timer = setTimeout(() => finishRef.current(), TOTAL);

    // Tap/click/key anywhere skips instantly to the fully-revealed menu.
    const skip = () => finishRef.current();
    window.addEventListener('pointerdown', skip);
    window.addEventListener('keydown', skip);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointerdown', skip);
      window.removeEventListener('keydown', skip);
    };
  }, [play]);

  if (!play) return null;

  // d = vertical offset of the cut line at the screen edges (half-width away from
  // centre). Shared by the slash rotation (implicitly, via --ks-cut-angle) and the
  // seam clip, so both are the SAME line. Computed in px from the live viewport.
  const d =
    typeof window !== 'undefined'
      ? (window.innerWidth / 2) * Math.tan((CUT_ANGLE * Math.PI) / 180)
      : 0;

  const vars = {
    '--ks-cut-angle': `${CUT_ANGLE}deg`,
    '--ks-d': `${d}px`,
    '--ks-slash-delay': `${SLASH_DELAY}ms`,
    '--ks-slash-draw': `${SLASH_DRAW}ms`,
    '--ks-slash-hold': `${SLASH_HOLD}ms`,
    '--ks-slash-fade': `${SLASH_FADE}ms`,
    '--ks-open-gap': `${OPEN_GAP}ms`,
    '--ks-open-start': `${OPEN_START}ms`,
    '--ks-open-dur': `${OPEN_DUR}ms`,
    '--ks-open-ease': OPEN_EASE,
    '--ks-cover': COVER_COLOR,
  };

  return (
    <div className="knife-split" style={vars} aria-hidden="true">
      {/* Two cover copies clipped to opposite sides of the shared diagonal seam. */}
      <div className="knife-cover knife-cover-top" />
      <div className="knife-cover knife-cover-bottom" />
      {/* The slash, rotated by the SAME angle, sits on top and draws first. */}
      <div className="knife-slash">
        <div className="knife-streak" />
        <div className="knife-head" />
      </div>
    </div>
  );
}
