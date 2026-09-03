// SplashScreen.jsx
// The attract / title screen - the very first thing seen. Full-screen, sits over
// the persistent WallScene + particles. Clicking anywhere (or any key) starts
// the experience: it unlocks audio (within the user gesture), plays a quick
// scale-up + white-flash exit, then App wipes to the homepage and fades music in.
import { useEffect, useRef, useState } from 'react';
import './SplashScreen.css';
import { useXpCapture } from '../progress/useXpCapture';
import { loadProgress } from '../progress/xp';
import { splashDismissed as evSplashDismissed } from '../lib/events.js';
import { MenuXpBar, MenuXpFx } from './MenuXp';
import Mascot from './Mascot';

const TAGLINES = [
  // "TYPE FAST. DIE SLOW." intentionally lives in the post-dismiss intro card,
  // not here, so it isn't shown twice.
  'WORDS ARE WEAPONS.',
  'YOUR VOCABULARY VS EVERYONE.',
  'NO SPELL CHECK. NO MERCY.',
  'THINK FAST OR BLOW UP.',
  'INSERT BRAIN TO CONTINUE.',
  'SPELL OR PERISH.',
  'BIG WORDS. BIGGER EGO.',
  'THE BOMB IS HUNGRY.',
  'LAST ONE TYPING WINS.',
  'YOUR THUMBS VS THE CLOCK.',
  'PANIC IS PART OF THE GAME.',
  'KNOW WORDS OR GO HOME.',
  'NO GOOGLE ALLOWED.',
  'CHOKE AND EVERYONE SEES.',
  'AUTOCORRECT CANT SAVE YOU.',
  'PRESSURE MAKES TYPOS.',
  'OUTSPELL OR GET OUTLASTED.',
  'EVERY SECOND COUNTS.',
  'THE CLOCK IS NOT YOUR FRIEND.',
  'VOCABULARY IS A CONTACT SPORT.',
  'WIN OR GET CLIPPED.',
  'BRAINS BEAT BUTTONS.',
  'FAST FINGERS ONLY.',
  'TYPE NOW. CRY LATER.',
  'SQUAD UP AND SPELL UP.',
  'PROVE YOU CAN READ.',
];

// A big jagged comic starburst (more points + larger than the homepage one).
const BURST_POINTS = Array.from({ length: 32 }, (_, i) => {
  const r = i % 2 === 0 ? 100 : 60;
  const a = (Math.PI * i) / 16 - Math.PI / 2;
  return `${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`;
}).join(' ');

// ---- Ambient embers/debris drifting slowly UP the screen ----
// Three kinds of mote: tiny round 'spark's, small square paint 'fleck's, and a
// few small letter 'tile's. STATIC module config (no per-render randomness, like
// ParticleField/WallScene) so re-renders never reshuffle the layout. Each carries
// its column (left %), size, rise duration/delay, palette colour, a horizontal
// drift and a final rotation - the CSS turns those into a slow, floaty climb.
// Modest count (15) and low opacity so the air feels alive without going noisy.
const EMBERS = [
  { type: 'spark', left: 8,  size: 4,  dur: 19, delay: 0,   color: '#FFE94A', op: 0.5,  drift: 14,  rot: 0 },
  { type: 'fleck', left: 16, size: 7,  dur: 24, delay: 6,   color: '#ff4fa3', op: 0.32, drift: -18, rot: 140 },
  { type: 'spark', left: 23, size: 3,  dur: 17, delay: 3,   color: '#FF6B3D', op: 0.5,  drift: 10,  rot: 0 },
  { type: 'tile',  left: 30, size: 20, dur: 30, delay: 10,  color: '#2EFFE0', op: 0.16, drift: 16,  rot: -22, letter: 'T' },
  { type: 'spark', left: 38, size: 5,  dur: 15, delay: 8,   color: '#2EFFE0', op: 0.45, drift: -12, rot: 0 },
  { type: 'fleck', left: 45, size: 6,  dur: 26, delay: 2,   color: '#FFE94A', op: 0.3,  drift: 20,  rot: -120 },
  { type: 'spark', left: 52, size: 3,  dur: 21, delay: 13,  color: '#ff4fa3', op: 0.5,  drift: -9,  rot: 0 },
  { type: 'tile',  left: 59, size: 18, dur: 33, delay: 4,   color: '#FF6B3D', op: 0.15, drift: -16, rot: 18, letter: 'W' },
  { type: 'spark', left: 66, size: 4,  dur: 16, delay: 11,  color: '#FFE94A', op: 0.5,  drift: 12,  rot: 0 },
  { type: 'fleck', left: 73, size: 8,  dur: 23, delay: 7,   color: '#9A1AFF', op: 0.32, drift: 17,  rot: 160 },
  { type: 'spark', left: 80, size: 3,  dur: 18, delay: 1,   color: '#FF6B3D', op: 0.45, drift: -11, rot: 0 },
  { type: 'tile',  left: 86, size: 19, dur: 31, delay: 15,  color: '#FFE94A', op: 0.16, drift: 14,  rot: -14, letter: '!' },
  { type: 'spark', left: 91, size: 5,  dur: 14, delay: 5,   color: '#2EFFE0', op: 0.5,  drift: -13, rot: 0 },
  { type: 'fleck', left: 96, size: 6,  dur: 27, delay: 9,   color: '#ff4fa3', op: 0.3,  drift: -15, rot: -150 },
  { type: 'spark', left: 48, size: 3,  dur: 22, delay: 17,  color: '#FFE94A', op: 0.45, drift: 10,  rot: 0 },
];

