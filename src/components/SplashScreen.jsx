// SplashScreen.jsx
// The attract / title screen - the very first thing seen. Full-screen, sits over
// the persistent WallScene + particles. Clicking anywhere (or any key) starts
// the experience: it unlocks audio (within the user gesture), plays a quick
// scale-up + white-flash exit, then App wipes to the homepage and fades music in.
import { useEffect, useRef, useState } from 'react';
import Mascot from './Mascot';
import './SplashScreen.css';

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
  { type: 'fleck', left: 16, size: 7,  dur: 24, delay: 6,   color: '#FF2EC4', op: 0.32, drift: -18, rot: 140 },
  { type: 'spark', left: 23, size: 3,  dur: 17, delay: 3,   color: '#FF6B3D', op: 0.5,  drift: 10,  rot: 0 },
  { type: 'tile',  left: 30, size: 20, dur: 30, delay: 10,  color: '#2EFFE0', op: 0.16, drift: 16,  rot: -22, letter: 'T' },
  { type: 'spark', left: 38, size: 5,  dur: 15, delay: 8,   color: '#2EFFE0', op: 0.45, drift: -12, rot: 0 },
  { type: 'fleck', left: 45, size: 6,  dur: 26, delay: 2,   color: '#FFE94A', op: 0.3,  drift: 20,  rot: -120 },
  { type: 'spark', left: 52, size: 3,  dur: 21, delay: 13,  color: '#FF2EC4', op: 0.5,  drift: -9,  rot: 0 },
  { type: 'tile',  left: 59, size: 18, dur: 33, delay: 4,   color: '#FF6B3D', op: 0.15, drift: -16, rot: 18, letter: 'W' },
  { type: 'spark', left: 66, size: 4,  dur: 16, delay: 11,  color: '#FFE94A', op: 0.5,  drift: 12,  rot: 0 },
  { type: 'fleck', left: 73, size: 8,  dur: 23, delay: 7,   color: '#9A1AFF', op: 0.32, drift: 17,  rot: 160 },
  { type: 'spark', left: 80, size: 3,  dur: 18, delay: 1,   color: '#FF6B3D', op: 0.45, drift: -11, rot: 0 },
  { type: 'tile',  left: 86, size: 19, dur: 31, delay: 15,  color: '#FFE94A', op: 0.16, drift: 14,  rot: -14, letter: '!' },
  { type: 'spark', left: 91, size: 5,  dur: 14, delay: 5,   color: '#2EFFE0', op: 0.5,  drift: -13, rot: 0 },
  { type: 'fleck', left: 96, size: 6,  dur: 27, delay: 9,   color: '#FF2EC4', op: 0.3,  drift: -15, rot: -150 },
  { type: 'spark', left: 48, size: 3,  dur: 22, delay: 17,  color: '#FFE94A', op: 0.45, drift: 10,  rot: 0 },
];

// Sparks crackling off the bomb's fuse tip (top-right of the mascot PNG). Fixed
// offsets so they don't jitter each render; each flickers in, drifts up-and-out
// (dx/dy in px) and fades, on its own short loop - a lit-fuse "crackle". Overlay
// EFFECT particles only (not character art): the bomb itself stays the PNG.
const FUSE_SPARKS = [
  { dx: 1,  dy: -12, r: 2.5, color: '#FFE94A', delay: 0,    dur: 0.7 },
  { dx: -6, dy: -9,  r: 2,   color: '#FF6B3D', delay: 0.18, dur: 0.6 },
  { dx: 7,  dy: -10, r: 2.5, color: '#FFE94A', delay: 0.32, dur: 0.65 },
  { dx: -3, dy: -16, r: 2,   color: '#FF5C5C', delay: 0.5,  dur: 0.7 },
  { dx: 5,  dy: -15, r: 2,   color: '#FF6B3D', delay: 0.24, dur: 0.55 },
  { dx: 0,  dy: -7,  r: 3,   color: '#FFE94A', delay: 0.42, dur: 0.5 },
];

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
  const dismissedRef = useRef(false);
  // Keep the latest callbacks reachable from the once-bound key listener.
  const startRef = useRef(onStart);
  const dismissRef = useRef(onDismiss);
  startRef.current = onStart;
  dismissRef.current = onDismiss;

  // Cycle the taglines every 2.5s.
  useEffect(() => {
    const id = setInterval(
      () => setTagIndex((i) => (i + 1) % TAGLINES.length),
      2500
    );
    return () => clearInterval(id);
  }, []);

  // Only a click/tap dismisses (and unlocks audio) - NOT keyboard, so music
  // never starts from a stray key press. Defined once; reads callbacks via refs.
  useEffect(() => {
    function dismiss() {
      if (dismissedRef.current) return;
      dismissedRef.current = true;
      if (startRef.current) startRef.current(); // unlock audio in the gesture
      setLeaving(true);
      setTimeout(() => {
        if (dismissRef.current) dismissRef.current();
      }, 300); // let the exit animation play first
    }
    const onClick = () => dismiss();
    window.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('click', onClick);
    };
  }, []);

  return (
    <div
      className={`splash-screen${leaving ? ' leaving' : ''}`}
      role="button"
      tabIndex={0}
      aria-label="Click anywhere to start"
    >
      <svg className="splash-burst" viewBox="-100 -100 200 200" aria-hidden="true">
        <polygon points={BURST_POINTS} fill="#FFE94A" />
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

      {/* The mascot is the HERO image - the splash screen's visual centrepiece,
          large and centred just below the title. The stage wrapper carries a slow
          "cocky" idle sway (so the bomb reads as alive/confident, not static) and
          anchors the fuse sparks crackling off its tip. */}
      <div className="splash-mascot-stage">
        <Mascot pose="idle" size={180} className="splash-hero-mascot" />
        <div className="splash-fuse" aria-hidden="true">
          {FUSE_SPARKS.map((s, i) => (
            <span
              key={i}
              className="splash-spark"
              style={{
                width: `${s.r * 2}px`,
                height: `${s.r * 2}px`,
                background: s.color,
                '--s-dx': `${s.dx}px`,
                '--s-dy': `${s.dy}px`,
                '--s-delay': `${s.delay}s`,
                '--s-dur': `${s.dur}s`,
              }}
            />
          ))}
        </div>
      </div>

      <div className="splash-taglines">
        {/* re-keyed per index so the fade replays on each swap */}
        <span key={tagIndex} className="splash-tagline">
          {TAGLINES[tagIndex]}
        </span>
      </div>

      <div className="splash-start">CLICK ANYWHERE TO START</div>

      <div className="splash-halftone" aria-hidden="true" />
      {/* Darkens the backdrop to black on dismiss, cutting into the intro. */}
      <div className="splash-flash" aria-hidden="true" />
    </div>
  );
}
