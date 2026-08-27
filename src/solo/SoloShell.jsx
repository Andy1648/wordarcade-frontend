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
import ComboPill from '../components/ComboPill';

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
  comboMult = 1, // live WINS-combo multiplier for the HUD readout
  comboBreaks = 0, // break counter — re-keys the pill's finite shake on a real reset
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

      {/* Live "+N WINS" pill — same shared component + position as Word Bomb / Blitz (item 2).
          Hidden once the run is over (the total shows on the death card instead). */}
      {phase === 'playing' && <WinsHudPill amount={winsTally} words={winsWords} />}
      {/* Live WINS-combo readout, under the wins pill (Job 2). Finite break-shake only. */}
      {phase === 'playing' && <ComboPill mult={comboMult} breaks={comboBreaks} />}

      <div className="solo-hud">{hud}</div>

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

      {phase === 'playing' ? (
        <form className="solo-inputwrap" onSubmit={submit}>
          <input
            ref={inputRef}
            className="solo-input"
            type="text"
            value={input}
            onChange={(e) => onInput(e.target.value)}
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

      {phase === 'over' ? (
        <div className="solo-over">
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

      {/* FX overlay (CHAIN OUT→IN travel). Absolutely positioned, pointer-events:none,
          on top of the already-correct screen; it is a SIBLING of the input's chain,
          never an ancestor, so it can animate without touching the input. */}
      {fx}
    </div>
  );
}
