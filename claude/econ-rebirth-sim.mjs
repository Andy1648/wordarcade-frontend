// econ-rebirth-sim.mjs — WHAT REBIRTH DOES TO THE LEVEL LADDER, before and after.
//
// THE DEFECT. Income scales with rebirth (`rebirthMult(rc) = 3^rc` — R10 is ×59,049) and
// need() does not. So a rebirth does not make the ladder harder in the way it makes you
// richer, and the two curves diverge by a factor that eventually swallows the whole ladder.
// How many levels does a ×59,049 income cancel? log(59049)/log(1.115) ≈ 101 below the
// break and log(59049)/log(1.135) ≈ 87 above it — i.e. R10 pays for roughly the first
// hundred levels outright. The 200-hour archetype run shows it as a flat line:
// LV50 / LV100 / LV200 all land at 2.1h / 2.1h / 2.3h for Word Bomb. A hundred and fifty
// levels in twelve minutes is not a ladder, it is a cutscene.
//
// THE FIX UNDER TEST. Scale need() by `NEED_REBIRTH_BASE^rc`. The base is the whole
// decision, and the two ends are both wrong:
//   base = 1  is today: rebirth cancels the ladder.
//   base = 3  cancels rebirth: cost rises exactly as fast as income, so a rebirth buys
//             nothing at all and there is no reason to press it.
// Anything between is a real choice about how much of the multiplier a player keeps.
// Net speed per level scales (3 / base)^rc, so:
//   base 2.0 -> R10 climbs 57.7x faster than R0
//   base 2.4 -> R10 climbs 9.3x faster
//   base 2.6 -> R10 climbs 4.5x faster
//
// This file measures it rather than asserting it: a FIXED-rebirth climb (no cascade), so
// "time to LV200 at R10" means what it says instead of being an artefact of when the
// prestige loop happened to fire.
//
// Run: node claude/econ-rebirth-sim.mjs [--bases=1,2,2.4,2.6,3] [--hours=200]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { need, keyTierXp, keyTierCostAt, rebirthMult, round10 } from '../src/progress/xp.js';
import { WORD_WINS_BASE, WINS_MULT, winLevelMult } from '../src/progress/wins.js';
import { momentumCost, momentumMult, MOMENTUM_MAX } from '../src/progress/momentum.js';
import { masteryNeed, MASTERY_MAX, MASTERY_XP_STEP } from '../src/progress/mastery.js';
import { comboMultiplier } from '../src/progress/combo.js';
import { buildRarityIndex, wordRarity } from '../src/progress/rarity.js';
import { mulberry32 } from '../src/solo/shared.js';

const U = (p) => fileURLToPath(new URL(p, import.meta.url));
const recall = readFileSync(U('../src/solo/words.recall.txt'), 'utf8').split(' ');
const idx = buildRarityIndex(recall);

const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.slice(k.length + 3) : d;
};
const BASES = String(arg('bases', '1,2,2.4,2.6,3')).split(',').map(Number);
const HOURS = Number(arg('hours', '200'));
const PLAY_MIN = HOURS * 60;

// One representative mode. Word Bomb is the game's front door and sits mid-pack on the
// wins spread, so it is the least flattering choice and therefore the right one.
const MODE = 'wordBomb';
const WORDS_PER_MIN = 9;
const XP_MODE_MULT = 1;
const LUCKY_MEAN = 1.05;
const MILESTONES = [50, 100, 200, 300];

// A frequency-weighted picker over the recall list: common words are common.
function picker(seed) {
  const rng = mulberry32(seed);
  return () => recall[Math.min(recall.length - 1, Math.floor((rng() ** 2.2) * recall.length))];
}

