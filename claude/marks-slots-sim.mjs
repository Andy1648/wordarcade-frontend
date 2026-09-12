// marks-slots-sim.mjs — WHAT A SECOND AND THIRD MARK SLOT DO TO THE MODE SPREAD.
//
// Marks ship with ONE slot, and marks.js states why in rule 1: "a mark is a decision, not a
// collection of passive bonuses". The question this file answers is what it costs to relax
// that — because the economy has a hard invariant next to it, the one econ-curve-sim asserts:
// no mode may pay more than 2.00x what the worst mode pays under an identical player state.
// Mode choice must not be a grind decision.
//
// TWO OF THE EIGHT MARKS CANNOT BE MULTIPLIED OUT, which is why this is a simulation and not
// arithmetic: LINGUIST is a 12% chance to bump a word one RARITY TIER (worth a lot on a word
// that is already UNCOMMON, nothing on one that is already the top rung) and METRONOME is a
// 30% chance a broken COMBO survives (worth more the longer your combos already are). Both are
// state-dependent, and both are what a third slot would actually hold in the modes with no
// mode-specific mark of their own.
//
// Run: node claude/marks-slots-sim.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { rebirthMult, round10 } from '../src/progress/xp.js';
import { WORD_WINS_BASE, WINS_MULT, winLevelMult } from '../src/progress/wins.js';
import { momentumMult } from '../src/progress/momentum.js';
import { comboMultiplier } from '../src/progress/combo.js';
import { buildRarityIndex, wordRarity } from '../src/progress/rarity.js';
import { MARKS } from '../src/progress/marks.js';
import { mulberry32 } from '../src/solo/shared.js';

const U = (p) => fileURLToPath(new URL(p, import.meta.url));
const recall = readFileSync(U('../src/solo/words.recall.txt'), 'utf8').split(' ');
const idx = buildRarityIndex(recall);
// SAT RUSH DRAWS FROM ITS OWN DECK, NOT THE RECALL LIST, and the first cut of this file did
// not: it fed SAT Rush frequency-weighted common words and reported it at a THIRD of the
// wins/min the canonical sim gives it, which turned a 1.58x spread into a fake 3.67x. Any
// mode-spread claim is only as good as its word source.
const satDeck = JSON.parse(readFileSync(U('../src/data/satRush/words.json'), 'utf8')).map((x) => x.word);

const MODES = ['wordBomb', 'blitz', 'satRush', 'chain', 'fuse'];
const THROUGHPUT = { wordBomb: 8, blitz: 14, satRush: 12, chain: 11.6, fuse: 20 };
const LUCKY_MEAN = (39 / 40) * 1 + (1 / 40) * 5;
const WORDS = 120000; // enough that the two chance effects converge

// The rarity ladder's multipliers, in order, so a "one tier higher" bump is a real step
// rather than a guessed factor. Derived from the live index, not tabled here.
const RARITY_LADDER = (() => {
  const seen = new Map();
  for (const w of recall.slice(0, 40000)) {
    const r = wordRarity(w, idx);
    if (!seen.has(r.band)) seen.set(r.band, r.mult);
  }
  return [...seen.values()].sort((a, b) => a - b);
})();
const stepUp = (m) => {
  for (const v of RARITY_LADDER) if (v > m + 1e-9) return v;
  return m; // already the top rung — the bump is worth nothing, which is the point
};

function picker(seed, mode) {
  const rng = mulberry32(seed);
  if (mode === 'satRush') return () => satDeck[Math.floor(rng() * satDeck.length)];
  return () => recall[Math.min(recall.length - 1, Math.floor((rng() ** 2.2) * recall.length))];
}

