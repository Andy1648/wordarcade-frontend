// reduceMotionScope.test.js — the build-time PostCSS plugin that moves every
// `@media (prefers-reduced-motion …)` block off the OS setting and onto the in-game REDUCE MOTION
// toggle (`data-reduce-motion` on <html>). See scripts/postcss-reduce-motion.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import reduceMotionScope, { splitMotionQuery, scopeSelector, scopeSelectors, simpleSpecificity } from '../../scripts/postcss-reduce-motion.js';

const run = (css) => postcss([reduceMotionScope()]).process(css, { from: undefined }).css;
const squash = (s) => s.replace(/\s+/g, ' ').trim();

test('a reduce block is unwrapped and every selector is scoped to the attribute', () => {
  const out = run('@media (prefers-reduced-motion: reduce) { .a, .b > div, #c { animation: none; } }');
  assert.equal(
    squash(out),
    ':where([data-reduce-motion]) .a, :where([data-reduce-motion]) .b > div, :where([data-reduce-motion]) #c { animation: none; }'
  );
  assert.doesNotMatch(out, /prefers-reduced-motion|@media/);
});

test('selectors already rooted at html / :root merge into that compound', () => {
  const out = run(
    '@media (prefers-reduced-motion: reduce) { html[data-beat] .x { opacity: 1 } :root .y { opacity: 1 } html { scroll-behavior: auto } }'
  );
  assert.match(out, /html:where\(\[data-reduce-motion\]\)\[data-beat\] \.x/);
  assert.match(out, /:root:where\(\[data-reduce-motion\]\) \.y/);
  assert.match(out, /html:where\(\[data-reduce-motion\]\) \{/);
});

test('no-preference scopes to the attribute being ABSENT', () => {
  const out = run('@media (prefers-reduced-motion: no-preference) { .a { animation: spin 1s } html.x .b { opacity: 0 } }');
  assert.match(out, /:where\(:root:not\(\[data-reduce-motion\]\)\) \.a/);
  assert.match(out, /html:where\(:not\(\[data-reduce-motion\]\)\)\.x \.b/);
  assert.doesNotMatch(out, /@media/);
});

test('a combined query keeps the rest of the media query and drops only the motion feature', () => {
  const out = run('@media (max-width: 480px) and (prefers-reduced-motion: reduce) { .a { transform: none } }');
  assert.equal(squash(out), '@media (max-width: 480px) { :where([data-reduce-motion]) .a { transform: none } }');
  const flipped = run('@media screen and (prefers-reduced-motion: reduce) and (min-width: 9px) { .a { x: 1 } }');
  assert.match(flipped, /@media screen and \(min-width: 9px\)/);
});

test('keyframes inside the block are kept and their percentages are never scoped', () => {
  const out = run(
    '@media (prefers-reduced-motion: reduce) { .a { animation: a-fade 1s } @keyframes a-fade { 0% { opacity: 0 } to { opacity: 1 } } }'
  );
  assert.match(out, /@keyframes a-fade \{ 0% \{ opacity: 0 \} to \{ opacity: 1 \} \}/);
  assert.doesNotMatch(out, /where\(\[data-reduce-motion\]\) (0%|to)/);
});

test('nested at-rules inside the block are scoped, and nested motion queries are scoped once', () => {
  const out = run(
    '@media (prefers-reduced-motion: reduce) { @supports (display: grid) { .g { opacity: 1 } } @media (max-width: 9px) { .h { opacity: 1 } } }'
  );
  assert.match(out, /@supports \(display: grid\) \{ :where\(\[data-reduce-motion\]\) \.g/);
  assert.match(out, /@media \(max-width: 9px\) \{ :where\(\[data-reduce-motion\]\) \.h/);
  const twice = run('@media (prefers-reduced-motion: reduce) { @media (prefers-reduced-motion) { .i { opacity: 1 } } }');
  assert.equal(squash(twice), ':where([data-reduce-motion]) .i { opacity: 1 }');
});

test('a motion query nested inside a style rule (CSS nesting) scopes above the parent', () => {
  const out = run('.a { color: red; @media (prefers-reduced-motion: reduce) { animation: none; .b { opacity: 1 } } }');
  assert.match(out, /:where\(\[data-reduce-motion\]\) & \{ animation: none;? \}/);
  assert.match(out, /:where\(\[data-reduce-motion\]\) & \.b \{ opacity: 1 \}/);
  assert.doesNotMatch(out, /@media/);
});

test('unrelated CSS and media queries pass through untouched', () => {
  const css = '.a { animation: spin 1s infinite } @media (max-width: 600px) { .b { color: red } }';
  assert.equal(run(css), css);
});

test('queries it cannot express as a scope fail the build loudly', () => {
  assert.throws(() => splitMotionQuery('not all and (prefers-reduced-motion: reduce)'));
  assert.throws(() => splitMotionQuery('(max-width: 1px), (prefers-reduced-motion: reduce)'));
  assert.throws(() => splitMotionQuery('(prefers-reduced-motion: reduce), (prefers-reduced-motion: no-preference)'));
  assert.equal(splitMotionQuery('(max-width: 1px)'), null);
});

test('scopeSelector handles root pseudo-elements without a descendant hop', () => {
  assert.equal(scopeSelector('::view-transition-old(root)', 'reduce'), ':where(:root[data-reduce-motion])::view-transition-old(root)');
  assert.equal(scopeSelector('htmlish .a', 'reduce'), ':where([data-reduce-motion]) htmlish .a');
});

test('equal-specificity selectors share one scope via :is(); anything unsure is scoped alone', () => {
  const out = run('@media (prefers-reduced-motion: reduce) { .a, .b > .c, .d .e, .f::before, .g:not(.h), html .i { animation: none } }');
  // .b > .c and .d .e are both (0,2,0); .a is (0,1,0); the pseudo-element / functional / html ones stand alone.
  assert.equal(
    squash(out),
    ':where([data-reduce-motion]) .a, :where([data-reduce-motion]) :is(.b > .c,.d .e), ' +
      ':where([data-reduce-motion]) .f::before, :where([data-reduce-motion]) .g:not(.h), ' +
      'html:where([data-reduce-motion]) .i { animation: none }'
  );
  assert.deepEqual(simpleSpecificity('div.a > #b[data-x="1.2"]:hover'), [1, 3, 1]);
  assert.equal(simpleSpecificity('.a:after'), null);
  assert.equal(simpleSpecificity(String.raw`.a\:b`), null); // an escaped class name
  assert.deepEqual(scopeSelectors(['.a', '.b'], 'no-preference'), [':where(:root:not([data-reduce-motion])) :is(.a,.b)']);
});

test('every real stylesheet transforms cleanly and leaves no OS motion query behind', () => {
  const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');
  const walk = (d) =>
    readdirSync(d).flatMap((n) => {
      const p = join(d, n);
      return statSync(p).isDirectory() ? walk(p) : p.endsWith('.css') ? [p] : [];
    });
  let converted = 0;
  for (const f of walk(SRC)) {
    const src = readFileSync(f, 'utf8');
    if (!/@media[^{]*prefers-reduced-motion/.test(src)) continue;
    const out = run(src);
    const left = postcss.parse(out);
    left.walkAtRules('media', (at) => {
      assert.doesNotMatch(at.params, /prefers-reduced-motion/, `${f}: ${at.params}`);
    });
    // The infinite-animation guard counts source CSS; the transform must not add or drop any.
    const inf = (s) => (s.replace(/\/\*[\s\S]*?\*\//g, '').match(/animation(?:-iteration-count)?\s*:[^;}]*\binfinite\b/gi) || []).length;
    assert.equal(inf(out), inf(src), `${f}: infinite-animation count changed`);
    converted += 1;
  }
  assert.ok(converted >= 60, `expected the ~67 motion stylesheets, saw ${converted}`);
});
