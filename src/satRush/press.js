// press.js — FRENCH RUSH's screen change, in the mode's own print language (Andy oct26: "transition
// screens wouldn't hurt here … whatever impresses the french teacher"). ONE pooled overlay (PressWipe.jsx) is
// mounted once on the French Rush page and registers its parts here; every screen change replays the SAME
// nodes through WAAPI — no node per transition, the word is written into pooled letter spans.
//
// LOOK = A PAGE COMING OFF THE PRESS. Timeline (ms):
//     0        a fresh paper SHEET cuts in over every edge (no travelling band, so no edge ever shows)
//    30–330    the screen's name is SET IN TYPE: each letter presses in (scale 1.5 → 1, ink up) left to right
//    60–360    the screentone PLATE slides into register behind it (the mode's off-register print, landing)
//   150–390    the English line prints underneath (the French is the headline — a teacher's dream)
//   430–680    the sheet is PULLED off the press — up (forward) or down (back) — revealing the new screen
// A short trip (a console word → the next) is the same press at ~520ms.
//
// PURELY COSMETIC (CLAUDE.md Known Bugs): the screen has already swapped underneath; this only lays the sheet on
// top — absolute over the .sr-app page, pointer-events:none. It never gates, delays or blocks which screen shows.
// Motion law: transform + opacity ONLY, finite one-shots, no layout reads, will-change on for the play and off at
// rest, REDUCE MOTION (the in-game toggle) skips it entirely.
import { useEffect, useRef } from 'react';
import { reduceMotion } from '../lib/reduceMotion.js';

export const PRESS_MS = 680;
export const PRESS_SHORT_MS = 520;
export const MAX_LETTERS = 18;
export const COALESCE_MS = 650;
const PULL_EASE = 'cubic-bezier(0.55, 0, 0.75, 0.3)'; // slow peel, fast pull

let parts = null; // { root, sheet, word, plate, kicker, letters:[span] }
let running = [];
let lastAt = -Infinity;

/** PressWipe calls this once on mount; returns the unregister function. */
export function registerPress(p) {
  parts = p;
  return () => {
    stop();
    if (parts === p) parts = null;
  };
}

function willChange(on) {
  if (!parts) return;
  const v = on ? 'transform' : '';
  parts.sheet.style.willChange = v;
  parts.plate.style.willChange = v;
  parts.kicker.style.willChange = on ? 'transform, opacity' : '';
  for (const l of parts.letters) l.style.willChange = on && l.textContent ? 'transform, opacity' : '';
}

function stop() {
  for (const a of running) {
    try {
      a.cancel();
    } catch {
      /* gone */
    }
  }
  running = [];
  if (!parts) return;
  parts.root.dataset.state = 'idle';
  willChange(false);
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/**
 * Press a sheet: `word` the French headline (≤ MAX_LETTERS), `kicker` its English line, `dir` 'forward' | 'back',
 * `short` for a quick in-screen beat (the next word on the console). Returns true when it played.
 */
export function playPress(word, kicker = '', dir = 'forward', short = false) {
  const t0 = now();
  if (t0 - lastAt < COALESCE_MS) return false;
  lastAt = t0;
  if (!parts || reduceMotion()) return false;
  if (typeof parts.root.animate !== 'function') return false;
  stop();
  const { root, sheet, word: wordEl, plate, kicker: kickEl, letters } = parts;
  const text = String(word || '').toUpperCase().slice(0, MAX_LETTERS);
  const T = short ? PRESS_SHORT_MS : PRESS_MS;
  const PULL_AT = short ? 300 : 430;
  const at = (ms) => Math.min(1, ms / T);

  letters.forEach((s, i) => {
    s.textContent = i < text.length ? text[i] : '';
    s.hidden = i >= text.length;
  });
  plate.textContent = text;
  wordEl.setAttribute('aria-label', text);
  kickEl.textContent = kicker || '';
  root.style.setProperty('--fp-n', String(Math.max(6, text.length)));
  root.dataset.state = 'play';
  willChange(true);

  const go = (el, frames, timing) => {
    const a = el.animate(frames, timing);
    running.push(a);
    return a;
  };
  const y = dir === 'back' ? '104%' : '-104%';
  const clock = go(
    sheet,
    [
      { transform: 'translateY(0)' },
      { transform: 'translateY(0)', offset: at(PULL_AT), easing: PULL_EASE },
      { transform: `translateY(${y})` },
    ],
    { duration: T, fill: 'both' },
  );

  // the type, set letter by letter (a press stroke per letter)
  const n = text.length;
  const step = n > 1 ? Math.min(22, (short ? 140 : 210) / (n - 1)) : 0;
  for (let j = 0; j < n; j += 1) {
    go(
      letters[j],
      [
        { opacity: 0, transform: 'scale(1.55)', easing: 'cubic-bezier(0.2, 0.9, 0.3, 1.2)' },
        { opacity: 1, transform: 'scale(0.96)', offset: 0.7 },
        { opacity: 1, transform: 'scale(1)' },
      ],
      { duration: short ? 110 : 140, delay: 30 + j * step, fill: 'both' },
    );
  }
  // the screentone plate slides into register (lands at the house -5px / -5px offset)
  go(
    plate,
    [
      { transform: 'translate(-22px, -16px)', opacity: 0 },
      { transform: 'translate(-22px, -16px)', opacity: 1, offset: 0.15, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)' },
      { transform: 'translate(-5px, -5px)', opacity: 1 },
    ],
    { duration: short ? 220 : 300, delay: 60, fill: 'both' },
  );
  if (kicker) {
    go(
      kickEl,
      [
        { opacity: 0, transform: 'translateY(10px)', easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      { duration: 200, delay: short ? 100 : 150, fill: 'both' },
    );
  }
  clock.onfinish = () => {
    if (running.includes(clock)) stop();
  };
  return true;
}

/** Test seam. */
export function _resetPressClock() {
  lastAt = -Infinity;
}

/**
 * Press a sheet whenever `key` changes (never on mount). `press` = [word, kicker, dir, short] or null (no sheet
 * for this change). Read once at the change — the screen is already showing. `onMount` presses the first screen
 * too (a flow opened by a tap, not by a page load).
 */
export function usePressOnChange(key, press, onMount = false) {
  const last = useRef(onMount ? Symbol('mount') : key);
  const pressRef = useRef(press);
  pressRef.current = press;
  useEffect(() => {
    if (key === last.current) return;
    last.current = key;
    const p = pressRef.current;
    if (p && p[0]) playPress(p[0], p[1], p[2], p[3]);
  }, [key]);
}
