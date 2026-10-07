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
//   3. (sweep 2) HARD BANS across every src/**/*.{js,jsx}: toLocaleString, Intl.NumberFormat,
//      String(<big quantity>), and a `{x.toFixed(n)}` JSX text child — each formats a number
//      around formatNum whatever the variable is called. Both allowlists are reviewed and a stale
//      entry fails the build.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatNum, formatRate, formatMult, formatMultExact, formatPct, formatGainPct, plural } from './format.js';
import { shareNum } from './share/resultCard.js';
import { tickText } from './leaderboard/tickText.js';
import { targetLine } from './leaderboard/boardTarget.js';

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

test('copy builders outside JSX hand big numbers to formatNum (ticker, board target)', () => {
  assert.equal(tickText({ k: 'rank', n: 'ZED', v: 1343513 }), 'ZED took #1.34M');
  assert.equal(tickText({ k: 'lv', n: 'ZED', v: 12345 }), 'ZED just hit LV 12.3K');
  assert.equal(tickText({ k: 'rb', n: 'ZED', v: 3 }), 'ZED reached REBIRTH 3');
  const line = targetLine([{ rank: 99999, level: 9 }], { rank: 100000, level: 1 });
  assert.doesNotMatch(line, RAW_RUN, line);
});

// ---- the source scan ----------------------------------------------------------------------------
const SRC = fileURLToPath(new URL('.', import.meta.url));
function srcFiles(dir, exts, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) srcFiles(p, exts, out);
    else if (exts.some((e) => name.endsWith(e)) && !/\.(test|spec)\.jsx?$/.test(name)) out.push(p);
  }
  return out;
}
const jsxFiles = (dir) => srcFiles(dir, ['.jsx']);
// The quantities that grow without bound. Matched against the LAST segment of a member chain
// (`s.score`, `pb.best`, `stars.balance`), case-insensitively, as a whole word or a camelCase tail.
// Sweep 2 adds RANK: a leaderboard place is unbounded too (#12,345 → "#12.3K").
const BIG = '(?:wins|xp|score|cost|price|balance|amount|total|payout|gain|stars|best|points|rank|lifetime\\w*|roundScore|winsEarned|winsTally)';
const IDENT = `[A-Za-z_$][\\w$]*(?:\\??\\.[A-Za-z_$][\\w$]*)*`;
// a JSX text child: `>{x}`, ` {x}`, `+{x}`, `#{x}`, `({x}` — NOT an attribute value `={x}`
const TEXT_CHILD = new RegExp(`(?<![=\\w$])\\{\\s*(${IDENT})\\s*\\}`, 'g');
// REVIEWED EXCEPTIONS — each is NOT a raw number: file:expression → why. Every entry must still
// match a real line (the stale-allowlist test below), so a removed site takes its excuse with it.
const ALLOW = new Map([
  ['GameCard.jsx:payout', 'a JSX fragment whose number is already formatRate()d'],
  ['StatsScreen.jsx:card.rank', 'the rank TITLE string (rankTitle(level)), not a leaderboard place'],
]);
// a template interpolation inside aria-label / title / a text-ish template: `${x}`
const TEMPLATE = new RegExp(`\\$\\{\\s*(${IDENT})\\s*\\}`, 'g');
const BIG_TAIL = new RegExp(`(?:^|\\.|[a-z])${BIG}$`, 'i');

function bigName(expr) {
  const last = expr.split('.').pop().replace('?', '');
  return BIG_TAIL.test(last) || new RegExp(`^${BIG}$`, 'i').test(last);
}

