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
import { useEffect, useMemo, useRef, useState } from 'react';
import PrintPicker from '../PrintPicker';
import { usePressOnChange } from '../press';
import { useClassRoom } from './useClassRoom';
import { qrPath } from './qr';
import { classReport } from './classReport';
import { bandWords, difficultiesFor, DIFFICULTY_ORDER } from '../runSpec';
import { withArticle, speakFr, setAutoSpeak } from '../speak';
import SayButton from '../SayButton';
import { formatNum } from '../../format';
import EnglishLine from '../EnglishLine';
import './ClassRoom.css';
import FitText from '../../components/kit/FitText.jsx';
import { LevelLabel } from '../CaseSetup';
import { getPack, posLabelOf } from '../packs';
import { rushLang } from '../rushLang';

const LENGTHS = [10, 20, 30];
const MODES = [
  { id: 'briefing', label: 'TYPE IT' },
  { id: 'lineup', label: 'PICK IT' },
];
// nov21: the room's first set is 20 words (Andy: defaults TIMED + 20 words — a room is always teacher-paced)
const DEFAULT_WORDS = 20;
// where the word is read aloud: the teacher's screen at the reveal (one voice for the room), every
// student's phone as their card lands, or nowhere
const VOICES = [
  { id: 'projector', label: 'BOARD', line: 'read at the reveal' },
  { id: 'phones', label: 'PHONES', line: 'on each phone' },
  { id: 'off', label: 'OFF', line: 'silent' },
];

const CLOSED_COPY = {
  kicked: 'The teacher removed you from this room.',
  ended: 'The room is closed.',
  host_gone: 'The teacher left the room.',
  expired: 'The room timed out.',
  idle: 'The room timed out.',
  superseded: 'This room is open in another tab.',
};

