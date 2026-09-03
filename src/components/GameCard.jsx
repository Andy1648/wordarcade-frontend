// GameCard.jsx
import { useEffect, useRef, useState } from 'react';
import { GAME_ART_COMPONENTS } from './GameArt';
import { useMagneticPull } from '../lib/magneticPull';
import { wordWinsEstimate, currentRebirthMult } from '../progress/wins';
import { masteryState } from '../progress/mastery';
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
      // Promote the wrapper ONLY when the tilt loop is actually running (fine-pointer +
      // motion). On touch / reduced-motion `active` is false and the layer is never
      // promoted — the will-change no longer sits idle on every card.
      if (active) card.el.style.willChange = 'transform';
    },
    unregister(card) {
      cards.delete(card);
      card.el.style.transform = ''; // hand the rest pose back to CSS
      card.el.style.willChange = '';
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
  // MASTERY (Job 2): a compact "M{level}" chip once the player has started mastering this mode
  // (≥ M2 — a card showing M1 on every mode reads as clutter to a new player). Read from client
  // state; the menu re-reads on every return from a game.
  const mastery = masteryState(game.id);
  const showMastery = game.enabled && !locked && mastery.level >= 2;

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

  // feat/moments — UNLOCK-IN-PLACE. A card you've watched locked for 20 levels should unlock RIGHT
  // HERE on the menu with a moment, not just quietly appear. When a level-gated card crosses its
  // unlock level (locked true→false) for the FIRST time (gated once per mode in localStorage), fire a
  // one-shot pop + an "UNLOCKED!" flash. Finite (~900ms), transform/opacity only, no infinite anim.
  const [unlocking, setUnlocking] = useState(false);
  const prevLockedRef = useRef(locked);
  const unlockTimerRef = useRef(0);
  useEffect(() => () => window.clearTimeout(unlockTimerRef.current), []);
  useEffect(() => {
    const was = prevLockedRef.current;
    prevLockedRef.current = locked;
    if (!(was === true && locked === false)) return; // only the locked → unlocked edge
    const key = `taw.unlockSeen.${game.id}`;
    try {
      if (localStorage.getItem(key) === '1') return; // already celebrated this mode's unlock
      localStorage.setItem(key, '1');
    } catch { /* storage blocked — just skip the one-shot */ return; }
    const reduce = typeof window !== 'undefined' && window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return; // reduced motion: the card simply appears unlocked
    setUnlocking(true);
    window.clearTimeout(unlockTimerRef.current);
    unlockTimerRef.current = window.setTimeout(() => setUnlocking(false), 900);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked, game.id]);

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
    unlocking ? 'game-card--unlocking' : '',
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

  // Payout preview (what each accepted WORD pays in this mode). Shown on every
  // ENABLED, UNLOCKED card — a locked card shows just its mode name in the bar.
  const payout = game.enabled && !locked && (
    <>
      {wordWinsEstimate({ mode: game.id, difficulty })} WINS / WORD
      {currentRebirthMult() > 1 && (
        <span className="game-card-payout-mult"> (×{formatNum(currentRebirthMult())})</span>
      )}
    </>
  );
  // The badge carries its data-driven fill (game.badgeBg / badgeColor) so themes and
  // gameData stay the source of truth; menu.spec asserts its text === game.badgeText.
  const badge = (
    <span
      className="game-card-badge"
      style={{ background: game.badgeBg, color: game.badgeColor, borderColor: game.badgeBorderColor || '#000' }}
    >
      {game.badgeText}
    </span>
  );

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
        {/* FULL-BLEED SCENE — the ART-LED v2 poster (GameArt.jsx), sliced to cover. */}
        {ArtComponent && (
          <div className="game-card-art">
            <ArtComponent />
          </div>
        )}

        {/* Foreground overlay: corner ribbon, mastery, and the bottom title bar (or,
            for SAT RUSH, the manga masthead + foot). pointer-events:none so the whole
            card face stays one click target. */}
        <div className="game-card-fg">
          {/* Corner ribbon (decorative — the FEATURED / AI status is also in the card's
              aria-label; the ribbon bleeds off the corner, so aria-hidden keeps it out of
              the viewport-integrity clip walk). */}
          {game.featured && <div className="game-card-ribbon is-featured" aria-hidden="true">FEATURED</div>}
          {game.aiJudged && <div className="game-card-ribbon is-ai" aria-hidden="true">AI JUDGED</div>}

          {showMastery && (
            <div className="game-card-mastery" aria-label={`Mastery level ${mastery.level}`}>
              M{mastery.level}
            </div>
          )}

          {game.id === 'sat-rush' ? (
            <>
              <div className="game-card-masthead">
                <div className="game-card-mh-row">
                  <div className="game-card-name">{game.name}</div>
                </div>
                <div className="game-card-mh-tags">
                  {badge}
                  {game.limited && <span className="game-card-limited-tag" aria-hidden="true">LIMITED</span>}
                </div>
              </div>
              <div className="game-card-foot">
                {payout || game.description}
              </div>
            </>
          ) : (
            <div className="game-card-titlebar">
              {badge}
              <div className="game-card-name">{game.name}</div>
              {payout && <div className="game-card-payout">{payout}</div>}
            </div>
          )}
        </div>

        {/* Level gate (CHAIN/FUSE): the scene dims but stays visible, and the "UNLOCKS AT
            LV n" copy sits on a SOLID plaque so it never reads on raw art (BE-PICKY #11).
            A locked tap still credits XP (useXpCapture) + opens the preview — it just
            doesn't navigate. */}
        {locked && (
          <div className="game-card-lock">
            <div className="game-card-lock-plaque">
              <svg className="game-card-lock-icon" viewBox="0 0 48 48" aria-hidden="true">
                <path d="M14 22 v-5 a10 10 0 0 1 20 0 v5" fill="none" stroke="#000" strokeWidth="4.5" />
                <rect x="9" y="21" width="30" height="22" rx="4" fill="#FFE94A" stroke="#000" strokeWidth="4" />
                <circle cx="24" cy="30" r="3.4" fill="#000" />
                <rect x="22.3" y="30" width="3.4" height="8" fill="#000" />
              </svg>
              {/* Show the PATH, not just the gate: unlock level + how many to go, so
                  "locked" reads as reachable rather than a dead end. */}
              <div className="game-card-lock-label">
                UNLOCKS AT LV {game.unlockLevel}
                <span className="game-card-lock-sub">
                  YOU'RE LV {playerLevel} · {Math.max(0, game.unlockLevel - playerLevel)} TO GO
                </span>
              </div>
            </div>
          </div>
        )}
        {/* feat/moments — one-shot UNLOCK flash: shown for ~900ms the first time this mode unlocks
            in place on the menu. Pure transform/opacity one-shot (see .game-card-unlock-flash). */}
        {unlocking && (
          <div className="game-card-unlock" aria-hidden="true">
            <span className="game-card-unlock-flash">UNLOCKED!</span>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
