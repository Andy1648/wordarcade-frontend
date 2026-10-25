#!/usr/bin/env node
// tier-roll-price-sim.mjs — PRICES the EPIC+ / LEGENDARY+ ROLL tickets (065_buy_tier_rolls.sql) against the gem economy.
// Reads the SHIPPED odds + pity + roll price + gem drop table (markRollsCore.js, gems.js/gemsCore.js), then Monte-Carlos
// plain 10-gem rolls (1/x × luck per non-RARE tier, EPIC+ hard pity on roll 10, LEGENDARY+ hard pity on roll 60) to get
// what an EPIC+ / LEGENDARY+ costs by rolling, steady-state (mid-drought) and fresh. A ticket should cost MORE than
// rolling for it (it skips the lottery, prefers a gear you don't own, and leaves your pity where it was) but stay inside
// a few sessions of play for a median player.
//   node claude/econ-oct2/tier-roll-price-sim.mjs [--n=200000]
import { TIER_ODDS, EPIC_PITY_HARD, LEGENDARY_PITY_HARD, tierRank } from '../../src/progress/markRollsCore.js';
import { GEM_DROP_CHANCE, GEM_DROP_MIN, GEM_DROP_MAX } from '../../src/progress/gemsCore.js';

const ROLL = 10; // gems.js ROLL_PRICE_GEMS
const N = Number((process.argv.find((a) => a.startsWith('--n=')) || '--n=200000').slice(4));
let seed = 12345;
const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);

function rollTier(luck, sinceEpic, sinceLeg) {
  if (sinceLeg + 1 >= LEGENDARY_PITY_HARD) return 'legendary';
  const w = Object.fromEntries(Object.entries(TIER_ODDS).map(([t, x]) => [t, luck / x]));
  const u = rnd();
  let acc = 0;
  for (const t of ['secret', 'mythic', 'legendary', 'epic']) { acc += w[t]; if (u < acc) return t; }
  return sinceEpic + 1 >= EPIC_PITY_HARD ? 'epic' : 'rare';
}
function costTo(goal, luck, steady) {
  let total = 0;
  let se = steady ? Math.floor(rnd() * EPIC_PITY_HARD) : 0;
  let sl = steady ? Math.floor(rnd() * LEGENDARY_PITY_HARD) : 0;
  for (let i = 0; i < N; i += 1) {
    let rolls = 0;
    for (;;) {
      rolls += 1;
      const t = rollTier(luck, se, sl);
      se = tierRank(t) >= tierRank('epic') ? 0 : se + 1;
      sl = tierRank(t) >= tierRank('legendary') ? 0 : sl + 1;
      if (tierRank(t) >= tierRank(goal)) break;
    }
    total += rolls;
    if (!steady) { se = 0; sl = 0; }
  }
  return (total / N) * ROLL;
}

const dropPerWord = GEM_DROP_CHANCE * (GEM_DROP_MIN + GEM_DROP_MAX) / 2;
console.log(`gem drop per game word ${dropPerWord.toFixed(4)} -> median bot (14 wpm x 70% games) ~${(dropPerWord * 14 * 0.7 * 60).toFixed(0)} gems/h from drops alone`);
for (const luck of [1, 2, 6.6]) {
  for (const goal of ['epic', 'legendary']) {
    console.log(`luck x${luck}  ${goal.toUpperCase()}+ by rolling: steady ${costTo(goal, luck, true).toFixed(0)} gems, fresh pity ${costTo(goal, luck, false).toFixed(0)} gems`);
  }
}
