// PressWipe.jsx — the ONE pooled French Rush transition sheet. Mounted once inside the .sr-app page (absolute,
// never keyed, never remounted, pointer-events:none, aria-hidden); press.js replays it. See press.js.
import { useEffect, useRef } from 'react';
import { registerPress, MAX_LETTERS } from './press';

const LETTERS = Array.from({ length: MAX_LETTERS }, (_, i) => i);

export default function PressWipe() {
  const ref = useRef(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return undefined;
    return registerPress({
      root,
      sheet: root.querySelector('.fr-press-sheet'),
      word: root.querySelector('.fr-press-word'),
      plate: root.querySelector('.fr-press-plate'),
      kicker: root.querySelector('.fr-press-kicker'),
      letters: Array.from(root.querySelectorAll('.fr-press-letter')),
    });
  }, []);
  return (
    <div className="fr-press" ref={ref} data-state="idle" aria-hidden="true">
      <div className="fr-press-sheet">
        <div className="fr-press-type">
          <div className="fr-press-word">
            <span className="fr-press-plate" />
            {LETTERS.map((i) => (
              <span key={i} className="fr-press-letter" hidden />
            ))}
          </div>
          <div className="fr-press-kicker" />
        </div>
      </div>
    </div>
  );
}
