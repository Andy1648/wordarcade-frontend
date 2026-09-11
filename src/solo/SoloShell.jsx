// SoloShell.jsx — the shared chrome for CHAIN and FUSE: the clock ring, the input with
// its reject sill, the reason line, the arm hint, and the death card. Mode-specific
// content (the required letter / the fragment, the HUD) is passed in as nodes.
//
// DESIGN LAW honored here: the INPUT element is never animated (only the sill and the
// clock give feedback). The sill "flash" is an OPACITY pulse of an always-red bar (so we
// stay within transform/opacity-only animation). There is no idle animation anywhere.
import { useEffect, useRef, useState } from 'react';
import './Solo.css';
import { WinsHudPill, WinsEarnedTotal } from '../components/WinsHud';
import Mascot from '../components/Mascot';
import { wpmKeyStroke } from '../progress/wpmLive';
import Spotlight from '../components/Spotlight';
import { hasSeenGameSpotlight, markGameSpotlightSeen } from '../progress/onboarding';

// A thin countdown ring. Progress is driven by React state every frame (not a CSS
// keyframe), so there's no idle animation and no var() inside keyframes.
function ClockRing({ remaining, tMax, redZone, armed }) {
  const R = 52;
  const C = 2 * Math.PI * R;
  const frac = armed ? Math.max(0, Math.min(1, remaining / tMax)) : 1;
  const secs = Math.max(0, remaining / 1000);
  return (
    <svg className="solo-clock" width="120" height="120" viewBox="0 0 120 120" aria-hidden="true">
      <circle className="solo-clock-track" cx="60" cy="60" r={R} />
      <circle
        className={`solo-clock-fill${redZone ? ' is-red' : ''}`}
        cx="60"
        cy="60"
        r={R}
        style={{ strokeDasharray: C, strokeDashoffset: C * (1 - frac) }}
      />
      <text className={`solo-clock-num${redZone ? ' is-red' : ''}`} x="60" y="60" dy="0.35em" textAnchor="middle">
        {secs >= 10 ? Math.ceil(secs) : secs.toFixed(1)}
      </text>
    </svg>
  );
}

// FUSE's clock is a horizontal BURNING CORD under the input rather than a ring in
// the stage: the fuse runs along the same axis the player is already reading, toward
// the fragment above it, so the time left is in peripheral vision while typing
// instead of off to one side. Same data as ClockRing, different read.
// The burn is transform-only (scaleX) and the spark is a left offset - no width
// animation anywhere. Colour escalates exactly like Word Bomb's fuse.
function FuseClock({ remaining, tMax, redZone, armed }) {
  const frac = armed ? Math.max(0, Math.min(1, remaining / tMax)) : 1;
  const secs = Math.max(0, remaining / 1000);
  const color = frac > 0.6 ? '#FFE94A' : frac > 0.3 ? '#FF6B3D' : '#FF4B4B';
  return (
    <div className={`fuse-line${redZone ? ' is-red' : ''}`} style={{ '--fuse-color': color }} aria-hidden="true">
      <div className="fuse-line-burn" style={{ transform: `scaleX(${frac})` }} />
      <div className="fuse-line-spark" style={{ left: `${(frac * 100).toFixed(2)}%` }} />
      {/* numeric only in the last seconds - the cord carries the proportion */}
      {armed && secs <= 5 ? <span className="fuse-line-num">{secs.toFixed(1)}</span> : null}
    </div>
  );
}

