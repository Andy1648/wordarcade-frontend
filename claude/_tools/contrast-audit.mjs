// contrast-audit.mjs — PHASE 1's missing deliverable, plus an adversarial pass over it.
//
// The brief asked Phase 1 to "print every pair you fixed and every screen's accent
// element". No such report was written; the ratios exist only as claims in comments
// inside src/theme/type.css. This does two things:
//
//   1. RE-DERIVES every claimed ratio from the hex values with the WCAG formula, and
//      flags any comment whose number is wrong. A contrast note that drifts from its own
//      colour is worse than no note, because it is trusted.
//   2. PRINTS the accent map: which screen assigns which hue to --v-accent, and which
//      single element spends it. That is the value-grouping rule made auditable by eye,
//      alongside the unit test that already enforces the count.
//
// Pure arithmetic and file reads - no browser, so it is safe to run while a gate is using
// the machine. Usage: node contrast-audit.mjs
import fs from 'fs';
import path from 'path';

const SRC = path.resolve('src');

const hex = (h) => {
  const s = h.replace('#', '').trim();
  const n = s.length === 3 ? s.split('').map((c) => c + c).join('') : s;
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
};
const lin = (v) => {
  v /= 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};
const lum = (h) => {
  const [r, g, b] = hex(h);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const ratio = (a, b) => {
  const la = lum(a);
  const lb = lum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};
const r2 = (n) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------- 1. the claims
const typeCss = fs.readFileSync(path.join(SRC, 'theme', 'type.css'), 'utf8');

const FIELD = '#0d0618';
const PAPER = '#f0ead9';

// Every "N.NN:1" in the token block, with the colour it belongs to and the ground the
// comment says it is measured on.
const claims = [];
const tokenLine = /--([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8})\s*;?\s*(?:\/\*([^*]*)\*\/)?/g;
let m;
while ((m = tokenLine.exec(typeCss))) {
  const [, name, value, comment] = m;
  if (!comment) continue;
  // A multi-line block after a token is a SECTION note, not that token's measurement.
  if (comment.indexOf(String.fromCharCode(10)) >= 0) continue;
  const found = /([0-9]+\.[0-9]+):1/.exec(comment);
  if (!found) continue;
  // WHICH GROUND THE NUMBER IS MEASURED ON. This needs care, and getting it wrong made
  // the first run of this audit report two false mismatches - which is precisely the
  // failure the audit exists to catch, so it is fixed rather than tolerated:
  //   * --c-purple's comment reads "FILL ONLY (3.90:1) - put WHITE on it, never cream".
  //     The word "cream" is about what may sit ON the purple; the 3.90 is on the FIELD.
  //   * --v-accent's trailing comment block is actually --v-ink-dim's note, which
  //     mentions 4.5:1. A ratio only belongs to a token when the comment is on its line.
  // So: paper is the ground only when the comment names the paper hex or says the ratio
  // is "on" cream/paper, and a ratio is only attributed when it sits in the same comment
  // as the word it qualifies rather than in a block that happens to follow.
  const onPaper = /on\s+(the\s+)?(cream|paper)/i.test(comment) || /F0EAD9/i.test(comment);
  claims.push({ name, value, claimed: Number(found[1]), ground: onPaper ? PAPER : FIELD, comment: comment.trim() });
}

// Claims that live in prose rather than on a token line.
const prose = [
  ['#9A28FF on the field', '#9a28ff', FIELD, 3.9],
  ['#9A1AFF on the field', '#9a1aff', FIELD, 3.75],
  ['white on #9A28FF', '#ffffff', '#9a28ff', 5.1],
  ['cream on #9A28FF', '#f0ead9', '#9a28ff', 4.24],
];

console.log('PHASE 1 CONTRAST AUDIT');
console.log('='.repeat(78));
console.log('\n1. EVERY CLAIMED RATIO, RE-DERIVED FROM THE HEX\n');
console.log('token / pair                       colour    ground    claimed  actual   verdict');
let wrong = 0;
for (const c of claims) {
  const actual = r2(ratio(c.value, c.ground));
  const ok = Math.abs(actual - c.claimed) <= 0.05;
  if (!ok) wrong++;
  console.log(
    `${c.name.padEnd(34)} ${c.value.padEnd(9)} ${c.ground.padEnd(9)} ${String(c.claimed).padStart(7)}  ${String(actual).padStart(6)}   ${ok ? 'ok' : 'MISMATCH'}`
  );
}
for (const [label, fg, bg, claimed] of prose) {
  const actual = r2(ratio(fg, bg));
  const ok = Math.abs(actual - claimed) <= 0.05;
  if (!ok) wrong++;
  console.log(`${label.padEnd(34)} ${fg.padEnd(9)} ${bg.padEnd(9)} ${String(claimed).padStart(7)}  ${String(actual).padStart(6)}   ${ok ? 'ok' : 'MISMATCH'}`);
}

// ---------------------------------------------------------------- 2. the floors
console.log('\n2. EVERY PALETTE COLOUR AGAINST THE TWO FLOORS ON THE DARK FIELD\n');
console.log('  body text needs >= 4.5:1   large text / UI needs >= 3:1\n');
const palette = [...typeCss.matchAll(/--(c-[a-z-]+):\s*(#[0-9a-fA-F]{6})/g)].map((x) => [x[1], x[2]]);
console.log('colour              hex        on field  body>=4.5  large>=3   allowed as');
for (const [name, value] of palette) {
  const onField = r2(ratio(value, FIELD));
  const body = onField >= 4.5;
  const large = onField >= 3;
  const use = body ? 'any text' : large ? 'LARGE text / UI only' : 'FILL ONLY';
  console.log(
    `${name.padEnd(19)} ${value.padEnd(10)} ${String(onField).padStart(8)}  ${(body ? 'pass' : 'FAIL').padEnd(9)}  ${(large ? 'pass' : 'FAIL').padEnd(9)}  ${use}`
  );
}

// The ink values that are allowed to sit on the field as body copy.
console.log('\n  ink values on the field:');
for (const n of ['v-ink', 'v-ink-dim', 'v-ink-faint', 'v-rule']) {
  const mm = new RegExp(`--${n}:\\s*(#[0-9a-fA-F]{6})`).exec(typeCss);
  if (!mm) continue;
  const v = mm[1];
  const rr = r2(ratio(v, FIELD));
  const verdict = n === 'v-rule' ? 'borders only, never text' : rr >= 4.5 ? 'body-safe' : 'FAILS body';
  console.log(`    --${n.padEnd(16)} ${v}  ${String(rr).padStart(6)}:1  ${verdict}`);
}

// What each accent looks like with the field as its ink (the .v-accent rule).
console.log('\n  field ink ON each accent fill (the .v-accent rule puts --v-field on --v-accent):');
for (const [name, value] of palette) {
  if (name === 'c-purple-text' || name === 'c-ink-paper') continue;
  const rr = r2(ratio(FIELD, value));
  console.log(`    ${name.padEnd(16)} ${value}  ${String(rr).padStart(6)}:1  ${rr >= 4.5 ? 'ok' : 'FAILS - needs white ink instead'}`);
}

// ---------------------------------------------------------------- 3. the accent map
console.log('\n3. THE ACCENT MAP — one hot element per screen\n');
const valuesCss = fs.readFileSync(path.join(SRC, 'theme', 'values.css'), 'utf8');
const assigns = [...valuesCss.matchAll(/^\.([a-z0-9-]+)\s*\{\s*--v-accent:\s*var\(--([a-z-]+)\)[^}]*\}(?:\s*\/\*([^*]*)\*\/)?/gm)];

// find which selector in each screen's own CSS spends var(--v-accent)
const files = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.css')) files.push(p);
  }
};
walk(SRC);
const spenders = [];
for (const f of files) {
  const css = fs.readFileSync(f, 'utf8');
  const re = /([^{}]+)\{([^}]*var\(--v-accent\)[^}]*)\}/g;
  let mm2;
  while ((mm2 = re.exec(css))) {
    const sel = mm2[1].trim().split('\n').pop().trim();
    if (sel.startsWith('@') || /--v-accent\s*:/.test(mm2[2])) continue;
    spenders.push({ file: path.relative(SRC, f), sel, decl: mm2[2].trim().split('\n')[0].trim().slice(0, 60) });
  }
}
console.log('screen root            accent hue        spent by');
for (const [, root, hue, note] of assigns) {
  const hex2 = (new RegExp(`--${hue}:\\s*(#[0-9a-fA-F]{6})`).exec(typeCss) || [])[1] || '?';
  const mine = spenders.filter((s) => s.sel.includes(root) || s.file.toLowerCase().includes(root.split('-')[0]));
  const who = mine.length ? mine.map((s) => s.sel).join(' + ') : '(no element in this screen spends it)';
  console.log(`.${root.padEnd(21)} ${hue.padEnd(12)} ${hex2.padEnd(9)} ${who}${note ? '   // ' + note.trim() : ''}`);
}
console.log('\n  every selector anywhere that paints with var(--v-accent):');
for (const s of spenders) console.log(`    ${s.file.padEnd(34)} ${s.sel}`);

console.log('\n' + '='.repeat(78));
console.log(wrong === 0 ? 'All claimed ratios re-derive correctly.' : `${wrong} CLAIMED RATIO(S) DO NOT MATCH THE HEX.`);
