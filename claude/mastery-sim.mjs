// mastery-sim.mjs (Job 2) — words-per-mastery-level pacing + the perk table. Run:
//   node claude/mastery-sim.mjs
import { masteryNeed, masteryWordsToReach, MASTERY_MAX, MASTERY_XP_STEP } from '../src/progress/mastery.js';

console.log('=== MODE MASTERY (M1–M20) — WORDS PER LEVEL + XP PERK ===\n');
console.log('Curve: masteryNeed(n) = round(50 × 1.4^n) words to leave level n.\n');
console.log('Lvl | words to leave | cumulative words | XP perk (this mode)');
console.log('----|----------------|------------------|--------------------');
for (let lvl = 1; lvl <= MASTERY_MAX; lvl++) {
  const leave = lvl < MASTERY_MAX ? masteryNeed(lvl) : 0;
  const cum = masteryWordsToReach(lvl);
  const perk = Math.round(MASTERY_XP_STEP * (lvl - 1) * 100);
  console.log(
    `M${String(lvl).padStart(2)} | ${String(leave).padStart(14)} | ${String(cum).padStart(16)} | +${perk}% XP`
  );
}
const total = masteryWordsToReach(MASTERY_MAX) + masteryNeed(MASTERY_MAX - 1) * 0; // words to REACH M20
console.log(`\nWords to reach M20 (one mode): ${masteryWordsToReach(MASTERY_MAX).toLocaleString()}`);
console.log('Reference milestones:');
for (const L of [5, 10, 15, 20]) console.log(`  M${L}: ${masteryWordsToReach(L).toLocaleString()} words`);
console.log('\nAt ~60 accepted words per session, M10 ≈ ' + Math.ceil(masteryWordsToReach(10) / 60) + ' sessions, M20 ≈ ' + Math.ceil(masteryWordsToReach(20) / 60) + ' sessions per mode.');
console.log('\nPERK: a per-mode XP bonus (NOT more wins — a different axis than payout, addressing');
console.log('"no reason to pick a mode except payout"). It compounds the Job-1 loop: your mastered');
console.log('mode levels you fastest. Safe (no engine/balance/backend change). Mechanical perks');
console.log('(+timer/+life/+reroll) are proposed in the report for later opt-in.');
