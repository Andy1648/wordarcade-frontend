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
// CREATE ROOM / JOIN ROOM (oct19, Andy: "can you do a create/join room for this?"; the copy said CLASS ROOM
// until nov21 — the code and the class_* protocol keep the class name): a teacher opens a class with a
// code, students join it (or open ?class=CODE), everyone plays the same words and the teacher moves
// everyone on. See class/ClassRoom.jsx; a reload mid-class goes straight back in.
//
// NOT PART OF THE ARCADE ECONOMY: nothing here banks wins, XP, gems, records or leaderboard rows. Its
// learning memory lives under its own storage keys.
// LANGUAGE RUSH (nov24): this is now the screen for every AP world language — French, Spanish, Italian, Latin
// and Chinese — keyed by `lang` (rushLang.js holds what differs). Each language has its own link and root
// (FrenchRushApp + rushApps/); the cover's language picker moves between them.
import { useEffect, useMemo, useRef, useState } from 'react';
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
import TeamRace from './class/TeamRace';
import { readBest, bestAt, saveIfBest } from './bestLane';
import { formatNum } from '../format';
import { hasClassSeat } from './class/useClassRoom';
import { usePlayClock } from '../progress/playClock.js';
import PressWipe from './PressWipe';
import PrintPicker from './PrintPicker';
import { RUSH_LANGS, RUSH_LANG_ORDER, rushLang } from './rushLang';
import { usePressOnChange } from './press';
// last, so the nov21 clean pass wins over SatRush.css / FrenchRush.css / ClassRoom.css
import './FrenchRushClean.css';

// The cover (nov21, Andy: "REMOVE THE BS"): the title and the ways in. Nothing else — no tagline, no
// worked example, no word count, no reassurance lines.
// The LANGUAGE picker (nov24) is the one way between the languages: each has its own link, so a pick is a page
// load — the next language's words are their own chunk, and nothing of this one's run carries over.
function LangPicker({ lang }) {
  const go = (id) => {
    if (id === lang) return;
    try {
      window.location.assign(`/${RUSH_LANGS[id].slug}`);
    } catch {
      /* never break the cover */
    }
  };
  return (
    <PrintPicker
      className="fr-lang-pick"
      label={RUSH_LANGS[lang].menu.language}
      value={lang}
      options={RUSH_LANG_ORDER.map((id) => ({ value: id, label: RUSH_LANGS[id].native }))}
      onChange={go}
    />
  );
}

function Cover({ lang, onPlay, onBank, onCreate, onJoin }) {
  const L = RUSH_LANGS[lang] || RUSH_LANGS.fr;
  const M = L.menu;
  const [first, second] = L.title.split(' ');
  return (
    <div className="sr-screen">
      <div className="sr-cover fr-cover">
        {/* the language's own stamp (nov24 round 2, Andy: "we can do better with the design"): its name and its
            hello, printed in its ink like a passport stamp */}
        <div className="fr-visa" lang={L.htmlLang === 'en' ? 'zh' : L.htmlLang}>
          <span className="fr-visa-native">{L.native}</span>
          <span className="fr-visa-hello">{M.hello}</span>
        </div>
        <div className={`sr-title sr-print${L.title.length > 11 ? ' fr-title-long' : ''}`} data-v={L.title}>
          {first}&nbsp;{second}
        </div>
        <div className="fr-cover-actions">
          <button type="button" className="sr-btn fr-go" onClick={onPlay}>
            {M.play}
          </button>
          <div className="fr-cover-pair">
            <button type="button" className="sr-btn sr-btn-ghost" onClick={onCreate}>
              {M.create}
            </button>
            <button type="button" className="sr-btn sr-btn-ghost" onClick={onJoin}>
              {M.join}
            </button>
          </div>
          {/* the language sits beside the word bank: one row, so the cover is no taller than before */}
          <div className="fr-cover-pair">
            <button type="button" className="sr-btn sr-btn-ghost" onClick={onBank}>
              {M.bank}
            </button>
            <LangPicker lang={lang} />
          </div>
        </div>
        <a className="sr-cover-credit" href="/">
          a TYPE A WORD game
        </a>
      </div>
    </div>
  );
}

