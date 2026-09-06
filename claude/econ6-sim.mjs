// Economy v6 simulation — imports the REAL model so the numbers match shipped behaviour.
// Run: node claude/econ6-sim.mjs
import { need, keyTierCostAt, keyTierXp, rebirthMult } from '../src/progress/xp.js';
import { awardWins, perWordWins, TYPICAL_ROUND_WORDS } from '../src/progress/wins.js';

const fmt = (n) => n.toLocaleString('en-US');

// ---- 1. Letters to first rebirth (LV15) ----
// At the starting rate: Key Power T0 (10 XP/letter), R0 (×1), menu mode (×1) = 10 XP/letter.
let cumToLv15 = 0;
for (let n = 1; n < 15; n++) cumToLv15 += need(n); // cost to REACH LV15 = sum need(1..14)
const startRate = keyTierXp(0); // 10 XP/letter at T0, menu R0
const lettersToRebirth = Math.ceil(cumToLv15 / startRate);

console.log('=== 1. LETTERS TO FIRST REBIRTH (LV15) ===');
console.log(`Cumulative XP to reach LV15 (sum need(1..14)): ${fmt(cumToLv15)}`);
console.log(`Starting menu rate (T0, R0): ${startRate} XP/letter`);
console.log(`→ Letters needed at the starting rate: ${fmt(lettersToRebirth)}`);
console.log(`  (buying Key Power tiers along the way cuts this — this is the floor at base rate)`);
console.log('  Per-level need() to LV15:', Array.from({ length: 14 }, (_, i) => need(i + 1)).join(', '));

// ---- 2. FUSE runs needed for each KEY POWER tier at R0, R5, R10 ----
// A "FUSE run" = a typical round of TYPICAL_ROUND_WORDS (10) accepted words.
// Wins/run = awardWins(10, fuse, rebirth). Runs to afford tier T = ceil(cost(T) / wins-per-run).
console.log('\n=== 2. FUSE RUNS TO AFFORD EACH KEY POWER TIER ===');
console.log(`(1 FUSE run = ${TYPICAL_ROUND_WORDS} accepted words; FUSE = 20 base × 15 mode × rebirth)`);
for (const R of [0, 5, 10]) {
  const perWord = perWordWins({ mode: 'fuse', rebirthCount: R });
  const perRun = awardWins({ wordsAccepted: TYPICAL_ROUND_WORDS, mode: 'fuse', rebirthCount: R });
  console.log(`\n-- R${R} (rebirth ×${rebirthMult(R)}): ${fmt(perWord)} wins/word, ${fmt(perRun)} wins/run --`);
  for (let t = 1; t <= 8; t++) {
    const cost = keyTierCostAt(t);
    const runs = Math.ceil(cost / perRun);
    console.log(`  T${t}  cost ${fmt(cost).padStart(13)}  →  ${fmt(runs).padStart(12)} FUSE runs`);
  }
}
