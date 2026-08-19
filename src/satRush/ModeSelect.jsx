// ModeSelect.jsx — the two ways to play, shown right after the cover. Two cards,
// one line each, in the bounty voice. There is deliberately NO paragraph
// explaining how either mode works: a mechanic that needs a sentence of
// instructions isn't legible enough, and the sentence doesn't fix that (the
// copy-purge rule). The modes teach themselves — BRIEFING by making you study,
// LINEUP by the suspects narrowing in front of you.
//
// The last choice is preselected: it wears the `sel` marker and takes focus, so a
// keyboard Enter repeats it. It is still one tap, and the choice is meaningful, so
// the picker is always shown (never auto-skipped to the last mode).
import { useRef, useEffect } from 'react';

const MODES = [
  { id: 'briefing', title: 'BRIEFING', line: 'study five words, then hunt them' },
  { id: 'lineup', title: 'LINEUP', line: "no help, but you'll see the suspects" },
];

export default function ModeSelect({ lastMode = 'briefing', onChoose, onExit }) {
  const selRef = useRef(null);

  // Preselect: focus the last-chosen card so Enter repeats it.
  useEffect(() => {
    if (selRef.current) selRef.current.focus();
  }, []);

  return (
    <div className="sr-screen">
      <div className="sr-modeselect">
        <div className="sr-modeselect-head sr-print" data-v={'PICK YOUR BEAT'}>
          PICK&nbsp;YOUR&nbsp;BEAT
        </div>

        <div className="sr-modecards">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              ref={m.id === lastMode ? selRef : null}
              className={`sr-modecard${m.id === lastMode ? ' sel' : ''}`}
              onClick={() => onChoose(m.id)}
            >
              <span className="sr-modecard-title">{m.title}</span>
              <span className="sr-modecard-line">{m.line}</span>
            </button>
          ))}
        </div>

        {onExit && (
          <button
            type="button"
            onClick={onExit}
            className="sr-exit-chip sr-modeselect-exit"
            aria-label="Exit"
          >
            EXIT
          </button>
        )}
      </div>
    </div>
  );
}