// Climb from LV1 with rebirth count FIXED at rc. Greedy upgrade buying (key power and
// momentum, the two that actually move income), same as the 200h archetype run.
function climb(rc, needBase, seed = 12345) {
  const pick = picker(seed);
  const rng2 = mulberry32(seed ^ 0x9e3779b9);
  const scale = Math.pow(needBase, rc);
  const needOf = (n) => round10(need(n) * scale);

  let wins = 0, kt = 0, mom = 0;
  let level = 1, into = 0;
  let masteryWords = 0, masteryLevel = 1;
  let combo = 0;
  const marks = Object.fromEntries(MILESTONES.map((m) => [m, null]));
  const total = Math.floor(WORDS_PER_MIN * PLAY_MIN);

  for (let i = 0; i < total; i++) {
    const t = i / WORDS_PER_MIN; // minutes elapsed
    const word = pick();
    const rr = wordRarity(word, idx);
    combo += 1;
    if (rng2() < 1 / 15) combo = 0;
    const weight = Math.min(40, rr.mult * comboMultiplier(combo) * LUCKY_MEAN);

    wins += round10(weight * round10(
      WORD_WINS_BASE * (WINS_MULT[MODE] || 1) * rebirthMult(rc) * momentumMult(mom) * winLevelMult(level),
    ));

    const masteryMult = 1 + MASTERY_XP_STEP * (masteryLevel - 1);
    into += round10(
      round10(keyTierXp(kt) * word.length * XP_MODE_MULT * rebirthMult(rc) * weight) * masteryMult,
    );
    while (into >= needOf(level)) {
      into -= needOf(level);
      level += 1;
      for (const m of MILESTONES) if (marks[m] == null && level >= m) marks[m] = t;
    }

    masteryWords += 1;
    if (masteryLevel < MASTERY_MAX && masteryWords >= masteryNeed(masteryLevel)) {
      masteryWords -= masteryNeed(masteryLevel);
      masteryLevel += 1;
    }

    // greedy: buy the cheapest thing that raises income, whenever affordable
    for (;;) {
      const nextKey = kt < 25 ? keyTierCostAt(kt + 1) : Infinity;
      const nextMom = mom < MOMENTUM_MAX ? momentumCost(mom) : Infinity;
      const cheapest = Math.min(nextKey, nextMom);
      if (!Number.isFinite(cheapest) || wins < cheapest) break;
      if (nextMom === cheapest) { wins -= nextMom; mom += 1; } else { wins -= nextKey; kt += 1; }
    }
  }
  return { level, marks, kt, mom };
}

const hrs = (min) => (min == null ? '  never' : `${(min / 60).toFixed(1)}h`.padStart(7));
const RCS = [0, 3, 10];

console.log(`\n=== need() SCALED BY REBIRTH — ${HOURS}h fixed-rebirth climbs, ${MODE} ===`);
console.log('Income scales 3^rc. need() scales base^rc. Net climb speed scales (3/base)^rc.\n');
console.log('  base   rc   mult        LV50     LV100    LV200    LV300    final LV');
console.log('  ' + '-'.repeat(74));
const table = {};
for (const base of BASES) {
  for (const rc of RCS) {
    const r = climb(rc, base);
    table[`${base}|${rc}`] = r;
    const net = Math.pow(3 / base, rc);
    console.log(
      `  ${String(base).padEnd(5)} R${String(rc).padEnd(3)} x${net < 1000 ? net.toFixed(1).padEnd(10) : net.toExponential(2).padEnd(10)}`
      + `${hrs(r.marks[50])} ${hrs(r.marks[100])} ${hrs(r.marks[200])} ${hrs(r.marks[300])}   ${String(r.level).padStart(4)}`,
    );
  }
  console.log('  ' + '-'.repeat(74));
}

// The number that says whether the ladder still exists: how long LV50 -> LV200 takes.
// Today it is twelve minutes at R10, and a hundred and fifty levels in twelve minutes is
// the whole complaint in one figure.
console.log('\n=== THE STRETCH THAT VANISHED: LV50 -> LV200 ===');
console.log('  base    R0        R3        R10');
for (const base of BASES) {
  const span = (rc) => {
    const r = table[`${base}|${rc}`];
    if (!r || r.marks[200] == null || r.marks[50] == null) return '   never';
    return `${((r.marks[200] - r.marks[50]) / 60).toFixed(1)}h`.padStart(8);
  };
  console.log(`  ${String(base).padEnd(6)}${span(0)}  ${span(3)}  ${span(10)}`);
}
console.log('');
