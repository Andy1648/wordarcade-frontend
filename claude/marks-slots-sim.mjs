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

// ---------------------------------------------------------------- POWER CREEP, R0 vs R10
// THE QUESTION A SLOT COUNT ACTUALLY RAISES. The spread block above answers "do slots make
// mode choice matter more" (they do not — slots NARROW the spread, because the mode-specific
// marks exist only for the weaker modes). It does not answer "how much stronger does a player
// get", which is the power-creep question, and it is the one that decides whether a second
// slot is affordable.
//
// It is also the question where the interesting answer is a NEGATIVE: marks are multipliers on
// the same per-word base that rebirthMult multiplies, so a slot's percentage gain is IDENTICAL
// at R0 and R10 — slots and rebirth do not interact at all. That is worth printing rather than
// reasoning about, because the two chance-based marks (LINGUIST's rarity bump, METRONOME's
// combo save) are state-dependent and a reader cannot assume they factor out. They do; this
// measures it instead of claiming it.
//
// Read it as: "a 2nd slot makes every player +X% richer, at every rebirth count." At R10 that
// same +X% is +X% of a x59,049 number.
console.log('=== POWER CREEP — WHAT A SLOT IS WORTH, AT R0 AND AT R10 ===');
console.log('Gain over ONE slot (the shipped rule), per mode. Identical state, greedy build.\n');
console.log('  mode        2 slots vs 1        3 slots vs 1');
console.log('              R0       R10        R0       R10');
console.log('  ' + '-'.repeat(52));
const S0 = { rc: 0, level: 1, mom: 0 };
const S10 = { rc: 10, level: 200, mom: 200 };
const pct = (a, b) => `${((a / b - 1) * 100).toFixed(1)}%`.padStart(7);
const creep = { 2: [], 3: [] };
for (const m of MODES) {
  const one0 = bestBuild(m, 1, S0).wpm;
  const one10 = bestBuild(m, 1, S10).wpm;
  const cells = [];
  for (const slots of [2, 3]) {
    const v0 = bestBuild(m, slots, S0).wpm;
    const v10 = bestBuild(m, slots, S10).wpm;
    cells.push(pct(v0, one0), pct(v10, one10));
    // Keep the two rebirth states PAIRED per mode. Flattening them into one list makes the
    // min/max below report the CROSS-MODE spread (SAT Rush gains most, chain least) while
    // labelling it "R0 vs R10" — a real number under a false name, which is worse than no
    // number. The divergence being asked about is within a mode, across rebirth.
    creep[slots].push({ mode: m, r0: v0 / one0, r10: v10 / one10 });
  }
  console.log(`  ${m.padEnd(10)}${cells[0]}  ${cells[1]}   ${cells[2]}  ${cells[3]}`);
}
console.log('  ' + '-'.repeat(52));
for (const slots of [2, 3]) {
  const all = creep[slots].flatMap((c) => [c.r0, c.r10]);
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  // If a slot is worth MORE to a rebirthed player, this is where it shows: the gap between
  // the SAME mode's R0 and R10 gain. ~0pp is the claim "slots do not interact with rebirth",
  // stated as a measurement rather than argued from the algebra. (The residual hundredths are
  // Monte-Carlo noise from the two chance marks, not an interaction — raise WORDS and it shrinks.)
  const worst = creep[slots].reduce((a, c) => (Math.abs(c.r10 - c.r0) > Math.abs(a.r10 - a.r0) ? c : a));
  console.log(
    `  ${slots} slots: +${((lo - 1) * 100).toFixed(1)}%..+${((hi - 1) * 100).toFixed(1)}% over one slot (that spread is ACROSS MODES); `
    + `max R0-vs-R10 gap ${(Math.abs(worst.r10 - worst.r0) * 100).toFixed(2)}pp (${worst.mode})`,
  );
}
console.log('');