// wins/min for one mode under one BUILD (a list of mark ids), at a fixed player state.
function winsPerMin(mode, build, { rc, level, mom }, seed = 4242) {
  const pick = picker(seed, mode);
  const rng = mulberry32(seed ^ 0x5bf03635);
  const effects = build.map((id) => MARKS.find((m) => m.id === id)).filter(Boolean).map((m) => m.effect);

  let flat = 1;
  let rarityStep = 0;
  let comboKeep = 0;
  for (const e of effects) {
    if (e.winsMult && (!e.mode || e.mode === mode)) flat *= e.winsMult;
    if (e.rarityStep) rarityStep = 1 - (1 - rarityStep) * (1 - e.rarityStep);
    if (e.comboKeep) comboKeep = 1 - (1 - comboKeep) * (1 - e.comboKeep);
  }

  let total = 0;
  let combo = 0;
  for (let i = 0; i < WORDS; i++) {
    const r = wordRarity(pick(), idx);
    let rm = r.mult;
    if (rarityStep > 0 && rng() < rarityStep) rm = stepUp(rm);
    combo += 1;
    if (rng() < 1 / 15) { if (!(comboKeep > 0 && rng() < comboKeep)) combo = 0; }
    const weight = Math.min(40, rm * comboMultiplier(combo) * LUCKY_MEAN);
    total += round10(weight * round10(
      WORD_WINS_BASE * (WINS_MULT[mode] || 1) * rebirthMult(rc) * momentumMult(mom) * winLevelMult(level),
    ) * flat);
  }
  return (total / WORDS) * THROUGHPUT[mode];
}

// The best build of `slots` marks for a mode, chosen greedily — which is what a player does.
function bestBuild(mode, slots, state) {
  const ids = MARKS.map((m) => m.id);
  let build = [];
  let best = winsPerMin(mode, build, state);
  for (let s = 0; s < slots; s++) {
    let pickId = null;
    let pickVal = best;
    for (const id of ids) {
      if (build.includes(id)) continue;
      const v = winsPerMin(mode, [...build, id], state);
      if (v > pickVal + 1e-9) { pickVal = v; pickId = id; }
    }
    if (!pickId) break;
    build = [...build, pickId];
    best = pickVal;
  }
  return { build, wpm: best };
}

const name = (id) => (MARKS.find((m) => m.id === id) || {}).name || id;
const fmt = (x) => (Math.abs(x) >= 1e7 ? x.toExponential(3) : Math.round(x).toLocaleString('en-US'));

console.log('\n=== MARK SLOTS vs THE 2.00x MODE-SPREAD INVARIANT ===');
console.log('Greedy best build per mode, identical player state, wins/min.\n');

for (const [label, state] of [
  ['R0  LV1   mom0', { rc: 0, level: 1, mom: 0 }],
  ['R10 LV200 mom200', { rc: 10, level: 200, mom: 200 }],
]) {
  console.log(`--- ${label} ---`);
  // The baseline is the same state with NO mark equipped: the spread the economy already
  // has. What matters is whether SLOTS widen it, and stating it as a delta is robust to any
  // difference between this model and econ-curve-sim's.
  const bare = MODES.map((m) => winsPerMin(m, [], state));
  const bareSpread = Math.max(...bare) / Math.min(...bare);
  console.log(`  0 SLOTS   spread ${bareSpread.toFixed(2)}x   (the economy as it stands)`);
  for (const slots of [1, 2, 3]) {
    const rows = MODES.map((m) => ({ m, ...bestBuild(m, slots, state) }));
    const vals = rows.map((r) => r.wpm);
    const spread = Math.max(...vals) / Math.min(...vals);
    const delta = spread / bareSpread;
    console.log(`  ${slots} SLOT${slots > 1 ? 'S' : ' '}   spread ${spread.toFixed(2)}x  (${delta >= 1 ? '+' : ''}${((delta - 1) * 100).toFixed(0)}% vs bare)  ${spread <= 2 ? 'OK' : 'OVER'}`);
    for (const r of rows) {
      console.log(`     ${r.m.padEnd(9)} ${fmt(r.wpm).padStart(12)}   ${r.build.map(name).join(' + ') || '(none)'}`);
    }
  }
  console.log('');
}

// Which marks a player would NEVER wear. With one slot this is the interesting column: a mark
// that is dominated at every slot count is a mark nobody sees.
console.log('=== MARKS NEVER CHOSEN BY ANY MODE ===');
for (const slots of [1, 2, 3]) {
  const worn = new Set();
  for (const state of [{ rc: 0, level: 1, mom: 0 }, { rc: 10, level: 200, mom: 200 }]) {
    for (const m of MODES) for (const id of bestBuild(m, slots, state).build) worn.add(id);
  }
  const idle = MARKS.filter((m) => !worn.has(m.id)).map((m) => m.name);
  console.log(`  ${slots} slot(s): ${idle.length ? idle.join(', ') : '(all eight are worn by someone)'}`);
}
console.log('');
