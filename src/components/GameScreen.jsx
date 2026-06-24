// GameScreen.jsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSound } from '../contexts/SoundContext';
import Mascot from './Mascot';
import ImposterWordScreen from './ImposterWordScreen';
import PlayerDot from './PlayerDot';
import ComboMeter from './ComboMeter';
import SprayReveal from './SprayReveal';
import { resolvePlayerColor } from '../playerColors';
import { exampleFor } from '../categoryExamples';
import { useCombo } from '../hooks/useCombo';
import './GameScreen.css';

// Haptic feedback on phones (no-op / absent on desktop). Always guarded so a
// missing Vibration API can never throw.
function vibrate(pattern) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    /* no-op */
  }
}

// Exact heart path supplied by the design - filled pink while the life is
// intact, dark gray once it's been lost. Stroke stays black to match the
// thick-outline cel style used everywhere else.
const HEART_PATH =
  'M8 14s-5.5-3.5-5.5-7A3.5 3.5 0 0 1 8 4.5 3.5 3.5 0 0 1 13.5 7C13.5 10.5 8 14 8 14z';

function Heart({ filled, shatter }) {
  return (
    <svg
      className={shatter ? 'heart heart-shatter' : 'heart'}
      viewBox="0 0 16 16"
      width="16"
      height="16"
      aria-hidden="true"
    >
      <path
        d={HEART_PATH}
        // While shattering, keep the heart pink (it's bursting, not yet lost);
        // once the animation clears it falls back to the gray "lost" fill.
        fill={filled || shatter ? '#FF2EC4' : '#555'}
        stroke="#000"
        strokeWidth="1.5"
      />
    </svg>
  );
}

// Human-readable copy for each server rejection reason. [combo] is filled
// in with the combo that was required at the moment of rejection. Word Bomb
// and Category Blitz share most reasons; the too-short floor differs (3 vs
// 2) and each mode has one reason the other never emits.
const REJECTION_MESSAGES = {
  too_short: 'TOO SHORT — NEED 3+ LETTERS',
  too_short_category: 'TOO SHORT — NEED 2+ LETTERS',
  missing_combo: 'MUST CONTAIN [combo]',
  already_used: 'ALREADY USED — TRY AGAIN',
  already_said: 'ALREADY SAID — TRY ANOTHER',
  not_a_word: 'NOT A REAL WORD',
  not_in_category: "DOESN'T FIT THE CATEGORY — TRY AGAIN",
};

// Category Blitz is always a fixed 3 rounds (mirrors the backend's
// TOTAL_ROUNDS); the round_start payload reports the current round but not
// the total, so the total lives here.
const TOTAL_CATEGORY_ROUNDS = 3;

// ---- Solo Category Blitz personal bests (localStorage) ----
// One record per category, so a player always has a concrete target to beat.
// Key: "typeaword-pb-" + the category lower-cased with spaces -> dashes.
// Value: JSON { score, date } where date is an ISO timestamp of when it was set.
function pbStorageKey(category) {
  return 'typeaword-pb-' + (category || '').toLowerCase().trim().replace(/\s+/g, '-');
}

// The best score on record for a category, or null if there's no record yet.
// Defensive against missing/corrupt storage (private mode, hand-edited values).
function loadPersonalBest(category) {
  try {
    const raw = localStorage.getItem(pbStorageKey(category));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed.score === 'number' ? parsed.score : null;
  } catch {
    return null;
  }
}

// Persist a new personal best for a category (only called when it's beaten).
function savePersonalBest(category, score) {
  try {
    localStorage.setItem(
      pbStorageKey(category),
      JSON.stringify({ score, date: new Date().toISOString() })
    );
  } catch {
    /* storage unavailable - skip silently, the PB just won't persist */
  }
}

// Solo Category Blitz tracks ONE overall personal best: the best TOTAL across a
// full 3-round game. (The three categories are random each game, so a per-
// category best no longer applies.) This is the pseudo-"category" it's stored
// under -> localStorage key "typeaword-pb-category-blitz-solo".
const SOLO_PB_KEY = 'category blitz solo';

function rejectionMessage(reason, { combo = '', isCategory = false } = {}) {
  // Category answers have a lower length floor, so reuse a mode-specific
  // string for the same reason code.
  const key = reason === 'too_short' && isCategory ? 'too_short_category' : reason;
  const template = REJECTION_MESSAGES[key];
  if (!template) return isCategory ? 'INVALID ANSWER' : 'INVALID WORD';
  return template.replace('[combo]', combo);
}

// Hype feedback - a punchy popup word + a screen shake on every accepted
// answer, shared by both game modes via the useHypeFeedback hook below.
const HYPE_WORDS = [
  // Original short slams.
  'SICK!', 'FIRE!', 'CLEAN!', 'NASTY!', 'EZ!', 'NICE!', 'DOPE!', 'LIT!', 'GOD!', 'BEAST!',
  // Curated hype batch (FNF/Newgrounds voice). The popup wraps now, so longer
  // phrases are fine. ('GG EZ' was intentionally excluded.)
  'NAH HE TYPING', 'THESAURUS REX', 'SPELL CHECK CANT SAVE YOU', 'COOKED',
  'YOU ATE THAT', 'DEVOURED', 'WORD MURDER', 'EAT THE DICTIONARY', 'BARS',
  'ABSOLUTELY DEMOLISHED', 'NO NOTES', 'CERTIFIED YAPPER', 'KEYBOARD WARRIOR',
  'TOO FAST TOO LITERATE', 'VOCAB GOD', 'FINGERS OF FURY', 'LETTERS FEAR YOU',
  'SHAKESPEARE WHO', 'BIG BRAIN ENERGY', 'GALAXY BRAIN', 'DICTIONARY DEMON',
  'MENACE TO SOCIETY', 'BUILT DIFFERENT', 'HES HEATING UP', 'ON FIRE',
  'COMBO KING', 'UNSTOPPABLE', 'FLAWLESS', 'SHEEEESH', 'TYPE NASTY',
  'MAXIMUM YAP', 'THE CROWD GOES WILD', 'RENT FREE', 'CLUTCH',
  'WORDSMITH UNLOCKED', 'BOMB DEFUSED', 'NO CAP JUST WORDS', 'FINGERS BLESSED',
  'SPEED DEMON',
];
const HYPE_COLORS = ['#FF2EC4', '#2EFFE0', '#FFE94A', '#FF6B3D', '#9A1AFF'];

// End-of-game roast/hype blurbs shown on the Word Bomb game-over card (one
// picked at random per result). ('WORDS WERE SAID. PEOPLE WERE HURT.' excluded.)
const END_GAME_BLURBS = [
  'GG. TOUCH GRASS.',
  'THE DICTIONARY WINS AGAIN.',
  'SCREENSHOT THIS AND HUMBLE THEM.',
  'VOCABULARY: 1. YOU: 0.',
  'NO SURVIVORS.',
  'THE BOMB IS UNDEFEATED.',
  'RUN IT BACK?',
];

/**
 * A single throwaway hype word that scales up, tilts, and fades out (see the
 * hype-pop keyframes in GameScreen.css). The parent gives it a unique `key`
 * (the trigger counter) so each accepted answer re-mounts a fresh one and
 * replays the animation. It picks its word/color/tilt once on mount and
 * removes itself when the animation ends. pointer-events:none (in CSS) keeps
 * the input clickable underneath.
 */
function HypePopup() {
  const [done, setDone] = useState(false);
  const [look] = useState(() => ({
    word: HYPE_WORDS[Math.floor(Math.random() * HYPE_WORDS.length)],
    color: HYPE_COLORS[Math.floor(Math.random() * HYPE_COLORS.length)],
    rotation: Math.floor(Math.random() * 31) - 15, // -15deg..15deg
  }));

  if (done) return null;

  return (
    <div
      className="hype-popup"
      style={{ color: look.color, '--hype-rot': `${look.rotation}deg` }}
      onAnimationEnd={() => setDone(true)}
      aria-hidden="true"
    >
      {look.word}
    </div>
  );
}

/**
 * A throwaway "+1" that floats up and fades near the input on each accepted
 * answer. Re-keyed by the same hype counter so it replays per accept, and
 * removes itself on animation end. pointer-events:none (in CSS).
 */
function FloatingScore() {
  const [done, setDone] = useState(false);
  if (done) return null;
  return (
    <div
      className="floating-score"
      onAnimationEnd={() => setDone(true)}
      aria-hidden="true"
    >
      +1
    </div>
  );
}

/**
 * The submitted word "thrown" at the bomb: a throwaway element that flies from
 * the input area up toward the bomb and fades out (see word-fly in the CSS).
 * Re-keyed per submission so it replays, and removes itself on animation end.
 * pointer-events:none (in CSS).
 */
function FlyingWord({ text }) {
  const [done, setDone] = useState(false);
  if (done) return null;
  const letters = (text || '').toUpperCase().split('');
  // The container still rides the word-fly throw up toward the bomb; each letter
  // also does a quick staggered pop on launch, so the throw reads per-letter.
  // onAnimationEnd is read from the container (the throw is the longest anim).
  return (
    <div className="flying-word" onAnimationEnd={() => setDone(true)} aria-hidden="true">
      {letters.map((ch, i) => (
        <span key={i} className="flying-letter" style={{ '--i': i }}>
          {ch === ' ' ? ' ' : ch}
        </span>
      ))}
    </div>
  );
}

/**
 * A rejected word bouncing back off the bomb and shattering: each letter flies
 * apart to a random offset/rotation and fades (see letter-shatter in the CSS).
 * Offsets are picked once on mount. Removes itself when the first letter's
 * animation ends. pointer-events:none.
 */
function ShatterWord({ text }) {
  const [done, setDone] = useState(false);
  const [letters] = useState(() =>
    (text || '').toUpperCase().split('').map((ch) => ({
      ch,
      tx: Math.round(Math.random() * 60 - 30), // ±30px sideways scatter
      // Bias the vertical scatter DOWNWARD so the rejected letters drop/fall as
      // they crumble (a small amount can still kick up).
      ty: Math.round(Math.random() * 44 + 6), // +6..+50px (down)
      rot: Math.round(Math.random() * 120 - 60),
    }))
  );
  if (done || letters.length === 0) return null;
  return (
    <div className="word-shatter" aria-hidden="true">
      {letters.map((l, i) => (
        <span
          key={i}
          className="shatter-letter"
          style={{ '--tx': `${l.tx}px`, '--ty': `${l.ty}px`, '--rot': `${l.rot}deg` }}
          onAnimationEnd={i === 0 ? () => setDone(true) : undefined}
        >
          {l.ch === ' ' ? ' ' : l.ch}
        </span>
      ))}
    </div>
  );
}

/**
 * Per-letter physics on a SUBMITTED answer (used by Category Blitz, which has no
 * bomb to throw the word at). The word is split into transient spans animated
 * individually + staggered, then the whole element self-removes:
 *   - mode 'accept' : a quick, light, crisp pop-hop left-to-right that settles
 *     then clears (fires constantly, so it stays subtle - not a celebration).
 *   - mode 'reject' : a sharper scatter - each letter jitters then flings out
 *     with a downward drop, in red. This IS the CB reject reaction (it replaces
 *     CB's input-shake) so there's ONE coherent miss, not a box-shake + letters.
 * Offsets picked once on mount; pointer-events:none (CSS); transform/opacity only.
 */
function SubmitLetters({ text, mode }) {
  const [done, setDone] = useState(false);
  const [letters] = useState(() =>
    (text || '').toUpperCase().split('').map((ch) => ({
      ch,
      tx: Math.round(Math.random() * 50 - 25), // ±25px sideways
      ty: Math.round(Math.random() * 34 + 8), // +8..+42px downward drop
      rot: Math.round(Math.random() * 70 - 35),
    }))
  );
  if (done || letters.length === 0) return null;
  return (
    <div className={`submit-letters submit-${mode}`} aria-hidden="true">
      {letters.map((l, i) => (
        <span
          key={i}
          className="submit-letter"
          style={{
            '--i': i,
            '--tx': `${l.tx}px`,
            '--ty': `${l.ty}px`,
            '--rot': `${l.rot}deg`,
          }}
          onAnimationEnd={i === 0 ? () => setDone(true) : undefined}
        >
          {l.ch === ' ' ? ' ' : l.ch}
        </span>
      ))}
    </div>
  );
}

/**
 * The "CLUTCH!" slam shown instead of the normal hype word when a correct answer
 * lands with <=2s left. Big pink Bungee with a unique slam-in animation; removes
 * itself on animation end. pointer-events:none.
 */
function ClutchPopup() {
  const [done, setDone] = useState(false);
  if (done) return null;
  return (
    <div className="clutch-popup" onAnimationEnd={() => setDone(true)} aria-hidden="true">
      CLUTCH!
    </div>
  );
}

// Near-miss tier from the remaining-time value at the moment of a successful
// submit. The shared game clock is WHOLE seconds (per-second timer_tick), so a
// reading of 1 means "under 1s actually remained", 2 means "under 2s", etc. -
// hence the "<Ns" copy. Returns null for anything that isn't a real close call.
function clutchTier(secondsLeft) {
  if (typeof secondsLeft !== 'number' || secondsLeft <= 0) return null;
  if (secondsLeft <= 1) return 'clutch'; // landed in the final displayed second
  if (secondsLeft <= 2) return 'close'; // landed with ~1-2s to spare
  return null;
}

/**
 * The near-miss / clutch callout: a quick emphasis pop near the input that
 * surfaces HOW CLOSE a successful submit was ("<1s CLUTCH!" / "<2s CLOSE!").
 * Tiered (close vs the hotter clutch); re-keyed per qualifying submit so it
 * replays, and removes itself on animation end. pointer-events:none.
 */
function ClutchCallout({ seconds, tier }) {
  const [done, setDone] = useState(false);
  if (done) return null;
  const label = tier === 'clutch' ? 'CLUTCH!' : 'CLOSE!';
  return (
    <div
      className={`clutch-callout clutch-${tier}`}
      onAnimationEnd={() => setDone(true)}
      aria-hidden="true"
    >
      <span className="clutch-callout-time">&lt;{seconds}s</span>
      <span className="clutch-callout-label">{label}</span>
    </div>
  );
}

/**
 * A single floating spectator reaction: a big emoji with the spectator's name
 * below it, popping in and drifting up before fading (see reaction-float). Picks
 * a random horizontal position (20-80%) and a slight vertical jitter around the
 * centre once on mount. pointer-events:none (in CSS); App removes it after 2s.
 */
function FloatingReaction({ emoji, name }) {
  const [pos] = useState(() => ({
    left: 20 + Math.random() * 60, // 20-80% of the game width
    top: 42 + Math.random() * 16, // ~centre, with a little jitter
  }));
  return (
    <div
      className="floating-reaction"
      style={{ left: `${pos.left}%`, top: `${pos.top}%` }}
      aria-hidden="true"
    >
      <span className="floating-reaction-emoji">{emoji}</span>
      <span className="floating-reaction-name">{name}</span>
    </div>
  );
}

