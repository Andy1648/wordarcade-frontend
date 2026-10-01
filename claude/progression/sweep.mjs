// claude/progression/sweep.mjs — run econ-sim.mjs over parameter sets, each against a PATCHED copy of
// src/progress (constants rewritten by regex), in parallel. Prints one comparable row per set.
//   node claude/progression/sweep.mjs sets.json [parallel]
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const sets = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const PAR = Number(process.argv[3] || 4);
const PATCH = {
  // name: [file, regex, replacement-template using $v]
  KEY_XP_STEP: ['progress/xp.js', /export const KEY_XP_STEP = [\d.]+;/, 'export const KEY_XP_STEP = $v;'],
  KEY_COST_STEP: ['progress/xp.js', /export const KEY_COST_STEP = [\d.]+;/, 'export const KEY_COST_STEP = $v;'],
  KEY_COST_BASE: ['progress/xp.js', /export const KEY_COST_BASE = [\d.]+;/, 'export const KEY_COST_BASE = $v;'],
  REBIRTH_MULT_BASE: ['progress/xp.js', /export const REBIRTH_MULT_BASE = [\d.]+;/, 'export const REBIRTH_MULT_BASE = $v;'],
  EARLY_CURVE_EXP: ['progress/xp.js', /export const EARLY_CURVE_EXP = [\d.]+;/, 'export const EARLY_CURVE_EXP = $v;'],
  TOP_CURVE_EXP: ['progress/xp.js', /export const TOP_CURVE_EXP = [\d.]+;/, 'export const TOP_CURVE_EXP = $v;'],
  CURVE_BREAK: ['progress/xp.js', /export const CURVE_BREAK = [\d.]+;/, 'export const CURVE_BREAK = $v;'],
  CURVE_BASE: ['progress/xp.js', /export const CURVE_BASE = [\d.]+;/, 'export const CURVE_BASE = $v;'],
  MOMENTUM_BASE: ['progress/momentum.js', /export const MOMENTUM_BASE = [\d.]+;/, 'export const MOMENTUM_BASE = $v;'],
  MOMENTUM_RATIO: ['progress/momentum.js', /export const MOMENTUM_RATIO = [\d.]+;/, 'export const MOMENTUM_RATIO = $v;'],
  KEY_RESET_ON_REBIRTH: ['progress/xp.js', /  saveProgress\(\{ level: 1, intoLevel: 0 \}\);(\r?\n)  const rc = getRebirths\(\) \+ 1;/, '  saveProgress({ level: 1, intoLevel: 0 });\n  if ($v) saveKeyTier(0);\n  const rc = getRebirths() + 1;'],
};
function copyDir(a, b) {
  fs.mkdirSync(b, { recursive: true });
  for (const e of fs.readdirSync(a, { withFileTypes: true })) {
    const s = path.join(a, e.name), d = path.join(b, e.name);
    if (e.isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
}
function prep(set, i) {
  const dir = path.join(REPO, 'claude', 'progression', '.sweep', `s${i}`, 'src');
  fs.rmSync(path.dirname(dir), { recursive: true, force: true });
  copyDir(path.join(REPO, 'src'), dir);
  for (const [k, v] of Object.entries(set.params || {})) {
    const [file, re, tpl] = PATCH[k];
    const f = path.join(dir, file);
    const before = fs.readFileSync(f, 'utf8');
    if (!re.test(before)) throw new Error(`${set.name}: pattern for ${k} not found`);
    fs.writeFileSync(f, before.replace(re, tpl.replace('$v', JSON.stringify(v))));
  }
  return dir;
}
function run(set, i) {
  return new Promise((res) => {
    const src = prep(set, i);
    const tag = `sw-${set.name}`;
    const p = spawn(process.execPath, [path.join(HERE, 'econ-sim.mjs'), `--src=${src}`, `--tag=${tag}`, '--quiet', ...(set.args || [])], { cwd: REPO });
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (out += d));
    p.on('close', () => res({ set, out }));
  });
}
const pick = (out, re) => (out.match(re) || [])[1] || '?';
const queue = sets.map((s, i) => [s, i]);
const results = [];
await Promise.all(Array.from({ length: PAR }, async () => {
  while (queue.length) { const [s, i] = queue.shift(); results.push(await run(s, i)); }
}));
for (const { set, out } of results.sort((a, b) => sets.indexOf(a.set) - sets.indexOf(b.set))) {
  fs.writeFileSync(path.join(HERE, `sw-${set.name}-console.txt`), out);
  const lv = (L) => pick(out, new RegExp(`\n\s+L${L}\s+\S+ \S+ \S+ \S+\s+(\S+)`));
  const gap = pick(out, /regular\s+tail\s+strict n=\d+\s+(median \S+\s+p90 \S+\s+max \S+)/).replace(/\s+/g, ' ');
  const gap30 = pick(out, /regular\s+days30 strict n=\d+\s+(median \S+\s+p90 \S+\s+max \S+)/).replace(/\s+/g, ' ');
  const at200 = pick(out, /at200h: casual [^|]*\| (regular [^|]*)/);
  const mag = pick(out, /regular\s+L150\s+(R\d+ T\d+: need \S+ XP)/);
  const sinks = pick(out, /sinks exhausted: casual: [^|]*\| (regular: [^|]*)/);
  console.log(`\n== ${set.name} ${JSON.stringify(set.params)}\n  regular: L100 ${lv(100)} L200 ${lv(200)} L300 ${lv(300)} | gaps30 ${gap30} | tail ${gap}\n  at200h ${at200.trim()} | L150 ${mag} | ${sinks.trim()}`);
}
