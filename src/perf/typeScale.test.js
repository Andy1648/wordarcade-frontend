// typeScale.test.js — BUILD-FAILING guard for the modular type scale, the accessibility
// floors, the Bungee/Space Mono rules and the one-accent-per-screen value grouping.
// (CLAUDE.md "TYPE SCALE"; the scale itself lives in src/theme/type.css.)
//
// WHY THESE ARE TESTS AND NOT A STYLE GUIDE
// The scale replaced 528 hand-written font-sizes spanning ~180 distinct values. Nothing
// stops the 181st from being added by hand three weeks from now, and a type scale that
// leaks is not a scale. Each assertion below is the machine-checkable half of a rule that
// would otherwise decay:
//   1. every font-size goes through a token   (the scale cannot be bypassed)
//   2. the token floors meet WCAG/touch minima (13px label / 16px tappable / 44px target)
//   3. Bungee stays display type              (caps, never below --fs-panel)
//   4. exactly one --v-accent per screen      (the hierarchy cannot be diluted)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');
const norm = (p) => p.split('\\').join('/');

function cssFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...cssFiles(p));
    else if (name.endsWith('.css')) out.push(p);
  }
  return out;
}
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length));
function rules(css) {
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    out.push({ sel: m[1].trim().replace(/\s+/g, ' '), body: m[2], index: m.index });
  }
  return out;
}
const lineOf = (css, i) => css.slice(0, i).split('\n').length;

// ---------------------------------------------------------------------------
// FIT-TO-SLOT EXCEPTIONS. These size text to a BOX, not to the document scale: a
// container-query (cqw) chip label or a letter tile derived from --slot-size must
// shrink with its container or it overflows. They are layout mechanics, not a type
// choice. The allowlist is deliberately narrow - a NEW raw font-size anywhere else
// fails. If you need another, justify it here rather than widening the matcher.
// ---------------------------------------------------------------------------
const FIT_TO_SLOT = /cqw|var\(--slot-size\)/i;

test('every font-size goes through a --fs-* token (the scale cannot be bypassed)', () => {
  const offenders = [];
  for (const file of cssFiles(SRC)) {
    if (norm(file).endsWith('theme/type.css')) continue; // the scale defines itself
    const css = strip(readFileSync(file, 'utf8'));
    const re = /font-size\s*:\s*([^;}]+)/gi;
    let m;
    while ((m = re.exec(css)) !== null) {
      const v = m[1].trim();
      if (v === 'inherit' || v === '0') continue;
      if (FIT_TO_SLOT.test(v)) continue;
      if (/var\(--fs-[a-z0-9]+\)/i.test(v)) continue;
      offenders.push(`${norm(file)}:${lineOf(css, m.index)} -> font-size: ${v}`);
    }
  }
  assert.equal(
    offenders.length, 0,
    `font-size must use a --fs-* token from src/theme/type.css.\n${offenders.join('\n')}`
  );
});

test('the scale holds its ratio and its accessibility floors', () => {
  const css = strip(readFileSync(join(SRC, 'theme', 'type.css'), 'utf8'));
  const tok = (name) => {
    const m = css.match(new RegExp('--fs-' + name + '\\s*:\\s*([^;]+)'));
    assert.ok(m, `--fs-${name} is not defined`);
    return m[1].trim();
  };
  // clamp(min, pref, max) -> [min, max]; a bare px -> [px, px]
  const bounds = (v) => {
    const c = v.match(/^clamp\(\s*([\d.]+)px\s*,[^,]+,\s*([\d.]+)px\s*\)$/);
    if (c) return [parseFloat(c[1]), parseFloat(c[2])];
    const p = v.match(/^([\d.]+)px$/);
    assert.ok(p, `--fs token "${v}" must be a px value or clamp(px, …, px)`);
    return [parseFloat(p[1]), parseFloat(p[1])];
  };
  const hero = bounds(tok('hero'));
  const label = bounds(tok('label'));
  const body = bounds(tok('body'));
  const micro = bounds(tok('micro'));

  // HARD FLOOR: no label text below 13px, at any viewport.
  assert.ok(label[0] >= 13, `--fs-label floor is ${label[0]}px, must be >= 13px`);
  // HARD FLOOR: body/tappable text never below 16px (also the iOS no-zoom threshold).
  assert.ok(body[0] >= 16, `--fs-body floor is ${body[0]}px, must be >= 16px`);
  // --fs-micro is decoration only, but still never sub-11px.
  assert.ok(micro[0] >= 11, `--fs-micro floor is ${micro[0]}px, must be >= 11px`);
  // THE HIERARCHY: hero must be ~7x the label. This is the whole point of the scale -
  // if someone "tidies" hero down to 48px the screens go flat again and this fails.
  const ratio = hero[1] / label[1];
  assert.ok(ratio >= 6.5, `hero:label is ${ratio.toFixed(2)}:1, must be >= 6.5:1 (target ~7:1)`);

  // Steps must be strictly descending, or the scale is not a scale.
  const order = ['hero', 'h1', 'h2', 'panel', 'body', 'label', 'micro'].map((n) => bounds(tok(n))[1]);
  for (let i = 1; i < order.length; i++) {
    assert.ok(order[i] < order[i - 1], `scale step ${i} (${order[i]}px) is not smaller than ${order[i - 1]}px`);
  }
});