// a line with its comment stripped ('' for a comment line), so prose about `toLocaleString` is no hit
function codeOf(line) {
  const code = line.replace(/\/\/.*$/, '');
  if (/^\s*(\*|\/\*|\{\/\*)/.test(code)) return '';
  return code;
}

function scanRawRenders() {
  const hits = [];
  const used = new Set();
  for (const file of jsxFiles(SRC)) {
    const base = file.split(/[\\/]/).pop();
    readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, i) => {
      const code = codeOf(line);
      if (!code) return;
      if (/^\s*(import|export)\b.*\bfrom\b/.test(code)) return; // `import { wins } from` is not a render
      if (/\bfunction\b[^(]*\(\s*\{|\(\s*\{[^}]*\}\s*\)\s*=>/.test(code)) return; // `({ wins }) =>` props, not a render
      for (const m of code.matchAll(TEXT_CHILD)) {
        const key = `${base}:${m[1]}`;
        if (ALLOW.has(key)) { used.add(key); continue; }
        if (bigName(m[1])) hits.push(`${relative(SRC, file)}:${i + 1}  {${m[1]}}`);
      }
      // template interpolations only where they are READ: aria-label / title / "#rank" / a text template
      if (/aria-label=|title=|textContent|#\$\{|`[^`]*\b(WINS|XP|PTS|SCORE|BEST|TOTAL|RANK|wins|score|best)\b/.test(code)) {
        for (const m of code.matchAll(TEMPLATE)) {
          const before = code.slice(0, m.index);
          if (/(className|key|style|data-[\w-]+|id|href|src)=\{`[^`]*$/.test(before)) continue;
          const key = `${base}:${m[1]}`;
          if (ALLOW.has(key)) { used.add(key); continue; }
          if (bigName(m[1])) hits.push(`${relative(SRC, file)}:${i + 1}  \${${m[1]}}`);
        }
      }
    });
  }
  return { hits, used };
}

test('no src/**/*.jsx renders a big economy value raw (wrap it in formatNum / formatRate)', () => {
  const { hits } = scanRawRenders();
  assert.deepEqual(hits, [], `raw big-number renders:\n${hits.join('\n')}`);
});

test('the reviewed allowlist has no stale entries', () => {
  const { used } = scanRawRenders();
  const stale = [...ALLOW.keys()].filter((k) => !used.has(k));
  assert.deepEqual(stale, [], `allowlist entries that no longer match a line — delete them:\n${stale.join('\n')}`);
});

// HARD BANS across every src/**/*.{js,jsx} (not tests, not format.js itself). Each one formats a
// number around the one formatter, whatever the variable is called:
//   - `.toLocaleString(` / `Intl.NumberFormat` — grouping, no abbreviation: "1,343,513,423"
//   - `String(<big quantity>)` — the raw digits, exactly the "1343513423" bug
//   - `{x.toFixed(n)}` as a JSX text child — raw digits with a decimal point bolted on
// Dates (`toLocaleDateString` / `toLocaleTimeString`) are not numbers and are not matched.
const BAN = [
  { rule: 'toLocaleString', re: /\.toLocaleString\(/ },
  { rule: 'Intl.NumberFormat', re: /\bIntl\.NumberFormat\b/ },
  { rule: 'String(big)', re: new RegExp(`\\bString\\(\\s*(${IDENT})\\s*\\)`), pred: (m) => bigName(m[1]) },
  { rule: 'toFixed text child', re: /(?<![=\w$`{])\{\s*[^{}=]*\.toFixed\(/, ext: '.jsx' },
];
// REVIEWED EXCEPTIONS to the bans: a value BOUNDED far below 10,000 by construction, matched by
// file + rule + a needle from the line. A stale entry fails the build like the one above.
const BAN_ALLOW = [
  { file: 'ClutchBurst.jsx', rule: 'toFixed text child', needle: '(leftMs / 1000).toFixed(1)', why: 'seconds left in the clutch window (< 60)' },
];
const banAllowed = (base, rule, code) => BAN_ALLOW.find((a) => a.file === base && a.rule === rule && code.includes(a.needle));

test('no src file formats a number around formatNum (toLocaleString, Intl, String(big), toFixed child)', () => {
  const hits = [];
  const used = new Set();
  for (const file of srcFiles(SRC, ['.js', '.jsx'])) {
    const base = file.split(/[\\/]/).pop();
    if (base === 'format.js') continue;
    readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, i) => {
      const code = codeOf(line);
      if (!code) return;
      for (const { rule, re, pred, ext } of BAN) {
        if (ext && !file.endsWith(ext)) continue;
        const m = code.match(re);
        if (!m || (pred && !pred(m))) continue;
        const ok = banAllowed(base, rule, code);
        if (ok) { used.add(ok); continue; }
        hits.push(`${relative(SRC, file)}:${i + 1}  ${rule}: ${code.trim().slice(0, 90)}`);
      }
    });
  }
  assert.deepEqual(hits, [], `numbers formatted around formatNum:\n${hits.join('\n')}`);
  const stale = BAN_ALLOW.filter((a) => !used.has(a)).map((a) => `${a.file}: ${a.needle}`);
  assert.deepEqual(stale, [], `stale ban exceptions — delete them:\n${stale.join('\n')}`);
});

test('the scan catches the shapes it bans (self-check, so a regex edit cannot neuter it)', () => {
  assert.ok([...'YOU ARE #{rank} ON THE BOARD'.matchAll(TEXT_CHILD)].some((m) => bigName(m[1])), '#{rank}');
  assert.ok(BAN[0].re.test('{n.toLocaleString()}'));
  assert.ok(!BAN[0].re.test('d.toLocaleDateString()'), 'dates are not numbers');
  const m = 'label = String(winsTotal)'.match(BAN[2].re);
  assert.ok(m && BAN[2].pred(m), 'String(winsTotal)');
  assert.ok(!BAN[2].pred('String(word)'.match(BAN[2].re)), 'String(word) is not a number');
  assert.ok(BAN[3].re.test('<b>{rate.toFixed(1)}</b>'));
  assert.ok(!BAN[3].re.test('style={{ transform: `scaleX(${f.toFixed(3)})` }}'), 'a style value is not text');
});

