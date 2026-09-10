// willChange.test.js — build-failing guard for the will-change BUDGET (CLAUDE.md ANIMATION
// BUDGET). The previous version of this file validated only the property NAME — that a
// declaration listed transform/opacity and nothing else. That is necessary but nowhere near
// sufficient, and it is why the gate stayed green while 24 elements sat permanently promoted:
// `will-change: transform` on an always-present node passes a name check and still breaks the
// rule, which is that a promoted layer must exist only for the life of an animation.
//
// THE RULE (CLAUDE.md): "will-change may ONLY list transform and/or opacity, and must NEVER sit
// on an idle / pooled / always-present node. Toggle will-change ON for the life of the animation
// and OFF at rest: a CSS :hover / html[data-beat] state, or JS that sets el.style.willChange on
// play and clears it on finish."
//
// So there are exactly three legal shapes, and this file enforces all three:
//   1. a STATE-SCOPED CSS declaration — the selector only matches while a transient state is on
//      (:hover, :focus, :active, [data-*=], .is-*, a state class). CLAUDE.md names this shape.
//   2. JS that sets el.style.willChange and CLEARS it again.
//   3. the two sanctioned selectors, kept as an explicit allowlist.
// An UNCONDITIONAL declaration on a plain selector is the violation, because the node carries a
// compositor layer for its whole mounted life whether it is animating or not.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');

// Only the compositor can animate these off the main thread. CSS-wide keywords are inert.
const ALLOWED_VALUES = new Set(['transform', 'opacity', 'auto', 'inherit', 'initial', 'unset', 'revert']);

// The two selectors sanctioned to carry a static will-change site-wide. NOTE: as of this commit
// NEITHER EXISTS in src/**.css — the allowlist is deliberately kept anyway so that re-introducing
// either is a conscious act rather than a silent one.
const ALLOWLIST = [/^\.clock-fill$/, /^\.burn$/];

// A selector that only matches while some transient state is on. This is the shape CLAUDE.md
// blesses, and it is genuinely different from an unconditional one: the promotion appears with
// the state and disappears with it.
const STATE_SCOPED = /:hover|:focus|:active|:focus-within|:focus-visible|\[data-[\w-]+\s*[=~|^$*]|\.is-[\w-]|\.has-[\w-]|\.boom-[\w-]|\.parallax-on/i;

function filesUnder(dir, ext) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...filesUnder(p, ext));
    else if (ext.some((e) => name.endsWith(e))) out.push(p);
  }
  return out;
}

const rel = (p) => relative(SRC, p).split(sep).join('/');

/** Every live will-change declaration in src CSS, with the selector block it sits in. */
function cssDeclarations() {
  const out = [];
  for (const file of filesUnder(SRC, ['.css'])) {
    // Strip comments first: this codebase documents removed no-ops in prose, and a note that
    // mentions "will-change: filter" must never be read as a live declaration. (On this commit
    // that is 18 of 47 raw grep hits — the difference between the real count and a scary one.)
    const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const re = /will-change\s*:\s*([^;}]+)/gi;
    let m;
    while ((m = re.exec(css)) !== null) {
      const before = css.slice(0, m.index);
      const open = before.lastIndexOf('{');
      let selector = '';
      if (open !== -1) {
        const head = before.slice(0, open);
        const prev = Math.max(head.lastIndexOf('}'), head.lastIndexOf('{'));
        selector = head.slice(prev + 1).split(/\s+/).join(' ').trim();
      }
      out.push({
        file: rel(file),
        line: before.split('\n').length,
        selector,
        value: m[1].trim(),
      });
    }
  }
  return out;
}

test('will-change lists only compositor properties (transform / opacity)', () => {
  const bad = cssDeclarations().filter((d) =>
    d.value.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
      .some((tok) => !ALLOWED_VALUES.has(tok)));
  assert.equal(bad.length, 0,
    `will-change must list only transform/opacity:\n${bad.map((d) => `  ${d.file}:${d.line} -> ${d.value}`).join('\n')}`);
});

test('no UNCONDITIONAL will-change — a promoted layer may not outlive its animation', () => {
  const offenders = cssDeclarations().filter((d) => {
    const sel = d.selector;
    if (ALLOWLIST.some((re) => sel.split(',').every((s) => re.test(s.trim())))) return false;
    if (STATE_SCOPED.test(sel)) return false; // appears with the state, goes with it
    return true;
  });
  assert.equal(offenders.length, 0,
    'These selectors carry will-change unconditionally, so the element holds a compositor layer ' +
    'for its whole mounted life. Either scope the declaration to a state (:hover / [data-*] / a ' +
    'state class), or set el.style.willChange in JS for the animation and clear it on finish. ' +
    `Do NOT add them to the allowlist.\n${offenders.map((d) => `  ${d.file}:${d.line}  ${d.selector}  -> ${d.value}`).join('\n')}`);
});

test('every JS will-change is cleared again (set without clear = permanent promotion)', () => {
  const offenders = [];
  for (const file of filesUnder(SRC, ['.js', '.jsx'])) {
    if (/\.test\.(js|jsx)$/.test(file)) continue;
    const src = readFileSync(file, 'utf8');
    const sets = [...src.matchAll(/willChange\s*=\s*(['"`])(?!\1)/g)].length; // assigns non-empty
    const clears = [...src.matchAll(/willChange\s*=\s*(['"`])\1/g)].length;   // assigns '' / "" / ``
    if (sets > 0 && clears === 0) offenders.push(`  ${rel(file)} sets willChange ${sets}x and never clears it`);
  }
  assert.equal(offenders.length, 0,
    `A JS will-change must be cleared when the animation finishes:\n${offenders.join('\n')}`);
});

test('nothing animates a non-compositor property on an infinite loop', () => {
  // transform/opacity run on the compositor; anything else re-runs style/paint every frame for
  // as long as the loop lasts. CLAUDE.md: "transform and opacity ONLY".
  const NON_COMPOSITOR = new Set([
    'border-color', 'filter', 'box-shadow', 'text-shadow', 'background', 'background-color',
    'color', 'width', 'height', 'top', 'left', 'right', 'bottom', 'margin', 'padding',
    'font-size', 'border', 'outline', 'stroke', 'fill', 'backdrop-filter',
  ]);
  const offenders = [];
  for (const file of filesUnder(SRC, ['.css'])) {
    const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    // map keyframe name -> the properties it animates
    const frames = {};
    for (const m of css.matchAll(/@keyframes\s+([\w-]+)\s*\{/g)) {
      let i = m.index + m[0].length, depth = 1;
      while (i < css.length && depth > 0) {
        if (css[i] === '{') depth++;
        else if (css[i] === '}') depth--;
        i++;
      }
      frames[m[1]] = new Set([...css.slice(m.index + m[0].length, i).matchAll(/([a-z-]+)\s*:/g)].map((x) => x[1]));
    }
    for (const m of css.matchAll(/animation\s*:\s*([^;}]+)/g)) {
      if (!/\binfinite\b/.test(m[1])) continue;
      for (const [name, props] of Object.entries(frames)) {
        if (!new RegExp(`\\b${name}\\b`).test(m[1])) continue;
        const bad = [...props].filter((p) => NON_COMPOSITOR.has(p));
        if (bad.length) {
          offenders.push(`  ${rel(file)}:${css.slice(0, m.index).split('\n').length}  @keyframes ${name} animates ${bad.join(', ')} on an infinite loop`);
        }
      }
    }
  }
  assert.equal(offenders.length, 0,
    `Infinite animations must touch transform/opacity only:\n${offenders.join('\n')}`);
});