test('the touch-target floors are 44px / 8px', () => {
  const css = strip(readFileSync(join(SRC, 'theme', 'type.css'), 'utf8'));
  const min = css.match(/--tap-min\s*:\s*([\d.]+)px/);
  const gap = css.match(/--tap-gap\s*:\s*([\d.]+)px/);
  assert.ok(min && parseFloat(min[1]) >= 44, '--tap-min must be >= 44px');
  assert.ok(gap && parseFloat(gap[1]) >= 8, '--tap-gap must be >= 8px');
});

// A tappable thing may never render text below 16px: --fs-label (13) and --fs-micro (11)
// are both under the floor, so neither may appear on a button/input/link rule.
// Matches real controls only. A -pill / -tile is a SHAPE, not a control (the combo HUD
// readout is a pill and is not tappable), so those are excluded; a pill that IS a button
// carries -btn and is still caught.
const TAPPABLE = /(^|[\s.#>+~])(?:[a-z0-9-]*-)?(?:btn|button|input|link|tab)\b/i;
const SUB16 = /var\(--fs-(?:label|micro)\)/i;

test('no tappable text below 16px', () => {
  const offenders = [];
  for (const file of cssFiles(SRC)) {
    const css = strip(readFileSync(file, 'utf8'));
    for (const r of rules(css)) {
      if (/@|%/.test(r.sel)) continue;
      if (!TAPPABLE.test(r.sel)) continue;
      const m = r.body.match(/font-size\s*:\s*([^;]+)/i);
      if (!m || !SUB16.test(m[1])) continue;
      offenders.push(`${norm(file)}:${lineOf(css, r.index)}  ${r.sel} -> ${m[1].trim()}`);
    }
  }
  assert.equal(
    offenders.length, 0,
    `tappable text must be >= 16px (--fs-body or larger):\n${offenders.join('\n')}`
  );
});

test('no declared touch target smaller than 44px', () => {
  const offenders = [];
  for (const file of cssFiles(SRC)) {
    const css = strip(readFileSync(file, 'utf8'));
    for (const r of rules(css)) {
      if (/@|%/.test(r.sel)) continue;
      if (!TAPPABLE.test(r.sel)) continue;
      for (const prop of ['min-height', 'min-width']) {
        const m = r.body.match(new RegExp(prop + '\\s*:\\s*([\\d.]+)px'));
        if (m && parseFloat(m[1]) < 44) {
          offenders.push(`${norm(file)}:${lineOf(css, r.index)}  ${r.sel} -> ${prop}: ${m[1]}px`);
        }
      }
    }
  }
  assert.equal(
    offenders.length, 0,
    `a touch target must be >= 44x44 (use var(--tap-min)):\n${offenders.join('\n')}`
  );
});

test('Bungee stays display type: ALL-CAPS, never below --fs-panel', () => {
  const notCaps = [];
  const tooSmall = [];
  const SMALL = new Set(['--fs-body', '--fs-label', '--fs-micro']);
  for (const file of cssFiles(SRC)) {
    if (norm(file).endsWith('theme/type.css')) continue;
    const css = strip(readFileSync(file, 'utf8'));
    for (const r of rules(css)) {
      if (/@|%/.test(r.sel)) continue;
      if (!/font-family\s*:[^;]*bungee/i.test(r.body)) continue;
      const where = `${norm(file)}:${lineOf(css, r.index)}  ${r.sel}`;
      if (!/text-transform\s*:\s*uppercase/i.test(r.body)) notCaps.push(where);
      const m = r.body.match(/font-size\s*:\s*var\((--fs-[a-z0-9]+)\)/i);
      if (m && SMALL.has(m[1])) tooSmall.push(`${where} -> ${m[1]}`);
    }
  }
  assert.equal(notCaps.length, 0, `Bungee is ALL-CAPS only:\n${notCaps.join('\n')}`);
  assert.equal(
    tooSmall.length, 0,
    `Bungee never goes below --fs-panel (28px). Small UI text belongs in Space Mono:\n${tooSmall.join('\n')}`
  );
});

test('exactly one --v-accent element per screen', () => {
  const offenders = [];
  for (const file of cssFiles(SRC)) {
    if (norm(file).startsWith('src/theme/') || norm(file).includes('/theme/')) continue;
    const css = strip(readFileSync(file, 'utf8'));
    const accented = new Set();
    for (const r of rules(css)) {
      if (/@|%/.test(r.sel)) continue;
      if (!/var\(--v-accent\)/.test(r.body)) continue;
      // :hover / :active / :focus of the SAME element is still that one element.
      accented.add(r.sel.replace(/:{1,2}[a-z-]+(\([^)]*\))?/gi, '').trim());
    }
    if (accented.size > 1) {
      offenders.push(`${norm(file)} paints ${accented.size} accent elements: ${[...accented].join(' | ')}`);
    }
  }
  assert.equal(
    offenders.length, 0,
    `A screen may spend its accent on ONE element. Demote the rest to --v-panel:\n${offenders.join('\n')}`
  );
});
