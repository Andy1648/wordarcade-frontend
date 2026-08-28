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
import { useEffect, useRef, useState } from 'react';
import './SatRush.css';
import { bankWordWins, awardWins, wordWinsEstimate, currentRebirthMult } from '../progress/wins';
import { awardWordXp, cappedWordMult } from '../progress/xp';
import { recordAcceptedWord } from '../progress/collection';
import { noteWord } from '../progress/records';
import { wordSenseWinsFactor } from '../progress/wordSense';
import { loadRarityIndex, rarityOf } from '../progress/rarityIndex';
import { wpmStart, wpmAddWord, wpmEnd } from '../progress/wpmLive';
import RarityFlash from '../components/RarityFlash.jsx';
import { formatNum } from '../format';
// NOTE: the run's wins total IS shown on the results screen, but SatRushResults
// renders it in SAT Rush's own manga style (`+{winsEarned}` in .sr-winspanel) —
// deliberately NOT the neon house `WinsEarnedTotal` component (SAT Rush visual
// rule). So only WinsHudPill is imported here.
import { WinsHudPill } from '../components/WinsHud';
import { useSatRushGame } from './useSatRushGame';
import { SAT_RUSH_DEV_TUNER, SAT_RUSH_SCENE } from './config';
import { setShakeTarget } from './juice';
import Hud from './Hud';
import WordCard from './WordCard';
import SatRushResults from './SatRushResults';
import Briefing from './BriefingScreen';
import ModeSelect from './ModeSelect';
import DevTuner from './DevTuner';

