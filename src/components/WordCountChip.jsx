// WordCountChip.jsx — the menu's lifetime "WORDS TYPED" odometer.
//
// A dark chip with Bungee yellow digits in inset slots and a Space Mono label.
// Per-digit rolling columns (0-9 strips translated on the Y axis). It is COMPLETELY
// still while idle — no bob, no pulse; motion happens only on entrance and on an
// increment.
//   - First show this page-load: roll 0 → total (~1.1s ease-out cubic).
//   - Menu re-appears with a grown total (compared to the module-level last-shown
//     value): roll old → new (~0.8s) and float a teal "+N".
//   - prefers-reduced-motion: render the final value instantly, no rolls, no floater.
//
// The count lives in wordCount.js; the chip subscribes for live updates and reads
// the value itself (no props needed).
import { useEffect, useRef, useState } from 'react';
import { readWordCount, subscribe } from '../wordCount';
import './WordCountChip.css';

// The total the chip last displayed, remembered across mounts for THIS page-load so
// re-appearing on the menu after a game can roll from the old value. null until the
// first mount (first show rolls up from 0).
let lastShownTotal = null;

function prefersReduced() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

// "12345" -> ['1','2',',','3','4','5'] (comma-grouped display chars).
function formatChars(n) {
  return Math.max(0, Math.floor(n)).toLocaleString('en-US').split('');
}

// The base-10 digit of n at the given place (0 = ones, 1 = tens, ...).
function digitAt(n, place) {
  return Math.floor(Math.abs(n) / 10 ** place) % 10;
}

const STRIP = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

// The rolling number. Renders one column per digit of `to`; each column rolls from
// its `from` digit to its `to` digit. Keyed by the caller so each roll remounts and
// replays the start→end transition cleanly.
function Odometer({ from, to, initial, reduced }) {
  const [phase, setPhase] = useState(reduced ? 'end' : 'start');
  useEffect(() => {
    if (reduced) {
      setPhase('end');
      return undefined;
    }
    setPhase('start');
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setPhase('end'));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [reduced]);

  const chars = formatChars(to);
  // Assign a base-10 place to each digit char, counting from the right (commas skipped).
  const places = [];
  let p = 0;
  for (let i = chars.length - 1; i >= 0; i--) {
    if (chars[i] === ',') {
      places[i] = null;
    } else {
      places[i] = p;
      p += 1;
    }
  }

  const durMs = reduced ? 0 : initial ? 1100 : 800;
  const ease = initial ? 'cubic-bezier(.22,1,.36,1)' : 'cubic-bezier(.2,.9,.25,1)';

  return (
    <span className="wc-odometer" aria-hidden="true">
      {chars.map((ch, i) => {
        if (ch === ',') {
          return (
            <span className="wc-comma" key={`c${i}`}>
              ,
            </span>
          );
        }
        const place = places[i];
        const d = digitAt(phase === 'end' ? to : from, place);
        return (
          <span className="wc-col" key={`d${place}`}>
            <span
              className="wc-strip"
              style={{
                transform: `translateY(${-d}em)`,
                transitionDuration: `${phase === 'end' ? durMs : 0}ms`,
                transitionTimingFunction: ease,
              }}
            >
              {STRIP.map((n) => (
                <span className="wc-digit" key={n}>
                  {n}
                </span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
}

export default function WordCountChip() {
  const reduced = prefersReduced();
  const shownRef = useRef(readWordCount().total);
  const keyRef = useRef(0);
  const [roll, setRoll] = useState(() => {
    const cur = readWordCount().total;
    return { from: cur, to: cur, initial: false, key: 0 };
  });
  const [floater, setFloater] = useState(null); // { n, key } | null

  // Entrance roll, decided from the module-level last-shown total.
  useEffect(() => {
    const cur = readWordCount().total;
    keyRef.current += 1;
    if (lastShownTotal == null) {
      setRoll({ from: 0, to: cur, initial: true, key: keyRef.current });
    } else if (cur > lastShownTotal) {
      setRoll({ from: lastShownTotal, to: cur, initial: false, key: keyRef.current });
      setFloater({ n: cur - lastShownTotal, key: keyRef.current });
    } else {
      setRoll({ from: cur, to: cur, initial: false, key: keyRef.current });
    }
    shownRef.current = cur;
    lastShownTotal = cur;
  }, []);

  // Live updates while mounted (a word added elsewhere): roll to the new value and
  // float a "+N". Rare on the menu, but keeps the chip honest if it ever happens.
  useEffect(() => {
    return subscribe(() => {
      const cur = readWordCount().total;
      if (cur === shownRef.current) return;
      keyRef.current += 1;
      const from = shownRef.current;
      setRoll({ from, to: cur, initial: false, key: keyRef.current });
      if (cur > from) setFloater({ n: cur - from, key: keyRef.current });
      shownRef.current = cur;
      lastShownTotal = cur;
    });
  }, []);

  return (
    <div className="wc-chip" aria-label={`${roll.to.toLocaleString('en-US')} words typed`}>
      <Odometer
        key={roll.key}
        from={roll.from}
        to={roll.to}
        initial={roll.initial}
        reduced={reduced}
      />
      <span className="wc-label">
        <span className="wc-label-top">WORDS</span>
        <span className="wc-label-accent">TYPED</span>
      </span>
      {floater && !reduced && (
        <span
          className="wc-floater"
          key={floater.key}
          onAnimationEnd={() => setFloater((f) => (f && f.key === floater.key ? null : f))}
        >
          +{floater.n.toLocaleString('en-US')}
        </span>
      )}
    </div>
  );
}
