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
// CLASS ROOM (oct19, Andy: "can you do a create/join room for this?"): a teacher opens a class with a
// code, students join it (or open ?class=CODE), everyone plays the same words and the teacher moves
// everyone on. See class/ClassRoom.jsx; a reload mid-class goes straight back in.
//
// NOT PART OF THE ARCADE ECONOMY: nothing here banks wins, XP, gems, records or leaderboard rows. Its
// learning memory lives under its own storage keys.
import { useEffect, useRef, useState } from 'react';
import './SatRush.css';
import './FrenchRush.css';
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
import ClassFlow from './class/ClassRoom';
import { hasClassSeat } from './class/useClassRoom';
import { usePlayClock } from '../progress/playClock.js';
import PressWipe from './PressWipe';
import { usePressOnChange } from './press';

// The cover: what this is in one line, the mechanic in one worked example, and the two ways in.
function Cover({ onPlay, onBank, onClass, wordCount }) {
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
        <button type="button" className="sr-btn sr-btn-ghost" onClick={onClass}>
          Class room
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

// the press sheet for each solo screen: [French headline, English line, direction]
const PRESS_BY_SCREEN = {
  start: ['FRENCH RUSH', 'home', 'back'],
  mode: ['À TOI !', 'your turn'],
  setup: ['RÉGLAGES', 'set it up'],
  briefing: ['ÉTUDIE', 'study'],
  playing: ["C'EST PARTI !", 'here we go'],
  over: ['TERMINÉ !', 'done'],
  bank: ['LES MOTS', 'word bank'],
  class: null, // ClassFlow presses its own
};

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

// ?class=CODE — a class's join link
function readClassCode() {
  try {
    const c = new URLSearchParams(window.location.search).get('class');
    return c ? c.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) : null;
  } catch {
    return null;
  }
}

export default function FrenchRushGame() {
  usePlayClock(); // TIME PLAYED on the profile (Andy oct21: French Rush time was never counted)
  const game = useSatRushGame({ packId: 'fr' });
  const { view } = game;
  const appRef = useRef(null);
  const [bank, setBank] = useState(false);
  // CLASS ROOM: open = the class flow is mounted (and owns the socket). Opens on its own for a join
  // link, or when this tab already holds a class seat (a reload mid-class).
  const [classCode] = useState(readClassCode);
  const [classOpen, setClassOpen] = useState(() => !!classCode || hasClassSeat());
  const [classState, setClassState] = useState({ playing: false, hostAway: false, offline: false });
  const classLeaveRef = useRef(null);
  const classStandbyRef = useRef(null); // a student's results → back to the class screen, seat kept
  const inClassRun = classOpen && classState.playing;
  const ui = (view.pack && view.pack.ui) || null;

  // THE PRESS (oct26): every solo screen change pulls a fresh sheet off the press, titled in French with its
  // English underneath. The class screens press their own sheets (ClassFlow); a class run starts here.
  const soloScreen = bank ? 'bank' : classOpen && !inClassRun ? 'class' : view.phase === 'over' ? 'over' : view.phase;
  usePressOnChange(soloScreen, PRESS_BY_SCREEN[soloScreen] || null);

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
    if (!preset || classOpen) return;
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
  const closeClass = () => {
    setClassOpen(false);
    setClassState({ playing: false, hostAway: false, offline: false });
    home();
  };
  // in a class run, HOME (and the results exits) leave the class
  const leaveClassRun = () => {
    if (classLeaveRef.current) classLeaveRef.current();
    else closeClass();
  };

  return (
    <div className={`sr-app fr-app${view.silver ? ' silver' : ''}${inClassRun ? ' fr-class-on' : ''}`} ref={appRef}>
      {view.hasWord && view.stamp && view.stamp.kind === 'miss' && (
        <div className="sr-tear" key={`tear-${view.stamp.id}`} aria-hidden="true" />
      )}
      <div className="sr-stage">
        {view.hasWord && view.phase === 'playing' && (!classOpen || inClassRun) && (
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
              onExit={inClassRun ? leaveClassRun : home}
            />
            <div className="sr-body">
              <WordCard view={view} onHint={game.hint} onSkip={game.skip} onContinue={game.continueRun} />
              {inClassRun && (classState.offline || classState.hostAway || view.pending !== 'idle') && (
                <div className={`fr-class-line${classState.offline || classState.hostAway ? ' alert' : ''}`} role="status">
                  {classState.offline ? 'reconnecting…' : classState.hostAway ? 'teacher reconnecting…' : 'waiting for the teacher…'}
                </div>
              )}
              <SatKeyInput active={view.phase === 'playing'} typeKey={game.typeKey} />
            </div>
          </>
        )}
      </div>

      {classOpen && (
        <ClassFlow
          game={game}
          words={(view.pack && view.pack.words) || []}
          categories={(view.pack && view.pack.categories) || []}
          entry={classCode ? 'join' : 'choose'}
          initialCode={classCode}
          onExit={closeClass}
          onStudentState={setClassState}
          leaveRef={classLeaveRef}
          standbyRef={classStandbyRef}
        />
      )}
      {bank && (
        <WordBank
          words={(view.pack && view.pack.words) || []}
          categories={(view.pack && view.pack.categories) || []}
          masteryOf={game.masteryOf}
          studiedOf={game.studiedOf}
          onBack={() => setBank(false)}
        />
      )}
      {!bank && !classOpen && view.phase === 'start' && (
        <Cover onPlay={game.startGame} onBank={() => setBank(true)} onClass={() => setClassOpen(true)} wordCount={view.packSize} />
      )}
      {!classOpen && view.phase === 'mode' && (
        <ModeSelect lastMode={view.lastMode} onChoose={game.chooseMode} onExit={home} ui={ui} />
      )}
      {!classOpen && view.phase === 'setup' && (
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
      {!classOpen && view.phase === 'briefing' && (
        <Briefing briefing={view.briefing} onStart={game.startRun} onExit={home} ui={ui} />
      )}
      {view.phase === 'over' && (!classOpen || inClassRun) && (
        <SatRushResults
          results={view.results}
          economy={false}
          ui={inClassRun && ui && ui.results ? { ...ui, results: { ...ui.results, again: 'Back to the class', menu: 'Leave the class' } } : ui}
          onAgain={inClassRun ? () => (classStandbyRef.current ? classStandbyRef.current() : leaveClassRun()) : game.startGame}
          onReplay={inClassRun ? null : game.replayMisses}
          onExit={inClassRun ? leaveClassRun : home}
        />
      )}
      <PressWipe />
    </div>
  );
}
