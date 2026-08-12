// SatRushGame.jsx — SAT RUSH container. Owns nothing but layout + screen state;
// all game logic lives in useSatRushGame (which drives engine.js + input.js).
//
// ────────────────────────────────────────────────────────────────────────────
// MOBILE INPUT IS NOT SOLVED (intentionally — see the build spec). The layout is
// responsive and reads fine on a phone, but the mode is driven by physical
// `keydown` events, which a touch device doesn't have. What breaks on mobile,
// and why it's genuinely hard (not just unwired):
//   1. No hardware keyboard → nothing to type. The obvious fix (a hidden <input>
//      to summon the soft keyboard) fights the whole mechanic: the slot model
//      REJECTS invalid keys without advancing, but a native input/IME buffers
//      text, autocorrects, and predicts — you can't cleanly reject a keystroke
//      mid-composition.
//   2. Even with a soft keyboard, it covers ~half the screen, so the sentence +
//      ante + slots can't all stay visible — the core "read the sentence, watch
//      the multiplier, type" loop doesn't fit.
//   3. Typing `perspicacious` on glass against a dropping multiplier is just
//      miserable; a bespoke on-screen key grid is probably the real answer, and
//      that's a design project of its own.
// So: playable + laid out on mobile, but input is desktop-keyboard only for now.
// ────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from 'react';
import './SatRush.css';
import { useSatRushGame } from './useSatRushGame';
import { SAT_RUSH_DEV_TUNER, SAT_RUSH_SCENE } from './config';
import { setShakeTarget } from './juice';
import Hud from './Hud';
import WordCard from './WordCard';
import SatRushResults from './SatRushResults';
import Briefing from './BriefingScreen';
import DevTuner from './DevTuner';

export default function SatRushGame({ onExit, musicSetVolume }) {
  const game = useSatRushGame();
  const { view } = game;
  const appRef = useRef(null);

  // Own the screen-shake root while this mode is mounted (release on exit).
  useEffect(() => {
    setShakeTarget(appRef.current);
    return () => setShakeTarget(null);
  }, []);

  // Duck the background music while a run is live so the SFX cut through, then
  // bring it back at game over - mirroring GameScreen's music duck. 0.15 while
  // playing, 0.3 on the results screen, and restore 0.3 when leaving the mode.
  // Guarded for musicSetVolume being absent (the flag-gated dev route may not
  // pass it).
  useEffect(() => {
    if (!musicSetVolume) return undefined;
    musicSetVolume(view.phase === 'playing' ? 0.15 : 0.3);
    return () => musicSetVolume(0.3);
  }, [view.phase, musicSetVolume]);

  return (
    // .silver flips the whole page into a negative reprint (CSS var inversion).
    <div className={`sr-app${view.silver ? ' silver' : ''}`} ref={appRef}>
      {/* manga focus lines: hidden until the final stage (endgame treatment) */}
      <SpeedLines active={view.hasWord && view.atFinal} />
      {/* miss: a 2-frame page-tear flash, re-keyed per miss so it fires once */}
      {view.hasWord && view.stamp && view.stamp.kind === 'miss' && (
        <div className="sr-tear" key={`tear-${view.stamp.id}`} aria-hidden="true" />
      )}
      <div className="sr-stage">
        {view.hasWord && (
          <>
            <Hud
              score={view.score}
              streak={view.streak}
              wordNumber={view.wordNumber}
              lives={view.lives}
              maxLives={view.maxLives}
              heat={view.heat}
              heatCap={view.heatCap}
            />
            <div className="sr-body">
              {/* The ante row + word panel are now ONE bounty poster (WordCard);
                  the multiplier lives in its REWARD footer. */}
              <WordCard view={view} />
            </div>
          </>
        )}
      </div>

      {view.phase === 'start' && (
        <StartScreen
          onPlay={game.startGame}
          onExit={onExit}
          skipBriefing={view.skipBriefing}
          onToggleBriefing={game.setSkipBriefing}
        />
      )}
      {view.phase === 'briefing' && (
        <Briefing briefing={view.briefing} onStart={game.startRun} onSkip={game.skipBriefing} />
      )}
      {view.phase === 'over' && (
        <SatRushResults results={view.results} onAgain={game.startGame} onExit={onExit} />
      )}

      {SAT_RUSH_DEV_TUNER && !SAT_RUSH_SCENE && (
        <DevTuner
          cfg={view.cfg}
          setStageMs={game.setStageMs}
          setSpellMs={game.setSpellMs}
          setKnob={game.setKnob}
          scene={game.scene}
          debugRevealTwo={game.debugRevealTwo}
        />
      )}
    </div>
  );
}

