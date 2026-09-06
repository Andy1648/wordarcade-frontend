// momentum-sim.mjs — feat/repeatable-sink verification. Simulates each archetype over 200 h of play
// with BOTH sinks live: the KEY POWER tier ladder AND the new MOMENTUM repeatable sink. Player earns
// continuously (earn rate boosted by momentum's stacking +1%/buy), and buys the CHEAPEST affordable
// next purchase across both tracks. Reports the longest dead stretch (span with no purchase) per
// archetype and asserts every one is under 15 h. Run: node claude/momentum-sim.mjs
import { keyTierCostAt } from '../src/progress/xp.js';
import { momentumCost, momentumMult, MOMENTUM_MAX } from '../src/progress/momentum.js';

const PLAY_MIN = 200 * 60;
const MAX_KEY = 25;
// Post-rebalance earn rates (claude/winsmin-sim.mjs), the shipped main economy.
const ARCHETYPES = [
  { name: 'Word Bomb main', wpm: 393 },
  { name: 'Blitz main', wpm: 344 },
  { name: 'SAT Rush main', wpm: 422 },
  { name: 'Chain main', wpm: 457 },
  { name: 'Fuse grinder', wpm: 493 },
];

function simulate(baseWpm) {
  let wins = 0, t = 0, key = 0, mom = 0, last = 0, longest = 0, buys = 0;
  let what = '';
  while (t < PLAY_MIN) {
    const rate = baseWpm * momentumMult(mom); // momentum compounds the earn rate
    const nk = key < MAX_KEY ? keyTierCostAt(key + 1) : Infinity;
    const nm = mom < MOMENTUM_MAX ? momentumCost(mom) : Infinity;
    const cheapest = Math.min(nk, nm);
    if (!Number.isFinite(cheapest)) { longest = Math.max(longest, PLAY_MIN - last); break; }
    const need = Math.max(0, cheapest - wins);
    const dt = need / rate;
    if (t + dt > PLAY_MIN) { longest = Math.max(longest, PLAY_MIN - last); break; }
    t += dt; wins += rate * dt;
    const gap = t - last; if (gap > longest) { longest = gap; what = nm <= nk ? 'momentum' : `key T${key + 1}`; }
    last = t; buys += 1;
    if (nm <= nk) { wins -= nm; mom += 1; } else { wins -= nk; key += 1; }
  }
  return { longest: longest / 60, key, mom, buys, what };
}

console.log('=== MOMENTUM dead-stretch verification (200 h, both sinks live) ===\n');
console.log('  archetype          longest dead stretch   ends at   #buys   (worst gap was toward)');
let worst = 0, worstName = '';
for (const a of ARCHETYPES) {
  const r = simulate(a.wpm);
  if (r.longest > worst) { worst = r.longest; worstName = a.name; }
  console.log(`  ${a.name.padEnd(16)}   ${r.longest.toFixed(2).padStart(6)} h            key T${r.key}/mom ${r.mom}   ${String(r.buys).padStart(4)}    ${r.what}`);
}
console.log(`\n  → WORST dead stretch: ${worst.toFixed(2)} h (${worstName})   ${worst < 15 ? '✓ under 15 h for every archetype' : '✗ OVER 15 h'}`);
console.log(`  (Baseline before the sink was 161.6 h — see claude/dead-stretch-report.md.)`);
