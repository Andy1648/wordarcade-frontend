// TransitionIntro.jsx
// The anime fight-card sequence played between the splash dismiss and the
// homepage reveal. It's an aggressive ~2s title card:
//   black beat -> "TYPE FAST." PUNCHES in (per-letter machine-gun snap + RGB
//   split) -> "DIE SLOW." DRAGS in slower/heavier (tired settle + paint drip) ->
//   both EXPLODE outward over a comic starburst -> onComplete fires, and App
//   plays its bar wipe to the homepage.
//
// The two phrases animate OPPOSITELY on purpose - they mean opposite things:
// TYPE FAST is fast/electric (tight stagger, chromatic aberration, speed-lines),
// DIE SLOW is slow/ominous (long stagger, sag, desaturated, drips). Once settled
// the title stays ALIVE (breathing scale, an occasional glitch twitch, a never-
// stopping drip, and a subtle lean toward the cursor) instead of going static.
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

// ---- Background SCENE config (purely presentational, sits BEHIND the title) ----

// Diagonal action-comic speed lines streaking across behind the title. Static
// config (no per-render randomness) so the layout never reshuffles. Each streak
// has a row (top %), a length (w %), thickness, brand colour, base opacity, and
// TWO durations: a fast one used while "TYPE FAST." is on screen and a slow,
// heavier one once "DIE SLOW." lands (the phase class swaps which is active).
const STREAKS = [
  { top: 5,  w: 34, h: 4, c: '#2EFFE0', op: 0.5,  durF: 0.7, durS: 1.9, delay: 0.0 },
  { top: 12, w: 22, h: 3, c: '#FFE94A', op: 0.4,  durF: 0.9, durS: 2.3, delay: 0.5 },
  { top: 19, w: 44, h: 5, c: '#FF2EC4', op: 0.45, durF: 0.6, durS: 2.0, delay: 0.2 },
  { top: 27, w: 18, h: 3, c: '#FF6B3D', op: 0.4,  durF: 1.0, durS: 2.6, delay: 0.8 },
  { top: 34, w: 38, h: 4, c: '#FFE94A', op: 0.5,  durF: 0.8, durS: 2.1, delay: 0.35 },
  { top: 42, w: 26, h: 3, c: '#2EFFE0', op: 0.42, durF: 0.65,durS: 2.4, delay: 1.0 },
  { top: 56, w: 40, h: 5, c: '#FF2EC4', op: 0.45, durF: 0.75,durS: 2.0, delay: 0.15 },
  { top: 63, w: 20, h: 3, c: '#FFE94A', op: 0.4,  durF: 0.95,durS: 2.5, delay: 0.6 },
  { top: 71, w: 32, h: 4, c: '#FF6B3D', op: 0.5,  durF: 0.7, durS: 2.2, delay: 0.9 },
  { top: 79, w: 24, h: 3, c: '#2EFFE0', op: 0.42, durF: 0.85,durS: 2.3, delay: 0.4 },
  { top: 87, w: 42, h: 5, c: '#FF2EC4', op: 0.45, durF: 0.6, durS: 2.0, delay: 0.7 },
  { top: 93, w: 18, h: 3, c: '#FFE94A', op: 0.4,  durF: 1.0, durS: 2.6, delay: 0.25 },
];

// Hard-edged graffiti vector accents scattered in the NEGATIVE SPACE around the
// words (corners + far edges + top/bottom centre - never over the title). Each
// pops in (staggered by `delay`) then idles forever. `rot` is the resting tilt;
// `size` is the px width; `idleDur` desyncs the idle wobble.
const ACCENTS = [
  { shape: 'burst',    pos: { top: '11%', left: '7%' },     color: '#FFE94A', size: 78, rot: -12, delay: 0.15, idleDur: 5.5 },
  { shape: 'bolt',     pos: { top: '14%', right: '8%' },    color: '#2EFFE0', size: 66, rot: 12,  delay: 0.3,  idleDur: 4.6 },
  { shape: 'arrow',    pos: { top: '47%', left: '3%' },     color: '#FF6B3D', size: 96, rot: -6,  delay: 0.45, idleDur: 6.2 },
  { shape: 'arrow',    pos: { top: '44%', right: '3%' },    color: '#2EFFE0', size: 88, rot: 174, delay: 0.5,  idleDur: 5.8 },
  { shape: 'splatter', pos: { bottom: '12%', left: '9%' },  color: '#9A1AFF', size: 92, rot: 8,   delay: 0.35, idleDur: 6.6 },
  { shape: 'bolt',     pos: { bottom: '15%', right: '7%' }, color: '#FFE94A', size: 70, rot: -14, delay: 0.55, idleDur: 4.2 },
  { shape: 'tag',      pos: { top: '7%', left: '46%' },     color: '#FF2EC4', size: 64, rot: -5,  delay: 0.6,  idleDur: 5.0, label: '!!!' },
  { shape: 'burst',    pos: { bottom: '9%', left: '47%' },  color: '#FF6B3D', size: 54, rot: 16,  delay: 0.7,  idleDur: 5.3 },
];

