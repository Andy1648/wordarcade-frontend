// SoloShell.jsx — the shared chrome for CHAIN and FUSE: the clock ring, the input with
// its reject sill, the reason line, the arm hint, and the death card. Mode-specific
// content (the required letter / the fragment, the HUD) is passed in as nodes.
//
// DESIGN LAW honored here: the INPUT element is never animated (only the sill and the
// clock give feedback). The sill "flash" is an OPACITY pulse of an always-red bar (so we
// stay within transform/opacity-only animation). There is no idle animation anywhere.
import { useEffect, useRef } from 'react';
import './Solo.css';
import { WinsHudPill, WinsEarnedTotal } from '../components/WinsHud';
import { wpmKeyStroke } from '../progress/wpmLive';

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

export default function SoloShell({
  accent,
  title,
  hud, // top bar node (score/best/multiplier | lives/strip)
  center, // the required letter / the fragment
  motif, // optional static SVG backdrop behind the stage (per-mode; never animated)
  supply, // optional readout node under the center
  clock, // { remaining, tMax, redZone, armed }
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
  rootRef, // optional ref to .solo-root (CHAIN uses it to measure tile centres for FX)
  fx, // optional absolutely-positioned FX layer (CHAIN OUT→IN travel), overlaid on root
  phase,
  winsTally = 0, // live "+N WINS" pill amount (0 until the 3-word gate)
  winsWords = 0, // my accepted-word count, so the pill can show the pre-gate "3 WORDS TO EARN"
  luckyKey = 0, // bumps on each lucky word → re-fires the finite gold burst
  over, // { score, best, restartArmed, restart, card, bare?, restartLabel?, winsEarned? }
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
        <ClockRing {...clock} />
        <div className="solo-center">{center}</div>
        {supply ? <div className="solo-supply">{supply}</div> : null}
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
    </div>
  );
}
