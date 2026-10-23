// cadence.mjs — MODE MASTERY ROADS: how fast each player type climbs each mode's mastery track, and where the
// road's reward nodes should sit so one lands every ~10–20 min of play in that mode early, slowing gently.
// Run: node claude/mastery-road/cadence.mjs        (pure: reads src/progress/mastery.js, writes nothing)
import { pathToFileURL } from 'node:url';
import { masteryWordsToReach, masteryFromWords } from '../../src/progress/mastery.js';

// Accepted words per minute spent IN the mode (lobbies, countdowns, round breaks included). From the econ bots
// (final-sim: casual 8 · median 14 · fast 26 game words/min × 60/70/75 % of the session in a game), scaled per mode:
// CHAIN / FUSE are solo free-typing; BLITZ thinks per category + round breaks; WORD BOMB / SAT RUSH are one word a turn.
export const RATE = {
  chain:            { casual: 4.8, median: 9.8, grinder: 19.5 },
  fuse:             { casual: 4.8, median: 9.8, grinder: 19.5 },
  'category-blitz': { casual: 3.4, median: 6.9, grinder: 13.7 },
  'word-bomb':      { casual: 2.5, median: 3.5, grinder: 5.0 },
  'sat-rush':       { casual: 2.5, median: 3.5, grinder: 5.0 },
};
export const DAILY_MIN = { casual: 15, median: 30, grinder: 90 }; // all of it in ONE mode (the per-mode upper bound)

// Node k (0-based) lands GAP0 × GROWTH^k minutes of MEDIAN play after node k-1, snapped to a whole mastery level.
const GAP0 = 12;
const GROWTH = 1.2;
const NODES = 12;

function ladder(mode) {
  const r = RATE[mode].median;
  const out = [];
  let t = 0;
  let prev = 1;
  for (let k = 0; k < NODES; k++) {
    t += GAP0 * GROWTH ** k;
    const words = t * r;
    let lv = masteryFromWords(words).level;
    // snap to the NEARER level boundary
    const lo = masteryWordsToReach(lv), hi = masteryWordsToReach(lv + 1);
    if (hi - words < words - lo) lv += 1;
    lv = Math.max(lv, prev + 1);
    out.push(lv);
    prev = lv;
  }
  return out;
}

export const MAIN = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
const fmt = (m) => (m < 60 ? `${Math.round(m)}m` : `${(m / 60).toFixed(1)}h`);
const ladders = {};
for (const mode of MAIN ? Object.keys(RATE) : []) {
  const L = ladder(mode);
  ladders[mode] = L;
  console.log(`\n=== ${mode.toUpperCase()}  nodes at M${L.join(' · M')}`);
  for (const p of ['casual', 'median', 'grinder']) {
    const r = RATE[mode][p];
    let last = 0;
    const gaps = L.map((lv) => { const m = masteryWordsToReach(lv) / r; const g = m - last; last = m; return g; });
    const wk = masteryFromWords(r * DAILY_MIN[p] * 7).level;
    const nodesWk = L.filter((lv) => lv <= wk).length;
    console.log(`  ${p.padEnd(7)} ${String(r).padStart(4)} w/min · week 1 (${DAILY_MIN[p]}m/day) → M${wk}, ${nodesWk}/${L.length} nodes · gaps ${gaps.map(fmt).join(' ')} · all 12 in ${fmt(last)}`);
  }
}
if (MAIN) console.log('\nLADDERS', JSON.stringify(ladders));
