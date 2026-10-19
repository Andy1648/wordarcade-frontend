// ClassRoom.jsx — FRENCH RUSH CLASS ROOM: a teacher hosts a code, students join, everyone plays the
// SAME words and the TEACHER advances (Andy oct19: "have user click to continue (or if multiplayer
// like owner)"). The teacher's screen is a projector CONSOLE — it never plays and never shows the
// French before the reveal; counts are on screen, names behind a toggle the teacher opens.
//
// <ClassFlow> is mounted by FrenchRushGame only while the player is in the class flow (so solo study
// never opens a socket). It renders the class's own screens (setup, lobby, console, join, waiting)
// and, for a STUDENT in a running class, drives the normal French Rush game through the hook's class
// API (startClassRun / classReveal / classAdvance) — the student plays on the ordinary poster.
// Every screen renders straight off the server's latest snapshot (useClassRoom).
import { useEffect, useRef, useState } from 'react';
import { useClassRoom } from './useClassRoom';
import { bandWords, difficultiesFor, DIFFICULTY_ORDER } from '../runSpec';
import { withArticle } from '../speak';
import './ClassRoom.css';

const LENGTHS = [10, 20, 30];
const MODES = [
  { id: 'briefing', label: 'TYPE IT', line: 'meaning → type the French' },
  { id: 'lineup', label: 'PICK IT', line: 'a lineup of French words' },
];

const CLOSED_COPY = {
  kicked: 'The teacher removed you from this class.',
  ended: 'The class is over.',
  host_gone: 'The teacher left the class.',
  expired: 'The class timed out.',
  idle: 'The class timed out.',
  superseded: 'This class is open in another tab.',
};

