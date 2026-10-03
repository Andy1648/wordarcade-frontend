// node --test — NEVER RAW LONG DIGITS (Andy oct3 #3: "1343513423" on screen is a bug; everything
// ≥ 10,000 goes through formatNum → "1.34B").
//
// Two halves:
//   1. the shared helpers at the three magnitudes Andy named — 1e4, 1.34e9, 1e300 — never print a
//      raw digit run, an exponent, "Infinity" or "NaN";
//   2. a SOURCE SCAN of every src/**/*.jsx for the obvious raw render of a big economy value: a
//      JSX text child `{wins}` / `{s.score}` / `+{total}` or an aria-label/title template
//      `${balance} wins`, where the identifier names a quantity that grows without bound (wins, XP,
//      score, cost, price, balance, amount, total, payout, gain, stars, best, points). A wrapped
//      render (`{formatNum(wins)}`) does not match. A hit names file:line so the fix is obvious.
//      It is a lint, not a parser: it catches the shape that shipped "1343513423", not every
//      conceivable one.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatNum, formatRate, formatMult, formatMultExact, formatPct, formatGainPct, plural } from './format.js';
import { shareNum } from './share/resultCard.js';

const RAW_RUN = /\d{5,}/; // five or more digits in a row = an unabbreviated number ≥ 10,000
const BAD = /e[+-]?\d|Infinity|NaN|undefined/;

test('formatNum at 1e4, 1.34e9 and 1e300 abbreviates — no raw digits, no exponent', () => {
  assert.equal(formatNum(1e4), '10K');
  assert.equal(formatNum(1343513423), '1.34B');
  assert.equal(formatNum(1.34e9), '1.34B');
  const big = formatNum(1e300);
  assert.match(big, /^1[A-Za-z]+$/, big);
  for (const v of [1e4, 12345, 1.34e9, 1343513423, 9.99e14, 1e300, 1.7e308]) {
    const s = formatNum(v);
    assert.doesNotMatch(s, RAW_RUN, `${v} → ${s}`);
    assert.doesNotMatch(s, BAD, `${v} → ${s}`);
  }
});

test('formatRate / formatMult / formatMultExact / plural / shareNum hand off to formatNum from 10,000', () => {
  for (const f of [formatRate, formatMult, formatMultExact, (v) => plural(v, 'word'), shareNum]) {
    for (const v of [1e4, 1.34e9, 1e300]) {
      const s = f(v);
      assert.doesNotMatch(s, RAW_RUN, `${f.name}(${v}) → ${s}`);
      assert.doesNotMatch(s, BAD, `${f.name}(${v}) → ${s}`);
    }
  }
  assert.equal(formatRate(1.34e9), '1.34B');
  assert.equal(shareNum(1343513423), '1.34B');
  assert.equal(shareNum(1860), '1,860');
});

test('formatPct: one decimal, FLOORED (never 100.0% before the level), clamps garbage', () => {
  assert.equal(formatPct(0.437), '43.7%');
  assert.equal(formatPct(0), '0.0%');
  assert.equal(formatPct(0.99999), '99.9%');
  assert.equal(formatPct(1), '100.0%');
  assert.equal(formatPct(0.4379), '43.7%');
  assert.equal(formatPct(NaN), '0.0%');
  assert.equal(formatPct(-3), '0.0%');
  assert.equal(formatPct(7), '100.0%');
});

test('formatGainPct: any real gain shows at least +0.1%; nothing for no gain', () => {
  assert.equal(formatGainPct(0.006), '+0.6%');
  assert.equal(formatGainPct(0.00001), '+0.1%');
  assert.equal(formatGainPct(1e-12), '+0.1%');
  assert.equal(formatGainPct(0.0449), '+4.5%');
  assert.equal(formatGainPct(0), '');
  assert.equal(formatGainPct(-0.2), '');
  assert.equal(formatGainPct(NaN), '');
  assert.equal(formatGainPct(2.5), '+250.0%');
  assert.doesNotMatch(formatGainPct(1e9), RAW_RUN);
});

// ---- the source scan ----------------------------------------------------------------------------
const SRC = fileURLToPath(new URL('.', import.meta.url));
function jsxFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) jsxFiles(p, out);
    else if (name.endsWith('.jsx')) out.push(p);
  }
  return out;
}
// The quantities that grow without bound. Matched against the LAST segment of a member chain
// (`s.score`, `pb.best`, `stars.balance`), case-insensitively, as a whole word or a camelCase tail.
const BIG = '(?:wins|xp|score|cost|price|balance|amount|total|payout|gain|stars|best|points|lifetime\\w*|roundScore|winsEarned|winsTally)';
const IDENT = `[A-Za-z_$][\\w$]*(?:\\??\\.[A-Za-z_$][\\w$]*)*`;
// a JSX text child: `>{x}`, ` {x}`, `+{x}`, `({x}` — NOT an attribute value `={x}`
const TEXT_CHILD = new RegExp(`(?<![=\\w$])\\{\\s*(${IDENT})\\s*\\}`, 'g');
// Reviewed exceptions — each is NOT a raw number: file:expression → why.
const ALLOW = new Map([
  ['GameCard.jsx:payout', 'a JSX fragment whose number is already formatRate()d'],
]);
// a template interpolation inside aria-label / title / a text-ish template: `${x}`
const TEMPLATE = new RegExp(`\\$\\{\\s*(${IDENT})\\s*\\}`, 'g');
const BIG_TAIL = new RegExp(`(?:^|\\.|[a-z])${BIG}$`, 'i');

function bigName(expr) {
  const last = expr.split('.').pop().replace('?', '');
  return BIG_TAIL.test(last) || new RegExp(`^${BIG}$`, 'i').test(last);
}

test('no src/**/*.jsx renders a big economy value raw (wrap it in formatNum / formatRate)', () => {
  const hits = [];
  for (const file of jsxFiles(SRC)) {
    const lines = readFileSync(file, 'utf8').split(/\r?\n/);
    lines.forEach((line, i) => {
      const code = line.replace(/\/\/.*$/, '');
      if (/^\s*(\*|\/\*|\{\/\*)/.test(code)) return; // comment lines
      if (/^\s*(import|export)\b.*\bfrom\b/.test(code)) return; // `import { wins } from` is not a render
      const base = file.split(/[\\/]/).pop();
      for (const m of code.matchAll(TEXT_CHILD)) {
        if (ALLOW.has(`${base}:${m[1]}`)) continue;
        if (bigName(m[1])) hits.push(`${relative(SRC, file)}:${i + 1}  {${m[1]}}`);
      }
      // template interpolations only where they are READ: aria-label / title / a text template
      if (/aria-label=|title=|textContent|`[^`]*\b(WINS|XP|PTS|SCORE|BEST|TOTAL|wins|score|best)\b/.test(code)) {
        for (const m of code.matchAll(TEMPLATE)) {
          const before = code.slice(0, m.index);
          if (/(className|key|style|data-[\w-]+|id|href|src)=\{`[^`]*$/.test(before)) continue;
          if (bigName(m[1])) hits.push(`${relative(SRC, file)}:${i + 1}  \${${m[1]}}`);
        }
      }
    });
  }
  assert.deepEqual(hits, [], `raw big-number renders:\n${hits.join('\n')}`);
});