function shuffled(rows) {
  const a = rows.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// the longest word in a line (its letters), floored so a short word never blows up past the type cap
function longest(text) {
  return Math.max(6, ...String(text || '').split(/\s+/).map((w) => w.length));
}

// a list gets denser as it grows (chip size / columns), so a 40-student class still fits the frame
function density(n) {
  return n > 24 ? 'dense' : n > 10 ? 'mid' : 'roomy';
}

// one empty box per letter of the French (a space stays a gap) — the slots the students are filling
function LetterBoxes({ word }) {
  const parts = String(word || '').split(/(\s+)/).filter(Boolean);
  return (
    <div className="fr-class-boxes" role="img" aria-label={`${String(word || '').replace(/\s+/g, '').length} letters`}>
      {parts.map((p, i) =>
        /\s/.test(p) ? (
          <span key={i} className="fr-class-boxgap" />
        ) : (
          <span key={i} className="fr-class-boxword">
            {Array.from(p).map((_, j) => (
              <i key={j} />
            ))}
          </span>
        ),
      )}
    </div>
  );
}

/** One frame: head (title, sub, status), body (grows / scrolls inside), foot (actions, always visible). */
function Page({ title, sub, note, children, actions, onBack, backLabel = 'BACK', wide = false, progress = null }) {
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
          {progress != null && (
            <div className="fr-progress fr-class-progress" aria-hidden="true">
              <span className="fr-progress-fill" style={{ transform: `scaleX(${Math.min(1, Math.max(0, progress))})` }} />
            </div>
          )}
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
  const levels = difficultiesFor(rushLang().pack);
  const prev = (again && again.set) || {};
  const [mode, setMode] = useState(prev.mode || 'briefing');
  const [level, setLevel] = useState(prev.level || 'hard'); // nov24 round 2: HARD by default, like solo
  const [n, setN] = useState(DEFAULT_WORDS);
  const [theme, setTheme] = useState(prev.theme || 'all');
  const [voice, setVoice] = useState(prev.voice || 'projector');
  const label = (id) => (id === 'all' ? 'All themes' : (categories.find((c) => c.id === id) || {}).label || id);
  const pool = bandWords(words, level, theme === 'all' ? null : theme, rushLang().pack);
  const go = () => {
    // LANGUAGE RUSH: a non-French row carries its language, so a student who opened another language's
    // page is sent to the right one (ClassFlow); French rows go out exactly as before
    const lang = rushLang().id;
    const rows = shuffled(pool)
      .slice(0, n)
      .map((r) => (lang === 'fr' ? r : { ...r, lang }));
    if (!rows.length) return;
    onCreate({ set: { theme: theme === 'all' ? null : theme, level, mode, voice }, rows });
  };
  const count = (x) => <span className="sr-setup-opt-main">{x}</span>;
  // nov21 (Andy: "too much stuff, more concise"): option names only — no pitch line under each one
  const one = (list) => (id) => <span className="sr-setup-opt-main">{list.find((x) => x.id === id).label}</span>;
  return (
    <Page
      title={again ? 'NEW SET' : 'CREATE ROOM'}
      onBack={onBack}
      wide
      actions={
        <button type="button" className="sr-btn fr-go" onClick={go} disabled={busy || !pool.length}>
          {busy ? 'Opening…' : again ? 'Use this set' : 'Create room'}
        </button>
      }
    >
      <div className="fr-class-setup fr-setup-grid">
        <Pick label="difficulty" cls="stack" options={DIFFICULTY_ORDER} value={level} onPick={setLevel} render={(d) => <LevelLabel level={levels[d]} />} />
        <div className="fr-setup-rest">
          <PrintPicker
            className="fr-class-select"
            label="theme"
            value={theme}
            options={['all', ...categories.map((c) => c.id)].map((id) => ({ value: id, label: label(id) }))}
            onChange={setTheme}
          />
          <Pick label="words" cls="fr-three" options={LENGTHS} value={n} onPick={setN} render={count} />
          <Pick label="answer by" cls="duo" options={MODES.map((m) => m.id)} value={mode} onPick={setMode} render={one(MODES)} />
          <Pick label="voice" cls="fr-three" options={VOICES.map((v) => v.id)} value={voice} onPick={setVoice} render={one(VOICES)} />
          {pool.length < n && <div className="fr-class-hint">only {pool.length} words in this set</div>}
        </div>
      </div>
    </Page>
  );
}

function joinUrl(code) {
  try {
    return `${window.location.origin}/${rushLang().slug}?class=${code}`;
  } catch {
    return `typeaword.com/${rushLang().slug}?class=${code}`;
  }
}
function joinHost() {
  try {
    return `${window.location.host}/${rushLang().slug}`;
  } catch {
    return `typeaword.com/${rushLang().slug}`;
  }
}

// Clipboard with a fallback for a browser that blocks the async API (an old Chromebook build, an
// http:// school proxy): a hidden textarea + execCommand. Resolves true when the text was copied.
function copyText(text) {
  const legacy = () => {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  };
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(
        () => true,
        () => legacy(),
      );
    }
  } catch {
    /* fall through */
  }
  return Promise.resolve(legacy());
}

// A label that says "Copied" for 2 s after a copy (or "Couldn't copy").
function useCopied() {
  const [state, setState] = useState(null); // null | 'ok' | 'fail'
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const run = (text) =>
    copyText(text).then((ok) => {
      setState(ok ? 'ok' : 'fail');
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setState(null), 2000);
    });
  return [state, run];
}

