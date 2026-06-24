// TransitionIntro.jsx
// The anime fight-card sequence played between the splash dismiss and the
// homepage reveal. Stripped back to near-empty: the two lines ARE the screen.
//   black beat -> "TYPE FAST." PUNCHES in (per-letter machine-gun snap + RGB
//   split) -> "DIE SLOW." DRAGS in slower/heavier (tired settle + paint drip) ->
//   both EXPLODE outward over a comic starburst -> onComplete fires, and App
//   plays its bar wipe to the homepage.
//
// The drama is contrast, not clutter: a calm flat-black field, then the two
// lines slam against it. There is deliberately NO background scene (no speed
// lines, vector accents, perspective grid, halftone or drifting particles) -
// nothing competes with the title. The impact effects (white flash, the shake
// of the card itself, the explosion shards) fire WITH each slam, then settle.
//
// The two phrases animate OPPOSITELY on purpose - they mean opposite things:
// TYPE FAST is fast/electric (tight stagger, chromatic aberration), DIE SLOW is
// slow/ominous (long stagger, sag, desaturated, drips). Once settled the title
// stays ALIVE (breathing scale, an occasional glitch twitch, a never-stopping
// drip, and a subtle lean toward the cursor) instead of going static.
//
// The component just sequences a `step` through the phases with setTimeout and
// renders different content per step; the punch/drag/explode/idle motion is all
// CSS. Each landing fires a one-frame white flash + a brief shake of the whole
// card to sell the impact.
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

// Whether the viewer asked for reduced motion. Read once - the card lives ~2.5s,
// so it doesn't need to react to a mid-card preference change.
const PREFERS_REDUCED =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Split a phrase into per-letter spans so each letter can stagger in on its own
// delay (`--i`). Spaces are rendered as a non-breaking space and flagged so they
// never sprout a paint drip.
function IntroLetters({ text }) {
  return text.split('').map((ch, i) => {
    const space = ch === ' ';
    return (
      <span
        key={i}
        className={`intro-letter${space ? ' is-space' : ''}`}
        style={{ '--i': i }}
      >
        {space ? ' ' : ch}
      </span>
    );
  });
}