// The run's progress, Quizlet-style: one ink bar under the HUD that fills as words settle (transform only),
// and a one-shot frame beat on every answer — ink for a capture, red ink for a miss.
// THE BEST LANE (solo, nov26): under it, your right answers so far against your best run's at the same point —
// two fills on one lane, and the two counts at its end. Passing the record prints a one-shot chip.
function BestLane({ right, best, total, aheadKey }) {
  const R = rushLang().race || {};
  const f = (n) => (total > 0 ? Math.min(1, n / total) : 0);
  const ahead = right > best;
  return (
    <div className={`fr-best${ahead ? ' ahead' : ''}`} aria-label={`${R.you} ${formatNum(right)} · ${R.record} ${formatNum(best)}`}>
      <span className="fr-best-track" aria-hidden="true">
        <span className="fr-best-ghost" style={{ transform: `scaleX(${f(best)})` }} />
        <span className="fr-best-you" style={{ transform: `scaleX(${f(right)})` }} />
      </span>
      <span className="fr-best-nums" aria-hidden="true">
        {R.you} <b>{formatNum(right)}</b> · {R.record} {formatNum(best)}
      </span>
      {aheadKey > 0 && (
        <span className="fr-best-chip" key={aheadKey} role="status">
          {R.ahead}
        </span>
      )}
    </div>
  );
}

function RunProgress({ settled, total, stamp }) {
  const frac = total > 0 ? Math.min(1, settled / total) : 0;
  const beat = stamp && (stamp.kind === 'miss' ? 'miss' : 'got');
  return (
    <>
      <div className="fr-progress" role="progressbar" aria-label="words done" aria-valuemin={0} aria-valuemax={total} aria-valuenow={settled}>
        <span className="fr-progress-fill" style={{ transform: `scaleX(${frac})` }} />
      </div>
      {beat && <div className={`fr-beat ${beat}`} key={`beat-${stamp.id}`} aria-hidden="true" />}
    </>
  );
}

// the press sheet for each solo screen: [headline in the language, English line, direction] — rushLang.js `press`

