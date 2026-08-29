// scale-probe.mjs — JOB 16: exercise the REAL formatting / level / xp / wins functions with
// extreme save states and record output + throw/NaN/Infinity. Run: node claude/scale-probe.mjs
import { formatNum } from '../src/format.js';
import {
  need, levelFromXp, progressOf, rebirthMult, rebirthThreshold, keyTierXp, keyTierCost,
  round10,
} from '../src/progress/xp.js';
import { perWordWins, awardWins } from '../src/progress/wins.js';
import { streakMultiplier } from '../src/progress/streak.js';
import { COLLECTION_CAP, COLLECTION_VERSION } from '../src/progress/collection.js';

const bad = (x) => (typeof x === 'number' && !Number.isFinite(x)) ? `!!${x}` : x;
function probe(label, fn) {
  try {
    const v = fn();
    console.log(label.padEnd(46), '=>', JSON.stringify(v, (k, val) => bad(val)));
  } catch (e) {
    console.log(label.padEnd(46), '=> THREW', e.message);
  }
}

console.log('=== formatNum ladder ===');
for (const n of [999, 9999, 10000, 14300, 2.2e6, 1e11, 1e15, 1e18, 1e21, 7e25, 1e30, 9.2e18, Number.MAX_SAFE_INTEGER, 1e15 + 7, NaN, Infinity]) {
  const out = formatNum(n);
  console.log(String(n).padEnd(24), '->', JSON.stringify(out), '(', out.length, 'chars )');
}

console.log('\n=== LEVEL 600 ===');
probe('need(600)', () => need(600));
probe('need(600) formatNum', () => formatNum(need(600)));
probe('need(600) > MAX_SAFE_INTEGER?', () => need(600) > Number.MAX_SAFE_INTEGER);
// cumulative XP to REACH lv600 (sum of needs) — what levelFromXp would loop over
let cum = 0; for (let i = 1; i < 600; i++) cum += need(i);
probe('cumXP to reach lv600', () => cum);
probe('cumXP formatNum', () => formatNum(cum));
probe('levelFromXp(cumXP).level', () => levelFromXp(cum).level);
probe('progressOf({level:600,intoLevel:need(599)/2})', () => {
  const p = progressOf({ level: 600, intoLevel: need(600) / 2 });
  return { level: p.level, frac: p.frac, toNext: p.toNext, toNextFmt: formatNum(p.toNext) };
});
// find first level where need() exceeds MAX_SAFE_INTEGER
let firstUnsafe = null;
for (let i = 1; i <= 2000; i++) { if (need(i) > Number.MAX_SAFE_INTEGER) { firstUnsafe = i; break; } }
probe('first level need() > MAX_SAFE_INTEGER', () => firstUnsafe);
// find first level where need() === Infinity
let firstInf = null;
for (let i = 1; i <= 10000; i++) { if (!Number.isFinite(need(i))) { firstInf = i; break; } }
probe('first level need() === Infinity', () => firstInf);
probe('need(firstInf) formatNum', () => firstInf ? formatNum(need(firstInf)) : 'n/a');

console.log('\n=== REBIRTH 20 (and beyond) ===');
for (const rc of [20, 21, 25, 30, 40, 100]) {
  probe(`rebirthMult(${rc})`, () => ({ mult: rebirthMult(rc), fmt: formatNum(rebirthMult(rc)), thr: rebirthThreshold(rc) }));
}
// first rebirth where mult is Infinity
let firstRbInf = null;
for (let i = 20; i <= 1000; i++) { if (!Number.isFinite(rebirthMult(i))) { firstRbInf = i; break; } }
probe('first rebirthCount mult === Infinity', () => firstRbInf);
// perWordWins at extreme rebirth
probe('perWordWins fuse hard R20', () => perWordWins({ mode: 'fuse', difficulty: 'hard', rebirthCount: 20 }));
probe('perWordWins fuse hard R40 fmt', () => formatNum(perWordWins({ mode: 'fuse', difficulty: 'hard', rebirthCount: 40 })));

console.log('\n=== 1e15 WINS ===');
probe('formatNum(1e15)', () => formatNum(1e15));
probe('String(1e15) roundtrip', () => Number(String(Math.floor(1e15))) === 1e15);
probe('MAX_SAFE_INTEGER', () => Number.MAX_SAFE_INTEGER);
probe('1e15 < MAX_SAFE?', () => 1e15 < Number.MAX_SAFE_INTEGER);
probe('9.5e15 int precision (9.5e15+1===9.5e15)', () => (9.5e15 + 1) === 9.5e15);
probe('formatNum(9.5e15)', () => formatNum(9.5e15));
probe('formatNum(1e18) [R20 fuse-ish]', () => formatNum(1e18));

console.log('\n=== 500-DAY STREAK ===');
probe('streakMultiplier(500)', () => streakMultiplier(500));
probe('streakMultiplier(1e9)', () => streakMultiplier(1e9));
probe('freezes at 500 days (~500/7)', () => Math.floor(500 / 7));

console.log('\n=== 100,000 DISTINCT WORDS (collection) ===');
console.log('COLLECTION_CAP =', COLLECTION_CAP, '-> store can NEVER exceed this many entries (LRU evicts).');
// Build a realistic capped store and measure serialized bytes.
function buildStore(nWords, avgLen) {
  const w = {};
  for (let i = 0; i < nWords; i++) {
    // realistic-ish word key of avgLen chars, plus 4-int entry [band, mode, day, recency]
    const key = 'w' + i.toString(36).padStart(avgLen - 1, 'a');
    w[key] = [i % 4, i % 5, 20000 + (i % 1000), i];
  }
  return { v: COLLECTION_VERSION, seq: nWords, w, ms: [100, 500, 1000, 2500, 5000] };
}
for (const [n, len] of [[5000, 8], [5000, 12], [100000, 8], [100000, 12]]) {
  const bytes = JSON.stringify(buildStore(n, len)).length;
  const note = n > COLLECTION_CAP ? '(UNREACHABLE — cap is 5000; shown to answer "what if uncapped")' : '';
  console.log(`  ${n} words @ ~${len} chars: ${(bytes / 1024).toFixed(1)} KB  ${(bytes / 1048576).toFixed(3)} MB  ${note}`);
}
console.log('  localStorage quota is ~5 MB (per-origin, string length based).');
