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
import AnteMeter from './AnteMeter';
import WordCard from './WordCard';
import SatRushResults from './SatRushResults';
import DevTuner from './DevTuner';

export default function SatRushGame({ onExit }) {
  const game = useSatRushGame();
  const { view } = game;
  const appRef = useRef(null);

  // Own the screen-shake root while this mode is mounted (release on exit).
  useEffect(() => {
    setShakeTarget(appRef.current);
    return () => setShakeTarget(null);
  }, []);

  return (
    <div className="sr-app" ref={appRef}>
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
            <AnteMeter
              multiplier={view.multiplier}
              stage={view.stage}
              maxStage={view.maxStage}
              wordNumber={view.wordNumber}
              interval={view.interval}
              graceMs={view.graceMs}
              atFinal={view.atFinal}
              running={view.pending === 'idle'}
            />
            <WordCard view={view} />
          </>
        )}
      </div>

      {view.phase === 'start' && <StartScreen onPlay={game.startGame} onExit={onExit} />}
      {view.phase === 'over' && (
        <SatRushResults results={view.results} onAgain={game.startGame} onExit={onExit} />
      )}

      {SAT_RUSH_DEV_TUNER && !SAT_RUSH_SCENE && (
        <DevTuner
          cfg={view.cfg}
          setStageMs={game.setStageMs}
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

function StartScreen({ onPlay, onExit }) {
  return (
    <div className="sr-screen">
      <div className="sr-title">SAT&nbsp;RUSH</div>
      <div className="sr-sub">
        Type the missing word. Information arrives in stages — and every stage you wait for costs
        you multiplier.
      </div>
      <div className="sr-rules">
        <div>
          <code>5×</code> part of speech + letter count
        </div>
        <div>
          <code>4×</code> the sentence
        </div>
        <div>
          <code>3×</code> the definition
        </div>
        <div>
          <code>2×</code> the root
        </div>
        <div>
          <code>1×</code> first letter
        </div>
      </div>
      <div className="sr-sub" style={{ opacity: 0.5 }}>
        Wrong letters bounce — you can’t get stuck. 5 correct in a row → SILVER TONGUE, everything
        doubles. Miss a word and it comes back angrier.
      </div>
      <button type="button" className="sr-btn" onClick={onPlay}>
        Play
      </button>
      <ExitLink onExit={onExit} />
    </div>
  );
}

