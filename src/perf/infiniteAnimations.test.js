// infiniteAnimations.test.js — BUILD-FAILING guard for CLAUDE.md ANIMATION BUDGET rule 1:
// "ZERO new infinite animations. Every effect must be a finite one-shot; nothing loops at rest."
//
// The e2e `splash-loops` spec counts running infinite animations on the menu at runtime; this is the
// static half that covers EVERY screen (in-game included) without a browser: it counts every
// `infinite` iteration in the source CSS and every `iterations: Infinity` in the source JS, and
// pins the total. The budget may only go DOWN — lower INFINITE_BUDGET when you remove a loop, never
// raise it to land a new one.
//
// History: feat/feel-ladder converted ComboMeter's two loops (combo-shake, combo-spark) to finite
// 3-iteration tier-entry bursts — 53 -> 51. feat/gems (payload pass) deleted the dead .splash-mascot-stage
// sway (no element rendered it) — 51 -> 50.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');
const norm = (p) => p.split('\\').join('/');

export const INFINITE_BUDGET = 50;

function files(dir, pred) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...files(p, pred));
    else if (pred(name)) out.push(p);
  }
  return out;
}
const stripCss = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const stripJs = (js) => js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/[^\n]*/g, '$1');

/** Every infinite CSS animation declaration, as "file:line". */
export function cssInfinites() {
  const hits = [];
  const re = /animation(?:-iteration-count)?\s*:[^;}]*\binfinite\b/gi;
  for (const f of files(SRC, (n) => n.endsWith('.css'))) {
    const css = stripCss(readFileSync(f, 'utf8'));
    let m;
    while ((m = re.exec(css)) !== null) hits.push(`${norm(f)}:${css.slice(0, m.index).split('\n').length}`);
  }
  return hits;
}

/** Every WAAPI `iterations: Infinity` in source JS/JSX (tests excluded). */
export function jsInfinites() {
  const hits = [];
  const re = /iterations\s*:\s*Infinity/g;
  for (const f of files(SRC, (n) => /\.(jsx?|mjs)$/.test(n) && !n.includes('.test.'))) {
    const js = stripJs(readFileSync(f, 'utf8'));
    let m;
    while ((m = re.exec(js)) !== null) hits.push(`${norm(f)}:${js.slice(0, m.index).split('\n').length}`);
  }
  return hits;
}

test('the infinite-animation count never grows (budget may only go down)', () => {
  const all = [...cssInfinites(), ...jsInfinites()];
  assert.ok(
    all.length <= INFINITE_BUDGET,
    `${all.length} infinite animations in source, budget is ${INFINITE_BUDGET}. ` +
      `New effects must be finite one-shots (CLAUDE.md ANIMATION BUDGET).\n${all.join('\n')}`
  );
});

test('no WAAPI animation loops forever', () => {
  assert.deepEqual(jsInfinites(), []);
});

test('the combo meter and the feel ladder never loop', () => {
  const offenders = cssInfinites().filter((h) => /ComboMeter\.css|FeelLadder\.css|RarityFlash\.css|WordLanding\.css/.test(h));
  assert.deepEqual(offenders, [], `in-game feel must be finite:\n${offenders.join('\n')}`);
});
