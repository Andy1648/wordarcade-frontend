#!/usr/bin/env node
// v11-estimate.mjs — ARITHMETIC estimate of PROGRESSION v11 (amended oct3 18:15) pacing. NOT the economy
// sim (no shop, no wins, no marks, no claims): the real measurement is loop-sim.mjs on CI. One bot plays
// word by word; the BAR fills from LETTERS TYPED only (game words pay wins, never XP):
//   level XP / word = letters typed × 10 × KEY(T(t)) × REBIRTH(R) × MARK
//   letters typed   = word length × (1 + miss rate)      (typos are letters too — loop-sim's SKILLS.miss)
//   need(n)         = the version's fixed curve (one curve for everyone)
//   rebirth         = at every REBIRTH_TABLE gate, as loop-sim's greedy bot (HEAD START ignored)
//   KEY tier T(t)   = the tier timeline loop-sim measured (claude/econ-oct2/loop-sim-final.json), extended
//                     past 20 h at +1 tier per doubling of play time. ASSUMPTION: the wins side is unchanged,
//                     so the tier pace is roughly unchanged. `--stretch=N` replays it N× slower.
//   MARK            = ×1 (conservative: the worn mark's +10–50% XP is left out)
// Reported: first reach of LV50/100/150/200/225/300/400; MINUTES PER LEVEL at LV10/50/100/200 (first
// time the level is reached: minutes from reaching L to reaching L+1 in the same climb); the smallest
// share of a level one word moved the bar (dead bar < 0.2%); LV1→15 time per climb.
//   node claude/econ-oct2/v11-estimate.mjs [hours] [--stretch=N]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const GATES = [15, 25, 40, 60, 75, 100, 125, 150, 175, 200, 225, 260, 300, 340, 380, 420, 465, 510, 560, 600];
const gate = (rc) => (rc < GATES.length ? GATES[rc] : 600 + 50 * (rc - 19));

export const SKILLS = {
  casual: { wpm: 6, len: 5, miss: 0.15 },
  median: { wpm: 10, len: 6, miss: 0.08 },
  strong: { wpm: 16, len: 7, miss: 0.04 },
};
let KEYT = {};
try {
  const j = require('./loop-sim-final.json');
  for (const r of j.results) KEYT[r.skill.id || r.skill] = r.keyTimes.map((k) => [k[0], Number(k[1].slice(1))]);
} catch {
  KEYT = {};
}
function tierAt(skill, min, stretch = 1) {
  const tl = KEYT[skill] || [];
  let t = 0;
  for (const [m, k] of tl) if (m * stretch <= min) t = k;
  const last = tl[tl.length - 1];
  const end = 1200 * stretch;
  if (last && min > end) t = Math.max(t, last[1] + Math.floor(Math.log2(min / end)) + 1);
  return t;
}

export const VERSIONS = {
  // V1 — THE PICK: need = 100 + 15·n²·1.004^(n−1) (a quadratic with a gentle exponential lean — between
  // v9's L^4 and v10's power-scaled exponential); KEY ×1.2 a tier ("+20% XP"), rebirth ×(1+R).
  V1: { name: 'need = 100 + 15 n^2 1.004^(n-1); KEY x1.2/tier; rebirth x(1+R)', poly: true, B: 100, A: 15, p: 2, g: 1.004, key: (t) => Math.pow(1.2, t), rb: (r) => 1 + r },
  // V2 — PURE EXPONENTIAL: need = 300·1.04^(n−1), same XP side.
  V2: { name: 'need = 300 x 1.04^(n-1); KEY x1.2/tier; rebirth x(1+R)', base: 300, g1: 1.04, brk: 9999, g2: 1.04, key: (t) => Math.pow(1.2, t), rb: (r) => 1 + r },
  // V3 — ADDITIVE KEY: V1's curve, KEY +25% of base a tier (T5 ×2.25).
  V3: { name: 'need as V1; KEY +25%/tier (additive); rebirth x(1+R)', poly: true, B: 100, A: 15, p: 2, g: 1.004, key: (t) => 1 + 0.25 * t, rb: (r) => 1 + r },
};
export function needOf(v, n) {
  if (v.poly) return (v.B || 0) + v.A * Math.pow(n, v.p) * Math.pow(v.g, n - 1);
  if (n <= v.brk) return v.base * Math.pow(v.g1, n - 1);
  return v.base * Math.pow(v.g1, v.brk - 1) * Math.pow(v.g2, n - v.brk);
}