// A flat comic-book impact starburst that sits BEHIND a word and pops in with it
// on the slam (then idles), for the graphic-poster look. Flat fill + thick black
// outline; rendered behind the letters (z -1) so the word stays readable on top.
function WordBurst({ color }) {
  return (
    <span className="intro-word-burst" aria-hidden="true">
      <svg viewBox="-112 -112 224 224">
        <polygon points={BURST_POINTS} fill={color} stroke="#000" strokeWidth="7" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

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
  // Which kind of hit is landing - 'fast' (sharp/electric) or 'slow' (heavy/
  // ominous) - so the impact flash + shake can differ per phrase.
  const [impactKind, setImpactKind] = useState('fast');
  const shakeTimerRef = useRef(null);
  const completedRef = useRef(false);
  // The element that leans toward the cursor (separate from the shake/breathe
  // layers so the transforms never fight).
  const tiltRef = useRef(null);
  const { sound } = useSound();

  // A word just SLAMMED home: fire the hard impact frame (full-screen invert
  // flash + silhouette + freeze, all CSS, re-keyed so it replays) and a shake.
  // `kind` swaps the flash/shake feel (fast = sharp, slow = heavy). The second
  // word of each line lands as a lighter, silent one-two (opts.silent), so the
  // SFX still fires only on the two primary slams.
  function impact(kind, opts = {}) {
    if (!opts.silent) sound.punch();
    setImpactKind(kind);
    setFlashKey((k) => k + 1);
    setShaking(true);
    if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
    shakeTimerRef.current = setTimeout(
      () => setShaking(false),
      kind === 'slow' ? 280 : 180
    );
  }

  // The whole timeline, scheduled once on mount (times are intro-local; the
  // splash already spent its own ~300ms dismissing before we mounted).
  useEffect(() => {
    const timers = [];
    // Two big hits with a real BEAT between them: "TYPE FAST." punches in and
    // lands, holds for a moment, then "DIE SLOW." slams in as its own hit.
    // 0-140ms: short black hold (anticipation).
    timers.push(setTimeout(() => setStep('line1'), 140));
    // TYPE then FAST each get their own sharp impact beat as the line fills in.
    timers.push(setTimeout(() => impact('fast'), 300)); // TYPE
    timers.push(setTimeout(() => impact('fast', { silent: true }), 450)); // FAST
    // ~780ms: after a held pause, "DIE SLOW." slams in as its own heavier hit.
    timers.push(setTimeout(() => setStep('line2'), 780));
    timers.push(setTimeout(() => impact('slow'), 940)); // DIE
    timers.push(setTimeout(() => impact('slow', { silent: true }), 1120)); // SLOW
    // 2120ms: both lines explode outward over the starburst, with a whoosh.
    timers.push(
      setTimeout(() => {
        setStep('explode');
        sound.whoosh();
      }, 2120)
    );
    // 2000ms: hand back to App for the homepage wipe.
    timers.push(
      setTimeout(() => {
        if (completedRef.current) return;
        completedRef.current = true;
        onComplete();
      }, 2500)
    );
    return () => {
      timers.forEach(clearTimeout);
      if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
    };
    // onComplete is stable from App; run this exactly once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cursor-reactive lean: the title tips a few degrees toward the pointer (eased
  // in CSS), so it reads as 3D against the calm black field. Subtle, and disabled
  // entirely under reduced motion. Writes CSS vars on the tilt layer via a ref so
  // it never triggers a React re-render.
  useEffect(() => {
    if (PREFERS_REDUCED) return undefined;
    const el = tiltRef.current;
    if (!el) return undefined;
    let raf = 0;
    const onMove = (e) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        const dx = cx ? (e.clientX - cx) / cx : 0; // -1..1
        const dy = cy ? (e.clientY - cy) / cy : 0;
        el.style.setProperty('--ry', `${(dx * 6).toFixed(2)}deg`);
        el.style.setProperty('--rx', `${(-dy * 6).toFixed(2)}deg`);
        el.style.setProperty('--tx', `${(dx * 8).toFixed(1)}px`);
        el.style.setProperty('--ty', `${(dy * 8).toFixed(1)}px`);
      });
    };
    window.addEventListener('pointermove', onMove);
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const exploding = step === 'explode';
  // Both line elements stay mounted once revealed (so a punch never replays and
  // the layout never reflows); their `active` class drives the entrance, and the
  // explode class overrides it at the end.
  const line1Active = step === 'line1' || step === 'line2' || exploding;
  const line2Active = step === 'line2' || exploding;

  return (
    <div className="intro-overlay" aria-hidden="true">
      {/* No background scene - the calm black field is the whole point. The two
          lines slam against it; the only other motion is the impact flash, the
          card shake and the final explosion. */}
      <div className={`intro-stage${shaking ? ` shaking shaking--${impactKind}` : ''}`}>
        {/* The two lines blow apart (transform-only) as the intro ends; the
            screen-slicing KNIFE-SPLIT reveal to the menu is owned by App (it needs
            the menu mounted behind it, which the intro overlay isn't). The old
            explosion (shockwave rings + counter-rotating starbursts + 14 shards)
            was removed - the slice is far cheaper. */}
        {/* Tilt layer (cursor lean) wraps the breathe layer (idle breathing scale)
            wraps the two slots - each transform on its own element so they compose
            instead of clobbering each other or the stage's impact shake. */}
        <div className="intro-tilt" ref={tiltRef}>
          <div className="intro-breathe">
            {/* Each line sits in a slot that holds its resting offset + tilt, so
                the two titles land staggered and crooked. The slot transform is
                separate from the entrance/explode animations (which run on the
                inner .intro-line), so a landing never snaps the resting position. */}
            <div className="intro-line-slot intro-slot-type">
              <div
                className={`intro-line intro-line-type${line1Active ? ' active' : ''}${
                  exploding ? ' intro-explode-up' : ''
                }`}
              >
                <WordBurst color="#FFE94A" />
                <IntroLetters text="TYPE FAST." />
              </div>
            </div>
            <div className="intro-line-slot intro-slot-die">
              <div
                className={`intro-line intro-line-die${line2Active ? ' active' : ''}${
                  exploding ? ' intro-explode-down' : ''
                }`}
              >
                <WordBurst color="#9A1AFF" />
                <IntroLetters text="DIE SLOW." />
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Hard impact frame, re-keyed per word-landing so it replays. The variant
          class swaps the feel: sharp invert for FAST, heavier double-beat +
          chromatic for SLOW. (Reduced motion hides it entirely.) */}
      {flashKey > 0 && (
        <div key={flashKey} className={`intro-flash intro-flash--${impactKind}`} />
      )}
    </div>
  );
}
