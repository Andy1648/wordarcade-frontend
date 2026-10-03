#!/usr/bin/env node
// v11-estimate.mjs — ARITHMETIC estimate of PROGRESSION v11 pacing. NOT the economy sim (no shop, no wins,
// no marks, no claims): the real measurement is loop-sim.mjs on CI. It plays one bot word by word with
//   level XP / word = 10 × letters × mode(level) × W × keyMult(T(t)) × rbMult(R) × streak(day)
//   need(n)         = the version's fixed curve (one curve for everyone)
//   rebirth         = at every REBIRTH_TABLE gate, as loop-sim's greedy bot does (HEAD START ignored)
//   KEY tier T(t)   = the tier timeline loop-sim measured (claude/econ-oct2/loop-sim-final.json), extended
//                     past 20 h at +1 tier per doubling of play time. ASSUMPTION: the wins side is unchanged
//                     by v11, so the tier pace is roughly unchanged. `--stretch=3` replays it 3× slower
//                     (v11 rebirths are slower than that run's, so wins — and tiers — may come later).
//   W               = mean word weight (rarity × combo × lucky) — an ASSUMPTION: casual 1.8, median 2.3,
//                     strong 3.2 (rarity mean 1.23; combo mean over a run of 6–40 words; lucky 1/40 × 5).
// Mode mix follows the shipped unlocks (CHAIN LV50, FUSE LV100) by CURRENT level, as loop-sim does:
// WB only (×2 × EASY 1.25) below LV50, + CHAIN (×4) from LV50, + FUSE (×2) from LV100.
//   node claude/econ-oct2/v11-estimate.mjs [hours] [--stretch=N]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const GATES = [15, 25, 40, 60, 75, 100, 125, 150, 175, 200, 225, 260, 300, 340, 380, 420, 465, 510, 560, 600];
const gate = (rc) => (rc < GATES.length ? GATES[rc] : 600 + 50 * (rc - 19));