export const PACE_LEVELS = [10, 50, 100, 200];
export function run(v, skillId, hours = 200, opts = {}) {
  const s = SKILLS[skillId];
  const dt = 1 / s.wpm;
  let t = 0;
  let lv = 1;
  let frac = 0;
  let rc = 0;
  const reach = {};
  const MARKS = [50, 100, 150, 200, 225, 300, 400];
  const pctBands = {};
  const climbs = [];
  const pace = {}; // L → minutes at level L (first time reached)
  const paceStart = {};
  let climbStart = 0;
  let to15 = null;
  while (t < hours * 60) {
    const T = tierAt(skillId, t, opts.stretch || 1);
    const xp = s.len * (1 + s.miss) * 10 * v.key(T) * v.rb(rc);
    const need = needOf(v, lv);
    const pctW = (xp / need) * 100;
    const band = Math.min(400, Math.ceil(lv / 50) * 50);
    if (lv <= 400) pctBands[band] = Math.min(pctBands[band] ?? Infinity, pctW);
    frac += xp / need;
    while (frac >= 1) {
      frac = (frac - 1) * (needOf(v, lv) / needOf(v, lv + 1));
      if (paceStart[lv] != null && pace[lv] == null) pace[lv] = t - paceStart[lv];
      lv += 1;
      if (PACE_LEVELS.includes(lv) && paceStart[lv] == null) paceStart[lv] = t;
      for (const m of MARKS) if (lv >= m && reach[m] == null) reach[m] = t;
      if (lv === 15 && to15 == null) to15 = t - climbStart;
    }
    if (lv >= gate(rc)) {
      for (const L of PACE_LEVELS) if (pace[L] == null && paceStart[L] != null) delete paceStart[L]; // rebirth cut it short
      climbs.push({ rc, gate: gate(rc), minutes: t - climbStart, to15 });
      rc += 1;
      lv = 1;
      frac = 0;
      climbStart = t;
      to15 = null;
    }
    t += dt;
  }
  return { reach, pctBands, rc, lv, climbs, pace };
}

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('v11-estimate.mjs');
if (isMain) {
  const hours = Number(process.argv.find((a) => /^\d+$/.test(a))) || 200;
  const st = process.argv.find((a) => a.startsWith('--stretch='));
  const stretch = st ? Number(st.split('=')[1]) : 1;
  const h = (m) => (m == null ? '—' : m < 1 ? `${(m * 60).toFixed(0)}s` : m < 60 ? `${m.toFixed(1)}m` : `${(m / 60).toFixed(1)}h`);
  console.log(`v11 (amended) estimate — ${hours} h per bot, KEY timeline stretch ×${stretch}, letters-only XP`);
  for (const [id, v] of Object.entries(VERSIONS)) {
    console.log(`\n${id} ${v.name}\n   need(10)=${needOf(v, 10).toPrecision(3)} need(50)=${needOf(v, 50).toPrecision(3)} need(100)=${needOf(v, 100).toPrecision(3)} need(200)=${needOf(v, 200).toPrecision(3)} need(400)=${needOf(v, 400).toPrecision(3)}`);
    for (const sk of Object.keys(SKILLS)) {
      const r = run(v, sk, hours, { stretch });
      const bands = Object.entries(r.pctBands).map(([b, p]) => `${b}:${p.toPrecision(2)}`).join(' ');
      const c = r.climbs;
      const climb = (i) => (c[i] ? `${h(c[i].to15)}` : '—');
      console.log(`   ${sk.padEnd(7)} LV50 ${h(r.reach[50])} | LV100 ${h(r.reach[100])} | LV200 ${h(r.reach[200])} | LV225 ${h(r.reach[225])} | LV300 ${h(r.reach[300])} | LV400 ${h(r.reach[400])} | end R${r.rc} LV${r.lv}`);
      console.log(`           min/level @LV10 ${h(r.pace[10])} · @LV50 ${h(r.pace[50])} · @LV100 ${h(r.pace[100])} · @LV200 ${h(r.pace[200])}`);
      console.log(`           min % of a level per word, by band (LV≤N): ${bands}`);
      console.log(`           LV1→15 per climb: first ${climb(0)} · after R1 ${climb(1)} · R3 ${climb(3)} · R6 ${climb(6)} · R10 ${climb(10)}`);
    }
  }
}
