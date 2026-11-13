// rollDigits.js — ROLLING DIGITS (design research move 11, Balatro-style): a number lands by rolling each digit into place
// like an odometer instead of ticking through every value. Each digit is a POOLED strip of two turns of 0–9 that moves on
// translateY only (one finite kitPlay each — will-change only while it rolls; REDUCE MOTION writes the text at once).
// Every strip starts spinning at once and they LAND staggered ROLL_STAGGER ms apart, left to right — the figure resolves
// like a reel and the ones digit stops last — each with an overshoot stop. Everything lands inside ROLL_MS. Separators and suffixes (`,` `.` `K` `M` `+`) stay put. At rest the strips are detached and the
// element holds its plain text again — nothing stays in the DOM, nothing loops, and a text read is always the real figure.
//
//   rollDigits(el, '+1,250')            // roll to this text now
//   rollDigits(el, '12.5K', { delay })  // … after `delay` ms (the old text stays until then; lands inside ROLL_MS of starting)
//
// No layout reads: the strip offsets are em-based, so a roll is pure writes.
import { kitPlay } from '../components/kit/motion.js';
import { reduceMotion } from '../lib/reduceMotion.js';
import './rollDigits.css';

import { rollPlan, ROLL_MS } from './rollPlan.js';

export { rollPlan, ROLL_MS };
const TURNS = 2; // cells per strip = 10 × TURNS: every digit spins through at least one full turn
const CELL_EM = 1; // a cell's height (rollDigits.css .rd-c): one line, so a rolling number never changes its line height
const EASE = 'cubic-bezier(.3,1.45,.5,1)'; // the overshoot stop: past the digit, then settles back

// the strip pool, per element: built once, re-used for every roll of that element
const POOL = new WeakMap();
function column(pool, i) {
  if (pool[i]) return pool[i];
  const col = document.createElement('span');
  col.className = 'rd-col';
  col.setAttribute('aria-hidden', 'true');
  const strip = document.createElement('span');
  strip.className = 'rd-strip';
  for (let t = 0; t < TURNS * 10; t += 1) {
    const c = document.createElement('span');
    c.className = 'rd-c';
    c.textContent = String(t % 10);
    strip.appendChild(c);
  }
  col.appendChild(strip);
  pool[i] = { col, strip };
  return pool[i];
}

/** Roll `el` to `text`. Returns nothing; the element ends holding exactly `text`. */
export function rollDigits(el, text, { delay = 0, ms = ROLL_MS } = {}) {
  if (!el) return;
  const target = String(text);
  if (typeof document === 'undefined' || typeof el.animate !== 'function' || reduceMotion()) {
    el.textContent = target;
    return;
  }
  if (!el.hasAttribute('data-rolling') && el.textContent === target) {
    // already showing it (a +0 tally line, a hidden zero bar): nothing to roll. No strips are built, and a roll still
    // pending on this element is cancelled, so it lands on the figure it shows now.
    el.__rollId = (el.__rollId || 0) + 1;
    return;
  }
  const plan = rollPlan(target, Math.min(ROLL_MS, ms));
  if (!plan.some((p) => p.digit)) {
    el.textContent = target;
    return;
  }
  const roll = (el.__rollId || 0) + 1;
  el.__rollId = roll;
  if (delay > 0) {
    // the old figure stays on screen until the roll starts (a gain still flying in)
    setTimeout(() => { if (el.__rollId === roll) { el.__rollId = roll - 1; rollDigits(el, target, { ms }); } }, delay);
    return;
  }
  let pool = POOL.get(el);
  if (!pool) { pool = []; POOL.set(el, pool); }
  el.textContent = '';
  el.setAttribute('data-rolling', '');
  // the FULL figure stays readable mid-roll: a visually-hidden copy (first, so a text read / screen reader gets the real
  // number); the columns and separators beside it are aria-hidden
  if (!pool.sr) {
    pool.sr = document.createElement('span');
    pool.sr.className = 'rd-sr';
  }
  pool.sr.textContent = target;
  el.appendChild(pool.sr);
  let n = 0;
  let left = 0;
  const land = () => {
    left -= 1;
    if (left > 0 || el.__rollId !== roll) return;
    el.textContent = target; // at rest: plain text again (the strips detach with it)
    el.removeAttribute('data-rolling');
  };
  for (const p of plan) {
    if (!p.digit) {
      const sep = document.createElement('span');
      sep.setAttribute('aria-hidden', 'true');
      sep.textContent = p.ch;
      el.appendChild(sep);
      continue;
    }
    const { col, strip } = column(pool, n);
    n += 1;
    el.appendChild(col);
    const end = -((TURNS - 1) * 10 + p.d) * CELL_EM; // the digit in the LAST turn: the strip passes a full turn first
    strip.style.transform = `translateY(${end}em)`;
    const a = kitPlay(strip, [{ transform: 'translateY(0em)' }, { transform: `translateY(${end}em)` }], { duration: p.ms, easing: EASE });
    if (a) {
      left += 1;
      a.addEventListener('finish', land, { once: true });
      a.addEventListener('cancel', land, { once: true });
    }
  }
  if (!left) land();
}