export const SKILLS = {
  casual: { wpm: 6, len: 5, W: 1.8 },
  median: { wpm: 10, len: 6, W: 2.3 },
  strong: { wpm: 16, len: 7, W: 3.2 },
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
const modeAvg = (lv) => (lv >= 100 ? 0.3 * 2.5 + 0.35 * 4 + 0.35 * 2 : lv >= 50 ? (0.3 * 2.5 + 0.35 * 4) / 0.65 : 2.5);
const streak = (day) => (day >= 30 ? 1.25 : day >= 14 ? 1.2 : day >= 7 ? 1.1 : day >= 3 ? 1.05 : 1);

export const VERSIONS = {
  // V1 — ADDITIVE (the pick): KEY +25% of base XP a tier, rebirth +100% a rebirth (= the wins rebirth
  // multiplier 1 + R), curve ×1.06 a level to LV100, then ×1.015 a level.
  V1: { name: 'ADDITIVE: KEY +25%/tier, rebirth +100%/R; x1.06 to LV100, x1.015 above', base: 600, g1: 1.06, brk: 100, g2: 1.015, key: (t) => 1 + 0.25 * t, rb: (r) => 1 + r },
  // V2 — COMPOUNDING: KEY ×1.25 a tier, rebirth ×1.2 a rebirth, curve ×1.07 to LV100 then ×1.02.
  V2: { name: 'COMPOUNDING: KEY x1.25/tier, rebirth x1.2/R; x1.07 to LV100, x1.02 above', base: 600, g1: 1.07, brk: 100, g2: 1.02, key: (t) => Math.pow(1.25, t), rb: (r) => Math.pow(1.2, r) },
  // V3 — ONE SEGMENT: V1's XP side on a single exponential ×1.03 a level.
  V3: { name: 'ONE SEGMENT: XP side as V1; x1.03 every level', base: 600, g1: 1.03, brk: 9999, g2: 1.03, key: (t) => 1 + 0.25 * t, rb: (r) => 1 + r },
};
export function needOf(v, n) {
  if (n <= v.brk) return v.base * Math.pow(v.g1, n - 1);
  return v.base * Math.pow(v.g1, v.brk - 1) * Math.pow(v.g2, n - v.brk);
}

export function run(v, skillId, hours = 200, opts = {}) {
  const s = SKILLS[skillId];
  const dt = 1 / s.wpm;
  let t = 0;
  let lv = 1;
  let frac = 0;
  let rc = 0;
  const reach = {};
  const MARKS = [50, 100, 150, 225, 300, 400];
  const pctBands = {}; // band (51–100 → "100") → the smallest % of a level one word moved the bar
  const climbs = []; // per climb: { rc (rebirths during it), gate, minutes, to15 = minutes LV1 → LV15 }
  let climbStart = 0;
  let to15 = null;
  while (t < hours * 60) {
    const T = tierAt(skillId, t, opts.stretch || 1);
    const xp = 10 * s.len * modeAvg(lv) * s.W * v.key(T) * v.rb(rc) * streak(Math.floor(t / 60));
    const need = needOf(v, lv);
    let pctW = (xp / need) * 100;
    let gain = xp;
    if (opts.floor && lv <= 250 && pctW < 0.5) {
      gain = 0.005 * need;
      pctW = 0.5;
    }
    const band = Math.min(400, Math.ceil(lv / 50) * 50);
    if (lv <= 400) pctBands[band] = Math.min(pctBands[band] ?? Infinity, pctW);
    frac += gain / need;
    while (frac >= 1) {
      frac = (frac - 1) * (needOf(v, lv) / needOf(v, lv + 1));
      lv += 1;
      for (const m of MARKS) if (lv >= m && reach[m] == null) reach[m] = t;
      if (lv === 15 && to15 == null) to15 = t - climbStart;
    }
    if (lv >= gate(rc)) {
      climbs.push({ rc, gate: gate(rc), minutes: t - climbStart, to15 });
      rc += 1;
      lv = 1;
      frac = 0;
      climbStart = t;
      to15 = null;
    }
    t += dt;
  }
  return { reach, pctBands, rc, lv, climbs };
}

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('v11-estimate.mjs');
if (isMain) {
  const hours = Number(process.argv.find((a) => /^\d+$/.test(a))) || 200;
  const st = process.argv.find((a) => a.startsWith('--stretch='));
  const stretch = st ? Number(st.split('=')[1]) : 1;
  const h = (m) => (m == null ? '—' : m < 1 ? `${(m * 60).toFixed(0)}s` : m < 60 ? `${m.toFixed(0)}m` : `${(m / 60).toFixed(1)}h`);
  console.log(`v11 estimate — ${hours} h per bot, KEY timeline stretch ×${stretch}`);
  for (const [id, v] of Object.entries(VERSIONS)) {
    for (const floor of [false, true]) {
      console.log(`\n${id} ${v.name}${floor ? '  + OPTION F' : ''}\n   need(1)=${v.base} need(100)=${needOf(v, 100).toPrecision(3)} need(225)=${needOf(v, 225).toPrecision(3)} need(400)=${needOf(v, 400).toPrecision(3)}`);
      for (const sk of Object.keys(SKILLS)) {
        const r = run(v, sk, hours, { floor, stretch });
        const bands = Object.entries(r.pctBands).map(([b, p]) => `${b}:${p.toPrecision(2)}`).join(' ');
        const c = r.climbs;
        const climb = (i) => (c[i] ? `${h(c[i].to15)}` : '—');
        console.log(`   ${sk.padEnd(7)} LV50 ${h(r.reach[50])} | LV100 ${h(r.reach[100])} | LV150 ${h(r.reach[150])} | LV225 ${h(r.reach[225])} | LV300 ${h(r.reach[300])} | LV400 ${h(r.reach[400])} | end R${r.rc} LV${r.lv}`);
        console.log(`           min % of a level per word, by band (LV≤N): ${bands}`);
        console.log(`           LV1→15 per climb: first ${climb(0)} · after R1 ${climb(1)} · R3 ${climb(3)} · R6 ${climb(6)} · R10 ${climb(10)}`);
      }
    }
  }
}
