// FrenchRushGame.jsx — FRENCH RUSH: AP French vocab on the SAT RUSH engine, at its own link
// (/french-rush). Same hook, poster, setup, study screen and results — with the French pack (packs.js
// `fr`): the English meaning is the first clue, the French example the second, accents are forgiving
// to type, nouns show their gender, words are grouped by the six AP themes + essay connectors + exam
// words, and the levels cut on AP priority.
//
// THE STUDENT SETS THE PACE (oct19, Andy: "REALLY slow things down - have user click to continue"):
// by default there is no clock — HINT shows the next clue, SHOW ANSWER gives up, and every word ends
// on a review card (the word read aloud, its meaning, the example + its English) that waits for
// CONTINUE. A TIMED pace is still there for students who want it.
//
// Every exit stays inside French Rush (Andy: "switch exit … to the actual menu"): MENU / HOME go
// back to this cover, never to the arcade. A teacher can hand out a set as a link
// (?mode=&level=&n=&theme=&pace=) — it opens CASE SETUP with that set preselected.
//
// NOT PART OF THE ARCADE ECONOMY: nothing here banks wins, XP, gems, records or leaderboard rows. Its
// learning memory lives under its own storage keys.
import { useEffect, useRef, useState } from 'react';
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
import WordBank from './WordBank';

// The cover: what this is in one line, the mechanic in one worked example, and the two ways in.
function Cover({ onPlay, onBank, wordCount }) {
  return (
    <div className="sr-screen">
      <div className="sr-cover fr-cover">
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
          <span className="sr-cover-pay">6 AP THEMES + ESSAY &amp; EXAM WORDS · {wordCount} WORDS</span>
          <span className="sr-cover-round">NO TIMER UNLESS YOU WANT ONE · ACCENTS OPTIONAL</span>
        </div>

        <button type="button" className="sr-btn" onClick={onPlay}>
          Play
        </button>
        <button type="button" className="sr-btn sr-btn-ghost" onClick={onBank}>
          Word bank
        </button>
        <a className="sr-cover-credit" href="/">
          a TYPE A WORD game
        </a>
      </div>
    </div>
  );
}

// ?mode=&level=&n=&theme=&pace= — a teacher's set (CaseSetup's "copy a link")
function readPreset() {
  try {
    const q = new URLSearchParams(window.location.search);
    if (!q.has('mode') && !q.has('level') && !q.has('theme')) return null;
    return {
      mode: q.get('mode') === 'briefing' ? 'briefing' : 'lineup',
      difficulty: q.get('level') || 'standard',
      length: Number(q.get('n')) || 10,
      category: q.get('theme') || null,
      pace: q.get('pace') === 'timed' ? 'timed' : 'self',
    };
  } catch {
    return null;
  }
}

export default function FrenchRushGame() {
  const game = useSatRushGame({ packId: 'fr' });
  const { view } = game;
  const appRef = useRef(null);
  const [bank, setBank] = useState(false);
  const ui = (view.pack && view.pack.ui) || null;

  useEffect(() => {
    setShakeTarget(appRef.current);
    return () => setShakeTarget(null);
  }, []);

  // A teacher's link opens straight on CASE SETUP with the set preselected (once, on load).
  const presetDone = useRef(false);
  useEffect(() => {
    if (presetDone.current) return;
    presetDone.current = true;
    const preset = readPreset();
    if (!preset) return;
    game.applyPreset(preset);
    game.startGame();
    game.chooseMode(preset.mode);
    // game is a stable hook object; this runs once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const home = () => {
    setBank(false);
    game.backToStart();
  };

  if (bank) {
    return (
      <div className="sr-app fr-app" ref={appRef}>
        <WordBank
          words={(view.pack && view.pack.words) || []}
          categories={(view.pack && view.pack.categories) || []}
          masteryOf={game.masteryOf}
          studiedOf={game.studiedOf}
          onBack={() => setBank(false)}
        />
      </div>
    );
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
              showHeat={false}
              exitLabel="HOME"
              caseLabel="words"
              onExit={home}
            />
            <div className="sr-body">
              <WordCard view={view} onHint={game.hint} onSkip={game.skip} onContinue={game.continueRun} />
              <SatKeyInput active={view.phase === 'playing'} typeKey={game.typeKey} />
            </div>
          </>
        )}
      </div>

      {view.phase === 'start' && (
        <Cover onPlay={game.startGame} onBank={() => setBank(true)} wordCount={view.packSize} />
      )}
      {view.phase === 'mode' && (
        <ModeSelect lastMode={view.lastMode} onChoose={game.chooseMode} onExit={home} ui={ui} />
      )}
      {view.phase === 'setup' && (
        <CaseSetup
          mode={view.mode}
          prefs={view.setupPrefs}
          knownCount={view.knownCount}
          packSize={view.packSize}
          categories={(view.pack && view.pack.categories) || []}
          pack="fr"
          ui={ui}
          onStart={game.confirmSetup}
          onBack={game.backToModes}
          onExit={home}
        />
      )}
      {view.phase === 'briefing' && (
        <Briefing briefing={view.briefing} onStart={game.startRun} onExit={home} ui={ui} />
      )}
      {view.phase === 'over' && (
        <SatRushResults
          results={view.results}
          economy={false}
          ui={ui}
          onAgain={game.startGame}
          onReplay={game.replayMisses}
          onExit={home}
        />
      )}
    </div>
  );
}
