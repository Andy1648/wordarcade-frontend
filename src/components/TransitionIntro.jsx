// TransitionIntro.jsx
// The anime fight-card sequence played between the splash dismiss and the
// homepage reveal. It's an aggressive ~2s title card:
//   black beat -> "TYPE FAST." PUNCHES in (scale overshoot) -> "DIE SLOW."
//   punches in ~180ms later as a second hit -> both EXPLODE outward over a comic
//   starburst -> onComplete fires, and App plays its bar wipe to the homepage.
// Each word rests at a different slant (hand-thrown), set on its slot wrapper.
//
// The component just sequences a `step` through the phases with setTimeout and
// renders different content per step; the punch/explode motion is all CSS. Each
// landing fires a one-frame white flash + a brief shake of the whole card to sell
// the impact.
import { useEffect, useRef, useState } from 'react';
import { useSound } from '../contexts/SoundContext';
import './TransitionIntro.css';

// Same jagged comic starburst construction used on the splash / homepage, so the
// explosion burst matches the rest of the app.
const BURST_POINTS = Array.from({ length: 32 }, (_, i) => {
  const r = i % 2 === 0 ? 100 : 60;
  const a = (Math.PI * i) / 16 - Math.PI / 2;
  return `${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`;
}).join(' ');

/**
 * @param {object} props
 * @param {() => void} props.onComplete - called once the explosion finishes, so
 *   App can run the bar wipe to the homepage and fade the music up.
 */
export default function TransitionIntro({ onComplete }) {
  // 'black' -> 'line1' -> 'line2' -> 'explode'
  const [step, setStep] = useState('black');
  // Bumped per impact so the white flash re-mounts and replays.
  const [flashKey, setFlashKey] = useState(0);
  // Toggled briefly on each landing to shake the whole card.
  const [shaking, setShaking] = useState(false);
  const shakeTimerRef = useRef(null);
  const completedRef = useRef(false);
  const { sound } = useSound();

  // A line just SLAMMED home: heavy punch + flash the screen white + shake.
  function impact() {
    sound.punch();
    setFlashKey((k) => k + 1);
    setShaking(true);
    if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
    shakeTimerRef.current = setTimeout(() => setShaking(false), 200);
  }

  // The whole timeline, scheduled once on mount (times are intro-local; the
  // splash already spent its own ~300ms dismissing before we mounted).
  useEffect(() => {
    const timers = [];
    // Two distinct hits, close together: "TYPE FAST." punches in, then
    // "DIE SLOW." ~180ms later as its own impact.
    // 0-140ms: short black hold (anticipation).
    timers.push(setTimeout(() => setStep('line1'), 140));
    // Flash + shake right as the punch snaps back home (~160ms into the hit).
    timers.push(setTimeout(impact, 300));
    // ~320ms: "DIE SLOW." punches in as a separate, second hit.
    timers.push(setTimeout(() => setStep('line2'), 320));
    timers.push(setTimeout(impact, 480));
    // 1620ms: both lines explode outward over the starburst, with a whoosh.
    timers.push(
      setTimeout(() => {
        setStep('explode');
        sound.whoosh();
      }, 1620)
    );
    // 2000ms: hand back to App for the homepage wipe.
    timers.push(
      setTimeout(() => {
        if (completedRef.current) return;
        completedRef.current = true;
        onComplete();
      }, 2000)
    );
    return () => {
      timers.forEach(clearTimeout);
      if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
    };
    // onComplete is stable from App; run this exactly once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exploding = step === 'explode';
  // Both line elements stay mounted once revealed (so a punch never replays and
  // the layout never reflows); their `active` class drives the punch, and the
  // explode class overrides it at the end.
  const line1Active = step === 'line1' || step === 'line2' || exploding;
  const line2Active = step === 'line2' || exploding;

  return (
    <div className="intro-overlay" aria-hidden="true">
      <div className={`intro-stage${shaking ? ' shaking' : ''}`}>
        {exploding && (
          <svg className="intro-starburst" viewBox="-100 -100 200 200">
            <polygon points={BURST_POINTS} fill="#FFE94A" />
          </svg>
        )}
        {/* Each line sits in a slot that holds its resting offset + tilt, so the
            two titles land staggered and crooked. The slot transform is separate
            from the punch/explode animations (which run on the inner .intro-line),
            so a punch settling never snaps the resting position. */}
        <div className="intro-line-slot intro-slot-type">
          <div
            className={`intro-line intro-line-type${line1Active ? ' active' : ''}${
              exploding ? ' intro-explode-up' : ''
            }`}
          >
            TYPE FAST.
          </div>
        </div>
        <div className="intro-line-slot intro-slot-die">
          <div
            className={`intro-line intro-line-die${line2Active ? ' active' : ''}${
              exploding ? ' intro-explode-down' : ''
            }`}
          >
            DIE SLOW.
          </div>
        </div>
      </div>
      {/* One-frame white impact flash, re-keyed per landing so it replays. */}
      {flashKey > 0 && <div key={flashKey} className="intro-flash" />}
    </div>
  );
}