export default function SatRushGame({ onExit, musicSetVolume }) {
  const game = useSatRushGame();
  const { view } = game;
  const appRef = useRef(null);

  // WINS: BANK per cleared word as the run plays (§2) so leaving mid-run keeps what was
  // earned — no end-of-run payout (that would double-pay). `view.cleared` is the authoritative
  // running count; we bank the delta each time it climbs and reset the ledger when a fresh run
  // drops it back to 0. bankWordWins queues the "+N WINS" menu stamp and gates on 3 words.
  const satBankedWordsRef = useRef(0);
  const satWeightRef = useRef(0); // RARITY: running sum of cleared words' rarity multipliers
  const [winsEarned, setWinsEarned] = useState(0);
  // Preload the rarity rank index + begin a WPM session; flush it on unmount (leave/exit).
  useEffect(() => {
    loadRarityIndex();
    wpmStart('satRush');
    return () => wpmEnd();
  }, []);
  useEffect(() => {
    const cleared = view.cleared || 0;
    if (cleared < satBankedWordsRef.current) {
      // Fresh run (count reset) → reset our per-run ledger + displayed total + rarity weight,
      // and start a fresh WPM session (flushes the previous run's).
      satBankedWordsRef.current = 0;
      satWeightRef.current = 0;
      wpmStart('satRush');
      setWinsEarned(0);
    }
    if (cleared > satBankedWordsRef.current) {
      // RARITY: score the just-cleared word (view.lastClearedWord is aligned with `cleared`).
      // A clear normally bumps the count by 1; if it ever jumps, credit the extra words at ×1.
      const delta = cleared - satBankedWordsRef.current;
      const prevWeight = satWeightRef.current;
      // Unified economy (Job 1): the per-word rarity weight (SAT has no combo/lucky) also grants XP,
      // so a SAT capture now levels you as well as banking wins.
      const rw = rarityOf(view.lastClearedWord);
      const wWeight = cappedWordMult(rw.mult, 1, 1);
      satWeightRef.current += wWeight * wordSenseWinsFactor(rw.mult) + Math.max(0, delta - 1); // WORD SENSE (Job 4)
      awardWordXp({ mode: 'sat-rush', wordLength: (view.lastClearedWord || '').length, weight: wWeight });
      recordAcceptedWord(view.lastClearedWord, { mode: 'sat-rush', band: rw.band }); // Collection (Job 3)
      wpmAddWord(view.lastClearedWord); // WPM: count the cleared word's chars
      noteWord(view.lastClearedWord, rw); // permanent record: distinct / obscure / rarest-ever (guarded)
      const banked = bankWordWins({
        mode: 'satRush',
        prevWords: satBankedWordsRef.current,
        nowWords: cleared,
        prevWeight,
        nowWeight: satWeightRef.current,
      });
      satBankedWordsRef.current = cleared;
      if (banked > 0) setWinsEarned((prev) => prev + banked);
    }
  }, [view.cleared]);

  // Live wins tally (item 2): what the run will pay so far, from the running cleared count
  // (0 until the 3-word payout gate). Recomputed each render — pure.
  const winsTally = awardWins({ mode: 'satRush', wordsAccepted: view.cleared || 0 });

  // HUD ✕ mid-run: clean abandon (stops the clock, fires run_abandoned, no results)
  // then go home. The hook's phase drop + unmount restore the music duck (see the
  // effect below) exactly like the results-screen exit does.
  function handleExitRun() {
    game.abandonRun();
    if (onExit) onExit();
  }

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
      {/* RARITY (word-value): a rarer captured word flashes its tier ("RARE ×2.5"). Re-keyed per
          clear so it replays; COMMON captures stay silent. */}
      <RarityFlash key={view.clearId} rarity={rarityOf(view.lastClearedWord)} />
      {/* manga focus lines: hidden until the final stage (endgame treatment) */}
      <SpeedLines active={view.hasWord && view.atFinal} />
      {/* miss: a 2-frame page-tear flash, re-keyed per miss so it fires once */}
      {view.hasWord && view.stamp && view.stamp.kind === 'miss' && (
        <div className="sr-tear" key={`tear-${view.stamp.id}`} aria-hidden="true" />
      )}
      {/* Live "+N WINS" pill — shared component + position with every other mode (item 2). */}
      {view.hasWord && view.phase === 'playing' && (
        <WinsHudPill amount={winsTally} words={view.cleared || 0} />
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
              onExit={handleExitRun}
            />
            <div className="sr-body">
              {/* The ante row + word panel are now ONE bounty poster (WordCard);
                  the multiplier lives in its REWARD footer. */}
              <WordCard view={view} />
            </div>
          </>
        )}
      </div>

      {view.phase === 'start' && <StartScreen onPlay={game.startGame} onExit={onExit} />}
      {view.phase === 'mode' && (
        <ModeSelect lastMode={view.lastMode} onChoose={game.chooseMode} onExit={onExit} />
      )}
      {view.phase === 'briefing' && <Briefing briefing={view.briefing} onStart={game.startRun} onExit={onExit} />}
      {view.phase === 'over' && (
        <SatRushResults results={view.results} winsEarned={winsEarned} onAgain={game.startGame} onExit={onExit} />
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
    <button type="button" className="sr-exit-chip" onClick={onExit} aria-label="Exit">
      EXIT
    </button>
  );
}

// The cover is a manga PANEL, not a newspaper: the SAT RUSH masthead (Dela Gothic
// with a screentone off-plate) and the paper PLAY button on the torn page — the
// the old newsprint masthead / date row / shouty broadsheet furniture was cut
// (this is a manga page, not a printed newspaper).
function StartScreen({ onPlay, onExit }) {
  // Sell the mode the way the other modes' dialogs do: what it pays PER WORD (the SAT
  // ×2 rate, with the live rebirth boost annotated like the cards), the run framing, and
  // a worked example of the mechanic — kept in SAT RUSH's own retro-print manga language
  // (paper + ink + red accent), NOT the neon house dialog look.
  const wins = wordWinsEstimate({ mode: 'sat-rush' });
  const mult = currentRebirthMult();
  return (
    <div className="sr-screen">
      <div className="sr-cover">
        <div className="sr-title sr-print" data-v={'SAT RUSH'}>
          SAT&nbsp;RUSH
        </div>
        <p className="sr-cover-tag">
          SAT vocab at arcade speed. Read the clue and type the word before it spells itself.
        </p>

        {/* Worked example — the mechanic, in one clue → answer beat. */}
        <div className="sr-cover-example">
          <div className="sr-cover-ex-label">EXAMPLE</div>
          <div className="sr-cover-ex-clue">“lasting only a very short time”</div>
          <div className="sr-cover-ex-arrow" aria-hidden="true">▼</div>
          <div className="sr-cover-ex-answer">EPHEMERAL</div>
        </div>

        {/* Per-word wins + run framing — the SAT equivalent of the dialogs' meta row. */}
        <div className="sr-cover-meta">
          <span className="sr-cover-pay">
            <b>{wins}</b> WINS / WORD
            {mult > 1 && <span className="sr-cover-mult"> (×{formatNum(mult)})</span>}
          </span>
          <span className="sr-cover-round">3 LIVES · ENDLESS RUN</span>
        </div>

        <button type="button" className="sr-btn" onClick={onPlay}>
          Play
        </button>
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
