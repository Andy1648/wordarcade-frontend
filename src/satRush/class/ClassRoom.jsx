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
//
// FIT (Andy oct20: "half of the stuff doesnt fit into frame … account for when there are more people"):
// every screen is ONE frame — a head, a body, and a foot that holds the actions. The frame never
// scrolls and the actions are always on screen; the body's lists (roster, names, summary) get denser
// as the class grows and only as a last resort scroll inside their own box.
import { useEffect, useRef, useState } from 'react';
import { useClassRoom } from './useClassRoom';
import { bandWords, difficultiesFor, DIFFICULTY_ORDER } from '../runSpec';
import { withArticle, speakFr, canSpeak, setAutoSpeak } from '../speak';
import { formatNum } from '../../format';
import './ClassRoom.css';

const LENGTHS = [10, 20, 30];
const MODES = [
  { id: 'briefing', label: 'TYPE IT', line: 'meaning → type the French' },
  { id: 'lineup', label: 'PICK IT', line: 'a lineup of French words' },
];
// where the word is read aloud: the teacher's screen at the reveal (one voice for the room), every
// student's phone as their card lands, or nowhere
const VOICES = [
  { id: 'projector', label: 'BOARD', line: 'read at the reveal' },
  { id: 'phones', label: 'PHONES', line: 'on each phone' },
  { id: 'off', label: 'OFF', line: 'silent' },
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

// a list gets denser as it grows (chip size / columns), so a 40-student class still fits the frame
function density(n) {
  return n > 24 ? 'dense' : n > 10 ? 'mid' : 'roomy';
}

/** One frame: head (title, sub, status), body (grows / scrolls inside), foot (actions, always visible). */
function Page({ title, sub, note, children, actions, onBack, backLabel = 'BACK', wide = false }) {
  return (
    <div className="sr-screen fr-class-screen">
      <div className={`sr-modeselect sr-setup fr-class-page${wide ? ' wide' : ''}`}>
        <div className="fr-class-head">
          {title && (
            <div className="sr-modeselect-head sr-print" data-v={title}>
              {title}
            </div>
          )}
          {sub && <div className="fr-class-sub">{sub}</div>}
          {note && (
            <div className="fr-class-status" role="status">
              {note}
            </div>
          )}
        </div>
        {children && <div className="fr-class-body">{children}</div>}
        {(actions || onBack) && (
          <div className="fr-class-foot">
            {actions}
            {onBack && (
              <button type="button" className="sr-exit-chip" onClick={onBack}>
                <span aria-hidden="true">←</span> {backLabel}
              </button>
            )}
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

const Kbd = () => (
  <span className="sr-kbd" aria-hidden="true">
    ⏎
  </span>
);

// ---- TEACHER: pick the set (a new class, or a new set in the class you're running) ----
function ClassSetup({ words, categories, onCreate, onBack, busy, again = null }) {
  const levels = difficultiesFor('fr');
  const prev = (again && again.set) || {};
  const [mode, setMode] = useState(prev.mode || 'briefing');
  const [level, setLevel] = useState(prev.level || 'standard');
  const [n, setN] = useState(10);
  const [theme, setTheme] = useState(prev.theme || 'all');
  const [voice, setVoice] = useState(prev.voice || 'projector');
  const label = (id) => (id === 'all' ? 'All themes' : (categories.find((c) => c.id === id) || {}).label || id);
  const pool = bandWords(words, level, theme === 'all' ? null : theme, 'fr');
  const go = () => {
    const rows = shuffled(pool).slice(0, n);
    if (!rows.length) return;
    onCreate({ set: { theme: theme === 'all' ? null : theme, level, mode, voice }, rows });
  };
  const count = (x) => <span className="sr-setup-opt-main">{x}</span>;
  const two = (list) => (id) => {
    const m = list.find((x) => x.id === id);
    return (
      <>
        <span className="sr-setup-opt-main">{m.label}</span>
        <span className="sr-setup-opt-sub">{m.line}</span>
      </>
    );
  };
  return (
    <Page
      title={again ? 'NEW SET' : 'CLASS ROOM'}
      sub={again ? 'same class, same code — students stay in' : 'pick the set — everyone plays the same words'}
      onBack={onBack}
      wide
      actions={
        <button type="button" className="sr-btn" onClick={go} disabled={busy || !pool.length}>
          {busy ? 'Opening…' : again ? 'Use this set' : 'Open the class'}
        </button>
      }
    >
      <div className="fr-class-setup">
        <div className="fr-class-setup-col">
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
            cls="fr-three"
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
          <Pick label="how many words" cls="fr-three" options={LENGTHS} value={n} onPick={setN} render={count} />
        </div>
        <div className="fr-class-setup-col">
          <Pick label="how they answer" cls="duo" options={MODES.map((m) => m.id)} value={mode} onPick={setMode} render={two(MODES)} />
          <Pick label="read words aloud" cls="fr-three" options={VOICES.map((v) => v.id)} value={voice} onPick={setVoice} render={two(VOICES)} />
          <div className="fr-class-hint">{pool.length < n ? `only ${pool.length} words in this set` : `${pool.length} words to draw from`}</div>
        </div>
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
function joinHost() {
  try {
    return `${window.location.host}/french-rush`;
  } catch {
    return 'typeaword.com/french-rush';
  }
}

function Chips({ names, onKick, tone = '', empty = '—', size = 0 }) {
  if (!names.length) return <div className="fr-class-none">{empty}</div>;
  const kick = (p) => {
    if (window.confirm(`Remove ${p.name} from the class?`)) onKick(p.id);
  };
  return (
    <ul className={`fr-class-chips ${density(Math.max(size, names.length))} ${tone}`}>
      {names.map((p, i) => (
        <li key={p.id || `${p.name}-${i}`} className={p.away ? 'away' : ''}>
          {onKick ? (
            <button type="button" className="fr-class-chip" onClick={() => kick(p)} aria-label={`remove ${p.name}`} title="remove from the class">
              <span className="fr-class-chip-name" title={p.name}>
                {p.name}
              </span>
              {p.away && <span className="fr-class-away">away</span>}
              <span className="fr-class-chip-x" aria-hidden="true">
                ✕
              </span>
            </button>
          ) : (
            <span className="fr-class-chip">
              <span className="fr-class-chip-name" title={p.name}>
                {p.name}
              </span>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function NamesToggle({ on, set }) {
  return (
    <button type="button" className="sr-linkbtn fr-class-names" onClick={() => set(!on)} aria-pressed={on}>
      {on ? 'Hide names' : 'Show names'} <span className="fr-class-key">N</span>
    </button>
  );
}

// The class at a glance: one bar, any class size. Static widths (no animation).
function TallyBar({ t, review }) {
  const total = Math.max(1, t.total);
  const parts = review
    ? [
        ['clean', t.clean, 'got it'],
        ['hinted', t.hinted, 'with hints'],
        ['miss', t.miss, 'missed'],
      ]
    : [
        ['done', t.answered, 'answered'],
        ['waiting', Math.max(0, t.total - t.answered), 'still working'],
      ];
  return (
    <div className="fr-class-tally" role="status">
      <div className="fr-class-bar" aria-hidden="true">
        {parts.map(([k, v]) => (v > 0 ? <span key={k} className={`seg ${k}`} style={{ width: `${(100 * v) / total}%` }} /> : null))}
      </div>
      <div className="fr-class-legend">
        {parts.map(([k, v, label]) => (
          <span key={k} className={`leg ${k}`}>
            <b>{formatNum(v)}</b> {label}
          </span>
        ))}
        {t.away > 0 && <span className="leg away">{formatNum(t.away)} away</span>}
      </div>
    </div>
  );
}

// Enter / Space / → run the screen's main action, N shows the names — a clicker or a keyboard runs the
// class from the front of the room. A focused control keeps its own keys.
function useConsoleKeys(primary, toggleNames) {
  const ref = useRef({ primary, toggleNames });
  ref.current = { primary, toggleNames };
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.tagName === 'BUTTON' || t.isContentEditable)) return;
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight' || e.key === 'PageDown') {
        if (ref.current.primary) {
          e.preventDefault();
          ref.current.primary();
        }
      } else if ((e.key === 'n' || e.key === 'N') && ref.current.toggleNames) {
        ref.current.toggleNames();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

// ---- TEACHER: the console ----
function HostConsole({ snap, tally, host, onLeave, offline, onNewSet }) {
  const [showNames, setShowNames] = useState(false);
  const [showGot, setShowGot] = useState(false); // "got it" names stay folded: who struggled is what matters
  const [copied, setCopied] = useState(false);
  const roster = snap.roster || [];
  const row = snap.rows && snap.rows[snap.index];
  const t = tally || snap.tally;
  const endClass = () => {
    if (window.confirm('End the class for everyone?')) onLeave();
  };
  const note = offline ? 'reconnecting…' : null;
  const voice = (snap.set && snap.set.voice) || 'projector';

  // BOARD voice: the console reads the answer once as each word is revealed (one voice for the room)
  const saidRef = useRef('');
  useEffect(() => {
    if (snap.phase !== 'review' || voice !== 'projector' || !row) return;
    const key = `${snap.round}:${snap.index}`;
    if (saidRef.current === key) return;
    saidRef.current = key;
    speakFr(row.word);
  }, [snap.phase, snap.index, snap.round, voice, row]);

  const word = snap.phase === 'word';
  const review = snap.phase === 'review';
  const last = snap.index + 1 >= snap.total;
  const primary =
    snap.phase === 'lobby' ? (roster.length ? host.start : null) : word ? host.reveal : review ? host.next : null;
  useConsoleKeys(primary, () => setShowNames((v) => !v));

  if (snap.phase === 'lobby') {
    const copy = () => {
      const done = () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      };
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(joinUrl(snap.code)).then(done, done);
      } catch {
        /* no clipboard */
      }
    };
    return (
      <Page
        title={snap.round > 1 ? 'NEXT SET' : 'CLASS ROOM'}
        sub={`${formatNum(snap.total)} words${snap.set && snap.set.replay ? ' · the ones the class missed' : ''}`}
        note={note}
        wide
        onBack={endClass}
        backLabel="END CLASS"
        actions={
          <button type="button" className="sr-btn" onClick={host.start} disabled={!roster.length}>
            Start — {formatNum(roster.length)} {roster.length === 1 ? 'student' : 'students'} <Kbd />
          </button>
        }
      >
        <div className={`fr-class-lobby${showNames && roster.length ? ' names' : ''}`}>
          <div className="fr-class-join">
            <div className="fr-class-joinat">
              join at <b>{joinHost()}</b>
            </div>
            <div className="fr-class-code" aria-label={`class code ${snap.code}`}>
              {snap.code}
            </div>
            <button type="button" className="sr-linkbtn" onClick={copy}>
              {copied ? 'Link copied' : 'Copy the join link'}
            </button>
          </div>
          <div className="fr-class-people">
            <div className="fr-class-joined">
              <b>{formatNum(roster.length)}</b> joined
              {roster.length > 0 && <NamesToggle on={showNames} set={setShowNames} />}
            </div>
            {roster.length === 0 && <div className="fr-class-none">no one yet — share the code</div>}
            {showNames && roster.length > 0 && <Chips names={roster} onKick={host.kick} size={roster.length} />}
          </div>
        </div>
      </Page>
    );
  }

  if (snap.phase === 'done') {
    const rows = (snap.summary || []).slice().sort((a, b) => b.miss - a.miss || b.hinted - a.hinted);
    const answered = rows.reduce((n, r) => n + r.clean + r.hinted + r.miss, 0);
    const got = rows.reduce((n, r) => n + r.clean + r.hinted, 0);
    // REPLAY = the words the class actually struggled with: missed by at least a quarter of the class
    // (or by anyone, in a small class), hardest first, at most 10 — not every word one student missed
    const missedRows = rows
      .filter((r) => {
        const tot = r.clean + r.hinted + r.miss;
        return r.miss > 0 && r.miss >= Math.max(1, Math.ceil(tot * 0.25));
      })
      .slice(0, 10)
      .map((r) => snap.rows && snap.rows[r.index])
      .filter(Boolean);
    return (
      <Page
        title="CLASS DONE"
        sub={answered ? `the class got ${Math.round((100 * got) / answered)}% · hardest words first` : 'hardest words first'}
        note={note}
        wide
        onBack={onLeave}
        backLabel="END CLASS"
        actions={
          <>
            {missedRows.length > 0 && (
              <button type="button" className="sr-btn" onClick={() => host.restart({ set: { ...snap.set, replay: true }, rows: shuffled(missedRows) })}>
                Replay the {formatNum(missedRows.length)} hardest
              </button>
            )}
            <button type="button" className={`sr-btn${missedRows.length ? ' sr-btn-ghost' : ''}`} onClick={onNewSet}>
              New set
            </button>
          </>
        }
      >
        <ol className={`fr-class-summary ${density(rows.length)}`}>
          {rows.map((r) => {
            const tot = Math.max(1, r.clean + r.hinted + r.miss);
            return (
              <li key={r.index}>
                <span className="fr-class-sum-word">{r.word}</span>
                <span className="fr-class-bar mini" aria-hidden="true">
                  {r.clean > 0 && <span className="seg clean" style={{ width: `${(100 * r.clean) / tot}%` }} />}
                  {r.hinted > 0 && <span className="seg hinted" style={{ width: `${(100 * r.hinted) / tot}%` }} />}
                  {r.miss > 0 && <span className="seg miss" style={{ width: `${(100 * r.miss) / tot}%` }} />}
                </span>
                <span className={`fr-class-sum-miss${r.miss ? ' bad' : ''}`} aria-label={`${r.miss} missed`}>
                  {r.miss ? `✗${formatNum(r.miss)}` : '✓'}
                </span>
              </li>
            );
          })}
        </ol>
      </Page>
    );
  }

  const who = t && t.who;
  const byName = (names) => (names || []).map((name) => ({ name }));
  return (
    <Page
      title={`WORD ${snap.index + 1} / ${formatNum(snap.total)}`}
      note={note}
      wide
      onBack={endClass}
      backLabel="END CLASS"
      actions={
        word ? (
          <button type="button" className="sr-btn" onClick={host.reveal}>
            Reveal the answer <Kbd />
          </button>
        ) : (
          <button type="button" className="sr-btn" onClick={host.next}>
            {last ? 'Finish' : 'Next word'} <Kbd />
          </button>
        )
      }
    >
      <div className={`fr-class-console${showNames ? ' names' : ''}`}>
        {row && (
          <div className="sr-panel fr-class-clue">
            <div className="sr-panel-label">{word ? 'the clue' : 'the answer'}</div>
            <div className="fr-class-gloss">{row.gloss}</div>
            {review && (
              <>
                <div className="fr-class-answer">
                  {withArticle(row.word, row.pos, row.gender)}
                  {canSpeak() && (
                    <button type="button" className="sr-say" onClick={() => speakFr(row.word)} aria-label={`say ${row.word}`}>
                      🔊
                    </button>
                  )}
                </div>
                {row.context && <p className="fr-class-context">“{row.context.replace(/_+/, row.word)}”</p>}
              </>
            )}
          </div>
        )}
        <div className="fr-class-side">
          {t && <TallyBar t={t} review={review} />}
          <NamesToggle on={showNames} set={setShowNames} />
          {showNames && who && (
            <div className="fr-class-who">
              {word ? (
                <div className="fr-class-group">
                  <div className="fr-class-group-label">still working</div>
                  <Chips names={byName(who.waiting)} empty="everyone answered" size={t.total} />
                </div>
              ) : (
                <>
                  {[
                    ['missed', who.miss, 'miss'],
                    ['with hints', who.hinted, 'hinted'],
                  ].map(([label, names, tone]) => (
                    <div className="fr-class-group" key={label}>
                      <div className="fr-class-group-label">
                        {label} · {formatNum(names.length)}
                      </div>
                      <Chips names={byName(names)} tone={tone} size={t.total} />
                    </div>
                  ))}
                  <div className="fr-class-group">
                    <div className="fr-class-group-label">
                      got it · {formatNum(who.clean.length)}
                      {who.clean.length > 0 && (
                        <button type="button" className="sr-linkbtn fr-class-more" onClick={() => setShowGot((v) => !v)} aria-pressed={showGot}>
                          {showGot ? 'hide' : 'show'}
                        </button>
                      )}
                    </div>
                    {showGot && <Chips names={byName(who.clean)} tone="clean" size={t.total} />}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
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
    if (e) e.preventDefault();
    if (!ok) return;
    try {
      window.localStorage.setItem('fr.class.name', name.trim());
    } catch {
      /* fine */
    }
    onJoin({ code: code.trim(), name: name.trim() });
  };
  return (
    <Page
      title="JOIN A CLASS"
      sub="your teacher has the code"
      onBack={onBack}
      actions={
        <button type="submit" form="fr-class-join" className="sr-btn" disabled={!ok || busy}>
          {busy ? 'Joining…' : 'Join'}
        </button>
      }
    >
      <form id="fr-class-join" className="fr-class-form" onSubmit={submit}>
        <label>
          <span className="sr-setup-label">class code</span>
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={8} autoCapitalize="characters" autoComplete="off" spellCheck={false} inputMode="text" />
        </label>
        <label>
          <span className="sr-setup-label">your name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} autoComplete="given-name" />
        </label>
        {error && <div className="fr-class-error">{error.message}</div>}
      </form>
    </Page>
  );
}

function StudentWait({ snap, onLeave }) {
  return (
    <Page title="YOU'RE IN" sub={`class ${snap.code}`} onBack={onLeave} backLabel="LEAVE">
      <div className="fr-class-hi">{snap.name}</div>
      <div className="fr-class-count">{snap.hostAway ? 'the teacher is reconnecting…' : snap.round > 1 ? 'next set coming up' : 'waiting for the teacher to start'}</div>
      <div className="fr-class-count">
        {formatNum(snap.total)} words · {formatNum(snap.studentCount)} in the class
      </div>
    </Page>
  );
}

function StudentDone({ snap, onLeave }) {
  const mine = snap.mine || [];
  const got = mine.filter((o) => o === 'clean' || o === 'hinted').length;
  return (
    <Page title="CLASS DONE" onBack={onLeave} backLabel="HOME">
      <div className="fr-class-hi">
        {got} / {formatNum(snap.total)}
      </div>
      <div className="fr-class-count">words you got · the teacher may start another set</div>
    </Page>
  );
}

/** FrenchRushGame mounts this for the whole class flow. `game` is the French Rush hook object. */
export default function ClassFlow({ game, words, categories, entry, initialCode, onExit, onStudentState, leaveRef }) {
  const cr = useClassRoom();
  const { snap, status } = cr;
  const [stage, setStage] = useState(entry || 'choose'); // 'choose' | 'setup' | 'join'
  const [pending, setPending] = useState(false); // a create/join is in flight
  const [newSet, setNewSet] = useState(false); // the teacher is picking the next set
  const gameRef = useRef(game);
  gameRef.current = game;
  const resultRef = useRef(cr.result);
  resultRef.current = cr.result;

  // ---- a STUDENT's run follows the class ----
  const runRef = useRef({ started: false, index: -1, round: 0 });
  const lastResultRef = useRef(null); // { index, outcome, hints } — resent if it was lost in a drop
  useEffect(() => {
    if (!snap) return;
    setPending(false);
    if (snap.role === 'host') setNewSet(false);
    if (snap.role !== 'student' || !snap.rows) return;
    const g = gameRef.current;
    let run = runRef.current;
    // a NEW SET (class_restart): drop the old run and wait for the teacher like a fresh join
    if (run.round !== snap.round) {
      if (run.started) {
        g.endClassRun();
        g.backToStart();
      }
      runRef.current = run = { started: false, index: -1, round: snap.round };
      lastResultRef.current = null;
    }
    if (snap.phase === 'lobby') return;
    if (!run.started) {
      if (snap.phase === 'done') return; // came back after the end: StudentDone shows the score
      setAutoSpeak(!snap.set || snap.set.voice === 'phones'); // the teacher chose where the voice is
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

  // leaving the class (or unmounting) puts the solo read-aloud back on
  useEffect(() => () => setAutoSpeak(true), []);

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
    setAutoSpeak(true);
    onExit();
  };
  if (leaveRef) leaveRef.current = leave; // FrenchRushGame's HOME / results exits leave the class too

  if (cr.closed) {
    return <Page title="CLASS ROOM" sub={CLOSED_COPY[cr.closed] || 'The class is over.'} onBack={leave} backLabel="HOME" />;
  }

  if (snap && snap.role === 'host') {
    if (newSet) {
      return (
        <ClassSetup
          words={words}
          categories={categories}
          again={snap}
          busy={pending}
          onBack={() => setNewSet(false)}
          onCreate={(opts) => {
            setPending(true);
            cr.host.restart(opts);
          }}
        />
      );
    }
    return <HostConsole snap={snap} tally={cr.tally} host={cr.host} onLeave={leave} offline={offline} onNewSet={() => setNewSet(true)} />;
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
    <Page
      title="CLASS ROOM"
      sub="the whole class plays the same words · the teacher moves everyone on"
      onBack={onExit}
      actions={
        <>
          <button type="button" className="sr-btn" onClick={() => setStage('join')}>
            Join a class
          </button>
          <button type="button" className="sr-btn sr-btn-ghost" onClick={() => setStage('setup')}>
            I&apos;m the teacher
          </button>
        </>
      }
    />
  );
}