// Inline SVG (or div, for the tag) for each accent shape. Flat fill + hard black
// outline; the hard offset shadow is applied in CSS (drop-shadow / box-shadow).
function AccentShape({ shape, color, label }) {
  if (shape === 'tag') {
    return (
      <div className="intro-accent-inner intro-accent-tag" style={{ background: color }}>
        {label}
      </div>
    );
  }
  const props = { className: 'intro-accent-inner intro-accent-svg' };
  if (shape === 'burst') {
    return (
      <svg {...props} viewBox="-112 -112 224 224">
        <polygon points={BURST_POINTS} fill={color} stroke="#000" strokeWidth="10" strokeLinejoin="round" />
      </svg>
    );
  }
  if (shape === 'bolt') {
    return (
      <svg {...props} viewBox="0 0 64 64">
        <polygon points="34,2 8,38 26,38 18,62 56,26 36,26 46,2" fill={color} stroke="#000" strokeWidth="5" strokeLinejoin="round" />
      </svg>
    );
  }
  if (shape === 'arrow') {
    return (
      <svg {...props} viewBox="0 0 100 60">
        <polygon points="4,18 58,18 58,4 96,30 58,56 58,42 4,42" fill={color} stroke="#000" strokeWidth="6" strokeLinejoin="round" />
      </svg>
    );
  }
  if (shape === 'splatter') {
    return (
      <svg {...props} viewBox="-60 -60 120 120">
        <polygon
          points="0,-46 12,-20 40,-30 22,-6 50,8 20,12 30,40 6,20 -8,48 -16,18 -44,28 -20,4 -50,-10 -18,-12 -34,-38 -8,-20"
          fill={color}
          stroke="#000"
          strokeWidth="6"
          strokeLinejoin="round"
        />
        <circle cx="46" cy="-44" r="6" fill={color} stroke="#000" strokeWidth="4" />
        <circle cx="-50" cy="40" r="5" fill={color} stroke="#000" strokeWidth="4" />
        <circle cx="52" cy="42" r="4" fill={color} stroke="#000" strokeWidth="3" />
      </svg>
    );
  }
  return null;
}

// Radial shrapnel for the explosion: flat graffiti shards flung out from centre
// on evenly-spaced angles (with a tiny per-shard skew + varied distance/size so
// it doesn't look mechanical). Deterministic from the index - no randomness.
const SHARD_COLORS = ['#FFE94A', '#2EFFE0', '#FF2EC4', '#FF6B3D'];
const SHARDS = Array.from({ length: 14 }, (_, i) => ({
  ang: (360 / 14) * i + (i % 2 ? 9 : -9),
  dist: 230 + (i % 3) * 80,
  c: SHARD_COLORS[i % SHARD_COLORS.length],
  w: i % 2 ? 8 : 11,
  h: i % 2 ? 30 : 20,
}));

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
  // in CSS), so it reads as 3D over the parallax WallScene. Subtle, and disabled
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
  // Speed-line intensity tracks the phrases (cheap: just a class swap): busy/fast
  // while "TYPE FAST." is up, slow/heavy once "DIE SLOW." has landed.
  const speedPhase = step === 'line2' || exploding ? 'slow' : 'fast';

  return (
    <div className="intro-overlay" aria-hidden="true">
      {/* Synthwave perspective grid floor, furthest back - gives the title a
          space to float over. Pure CSS perspective + a transform-only scroll. */}
      <div className="intro-grid">
        <div className="intro-grid-plane" />
      </div>

      {/* Mid-ground action scene BEHIND the title: diagonal speed lines streaking
          across + hard-edged graffiti vector accents popping in around the words.
          Fades out as the title explodes. */}
      <div className={`intro-scene${exploding ? ' exploding' : ''}`}>
        <div className={`intro-speedlines phase-${speedPhase}`}>
          {STREAKS.map((s, i) => (
            <span
              key={i}
              className="intro-streak"
              style={{
                top: `${s.top}%`,
                '--w': `${s.w}%`,
                '--h': `${s.h}px`,
                '--c': s.c,
                '--op': s.op,
                '--durF': `${s.durF}s`,
                '--durS': `${s.durS}s`,
                '--delay': `${s.delay}s`,
              }}
            />
          ))}
        </div>
        <div className="intro-accents">
          {ACCENTS.map((a, i) => (
            <div
              key={i}
              className="intro-accent"
              style={{
                ...a.pos,
                '--rot': `${a.rot}deg`,
                '--size': `${a.size}px`,
                '--pop-delay': `${a.delay}s`,
                '--idle-dur': `${a.idleDur}s`,
              }}
            >
              <AccentShape shape={a.shape} color={a.color} label={a.label} />
            </div>
          ))}
        </div>
      </div>

      <div className={`intro-stage${shaking ? ` shaking shaking--${impactKind}` : ''}`}>
        {exploding && (
          <div className="intro-boom">
            {/* Hard bright flash on detonation. */}
            <div className="intro-boom-flash" />
            {/* Two flat hard-edged shockwave rings punching outward. */}
            <div className="intro-shockwave" />
            <div className="intro-shockwave ring2" />
            {/* Layered graffiti starburst: a pink one behind, a yellow one in
                front, counter-rotating as they blow up - both with hard black
                outlines (flat, no glow). */}
            <svg className="intro-starburst intro-starburst--back" viewBox="-112 -112 224 224">
              <polygon points={BURST_POINTS} fill="#FF2EC4" stroke="#000" strokeWidth="6" strokeLinejoin="round" />
            </svg>
            <svg className="intro-starburst intro-starburst--front" viewBox="-112 -112 224 224">
              <polygon points={BURST_POINTS} fill="#FFE94A" stroke="#000" strokeWidth="6" strokeLinejoin="round" />
            </svg>
            {/* Radial shrapnel shards. */}
            <div className="intro-shards">
              {SHARDS.map((s, i) => (
                <span
                  key={i}
                  className="intro-shard"
                  style={{
                    '--ang': `${s.ang}deg`,
                    '--dist': `${s.dist}px`,
                    '--sw': `${s.w}px`,
                    '--sh': `${s.h}px`,
                    background: s.c,
                  }}
                />
              ))}
            </div>
          </div>
        )}
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