export default function SoloShell({
  accent,
  title,
  hud, // top bar node (score/best/multiplier | lives/strip)
  center, // the required letter / the fragment
  motif, // optional static SVG backdrop behind the stage (per-mode; never animated)
  supply, // optional readout node under the center
  clock, // { remaining, tMax, redZone, armed }
  clockVariant = 'ring', // 'ring' (CHAIN) | 'fuse' (a horizontal burning cord under the input)
  outTile, // optional OUT tile (CHAIN only) — the last letter of the word being typed
  deck, // optional lower-deck node (per-mode) that fills the lower half of the card
  input,
  onInput,
  onSubmit,
  sillKey,
  reason,
  placeholder,
  maxLength, // longest word length in the built ACCEPT union — derived, not hardcoded
  armHint, // per-mode "how to play" line, shown until the clock arms
  firstRunRule, // per-mode one-line rule for the ONE-TIME first-game input spotlight
  rootRef, // optional ref to .solo-root (CHAIN uses it to measure tile centres for FX)
  fx, // optional absolutely-positioned FX layer (CHAIN OUT→IN travel), overlaid on root
  phase,
  winsTally = 0, // live "+N WINS" pill amount (0 until the 3-word gate)
  winsWords = 0, // my accepted-word count, so the pill can show the pre-gate "3 WORDS TO EARN"
  luckyKey = 0, // bumps on each lucky word → re-fires the finite gold burst
  over, // { score, best, restartArmed, restart, card, bare?, restartLabel?, winsEarned?, share?, tryRow? }
  onExit,
}) {
  const inputRef = useRef(null);

  // Keep focus on the field while playing so typing always lands (the field is never
  // cleared on reject, so focus + caret position are the player's evidence).
  useEffect(() => {
    if (phase === 'playing' && inputRef.current) inputRef.current.focus();
  }, [phase]);

  const submit = (e) => {
    e.preventDefault();
    onSubmit();
  };

  // ONE-TIME first-game spotlight over the input (shared across ALL game surfaces via the
  // onboarding flag — the first game the player types in shows it, no other). Armed only
  // once play begins so the target input exists; dismissed by the first key/tap (which the
  // pointer-events:none overlay lets through, so it still lands in the field).
  const [gameSpot, setGameSpot] = useState(false);
  useEffect(() => {
    if (phase === 'playing' && firstRunRule && !hasSeenGameSpotlight()) setGameSpot(true);
  }, [phase, firstRunRule]);
  const dismissGameSpot = () => { markGameSpotlightSeen(); setGameSpot(false); };

  return (
    <div className="solo-root" style={{ '--solo-accent': accent }} ref={rootRef}>
      <button type="button" className="solo-exit" onClick={onExit} aria-label="Exit">
        ✕
      </button>

      {/* ONE HUD row: the mode stats (score/mult/links | words/lives) + the wins-earned state,
          all in a single readable line inside the card (NO ORPHAN FIXED UI — the shared wins
          pill is re-homed here from its fixed viewport corner, positioning neutralised to static
          by `.solo-root` scope in Solo.css). The WIN-COMBO ×N chip and the WPM chip were REMOVED
          from the solo HUD: a second "×N" eight pixels from the score multiplier read as a
          duplicate, and the combo's effect already shows in the +N WINS figure (showWpm={false}
          drops WPM too). Now there is exactly one multiplier on the row. */}
      <div className="solo-hud">
        {hud}
        {phase === 'playing' && (
          <div className="solo-hud-wins">
            <WinsHudPill amount={winsTally} words={winsWords} showWpm={false} />
          </div>
        )}
      </div>

      {/* BODY — one column on narrow/portrait screens, two columns on wide-aspect ones so
          the composition fills the width and needs less height (the same move that lets the
          card fill wide-short viewports instead of sitting in a narrow centred strip). */}
      <div className="solo-body">
      <div className="solo-primary">
      <div className="solo-stage">
        {/* Per-mode static backdrop motif. A SIBLING of the stage content and of the
            input's chain (the input lives outside .solo-stage), so it can never touch
            either. No animation — house rule: nothing idles here. */}
        {motif}
        {clockVariant === 'ring' ? <ClockRing {...clock} /> : null}
        {/* Play-only stage content. The over scrim (.solo-over) is only 86% opaque, so a
            big bright center letter / supply line left mounted here GHOSTS THROUGH it and
            collides with the death card's title. Gate both to 'playing' exactly like the
            input, OUT tile, and HUD pills already are (JOB 5 — full-sweep finding 1). */}
        {phase === 'playing' ? <div className="solo-center">{center}</div> : null}
        {phase === 'playing' && supply ? <div className="solo-supply">{supply}</div> : null}
      </div>

      {/* OUT tile (CHAIN) — a SIBLING of the input, never an ancestor, so it can update
          on every keystroke without ever animating the input or its container. */}
      {phase === 'playing' && outTile ? outTile : null}
      </div>{/* .solo-primary */}

      <div className="solo-secondary">
      {phase === 'playing' ? (
        <form className="solo-inputwrap" onSubmit={submit}>
          <input
            ref={inputRef}
            className="solo-input"
            type="text"
            value={input}
            onChange={(e) => {
              wpmKeyStroke(); // WPM (§2): typing activity opens this word's active-typing span
              onInput(e.target.value);
            }}
            placeholder={placeholder}
            maxLength={maxLength}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck="false"
            aria-label={title}
          />
          {/* The reject sill: an always-red bar whose OPACITY pulses on each reject
              (keyed remount re-fires the 140ms opacity animation). */}
          <div className="solo-sill" key={sillKey} data-fire={sillKey > 0 ? '1' : '0'} />
        </form>
      ) : null}

      {/* FUSE's clock lives HERE - directly under the input, burning toward the
          fragment above it. A SIBLING of the form, never an ancestor, so the burning
          cord can update every frame without ever animating the input's chain. */}
      {phase === 'playing' && clockVariant === 'fuse' ? <FuseClock {...clock} /> : null}

      {/* Reason line (reject) or the arm hint before the clock starts. */}
      <div className="solo-reason" aria-live="polite">
        {phase === 'playing' && reason ? reason : ''}
      </div>
      {phase === 'playing' && !clock.armed && armHint ? <div className="solo-armhint">{armHint}</div> : null}

      {/* LOWER DECK — per-mode content that fills the lower half of the card (the chain
          running across the space for CHAIN; the fuse cords + big letter strip for FUSE).
          Grows to absorb the slack (flex:1) so the card is one composition, not a cluster
          floating over a dark void. Static content only (no idle animation). */}
      {phase === 'playing' && deck ? (
        <div className="solo-deck">
          {/* Faint mode motif behind the deck (same node as the stage/over-screen) so the
              lower band reads as a composed surface, not flat void. */}
          {motif ? <div className="solo-deck-motif" aria-hidden="true">{motif}</div> : null}
          {deck}
        </div>
      ) : null}
      </div>{/* .solo-secondary */}
      </div>{/* .solo-body */}

      {phase === 'over' ? (
        <div className="solo-over">
          {/* Composed backdrop: the mode motif behind the dim, so the death screen reads as
              an intentional page (toward Blitz's game-over), not a small card bleeding the
              abandoned play stage through a thin scrim. Decorative, static. */}
          {motif ? <div className="solo-over-motif" aria-hidden="true">{motif}</div> : null}
          <div className="solo-deathcard">
            {/* Mascot reaction, like Blitz / Word Bomb game-over (fix/gameover-pass) — gives the
                solo death card a face + a first read above the copy. */}
            <Mascot pose="panic" emote="slump" size={104} className="solo-death-mascot" />
            {over.card}
            {/* Run's total wins earned, large (item 2) — shared component with every mode. */}
            {over.bare ? null : <WinsEarnedTotal amount={over.winsEarned} />}
            {/* First-run tutorial card (over.bare) shows NO score/BEST line. */}
            {over.bare ? null : (
              <div className="solo-scoreline">
                <span>SCORE {over.score}</span>
                <span>BEST {over.best}</span>
              </div>
            )}
            {/* One-tap shareable result receipt (Job 1). Self-suppresses under 3 words and
                never shows on the first-run tutorial card. */}
            {over.bare ? null : over.share}
            <button
              type="button"
              className={`solo-restart${over.restartArmed ? ' is-armed' : ''}`}
              onClick={over.restart}
            >
              {`${over.restartLabel || 'RESTART'}${over.restartArmed ? ' · ENTER' : ''}`}
            </button>
            {/* SECOND ROW (feat/solo-endgame): one ghost button naming a DIFFERENT unlocked mode.
                CHAIN and FUSE are the two score-attack modes AND the only level-gated ones, so
                dead-ending them on a lone RESTART was the worst case in the game. Hidden on the
                first-run tutorial card (over.bare), which is already a guided next step. */}
            {over.bare ? null : over.tryRow}
          </div>
        </div>
      ) : null}

      {/* LUCKY WORD (Job 4): a finite 400ms gold burst + "LUCKY ×5" stamp, re-keyed per lucky
          hit so it replays. Absolutely positioned, pointer-events:none, transform/opacity only —
          no idle/infinite animation. */}
      {phase === 'playing' && luckyKey > 0 && (
        <div className="solo-lucky" key={luckyKey} aria-hidden="true">
          <span className="solo-lucky-ring" />
          <span className="solo-lucky-label">LUCKY ×5</span>
        </div>
      )}

      {/* FX overlay (CHAIN OUT→IN travel). Absolutely positioned, pointer-events:none,
          on top of the already-correct screen; it is a SIBLING of the input's chain,
          never an ancestor, so it can animate without touching the input. */}
      {fx}

      {/* ONE-TIME first-game input spotlight (fix/logic-and-onboarding). */}
      {gameSpot && phase === 'playing' && (
        <Spotlight
          targetSelector=".solo-input"
          caption={firstRunRule}
          sub="START TYPING"
          onDismiss={dismissGameSpot}
        />
      )}
    </div>
  );
}