// Jagged comic starburst behind the K.O. slam (same construction as the homepage
// burst): alternating outer/inner radii, computed once.
const KO_BURST_POINTS = Array.from({ length: 28 }, (_, i) => {
  const r = i % 2 === 0 ? 100 : 62;
  const a = (Math.PI * i) / 14 - Math.PI / 2;
  return `${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`;
}).join(' ');

/**
 * Fighting-game K.O. slam, played when a player is eliminated. Mounts (re-keyed)
 * after the explosion; its CSS sequences itself: a 400ms freeze (nothing
 * visible, the stage is hitlag-frozen by the parent), then a white impact flash,
 * then "K.O." slams down with overshoot over a rising starburst, holds, and
 * fades. Self-removes after the full ~1.6s timeline. Fixed + pointer-events:none.
 */
function KOOverlay() {
  const [done, setDone] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setDone(true), 1600);
    return () => clearTimeout(id);
  }, []);
  if (done) return null;
  return (
    <div className="ko-overlay" aria-hidden="true">
      <div className="ko-impact-flash" />
      <svg className="ko-burst" viewBox="-100 -100 200 200">
        <polygon points={KO_BURST_POINTS} fill="#FFE94A" />
      </svg>
      <div className="ko-text">K.O.</div>
    </div>
  );
}

// Three teardrops for the panic "sweat" indicator.
const SWEAT_DROPS = [
  { left: 70, top: 4, delay: 0 },
  { left: 84, top: 10, delay: 130 },
  { left: 60, top: 14, delay: 260 },
];

/**
 * Anime-style panic sweat: a few small blue teardrops that fling off the active
 * player's card, repeating, while time is critical and it's your turn. Purely
 * decorative; absolutely positioned within the (relative) player card.
 */
function SweatDrops() {
  return (
    <div className="sweat-layer" aria-hidden="true">
      {SWEAT_DROPS.map((d, i) => (
        <svg
          key={i}
          className="sweat-drop"
          viewBox="0 0 10 14"
          style={{ left: `${d.left}%`, top: `${d.top}%`, animationDelay: `${d.delay}ms` }}
        >
          <path d="M5 0 C8 6 10 8 10 10 A5 5 0 1 1 0 10 C0 8 2 6 5 0 Z" fill="#2EFFE0" stroke="#1A9985" strokeWidth="1" />
        </svg>
      ))}
    </div>
  );
}

// 3-2-1-GO! intro sequence. Each entry shows for 700ms; null marks the end.
const COUNTDOWN_STEPS = [3, 2, 1, 'GO!', null];

/**
 * Fullscreen "3 2 1 GO!" countdown shown when gameplay (re)starts. Steps
 * through COUNTDOWN_STEPS on a 700ms interval; when it reaches the trailing
 * null it calls onComplete (once) so the parent can hide it and unblock the
 * input. Each step gets a random tilt for graffiti energy, and is re-keyed so
 * the countdown-pop animation replays per number.
 */
export function CountdownOverlay({ onComplete, onStep }) {
  const [index, setIndex] = useState(0);
  const doneRef = useRef(false);
  // One random tilt (-5deg..5deg) per step, picked once on mount.
  const [rotations] = useState(() =>
    COUNTDOWN_STEPS.map(() => Math.floor(Math.random() * 11) - 5)
  );

  useEffect(() => {
    const intervalId = setInterval(() => {
      setIndex((i) => (i >= COUNTDOWN_STEPS.length - 1 ? i : i + 1));
    }, 700);
    return () => clearInterval(intervalId);
  }, []);

  // Fire the per-step callback (used for the countdown beep) as each visible
  // step appears - the "3","2","1" numbers and the distinct "GO!".
  useEffect(() => {
    const step = COUNTDOWN_STEPS[index];
    if (step !== null && step !== undefined && onStep) onStep(step);
    // onStep is stable enough at the call site; only react to step changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  useEffect(() => {
    if (COUNTDOWN_STEPS[index] === null && !doneRef.current) {
      doneRef.current = true;
      onComplete();
    }
  }, [index, onComplete]);

  const step = COUNTDOWN_STEPS[index];
  if (step === null || step === undefined) return null;

  return (
    <div className="countdown-overlay">
      <div
        key={index}
        className={`countdown-text${step === 'GO!' ? ' go' : ''}`}
        style={{ '--cd-rot': `${rotations[index]}deg` }}
        aria-hidden="true"
      >
        {step}
      </div>
    </div>
  );
}

// Paint-splatter confetti colours (the same graffiti palette used everywhere).
const CONFETTI_COLORS = ['#FF2EC4', '#2EFFE0', '#FFE94A', '#FF6B3D', '#9A1AFF'];

/**
 * A burst of 25 throwaway confetti pieces that rain down the full viewport
 * when the local player wins. Each piece picks its position, colour, size,
 * shape, spin and timing once on mount (see confetti-fall in GameScreen.css).
 * Fixed + pointer-events:none so it never blocks the game-over buttons.
 * Only the parent decides whether to render it (winners only).
 */
