// archetype200h-sim.mjs — JOB B part 2: simulate archetype players over 200 hours of PLAY time,
// spending wins on the Key Power tier ladder (the deep wins sink), and report the LONGEST DEAD
// STRETCH — the longest continuous span with no reward event (no Key-tier purchase) — for
// TIER_COST_STEP = 6 (current) vs 5 (proposed). Only tiers past T8 use the step, so the change
// only moves the deep-endgame grind. Run: node claude/archetype200h-sim.mjs
//
// Earn rates (wins/min) come from claude/winsmin-sim.mjs (rarity-weighted, R0, ×1 difficulty).
// Faithful to the shipped Key ladder: the KEY_TIERS table (T0–T8) is the published price; past T8
// the price extends ×STEP per tier from T8, round10 — replicated here parameterized on STEP so both
// values run in one pass (the live keyTierCostAt reads the module constant, which we also change).
import { KEY_TIERS } from '../src/progress/xp.js';

const round10 = (n) => { const d = n / 10; const r = Math.round(d); const isHalf = Math.abs(d - Math.trunc(d) - 0.5) < 1e-9; return (isHalf ? (Math.trunc(d) % 2 === 0 ? Math.trunc(d) : Math.trunc(d) + 1) : r) * 10; };
// Price to BUY tier t (t>=1), parameterized on the past-T8 cost step.
function tierPrice(t, step) {
  if (t < KEY_TIERS.length) return KEY_TIERS[t].cost;
  let cost = KEY_TIERS[KEY_TIERS.length - 1].cost;
  for (let i = KEY_TIERS.length; i <= t; i++) cost = round10(cost * step);
  return cost;
}

// Archetypes: each mains one mode; wins/min from winsmin-sim. PLAY_MIN = 200h of actual play.
const PLAY_MIN = 200 * 60;
// Earn rates are the POST-REBALANCE wins/min (sim/rebalance-2 WINS_MULT flatten) from
// claude/winsmin-sim.mjs: the 37.7× spread is now 1.43×, so the archetypes earn within a narrow band.
const ARCHETYPES = [
  { name: 'Word Bomb main', wpm: 393 },
  { name: 'Blitz main', wpm: 344 },
  { name: 'SAT Rush main', wpm: 422 },
  { name: 'Chain main', wpm: 457 },
  { name: 'Fuse grinder', wpm: 493 },
];
const MAX_TIER = 20; // plenty; nobody reaches this in 200h, loop breaks when unaffordable in time

// For an archetype, walk time buying each next tier as soon as affordable. A tier purchase is the
// only "reward event" modeled here (the deep sink). Dead stretch = max minutes between purchases
// (and from the last purchase to the 200h mark, if still grinding toward the next tier).
function simulate(wpm, step) {
  let minutes = 0, tier = 0, lastRewardAt = 0, longestGap = 0, gapTier = 0;
  const buys = [];
  while (tier < MAX_TIER) {
    const price = tierPrice(tier + 1, step);
    const minsToAfford = price / wpm; // continuous earn; wins spent fully on the next tier
    const buyAt = minutes + minsToAfford;
    if (buyAt > PLAY_MIN) {
      // Grinding toward tier+1 but never reaches it within 200h: the tail is a dead stretch.
      const tailGap = PLAY_MIN - lastRewardAt;
      if (tailGap > longestGap) { longestGap = tailGap; gapTier = tier + 1; }
      break;
    }
    const gap = buyAt - lastRewardAt;
    if (gap > longestGap) { longestGap = gap; gapTier = tier + 1; }
    tier += 1; minutes = buyAt; lastRewardAt = buyAt; buys.push(tier);
  }
  return { finalTier: tier, buys: buys.length, longestGap, gapTier };
}

for (const step of [6, 5]) {
  console.log(`\n===== TIER_COST_STEP = ${step} =====`);
  console.log('  archetype          reaches   #buys   longest dead stretch (grind w/ no new tier)');
  let worst = { longestGap: 0 };
  for (const a of ARCHETYPES) {
    const r = simulate(a.wpm, step);
    const h = (r.longestGap / 60).toFixed(1);
    console.log(`  ${a.name.padEnd(16)}   T${String(r.finalTier).padEnd(3)}    ${String(r.buys).padStart(3)}    ${h.padStart(6)}h  (grinding toward T${r.gapTier})`);
    if (r.longestGap > worst.longestGap) worst = { ...r, name: a.name };
  }
  console.log(`  → LONGEST DEAD STRETCH across archetypes: ${(worst.longestGap / 60).toFixed(1)}h  (${worst.name}, toward T${worst.gapTier})`);
}
console.log('\n(Note: earn rates are the POST-REBALANCE mults AND KEY_TIERS costs are the ×0.18-scaled');
console.log(' table — both changes are live on this branch, so this is the shipped pacing, not a forecast.)');
