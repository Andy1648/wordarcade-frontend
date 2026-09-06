// _ws-cap-sweep.mjs — sweep a CEILING on wordSenseFactor. Per cap reports:
//   - earliest momentum-max across the 5 archetypes (want: > 100h, ideally NEVER)
//   - mode spread = max avgWinsPerMin / min avgWinsPerMin (want: < 2x)
// Reuses the LIVE economy modules; the ONLY change vs econ200h-audit.mjs is capping 2.5^ws.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { keyTierXp, keyTierCostAt, need, rebirthMult, rebirthThreshold, round10 } from '../src/progress/xp.js';
import { WORD_WINS_BASE, WINS_MULT } from '../src/progress/wins.js';
import { momentumCost, momentumMult, MOMENTUM_MAX } from '../src/progress/momentum.js';
import { wordSenseCost, wordSenseFactor } from '../src/progress/wordSense.js';
import { masteryNeed, MASTERY_MAX, MASTERY_XP_STEP } from '../src/progress/mastery.js';
import { COLLECTION_MILESTONES } from '../src/progress/collection.js';
import { comboMultiplier } from '../src/progress/combo.js';
import { buildRarityIndex, wordRarity } from '../src/progress/rarity.js';
import { streakMultiplier } from '../src/progress/streak.js';
import { mulberry32 } from '../src/solo/shared.js';

const U = (p) => fileURLToPath(new URL(p, import.meta.url));
const recall = readFileSync(U('../src/solo/words.recall.txt'), 'utf8').split(' ');
const idx = buildRarityIndex(recall);
const satDeck = JSON.parse(readFileSync(U('../src/data/satRush/words.json'), 'utf8')).map((x) => x.word);

const PLAY_MIN = 200 * 60;
const REBIRTH_CAP = 10;
const XP_MULT = { 'word-bomb': 2, 'category-blitz': 2, 'sat-rush': 3, chain: 4, fuse: 5 };
const LUCKY_MEAN = (39 / 40) * 1 + (1 / 40) * 5;
const THROUGHPUT = { wordBomb: 8, blitz: 14, satRush: 12, chain: 11.6, fuse: 20 };
const XPID = { wordBomb: 'word-bomb', blitz: 'category-blitz', satRush: 'sat-rush', chain: 'chain', fuse: 'fuse' };

function freqPicker(seed, { minLen = 3 } = {}) {
  const rng = mulberry32(seed);
  const pool = []; const weights = []; let acc = 0;
  for (let i = 0; i < recall.length; i++) {
    const w = recall[i];
    if (w.length < minLen) continue;
    acc += 1 / (i + 50); pool.push(w); weights.push(acc);
  }
  const total = acc;
  return () => {
    const r = rng() * total; let lo = 0, hi = weights.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (weights[mid] < r) lo = mid + 1; else hi = mid; }
    return pool[lo];
  };
}
function satPicker(seed) { const rng = mulberry32(seed); return () => satDeck[Math.floor(rng() * satDeck.length)]; }
function makePicker(archMode, seed) { return archMode === 'satRush' ? satPicker(seed) : freqPicker(seed); }

