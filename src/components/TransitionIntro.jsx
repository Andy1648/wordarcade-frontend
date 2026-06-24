// TransitionIntro.jsx
// The anime fight-card sequence played between the splash dismiss and the
// homepage reveal. Stripped back to near-empty: the two lines ARE the screen.
//   black beat -> "TYPE FAST." PUNCHES in (per-letter machine-gun snap + RGB
//   split) -> "DIE SLOW." DRAGS in slower/heavier (tired settle + paint drip) ->
//   the title settles and holds -> onComplete fires, and App reveals the menu
//   with the knife-split.
//
// The drama is contrast, not clutter: a calm flat-black field, then the two
// lines slam against it. There is deliberately NO background scene (no speed
// lines, vector accents, perspective grid, halftone or drifting particles) -
// nothing competes with the title. The impact effects (white flash + the shake
// of the card itself + hairline impact cracks that spider out from each phrase)
// fire WITH each slam, then settle. There are deliberately NO explosion/burst
// effects (no per-word starburst, no blow-apart) - the slam, flash and cracks are
// the whole punch.
//
// The two phrases animate OPPOSITELY on purpose - they mean opposite things:
// TYPE FAST is fast/electric (tight stagger, snappy machine-gun snap), DIE SLOW is
// slow/ominous (long stagger, sag, desaturated, drips). Once settled the title
// stays ALIVE (breathing scale, an occasional glitch twitch, a never-stopping
// drip, and a subtle lean toward the cursor) instead of going static.
//
// The component just sequences a `step` through the phases with setTimeout and
// renders different content per step; the punch/drag/idle motion is all CSS.
// Each landing fires a one-frame white flash + a brief shake of the whole card
// to sell the impact.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSound } from '../contexts/SoundContext';
import './TransitionIntro.css';

// Whether the viewer asked for reduced motion. Read once - the card lives ~2.5s,
// so it doesn't need to react to a mid-card preference change.
const PREFERS_REDUCED =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ============================  IMPACT CRACKS  =============================
// Hairline fractures that spider out from each phrase as it slams home, as if the
// word cracked the black "screen surface" it hit. Paths are generated procedurally
// (seeded, so they're stable per render and the two phrases differ) and drawn
// outward with the SVG stroke-dashoffset line-draw technique. They are deliberately
// NOT radial/uniform and NOT swirly: origins are scattered along the word, every
// fissure runs in mostly-straight segments that SNAP to a sharp new heading at the
// odd stress point (shattered glass, not tree roots), tapers, and ~half spawn a
// thinner branch - the angular irregularity is what sells them as real impact damage.

// Tiny deterministic PRNG (mulberry32) so a given seed always yields the same
// fracture - no Math.random, so React re-renders never reshuffle the cracks.
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Turn the polyline into a path of STRAIGHT segments. Real impact fractures are
// sharp and angular - mostly-straight runs that snap to a new direction at stress
// points - not smooth curves, so the cracks are dead-straight lines and all the
// character comes from the abrupt angle breaks between segments (set in buildCracks).
function crackPath(pts) {
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    d += ` L ${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)}`;
  }
  return d;
}

// Build one phrase's fractures inside a 1000x400 viewBox (text band ~ the middle).
// `kind` tunes the feel: 'fast' = shorter, straighter, more angular (sharp impact);
// 'slow' = longer, more curved/sagging (heavier impact). Returns an ordered list of
// { d, width, opacity, order } - `order` drives the draw stagger so the fracture
// propagates outward rather than appearing at once.
function buildCracks(seed, kind) {
  const rng = mulberry32(seed);
  const rnd = (a, b) => a + (b - a) * rng();
  const W = 1000;
  const cy = 200; // vertical centre of the 1000x400 box (the text band)
  const slow = kind === 'slow';
  const out = [];
  const MAIN = 6 + Math.floor(rng() * 2); // 6-7 primary fissures
  let order = 0;

  for (let k = 0; k < MAIN; k++) {
    // Scatter the origin ALONG the word (not one shared centre) near the text line.
    const ox = rnd(120, 880);
    const oy = cy + rnd(-22, 22);
    const dirX = ox < W / 2 ? -1 : 1; // head outward, away from centre
    const up = rng() < 0.5 ? -1 : 1; // and fan up or down
    let ang = Math.atan2(up * rnd(0.45, 1.7), dirX * rnd(0.15, 1.1));
    const segs = (slow ? 4 : 3) + Math.floor(rng() * 2);
    const first = slow ? rnd(95, 170) : rnd(70, 135);
    let x = ox;
    let y = oy;
    const pts = [[x, y]];
    for (let s = 0; s < segs; s++) {
      // Mostly dead-straight (a tiny ~5deg wander), but ~35% of joints SNAP to a
      // sharp new heading (a stress break) - that abrupt kink is what reads as a
      // real fracture rather than a swirl.
      const sharp = rng() < 0.35;
      ang += sharp
        ? (rng() < 0.5 ? -1 : 1) * rnd(0.42, 1.0) // ~24-57deg sudden break
        : rnd(-0.09, 0.09); // ~5deg wander on a near-straight run
      const len = first * Math.pow(0.82, s) * rnd(0.8, 1.12); // taper out
      x += Math.cos(ang) * len;
      y += Math.sin(ang) * len;
      pts.push([x, y]);
    }
    out.push({
      d: crackPath(pts),
      width: rnd(1.05, 1.7),
      opacity: rnd(0.8, 1),
      order: order++,
    });

    // ~half of the fissures throw off a thinner, shorter secondary branch from a
    // mid joint, at a sharp angle - the branching that real fractures show.
    if (rng() < 0.55 && pts.length >= 3) {
      const bi = 1 + Math.floor(rng() * (pts.length - 2));
      const [bx, by] = pts[bi];
      const [px, py] = pts[bi - 1];
      let bang =
        Math.atan2(by - py, bx - px) + (rng() < 0.5 ? 1 : -1) * rnd(0.5, 1.05);
      const bsegs = 2 + Math.floor(rng() * 2);
      let xx = bx;
      let yy = by;
      const bpts = [[xx, yy]];
      const blen = slow ? rnd(55, 100) : rnd(45, 80);
      for (let s = 0; s < bsegs; s++) {
        // Branches are short - keep them near-straight with the odd sharp kink too.
        bang += rng() < 0.3 ? (rng() < 0.5 ? -1 : 1) * rnd(0.4, 0.9) : rnd(-0.08, 0.08);
        const len = blen * Math.pow(0.8, s);
        xx += Math.cos(bang) * len;
        yy += Math.sin(bang) * len;
        bpts.push([xx, yy]);
      }
      out.push({
        d: crackPath(bpts),
        width: rnd(0.5, 0.85),
        opacity: rnd(0.55, 0.8),
        order: order++,
      });
    }
  }
  return out;
}

