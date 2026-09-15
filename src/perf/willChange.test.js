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
//
// WHAT THIS TEST DOES NOT ASSERT — stated because the project has been burned by gates that
// read as though they prove more than they do (e2e/motion-contract.spec.js's reduced-motion
// emulation is inert while looking authoritative). CLAUDE.md's will-change rule has TWO halves:
//   1. the VALUE may only be transform/opacity      <- this test, statically, over all of src/
//   2. it must never SIT on an idle / pooled / always-present node; it goes on when the
//      animation plays and off at rest              <- NOT CHECKED HERE, and not checkable from
//                                                      CSS text: whether a node is idle is a
//                                                      runtime fact. A permanent
//                                                      `will-change: transform` on a resting
//                                                      pooled element passes this file.
// So green here means no non-compositor VALUES anywhere in src/. It does not mean the rule is kept.
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
    //
    // REPLACE EACH COMMENT WITH ITS OWN NEWLINES, don't delete it. Stripping to '' collapsed
    // every line a comment spanned, and the offender's line below is counted in THIS string —
    // so the failure message named a line that did not hold the offence. Measured on a probe
    // file: a will-change on the true line 13, behind a 10-line comment, was reported as line
    // 3. The CSS in this project is heavily commented, so the real misdirection is far larger.
    // A gate that points at the wrong line when it fires is a gate you stop trusting.
    const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''));
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
