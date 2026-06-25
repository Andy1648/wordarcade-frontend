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
const SLASH_DELAY = 150; // ms — beat before the streak draws
const SLASH_DUR = 300; // ms — the streak draws across (quick flash, no hold)
const SLASH_FADE = 200; // ms — then fades out

// ===== OPEN — timing =====
const OPEN_DELAY = 60; // ms — tiny beat after the slash so the open reads as caused by it
const OPEN_DUR = 720; // ms — halves part perpendicular off-screen
const OPEN_EASE = 'cubic-bezier(.7,0,.2,1)';

// ===== Appearance =====
const COVER_COLOR = '#14161b'; // solid charcoal cover over the menu

// Whole gesture: slash (delay+draw) -> beat -> open (delay+dur).
const TOTAL = SLASH_DELAY + SLASH_DUR + OPEN_DELAY + OPEN_DUR; // ~1230ms

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
    '--ks-slash-dur': `${SLASH_DUR}ms`,
    '--ks-slash-fade': `${SLASH_FADE}ms`,
    '--ks-open-delay': `${OPEN_DELAY}ms`,
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