// The fracture overlay for one phrase. Sits BEHIND the letters (the parent line is
// z-index:1) so it never touches readability; pointer-events:none. The draw only
// runs once `drawing` flips true (the word has slammed), and stays drawn after.
// preserveAspectRatio="none" lets the 1000x400 field stretch to the word's box;
// non-scaling-stroke (in CSS) keeps the hairlines a constant on-screen weight.
function Cracks({ seed, kind, drawing }) {
  const cracks = useMemo(() => buildCracks(seed, kind), [seed, kind]);
  return (
    <svg
      className={`intro-cracks intro-cracks--${kind}${drawing ? ' is-drawing' : ''}`}
      viewBox="0 0 1000 400"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {cracks.map((c, i) => (
        <path
          key={i}
          d={c.d}
          pathLength="1"
          style={{ strokeWidth: c.width, '--o': c.order, '--op': c.opacity }}
        />
      ))}
    </svg>
  );
}

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

/**
 * @param {object} props
 * @param {() => void} props.onComplete - called once the title settles and holds,
 *   so App can run the knife-split reveal to the homepage and fade the music up.
 */
export default function TransitionIntro({ onComplete }) {
  // 'black' -> 'line1' -> 'line2'
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
    // After the settle, the title simply holds on the calm black field (no
    // explosion / blow-apart) until we hand off to App's knife-split reveal.
    // 2500ms: hand back to App for the knife-split menu reveal.
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

  // Both line elements stay mounted once revealed (so a punch never replays and
  // the layout never reflows); their `active` class drives the entrance, then the
  // settled title just holds until App takes over with the knife-split.
  const line1Active = step === 'line1' || step === 'line2';
  const line2Active = step === 'line2';

  return (
    <div className="intro-overlay" aria-hidden="true">
      {/* No background scene - the calm black field is the whole point. The two
          lines slam against it; the only other motion is the impact flash, the
          card shake and the hairline cracks that spider out from each slam. */}
      <div className={`intro-stage${shaking ? ` shaking shaking--${impactKind}` : ''}`}>
        {/* The title slams in, settles and holds - there is no explosion / blow-
            apart here. The screen-slicing KNIFE-SPLIT reveal to the menu is owned
            by App (it needs the menu mounted behind it, which the intro overlay
            isn't). The old explosion (shockwave rings + counter-rotating
            starbursts + 14 shards) and the per-word starburst were removed. */}
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
              {/* Cracks sit in the slot (behind the line) so the line's punch-scale
                  never zooms them; they draw when TYPE FAST lands. */}
              <Cracks seed={1337} kind="fast" drawing={line1Active} />
              <div
                className={`intro-line intro-line-type${line1Active ? ' active' : ''}`}
              >
                <IntroLetters text="TYPE FAST." />
              </div>
            </div>
            <div className="intro-line-slot intro-slot-die">
              <Cracks seed={4242} kind="slow" drawing={line2Active} />
              <div
                className={`intro-line intro-line-die${line2Active ? ' active' : ''}`}
              >
                <IntroLetters text="DIE SLOW." />
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Hard impact frame, re-keyed per word-landing so it replays. White/invert
          only: sharp single invert for FAST, heavier double-beat for SLOW. (No
          colour split any more; reduced motion hides it entirely.) */}
      {flashKey > 0 && (
        <div key={flashKey} className={`intro-flash intro-flash--${impactKind}`} />
      )}
    </div>
  );
}