// Sparks crackling off the bomb's fuse tip (top-right of the mascot PNG). Fixed
// offsets so they don't jitter each render; each flickers in, drifts up-and-out
// (dx/dy in px) and fades, on its own short loop - a lit-fuse "crackle". Overlay
// EFFECT particles only (not character art): the bomb itself stays the PNG.
/**
 * @param {object} props
 * @param {() => void} props.onStart - called synchronously on the first
 *   interaction (the user gesture) so audio can unlock.
 * @param {() => void} props.onDismiss - called after the ~300ms exit animation,
 *   so App can hide the splash and wipe to the homepage.
 */
export default function SplashScreen({ onStart, onDismiss }) {
  const [tagIndex, setTagIndex] = useState(0);
  const [leaving, setLeaving] = useState(false);
  // Fine pointer (mouse/trackpad + keyboard) → "TYPE TO START"; coarse (touch) → "TAP".
  const [fine] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(pointer: fine)').matches);
  // A returning visitor (any progress already banked) already knows the game — they enter
  // faster. Economy v5 stores {level, intoLevel}, so "any progress" is past LV1 or mid-level.
  const [returning] = useState(() => {
    const p = loadProgress();
    return p.level > 1 || p.intoLevel > 0;
  });
  // Entry gate: on a FINE pointer, require this many credited KEYSTROKES before dismissing
  // (5 first-time, 3 for a returning visitor). A COARSE tap always enters on ONE (5 taps to
  // enter is hostile on mobile), and a click anywhere is the immediate escape hatch below.
  const needed = fine ? (returning ? 3 : 5) : 1;
  const filledRef = useRef(0); // authoritative credited-keystroke count (never double-counts)
  const [filled, setFilled] = useState(0); // mirror for the pip render
  const dismissedRef = useRef(false);
  const startRef = useRef(onStart);
  const dismissRef = useRef(onDismiss);
  startRef.current = onStart;
  dismissRef.current = onDismiss;
  const fxRef = useRef(null);

  function dismiss() {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    evSplashDismissed(); // analytics: the entry gate cleared (start of the funnel)
    if (startRef.current) startRef.current(); // unlock audio (music) in the gesture
    setLeaving(true);
    setTimeout(() => {
      if (dismissRef.current) dismissRef.current();
    }, 300); // let the exit animation play first
  }

  // SHARED capture — the splash credits + pops exactly like the menu (no forked logic).
  // A creditable keydown is a user gesture, so playClack (inside the hook) creates/resumes
  // the AudioContext there. Every credit still credits XP + fires a pop + plays the clack;
  // we only DISMISS once the keystroke gate is met (which unlocks music via onStart). A
  // coarse tap dismisses on the first credit. Disabled once we start leaving.
  const { progress } = useXpCapture({
    fxRef,
    active: !leaving,
    onCredit: () => {
      if (!fine) {
        dismiss(); // coarse tap → enter immediately
        return;
      }
      filledRef.current += 1;
      setFilled(filledRef.current);
      if (filledRef.current >= needed) dismiss(); // gate met on the Nth keystroke
    },
  });

  // Cycle the taglines every 2.5s.
  useEffect(() => {
    const id = setInterval(() => setTagIndex((i) => (i + 1) % TAGLINES.length), 2500);
    return () => clearInterval(id);
  }, []);

  // Click/tap dismisses (and unlocks audio) on EVERY device.
  useEffect(() => {
    const onClick = () => dismiss();
    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={`splash-screen${leaving ? ' leaving' : ''}`}
      aria-label={fine ? 'Type or click to start' : 'Tap to start'}
    >
      <svg className="splash-burst" viewBox="-108 -108 216 216" aria-hidden="true">
        <polygon points={BURST_POINTS} fill="#FFE94A" stroke="#000" strokeWidth="5" strokeLinejoin="round" />
      </svg>

      {/* Ambient embers/debris drifting slowly up the screen, behind the text
          (z below the wordmark) so the air feels alive without stealing focus. */}
      <div className="splash-embers" aria-hidden="true">
        {EMBERS.map((e, i) => (
          <span
            key={i}
            className={`splash-ember ${e.type}`}
            style={{
              left: `${e.left}%`,
              width: e.type === 'tile' ? undefined : `${e.size}px`,
              height: e.type === 'tile' ? undefined : `${e.size}px`,
              fontSize: e.type === 'tile' ? `${e.size}px` : undefined,
              background: e.color,
              '--e-op': e.op,
              '--e-dur': `${e.dur}s`,
              '--e-delay': `${e.delay}s`,
              '--e-drift': `${e.drift}px`,
              '--e-rot': `${e.rot}deg`,
            }}
          >
            {e.type === 'tile' ? e.letter : null}
          </span>
        ))}
      </div>

      {/* The wordmark. */}
      <div className="splash-logo-wrap">
        {/* "TYPE A WORD": the   (non-breaking space) binds "TYPE A" so the
            title only ever wraps before "WORD" on narrow screens. data-text must
            match the text exactly so the RGB-split clones stay aligned. */}
        <div
          className="splash-logo"
          data-text={'TYPE A WORD'}
          role="img"
          aria-label="Type a Word"
        >
          {'TYPE A WORD'}
        </div>
      </div>

      {/* The bomb mascot — the splash's hero image (fix/splash). Pose only (no looping emote)
          so it adds no idle animation; the enter pop is a one-shot. */}
      <Mascot pose="idle" size={160} className="splash-hero-mascot" />

      <div className="splash-taglines">
        {/* re-keyed per index so the fade replays on each swap */}
        <span key={tagIndex} className="splash-tagline">
          {TAGLINES[tagIndex]}
        </span>
      </div>

      <div className="splash-start">{fine ? 'TYPE TO START' : 'TAP TO START'}</div>

      {/* Keystroke-gate progress: one pip per required keystroke, filled left-to-right.
          Fine pointer only (a coarse tap enters on one). Instant class swap, no animation. */}
      {fine && (
        <div className="splash-pips" aria-hidden="true">
          {Array.from({ length: needed }, (_, i) => (
            <span key={i} className={`splash-pip${i < filled ? ' is-on' : ''}`} />
          ))}
        </div>
      )}

      {/* Mini XP readout under the prompt — hidden entirely for a first-time visitor
          (no progress yet). Same store + scaleX fill as the menu bar. */}
      {(progress.level > 1 || progress.intoLevel > 0) && (
        <div className="splash-xp">
          <MenuXpBar level={progress.level} toNext={progress.toNext} frac={progress.frac} variant="mini" />
        </div>
      )}

      <div className="splash-halftone" aria-hidden="true" />
      {/* Darkens the backdrop to black on dismiss, cutting into the intro. */}
      <div className="splash-flash" aria-hidden="true" />

      {/* Pops fire on the splash too (spawn-anywhere over this layer). */}
      <MenuXpFx ref={fxRef} />
    </div>
  );
}
