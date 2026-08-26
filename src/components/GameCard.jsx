// GameCard.jsx
import { useEffect, useRef, useState } from 'react';
import { GAME_ART_COMPONENTS } from './GameArt';
import { GAME_ICON_COMPONENTS } from './GameIcons';
import { useMagneticPull } from '../lib/magneticPull';
import { wordWinsEstimate, currentRebirthMult } from '../progress/wins';
import { formatNum } from '../format';
import './GameCard.css';

// Per-mode neon accent, consumed as the --card-glow CSS var by the beat-glow
// layer in GameCard.css. Falls back to the card's fill for any other game.
const CARD_NEON = {
  'word-bomb': '#FF6B3D',
  'category-blitz': '#3DA8FF',
  // SAT RUSH is a manga (cream) card: the neon glow does nothing on paper, so its
  // beat/select FX are ink (see [data-game='sat-rush'] in GameCard.css). This
  // keeps the click glitch-pop monochrome ink rather than a coloured flash.
  'sat-rush': '#111111',
  chain: '#2EFFE0',
  fuse: '#FFE94A',
};

// ---- CURSOR-MAGNETIC TILT (shared controller) ----------------------------
// The mode cards sit dead still at rest but lean toward the cursor in 3D - they
// "feel" the cursor from a distance (magnetic), the nearest leaning most. One
// window pointermove listener feeds a shared cursor position and a SINGLE rAF
// loop lerps every mounted card toward its target tilt, so the three cards share
// one listener + one loop instead of each running its own. The lean composes on
// top of each card's static resting rotate (--rest-rot, read from CSS).
const MAXTILT = 22; // deg - peak lean at the card edge nearest the cursor
const RANGE = 560; // px - magnetic falloff radius from each card's centre
const SMOOTH = 0.16; // lerp factor toward the target each frame
const LIFT = 18; // px - extra upward translate while hovered

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const magnet = (() => {
  const cards = new Set(); // each: { el, rest, hovered, rx, ry, lift, rect }
  let cursor = null; // {x,y} viewport coords, or null when the pointer is absent
  let raf = 0;
  // Magnetic effect only runs for a fine pointer (mouse) with motion allowed.
  // On touch / reduced-motion we never start the loop, leaving the CSS rest
  // rotate as the static pose.
  let active = false;

  function measure() {
    for (const c of cards) c.rect = c.el.getBoundingClientRect();
  }

  function onMove(e) {
    cursor = { x: e.clientX, y: e.clientY };
  }
  function onLeave() {
    cursor = null; // pointer left the window/viewport - settle back to rest
  }

  function frame() {
    for (const c of cards) {
      let tRx = 0;
      let tRy = 0;
      let tLift = c.hovered ? LIFT : 0;
      if (cursor && c.rect) {
        const cx = c.rect.left + c.rect.width / 2;
        const cy = c.rect.top + c.rect.height / 2;
        const dx = cursor.x - cx;
        const dy = cursor.y - cy;
        const dist = Math.hypot(dx, dy);
        const influence = Math.max(0, 1 - dist / RANGE);
        const halfW = c.rect.width / 2;
        const halfH = c.rect.height / 2;
        tRy = clamp(dx / halfW, -1.5, 1.5) * MAXTILT * influence;
        tRx = -clamp(dy / halfH, -1.5, 1.5) * MAXTILT * influence;
      }
      // Smooth lerp toward the target so motion eases in/out, never snaps.
      c.rx += (tRx - c.rx) * SMOOTH;
      c.ry += (tRy - c.ry) * SMOOTH;
      c.lift += (tLift - c.lift) * SMOOTH;
      c.el.style.transform =
        `rotate(${c.rest}deg) rotateX(${c.rx.toFixed(2)}deg) ` +
        `rotateY(${c.ry.toFixed(2)}deg) translateY(${(-c.lift).toFixed(2)}px)`;
    }
    raf = requestAnimationFrame(frame);
  }

  function start() {
    active =
      typeof window !== 'undefined' &&
      window.matchMedia('(pointer: fine)').matches &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!active) return; // touch / reduced-motion: stay static (CSS rest pose)
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('blur', onLeave);
    document.addEventListener('mouseleave', onLeave);
    window.addEventListener('resize', measure);
    measure();
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    cursor = null;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('blur', onLeave);
    document.removeEventListener('mouseleave', onLeave);
    window.removeEventListener('resize', measure);
  }

  return {
    register(card) {
      cards.add(card);
      if (cards.size === 1) start();
      else if (active) card.rect = card.el.getBoundingClientRect();
    },
    unregister(card) {
      cards.delete(card);
      card.el.style.transform = ''; // hand the rest pose back to CSS
      if (cards.size === 0) stop();
    },
  };
})();

/**
 * Renders one game selection card. All visual variation (colors, text,
 * which icon/artwork to show) comes from the `game` object - this
 * component has no hardcoded knowledge of any specific game, so adding
 * a 7th game means adding an entry to gameData.js plus one art component
 * and one icon component, not editing this file.
 *
 * `onSelect` is called with the game's id when a non-disabled card is
 * clicked. The "more soon" card has `enabled: false` and renders without
 * a click handler or hover-lift, matching its disabled visual state.
 */
