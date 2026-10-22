// CaseSetup.jsx — CASE SETUP: the run is finite now (Andy oct17: "on main screen the user can
// choose a difficulty as well as how many questions they want (for lineup). for briefing, they
// should just answer how many questions they learn"). Two choices and a go button, on the same
// paper page as PICK YOUR BEAT. The last choices are preselected, so a returning player's setup is
// one press. Both rows are radio groups (arrow keys move, Enter starts).
import { useState, useRef, useEffect } from 'react';
import { DIFFICULTY_ORDER, LENGTHS, normalizeSpec, difficultiesFor } from './runSpec';

const isBriefPreview = (mode) => mode === 'briefing';

function Choice({ label, options, value, onPick, render, stack = false, grid = false, duo = false, aside = null }) {
  const id = `sr-setup-${label.replace(/\s+/g, '-')}`;
  return (
    <div className={`sr-setup-row${stack ? ' stack' : ''}${grid ? ' grid' : ''}${duo ? ' duo' : ''}`}>
      <div className="sr-setup-labelrow">
        <div className="sr-setup-label" id={id}>
          {label}
        </div>
        {aside}
      </div>
      <div className="sr-setup-opts" role="radiogroup" aria-labelledby={id}>
        {options.map((o) => {
          const on = o === value;
          return (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={on}
              className={`sr-setup-opt${on ? ' sel' : ''}`}
              onClick={() => onPick(o)}
            >
              {render(o)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function CaseSetup({ mode = 'lineup', prefs = null, knownCount = 0, packSize = 0, categories = [], pack = 'sat', ui = null, onStart, onBack, onExit }) {
  const DIFFICULTIES = difficultiesFor(pack);
  const U = ui || {};
  const p = prefs || {};
  const initial = normalizeSpec({ mode, difficulty: p.difficulty, length: p[mode] });
  const [difficulty, setDifficulty] = useState(initial.difficulty);
  const [length, setLength] = useState(initial.length);
  // THEME (packs with categories — FRENCH RUSH's six AP themes + connectors): 'all' or one theme
  const catIds = categories.map((c) => c.id);
  const [category, setCategory] = useState(catIds.includes(p.category) ? p.category : 'all');
  const catLabel = (id) => (id === 'all' ? 'All themes' : (categories.find((c) => c.id === id) || {}).label || id);
  // PACE (packs with a default pace — FRENCH RUSH): 'self' (no clock) | 'timed'
  const hasPace = !!U.pace;
  const [pace, setPace] = useState(p.pace === 'timed' || p.pace === 'self' ? p.pace : U.pace || 'timed');
  const [copied, setCopied] = useState(false);
  // STUDY FIRST (FRENCH RUSH): leave out words already studied — on unless the player turned it off
  const [skipStudied, setSkipStudied] = useState(p.skipStudied !== false);
  const offerSkip = hasPace && isBriefPreview(mode);
  // TEACHER LINK: this exact set as a URL — a class opens it and lands here with it preselected
  function copyLink() {
    try {
      const q = new URLSearchParams({ mode, level: difficulty, n: String(length), pace });
      if (category !== 'all') q.set('theme', category);
      const url = `${window.location.origin}${window.location.pathname}?${q.toString()}`;
      const done = () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2200);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, done);
      else done();
    } catch {
      /* no clipboard — nothing to do */
    }
  }
  const goRef = useRef(null);
  useEffect(() => {
    if (goRef.current) goRef.current.focus();
  }, []);

  const isBrief = mode === 'briefing';
  return (
    <div className="sr-screen">
      <div className="sr-modeselect sr-setup">
        {(() => {
          const title = (U.modes && U.modes[mode] && U.modes[mode].title) || (isBrief ? 'BRIEFING' : 'LINEUP');
          return (
            <div className="sr-modeselect-head sr-print" data-v={title}>
              {title}
            </div>
          );
        })()}
        <div className="sr-setup-sub">{U.setupSub || 'case setup'}</div>

        {/* With a THEME row (FRENCH RUSH) the page splits into two columns on a wide screen —
            themes left, difficulty / length / go right — so it never needs a scrollbar. */}
        <div className={`sr-setup-cols${catIds.length ? ' has-themes' : ''}`}>
          {catIds.length > 0 && (
            <div className="sr-setup-col">
              <Choice
                label="theme"
                grid
                options={['all', ...catIds]}
                value={category}
                onPick={setCategory}
                render={(id) => <span className="sr-setup-opt-theme">{catLabel(id)}</span>}
              />
              {/* phones: the same choice as one dropdown row (the 8-card grid cost ~200px) */}
              <label className="sr-setup-select">
                <span className="sr-setup-label">theme</span>
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  {['all', ...catIds].map((id) => (
                    <option key={id} value={id}>
                      {catLabel(id)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          <div className="sr-setup-col">
            <Choice
              label="difficulty"
              stack
              options={DIFFICULTY_ORDER}
              value={difficulty}
              onPick={setDifficulty}
              render={(d) => (
                <>
                  <span className="sr-setup-opt-main">{DIFFICULTIES[d].label}</span>
                  <span className="sr-setup-opt-sub">{DIFFICULTIES[d].line}</span>
                </>
              )}
            />
            {hasPace && (
              <Choice
                label="pace"
                duo
                options={['self', 'timed']}
                value={pace}
                onPick={setPace}
                render={(v) => (
                  <>
                    <span className="sr-setup-opt-main">{v === 'self' ? 'MY PACE' : 'TIMED'}</span>
                    <span className="sr-setup-opt-sub">{v === 'self' ? 'no timer' : 'on the clock'}</span>
                  </>
                )}
              />
            )}
            <Choice
              label={isBrief ? 'words to study' : U.setupSub ? 'how many words' : 'words in the case'}
              options={LENGTHS[mode]}
              value={length}
              onPick={setLength}
              render={(n) => <span className="sr-setup-opt-main">{n}</span>}
              aside={
                offerSkip ? (
                  <label className="sr-setup-check">
                    <input type="checkbox" checked={skipStudied} onChange={(e) => setSkipStudied(e.target.checked)} />
                    <span>skip ones I&apos;ve studied</span>
                  </label>
                ) : null
              }
            />

            {packSize > 0 && (
              <div className="sr-setup-known">
                you know <b>{knownCount}</b> of {packSize} words
              </div>
            )}

            <button type="button" ref={goRef} className="sr-btn" onClick={() => onStart({
                  difficulty,
                  length,
                  category: category === 'all' ? null : category,
                  pace: hasPace ? pace : null,
                  skipStudied: offerSkip ? skipStudied : null,
                })}>
              {U.startLabel ? (isBrief ? 'Study the words' : U.startLabel) : isBrief ? 'Study the words' : 'Open the case'}
            </button>

          </div>
        </div>
        <div className="sr-setup-exits">
          {hasPace && (
            <button type="button" className="sr-linkbtn" onClick={copyLink}>
              {copied ? 'Link copied — send it to your class' : 'Teacher? Copy a link to this set'}
            </button>
          )}
          {onBack && (
            <button type="button" className="sr-exit-chip" onClick={onBack}>
              <span aria-hidden="true">←</span> {U.setupSub ? 'BACK' : 'MODES'}
            </button>
          )}
          {onExit && !U.setupSub && (
            <button type="button" className="sr-exit-chip" onClick={onExit} aria-label="Exit to menu">
              MENU
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