// The join link as a QR code — generated here (qr.js), never fetched. Dark on a fixed white tile so
// it scans whatever the page colours are.
function JoinQr({ url }) {
  const qr = useMemo(() => qrPath(url), [url]);
  if (!qr) return null;
  return (
    <figure className="fr-class-qr">
      <svg viewBox={`0 0 ${qr.size} ${qr.size}`} role="img" aria-label="QR code: scan to join the class" shapeRendering="crispEdges">
        <rect width={qr.size} height={qr.size} fill="#fff" />
        <path d={qr.d} fill="#111" />
      </svg>
      <figcaption>scan to join</figcaption>
    </figure>
  );
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
              <FitText className="fr-class-chip-name" title={p.name} translate="no">{p.name}</FitText>
              {p.away && <span className="fr-class-away">away</span>}
              <span className="fr-class-chip-x" aria-hidden="true">
                ✕
              </span>
            </button>
          ) : (
            <span className="fr-class-chip">
              <FitText className="fr-class-chip-name" title={p.name} translate="no">{p.name}</FitText>
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
      <span className="fr-class-names-label">{on ? 'Hide names' : 'Show names'}</span> <span className="fr-class-key">N</span>
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
            {/* keyed by the value: a count that moves stamps itself in again (the console feels the room) */}
            <b key={v} className="fr-pop">
              {formatNum(v)}
            </b>{' '}
            {label}
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
      if (e.defaultPrevented || e.repeat) return;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      // a focused button keeps Enter / Space (its own click); the clicker's → / PageDown and N always reach the
      // console (oct26: after one mouse click on REVEAL, a presenter clicker did nothing for the rest of class)
      if (t && t.tagName === 'BUTTON' && (e.key === 'Enter' || e.key === ' ')) return;
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
function HostConsole({ snap, tally, host, onLeave, offline, onNewSet, categories = [] }) {
  const [showNames, setShowNames] = useState(false);
  const [showGot, setShowGot] = useState(false); // "got it" names stay folded: who struggled is what matters
  const [copied, copy] = useCopied();
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
    const url = joinUrl(snap.code);
    return (
      <Page
        title={snap.round > 1 ? 'NEXT SET' : 'ROOM OPEN'}
        note={note}
        wide
        onBack={endClass}
        backLabel="END CLASS"
        actions={
          <button type="button" className="sr-btn fr-go" onClick={host.start} disabled={!roster.length}>
            Start — {formatNum(roster.length)} {roster.length === 1 ? 'student' : 'students'} <Kbd />
          </button>
        }
      >
        <div className={`fr-class-lobby${showNames && roster.length ? ' names' : ''}`}>
          <div className="fr-class-join">
            <div className="fr-class-joinat">
              join at <b>{joinHost()}</b>
            </div>
            <div className="fr-class-joinrow">
              <JoinQr url={url} />
              <div className="fr-class-code" aria-label={`class code ${snap.code}`}>
                {snap.code}
              </div>
            </div>
            <button type="button" className="sr-linkbtn" onClick={() => copy(url)}>
              {copied === 'ok' ? 'Link copied' : copied === 'fail' ? "Couldn't copy — use the code" : 'Copy the join link'}
            </button>
          </div>
          <div className="fr-class-people">
            <div className="fr-class-joined">
              {/* keyed by the count: each new student stamps the number in again */}
              <b key={roster.length} className="fr-class-joined-n">
                {formatNum(roster.length)}
              </b>
              <span className="fr-class-joined-label">{roster.length === 1 ? 'student in' : 'students in'}</span>
            </div>
            {roster.length === 0 && <div className="fr-class-none">waiting…</div>}
            {roster.length > 0 && <NamesToggle on={showNames} set={setShowNames} />}
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
    const pct = answered ? Math.round((100 * got) / answered) : 0;
    const totals = {
      total: answered,
      clean: rows.reduce((n, r) => n + r.clean, 0),
      hinted: rows.reduce((n, r) => n + r.hinted, 0),
      miss: rows.reduce((n, r) => n + r.miss, 0),
      away: 0,
    };
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
            <button type="button" className="sr-exit-chip fr-class-report" onClick={() => copy(classReport({ snap, categories, modes: MODES }))}>
              {copied === 'ok' ? 'Report copied' : copied === 'fail' ? "Couldn't copy" : 'Copy class report'}
            </button>
          </>
        }
      >
        <div className="fr-class-done">
          <div className="sr-panel fr-class-score">
            <div className="sr-panel-label">the class</div>
            <div className="fr-class-score-n sr-print" data-v={`${pct}%`}>
              {pct}%
            </div>
            <TallyBar t={totals} review />
          </div>
          <ol className={`fr-class-summary ${density(rows.length)}`}>
            {rows.map((r) => {
              const tot = Math.max(1, r.clean + r.hinted + r.miss);
              const w = snap.rows && snap.rows[r.index];
              return (
                <li key={r.index} className={r.miss ? 'missed' : ''}>
                  <span className="fr-class-sum-word">
                    <b>{w ? withArticle(w.word, w.pos, w.gender) : r.word}</b>
                    {w && w.gloss && <span className="fr-class-sum-gloss">{w.gloss}</span>}
                  </span>
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
        </div>
      </Page>
    );
  }

  const who = t && t.who;
  const byName = (names) => (names || []).map((name) => ({ name }));
  return (
    <Page
      title={`WORD ${snap.index + 1} / ${formatNum(snap.total)}`}
      note={note}
      progress={(snap.index + (review ? 1 : 0)) / Math.max(1, snap.total)}
      wide
      onBack={endClass}
      backLabel="END CLASS"
      actions={
        word ? (
          <button type="button" className="sr-btn fr-go" onClick={host.reveal}>
            Reveal the answer <Kbd />
          </button>
        ) : (
          <button type="button" className="sr-btn fr-go" onClick={host.next}>
            {last ? 'Finish' : 'Next word'} <Kbd />
          </button>
        )
      }
    >
      <div className={`fr-class-console${showNames ? ' names' : ''}`}>
        {/* THE PROMPT (nov21, a teacher: "have the teacher be able to see the problem"): the board shows what
            every student is answering, as big as the panel allows — the meaning, its part of speech and one
            box per letter of the French (the slots on every student's card); at the reveal the French answer
            stamps in under it. */}
        {row && (
          <div className={`sr-panel fr-class-clue${review ? ' revealed' : ''}`}>
            <div className="fr-class-prompt-meta">{posLabelOf(getPack(rushLang().pack), row)}</div>
            <div className="fr-class-gloss" style={{ '--len': longest(row.gloss) }}>
              {row.gloss}
            </div>
            {word && <LetterBoxes word={row.word} />}
            {review && (
              <>
                <div className="fr-class-answer" key={`a-${snap.index}`} style={{ '--len': longest(withArticle(row.word, row.pos, row.gender)) + 1 }}>
                  {withArticle(row.word, row.pos, row.gender)}
                  <SayButton word={row.word} />
                </div>
                {row.context && <p className="fr-class-context">“{row.context.replace(/_+/, row.word)}”</p>}
                <EnglishLine text={row.contextEn} className="fr-class-context-en" />
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
      title="JOIN ROOM"
      onBack={onBack}
      actions={
        <button type="submit" form="fr-class-join" className="sr-btn" disabled={!ok || busy}>
          {busy ? 'Joining…' : 'Join'}
        </button>
      }
    >
      <form id="fr-class-join" className="fr-class-form" onSubmit={submit}>
        <label>
          <span className="sr-setup-label">room code</span>
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
    <Page title="YOU'RE IN" sub={snap.code} onBack={onLeave} backLabel="LEAVE">
      <div className="fr-class-hi">{snap.name}</div>
      <div className="fr-class-count">{snap.hostAway
          ? 'the teacher is reconnecting…'
          : snap.phase === 'review'
            ? 'you join in at the next word'
            : snap.round > 1
              ? 'next set coming up'
              : 'waiting for the teacher to start'}</div>
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
      <div className="fr-class-count">words right</div>
    </Page>
  );
}

/** FrenchRushGame mounts this for the whole class flow. `game` is the French Rush hook object. */
export default function ClassFlow({ game, words, categories, entry, initialCode, onExit, onStudentState, leaveRef, standbyRef }) {
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
    // LANGUAGE RUSH: this room plays another language's words (a student typed a Spanish room's code on the
    // French page) — go to that language's page; the seat is in this tab's sessionStorage, so it rejoins
    const roomLang = (snap.rows[0] && snap.rows[0].lang) || 'fr';
    if (roomLang !== rushLang().id) {
      const to = { fr: 'french-rush', es: 'spanish-rush', it: 'italian-rush', la: 'latin-rush', zh: 'chinese-rush' }[roomLang];
      if (to) {
        try {
          window.location.assign(`/${to}`);
        } catch {
          /* stay */
        }
        return;
      }
    }
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
      // Joined (or reloaded) while a word's answer is up: that word is over, and starting the run on
      // it would score it a MISS on this student's own results. Wait for the next word.
      if (snap.phase === 'review') return;
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
  // "Back to the class" on a student's results: close the results but KEEP the seat — the class
  // screen shows the score and the next set (class_restart) drops them straight back in.
  const [, bump] = useState(0);
  const standby = () => {
    gameRef.current.endClassRun();
    gameRef.current.backToStart();
    runRef.current = { started: false, index: -1, round: runRef.current.round };
    bump((n) => n + 1);
  };
  if (standbyRef) standbyRef.current = standby;

  // THE PRESS (oct26): each class screen comes off the press titled in French (English underneath); on the
  // console every new word is a quick sheet — MOT 4 — so the room sees the page turn.
  // (LANGUAGE RUSH: titled in the page's language — rushLang classPress)
  const P = rushLang().classPress;
  let screen;
  let press = null;
  if (cr.closed) {
    screen = 'closed';
    press = [P.bye, 'class over', 'back'];
  } else if (snap && snap.role === 'host') {
    if (newSet) {
      screen = 'newset';
      press = [P.newSet, 'new set'];
    } else if (snap.phase === 'lobby') {
      screen = `lobby-${snap.round}`;
      press = [P.open, 'the class is open'];
    } else if (snap.phase === 'done') {
      screen = `done-${snap.round}`;
      press = [P.done, 'class done'];
    } else {
      screen = `run-${snap.round}-${snap.index}`;
      press = snap.index === 0 ? [P.go, 'here we go'] : [P.word(snap.index + 1), `word ${snap.index + 1} of ${snap.total}`, 'forward', true];
    }
  } else if (snap && snap.role === 'student') {
    if (runRef.current.started) screen = 'student-run'; // the game presses its own sheet
    else if (snap.phase === 'done') {
      screen = 'student-done';
      press = [P.done, 'class done'];
    } else {
      screen = 'student-wait';
      press = snap.round > 1 ? [P.wait, 'next set soon'] : [P.welcome, "you're in"];
    }
  } else if (cr.hasSeat || offline) {
    screen = 'connecting';
  } else {
    screen = stage;
    press = stage === 'setup' ? [P.teacher, 'create room'] : stage === 'join' ? [P.join, 'join room'] : [P.room, 'room'];
  }
  usePressOnChange(screen, press, entry !== 'join');

  if (cr.closed) {
    return <Page title="ROOM CLOSED" sub={CLOSED_COPY[cr.closed] || 'The room is closed.'} onBack={leave} backLabel="HOME" />;
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
    return <HostConsole snap={snap} tally={cr.tally} host={cr.host} onLeave={leave} offline={offline} onNewSet={() => setNewSet(true)} categories={categories} />;
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
    return <Page title="ROOM" sub={offline ? 'reconnecting… (can take ~30 s)' : 'getting back in…'} onBack={leave} backLabel="LEAVE" />;
  }

  if (offline) {
    return <Page title="ROOM" sub="connecting… (can take ~30 s)" onBack={onExit} />;
  }

  if (stage === 'setup') {
    return (
      <ClassSetup
        words={words}
        categories={categories}
        busy={pending}
        onBack={() => (entry === 'choose' ? setStage('choose') : onExit())}
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
          if (entry === 'choose') setStage('choose');
          else onExit();
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
      title="ROOM"
      onBack={onExit}
      actions={
        <>
          <button type="button" className="sr-btn" onClick={() => setStage('join')}>
            Join room
          </button>
          <button type="button" className="sr-btn sr-btn-ghost" onClick={() => setStage('setup')}>
            Create room
          </button>
        </>
      }
    />
  );
}