function shuffled(rows) {
  const a = rows.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function Page({ title, sub, children, onBack, backLabel = 'BACK', note = null }) {
  return (
    <div className="sr-screen">
      <div className="sr-modeselect sr-setup fr-class-page">
        {title && (
          <div className="sr-modeselect-head sr-print" data-v={title}>
            {title}
          </div>
        )}
        {sub && <div className="sr-setup-sub">{sub}</div>}
        {note && (
          <div className="fr-class-status" role="status">
            {note}
          </div>
        )}
        {children}
        {onBack && (
          <div className="sr-setup-exits">
            <button type="button" className="sr-exit-chip" onClick={onBack}>
              <span aria-hidden="true">←</span> {backLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Pick({ label, options, value, onPick, render, cls = '' }) {
  return (
    <div className={`sr-setup-row ${cls}`}>
      <div className="sr-setup-label">{label}</div>
      <div className="sr-setup-opts" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={o} type="button" role="radio" aria-checked={o === value} className={`sr-setup-opt${o === value ? ' sel' : ''}`} onClick={() => onPick(o)}>
            {render(o)}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---- TEACHER: pick the set ----
function ClassSetup({ words, categories, onCreate, onBack, busy }) {
  const levels = difficultiesFor('fr');
  const [mode, setMode] = useState('briefing');
  const [level, setLevel] = useState('standard');
  const [n, setN] = useState(10);
  const [theme, setTheme] = useState('all');
  const label = (id) => (id === 'all' ? 'All themes' : (categories.find((c) => c.id === id) || {}).label || id);
  const pool = bandWords(words, level, theme === 'all' ? null : theme, 'fr');
  const go = () => {
    const rows = shuffled(pool).slice(0, n);
    if (!rows.length) return;
    onCreate({ set: { theme: theme === 'all' ? null : theme, level, mode }, rows });
  };
  return (
    <Page title="CLASS ROOM" sub="pick the set — everyone plays the same words" onBack={onBack}>
      <div className="sr-setup-col">
        <label className="fr-class-select">
          <span className="sr-setup-label">theme</span>
          <select value={theme} onChange={(e) => setTheme(e.target.value)}>
            {['all', ...categories.map((c) => c.id)].map((id) => (
              <option key={id} value={id}>
                {label(id)}
              </option>
            ))}
          </select>
        </label>
        <Pick
          label="level"
          cls="stack"
          options={DIFFICULTY_ORDER}
          value={level}
          onPick={setLevel}
          render={(d) => (
            <>
              <span className="sr-setup-opt-main">{levels[d].label}</span>
              <span className="sr-setup-opt-sub">{levels[d].line}</span>
            </>
          )}
        />
        <Pick
          label="how they answer"
          cls="duo"
          options={MODES.map((m) => m.id)}
          value={mode}
          onPick={setMode}
          render={(id) => {
            const m = MODES.find((x) => x.id === id);
            return (
              <>
                <span className="sr-setup-opt-main">{m.label}</span>
                <span className="sr-setup-opt-sub">{m.line}</span>
              </>
            );
          }}
        />
        <Pick label="how many words" options={LENGTHS} value={n} onPick={setN} render={(x) => <span className="sr-setup-opt-main">{x}</span>} />
        <div className="sr-setup-known">{pool.length < n ? `only ${pool.length} words in this set` : `${pool.length} words to draw from`}</div>
        <button type="button" className="sr-btn" onClick={go} disabled={busy || !pool.length}>
          {busy ? 'Opening…' : 'Open the class'}
        </button>
      </div>
    </Page>
  );
}

function joinUrl(code) {
  try {
    return `${window.location.origin}/french-rush?class=${code}`;
  } catch {
    return `typeaword.com/french-rush?class=${code}`;
  }
}

function Roster({ roster, onKick, showNames }) {
  if (!roster.length) return <div className="fr-class-empty">no one yet — share the code</div>;
  if (!showNames) return <div className="fr-class-count">{roster.length} in the class</div>;
  return (
    <ul className="fr-class-roster">
      {roster.map((s) => (
        <li key={s.id} className={s.away ? 'away' : ''}>
          {s.name}
          {s.away && <span className="fr-class-away"> · away</span>}
          {onKick && (
            <button type="button" className="fr-class-kick" onClick={() => onKick(s.id)} aria-label={`remove ${s.name}`}>
              ✕
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

function NamesToggle({ on, set }) {
  return (
    <button type="button" className="sr-linkbtn fr-class-names" onClick={() => set(!on)} aria-pressed={on}>
      {on ? 'Hide names' : 'Show names'}
    </button>
  );
}

// ---- TEACHER: the console ----
function HostConsole({ snap, tally, host, onLeave, offline }) {
  const [showNames, setShowNames] = useState(false);
  const [copied, setCopied] = useState(false);
  const roster = snap.roster || [];
  const row = snap.rows && snap.rows[snap.index];
  const t = tally || snap.tally;
  const endClass = () => {
    if (window.confirm('End the class for everyone?')) onLeave();
  };

  if (snap.phase === 'lobby') {
    const url = joinUrl(snap.code);
    const copy = () => {
      const done = () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      };
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, done);
      } catch {
        /* no clipboard */
      }
    };
    return (
      <Page title="CLASS ROOM" sub={`${snap.total} words · go to typeaword.com/french-rush · JOIN A CLASS`} onBack={endClass} backLabel="END CLASS" note={offline ? 'reconnecting…' : null}>
        <div className="fr-class-code" aria-label={`class code ${snap.code}`}>
          {snap.code}
        </div>
        <button type="button" className="sr-linkbtn" onClick={copy}>
          {copied ? 'Link copied' : 'Copy the join link'}
        </button>
        <Roster roster={roster} onKick={host.kick} showNames={showNames} />
        {roster.length > 0 && <NamesToggle on={showNames} set={setShowNames} />}
        <button type="button" className="sr-btn" onClick={host.start} disabled={!roster.length}>
          Start — {roster.length} {roster.length === 1 ? 'student' : 'students'}
        </button>
      </Page>
    );
  }

  if (snap.phase === 'done') {
    const rows = (snap.summary || []).slice().sort((a, b) => b.miss - a.miss || b.hinted - a.hinted);
    return (
      <Page title="CLASS DONE" sub="hardest words first" onBack={onLeave} backLabel="END CLASS" note={offline ? 'reconnecting…' : null}>
        <table className="fr-class-summary">
          <thead>
            <tr>
              <th>word</th>
              <th>got it</th>
              <th>hints</th>
              <th>missed</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.index}>
                <td>{r.word}</td>
                <td>{r.clean}</td>
                <td>{r.hinted}</td>
                <td className={r.miss ? 'bad' : ''}>{r.miss}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Page>
    );
  }

  const word = snap.phase === 'word';
  const last = snap.index + 1 >= snap.total;
  const who = t && t.who;
  return (
    <Page title={`WORD ${snap.index + 1} / ${snap.total}`} onBack={endClass} backLabel="END CLASS" note={offline ? 'reconnecting…' : null}>
      {row && (
        <div className="sr-panel fr-class-clue">
          <div className="sr-panel-label">{word ? 'the clue' : 'the answer'}</div>
          <div className="fr-class-gloss">{row.gloss}</div>
          {!word && (
            <>
              <div className="fr-class-answer">{withArticle(row.word, row.pos, row.gender)}</div>
              {row.context && <p className="fr-class-context">“{row.context.replace(/_+/, row.word)}”</p>}
              {row.contextEn && <p className="fr-class-context en">{row.contextEn}</p>}
            </>
          )}
        </div>
      )}
      {t && (
        <div className="fr-class-tally" role="status">
          {word ? (
            <span>
              <b>{t.answered}</b> / {t.total} answered{t.away ? ` · ${t.away} away` : ''}
            </span>
          ) : (
            <span>
              <b>{t.clean}</b> got it · <b>{t.hinted}</b> with hints · <b>{t.miss}</b> missed
            </span>
          )}
        </div>
      )}
      {showNames && who && (
        <div className="fr-class-who">
          {word ? (
            <p>
              <b>still working:</b> {who.waiting.join(', ') || '—'}
            </p>
          ) : (
            <>
              <p>
                <b>got it:</b> {who.clean.join(', ') || '—'}
              </p>
              <p>
                <b>with hints:</b> {who.hinted.join(', ') || '—'}
              </p>
              <p>
                <b>missed:</b> {who.miss.join(', ') || '—'}
              </p>
            </>
          )}
        </div>
      )}
      <NamesToggle on={showNames} set={setShowNames} />
      {word ? (
        <button type="button" className="sr-btn" onClick={host.reveal}>
          Reveal the answer
        </button>
      ) : (
        <button type="button" className="sr-btn" onClick={host.next}>
          {last ? 'Finish' : 'Next word'}
        </button>
      )}
    </Page>
  );
}

// ---- STUDENT ----
function JoinScreen({ initialCode, onJoin, error, onBack, busy }) {
  const [code, setCode] = useState(initialCode || '');
  const [name, setName] = useState(() => {
    try {
      return window.localStorage.getItem('fr.class.name') || '';
    } catch {
      return '';
    }
  });
  const ok = code.trim().length >= 4 && name.trim().length > 0;
  const submit = (e) => {
    e.preventDefault();
    if (!ok) return;
    try {
      window.localStorage.setItem('fr.class.name', name.trim());
    } catch {
      /* fine */
    }
    onJoin({ code: code.trim(), name: name.trim() });
  };
  return (
    <Page title="JOIN A CLASS" sub="your teacher has the code" onBack={onBack}>
      <form className="fr-class-form" onSubmit={submit}>
        <label>
          <span className="sr-setup-label">class code</span>
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={8} autoCapitalize="characters" autoComplete="off" spellCheck={false} inputMode="text" />
        </label>
        <label>
          <span className="sr-setup-label">your name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} autoComplete="given-name" />
        </label>
        {error && <div className="fr-class-error">{error.message}</div>}
        <button type="submit" className="sr-btn" disabled={!ok || busy}>
          {busy ? 'Joining…' : 'Join'}
        </button>
      </form>
    </Page>
  );
}

function StudentWait({ snap, onLeave }) {
  return (
    <Page title="YOU'RE IN" sub={`class ${snap.code}`} onBack={onLeave} backLabel="LEAVE">
      <div className="fr-class-hi">{snap.name}</div>
      <div className="fr-class-count">{snap.hostAway ? 'the teacher is reconnecting…' : 'waiting for the teacher to start'}</div>
      <div className="fr-class-count">{snap.total} words</div>
    </Page>
  );
}

function StudentDone({ snap, onLeave }) {
  const mine = snap.mine || [];
  const got = mine.filter((o) => o === 'clean' || o === 'hinted').length;
  return (
    <Page title="CLASS DONE" onBack={onLeave} backLabel="HOME">
      <div className="fr-class-hi">
        {got} / {snap.total}
      </div>
      <div className="fr-class-count">words you got</div>
    </Page>
  );
}

/** FrenchRushGame mounts this for the whole class flow. `game` is the French Rush hook object. */
export default function ClassFlow({ game, words, categories, entry, initialCode, onExit, onStudentState, leaveRef }) {
  const cr = useClassRoom();
  const { snap, status } = cr;
  const [stage, setStage] = useState(entry || 'choose'); // 'choose' | 'setup' | 'join'
  const [pending, setPending] = useState(false); // a create/join is in flight
  const gameRef = useRef(game);
  gameRef.current = game;
  const resultRef = useRef(cr.result);
  resultRef.current = cr.result;

  // ---- a STUDENT's run follows the class ----
  const runRef = useRef({ started: false, index: -1 });
  const lastResultRef = useRef(null); // { index, outcome, hints } — resent if it was lost in a drop
  useEffect(() => {
    if (!snap) return;
    setPending(false);
    if (snap.role !== 'student' || !snap.rows) return;
    const g = gameRef.current;
    const run = runRef.current;
    if (snap.phase === 'lobby') return;
    if (!run.started) {
      if (snap.phase === 'done') return; // came back after the end: StudentDone shows the score
      g.startClassRun({
        rows: snap.rows,
        mode: snap.set && snap.set.mode,
        startAt: snap.index,
        onSettle: (outcome, hints) => {
          const r = { index: runRef.current.index, outcome, hints };
          lastResultRef.current = r;
          resultRef.current(r.index, r.outcome, r.hints);
        },
      });
      run.started = true;
      run.index = snap.index;
    }
    const target = snap.phase === 'done' ? snap.total : snap.index;
    while (run.index < target) {
      g.classAdvance();
      run.index += 1;
    }
    if (snap.phase === 'review' && run.index === snap.index) g.classReveal();
    // a result sent while the socket was down never arrived — send it again
    const lr = lastResultRef.current;
    if (snap.phase === 'word' && lr && lr.index === snap.index && snap.mine && snap.mine[snap.index] == null) {
      resultRef.current(lr.index, lr.outcome, lr.hints);
    }
  }, [snap]);

  // Tell FrenchRushGame whether the game screens belong to the class right now.
  const studentPlaying = !!(snap && snap.role === 'student' && runRef.current.started);
  const hostAway = !!(snap && snap.hostAway);
  const offline = status !== 'open';
  useEffect(() => {
    if (onStudentState) onStudentState({ playing: studentPlaying, hostAway, offline });
  }, [studentPlaying, hostAway, offline, onStudentState]);

  useEffect(() => {
    if (cr.error) setPending(false);
  }, [cr.error]);

  const leave = () => {
    cr.leave();
    gameRef.current.endClassRun();
    onExit();
  };
  if (leaveRef) leaveRef.current = leave; // FrenchRushGame's HOME / results exits leave the class too

  if (cr.closed) {
    return (
      <Page title="CLASS ROOM" sub={CLOSED_COPY[cr.closed] || 'The class is over.'} onBack={leave} backLabel="HOME" />
    );
  }

  if (snap && snap.role === 'host') {
    return (
      <>
        <HostConsole snap={snap} tally={cr.tally} host={cr.host} onLeave={leave} offline={offline} />
      </>
    );
  }

  if (snap && snap.role === 'student') {
    if (runRef.current.started) {
      // the game screens (FrenchRushGame) are showing, with the class status line in its body
      return null;
    }
    if (snap.phase === 'done') return <StudentDone snap={snap} onLeave={leave} />;
    return <StudentWait snap={snap} onLeave={leave} />;
  }

  if (cr.hasSeat) {
    return <Page title="CLASS ROOM" sub={offline ? 'reconnecting… (the server can take ~30 s to wake up)' : 'getting back into your class…'} onBack={leave} backLabel="LEAVE" />;
  }

  if (offline) {
    return <Page title="CLASS ROOM" sub="waking the server… (this can take ~30 seconds)" onBack={onExit} />;
  }

  if (stage === 'setup') {
    return (
      <ClassSetup
        words={words}
        categories={categories}
        busy={pending}
        onBack={() => setStage('choose')}
        onCreate={(opts) => {
          setPending(true);
          cr.create({ ...opts, name: 'Teacher' });
        }}
      />
    );
  }

  if (stage === 'join') {
    return (
      <JoinScreen
        initialCode={initialCode}
        error={cr.error}
        busy={pending}
        onBack={() => {
          cr.clearError();
          setStage('choose');
        }}
        onJoin={(v) => {
          setPending(true);
          cr.join(v);
        }}
      />
    );
  }

  return (
    <Page title="CLASS ROOM" sub="the whole class plays the same words · the teacher moves everyone on" onBack={onExit}>
      <button type="button" className="sr-btn" onClick={() => setStage('join')}>
        Join a class
      </button>
      <button type="button" className="sr-btn sr-btn-ghost" onClick={() => setStage('setup')}>
        I&apos;m the teacher
      </button>
    </Page>
  );
}
