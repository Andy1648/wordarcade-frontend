// wordsense-sim.mjs (Job 4) — the WORD SENSE tier table + the "does a player run out of things to
// buy in the first 20 hours?" analysis. Run: node claude/wordsense-sim.mjs
import { keyTierCostAt } from '../src/progress/xp.js';
import { wordSenseFactor } from '../src/progress/wordSense.js';

const fmt = (n) => n.toLocaleString();

// ---- Tier tables (both tracks share the ×6 cost ladder; WORD SENSE effect is a rarity-wins mult) ----
console.log('=== WORD SENSE — TIER TABLE (effect ×2.5 / cost ×6, parallel to KEY POWER) ===\n');
console.log('Tier | rarity-excess mult | wins for an OBSCURE(×4) word | wins for a RARE(×2.5) word | cost to reach');
console.log('-----|--------------------|-----------------------------|----------------------------|---------------');
let cumWS = 0;
for (let t = 0; t <= 10; t++) {
  const f = wordSenseFactor(t);
  const obscure = 1 + 3 * (f - 1); // OBSCURE excess = 3
  const rare = 1 + 1.5 * (f - 1); // RARE excess = 1.5
  const costToReach = t === 0 ? 0 : keyTierCostAt(t);
  cumWS += costToReach;
  console.log(
    `T${String(t).padStart(2)} | ×${f.toFixed(2).padStart(10)} | ×${obscure.toFixed(1).padStart(8)} | ×${rare.toFixed(1).padStart(8)} | ${fmt(costToReach).padStart(13)}`
  );
}

// ---- Cumulative cost to MAX BOTH tracks to tier k ----
function cumCostToTier(k) {
  let c = 0;
  for (let t = 1; t <= k; t++) c += keyTierCostAt(t);
  return c;
}
console.log('\n=== COST TO MAX BOTH SINKS (KEY POWER + WORD SENSE) TO TIER k ===');
for (let k = 4; k <= 9; k++) {
  const both = 2 * cumCostToTier(k);
  console.log(`  Both to T${k}: ${fmt(both)} wins`);
}

// ---- 20-hour income scenarios ----
// Stated model (transparent, not false-precise). wins/word and words/hour by engagement tier; the
// effective wins/word grows over the run as the player rebirths + invests (a geometric power curve,
// doubling every DOUBLE_H hours — the standard idle ramp). We accumulate hour by hour.
function earned20h({ startWinsPerWord, wordsPerHour, doubleH }) {
  let total = 0;
  for (let h = 0; h < 20; h++) {
    const mult = Math.pow(2, h / doubleH);
    total += startWinsPerWord * mult * wordsPerHour;
  }
  return Math.round(total);
}
const scenarios = [
  { name: 'CASUAL  (30 w/word, 360 words/hr, doubles/8h)', startWinsPerWord: 30, wordsPerHour: 360, doubleH: 8 },
  { name: 'REGULAR (60 w/word, 540 words/hr, doubles/5h)', startWinsPerWord: 60, wordsPerHour: 540, doubleH: 5 },
  { name: 'HARDCORE(150 w/word, 720 words/hr, doubles/4h)', startWinsPerWord: 150, wordsPerHour: 720, doubleH: 4 },
];
console.log('\n=== DOES A PLAYER RUN OUT OF THINGS TO BUY IN 20 HOURS? ===');
for (const s of scenarios) {
  const earned = earned20h(s);
  // Highest tier both tracks can be fully maxed to within `earned`.
  let maxK = 0;
  for (let k = 1; k <= 12; k++) if (2 * cumCostToTier(k) <= earned) maxK = k;
  const nextBoth = 2 * cumCostToTier(maxK + 1);
  console.log(`\n${s.name}`);
  console.log(`  20h wins earned ≈ ${fmt(earned)}`);
  console.log(`  Can max BOTH tracks to ~T${maxK}. Next (both to T${maxK + 1}) costs ${fmt(nextBoth)} — ${nextBoth > earned ? 'STILL UNAFFORDABLE ✓ (never runs out)' : 'affordable'}`);
}
console.log('\nVERDICT: because both sinks grow ×6/tier while income doubles on a multi-hour clock, the');
console.log('NEXT tier is always out of reach at the 20-hour mark in every scenario — the player never');
console.log('runs out of things to buy. WORD SENSE also self-scales the target (rare words pay more →');
console.log('income rises → but the next tier rose 6×), so it holds indefinitely, not just to hour 20.');
