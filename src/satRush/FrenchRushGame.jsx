// FrenchRushGame.jsx — FRENCH RUSH (oct18): AP French vocab on the SAT RUSH engine, at its own link
// (/french-rush). Same hook, same poster, same CASE SETUP / briefing / case file — with the French
// pack (packs.js `fr`): the English meaning is the first clue, the French example the second, accents
// are forgiving to type, nouns show their gender, and words are grouped by the six AP themes + essay
// connectors.
//
// NOT PART OF THE ARCADE ECONOMY. It is a study link, not a mode: nothing here banks wins, XP, gems,
// records or leaderboard rows, and the results page shows no cross-mode offers. (That is why this is
// its own container rather than SatRushGame with a flag — SAT's banking effects stay untouched.) Its
// learning memory lives under its own storage keys, apart from SAT's.
import { useEffect, useRef } from 'react';
import './SatRush.css';
import { useSatRushGame } from './useSatRushGame';
import { setShakeTarget } from './juice';
import Hud from './Hud';
import WordCard from './WordCard';
import SatRushResults from './SatRushResults';
import Briefing from './BriefingScreen';
import ModeSelect from './ModeSelect';
import CaseSetup from './CaseSetup';
import SatKeyInput from './SatKeyInput';

function ExitLink({ onExit }) {
  if (!onExit) return null;
  return (
    <button type="button" className="sr-exit-chip" onClick={onExit} aria-label="Leave French Rush">
      <span aria-hidden="true">←</span> TYPE A WORD
    </button>
  );
}

// The cover: what this is, in one line, and the mechanic in one worked example.
function Cover({ onPlay, onExit, wordCount }) {
  return (
    <div className="sr-screen">
      <div className="sr-cover">
        <div className="sr-title sr-print" data-v={'FRENCH RUSH'}>
          FRENCH&nbsp;RUSH
        </div>
        <p className="sr-cover-tag">AP French vocab. See the meaning — type the French.</p>

        <div className="sr-cover-example">
          <div className="sr-cover-ex-label">EXAMPLE</div>
          <div className="sr-cover-ex-clue">to travel</div>
          <div className="sr-cover-ex-arrow" aria-hidden="true">▼</div>
          <div className="sr-cover-ex-answer">VOYAGER</div>
        </div>

        <div className="sr-cover-meta">
          <span className="sr-cover-pay">6 AP THEMES + ESSAY CONNECTORS · {wordCount} WORDS</span>
          <span className="sr-cover-round">ACCENTS OPTIONAL — E WORKS FOR É</span>
        </div>

        <button type="button" className="sr-btn" onClick={onPlay}>
          Play
        </button>
        <ExitLink onExit={onExit} />
      </div>
    </div>
  );
}

export default function FrenchRushGame({ onExit }) {
  const game = useSatRushGame({ packId: 'fr' });
  const { view } = game;
  const appRef = useRef(null);

  useEffect(() => {
    setShakeTarget(appRef.current);
    return () => setShakeTarget(null);
  }, []);

  function handleExitRun() {
    // the HUD's MENU mid-run: stop the clock and go back to this mode's own start (not the arcade)
    game.abandonRun();
  }

  return (
    <div className={`sr-app fr-app${view.silver ? ' silver' : ''}`} ref={appRef}>
      {view.hasWord && view.stamp && view.stamp.kind === 'miss' && (
        <div className="sr-tear" key={`tear-${view.stamp.id}`} aria-hidden="true" />
      )}
      <div className="sr-stage">
        {view.hasWord && view.phase === 'playing' && (
          <>
            <Hud
              score={view.score}
              streak={view.streak}
              wordNumber={view.wordNumber}
              settled={view.settled}
              caseSize={view.runTotal}
              lives={view.lives}
              maxLives={view.maxLives}
              heat={view.heat}
              heatCap={view.heatCap}
              onExit={handleExitRun}
            />
            <div className="sr-body">
              <WordCard view={view} />
              <SatKeyInput active={view.phase === 'playing'} typeKey={game.typeKey} />
            </div>
          </>
        )}
      </div>

      {view.phase === 'start' && <Cover onPlay={game.startGame} onExit={onExit} wordCount={view.packSize} />}
      {view.phase === 'mode' && <ModeSelect lastMode={view.lastMode} onChoose={game.chooseMode} onExit={onExit} />}
      {view.phase === 'setup' && (
        <CaseSetup
          mode={view.mode}
          prefs={view.setupPrefs}
          knownCount={view.knownCount}
          packSize={view.packSize}
          categories={(view.pack && view.pack.categories) || []}
          onStart={game.confirmSetup}
          onBack={game.backToModes}
          onExit={onExit}
        />
      )}
      {view.phase === 'briefing' && <Briefing briefing={view.briefing} onStart={game.startRun} onExit={onExit} />}
      {view.phase === 'over' && (
        <SatRushResults
          results={view.results}
          economy={false}
          onAgain={game.startGame}
          onReplay={game.replayMisses}
          onExit={onExit}
        />
      )}
    </div>
  );
}