// ?mode=&level=&n=&theme=&pace= — a teacher's set (CaseSetup's "copy a link")
function readPreset() {
  try {
    const q = new URLSearchParams(window.location.search);
    if (!q.has('mode') && !q.has('level') && !q.has('theme')) return null;
    return {
      mode: q.get('mode') === 'briefing' ? 'briefing' : 'lineup',
      difficulty: q.get('level') || 'hard', // a teacher link with no level: HARD, like the setup's default
      length: Number(q.get('n')) || 20,
      category: q.get('theme') || null,
      pace: q.get('pace') === 'self' ? 'self' : 'timed',
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

export default function FrenchRushGame({ lang = 'fr' }) {
  usePlayClock(); // TIME PLAYED on the profile (Andy oct21: French Rush time was never counted)
  const L = RUSH_LANGS[lang] || RUSH_LANGS.fr;
  const PRESS_BY_SCREEN = L.press;
  const game = useSatRushGame({ packId: L.pack });
  const { view } = game;
  const appRef = useRef(null);
  const [bank, setBank] = useState(false);
  // CLASS ROOM: open = the class flow is mounted (and owns the socket). Opens on its own for a join
  // link, or when this tab already holds a class seat (a reload mid-class).
  const [classCode] = useState(readClassCode);
  const [classOpen, setClassOpen] = useState(() => !!classCode || hasClassSeat());
  const [classEntry, setClassEntry] = useState(classCode ? 'join' : 'setup'); // CREATE ROOM | JOIN ROOM
  const openClass = (entry) => {
    setClassEntry(entry);
    setClassOpen(true);
  };
  const [classState, setClassState] = useState({ playing: false, hostAway: false, offline: false });
  const classLeaveRef = useRef(null);
  const classStandbyRef = useRef(null); // a student's results → back to the class screen, seat kept
  const inClassRun = classOpen && classState.playing;
  const ui = (view.pack && view.pack.ui) || null;

  // THE BEST LANE (solo): the record for this language + mode + length, read when a run starts
  const playingSolo = view.phase === 'playing' && view.hasWord && !inClassRun && view.runTotal > 0;
  const bestKey = playingSolo ? `${view.mode}:${view.runTotal}` : null;
  const best = useMemo(() => (bestKey ? readBest(L.id, view.mode, view.runTotal) : null), [bestKey, L.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const bestNow = best ? bestAt(best, view.answered) : null;
  // the one-shot "ahead of your record" chip: each time you go from level-or-behind to ahead
  const aheadRef = useRef({ ahead: false, n: 0, key: null });
  if (aheadRef.current.key !== bestKey) aheadRef.current = { ahead: false, n: 0, key: bestKey };
  if (bestNow != null) {
    const ahead = view.cleared > bestNow;
    if (ahead && !aheadRef.current.ahead) aheadRef.current.n += 1;
    aheadRef.current.ahead = ahead;
  }
  // a finished solo run: keep it if it beat the record, and say so on the results
  // (once per finished run: the results object is rebuilt on every render, so the run is marked saved until the
  // page leaves the results)
  const [newBest, setNewBest] = useState(null);
  const savedRef = useRef(false);
  useEffect(() => {
    if (view.phase !== 'over') {
      savedRef.current = false;
      return;
    }
    if (inClassRun || !view.results || savedRef.current) return;
    savedRef.current = true;
    const r = view.results;
    const total = r.runTotal || 0;
    setNewBest(total ? saveIfBest(L.id, (r.spec && r.spec.mode) || view.mode, total, r.runLog) : null);
  }, [view.phase, view.results, inClassRun, L.id, view.mode]);

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
    <div
      className={`sr-app fr-app${inClassRun ? ' fr-class-on' : ''}`}
      ref={appRef}
      data-lang={L.id}
      style={L.accent ? { '--lang': L.accent.ink, '--lang-on': L.accent.on } : undefined}
    >
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
              showHeat={false}
              exitLabel="HOME"
              caseLabel="words"
              onExit={inClassRun ? leaveClassRun : home}
            />
            <RunProgress settled={view.settled} total={view.runTotal} stamp={view.stamp} />
            {inClassRun && classState.race && <TeamRace race={classState.race} mine={classState.team} variant="strip" />}
            {!inClassRun && bestNow != null && <BestLane right={view.cleared} best={bestNow} total={view.runTotal} aheadKey={aheadRef.current.n} />}
            <div className="sr-body">
              <WordCard view={view} onHint={game.hint} onSkip={game.skip} onContinue={game.continueRun} onPick={game.pickChoice} />
              {inClassRun && (classState.offline || classState.hostAway || view.pending !== 'idle') && (
                <div className={`fr-class-line${classState.offline || classState.hostAway ? ' alert' : ''}`} role="status">
                  {classState.offline ? 'reconnecting…' : classState.hostAway ? 'teacher reconnecting…' : 'waiting for the teacher…'}
                </div>
              )}
              {/* TAP-TO-ANSWER: a touch device answers by tapping a choice, so no field is mounted and
                  the soft keyboard can never open (feat/sat-tap). */}
              {view.answerMode !== 'tap' && <SatKeyInput active={view.phase === 'playing'} typeKey={game.typeKey} />}
            </div>
          </>
        )}
      </div>

      {classOpen && (
        <ClassFlow
          game={game}
          words={(view.pack && view.pack.words) || []}
          categories={(view.pack && view.pack.categories) || []}
          entry={classEntry}
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
        <Cover lang={L.id} onPlay={game.startGame} onBank={() => setBank(true)} onCreate={() => openClass('setup')} onJoin={() => openClass('join')} />
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
          pack={L.pack}
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
          banner={
            inClassRun && classState.race ? (
              <TeamRace race={classState.race} mine={classState.team} variant="strip" final={!!classState.done} />
            ) : newBest && newBest.isNew ? (
              <div className="fr-newbest" role="status">
                {(L.race || {}).newBest}
              </div>
            ) : null
          }
          ui={inClassRun && ui && ui.results ? { ...ui, results: { ...ui.results, again: ui.results.classAgain || 'Back to the class', menu: ui.results.classLeave || 'Leave the class' } } : ui}
          onAgain={inClassRun ? () => (classStandbyRef.current ? classStandbyRef.current() : leaveClassRun()) : game.startGame}
          onReplay={inClassRun ? null : game.replayMisses}
          onExit={inClassRun ? leaveClassRun : home}
        />
      )}
      <PressWipe />
    </div>
  );
}