function ExitLink({ onExit }) {
  if (!onExit) return null;
  return (
    <button
      type="button"
      onClick={onExit}
      style={{ background: 'none', border: 'none', boxShadow: 'none', opacity: 0.5, fontWeight: 400 }}
    >
      exit
    </button>
  );
}

// The cover is a newspaper FRONT PAGE in the same paper/ink/double-rule/grain
// language as the play poster: gazette name, the SAT RUSH masthead (off-register
// violet plate), a ruled dateline, the reward schedule notice box, the bounty
// how-to, and the paper PLAY button.
function StartScreen({ onPlay, onExit, skipBriefing, onToggleBriefing }) {
  return (
    <div className="sr-screen">
      <div className="sr-cover">
        <div className="sr-gazette">Type&nbsp;a&nbsp;Word&nbsp;Gazette</div>
        <div className="sr-title sr-print" data-v={'SAT RUSH'}>
          SAT&nbsp;RUSH
        </div>
        <div className="sr-dateline">
          <span>VOL.&nbsp;1</span>
          <span>EXTRA! EXTRA! WORDS AT LARGE</span>
          <span>FREE</span>
        </div>
        {/* reward schedule: the less information you capture on, the bigger the pay */}
        <div className="sr-notice">
          <div className="sr-notice-head">— Reward Schedule —</div>
          <div className="sr-rules">
            <div>
              <code>5×</code> part of speech + letter count
            </div>
            <div>
              <code>4×</code> the sentence — last seen
            </div>
            <div>
              <code>3×</code> the description
            </div>
            <div>
              <code>2×</code> known aliases (root)
            </div>
            <div>
              <code>1×</code> first letter
            </div>
          </div>
        </div>
        <div className="sr-sub fine">
          Stuck? It spells itself out — for scraps. Capture early for the full bounty. Miss only if
          you walk away. 5 captures in a row → SILVER TONGUE, everything doubles. Let one escape and
          it comes back angrier.
        </div>
        <button type="button" className="sr-btn" onClick={onPlay}>
          Play
        </button>
        {/* The study screen (THE BRIEFING) can be turned off; this small toggle
            re-enables it once it's been skipped. */}
        {onToggleBriefing && (
          <label className="sr-brief-toggle">
            <input
              type="checkbox"
              checked={!skipBriefing}
              onChange={(e) => onToggleBriefing(!e.target.checked)}
            />
            Show the study briefing before each run
          </label>
        )}
        <ExitLink onExit={onExit} />
      </div>
    </div>
  );
}

// SpeedLines — asymmetric manga focus lines converging on centre, cream + faint,
// rendered full-bleed on the void behind the page. Hidden until `active` (the
// final stage). Static: it's a state cue, not motion. Non-scaling strokes keep
// the varied widths crisp under the stretch-to-fill viewBox.
function SpeedLines({ active }) {
  const CX = 50;
  const CY = 50;
  // hand-tuned so the spacing/widths read asymmetric, not a clean starburst
  const angles = [-84, -61, -40, -12, 8, 33, 55, 78, 100, 128, 152, 168, -168, -140, -116];
  const widths = [2, 1.2, 3, 1.6, 2.4, 1, 3.2, 1.4, 2, 1.2, 2.8, 1.6, 1, 2.2, 1.4];
  const gap = [30, 40, 33, 44, 36, 30, 42, 34, 38, 31, 45, 33, 40, 36, 30]; // clear centre radius
  const OUT = 80; // reach past the edges for full bleed
  return (
    <svg
      className={`sr-speedlines${active ? ' is-final' : ''}`}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {angles.map((a, i) => {
        const rad = (a * Math.PI) / 180;
        const dx = Math.cos(rad);
        const dy = Math.sin(rad);
        return (
          <line
            key={i}
            x1={CX + dx * gap[i]}
            y1={CY + dy * gap[i]}
            x2={CX + dx * OUT}
            y2={CY + dy * OUT}
            strokeWidth={widths[i]}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </svg>
  );
}
