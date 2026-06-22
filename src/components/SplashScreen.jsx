// SplashScreen.jsx
// The attract / title screen - the very first thing seen. Full-screen, sits over
// the persistent WallScene + particles. Clicking anywhere (or any key) starts
// the experience: it unlocks audio (within the user gesture), plays a quick
// scale-up + white-flash exit, then App wipes to the homepage and fades music in.
import { useEffect, useRef, useState } from 'react';
import Mascot from './Mascot';
import './SplashScreen.css';

const TAGLINES = [
  'TYPE FAST. DIE SLOW.',
  'WORDS ARE WEAPONS.',
  'YOUR VOCABULARY VS EVERYONE.',
  'NO SPELL CHECK. NO MERCY.',
  'THINK FAST OR BLOW UP.',
  'INSERT BRAIN TO CONTINUE.',
];

// A big jagged comic starburst (more points + larger than the homepage one).
const BURST_POINTS = Array.from({ length: 32 }, (_, i) => {
  const r = i % 2 === 0 ? 100 : 60;
  const a = (Math.PI * i) / 16 - Math.PI / 2;
  return `${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`;
}).join(' ');

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

  // Click or any key dismisses. Defined once; reads callbacks via refs.
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
    const onKey = () => dismiss();
    const onClick = () => dismiss();
    window.addEventListener('keydown', onKey);
    window.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
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

      <div
        className="splash-logo"
        data-text="WORDARCADE"
        role="img"
        aria-label="WordArcade"
      >
        WORDARCADE
      </div>

      <div className="splash-taglines">
        {/* re-keyed per index so the fade replays on each swap */}
        <span key={tagIndex} className="splash-tagline">
          {TAGLINES[tagIndex]}
        </span>
      </div>

      {/* The mascot is the centrepiece - excited (celebrate) as you dismiss. */}
      <Mascot pose={leaving ? 'celebrate' : 'idle'} size={200} className="splash-mascot" />

      <div className="splash-start">CLICK ANYWHERE TO START</div>

      <div className="splash-halftone" aria-hidden="true" />
      {/* White flash that blows out the screen on dismiss. */}
      <div className="splash-flash" aria-hidden="true" />
    </div>
  );
}
