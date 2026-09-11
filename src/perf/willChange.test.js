// willChange.test.js — build-failing guard for the will-change BUDGET (CLAUDE.md ANIMATION BUDGET).
//
// THE RULE THIS ENCODES
// ---------------------
// CLAUDE.md: "will-change may ONLY list transform and/or opacity, and must NEVER sit on an idle /
// pooled / always-present node. Toggle it ON for the life of the animation and OFF at rest: a CSS
// :hover / html[data-beat] state, or JS that sets el.style.willChange on play and clears it on
// finish."
//
// The old version of this file validated only the property NAME. That is necessary and nowhere
// near sufficient: `will-change: transform` on an always-present node passes a name check and
// still breaks the rule, which is why the gate stayed green while 24 elements sat permanently
// promoted. What actually matters is not WHICH property is listed but WHETHER THE PROMOTION CAN
// OUTLIVE THE ANIMATION.
//
// So a static will-change passes here only if its selector carries a STATE QUALIFIER — something
// that makes the rule stop matching once the animation is over:
//   * a transient pseudo-class      :hover  :focus  :focus-within  :focus-visible  :active
//   * an attribute state            [data-beat='true'], any [data-*=...], where the attribute is
//                                   demonstrably set from code
//   * a class THE CODE TOGGLES      proven by scanning src for classList.add/remove/toggle or a
//                                   conditionally-composed className — not by trusting the name
// ...or the selector is one of the two explicitly sanctioned ones.
//
// The "class the code toggles" check is the important one, and it is deliberately EVIDENCE-BASED
// rather than a list. A previous revision hard-coded `.parallax-on|.boom-shake|.is-|.has-`, which
// just moved the allowlist somewhere less visible: any new class matching those shapes would have
// been waved through whether or not anything ever toggled it. Now the gate asks the code.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');

// Only the compositor can animate these off the main thread. CSS-wide keywords are inert values.
const ALLOWED_VALUES = new Set(['transform', 'opacity', 'auto', 'inherit', 'initial', 'unset', 'revert']);

// The two selectors sanctioned to carry a static will-change regardless of qualifier. NOTE: as of
// this commit NEITHER EXISTS in src/**.css. The allowlist is kept so that re-introducing either is
// a conscious act rather than a silent one.
const ALLOWLIST = [/^\.clock-fill$/, /^\.burn$/];

const TRANSIENT_PSEUDO = /:hover|:focus-within|:focus-visible|:focus|:active/i;
const ATTR_STATE = /\[\s*(data-[\w-]+)\s*[=~|^$*]/i;

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
// Blank comment bodies but KEEP newlines so reported line numbers stay true. (Replacing a
// multi-line comment with equal-length spaces collapses its newlines and shifts every index
// after it — that bug once deleted a keyframe stop.)
const decomment = (css) => css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

/** Every will-change declaration in a stylesheet, with the selector block it belongs to. */
function collectDeclarations(cssRaw, label) {
  const css = decomment(cssRaw);
  const out = [];
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
    out.push({ file: label, line: before.split('\n').length, selector, value: m[1].trim() });
  }
  return out;
}

/**
 * Class names the CODE actually toggles, gathered as evidence rather than assumed.
 * Two accepted proofs, both meaning "this class comes and goes at runtime":
 *   1. classList.add / .remove / .toggle('name')
 *   2. the name appears in a quoted string on a line that also composes conditionally
 *      (a ternary, &&, ||, or a `${}` interpolation) — the `cond ? ' boom-shake' : ''` idiom.
 * A plain static className="thing" matches NEITHER, which is the point.
 */
