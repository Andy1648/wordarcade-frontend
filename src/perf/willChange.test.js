// willChange.test.js — build-failing guard for the will-change rule (CLAUDE.md ANIMATION
// BUDGET / typeaword-block-state.md §5). Every will-change declaration in the source CSS may
// list ONLY compositor properties (transform / opacity) — never box-shadow, text-shadow,
// border-color, filter, a custom property, or any layout prop, all of which are no-ops that
// promote a layer for nothing. Scans every .css file under src/. This caught (and now pins)
// the 7 non-compositing declarations the willchange audit flagged.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');

// transform / opacity are the only two properties the compositor can animate off the main
// thread. The CSS-wide keywords are inert as values, so they're allowed too.
const ALLOWED = new Set(['transform', 'opacity', 'auto', 'inherit', 'initial', 'unset', 'revert']);

function cssFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...cssFiles(p));
    else if (name.endsWith('.css')) out.push(p);
  }
  return out;
}

test('will-change lists only compositor props (transform / opacity)', () => {
  const offenders = [];
  const re = /will-change\s*:\s*([^;}]+)/gi;
  for (const file of cssFiles(SRC)) {
    // Strip /* … */ comments first so prose that mentions "will-change: …" (e.g. a note
    // explaining a removed no-op) is never mistaken for a live declaration.
    const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    let m;
    while ((m = re.exec(css)) !== null) {
      const value = m[1].trim();
      const tokens = value
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      if (tokens.some((tok) => !ALLOWED.has(tok))) {
        const line = css.slice(0, m.index).split('\n').length;
        offenders.push(`${file}:${line} -> will-change: ${value}`);
      }
    }
  }
  assert.equal(
    offenders.length,
    0,
    `will-change must list only transform/opacity. Non-compositor offenders:\n${offenders.join('\n')}`
  );
});
