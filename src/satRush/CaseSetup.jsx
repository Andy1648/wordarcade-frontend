// CaseSetup.jsx — CASE SETUP: the run is finite now (Andy oct17: "on main screen the user can
// choose a difficulty as well as how many questions they want (for lineup). for briefing, they
// should just answer how many questions they learn"). Two choices and a go button, on the same
// paper page as PICK YOUR BEAT. The last choices are preselected, so a returning player's setup is
// one press. Both rows are radio groups (arrow keys move, Enter starts).
import { useState, useRef, useEffect } from 'react';
import { DIFFICULTIES, DIFFICULTY_ORDER, LENGTHS, normalizeSpec } from './runSpec';

function Choice({ label, options, value, onPick, render, stack = false }) {
  const id = `sr-setup-${label.replace(/\s+/g, '-')}`;
  return (
    <div className={`sr-setup-row${stack ? ' stack' : ''}`}>
      <div className="sr-setup-label" id={id}>
        {label}
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

export default function CaseSetup({ mode = 'lineup', prefs = null, knownCount = 0, packSize = 0, onStart, onBack, onExit }) {
  const p = prefs || {};
  const initial = normalizeSpec({ mode, difficulty: p.difficulty, length: p[mode] });
  const [difficulty, setDifficulty] = useState(initial.difficulty);
  const [length, setLength] = useState(initial.length);
  const goRef = useRef(null);
  useEffect(() => {
    if (goRef.current) goRef.current.focus();
  }, []);

  const isBrief = mode === 'briefing';
  return (
    <div className="sr-screen">
      <div className="sr-modeselect sr-setup">
        <div className="sr-modeselect-head sr-print" data-v={isBrief ? 'BRIEFING' : 'LINEUP'}>
          {isBrief ? 'BRIEFING' : 'LINEUP'}
        </div>
        <div className="sr-setup-sub">case setup</div>

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
        <Choice
          label={isBrief ? 'words to study' : 'words in the case'}
          options={LENGTHS[mode]}
          value={length}
          onPick={setLength}
          render={(n) => <span className="sr-setup-opt-main">{n}</span>}
        />

        {packSize > 0 && (
          <div className="sr-setup-known">
            you know <b>{knownCount}</b> of {packSize} words
          </div>
        )}

        <button type="button" ref={goRef} className="sr-btn" onClick={() => onStart({ difficulty, length })}>
          {isBrief ? 'Study the words' : 'Open the case'}
        </button>
        <div className="sr-setup-exits">
          {onBack && (
            <button type="button" className="sr-exit-chip" onClick={onBack}>
              <span aria-hidden="true">←</span> MODES
            </button>
          )}
          {onExit && (
            <button type="button" className="sr-exit-chip" onClick={onExit} aria-label="Exit to menu">
              MENU
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
