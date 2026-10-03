#!/usr/bin/env node
// marks-summary.mjs TAG [N] — aggregate the MARK ROLLS numbers out of compare.sh's AFTER runs
// (loop-sim-<TAG>-a<seed>.json, written by loop-sim.mjs when the tree ships progress/markRolls.js).
// Prints, per skill, the mean / min / max over seeds of: paid rolls per hour, rolls in hour 1 and
// hour 20, minutes (and roll #) to the first EPIC+ and first LEGENDARY, pity hits, golds/rainbows,
// the largest single-roll income step in LEVELS (ln step / ln level-growth, the loop-sim buy metric)
// and how many rolls exceed 3 levels. Also the median minute each achievement was earned (BEFORE runs).
//   node claude/econ-oct2/marks-summary.mjs mrA 5
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TAG = process.argv[2] || 'mrA';
const N = Number(process.argv[3]) || 5;
const load = (k, s) => JSON.parse(fs.readFileSync(path.join(HERE, `loop-sim-${TAG}-${k}${s}.json`), 'utf8'));
const stat = (a) => {
  const v = a.filter((x) => x != null && Number.isFinite(x));
  if (!v.length) return 'never';
  const mean = v.reduce((s, x) => s + x, 0) / v.length;
  const r = (x) => (Math.abs(x) >= 100 ? Math.round(x) : +x.toFixed(1));
  return `${r(mean)} (${r(Math.min(...v))}–${r(Math.max(...v))})${v.length < a.length ? ` [${a.length - v.length} never]` : ''}`;
};
const bySkill = {};
const achBefore = {};
for (let s = 0; s < N; s++) {
  for (const r of load('a', s).results) {
    const R = r.rolls;
    if (!R) continue;
    const o = (bySkill[r.skill] ||= { perHour: [], h1: [], h20: [], epicMin: [], epicRoll: [], legMin: [], legRoll: [], pityE: [], pityL: [], gold: [], rb: [], maxLv: [], over3: [], maxLvAt: [], runaway: [], luckEnd: [], rollsTotal: [] });
    o.perHour.push(R.meanPerHour);
    o.h1.push(R.perHour[0]);
    o.h20.push(R.perHour[R.perHour.length - 1]);
    o.epicMin.push(R.firstEpic ? R.firstEpic.t : null);
    o.epicRoll.push(R.firstEpic ? R.firstEpic.roll : null);
    o.legMin.push(R.firstLegendary ? R.firstLegendary.t : null);
    o.legRoll.push(R.firstLegendary ? R.firstLegendary.roll : null);
    o.pityE.push(R.pityEpic);
    o.pityL.push(R.pityLegendary);
    o.gold.push(R.golds);
    o.rb.push(R.rainbows);
    o.maxLv.push(R.maxStepPaid ? R.maxStepPaid.curveLevels : 0);
    o.maxLvAt.push(R.maxStepPaid ? `${R.maxStepPaid.markId}@LV${R.maxStepPaid.level} ×${R.maxStepPaid.step}` : '-');
    o.over3.push(R.overThreeLevels);
    o.runaway.push(r.runaway.failCount);
    const lumps = [...r.runaway.worstByMinutes, ...r.runaway.worstLumps];
    (o.failLabels ||= new Set());
    for (const l of lumps) if (l.fail) o.failLabels.add(`${l.label} (${l.minutesOfPlay} min)`);
    (o.indexWorst ||= []).push(Math.max(0, ...lumps.filter((l) => /^INDEX/.test(l.label)).map((l) => l.minutesOfPlay)));
    o.rollsTotal.push(R.paidRolls);
    const last = R.log && R.log.length ? R.log[R.log.length - 1] : null;
    o.luckEnd.push(last ? last.luck / (last.bonus ? 2 : 1) : null);
  }
  try {
    for (const r of load('b', s).results) for (const [id, t] of Object.entries(r.achTimes || {})) ((achBefore[r.skill] ||= {})[id] ||= []).push(t);
  } catch { /* before runs from an older loop-sim have no achTimes */ }
}
console.log(`# MARK ROLLS — ${TAG}, ${N} seeds (mean (min–max))\n`);
console.log('| skill | paid rolls / h (20 h mean) | hour 1 | hour 20 | 1st EPIC+ (min / roll #) | 1st LEGENDARY (min / roll #) | epic pity hits | leg pity hits | golds | rainbows | luck at 20 h | max single roll (levels) | rolls > 3 levels | runaway lump fails |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const [k, o] of Object.entries(bySkill)) {
  console.log(`| ${k} | ${stat(o.perHour)} | ${stat(o.h1)} | ${stat(o.h20)} | ${stat(o.epicMin)} / ${stat(o.epicRoll)} | ${stat(o.legMin)} / ${stat(o.legRoll)} | ${stat(o.pityE)} | ${stat(o.pityL)} | ${stat(o.gold)} | ${stat(o.rb)} | ${stat(o.luckEnd)} | ${stat(o.maxLv)} | ${stat(o.over3)} | ${stat(o.runaway)} |`);
}
console.log('\nLargest single paid roll per seed:');
for (const [k, o] of Object.entries(bySkill)) console.log(`- ${k}: ${o.maxLvAt.join(' · ')}`);
console.log('\nRunaway lump fails (any lump, any seed) and the largest INDEX-milestone lump among the top lumps (minutes of play; 0 = not in the top 27):');
for (const [k, o] of Object.entries(bySkill)) console.log(`- ${k}: fails ${o.failLabels.size ? [...o.failLabels].join(', ') : 'none'} · INDEX max ${Math.max(...o.indexWorst)} min`);
if (Object.keys(achBefore).length) {
  console.log('\n## Achievement earn times, BEFORE tree (median minute over seeds; "—" = not in 20 h)\n');
  const skills = Object.keys(achBefore);
  const ids = [...new Set(skills.flatMap((k) => Object.keys(achBefore[k])))];
  console.log(`| id | ${skills.join(' | ')} |`);
  console.log(`|---|${skills.map(() => '---').join('|')}|`);
  const med = (a) => { if (!a || !a.length) return '—'; const s = [...a].sort((x, y) => x - y); return `${s[Math.floor(s.length / 2)]}${a.length < N ? ` (${a.length}/${N})` : ''}`; };
  for (const id of ids) console.log(`| ${id} | ${skills.map((k) => med(achBefore[k][id])).join(' | ')} |`);
}