export default function GameCard({ game, onSelect, onHover, topper, locked = false, difficulty, onLockedSelect, playerLevel = 0 }) {
  const ArtComponent = GAME_ART_COMPONENTS[game.artKey];
  const IconComponent = GAME_ICON_COMPONENTS[game.id];

  // The wrapper element + its magnet state. The card object is shared with the
  // module-level controller; mutating `hovered` here lets the rAF loop add the
  // hover lift without a React re-render.
  const wrapRef = useRef(null);
  const cardRef = useRef(null);
  // Magnetic cursor-pull on a NEW OUTER wrapper, composing OUTSIDE the existing
  // tilt/lift (which stays on .game-card-wrap). Gated to fine-pointer + motion.
  const magnetRef = useRef(null);
  useMagneticPull(magnetRef, {
    max: 11,
    base: 8,
  });

  // One-shot chromatic glitch-pop on select: a pure ::before accent (RGB fringe +
  // neon flash) that fires as the card->dialog FLIP morph springs out. It adds NO
  // transform to the card — the morph owns the physical expansion. Cleared after
  // ~200ms (one animation length); the timeout is cleared on unmount.
  const [glitching, setGlitching] = useState(false);
  const glitchTimerRef = useRef(0);
  useEffect(() => () => window.clearTimeout(glitchTimerRef.current), []);

  // Locked (level-gated) cards do nothing on click but shake ONCE (finite 200ms, transform
  // only) — the card stays visible with a padlock + "UNLOCKS AT LV n".
  const [shaking, setShaking] = useState(false);
  const shakeTimerRef = useRef(0);
  useEffect(() => () => window.clearTimeout(shakeTimerRef.current), []);
  function shakeOnce() {
    setShaking(true);
    window.clearTimeout(shakeTimerRef.current);
    shakeTimerRef.current = window.setTimeout(() => setShaking(false), 200);
  }

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const rest = parseFloat(getComputedStyle(el).getPropertyValue('--rest-rot')) || 0;
    const card = { el, rest, hovered: false, rx: 0, ry: 0, lift: 0, rect: null };
    cardRef.current = card;
    magnet.register(card);
    return () => magnet.unregister(card);
  }, []);

  // Mouse hover drives both the existing hover reaction (via onHover) and the
  // magnet's lift. Keyboard focus keeps the onHover reaction but doesn't lift.
  function handleEnter() {
    if (onHover) onHover(game.id);
    if (cardRef.current) cardRef.current.hovered = true;
  }
  function handleLeave() {
    if (onHover) onHover(null);
    if (cardRef.current) cardRef.current.hovered = false;
  }

  const cardClassName = [
    'game-card',
    game.dashedBorder ? 'dashed-border' : '',
    !game.enabled ? 'disabled' : '',
    game.featured ? 'featured' : '',
    // A mascot sits on this card's top edge - drop the top tape so it doesn't
    // poke through where the character is perched.
    topper ? 'has-topper' : '',
    // One-shot chromatic glitch-pop while a select is animating out.
    glitching ? 'game-card--glitch' : '',
    // Level-gated: dimmed with a padlock; click only shakes.
    locked ? 'locked' : '',
    shaking ? 'game-card--shake' : '',
  ]
    .filter(Boolean)
    .join(' ');

  // Pass the clicked card element up so the homepage can measure it for the
  // card->dialog FLIP morph (the expand starts from exactly this box).
  function handleClick(event) {
    if (locked) {
      shakeOnce(); // gated: a quick tactile shake…
      // …then open the preview dialog (mode rules + payout + unlock level). Falls back to
      // the shake-only behaviour when no handler is wired.
      if (onLockedSelect) onLockedSelect(game.id, event.currentTarget);
      return;
    }
    if (game.enabled) {
      // Fire the one-shot glitch accent, then clear it after the animation length.
      setGlitching(true);
      window.clearTimeout(glitchTimerRef.current);
      glitchTimerRef.current = window.setTimeout(() => setGlitching(false), 200);
      if (onSelect) onSelect(game.id, event.currentTarget);
    }
  }

  function handleKeyDown(event) {
    if ((game.enabled || locked) && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      handleClick(event);
    }
  }

  return (
    // Outermost MAGNETIC wrapper (cursor-pull translate + lift shadow) — a new
    // div whose only job is that transform. It composes OUTSIDE the
    // existing tilt/lift (which stays on .game-card-wrap) and re-provides the
    // grid's perspective for the inner 3D tilt. See .game-card-magnet in the CSS.
    <div ref={magnetRef} className="game-card-magnet" data-game={game.id}>
      {/* The grid item: static resting rotate + cursor-tilt via its own shared
          controller, left fully intact — the magnet only wraps it. */}
      <div
      ref={wrapRef}
      className="game-card-wrap"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocus={() => onHover && onHover(game.id)}
      onBlur={() => onHover && onHover(null)}
    >
      {/* A character perched on the card's top edge, leaning with the wrapper's
          magnetic tilt. Sits above the card; never intercepts pointer events. */}
      {topper}
      <div
        className={cardClassName}
        // --card-glow: the card's mode accent from CARD_NEON, consumed by the
        // beat-glow ::after layer in GameCard.css. Opacity-only pulse — never
        // touches this card's transform.
        style={{ background: game.baseColor, '--card-glow': CARD_NEON[game.id] || game.baseColor }}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={game.enabled || locked ? 0 : -1}
        aria-disabled={!game.enabled || locked}
        aria-label={
          locked
            ? `${game.name.replace('\n', ' ')} — locked, unlocks at level ${game.unlockLevel}`
            : `${game.name.replace('\n', ' ')} - ${game.badgeText}`
        }
      >
        {/* Strips of tape pinning the "flyer" to the wall - one at each top corner,
            angled opposite ways. Purely decorative. */}
        <span className="game-card-tape game-card-tape-left" aria-hidden="true" />
        <span className="game-card-tape game-card-tape-right" aria-hidden="true" />

        {/* Level gate: the card dims to 55% and a chain-and-padlock is slung across the top
            corner; the "UNLOCKS AT LV n" label stays. A locked tap still credits XP (see
            useXpCapture) so the card never feels dead — it only doesn't navigate. */}
        {locked && (
          <div className="game-card-lock">
            {/* Chain drawn diagonally across the top-right corner, padlock at its middle.
                Inline SVG, thick black outlines, flat fills — no external asset. */}
            <svg className="game-card-lock-chain" viewBox="0 0 90 90" aria-hidden="true">
              <g stroke="#000" strokeWidth="3.4" fill="#c4c4d0">
                <ellipse cx="34" cy="4" rx="7" ry="4.4" transform="rotate(45 34 4)" />
                <ellipse cx="44" cy="14" rx="7" ry="4.4" transform="rotate(45 44 14)" />
                <ellipse cx="76" cy="46" rx="7" ry="4.4" transform="rotate(45 76 46)" />
                <ellipse cx="86" cy="56" rx="7" ry="4.4" transform="rotate(45 86 56)" />
              </g>
              {/* Padlock at the diagonal's midpoint (60,30). */}
              <path d="M55 27 v-4 a5 5 0 0 1 10 0 v4" fill="none" stroke="#000" strokeWidth="4.2" />
              <rect x="51" y="26" width="18" height="15" rx="3" fill="#FFE94A" stroke="#000" strokeWidth="3.4" />
              <circle cx="60" cy="32.5" r="1.9" fill="#000" />
              <rect x="59.1" y="32.5" width="1.8" height="5" fill="#000" />
            </svg>
            {/* Show the PATH, not just the gate (audit #5): the unlock level, the player's
                current level, and how many levels remain — so "locked" reads as reachable, not a
                dead end. Levels-to-go (not raw XP) keeps it legible to a newcomer. */}
            <div className="game-card-lock-label">
              UNLOCKS AT LV {game.unlockLevel}
              <span className="game-card-lock-sub">
                YOU'RE LV {playerLevel} · {Math.max(0, game.unlockLevel - playerLevel)} TO GO
              </span>
            </div>
          </div>
        )}

        {game.featured && (
          <div className="game-card-featured-tag">
            <img src="/art/star.svg" className="game-card-featured-star" alt="" aria-hidden="true" />
            FEATURED
          </div>
        )}

        {game.limited && <div className="game-card-limited-tag">LIMITED</div>}

      {ArtComponent && (
        <div className="game-card-art">
          <ArtComponent />
        </div>
      )}

      <div className="game-card-content">
        <div
          className="game-card-icon-box"
          style={{
            background: game.iconBg,
            borderColor: game.iconBorderColor || '#000',
          }}
        >
          {IconComponent && <IconComponent />}
        </div>

        {game.aiJudged && (
          <div className="game-card-ai-badge">AI JUDGED</div>
        )}

        <div className="game-card-name" style={{ color: game.textColor }}>
          {game.name}
        </div>

        {/* Payout preview: what each accepted WORD pays in this mode, at the selected
            difficulty (else the easy baseline). SAT Rush/CHAIN/FUSE carry their 2×/3×/5×
            solo multiplier here. Sits under the title so it always shows (badge bottom-pinned). */}
        {game.enabled && (
          <div className="game-card-payout">
            {wordWinsEstimate({ mode: game.id, difficulty })} WINS / WORD
            {currentRebirthMult() > 1 && (
              <span className="game-card-payout-mult"> (×{formatNum(currentRebirthMult())})</span>
            )}
          </div>
        )}

        <div
          className="game-card-badge"
          style={{
            background: game.badgeBg,
            color: game.badgeColor,
            borderColor: game.badgeBorderColor || '#000',
          }}
        >
          {game.badgeText}
        </div>
      </div>
      </div>
      </div>
    </div>
  );
}
