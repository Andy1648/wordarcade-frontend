// KnifeSplit.jsx
// The intro -> menu reveal. A charcoal cover sits over the menu; a bright slash
// streaks across the cut line, HOLDS so it's clearly seen, then the cover splits
// ALONG THAT SAME LINE and the two halves part perpendicular (top up, bottom
// down) to reveal the menu.
//
// SEQUENCING (the bug we keep hitting): the phases are a STRICT JS CHAIN, each
// triggered off the PREVIOUS phase finishing — never independent CSS
// animation-delays keyed off mount (those drift/desync and let the open fire at
// or before the slash). The chain adds three LATCHING classes in order:
//     mount --(slash-gap)--> is-slash  (streak draws, then holds bright)
//       --(draw+hold done)--> is-fade  (the blade starts fading)
//       --(open-gap)-------->  is-open  (the halves part along the cut)
// Each class's CSS animation starts the instant the class is added (no
// animation-delay), so the open is causally AFTER the slash by construction.
//
// ALIGNMENT: the slash and the split seam derive from ONE shared angle so they
// are guaranteed collinear.
//   - The seam is two full-viewport cover copies clipped to opposite sides of the
//     same diagonal edge, offset by --ks-d = (viewportWidth / 2) * tan(cut-angle).
//   - The slash is the same line, rotated by the NEGATIVE of that angle (the spec
//     seam rises to the right). Same angle in -> same line out.
//   (--ks-d is precomputed in JS, not via CSS tan() in calc(), for browser safety.)
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

// ===== Timing — FLAT ms, all measured as gaps between phases (no nested calc).
// The chain below schedules each phase off the previous one's completion, so
// these are the GAPS/durations of a sequence, not absolute offsets from mount.
const SLASH_DELAY = 180; // mount → slash starts
const SLASH_DRAW = 260; // streak draws across
const SLASH_HOLD = 340; // holds bright so it's actually seen
const SLASH_FADE = 240; // blade fade (begins at draw+hold end, runs through the open)
const OPEN_GAP = 140; // slash draw+hold done → open starts (open begins during the fade)
const OPEN_DUR = 1100; // halves drift apart, perpendicular, off-screen
const OPEN_EASE = 'cubic-bezier(.4,0,.2,1)';

// ===== Appearance =====
const COVER_COLOR = '#14161b'; // solid charcoal cover over the menu

// Whole gesture, mount through open end — used only as a safety backstop so the
// overlay can never get stuck if an animationend/timer is somehow dropped.
const TOTAL = SLASH_DELAY + SLASH_DRAW + SLASH_HOLD + OPEN_GAP + OPEN_DUR; // ~2020ms

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

  // The three latching phase flags, advanced strictly in order by the chain below.
  // They only ever go false->true, so once the streak has drawn it STAYS drawn
  // (its forwards fill) through the fade and the open.
  const [slashOn, setSlashOn] = useState(false);
  const [fadeOn, setFadeOn] = useState(false);
  const [openOn, setOpenOn] = useState(false);

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
      return undefined;
    }
    markPlayed(); // set as the intro STARTS, so a mid-intro reload won't replay it

    // STRICT SEQUENTIAL CHAIN — each phase is scheduled INSIDE the previous
    // phase's completion callback, so the open can never run on its own clock.
    const timers = [];
    const push = (fn, ms) => {
      const id = setTimeout(fn, ms);
      timers.push(id);
      return id;
    };

    // 1. slash-gap → draw the slash.
    push(() => {
      setSlashOn(true);
      // 2. draw + hold complete → start the blade fade...
      push(() => {
        setFadeOn(true);
        // 3. ...then, one open-gap later, part the halves (open begins mid-fade).
        push(() => {
          setOpenOn(true);
          // 4. open done → hand off.
          push(() => finishRef.current(), OPEN_DUR);
        }, OPEN_GAP);
      }, SLASH_DRAW + SLASH_HOLD);
    }, SLASH_DELAY);

    // Safety backstop: if any step's timer is ever dropped, still hand off so the
    // overlay can't stick. Sits just past the real end of the chain.
    const safety = setTimeout(() => finishRef.current(), TOTAL + 400);
    timers.push(safety);

    // Tap/click/key anywhere skips instantly to the fully-revealed menu.
    const skip = () => finishRef.current();
    window.addEventListener('pointerdown', skip);
    window.addEventListener('keydown', skip);
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener('pointerdown', skip);
      window.removeEventListener('keydown', skip);
    };
  }, [play]);

  if (!play) return null;

  // d = vertical offset of the cut line at the screen edges (half-width away from
  // centre). The seam clip uses ±d; the slash uses rotate(-angle). BOTH derive
  // from the single CUT_ANGLE, so they are guaranteed collinear. Computed in px
  // from the live viewport (no CSS tan(), no nested calc).
  const d =
    typeof window !== 'undefined'
      ? (window.innerWidth / 2) * Math.tan((CUT_ANGLE * Math.PI) / 180)
      : 0;

  const vars = {
    '--ks-slash-rot': `${-CUT_ANGLE}deg`,
    '--ks-d': `${d}px`,
    '--ks-slash-draw': `${SLASH_DRAW}ms`,
    '--ks-slash-fade': `${SLASH_FADE}ms`,
    '--ks-open-dur': `${OPEN_DUR}ms`,
    '--ks-open-ease': OPEN_EASE,
    '--ks-cover': COVER_COLOR,
  };

  const cls =
    'knife-split' +
    (slashOn ? ' is-slash' : '') +
    (fadeOn ? ' is-fade' : '') +
    (openOn ? ' is-open' : '');

  return (
    <div className={cls} style={vars} aria-hidden="true">
      {/* Two cover copies clipped to opposite sides of the shared diagonal seam. */}
      <div className="knife-cover knife-cover-top" />
      <div className="knife-cover knife-cover-bottom" />
      {/* The slash, rotated by the SAME angle, sits ABOVE the covers and draws first. */}
      <div className="knife-slash">
        <div className="knife-streak" />
        <div className="knife-head" />
      </div>
    </div>
  );
}