export function ConfettiEffect() {
  const [pieces] = useState(() =>
    Array.from({ length: 25 }, () => ({
      left: Math.random() * 100, // 0-100% of screen width
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      size: 8 + Math.random() * 8, // 8-16px
      rotation: Math.random() * 360, // starting tilt
      duration: 2 + Math.random() * 2, // 2-4s fall
      delay: Math.random(), // 0-1s stagger
      circle: Math.random() < 0.5, // mix of circles and squares
    }))
  );

  return (
    <div className="confetti-layer" aria-hidden="true">
      {pieces.map((piece, i) => (
        <div
          key={i}
          className={`confetti-piece${piece.circle ? ' circle' : ''}`}
          style={{
            left: `${piece.left}%`,
            width: `${piece.size}px`,
            height: `${piece.size}px`,
            background: piece.color,
            animationDuration: `${piece.duration}s`,
            animationDelay: `${piece.delay}s`,
            '--confetti-rot': `${piece.rotation}deg`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * A flat comic starburst that pops in behind the WIN card and slowly spins, so
 * the victory reads as earned and screenshot-worthy. Locked style only: flat
 * polygon fills, a HARD offset black duplicate as the shadow (no blur), thick
 * black outlines, palette colours. Decorative + click-through.
 */
function WinBurst() {
  return (
    <div className="go-win-burst" aria-hidden="true">
      <svg className="go-win-burst-svg" viewBox="-112 -112 224 224">
        {/* Hard offset shadow: a flat black copy nudged down-right (no blur). */}
        <polygon points={KO_BURST_POINTS} fill="#000" transform="translate(7 9)" />
        {/* Big yellow burst. */}
        <polygon points={KO_BURST_POINTS} fill="#FFE94A" stroke="#000" strokeWidth="5" />
        {/* A smaller pink burst on top, rotated, for layered depth. */}
        <polygon
          points={KO_BURST_POINTS}
          fill="#FF2EC4"
          stroke="#000"
          strokeWidth="6"
          transform="scale(0.6) rotate(12)"
        />
      </svg>
    </div>
  );
}

/**
 * LOSS impact, the counterpart to WinBurst: a flat red spike-burst that slams in
 * behind the ELIMINATED card, plus two hard-edged shockwave rings that punch out
 * from the centre once. Locked style only — flat polygon/ring fills, a HARD
 * offset black shadow, thick black outlines, no blur/glow. Decorative +
 * click-through; the parent only renders it for the eliminated player.
 */
function LossImpact() {
  return (
    <div className="go-loss-impact" aria-hidden="true">
      <svg className="go-loss-burst-svg" viewBox="-112 -112 224 224">
        {/* Hard offset shadow: flat black copy nudged down-right (no blur). */}
        <polygon points={KO_BURST_POINTS} fill="#000" transform="translate(7 9)" />
        {/* Big red spike burst, tilted so it reads as a violent hit. */}
        <polygon
          points={KO_BURST_POINTS}
          fill="#FF5C5C"
          stroke="#000"
          strokeWidth="5"
          transform="rotate(8)"
        />
        {/* A smaller dark-blood burst on top for layered depth. */}
        <polygon
          points={KO_BURST_POINTS}
          fill="#7A1226"
          stroke="#000"
          strokeWidth="6"
          transform="scale(0.6) rotate(-7)"
        />
      </svg>
      {/* Hard flat shockwave rings (stroke only, no blur) — one red, one white. */}
      <div className="go-shockwave" />
      <div className="go-shockwave white" />
    </div>
  );
}

/**
 * Counts a number up from 0 to `to` over `duration` ms, used on the winner's
 * final score so it tallies up dramatically instead of just appearing.
 */
export function CountUp({ to, duration = 1000 }) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const target = Number(to) || 0;
    if (target <= 0) {
      setValue(target);
      return;
    }
    const steps = 30;
    let frame = 0;
    const intervalId = setInterval(() => {
      frame += 1;
      if (frame >= steps) {
        setValue(target);
        clearInterval(intervalId);
      } else {
        setValue(Math.round((target * frame) / steps));
      }
    }, duration / steps);
    return () => clearInterval(intervalId);
  }, [to, duration]);

  return <>{value}</>;
}

/**
 * Renders text with each letter wrapped in its own span carrying a staggered
 * animation-delay, so the letters wobble out of sync (see letter-wobble).
 * Used for the loser's "GAME OVER" title.
 */
export function WobbleText({ text }) {
  return (
    <>
      {text.split('').map((ch, i) => (
        <span
          key={i}
          className="wobble-letter"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          {ch === ' ' ? ' ' : ch}
        </span>
      ))}
    </>
  );
}

// ---- Bomb tension lookups (keyed by tier) ----
const BOMB_SCALE = { calm: 1.0, warning: 1.05, critical: 1.1 };
const FLAME_SCALE = { calm: 1.0, warning: 1.35, critical: 1.7 };
const BODY_INNER_FILL = { calm: '#2a2a2a', warning: '#3a1a1a', critical: '#5a1010' };
const HIGHLIGHT_1 = { calm: '#444', warning: '#5a2a2a', critical: '#7a2020' };
const HIGHLIGHT_2 = { calm: '#555', warning: '#6a3a3a', critical: '#8a3030' };

// Spark particles around the flame - more (and bigger, redder) as tension
// rises. Offsets are relative to the burning tip; values are fixed (not random
// per render) so the sparks don't jitter every second as the flame moves.
const BOMB_SPARKS = {
  calm: [
    { dx: -13, dy: -8, r: 2.5, c: '#FFE94A', delay: 0, dur: 520 },
    { dx: 11, dy: -5, r: 2, c: '#FF6B3D', delay: 160, dur: 460 },
    { dx: -3, dy: -18, r: 2, c: '#FFE94A', delay: 300, dur: 560 },
    { dx: 6, dy: -14, r: 2.5, c: '#FF6B3D', delay: 420, dur: 500 },
  ],
  warning: [
    { dx: -15, dy: -9, r: 3, c: '#FFE94A', delay: 0, dur: 520 },
    { dx: 13, dy: -6, r: 2.5, c: '#FF6B3D', delay: 120, dur: 460 },
    { dx: -5, dy: -20, r: 2.5, c: '#FFE94A', delay: 260, dur: 560 },
    { dx: 8, dy: -16, r: 3, c: '#FF6B3D', delay: 380, dur: 500 },
    { dx: -10, dy: -15, r: 2, c: '#FFE94A', delay: 200, dur: 540 },
    { dx: 3, dy: -22, r: 2.5, c: '#FF6B3D', delay: 440, dur: 480 },
  ],
  critical: [
    { dx: -17, dy: -10, r: 3.5, c: '#FFE94A', delay: 0, dur: 480 },
    { dx: 15, dy: -7, r: 3, c: '#FF6B3D', delay: 90, dur: 440 },
    { dx: -6, dy: -23, r: 3, c: '#FF5C5C', delay: 180, dur: 520 },
    { dx: 9, dy: -19, r: 3.5, c: '#FFE94A', delay: 270, dur: 500 },
    { dx: -12, dy: -17, r: 3, c: '#FF6B3D', delay: 150, dur: 460 },
    { dx: 4, dy: -25, r: 3, c: '#FF5C5C', delay: 360, dur: 540 },
    { dx: 18, dy: -13, r: 2.5, c: '#FFE94A', delay: 300, dur: 420 },
    { dx: -19, dy: -5, r: 2.5, c: '#FF6B3D', delay: 420, dur: 500 },
    { dx: 0, dy: -15, r: 3, c: '#FF5C5C', delay: 240, dur: 480 },
  ],
};

// Fixed fuse curve (cap top -> up and right). Geometry never changes - the
// burning is done purely with stroke-dashoffset, so it can transition smoothly.
const FUSE_PATH = 'M 80 40 Q 120 14 110 2';
// Quadratic control points, used to interpolate the flame onto the fuse.
const FUSE_P0 = [80, 40];
const FUSE_P1 = [120, 14];
const FUSE_P2 = [110, 2];

// Point on the fuse Bezier at parameter t (0 = cap, 1 = tip).
function fusePointAt(t) {
  const u = 1 - t;
  const x = u * u * FUSE_P0[0] + 2 * u * t * FUSE_P1[0] + t * t * FUSE_P2[0];
  const y = u * u * FUSE_P0[1] + 2 * u * t * FUSE_P1[1] + t * t * FUSE_P2[1];
  return [x, y];
}

// The mascot pose PNGs - the mascot IS the bomb now (idle until the timer gets
// dire, then panic; brief celebrate/taunt flashes are driven by the parent).
const BOMB_MASCOT_SRC = {
  idle: '/mascot-idle.png',
  panic: '/mascot-panic.png',
  celebrate: '/mascot-celebrate.png',
  taunt: '/mascot-taunt.png',
};

/**
 * Word Bomb's centerpiece: the MASCOT is the bomb. The mascot PNG (chosen by the
 * `pose` prop - idle, panic under 30%, or a brief celebrate/taunt flash) renders
 * inside the SVG where the cartoon bomb body used to be, while the fuse still
 * burns down over its head and the live seconds count over its belly. The
 * calm/warning/critical tension tiers drive the same wobble / shake / scale /
 * vignette as before - they now move the mascot image instead of an SVG bomb.
 */
function BombVisual({ timerSeconds, maxTimer, showCountdown, pose }) {
  // Fraction of time remaining (full while the 3-2-1 intro is still up).
  const ratio = showCountdown
    ? 1
    : Math.max(0, Math.min(1, timerSeconds / (maxTimer || 1)));

  const tension = ratio > 0.6 ? 'calm' : ratio >= 0.3 ? 'warning' : 'critical';
  const critical = tension === 'critical';

  // Fuse uses pathLength="100", so the offset is just the burnt-away percent;
  // the flame sits at the matching point along the curve.
  const fuseDashoffset = 100 * (1 - ratio);
  const [flameX, flameY] = fusePointAt(ratio);
  const flameScale = FLAME_SCALE[tension];

  // Timer number: white -> red -> white-with-red-stroke, growing each tier.
  const numFill = tension === 'warning' ? '#FF5C5C' : '#fff';
  const numStroke = critical ? '#FF5C5C' : '#000';
  const numStrokeWidth = critical ? 4 : 3;
  const numSize = tension === 'calm' ? 26 : tension === 'warning' ? 30 : 34;

  const src = BOMB_MASCOT_SRC[pose] || BOMB_MASCOT_SRC.idle;

  return (
    <div className={`bomb-vignette ${tension}`}>
      <div className="bomb-scale" style={{ transform: `scale(${BOMB_SCALE[tension]})` }}>
        <div className={`bomb-body-wrap ${tension}`}>
          <svg className="bomb-svg" viewBox="0 0 160 185" width="150" aria-hidden="true">
            {/* The mascot IS the bomb. The default preserveAspectRatio fits +
                centres it inside the box, so non-square art is never distorted.
                Re-keyed per pose so each swap reads as a quick fade. */}
            <image key={pose} className="bomb-mascot-image" href={src} x="10" y="35" width="140" height="140" />
            {/* ---- Fuse: fat black outline under a brown rope. Both burn down
                 together via the shared dashoffset (smoothed in CSS). ---- */}
            <path
              className="bomb-fuse"
              d={FUSE_PATH}
              fill="none"
              stroke="#000"
              strokeWidth="7"
              strokeLinecap="round"
              pathLength="100"
              strokeDasharray="100"
              strokeDashoffset={fuseDashoffset}
            />
            <path
              className="bomb-fuse"
              d={FUSE_PATH}
              fill="none"
              stroke="#8B6914"
              strokeWidth="3"
              strokeLinecap="round"
              pathLength="100"
              strokeDasharray="100"
              strokeDashoffset={fuseDashoffset}
            />

            {/* (The mascot <image> above is the bomb body now - no SVG body/face.) */}

            {/* ---- Live seconds, sitting over the mascot's belly. ---- */}
            <text
              className={critical ? 'bomb-num-pulse' : undefined}
              x="80"
              y="116"
              textAnchor="middle"
              dominantBaseline="central"
              fontFamily="'Bungee', cursive"
              fontSize={numSize}
              fill={numFill}
              stroke={numStroke}
              strokeWidth={numStrokeWidth}
              paintOrder="stroke"
              style={{ transition: 'font-size 0.4s ease, fill 0.4s linear, stroke 0.4s linear' }}
            >
              {timerSeconds}
            </text>

            {/* ---- Flame + sparks, glued to the burning tip. The position group
                 eases its translate over 1s so it tracks the smooth fuse. ---- */}
            <g
              className="bomb-flame-pos"
              style={{ transform: `translate(${flameX.toFixed(1)}px, ${flameY.toFixed(1)}px)` }}
            >
              {/* Flame: three layered ellipses (orange / yellow / bright core),
                  sized by tension, with a snappy flicker. */}
              <g transform={`scale(${flameScale})`}>
                <g className="bomb-flame-core">
                  <ellipse cx="0" cy="-13" rx="9" ry="17" fill="#FF6B3D" stroke="#000" strokeWidth="2.5" />
                  <ellipse cx="0" cy="-15" rx="5.5" ry="12" fill="#FFE94A" />
                  <ellipse cx="0" cy="-16" rx="2.5" ry="7" fill="#FFF6C8" />
                </g>
              </g>

            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}

// Flat debris colours for the explosion (orange/yellow/red + bomb-body gray).
const EXPLOSION_DEBRIS_COLORS = ['#FF6B3D', '#FFE94A', '#FF5C5C', '#2a2a2a'];

/**
 * Full-screen bomb explosion, shown when a Word Bomb player times out or skips
 * (i.e. a life is lost). A white flash, an expanding orange blast ring with a
 * delayed yellow inner ring, and ~18 debris shards (outlined squares and
 * triangles) flung outward. Self-removes after ~850ms. The parent re-keys it
 * per detonation so it replays. Fixed + pointer-events:none, so it never blocks
 * input underneath.
 */
function ExplosionEffect() {
  const [done, setDone] = useState(false);
  const [debris] = useState(() =>
    Array.from({ length: 18 }, (_, i) => {
      // Spread shards roughly evenly around the circle, with some jitter.
      const angle = (Math.PI * 2 * i) / 18 + Math.random() * 0.5;
      const dist = 120 + Math.random() * 120; // 120-240px outward
      return {
        dx: Math.round(Math.cos(angle) * dist),
        dy: Math.round(Math.sin(angle) * dist),
        color: EXPLOSION_DEBRIS_COLORS[Math.floor(Math.random() * EXPLOSION_DEBRIS_COLORS.length)],
        size: 10 + Math.round(Math.random() * 10), // 10-20px
        triangle: Math.random() < 0.4,
        delay: Math.round(Math.random() * 80),
      };
    })
  );

  useEffect(() => {
    const id = setTimeout(() => setDone(true), 850);
    return () => clearTimeout(id);
  }, []);

  if (done) return null;

  return (
    <div className="explosion-layer" aria-hidden="true">
      <div className="explosion-flash" />
      <div className="explosion-blast" />
      <div className="explosion-blast inner" />
      {debris.map((d, i) => (
        <svg
          key={i}
          className="explosion-debris"
          width={d.size}
          height={d.size}
          viewBox="0 0 10 10"
          style={{
            '--dx': `${d.dx}px`,
            '--dy': `${d.dy}px`,
            marginLeft: `${-d.size / 2}px`,
            marginTop: `${-d.size / 2}px`,
            animationDelay: `${d.delay}ms`,
          }}
        >
          {d.triangle ? (
            <polygon points="5,0 10,10 0,10" fill={d.color} stroke="#000" strokeWidth="2" />
          ) : (
            <rect x="1" y="1" width="8" height="8" fill={d.color} stroke="#000" strokeWidth="2" />
          )}
        </svg>
      ))}
    </div>
  );
}

// How many feed rows are visible at once; older events stay in the array (full
// history) but scroll out of the rendered window under a fade mask.
const FEED_MAX_VISIBLE = 8;

/**
 * Word Bomb's live kill feed: a scrolling log of game events shown to the side
 * of the stage. Fed an ordered (oldest-first) array of event objects from
 * App.jsx - { type: 'accepted'|'timeout'|'skip'|'rejected', playerName, word?,
 * timestamp }. We render the most recent FEED_MAX_VISIBLE newest-first; each
 * row carries a colour-coded dot, the actor's name, and a short description.
 *
 * Rows are keyed by their stable index in the full array (not their position in
 * the visible slice), so a persisting event keeps its DOM node when a new event
 * pushes it down - only the freshly-added row mounts and replays the slide-in,
 * and the one scrolling off the end unmounts.
 */
function KillFeed({ events, playerColors = {} }) {
  const list = events || [];
  const visible = [];
  for (let i = list.length - 1; i >= 0 && visible.length < FEED_MAX_VISIBLE; i--) {
    visible.push({ ev: list[i], idx: i });
  }

  return (
    <div className="kill-feed" aria-hidden="true">
      <div className="kill-feed-title">LIVE FEED</div>
      <div className="kill-feed-list">
        {visible.length === 0 ? (
          <div className="kill-feed-empty">WAITING FOR ACTION...</div>
        ) : (
          visible.map(({ ev, idx }) => {
            // The row is identified by its actor's session colour (a left accent
            // bar + the player's name in colour); the event TYPE is still read
            // from the dot + the coloured action word (TIMED OUT, etc.).
            const pc = resolvePlayerColor(playerColors, ev.playerId);
            return (
            <div
              key={idx}
              className={`kill-feed-row ${ev.type}`}
              style={{ '--pc': pc.color, '--pc-dark': pc.dark }}
            >
              <span className="kill-feed-dot" />
              <span className="kill-feed-text">
                {ev.type === 'eliminated' ? (
                  // The flavor line already includes the player's name.
                  <span className="kill-feed-action kill-feed-elim">{ev.message}</span>
                ) : (
                  <>
                    <span className="kill-feed-name">{ev.playerName}</span>{' '}
                    {ev.type === 'accepted' && (
                      <>
                        typed{' '}
                        <span className="kill-feed-word">
                          {(ev.word || '').toUpperCase()}
                        </span>
                      </>
                    )}
                    {ev.type === 'timeout' && (
                      <span className="kill-feed-action">TIMED OUT 💀</span>
                    )}
                    {ev.type === 'skip' && (
                      <span className="kill-feed-action">SKIPPED</span>
                    )}
                    {ev.type === 'rejected' && (
                      <span className="kill-feed-action">MISSED</span>
                    )}
                  </>
                )}
              </span>
            </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// Format a millisecond span as "Xm Ys" for the game-duration stat.
function formatDuration(ms) {
  if (!ms || ms < 0) return '—';
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}m ${s}s`;
}

/**
 * End-of-game statistics panel for Word Bomb, shown on the game-over overlay
 * between the winner announcement and the action buttons. Three blocks:
 *   - GAME SUMMARY  : total words, duration, total timeouts
 *   - PER-PLAYER    : a card per player (words, longest, avg length, timeouts),
 *                     sorted by words played descending
 *   - AWARDS        : fun superlatives, only shown when there's a clear winner
 *
 * All of its data comes from the gameStats object accumulated in App.jsx; the
 * `players` roster (final standings) seeds the per-player rows so everyone
 * appears even if they never played a word.
 */
function GameOverStats({ gameStats, players, winner, playerColors = {} }) {
  const words = gameStats.wordsPlayed || [];
  const timeouts = gameStats.timeouts || [];
  const durationMs =
    gameStats.gameEndTime && gameStats.gameStartTime
      ? gameStats.gameEndTime - gameStats.gameStartTime
      : 0;

  // Build a per-player accumulator seeded from the roster, then fold in each
  // player's words and timeouts.
  const byPlayer = new Map();
  const ensure = (id, name) => {
    if (!byPlayer.has(id)) byPlayer.set(id, { id, name, words: [], timeouts: 0 });
    return byPlayer.get(id);
  };
  (players || []).forEach((p) => ensure(p.id, p.name));
  words.forEach((w) => ensure(w.playerId, w.playerName).words.push(w.word || ''));
  timeouts.forEach((t) => {
    ensure(t.playerId, t.playerName).timeouts += 1;
  });

  const perPlayer = Array.from(byPlayer.values())
    .map((p) => {
      const total = p.words.length;
      const longest = p.words.reduce((a, b) => (b.length > a.length ? b : a), '');
      const avg = total
        ? p.words.reduce((sum, w) => sum + w.length, 0) / total
        : 0;
      return { id: p.id, name: p.name, count: total, longest, avg, timeouts: p.timeouts };
    })
    .sort((a, b) => b.count - a.count);

  // ---- Awards (only shown when unambiguous) ----
  const awards = [];

  // WORDSMITH: the single longest word, as long as one player owns that length.
  if (words.length) {
    const maxLen = words.reduce((m, w) => Math.max(m, (w.word || '').length), 0);
    const topWords = words.filter((w) => (w.word || '').length === maxLen);
    const distinctOwners = new Set(topWords.map((w) => w.playerId));
    if (distinctOwners.size === 1) {
      awards.push({
        key: 'wordsmith',
        label: 'WORDSMITH',
        name: topWords[0].playerName,
        detail: (topWords[0].word || '').toUpperCase(),
      });
    }
  }

  // SPEED DEMON: most words played, only if there's a sole leader.
  if (perPlayer.length && perPlayer[0].count > 0) {
    const top = perPlayer[0].count;
    const leaders = perPlayer.filter((p) => p.count === top);
    if (leaders.length === 1) {
      awards.push({
        key: 'speed-demon',
        label: 'SPEED DEMON',
        name: leaders[0].name,
        detail: `${top} WORDS`,
      });
    }
  }

  // SURVIVOR: the winner, framed as an award.
  if (winner) {
    awards.push({
      key: 'survivor',
      label: 'SURVIVOR',
      name: winner.name,
      detail: 'LAST ONE STANDING',
    });
  }

  return (
    <div className="go-stats">
      <div className="go-section-label">GAME SUMMARY</div>
      <div className="go-stats-summary">
        <div className="go-summary-item">
          <div className="go-summary-value">
            <CountUp to={words.length} duration={500} />
          </div>
          <div className="go-summary-label">WORDS</div>
        </div>
        <div className="go-summary-item">
          <div className="go-summary-value">{formatDuration(durationMs)}</div>
          <div className="go-summary-label">DURATION</div>
        </div>
        <div className="go-summary-item">
          <div className="go-summary-value">
            <CountUp to={timeouts.length} duration={500} />
          </div>
          <div className="go-summary-label">TIMEOUTS</div>
        </div>
      </div>

      {awards.length > 0 && (
        <>
          <div className="go-section-label">HIGHLIGHTS</div>
          <div className="go-awards">
            {awards.map((a) => (
              <div key={a.key} className={`go-award ${a.key}`}>
                <span className="go-award-label">{a.label}</span>
                <span className="go-award-name">{a.name}</span>
                {a.detail && <span className="go-award-detail">{a.detail}</span>}
              </div>
            ))}
          </div>
        </>
      )}

      <div className="go-section-label">PLAYERS</div>
      <div className="go-players">
        {perPlayer.map((p) => {
          const pc = resolvePlayerColor(playerColors, p.id);
          return (
          <div
            key={p.id}
            className="go-player"
            style={{ '--pc': pc.color, '--pc-dark': pc.dark }}
          >
            <div className="go-player-name">
              <PlayerDot color={pc.color} dark={pc.dark} tier={pc.tier} />
              <span className="go-player-name-text">{p.name}</span>
            </div>
            <div className="go-player-grid">
              <div className="go-pstat">
                <span className="go-pstat-val">
                  <CountUp to={p.count} duration={500} />
                </span>
                <span className="go-pstat-key">WORDS</span>
              </div>
              <div className="go-pstat">
                <span className="go-pstat-val">
                  {p.longest ? p.longest.toUpperCase() : '—'}
                </span>
                <span className="go-pstat-key">LONGEST</span>
              </div>
              <div className="go-pstat">
                <span className="go-pstat-val">{p.count ? p.avg.toFixed(1) : '—'}</span>
                <span className="go-pstat-key">AVG LEN</span>
              </div>
              <div className="go-pstat">
                <span className="go-pstat-val">
                  <CountUp to={p.timeouts} duration={500} />
                </span>
                <span className="go-pstat-key">TIMEOUTS</span>
              </div>
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Watches lastWordResult and reacts to each new result:
 *   - accepted -> bump hypeKey (re-keys the hype popup + floating "+1" so they
 *     replay) and fire a brief 200ms screen shake.
 *   - rejected -> fire a 400ms horizontal input shake.
 * Returns { hypeKey, shake, inputShake } for the caller to render.
 */
function useHypeFeedback(lastWordResult) {
  const [hypeKey, setHypeKey] = useState(0);
  const [shake, setShake] = useState(false);
  const [inputShake, setInputShake] = useState(false);

  useEffect(() => {
    if (!lastWordResult) return;

    if (lastWordResult.accepted) {
      setHypeKey((k) => k + 1);
      setShake(true);
      const timeoutId = setTimeout(() => setShake(false), 200);
      return () => clearTimeout(timeoutId);
    }

    // Rejected: shake the input so the miss is felt, not just read.
    setInputShake(true);
    const timeoutId = setTimeout(() => setInputShake(false), 400);
    return () => clearTimeout(timeoutId);
  }, [lastWordResult]);

  return { hypeKey, shake, inputShake };
}

/**
 * The live Chain Reaction play screen. All of its data is driven by props
 * fed from App.jsx's WebSocket message handling:
 *
 *   gameState      - latest turn_update payload (players, whose turn, timer
 *                    max, and the mode-specific prompt/history fields)
 *   gameType       - 'word-bomb' | 'category-blitz'; selects which prompt
 *                    (combo vs category) and history (words vs answers) to show
 *   myId           - this client's connection id, to know if it's our turn
 *   timerSeconds   - live countdown for the current turn
 *   lastWordResult - transient accept/reject of the most recent submission
 *   gameOver       - final results once the game ends (null while playing)
 *
 * The only local state is the text the player is typing; everything else
 * is authoritative server state passed down.
 */
export default function GameScreen({
  gameState,
  gameType,
  gameNonce,
  myId,
  isHost,
  timerSeconds,
  lastWordResult,
  gameOver,
  roomPlayers,
  playerColors = {},
  feedEvents = [],
  gameStats = { wordsPlayed: [], timeouts: [], skips: [], gameStartTime: null, gameEndTime: null },
  typingText = {},
  categoryRound,
  myAnswers,
  playerProgress,
  roundResults,
  categoryScores,
  categoryTotals,
  categoryRerolls,
  lastReroll,
  imposterRound,
  imposterPhase,
  imposterAnswers,
  imposterVoteData,
  imposterVoteCount,
  imposterMyVote,
  imposterResults,
  imposterFinal,
  onSubmitWord,
  onSubmitAnswer,
  onSubmitVote,
  onSkipTurn,
  onTypingUpdate,
  onLeave,
  onRematch,
  onPlayAgain,
  onRerollCategory,
  musicSetVolume,
  reactions = [],
  onSpectatorReaction,
  onShake,
}) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);
  // Intro countdown plays once when the screen mounts; the input stays
  // disabled until it finishes.
  const [showCountdown, setShowCountdown] = useState(true);

  // Tiny tactile input feedback: while keys are landing, the field brightens its
  // border + scales a hair (eased via a transition, see .game-input.typing-active),
  // settling ~120ms after the last keystroke so typing feels alive.
  const [typingActive, setTypingActive] = useState(false);
  const typingActiveTimerRef = useRef(null);
  // typingFast: >3 keystrokes in the last second -> the bomb panics (it knows
  // you're about to submit). Tracked from keystroke timestamps.
  const [typingFast, setTypingFast] = useState(false);
  const keyTimesRef = useRef([]);
  const fastTimerRef = useRef(null);
  function pulseInput() {
    setTypingActive(true);
    if (typingActiveTimerRef.current) clearTimeout(typingActiveTimerRef.current);
    typingActiveTimerRef.current = setTimeout(() => setTypingActive(false), 120);

    const now = Date.now();
    const times = keyTimesRef.current;
    times.push(now);
    while (times.length && now - times[0] > 1000) times.shift();
    if (times.length > 3) {
      setTypingFast(true);
      if (fastTimerRef.current) clearTimeout(fastTimerRef.current);
      fastTimerRef.current = setTimeout(() => setTypingFast(false), 700);
    }
  }

  // Duck the background music while a game is live (from the moment this screen
  // mounts / the countdown begins) so the synthesized SFX cut through, and
  // restore it at game over and when leaving the screen. The SFX play on top of
  // the (quieter) music, not in place of it.
  useEffect(() => {
    if (!musicSetVolume) return undefined;
    musicSetVolume(gameOver ? 0.3 : 0.15);
    return () => musicSetVolume(0.3);
  }, [gameOver, musicSetVolume]);

  // App-wide synthesized sound effects + the global SFX mute (shared via
  // SoundContext, so the header mute toggle here persists on every other screen).
  // While muted every method is a no-op. The header speaker button flips `muted`.
  const { sound, muted, setMuted } = useSound();

  // onShake is recreated each App render; hold it in a ref so the sound/feedback
  // effects below can call it without listing it as a dep (which would re-fire
  // them on every parent render).
  const onShakeRef = useRef(onShake);
  onShakeRef.current = onShake;

  const isMyTurn = !!gameState && gameState.currentPlayerId === myId;
  const inputEnabled = isMyTurn && !gameOver && !showCountdown;

  // Drop focus into the input the moment the turn swings to us, so the
  // player can just start typing without clicking first.
  useEffect(() => {
    if (inputEnabled && inputRef.current) {
      inputRef.current.focus();
    }
  }, [inputEnabled]);

  // Whenever it stops being our turn (we submitted, timed out, or the turn moved
  // on), drop any leftover draft and broadcast an empty string so other players'
  // view of "what we're typing" resets. Also clears stale text at turn start.
  useEffect(() => {
    if (!isMyTurn) {
      setDraft('');
      if (onTypingUpdate) onTypingUpdate('');
    }
    // onTypingUpdate is intentionally omitted - it's a fresh closure each render
    // and we only want this to fire on the turn transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMyTurn]);

  // Hype popup + screen shake (accepted) and input shake (rejected). Called
  // before the category early-return so the hooks always run in the same order.
  const { hypeKey, shake, inputShake } = useHypeFeedback(lastWordResult);

  // ---- Heart-shatter + elimination detection (Word Bomb only) ----
  // Each turn_update carries fresh lives/eliminated for every player. We diff
  // against the previous snapshot so we can fire one-shot animations exactly
  // on the transition: a heart that was just lost shatters, and a player who
  // just went out tilts away. Hooks live before the category early-return so
  // the hook order stays stable across renders.
  const prevPlayersRef = useRef({});
  // playerId -> true while the just-lost heart is mid-shatter (cleared after 500ms).
  const [shatteredHearts, setShatteredHearts] = useState({});
  // playerId -> true once eliminated; stays set so the card holds its final
  // tilted/dimmed state (the animation is forwards and never replays).
  const [eliminatingPlayers, setEliminatingPlayers] = useState({});
  // Bumped each time a life is lost (timeout/skip) to re-key + replay the
  // full-screen explosion.
  const [explosionKey, setExplosionKey] = useState(0);
  // The bomb-pass throw: direction ('left' | 'right') the bomb lunges when the
  // turn hands off, cleared when that 300ms animation ends.
  const [passDir, setPassDir] = useState(null);
  const prevCurrentRef = useRef(null);
  // ---- Bomb hand-off FLIGHT (Word Bomb) ----
  // The centrepiece bomb stays put; on a turn change we whip a small bomb GHOST
  // from the PREVIOUS active player's card to the NEW one so the pass is
  // trackable ("it's now YOUR turn"). Card positions are read live from the DOM
  // via cardRefs (a Map keyed by player id) at hand-off time - no layout changes.
  const cardRefs = useRef(new Map());
  const [flight, setFlight] = useState(null); // { key, x, y, dx, dy } | null
  const flightKeyRef = useRef(0);
  const flightTimerRef = useRef(null);
  useEffect(() => () => clearTimeout(flightTimerRef.current), []);

  // ---- Cinematic feel: hitlag / impact frame / K.O. ----
  // hitlag freezes every on-stage animation for a beat (impact weight); impactKey
  // re-keys the one-frame white flash before an explosion; koKey re-keys the K.O.
  // slam overlay when someone is eliminated.
  const [hitlag, setHitlag] = useState(false);
  const [impactKey, setImpactKey] = useState(0);
  const [koKey, setKoKey] = useState(0);
  const hitlagTimerRef = useRef(null);
  // Freeze the stage for `ms` (a new freeze supersedes any in-flight one).
  function freeze(ms) {
    if (hitlagTimerRef.current) clearTimeout(hitlagTimerRef.current);
    setHitlag(true);
    hitlagTimerRef.current = setTimeout(() => {
      setHitlag(false);
      hitlagTimerRef.current = null;
    }, ms);
  }

  // Transient bomb mascot pose flash: 'celebrate' (a correct word, 300ms) or
  // 'taunt' (an opponent times out, 1s), auto-cleared back to the tension-driven
  // base pose (idle, or panic when time is dire).
  const [bombFlash, setBombFlash] = useState(null);
  const bombFlashTimerRef = useRef(null);
  function flashBombPose(name, ms) {
    if (bombFlashTimerRef.current) clearTimeout(bombFlashTimerRef.current);
    setBombFlash(name);
    bombFlashTimerRef.current = setTimeout(() => {
      setBombFlash(null);
      bombFlashTimerRef.current = null;
    }, ms);
  }

  // ---- Submit interaction (word flies at the bomb; bomb reacts) ----
  // flyKey/flyText drive the word thrown toward the bomb on each submit;
  // shatterKey/shatterText drive the rejected word bouncing back and shattering;
  // bombReaction is the one-shot 'recoil' (accepted) / 'reject' class on the bomb;
  // clutchFlag swaps the hype popup for CLUTCH! when the accept beat the buzzer.
  const [flyKey, setFlyKey] = useState(0);
  const [flyText, setFlyText] = useState('');
  const [shatterKey, setShatterKey] = useState(0);
  const [shatterText, setShatterText] = useState('');
  const [bombReaction, setBombReaction] = useState(null);
  const [clutchFlag, setClutchFlag] = useState(false);
  // A buzzer-beater accept also fires a triumphant slow-mo beat + colour-pop
  // (clutchSlow drives both, auto-cleared after the ~700ms beat), and every
  // accepted word gives the prompt box a quick scale-punch (comboPunch re-keys
  // it so the pop replays).
  const [clutchSlow, setClutchSlow] = useState(false);
  const clutchSlowTimerRef = useRef(null);
  const [comboPunch, setComboPunch] = useState(0);
  // The timer reading + word captured at the moment of submit, so the result
  // handler can judge "clutch" (final second left) and shatter the exact word
  // even after the input has cleared / the turn has moved on.
  const submitTimerRef = useRef(0);
  const lastSubmitWordRef = useRef('');
  const interactionResultRef = useRef(null);

  // ---- Personal combo/streak (Word Bomb) - CLIENT-SIDE HYPE ONLY ----
  // Counts the local player's consecutive accepted words. comboAwaitRef gates it
  // to OUR OWN result: it's set when WE submit (only possible on our turn), so a
  // broadcast accept from another player never bumps our streak. Word Bomb is
  // turn-based, so at most one of our results is in flight at a time. Reads only
  // existing accept/reject + life-loss events; no scoring/server/WS involvement.
  const streak = useCombo();
  const comboAwaitRef = useRef(false);
  // Near-miss / clutch callout (presentational): set from the EXISTING remaining
  // time captured at submit when our own accept lands late. { key, seconds, tier }.
  const [clutchCall, setClutchCall] = useState(null);
  const clutchCallKeyRef = useRef(0);
  // Reset the streak on a fresh game (gameNonce bumps per game_started) and when
  // the game ends, so it never carries across games.
  useEffect(() => {
    streak.reset();
    comboAwaitRef.current = false;
    // streak.reset is stable; only re-run on a new-game / game-over transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameNonce, gameOver]);

  // React to each accept/reject with the physical bomb interaction. Keyed off
  // the result object identity (a fresh object per submission) so it fires once.
  useEffect(() => {
    if (gameType !== 'word-bomb') return;
    if (!lastWordResult || lastWordResult === interactionResultRef.current) return;
    interactionResultRef.current = lastWordResult;
    if (lastWordResult.accepted) {
      setBombReaction('recoil');
      freeze(50); // hitlag: 50ms freeze so the success lands with weight
      flashBombPose('celebrate', 300); // the bomb mascot celebrates the word
      setComboPunch((k) => k + 1); // scale-punch the prompt on every correct word
      // Was this OUR submission? (gates both the streak and the near-miss callout
      // so a broadcast accept from another player never fires our feedback.)
      const mine = comboAwaitRef.current;
      if (mine) {
        comboAwaitRef.current = false;
        streak.hit();
      }
      const t = submitTimerRef.current; // the EXISTING clock value, snapshot at submit
      const isClutch = t > 0 && t <= 1; // beat the buzzer in the final second
      setClutchFlag(isClutch);
      if (isClutch) {
        // Triumphant slow-mo beat + colour-pop, snapping back after ~700ms.
        if (clutchSlowTimerRef.current) clearTimeout(clutchSlowTimerRef.current);
        setClutchSlow(true);
        clutchSlowTimerRef.current = setTimeout(() => {
          setClutchSlow(false);
          clutchSlowTimerRef.current = null;
        }, 700);
      }
      // Near-miss callout: surface how close it was (our own late accepts only).
      if (mine) {
        const tier = clutchTier(t);
        if (tier) {
          clutchCallKeyRef.current += 1;
          setClutchCall({ key: clutchCallKeyRef.current, seconds: t, tier });
          if (tier === 'clutch') sound.clutchPing(); // light accent, top tier only
        }
      }
    } else {
      setBombReaction('reject');
      setClutchFlag(false);
      setShatterText(lastSubmitWordRef.current);
      setShatterKey((k) => k + 1);
      // Our own rejected word breaks the streak (rejections are sent only to the
      // submitter, so this is always ours).
      if (comboAwaitRef.current) {
        comboAwaitRef.current = false;
        streak.miss();
      }
    }
  }, [lastWordResult, gameType]);

  useEffect(() => {
    if (!gameState || gameType !== 'word-bomb') return;
    const players = gameState.players || [];
    const prev = prevPlayersRef.current;

    const shatterIds = [];
    const eliminateIds = [];
    players.forEach((p) => {
      const before = prev[p.id];
      if (!before) return; // first sighting - nothing to transition from
      if (typeof p.lives === 'number' && p.lives < before.lives) {
        shatterIds.push(p.id);
      }
      const nowEliminated = p.eliminated || p.lives <= 0;
      if (!before.eliminated && nowEliminated) {
        eliminateIds.push(p.id);
      }
    });

    // Snapshot the current state for the next diff.
    prevPlayersRef.current = Object.fromEntries(
      players.map((p) => [
        p.id,
        { lives: p.lives, eliminated: p.eliminated || p.lives <= 0 },
      ])
    );

    // Our own life lost (a timeout or a skip - rejections don't cost a life)
    // breaks our personal streak.
    if (shatterIds.includes(myId)) streak.miss();

    if (eliminateIds.length) {
      setEliminatingPlayers((cur) => {
        const next = { ...cur };
        eliminateIds.forEach((id) => {
          next[id] = true;
        });
        return next;
      });
    }

    if (!shatterIds.length && !eliminateIds.length) return;

    const timers = [];

    if (shatterIds.length) {
      // Cinematic detonation sequence:
      //   t=0    one-frame white IMPACT flash + a 130ms hitlag FREEZE
      //   t=130  the explosion animation + sound + heavy shake fire (explosionKey)
      // The 130ms freeze-frame gives the hit fighting-game weight before the blast.
      setImpactKey((k) => k + 1);
      freeze(130);
      // If an OPPONENT just lost a life, the bomb mascot taunts them for a beat.
      if (shatterIds.some((id) => id !== myId)) flashBombPose('taunt', 1000);
      timers.push(setTimeout(() => setExplosionKey((k) => k + 1), 130));

      setShatteredHearts((cur) => {
        const next = { ...cur };
        shatterIds.forEach((id) => {
          next[id] = true;
        });
        return next;
      });
      // Heart shatter plays once the freeze releases (~80ms) over ~500ms.
      timers.push(
        setTimeout(() => {
          setShatteredHearts((cur) => {
            const next = { ...cur };
            shatterIds.forEach((id) => {
              delete next[id];
            });
            return next;
          });
        }, 130 + 500)
      );
    }

    if (eliminateIds.length) {
      // K.O. slam comes AFTER the explosion, with its own 400ms freeze leading
      // the slam (timed from the elimination diff, independent of the blast).
      timers.push(
        setTimeout(() => {
          setKoKey((k) => k + 1);
          freeze(400);
        }, 380)
      );
    }

    return () => timers.forEach(clearTimeout);
  }, [gameState, gameType]);

  // ---- Bomb-pass throw (Word Bomb only) ----
  // When the turn hands off to a new player, throw the bomb toward their side
  // of the player bar: left if they sit in the left half, right otherwise.
  useEffect(() => {
    if (!gameState || gameType !== 'word-bomb') return;
    const cur = gameState.currentPlayerId;
    const prev = prevCurrentRef.current;
    if (prev != null && cur != null && cur !== prev) {
      const list = gameState.players || [];
      const idx = list.findIndex((p) => p.id === cur);
      if (idx >= 0 && list.length > 1) {
        const mid = (list.length - 1) / 2;
        setPassDir(idx <= mid ? 'left' : 'right');
      }
      // Whip a bomb ghost from the previous player's card to the new one. Skipped
      // under reduced motion (the turn just changes instantly) and if either card
      // can't be measured (e.g. the previous player was eliminated + removed).
      const reduce =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const fromEl = cardRefs.current.get(prev);
      const toEl = cardRefs.current.get(cur);
      if (!reduce && fromEl && toEl) {
        const a = fromEl.getBoundingClientRect();
        const b = toEl.getBoundingClientRect();
        const x = a.left + a.width / 2;
        const y = a.top + a.height / 2;
        const dx = b.left + b.width / 2 - x;
        const dy = b.top + b.height / 2 - y;
        setFlight({ key: ++flightKeyRef.current, x, y, dx, dy });
        sound.whoosh(); // reuse the existing throw swoosh
        if (flightTimerRef.current) clearTimeout(flightTimerRef.current);
        flightTimerRef.current = setTimeout(() => setFlight(null), 560);
      }
    }
    prevCurrentRef.current = cur;
    // sound is stable (apiRef); react to turn changes only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, gameType]);

  // ---- Sound effects (Word Bomb only) ----

  // Per-second tick. Fire only on a real countdown decrement (so the turn-start
  // reset back up to max, and the pre-game 3-2-1, stay silent), with urgency
  // scaled by how little time is left so the tick rises in pitch as it gets
  // tense. The bomb/timer is shared, so this plays for every player's view.
  const prevTimerRef = useRef(null);
  useEffect(() => {
    if (gameType !== 'word-bomb') return;
    const prev = prevTimerRef.current;
    prevTimerRef.current = timerSeconds;
    if (showCountdown || gameOver) return;
    if (prev == null || typeof timerSeconds !== 'number') return;
    if (timerSeconds <= 0 || timerSeconds >= prev) return; // only on a tick-down
    const maxTimer = (gameState && gameState.timerSeconds) || 1;
    sound.tick(1 - timerSeconds / maxTimer);
  }, [timerSeconds, showCountdown, gameOver, gameType, gameState, sound]);

  // Accelerating heartbeat thud through the final 5 seconds of the SHARED bomb
  // timer (everyone feels the clutch, like the tick). A self-scheduling loop
  // whose period shrinks - and whose hits get louder - as the seconds drop, so
  // the pulse pounds faster the closer the fuse gets to zero. The effect re-runs
  // each second (timerSeconds changes), restarting the loop at the tighter
  // cadence; it tears down the instant the clutch ends (turn reset / 0 / over).
  useEffect(() => {
    if (gameType !== 'word-bomb') return undefined;
    if (showCountdown || gameOver) return undefined;
    if (typeof timerSeconds !== 'number' || timerSeconds < 1 || timerSeconds > 5) {
      return undefined;
    }
    // Period (ms) between thuds at each remaining second: ~1.5/s -> ~4/s.
    const HEARTBEAT_MS = { 5: 650, 4: 520, 3: 410, 2: 320, 1: 250 };
    const period = HEARTBEAT_MS[timerSeconds] ?? 600;
    const intensity = (6 - timerSeconds) / 5; // 5s -> 0.2, 1s -> 1.0
    let timeoutId;
    const beat = () => {
      sound.heartbeat(intensity);
      timeoutId = setTimeout(beat, period);
    };
    beat(); // thud immediately on entering each second, aligned to the tick
    return () => clearTimeout(timeoutId);
  }, [timerSeconds, showCountdown, gameOver, gameType, sound]);

  // Accepted -> rising chime; rejected -> low buzz. Keyed off the result object
  // identity (a fresh object per submission, cleared to null between) so it
  // plays once per result and never on the clear.
  const prevResultRef = useRef(null);
  useEffect(() => {
    if (gameType !== 'word-bomb') return;
    if (!lastWordResult || lastWordResult === prevResultRef.current) return;
    prevResultRef.current = lastWordResult;
    if (lastWordResult.accepted) {
      sound.correctDing();
      vibrate(50); // short buzz on a good word
    } else {
      sound.wrongBuzz();
      vibrate([50, 30, 50]); // double buzz on a miss
    }
  }, [lastWordResult, gameType, sound]);

  // Life lost -> explosion, in lockstep with the visual detonation (explosionKey
  // is bumped by the heart-shatter diff above). Also a heavy screen shake + a
  // long haptic buzz.
  useEffect(() => {
    if (gameType !== 'word-bomb') return;
    if (explosionKey > 0) {
      sound.explosion();
      onShakeRef.current?.('heavy');
      vibrate(200);
    }
  }, [explosionKey, gameType, sound]);

  // KO slam -> a heavy, final elimination sound, in lockstep with the K.O.
  // overlay (koKey is bumped when a player is knocked out). A heavy screen shake
  // is timed to the slam's downward impact (the overlay leads with a ~400ms freeze
  // before "K.O." drops) so the knockout lands as an event, not a state change.
  useEffect(() => {
    if (gameType !== 'word-bomb') return;
    if (koKey > 0) {
      sound.ko();
      const id = setTimeout(() => onShakeRef.current?.('heavy'), 600);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [koKey, gameType, sound]);

  // Game over -> a win fanfare or a defeat sting, once, when the result lands.
  // Gated to Word Bomb (Category Blitz renders its own screen and stays silent).
  useEffect(() => {
    if (gameType !== 'word-bomb' || !gameOver) return;
    const won = gameOver.winnerId === myId;
    if (won) sound.victory();
    else sound.defeat();
    // Land the end screen with a screen impact - heavier for the loss slam.
    onShakeRef.current?.(won ? 'medium' : 'heavy');
  }, [gameOver, gameType, myId, sound]);

  // Ambient fuse crackle while it's our turn; silence between turns / at game
  // over / during the countdown. Cleanup also stops it on unmount.
  useEffect(() => {
    if (gameType !== 'word-bomb') return undefined;
    if (inputEnabled) sound.startSizzle();
    else sound.stopSizzle();
    return () => sound.stopSizzle();
  }, [inputEnabled, gameType, sound]);

  // Imposter Word is a separate (social-deduction, multi-phase) experience -
  // its own component. Routed after the hooks above (which all no-op for this
  // mode) so the hook order stays stable across game types.
  if (gameType === 'imposter-word') {
    return (
      <ImposterWordScreen
        myId={myId}
        isHost={isHost}
        playerColors={playerColors}
        timerSeconds={timerSeconds}
        lastWordResult={lastWordResult}
        round={imposterRound}
        phase={imposterPhase}
        liveAnswers={imposterAnswers || []}
        myAnswers={myAnswers || []}
        voteData={imposterVoteData}
        voteCount={imposterVoteCount || { voted: 0, total: 0 }}
        myVote={imposterMyVote}
        results={imposterResults}
        final={imposterFinal}
        onSubmitAnswer={onSubmitAnswer}
        onSubmitVote={onSubmitVote}
        onLeave={onLeave}
        onRematch={onRematch}
        onShake={onShake}
      />
    );
  }

  // Category Blitz is a completely different (simultaneous, round-based)
  // experience, so it renders as its own component with its own state rather
  // than threading conditionals through the turn-based Word Bomb layout.
  if (gameType === 'category-blitz') {
    return (
      <CategoryBlitzScreen
        // Remount per game so the solo PLAY AGAIN loop starts clean and replays
        // its countdown (the round number stays 1 across solo games).
        key={`cb-${gameNonce}`}
        myId={myId}
        isHost={isHost}
        timerSeconds={timerSeconds}
        lastWordResult={lastWordResult}
        gameOver={gameOver}
        roomPlayers={roomPlayers || []}
        playerColors={playerColors}
        categoryRound={categoryRound}
        myAnswers={myAnswers || []}
        playerProgress={playerProgress || {}}
        roundResults={roundResults}
        categoryScores={categoryScores}
        categoryTotals={categoryTotals || {}}
        categoryRerolls={categoryRerolls}
        lastReroll={lastReroll}
        onSubmitAnswer={onSubmitAnswer}
        onLeave={onLeave}
        onRematch={onRematch}
        onPlayAgain={onPlayAgain}
        onRerollCategory={onRerollCategory}
      />
    );
  }

  // Until the first turn_update lands there's nothing to render.
  if (!gameState) {
    return (
      <div className="game-wrap">
        <div className="game-loading">STARTING GAME...</div>
      </div>
    );
  }

  const isCategory = gameType === 'category-blitz';

  const players = gameState.players || [];

  // Mode-specific prompt + history. Word Bomb prompts with a letter combo
  // and tracks used words; Category Blitz prompts with a category and
  // tracks used answers. Everything downstream reads these shared locals.
  const combo = (gameState.combo || '').toUpperCase();
  const categoryRaw = gameState.category || '';
  const usedItems = (isCategory ? gameState.usedAnswers : gameState.usedWords) || [];

  const title = isCategory ? 'CATEGORY BLITZ' : 'WORD BOMB';
  const promptLabel = isCategory
    ? 'NAME SOMETHING IN THIS CATEGORY'
    : 'TYPE A WORD CONTAINING';
  const promptValue = isCategory
    ? categoryRaw.toUpperCase() || '—'
    : combo || '—';
  const usedLabel = isCategory ? 'USED ANSWERS' : 'USED WORDS';

  const difficultyLabel = (gameState.difficultyKey || gameState.difficulty || '')
    .toString()
    .toUpperCase();

  // Total hearts to draw per player = the most lives anyone is known to
  // have started with. Pulled defensively from whichever field the server
  // provides so lost hearts still render gray for eliminated players.
  const maxLives = Math.max(
    gameState.maxLives || 0,
    ...players.map((p) => p.maxLives || p.lives || 0),
    1
  );

  // The per-turn starting seconds, used by the bomb to compute its fuse ratio.
  // (Word Bomb has no timer bar - the bomb's fuse is the timer.)
  const maxTimer = gameState.timerSeconds || 1;

  const winner = gameOver ? players.find((p) => p.id === gameOver.winnerId) : null;
  const iWon = !!gameOver && gameOver.winnerId === myId;
  // One random end-game roast blurb, fixed for the duration of this result
  // (re-picked only when a new game_over lands).
  const endBlurb = useMemo(
    () => END_GAME_BLURBS[Math.floor(Math.random() * END_GAME_BLURBS.length)],
    [gameOver]
  );

  // ---- Spectator mode ----
  // A player who's lost all their lives keeps watching (read-only) until the
  // game ends. They get no input, just quick-react buttons.
  const myPlayer = players.find((p) => p.id === myId);
  const isSpectating =
    !!myPlayer && (myPlayer.eliminated || myPlayer.lives <= 0) && !gameOver;
  // How many players are out but still in the room - the live audience.
  const spectatorCount = players.filter((p) => p.eliminated || p.lives <= 0).length;

  // ---- Subliminal intensity cues ----
  // Color temperature: a faint red wash that deepens as players are eliminated,
  // and noticeably warms when only the final two remain. Players FEEL the stakes
  // rise without consciously clocking it.
  const aliveCount = players.filter((p) => !(p.eliminated || p.lives <= 0)).length;
  const warmth = gameOver
    ? 0
    : Math.min(0.12, spectatorCount * 0.02 + (aliveCount > 0 && aliveCount <= 2 ? 0.04 : 0));
  // Heartbeat: when the fuse is in its final third, the whole stage gets a fast,
  // subtle scale pulse (physiological tension on top of the tick speed-up).
  const timeRatio = Math.max(0, Math.min(1, timerSeconds / maxTimer));
  const critical = !showCountdown && !gameOver && timeRatio < 0.3;
  // CONTINUOUS dread (0 calm -> 1 panic), derived purely from the EXISTING
  // timeRatio (no new timer/state). Eased (^1.8) so it stays calm early and ramps
  // hard in the final seconds; published as --danger to drive the screen vignette
  // and the bomb rattle with opacity/transform only. Snaps to 0 the instant a word
  // resets the clock (timeRatio jumps back to ~1) - that's the relief release.
  const danger = showCountdown || gameOver ? 0 : Math.pow(1 - timeRatio, 1.8);

  // The final-5s CLUTCH (shared bomb timer): the absolute last 5 seconds, felt by
  // everyone regardless of whose turn it is. Drives the mascot's panic pose and
  // the accelerating heartbeat; the colour drain layers on top for the active
  // player only.
  const lowTime =
    !showCountdown &&
    !gameOver &&
    typeof timerSeconds === 'number' &&
    timerSeconds >= 1 &&
    timerSeconds <= 5;

  // The bomb mascot's pose: a brief celebrate/taunt flash wins; otherwise it
  // PANICS through the entire final-5s clutch (or any time the fuse is otherwise
  // dire) and is idle the rest of the time. (The bomb is shared, so this is
  // driven by the shared timer tension, not whose turn it is.)
  const bombPose = showCountdown
    ? 'idle'
    : bombFlash || (critical || lowTime ? 'panic' : 'idle');

  // Color drain: in the last 5s of YOUR turn the stage desaturates HARD toward
  // grayscale (tunnel vision) while the bomb + input stay colored (.drain-exempt
  // counters it). Pushed deeper than a gentle wash - by 1s the room is nearly
  // monochrome - so the clutch reads as the colour being sucked out of the world.
  // Snaps back to full colour the instant the turn ends / resets.
  const DRAIN_BY_SEC = { 5: 0.45, 4: 0.28, 3: 0.14, 2: 0.06, 1: 0.02 };
  const draining = lowTime && isMyTurn;
  const drainSat = draining ? DRAIN_BY_SEC[timerSeconds] ?? 1 : 1;
  // Panic sweat on your own card while time is critical and it's your turn.
  const panicking = isMyTurn && !showCountdown && !gameOver && timeRatio < 0.3;

  // Is the active player typing right now? (your live draft, or the relayed
  // typing text of whoever's turn it is) - drives the bomb's "watching" face.
  const currentTyped = isMyTurn ? draft : typingText[gameState.currentPlayerId] || '';
  const someoneTyping = !showCountdown && !gameOver && currentTyped.trim().length > 0;

  function submit() {
    const word = draft.trim();
    if (!word || !inputEnabled) return;
    // Mark that the next result is OURS (we can only submit on our turn), so the
    // combo only counts our own accepts/rejects.
    comboAwaitRef.current = true;
    // Snapshot what we need to react to the (async) result, then throw the word
    // at the bomb so the toss reads before the accept/reject lands.
    submitTimerRef.current = timerSeconds;
    lastSubmitWordRef.current = word;
    setFlyText(word);
    setFlyKey((k) => k + 1);
    onSubmitWord(word);
    setDraft('');
    // Reset other players' view of our typing now that we've fired the word.
    if (onTypingUpdate) onTypingUpdate('');
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      submit();
    }
  }

  return (
    // The first pointer/key interaction here unlocks the AudioContext (browsers
    // block audio until a user gesture). Capture phase so it fires no matter
    // what inner control is touched.
    <div
      className="game-wrap"
      style={{ '--danger': danger.toFixed(3) }}
      onPointerDownCapture={sound.unlock}
      onKeyDownCapture={sound.unlock}
    >
      {/* Continuous DREAD vignette: a static red edge-gradient whose OPACITY rides
          --danger (the eased timer) - calm/clear early, panicking red in the final
          seconds, then snapping back to nothing the instant a word resets the clock
          (the relief release). Opacity + a transform-scale "breathe" only; the
          gradient is painted once, never recomputed per frame. Outside .game-stage
          so its position:fixed isn't trapped by the stage's drain filter. */}
      <div className="wb-danger-vignette" aria-hidden="true" />
      {/* Bomb hand-off ghost: whips from the previous active player's card to the
          new one along an arc (transform-only), with a trailing after-image and a
          landing impact ring. Fixed at viewport coords measured from the cards. */}
      {flight && (
        <div
          key={flight.key}
          className="bomb-flight"
          style={{
            left: `${flight.x}px`,
            top: `${flight.y}px`,
            '--dx': `${flight.dx}px`,
            '--dy': `${flight.dy}px`,
          }}
          aria-hidden="true"
        >
          <span className="bomb-flight-icon">💣</span>
        </div>
      )}
      {/* Color-temperature wash: deepens with eliminations (subliminal). */}
      {warmth > 0 && (
        <div className="game-warmth" style={{ opacity: warmth }} aria-hidden="true" />
      )}
      {/* Anime impact frame: one white frame right before the explosion. */}
      {impactKey > 0 && <div key={impactKey} className="impact-flash" aria-hidden="true" />}
      {/* K.O. slam when a player is eliminated (self-removes). */}
      {koKey > 0 && <KOOverlay key={koKey} />}
      {showCountdown && (
        <CountdownOverlay
          onComplete={() => setShowCountdown(false)}
          onStep={(step) => sound.countdown(step === 'GO!')}
        />
      )}
      {explosionKey > 0 && <ExplosionEffect key={explosionKey} />}

      {/* Persistent banner while you're out but the game's still running. */}
      {isSpectating && (
        <div className="game-spectator-banner">YOU'RE OUT — SPECTATING</div>
      )}

      {/* Floating spectator reactions, visible to everyone in the room. */}
      {reactions.length > 0 && (
        <div className="reaction-layer" aria-hidden="true">
          {reactions.slice(-5).map((r) => (
            <FloatingReaction key={r.id} emoji={r.emoji} name={r.playerName} />
          ))}
        </div>
      )}

      <div
        className={`game-stage${shake && !hitlag ? ' game-shake' : ''}${
          isSpectating ? ' spectating' : ''
        }${critical ? ' heartbeat' : ''}${hitlag ? ' hitlag' : ''}${
          draining ? ' draining' : ''
        }${clutchSlow ? ' clutch-slowmo' : ''}`}
        style={{ '--drain-sat': drainSat, filter: draining ? 'saturate(var(--drain-sat))' : undefined }}
      >
        {/* Buzzer-beater colour-pop: a success-cyan wash under the CLUTCH! slam. */}
        {clutchSlow && <div className="clutch-flash" aria-hidden="true" />}
        {/* CLUTCH! replaces the normal hype word when the accept beat the buzzer.
            Held back until the hitlag freeze releases so the reaction lands after
            the impact, not during it. */}
        {hypeKey > 0 && !hitlag &&
          (clutchFlag ? <ClutchPopup key={hypeKey} /> : <HypePopup key={hypeKey} />)}
        <div className="game-header">
          <div className="game-title">
            <SprayReveal>{title}</SprayReveal>
          </div>
          <div className="game-header-right">
            <div className="game-meta">
              {typeof gameState.round !== 'undefined' && (
                <span className="game-meta-round">ROUND {gameState.round}</span>
              )}
              {difficultyLabel && (
                <span className="game-meta-diff">{difficultyLabel}</span>
              )}
            </div>
            <div className="game-header-actions">
              <button
                className="game-mute-btn"
                onClick={() => {
                  sound.unlock();
                  setMuted((m) => !m);
                }}
                title={muted ? 'Unmute sound' : 'Mute sound'}
                aria-label={muted ? 'Unmute sound' : 'Mute sound'}
              >
                {muted ? '🔇' : '🔊'}
              </button>
              <button className="game-leave-btn" onClick={onLeave}>
                LEAVE
              </button>
            </div>
          </div>
        </div>

        <div className="game-player-bar">
          {players.map((player) => {
            const eliminated = player.eliminated || player.lives <= 0;
            const isCurrent = player.id === gameState.currentPlayerId;
            const isMe = player.id === myId;
            const isEliminating = !!eliminatingPlayers[player.id];
            const justShattered = !!shatteredHearts[player.id];
            // The player's session colour, applied as card accent + name + the
            // typing line + the elimination flash (all via the --pc vars below).
            const pc = resolvePlayerColor(playerColors, player.id);
            const cardClass = [
              'game-player-card',
              isCurrent && !eliminated ? 'current' : '',
              eliminated ? 'eliminated' : '',
              isEliminating ? 'eliminating' : '',
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <div key={player.id} className="game-player-slot">
                {isCurrent && isMe && !gameOver && (
                  <div className="game-your-turn">YOUR TURN</div>
                )}
                <div
                  ref={(el) => {
                    const m = cardRefs.current;
                    if (el) m.set(player.id, el);
                    else m.delete(player.id);
                  }}
                  className={cardClass}
                  style={{ '--pc': pc.color, '--pc-dark': pc.dark }}
                >
                  {isEliminating && <div className="game-player-flash" />}
                  {/* Panic sweat flinging off your own card when time is dire. */}
                  {isCurrent && isMe && !eliminated && panicking && <SweatDrops />}
                  <div className="game-player-name">
                    <PlayerDot color={pc.color} dark={pc.dark} tier={pc.tier} />
                    <span className="game-player-name-text">{player.name}</span>
                    {isMe && <span className="game-player-you">YOU</span>}
                  </div>
                  {/* Live typing (BombParty style): only under the active
                      player's card. For us it mirrors our own draft (the server
                      doesn't echo our keystrokes back); for others it's the
                      relayed typing_update text. Empty -> a dimmed "..." so the
                      card keeps a stable height instead of jumping. */}
                  {isCurrent && !eliminated && !gameOver && (
                    <div className="player-typing">
                      {(() => {
                        const typed = isMe ? draft : typingText[player.id] || '';
                        return typed ? (
                          <span className="player-typing-text">
                            {typed.toUpperCase()}
                            <span className="typing-cursor">|</span>
                          </span>
                        ) : (
                          <span className="player-typing-empty">...</span>
                        );
                      })()}
                    </div>
                  )}
                  <div className="game-player-hearts">
                    {Array.from({ length: maxLives }).map((_, i) => (
                      <Heart
                        key={i}
                        filled={i < player.lives}
                        // The just-lost heart is the first empty slot (index ===
                        // remaining lives); shatter only that one.
                        shatter={justShattered && i === player.lives}
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {spectatorCount > 0 && (
          <div className="game-spectator-count">
            👁 {spectatorCount} SPECTATING
          </div>
        )}

        <div className="bomb-area drain-exempt">
          {/* Continuous danger rattle: the bomb physically vibrates harder as
              --danger climbs (amplitude scales from 0 at calm), on its OWN wrapper
              so it composes with the pass-throw / reactor / tension animations
              instead of fighting them. Transform-only; zero movement at rest. */}
          <div className="bomb-rattle">
          <div
            className={`bomb-passer${passDir ? ` pass-${passDir}` : ''}`}
            onAnimationEnd={(e) => {
              // Only clear on the pass animation itself, not bubbled child
              // (tension/flame) animations.
              if (e.target === e.currentTarget) setPassDir(null);
            }}
          >
            {/* The reactor adds the one-shot recoil (accepted) / reject shake +
                red flash when a word hits the bomb, on top of the pass throw. */}
            <div
              className={`bomb-reactor${bombReaction ? ` ${bombReaction}` : ''}`}
              onAnimationEnd={(e) => {
                if (e.target === e.currentTarget) setBombReaction(null);
              }}
            >
              <BombVisual
                timerSeconds={timerSeconds}
                maxTimer={maxTimer}
                showCountdown={showCountdown}
                pose={bombPose}
              />
              {bombReaction === 'reject' && <div className="bomb-reject-flash" />}
              {bombReaction === 'recoil' && (
                <div className="bomb-spark-burst">
                  {[0, 1, 2, 3].map((i) => (
                    <span key={i} className={`burst-spark s${i}`} />
                  ))}
                </div>
              )}
            </div>
          </div>
          </div>

          {/* Word thrown at the bomb on submit, and the rejected word shattering
              back. Both are absolutely positioned over the bomb area. */}
          {flyKey > 0 && <FlyingWord key={flyKey} text={flyText} />}
          {shatterKey > 0 && <ShatterWord key={shatterKey} text={shatterText} />}
        </div>

        <div
          key={comboPunch}
          className={`game-combo-box${comboPunch > 0 ? ' punch' : ''}`}
        >
          <div className="game-combo-label">{promptLabel}</div>
          <div className={`game-combo${isCategory ? ' category' : ''}`}>
            {promptValue}
          </div>
        </div>

        <div className="game-used">
          <div className="game-used-label">
            {usedLabel} ({usedItems.length})
          </div>
          <div className="game-used-list">
            {usedItems.length === 0 ? (
              <span className="game-used-empty">NONE YET — BE THE FIRST</span>
            ) : (
              usedItems.map((item, i) => (
                <span key={`${item}-${i}`} className="game-used-chip">
                  {item.toUpperCase()}
                </span>
              ))
            )}
          </div>
        </div>

        {isSpectating ? (
          /* Spectators get quick-react buttons where the input used to be. */
          <div className="spectator-reactions">
            {['💀', '🔥', '😂', '👏'].map((emoji) => (
              <button
                key={emoji}
                className="spectator-react-btn"
                onClick={() => onSpectatorReaction && onSpectatorReaction(emoji)}
                aria-label={`React with ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        ) : (
          <div className="game-input-row drain-exempt">
            {/* Personal hype streak, floats above the input (pointer-events:none). */}
            <ComboMeter count={streak.count} brk={streak.brk} />
            {/* Near-miss callout for a late accept (also pointer-events:none). */}
            {clutchCall && (
              <ClutchCallout
                key={clutchCall.key}
                seconds={clutchCall.seconds}
                tier={clutchCall.tier}
              />
            )}
            <input
              ref={inputRef}
              className={`game-input${inputShake ? ' input-shake' : ''}${
                typingActive ? ' typing-active' : ''
              }`}
              type="text"
              value={draft}
              onChange={(event) => {
                const value = event.target.value;
                // Soft key tick on actual character entry (a char was added, not
                // a deletion/select). onChange already ignores modifiers/arrows.
                if (value.length > draft.length) sound.keystroke();
                setDraft(value);
                pulseInput(); // tiny per-keystroke visual response
                // Broadcast every keystroke so others see us type in real time.
                // No debounce - the frantic typing/deleting is the fun part.
                if (onTypingUpdate) onTypingUpdate(value);
              }}
              onKeyDown={handleKeyDown}
              disabled={!inputEnabled}
              aria-label={combo ? `Type a word containing ${combo}` : 'Type a word'}
              placeholder={
                inputEnabled
                  ? isCategory
                    ? `Name something in "${categoryRaw}"...`
                    : `Type a word with "${combo}"...`
                  : gameOver
                  ? 'GAME OVER'
                  : 'WAIT YOUR TURN...'
              }
              maxLength={32}
              autoComplete="off"
              spellCheck="false"
            />
            <button
              className="game-send-btn"
              onClick={submit}
              disabled={!inputEnabled}
            >
              SEND
            </button>
            {inputEnabled && (
              <button
                className="game-skip-btn"
                onClick={() => {
                  sound.click();
                  sound.skip(); // descending "whomp" before the turn deflates
                  onSkipTurn();
                }}
                title="Skip your turn — costs you a life"
              >
                SKIP
                <span className="game-skip-cost">-1 LIFE</span>
              </button>
            )}
            {hypeKey > 0 && !hitlag && <FloatingScore key={hypeKey} />}
          </div>
        )}

        {lastWordResult && (
          <div
            className={`game-toast ${
              lastWordResult.accepted ? 'accepted' : 'rejected'
            }`}
          >
            {lastWordResult.accepted
              ? `NICE! "${(lastWordResult.word || '').toUpperCase()}" ACCEPTED`
              : rejectionMessage(lastWordResult.reason, { combo, isCategory })}
          </div>
        )}
      </div>

      <KillFeed events={feedEvents} playerColors={playerColors} />

      {gameOver && (
        <div className="game-over-overlay">
          {/* WIN: confetti rain + a flat starburst behind the card.
              LOSS: a white screen-flash + a flat spike-burst & shockwave rings,
              all framing the slammed-in ELIMINATED card. */}
          {iWon && <ConfettiEffect />}
          {iWon && <WinBurst />}
          {!iWon && <div className="go-slam-flash" />}
          {!iWon && <LossImpact />}
          <div className={`game-over-card ${iWon ? 'go-card-win' : 'go-card-loss'}`}>
            {/* The mascot's emotional reaction, large and centred above the title.
                The wrapper owns a dedicated transform (celebrate hop / defeat
                tremble) so it never fights the mascot's own internal layers. */}
            <div className={`go-mascot-wrap ${iWon ? 'win' : 'loss'}`}>
              <Mascot
                pose={iWon ? 'celebrate' : 'panic'}
                emote={iWon ? 'celebrate' : 'slump'}
                size={150}
                className="game-over-mascot"
              />
            </div>
            {iWon ? (
              <div className="game-over-title win winner-bounce">YOU WIN!</div>
            ) : (
              <div className="game-over-title eliminated">ELIMINATED</div>
            )}
            {!iWon && (
              <div className="game-over-winner">
                {winner ? `${winner.name.toUpperCase()} WINS` : 'NO WINNER'}
              </div>
            )}
            {/* A random FNF-voice roast blurb under the result. */}
            <div className="game-over-blurb">{endBlurb}</div>
            <GameOverStats
              gameStats={gameStats}
              players={players}
              winner={winner}
              playerColors={playerColors}
            />
            <div className="game-over-actions">
              {isHost && (
                <button className="game-over-rematch" onClick={onRematch}>
                  REMATCH
                </button>
              )}
              <button
                className={`game-over-leave${isHost ? ' secondary' : ''}`}
                onClick={onLeave}
              >
                LEAVE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Solo Category Blitz results, shown at game over after the 3 rounds. Mounts
 * once, and on that single mount it reads the old overall personal best (best
 * TOTAL across a full 3-round game), decides whether this run beat it, and - if
 * so - writes the new record. Doing that in a useState initializer guarantees it
 * happens exactly once, so a re-render can't see the freshly-saved value and
 * wrongly conclude the record wasn't beaten.
 *
 *   - YOUR SCORE (the 3-round total) counts up dramatically.
 *   - A NEW RECORD! celebration (yellow pop + confetti + celebrating mascot)
 *     fires when the old best is beaten; otherwise a "X away" nudge shows how
 *     close they came.
 *   - A per-round breakdown lists each round's category + score.
 *   - PLAY AGAIN starts a fresh 3-round game (no room detour); NEW GAME MODE
 *     drops back to the room to pick a different mode/difficulty; LEAVE exits.
 */
function SoloResultsScreen({ score, rounds, onPlayAgain, onNewGameMode, onLeave }) {
  // Resolve the personal best exactly once, on mount, and bank the new record
  // if it was beaten. Everything the render needs is frozen here.
  const [pb] = useState(() => {
    const previousBest = loadPersonalBest(SOLO_PB_KEY); // number | null
    const hadRecord = previousBest != null;
    const baseline = hadRecord ? previousBest : 0;
    const isNewRecord = score > baseline;
    if (isNewRecord) savePersonalBest(SOLO_PB_KEY, score);
    return {
      hadRecord,
      // The headline best to show: the new score if it's a record, else the old.
      best: isNewRecord ? score : baseline,
      isNewRecord,
      // How far short we fell (only meaningful when we didn't beat it).
      away: baseline - score,
    };
  });

  return (
    <div className="game-wrap">
      {pb.isNewRecord && <ConfettiEffect />}
      <div className="game-over-overlay">
        <div className="game-over-card solo-results-card">
          <Mascot
            pose={pb.isNewRecord ? 'celebrate' : 'idle'}
            emote={pb.isNewRecord ? 'celebrate' : null}
            size={130}
            className="game-over-mascot"
          />

          {pb.isNewRecord && <div className="solo-new-record">NEW RECORD!</div>}

          <div className="solo-score-label">YOUR SCORE</div>
          <div className="solo-score-value">
            <CountUp to={score} duration={900} />
          </div>

          <div className="solo-category">CATEGORY BLITZ · 3 ROUNDS</div>

          {/* Personal-best line + how-close nudge. */}
          <div className="solo-pb-line">
            {pb.isNewRecord
              ? pb.hadRecord
                ? 'YOU BEAT YOUR PERSONAL BEST!'
                : 'YOUR FIRST RECORD!'
              : `PERSONAL BEST: ${pb.best}`}
          </div>
          {!pb.isNewRecord && pb.hadRecord && (
            <div className="solo-away">
              {pb.away <= 0
                ? 'YOU TIED YOUR BEST!'
                : `${pb.away} AWAY FROM YOUR BEST!`}
            </div>
          )}

          {/* Per-round breakdown: category + that round's score. */}
          <div className="cb-section-label solo-answers-label">ROUND BREAKDOWN</div>
          <div className="solo-rounds-list">
            {rounds.length === 0 ? (
              <span className="game-used-empty">NO ROUNDS PLAYED</span>
            ) : (
              rounds.map((r) => (
                <div key={r.round} className="solo-round-row">
                  <span className="solo-round-cat">{(r.category || '').toUpperCase()}</span>
                  <span className="solo-round-score">+{r.roundScore}</span>
                </div>
              ))
            )}
          </div>

          <div className="game-over-actions">
            <button className="solo-play-again-btn" onClick={onPlayAgain}>
              PLAY AGAIN
            </button>
            <button className="solo-change-cat-btn" onClick={onNewGameMode}>
              NEW GAME MODE
            </button>
            <button className="game-over-leave secondary" onClick={onLeave}>
              LEAVE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The Category Blitz play screen - a simultaneous, round-based mode with a
 * layout entirely separate from Word Bomb. It has three faces, chosen by the
 * incoming server state:
 *
 *   - GAME OVER (gameOver set): final scoreboard, winner highlighted.
 *   - DURING A ROUND (categoryRound set): the category, a draining timer, an
 *     always-on input, your own growing answer list, and a privacy-safe count
 *     of how many answers each opponent has.
 *   - BETWEEN ROUNDS (roundResults set, no active round): everyone's answers
 *     revealed with per-round and cumulative scores, plus a 5s countdown note.
 */
function CategoryBlitzScreen({
  myId,
  isHost,
  timerSeconds,
  lastWordResult,
  gameOver,
  roomPlayers,
  playerColors = {},
  categoryRound,
  myAnswers,
  playerProgress,
  roundResults,
  categoryScores,
  categoryTotals,
  categoryRerolls,
  lastReroll,
  onSubmitAnswer,
  onLeave,
  onRematch,
  onPlayAgain,
  onRerollCategory,
}) {
  const { sound } = useSound();
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);
  // Countdown replays at the start of every NEW round (and the first one).
  const [showCountdown, setShowCountdown] = useState(false);
  const prevRoundRef = useRef(null);

  // Personal combo/streak (Category Blitz) - CLIENT-SIDE HYPE ONLY. CB answer
  // results are sent only to the submitter (opponents see counts, not words), so
  // lastWordResult here is always OURS - no turn gating needed. Resets each round.
  const streak = useCombo();
  // Near-miss / clutch callout: snapshot the EXISTING round-timer value at submit
  // (cbSubmitTimerRef) and surface how close a late accepted answer was.
  const cbSubmitTimerRef = useRef(0);
  const [clutchCall, setClutchCall] = useState(null);
  const clutchCallKeyRef = useRef(0);
  // Per-letter submit feedback (CB has no bomb to throw the word at): the last
  // submitted answer text + whether it was accepted, re-keyed so SubmitLetters
  // replays. The text prefers the result's own answer, falling back to what we
  // captured at submit.
  const cbSubmitWordRef = useRef('');
  const [cbSubmitLetters, setCbSubmitLetters] = useState(null);
  const cbSubmitLettersKeyRef = useRef(0);

  // Solo mode: a lone player racing the clock. Auto-detected from the roster
  // size (the backend gates the same way). It plays the same 3 rounds as
  // multiplayer, but ends on a personal-best results screen.
  const isSolo = (roomPlayers || []).length === 1;

  const roundActive = !!categoryRound && !gameOver;
  const roundNumber = categoryRound && categoryRound.round;

  // Solo run log: each completed round's category + score, so the solo results
  // screen can show a per-round breakdown. The component stays mounted for the
  // whole 3-round game (it's remounted per game via gameNonce), so a ref
  // persists cleanly; key off the round number to log each round exactly once.
  const soloLogRef = useRef([]);
  const soloLoggedRoundRef = useRef(0);
  useEffect(() => {
    if (!isSolo || !roundResults) return;
    if (roundResults.round === soloLoggedRoundRef.current) return; // already logged
    soloLoggedRoundRef.current = roundResults.round;
    const mine = (roundResults.playerResults || []).find((r) => r.id === myId);
    soloLogRef.current = [
      ...soloLogRef.current,
      {
        round: roundResults.round,
        category: roundResults.category,
        roundScore: mine ? mine.roundScore : 0,
      },
    ];
  }, [roundResults, isSolo, myId]);

  // Reroll notice (multiplayer): when the HOST rerolls the category, non-host
  // players get a brief banner. The player who rerolled (host / solo) gets none.
  const [rerollNotice, setRerollNotice] = useState(null);
  const rerollNoticeTimerRef = useRef(null);
  useEffect(() => {
    if (!lastReroll || lastReroll.byId === myId) return;
    setRerollNotice(lastReroll.by || 'HOST');
    if (rerollNoticeTimerRef.current) clearTimeout(rerollNoticeTimerRef.current);
    rerollNoticeTimerRef.current = setTimeout(() => setRerollNotice(null), 2600);
  }, [lastReroll, myId]);
  useEffect(() => () => clearTimeout(rerollNoticeTimerRef.current), []);

  // Trigger the countdown whenever the round number changes (covers the first
  // round on mount and every subsequent round). A new round also resets the
  // personal streak (combos don't carry across rounds).
  useEffect(() => {
    if (roundNumber != null && roundNumber !== prevRoundRef.current) {
      prevRoundRef.current = roundNumber;
      setShowCountdown(true);
      streak.reset();
    }
    // streak.reset is stable; we only react to the round number changing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundNumber]);

  // Auto-focus the input once a round is active AND its countdown has
  // finished - no turn-taking here, so the player can fire answers freely.
  useEffect(() => {
    if (roundActive && !showCountdown && inputRef.current) {
      inputRef.current.focus();
    }
  }, [roundActive, showCountdown, roundNumber]);

  // Hype popup + screen shake on an accepted answer. (The rejected-answer
  // input-shake from this hook is intentionally unused in CB now - the per-letter
  // SubmitLetters 'reject' scatter IS the miss reaction, so there's only one.)
  const { hypeKey, shake } = useHypeFeedback(lastWordResult);

  function submit() {
    const answer = draft.trim();
    if (!answer || !roundActive || showCountdown) return;
    cbSubmitTimerRef.current = timerSeconds; // snapshot the round clock at submit
    cbSubmitWordRef.current = answer; // capture for the per-letter feedback
    onSubmitAnswer(answer);
    setDraft('');
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      submit();
    }
  }

  // ---- Reactive mascot (Category Blitz) ----
  // Accepted answer -> celebrate 1s, rejected -> panic 1s; between rounds / at
  // game over it celebrates if you're leading/won, panics otherwise; else idle.
  const [cbTransient, setCbTransient] = useState(null);
  const cbTimerRef = useRef(null);
  const cbPrevResultRef = useRef(null);
  useEffect(() => {
    if (!lastWordResult || lastWordResult === cbPrevResultRef.current) return;
    cbPrevResultRef.current = lastWordResult;
    if (cbTimerRef.current) clearTimeout(cbTimerRef.current);
    setCbTransient(lastWordResult.accepted ? 'celebrate' : 'panic');
    cbTimerRef.current = setTimeout(() => setCbTransient(null), 1000);
    // Audio parity with Word Bomb: per-answer accept ding / reject buzz.
    if (lastWordResult.accepted) sound.correctDing();
    else sound.wrongBuzz();
    // Personal streak: a correct answer extends it, a rejected one breaks it.
    if (lastWordResult.accepted) {
      streak.hit();
      // Near-miss callout from the round-timer value snapshot at submit.
      const tier = clutchTier(cbSubmitTimerRef.current);
      if (tier) {
        clutchCallKeyRef.current += 1;
        setClutchCall({ key: clutchCallKeyRef.current, seconds: cbSubmitTimerRef.current, tier });
        if (tier === 'clutch') sound.clutchPing(); // light accent, top tier only
      }
    } else {
      streak.miss();
    }
    // Per-letter physics on the submitted answer (accept pop / reject scatter).
    // This reject scatter REPLACES CB's input-shake (see the input below).
    cbSubmitLettersKeyRef.current += 1;
    setCbSubmitLetters({
      key: cbSubmitLettersKeyRef.current,
      text: lastWordResult.answer || cbSubmitWordRef.current,
      mode: lastWordResult.accepted ? 'accept' : 'reject',
    });
  }, [lastWordResult, sound]);
  useEffect(() => () => clearTimeout(cbTimerRef.current), []);

  // ---- Category Blitz audio parity (timer + outcome) ----
  // Per-second round-timer tick, urgency-pitched, on a real decrement only (so
  // the per-round reset back to full and the 3-2-1 countdown stay silent).
  const cbPrevTimerRef = useRef(null);
  useEffect(() => {
    const prev = cbPrevTimerRef.current;
    cbPrevTimerRef.current = timerSeconds;
    if (!roundActive || showCountdown) return;
    if (prev == null || typeof timerSeconds !== 'number') return;
    if (timerSeconds <= 0 || timerSeconds >= prev) return; // only on a tick-down
    const maxTimer = (categoryRound && categoryRound.timerSeconds) || 1;
    sound.tick(1 - timerSeconds / maxTimer);
  }, [timerSeconds, roundActive, showCountdown, categoryRound, sound]);

  // Final-5s accelerating heartbeat thud, mirroring Word Bomb's clutch pulse.
  useEffect(() => {
    if (!roundActive || showCountdown) return undefined;
    if (typeof timerSeconds !== 'number' || timerSeconds < 1 || timerSeconds > 5) {
      return undefined;
    }
    const HEARTBEAT_MS = { 5: 650, 4: 520, 3: 410, 2: 320, 1: 250 };
    const period = HEARTBEAT_MS[timerSeconds] ?? 600;
    const intensity = (6 - timerSeconds) / 5; // 5s -> 0.2, 1s -> 1.0
    let timeoutId;
    const beat = () => {
      sound.heartbeat(intensity);
      timeoutId = setTimeout(beat, period);
    };
    beat();
    return () => clearTimeout(timeoutId);
  }, [timerSeconds, roundActive, showCountdown, sound]);

  // Game over -> win fanfare / defeat sting, once. Solo completing the run is a
  // win; multiplayer keys off the winner id (matches the Word Bomb end screen).
  const cbOutcomePlayedRef = useRef(false);
  useEffect(() => {
    if (!gameOver || cbOutcomePlayedRef.current) return;
    cbOutcomePlayedRef.current = true;
    if (isSolo || gameOver.winnerId === myId) sound.victory();
    else sound.defeat();
  }, [gameOver, isSolo, myId, sound]);

  const cbLeading = (() => {
    const totals = categoryTotals || {};
    const myScore = totals[myId] || 0;
    const values = Object.values(totals);
    const max = values.length ? Math.max(...values) : 0;
    return myScore > 0 && myScore >= max;
  })();

  let cbMascotPose;
  if (gameOver) cbMascotPose = gameOver.winnerId === myId ? 'celebrate' : 'panic';
  else if (cbTransient) cbMascotPose = cbTransient;
  else if (roundResults) cbMascotPose = cbLeading ? 'celebrate' : 'panic';
  else cbMascotPose = 'idle';

  // Transient reaction emote for the in-round mascot: a happy bob on an accepted
  // answer, a flinch on a rejected one. cbTransient is set per answer result and
  // already cycles back to null after 1s, so the one-shot replays each time.
  const cbEmote =
    cbTransient === 'celebrate' ? 'bob' : cbTransient === 'panic' ? 'flinch' : null;

  // ---- SOLO: personal-best results (at game over, after all 3 rounds) ----
  // Between-rounds in solo falls through to the normal round-results view below;
  // only the final game_over shows the solo PB screen.
  if (isSolo && gameOver) {
    const myFinal =
      (categoryScores || (gameOver && gameOver.finalScores) || []).find(
        (s) => s.id === myId
      );
    const rounds = soloLogRef.current;
    const total = myFinal
      ? myFinal.score
      : rounds.reduce((sum, r) => sum + r.roundScore, 0);

    return (
      <SoloResultsScreen
        score={total}
        rounds={rounds}
        onPlayAgain={onPlayAgain}
        onNewGameMode={onRematch}
        onLeave={onLeave}
      />
    );
  }

  // ---- GAME OVER: final scoreboard ----
  if (gameOver) {
    const scores = [...(categoryScores || gameOver.finalScores || [])].sort(
      (a, b) => b.score - a.score
    );
    const iWon = gameOver.winnerId === myId;
    const winnerName = (scores.find((s) => s.id === gameOver.winnerId) || {}).name;

    return (
      <div className="game-wrap">
        <div className="game-over-overlay">
          {iWon && <ConfettiEffect />}
          <div className="game-over-card">
            {/* The mascot's emotional reaction, large and centred above the title. */}
            <Mascot
              pose={iWon ? 'celebrate' : 'panic'}
              emote={iWon ? 'celebrate' : 'slump'}
              size={150}
              className="game-over-mascot"
            />
            <div className={`game-over-title${iWon ? ' win winner-bounce' : ''}`}>
              {iWon ? 'YOU WIN!' : <WobbleText text="GAME OVER" />}
            </div>
            {!iWon && (
              <div className="game-over-winner">
                {winnerName ? `${winnerName.toUpperCase()} WINS` : 'NO WINNER'}
              </div>
            )}
            <div className="cb-scoreboard">
              {scores.map((s, i) => {
                const pc = resolvePlayerColor(playerColors, s.id);
                return (
                <div
                  key={s.id}
                  className={`cb-score-row${s.id === gameOver.winnerId ? ' winner' : ''}`}
                  style={{ '--pc': pc.color, '--pc-dark': pc.dark }}
                >
                  <span className="cb-score-rank">{i + 1}</span>
                  <span className="cb-score-name">
                    <PlayerDot color={pc.color} dark={pc.dark} tier={pc.tier} />
                    <span className="cb-score-name-text">{s.name}</span>
                    {s.id === myId && <span className="game-player-you">YOU</span>}
                  </span>
                  <span className="cb-score-pts">
                    {iWon && s.id === gameOver.winnerId ? (
                      <CountUp to={s.score} />
                    ) : (
                      s.score
                    )}
                  </span>
                </div>
                );
              })}
            </div>
            <div className="game-over-actions">
              {isHost && (
                <button className="game-over-rematch" onClick={onRematch}>
                  REMATCH
                </button>
              )}
              <button
                className={`game-over-leave${isHost ? ' secondary' : ''}`}
                onClick={onLeave}
              >
                LEAVE
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- DURING A ROUND ----
  if (categoryRound) {
    const maxTimer = categoryRound.timerSeconds || 1;
    const ratio = Math.max(0, Math.min(1, timerSeconds / maxTimer));
    // Full bar while the countdown is up (timer hasn't started ticking yet).
    const displayRatio = showCountdown ? 1 : ratio;
    const timerColor =
      displayRatio > 0.6 ? '#2EFFE0' : displayRatio >= 0.3 ? '#FFE94A' : '#FF5C5C';
    const lowTime = !showCountdown && timerSeconds <= 5;
    const veryLowTime = !showCountdown && timerSeconds < 3;
    const others = roomPlayers.filter((p) => p.id !== myId);
    // Solo: the overall best total to beat (across a full 3-round game), shown
    // up top as a live target.
    const soloBest = isSolo ? loadPersonalBest(SOLO_PB_KEY) : null;
    // Who can reroll the category: the solo player, or the host in multiplayer.
    const canReroll = isSolo || isHost;
    const rerollsLeft = categoryRerolls ?? 0;
    // Reroll is only allowed in the round's opening window (server-enforced too);
    // after the first ~5s the button locks for the rest of the round. The server
    // is authoritative - this just mirrors it so the button looks right.
    const withinRerollWindow = !showCountdown && timerSeconds > maxTimer - 5;

    return (
      <div className="game-wrap">
        {showCountdown && (
          <CountdownOverlay onComplete={() => setShowCountdown(false)} />
        )}
        <div className={`game-stage${shake ? ' game-shake' : ''}`}>
          {hypeKey > 0 && <HypePopup key={hypeKey} />}
          <div className="game-header">
            <div className="game-title">
              <SprayReveal>CATEGORY BLITZ</SprayReveal>
            </div>
            <div className="game-header-right">
              <div className="game-meta">
                {isSolo ? (
                  <span className="game-meta-round">SOLO</span>
                ) : (
                  <span className="game-meta-round">
                    ROUND {categoryRound.round}/{TOTAL_CATEGORY_ROUNDS}
                  </span>
                )}
              </div>
              <button className="game-leave-btn" onClick={onLeave}>
                LEAVE
              </button>
            </div>
          </div>

          {/* Solo: the overall best total to beat, an immediate target. */}
          {isSolo && (
            <div className="solo-best-banner">
              {soloBest != null ? `YOUR BEST: ${soloBest}` : 'NO RECORD YET'}
            </div>
          )}

          {/* Non-host notice when the host rerolls the category on everyone. */}
          {rerollNotice && (
            <div className="cb-reroll-notice">HOST REROLLED — NEW CATEGORY</div>
          )}

          {/* Two-zone responsive layout: hero + action (main) | live state (rail).
              Collapses to a single stack on phones/tablets via the .cb-round grid.
              CB-only wrapper, so Word Bomb / Imposter layouts are untouched. */}
          <div className="cb-round">
            <div className="cb-round-main">

          <div className="cb-category-label">NAME AS MANY AS YOU CAN</div>
          <div className="cb-category-display">
            {/* Sprays the category name on each new round/reroll (re-keyed by the
                category text so the reveal replays). The box itself appears
                normally - only the paint sweeps on. */}
            <SprayReveal key={categoryRound.category} duration={780}>
              {(categoryRound.category || '').toUpperCase()}
            </SprayReveal>
            {/* Mascot sitting on the box's edge, legs dangling over the border. */}
            <div className="cb-cat-mascot">
              <Mascot pose={cbMascotPose} emote={cbEmote} size={50} />
            </div>
          </div>

          {/* Format hint: one sample answer so players see the EXPECTED SHAPE
              (word / phrase / fragment) of a valid answer. DISPLAY-ONLY - it is
              never submitted, validated, scored, or pre-filled into the input. */}
          {exampleFor(categoryRound.category) && (
            <div className="cb-category-example">
              e.g. {exampleFor(categoryRound.category)}
            </div>
          )}

          {/* Reroll: swap this category for another of the same tier. Host-only
              in multiplayer; free (within the per-game limit) in solo. Disabled
              when none remain (dashed-outline disabled style) or mid-countdown. */}
          {canReroll && (
            <div className="cb-reroll-row">
              <button
                className="cb-reroll-btn"
                onClick={onRerollCategory}
                disabled={rerollsLeft <= 0 || !withinRerollWindow}
                title={
                  rerollsLeft <= 0
                    ? 'No rerolls left this game'
                    : !withinRerollWindow
                    ? 'Rerolls are only allowed at the start of a round'
                    : 'Swap the current category for a different one'
                }
              >
                NEW CATEGORY ({rerollsLeft})
              </button>
            </div>
          )}

          <div className="game-timer-row">
            <div className={`game-timer-track${lowTime ? ' urgent' : ''}`}>
              <div
                className="game-timer-fill"
                style={{ width: `${displayRatio * 100}%`, background: timerColor }}
              />
            </div>
            <div className={`game-timer-num${veryLowTime ? ' shake' : ''}`}>
              {timerSeconds}s
            </div>
          </div>

          <div className="game-input-row">
            {/* Personal hype streak, floats above the input (pointer-events:none). */}
            <ComboMeter count={streak.count} brk={streak.brk} />
            {/* Near-miss callout for a late accepted answer (pointer-events:none). */}
            {clutchCall && (
              <ClutchCallout
                key={clutchCall.key}
                seconds={clutchCall.seconds}
                tier={clutchCall.tier}
              />
            )}
            {/* Per-letter submit physics (accept pop / reject scatter). The reject
                scatter REPLACES the input-shake, so the input below no longer
                applies it - one coherent miss reaction. pointer-events:none. */}
            {cbSubmitLetters && (
              <SubmitLetters
                key={cbSubmitLetters.key}
                text={cbSubmitLetters.text}
                mode={cbSubmitLetters.mode}
              />
            )}
            <input
              ref={inputRef}
              className="game-input"
              type="text"
              value={draft}
              onChange={(event) => {
                const value = event.target.value;
                // Soft key tick on actual character entry (parity with Word Bomb).
                if (value.length > draft.length) sound.keystroke();
                setDraft(value);
              }}
              onKeyDown={handleKeyDown}
              disabled={showCountdown}
              aria-label="Type an answer for the category"
              placeholder="Type an answer..."
              maxLength={32}
              autoComplete="off"
              spellCheck="false"
            />
            <button className="game-send-btn" onClick={submit}>
              SEND
            </button>
            {hypeKey > 0 && <FloatingScore key={hypeKey} />}
          </div>

          {lastWordResult && (
            <div
              className={`game-toast ${
                lastWordResult.accepted ? 'accepted' : 'rejected'
              }`}
            >
              {lastWordResult.accepted
                ? `NICE! "${(lastWordResult.answer || '').toUpperCase()}"`
                : rejectionMessage(lastWordResult.reason, { isCategory: true })}
            </div>
          )}

            </div>
            {/* ---- Side rail: live state (your answers + opponents) ---- */}
            <div className="cb-round-side">

          <div className="cb-my-answers">
            <div className="cb-section-label">YOUR ANSWERS ({myAnswers.length})</div>
            <div className="cb-answers-list">
              {myAnswers.length === 0 ? (
                <span className="game-used-empty">GO! TYPE ANYTHING THAT FITS</span>
              ) : (
                myAnswers.map((answer, i) => (
                  <span key={`${answer}-${i}`} className="cb-answer-chip">
                    {answer.toUpperCase()}
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Opponents' live progress - hidden in solo (there are none). */}
          {!isSolo && (
            <div className="cb-progress">
              <div className="cb-section-label">OTHER PLAYERS</div>
              {others.length === 0 ? (
                <span className="game-used-empty">NO OTHER PLAYERS</span>
              ) : (
                others.map((p) => {
                  const pc = resolvePlayerColor(playerColors, p.id);
                  return (
                  <div
                    key={p.id}
                    className="cb-progress-row"
                    style={{ '--pc': pc.color, '--pc-dark': pc.dark }}
                  >
                    <span className="cb-progress-name">
                      <PlayerDot color={pc.color} dark={pc.dark} tier={pc.tier} />
                      <span className="cb-progress-name-text">{p.name}</span>
                    </span>
                    <span className="cb-progress-count">
                      {playerProgress[p.id] || 0} answers
                    </span>
                  </div>
                  );
                })
              )}
            </div>
          )}

            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- BETWEEN ROUNDS: results + countdown ----
  if (roundResults) {
    return (
      <div className="game-wrap">
        <Mascot pose={cbMascotPose} size={110} className="game-mascot" />
        <div className="game-stage">
          <div className="game-header">
            <div className="game-title">
              <SprayReveal>CATEGORY BLITZ</SprayReveal>
            </div>
            <button className="game-leave-btn" onClick={onLeave}>
              LEAVE
            </button>
          </div>

          <div className="cb-round-results">
            <div className="cb-results-title">
              <SprayReveal key={roundResults.round}>
                ROUND {roundResults.round} RESULTS
              </SprayReveal>
            </div>
            <div className="cb-results-category">
              <SprayReveal key={roundResults.round} delay={140}>
                {(roundResults.category || '').toUpperCase()}
              </SprayReveal>
            </div>

            {(roundResults.playerResults || []).map((pr) => {
              const pc = resolvePlayerColor(playerColors, pr.id);
              return (
              <div
                key={pr.id}
                className="cb-result-player"
                style={{ '--pc': pc.color, '--pc-dark': pc.dark }}
              >
                <div className="cb-result-head">
                  <span className="cb-result-name">
                    <PlayerDot color={pc.color} dark={pc.dark} tier={pc.tier} />
                    <span className="cb-result-name-text">{pr.name}</span>
                    {pr.id === myId && <span className="game-player-you">YOU</span>}
                  </span>
                  <span className="cb-result-scores">
                    <span className="cb-result-round">+{pr.roundScore}</span>
                    <span className="cb-result-total">
                      {categoryTotals[pr.id] != null ? categoryTotals[pr.id] : pr.roundScore} TOTAL
                    </span>
                  </span>
                </div>
                <div className="cb-result-answers">
                  {pr.answers.length === 0 ? (
                    <span className="game-used-empty">NO ANSWERS</span>
                  ) : (
                    pr.answers.map((answer, i) => (
                      <span key={`${answer}-${i}`} className="cb-answer-chip">
                        {answer.toUpperCase()}
                      </span>
                    ))
                  )}
                </div>
              </div>
              );
            })}
          </div>

          <div className="cb-next-round">
            {roundResults.round >= TOTAL_CATEGORY_ROUNDS
              ? 'FINAL SCORES IN 5 SECONDS...'
              : 'NEXT ROUND IN 5 SECONDS...'}
          </div>
        </div>
      </div>
    );
  }

  // Brief gap between game_started and the first round_start.
  return (
    <div className="game-wrap">
      <div className="game-loading">STARTING ROUND...</div>
    </div>
  );
}