function toggledClasses(jsFiles) {
  const found = new Set();
  const DYNAMIC = /[?]|&&|\|\||\$\{/;
  for (const file of jsFiles) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/classList\s*\.\s*(?:add|remove|toggle)\s*\(\s*(['"`])([^'"`]+)\1/g)) {
      for (const tok of m[2].split(/\s+/)) if (tok) found.add(tok.replace(/^\./, ''));
    }
    for (const line of src.split('\n')) {
      if (!DYNAMIC.test(line)) continue;
      for (const m of line.matchAll(/(['"`])([^'"`\n]*)\1/g)) {
        const body = m[2];
        if (!body || body.length > 80) continue;
        // only treat it as a class list if every token looks like a bare class name
        const toks = body.trim().split(/\s+/).filter(Boolean);
        if (!toks.length || toks.some((t) => !/^[a-z][\w-]*$/i.test(t))) continue;
        for (const t of toks) found.add(t);
      }
    }
  }
  return found;
}

/** Why this selector is allowed to carry a static will-change — or null if it is not. */
function stateQualifier(selector, toggled) {
  const parts = selector.split(',').map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return null;
  const why = [];
  for (const part of parts) {
    if (ALLOWLIST.some((re) => re.test(part))) { why.push('explicitly sanctioned'); continue; }
    const pseudo = part.match(TRANSIENT_PSEUDO);
    if (pseudo) { why.push(`transient pseudo-class ${pseudo[0]}`); continue; }
    const attr = part.match(ATTR_STATE);
    if (attr) { why.push(`attribute state [${attr[1]}=...]`); continue; }
    const cls = (part.match(/\.[a-z][\w-]*/gi) || []).map((c) => c.slice(1)).find((c) => toggled.has(c));
    if (cls) { why.push(`code-toggled class .${cls}`); continue; }
    return null; // EVERY comma-branch must qualify, or the whole rule can promote an idle node
  }
  return why.join(' + ');
}

const cssFiles = () => filesUnder(SRC, ['.css']);
const jsFiles = () => filesUnder(SRC, ['.js', '.jsx']).filter((f) => !/\.test\.(js|jsx)$/.test(f));
const realDeclarations = () => cssFiles().flatMap((f) => collectDeclarations(readFileSync(f, 'utf8'), rel(f)));

test('will-change lists only compositor properties (transform / opacity)', () => {
  const bad = realDeclarations().filter((d) =>
    d.value.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
      .some((tok) => !ALLOWED_VALUES.has(tok)));
  assert.equal(bad.length, 0,
    `will-change must list only transform/opacity:\n${bad.map((d) => `  ${d.file}:${d.line} -> ${d.value}`).join('\n')}`);
});

test('every static will-change is state-qualified, so the promotion cannot outlive the animation', () => {
  const toggled = toggledClasses(jsFiles());
  const offenders = realDeclarations().filter((d) => !stateQualifier(d.selector, toggled));
  assert.equal(offenders.length, 0,
    'These selectors carry will-change with NO state qualifier, so the element holds a compositor '
    + 'layer for its whole mounted life. Give the rule a state (:hover / :focus-within / :active / '
    + 'a [data-*] attribute / a class the code toggles), or set el.style.willChange from JS for the '
    + 'animation and clear it on finish. Do NOT add it to the allowlist.\n'
    + offenders.map((d) => `  ${d.file}:${d.line}  ${d.selector}  -> ${d.value}`).join('\n'));
});

test('THE GATE STILL BITES: a bare idle selector is rejected, qualified ones are accepted', () => {
  // Fixture, not a real stylesheet — this is the regression guard for the guard. If someone
  // loosens stateQualifier(), the bare case below starts passing and this test fails.
  const toggled = new Set(['parallax-on', 'boom-shake']);
  const check = (css) => collectDeclarations(css, 'fixture.css')
    .map((d) => ({ selector: d.selector, why: stateQualifier(d.selector, toggled) }));

  const [bare] = check('.some-idle-thing { will-change: transform; }');
  assert.equal(bare.why, null, 'a bare .some-idle-thing MUST fail the gate');

  // ...and the shapes that are genuinely transient must still pass, or the gate is useless.
  for (const [css, label] of [
    ['.thing:hover { will-change: transform; }', ':hover'],
    ['.thing:focus-within { will-change: transform; }', ':focus-within'],
    ['.thing:active { will-change: transform; }', ':active'],
    ["html[data-beat='true'] .thing { will-change: opacity; }", 'attribute state'],
    ['.wall-scene.parallax-on .layer { will-change: transform; }', 'code-toggled class'],
    ['.stage.boom-shake { will-change: transform; }', 'code-toggled one-shot class'],
    ['.clock-fill { will-change: transform; }', 'allowlist'],
  ]) {
    const [d] = check(css);
    assert.ok(d.why, `${label} should qualify but did not: ${css}`);
  }

  // A class the code does NOT toggle must fail even though it is shaped like a state class.
  const [fake] = check('.thing.looks-stateful { will-change: transform; }');
  assert.equal(fake.why, null, 'a class nothing toggles must NOT qualify on its name alone');

  // A comma group qualifies only if EVERY branch does — one bare branch promotes an idle node.
  const [mixed] = check('.a:hover, .b { will-change: transform; }');
  assert.equal(mixed.why, null, 'a comma group with one unqualified branch must fail');
});

test('the code-toggled evidence scan finds the classes it is relied on to find', () => {
  const toggled = toggledClasses(jsFiles());
  // classList.add/remove in WallScene.jsx, and the `cond ? ' boom-shake' : ''` idiom in GameScreen.
  assert.ok(toggled.has('parallax-on'), 'parallax-on must be detected as code-toggled');
  assert.ok(toggled.has('boom-shake'), 'boom-shake must be detected as code-toggled');
});

test('every JS will-change is cleared again (set without clear = permanent promotion)', () => {
  const offenders = [];
  for (const file of jsFiles()) {
    const src = readFileSync(file, 'utf8');
    const sets = [...src.matchAll(/willChange\s*=\s*(['"`])(?!\1)/g)].length;
    const clears = [...src.matchAll(/willChange\s*=\s*(['"`])\1/g)].length;
    if (sets > 0 && clears === 0) offenders.push(`  ${rel(file)} sets willChange ${sets}x and never clears it`);
  }
  assert.equal(offenders.length, 0,
    `A JS will-change must be cleared when the animation finishes:\n${offenders.join('\n')}`);
});

test('nothing animates a non-compositor property on an infinite loop', () => {
  const NON_COMPOSITOR = new Set([
    'border-color', 'filter', 'box-shadow', 'text-shadow', 'background', 'background-color',
    'color', 'width', 'height', 'top', 'left', 'right', 'bottom', 'margin', 'padding',
    'font-size', 'border', 'outline', 'stroke', 'fill', 'backdrop-filter',
  ]);
  const offenders = [];
  for (const file of cssFiles()) {
    const css = decomment(readFileSync(file, 'utf8'));
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