// CAP applies to the wordSenseFactor (the 2.5^tier term). Infinity == current shipped behaviour.
function simulate(archMode, seed, wsCap) {
  const pick = makePicker(archMode, seed);
  const wordsPerMin = THROUGHPUT[archMode];
  const totalWords = Math.floor(wordsPerMin * PLAY_MIN);
  const modeMultW = WINS_MULT[archMode] || 1;
  const xpModeMult = XP_MULT[XPID[archMode]] || 1;

  let wins = 0, kt = 0, ws = 0, mom = 0;
  let level = 1, into = 0, rc = 0;
  let masteryWords = 0, masteryLevel = 1;
  const distinct = new Set();
  let lifetime = 0;
  let momentumMaxT = null;
  let lastDayMark = 0, streakDay = 0, comboStreak = 0;
  const rng2 = mulberry32(seed ^ 0x9e3779b9);
  const ownedCollMs = new Set();

  for (let i = 0; i < totalWords; i++) {
    const t = i / wordsPerMin;
    if (t - lastDayMark >= 100) { streakDay += 1; lastDayMark = t; }
    const streakMult = streakMultiplier(streakDay);
    const word = pick();
    const rMult = wordRarity(word, idx).mult;
    comboStreak += 1;
    if (rng2() < 1 / 15) comboStreak = 0;
    const weight = Math.min(40, rMult * comboMultiplier(comboStreak) * LUCKY_MEAN);

    const cappedFactor = Math.min(wsCap, wordSenseFactor(ws));
    const wsFactor = 1 + Math.max(0, rMult - 1) * (cappedFactor - 1);
    const perWordWins = round10(WORD_WINS_BASE * modeMultW * rebirthMult(rc) * momentumMult(mom));
    const gainWins = round10(weight * perWordWins * wsFactor);
    wins += gainWins; lifetime += gainWins;

    const masteryXpMult = 1 + MASTERY_XP_STEP * (masteryLevel - 1);
    const gainXp = round10(round10(keyTierXp(kt) * word.length * xpModeMult * rebirthMult(rc) * weight * streakMult) * masteryXpMult);
    into += gainXp;
    while (into >= need(level)) { into -= need(level); level += 1; }

    masteryWords += 1;
    if (masteryLevel < MASTERY_MAX && masteryWords >= masteryNeed(masteryLevel)) {
      masteryWords -= masteryNeed(masteryLevel); masteryLevel += 1;
    }

    const before = distinct.size;
    distinct.add(word);
    if (distinct.size !== before) {
      for (const m of COLLECTION_MILESTONES) {
        if (distinct.size >= m.n && !ownedCollMs.has(m.n)) { ownedCollMs.add(m.n); const g = Math.round(m.wins * rebirthMult(rc)); wins += g; lifetime += g; }
      }
    }

    if (level >= rebirthThreshold(rc) && rc < REBIRTH_CAP) { rc += 1; level = 1; into = 0; }

    let bought = true;
    while (bought) {
      bought = false;
      const nextKey = kt < 25 ? keyTierCostAt(kt + 1) : Infinity;
      const nextWs = ws < 25 ? wordSenseCost(ws) : Infinity;
      const nextMom = mom < MOMENTUM_MAX ? momentumCost(mom) : Infinity;
      const cheapest = Math.min(nextKey, nextWs, nextMom);
      if (!Number.isFinite(cheapest) || wins < cheapest) break;
      if (nextMom === cheapest) { wins -= nextMom; mom += 1; if (mom >= MOMENTUM_MAX && momentumMaxT == null) momentumMaxT = t; bought = true; }
      else if (nextKey === cheapest) { wins -= nextKey; kt += 1; bought = true; }
      else if (nextWs === cheapest) { wins -= nextWs; ws += 1; bought = true; }
    }
  }

  return { momentumMaxH: momentumMaxT == null ? null : momentumMaxT / 60, avgWinsPerMin: lifetime / PLAY_MIN, ws };
}

const ARCHES = [
  { key: 'wordBomb', name: 'WordBomb' }, { key: 'blitz', name: 'Blitz' },
  { key: 'satRush', name: 'SAT' }, { key: 'chain', name: 'Chain' }, { key: 'fuse', name: 'Fuse' },
];

const CAPS = process.argv[2] ? process.argv[2].split(',').map((x) => (x === 'none' ? Infinity : Number(x))) : [Infinity, 40, 25, 15, 10, 8, 6, 5, 4, 3];
console.log('WS-factor cap sweep — earliest momentum-max (across modes) + mode spread (max/min wins/min)\n');
console.log('cap     earliest-mom-max   spread    per-mode wins/min (WB / Blitz / SAT / Chain / Fuse)          WS-reached');
for (const cap of CAPS) {
  const rows = ARCHES.map((a) => simulate(a.key, 0x1234 + a.name.length * 7, cap));
  const avgs = rows.map((r) => r.avgWinsPerMin);
  const spread = Math.max(...avgs) / Math.min(...avgs);
  const momMaxes = rows.map((r) => r.momentumMaxH);
  const finite = momMaxes.filter((m) => m != null);
  const earliestStr = finite.length === 0 ? 'NEVER'
    : `${Math.min(...finite).toFixed(1)}h${momMaxes.some((m) => m == null) ? '*' : ''}`;
  const fmt = (n) => (n >= 1e6 ? n.toExponential(2) : n.toFixed(0));
  const capStr = (cap === Infinity ? 'none' : String(cap)).padEnd(5);
  console.log(
    `${capStr}   ${earliestStr.padStart(10)}     ${spread.toFixed(2).padStart(7)}x   ` +
    `${avgs.map(fmt).map((s) => s.padStart(9)).join(' ')}    WS${rows.map((r) => r.ws).join('/')}`
  );
}
console.log('\n* = at least one mode NEVER maxed momentum in 200h (the healthy target).');
