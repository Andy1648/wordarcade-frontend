// econ200h-audit.mjs — 200-hour full-economy simulation for claude/audit-economy.md.
// Models EVERY progression reward channel together (wins purchases: Key Power / Word Sense /
// Momentum / cosmetics; XP levels; per-mode mastery; collection milestones; achievements;
// unlock-ladder frames; rebirths) on ONE merged timeline, and reports the longest DEAD STRETCH
// (span with no reward event) per archetype. Imports the LIVE shipped modules — no reimplemented
// numbers. Run: node claude/econ200h-audit.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  keyTierXp, keyTierCostAt, need, rebirthMult, rebirthThreshold, round10,
} from '../src/progress/xp.js';
import { WORD_WINS_BASE, WINS_MULT } from '../src/progress/wins.js';
import { momentumCost, momentumMult, MOMENTUM_MAX } from '../src/progress/momentum.js';
import { wordSenseCost, wordSenseFactor } from '../src/progress/wordSense.js';
import { masteryNeed, MASTERY_MAX, MASTERY_XP_STEP } from '../src/progress/mastery.js';
import { COLLECTION_MILESTONES } from '../src/progress/collection.js';
import { comboMultiplier } from '../src/progress/combo.js';
import { buildRarityIndex, wordRarity } from '../src/progress/rarity.js';
import { streakMultiplier } from '../src/progress/streak.js';
import { POP_STYLES, SOUND_PACKS } from '../src/progress/shop.js';
import { mulberry32 } from '../src/solo/shared.js';

const U = (p) => fileURLToPath(new URL(p, import.meta.url));
const recall = readFileSync(U('../src/solo/words.recall.txt'), 'utf8').split(' ');
const idx = buildRarityIndex(recall);
const satDeck = JSON.parse(readFileSync(U('../src/data/satRush/words.json'), 'utf8')).map((x) => x.word);

const PLAY_MIN = 200 * 60;
const REBIRTH_CAP = process.argv[2] != null && process.argv[2] !== '' ? Number(process.argv[2]) : 10;
const NO_WORDSENSE = process.argv[3] === 'nows'; // refutation: disable WORD SENSE purchases
const XP_MULT = { 'word-bomb': 2, 'category-blitz': 2, 'sat-rush': 3, chain: 4, fuse: 5 };
const LUCKY_MEAN = (39 / 40) * 1 + (1 / 40) * 5; // 1.1

// THROUGHPUT (words/min) — same models winsmin-sim uses. CHAIN 11.6 derived there; kept as const.
const THROUGHPUT = { wordBomb: 8, blitz: 14, satRush: 12, chain: 11.6, fuse: 20 };
// mode-key -> XP/mastery-style id
const XPID = { wordBomb: 'word-bomb', blitz: 'category-blitz', satRush: 'sat-rush', chain: 'chain', fuse: 'fuse' };

// A frequency-weighted typist word stream for BOMB/BLITZ/CHAIN/FUSE (full recall tail so RARE
// appears); SAT draws its forced deck. Returns a generator-ish { pick() }.
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

// Cosmetic prices (ascending) — a one-time finite sink.
const COSMETIC_PRICES = [...POP_STYLES, ...SOUND_PACKS].map((i) => i.price).filter((p) => p > 0).sort((a, b) => a - b);

// Mean per-word RARITY (for the wins/xp weight) and the OBSCURE/RARE flags come from the actual
// drawn word — so collection + rarity are consistent with earning.
function makePicker(archMode, seed) {
  return archMode === 'satRush' ? satPicker(seed) : freqPicker(seed);
}

// Simulate one archetype word-by-word. Player MAINS one mode (95% of words) with a little splash.
function simulate(archMode, seed) {
  const pick = makePicker(archMode, seed);
  const wordsPerMin = THROUGHPUT[archMode];
  const totalWords = Math.floor(wordsPerMin * PLAY_MIN);
  const modeMultW = WINS_MULT[archMode] || 1;
  const xpMode = XPID[archMode];
  const xpModeMult = XP_MULT[xpMode] || 1;

  // State
  let wins = 0, kt = 0, ws = 0, mom = 0, cosmeticI = 0;
  let level = 1, into = 0, rc = 0;
  let masteryWords = 0, masteryLevel = 1;
  const distinct = new Set();
  let obscureCount = 0, rareCount = 0;
  const ownedCollMs = new Set();
  const earnedAch = new Set();
  const ownedFrames = new Set();
  let streakDay = 0; // grows ~1/day; player plays daily. 200h over ~ a few months.

  // Reward-event timeline (minutes). Each entry: {t, kind}
  const events = [{ t: 0, kind: 'start' }];
  const push = (t, kind) => events.push({ t, kind });
  let momentumMaxT = null; // minutes at which the repeatable sink dies (mom hits 200)
  const keyTierT = {}; // tier number -> minute first reached

  // Achievement thresholds we can evaluate from this sim's state.
  const winsLifetime = () => lifetime;
  let lifetime = 0;

  // Frame unlock levels
  const FRAME_LEVELS = [3, 11, 19, 27, 35];

  // Streak model: assume the player logs in daily; ~ maps play-minutes to days. Spread 200h over
  // ~120 days (100 min/day). streak mult saturates at 30 days (×1.25). We bump a "day" every 100 min.
  let lastDayMark = 0;

  let comboStreak = 0; // resets occasionally (model a break every ~15 accepts)
  const rng2 = mulberry32(seed ^ 0x9e3779b9);

  for (let i = 0; i < totalWords; i++) {
    const t = i / wordsPerMin; // minutes elapsed

    // "Day" advance for streak (one per 100 play-minutes, capped so mult saturates).
    if (t - lastDayMark >= 100) { streakDay += 1; lastDayMark = t; }
    const streakMult = streakMultiplier(streakDay);

    // Draw the word; rarity from the live module.
    const word = pick();
    const rr = wordRarity(word, idx); // {band, mult}
    const rMult = rr.mult;
    if (rr.band === 'OBSCURE') obscureCount++;
    if (rr.band === 'RARE') rareCount++;

    // Combo: climbs, break ~1/15 words.
    comboStreak += 1;
    if (rng2() < 1 / 15) comboStreak = 0;
    const cMult = comboMultiplier(comboStreak);
    const weight = Math.min(40, rMult * cMult * LUCKY_MEAN);

    // --- WINS earned this word (live formula factors) ---
    const wsFactor = 1 + Math.max(0, rMult - 1) * (wordSenseFactor(ws) - 1);
    const perWordWins = round10(WORD_WINS_BASE * modeMultW * rebirthMult(rc) * momentumMult(mom));
    const gainWins = round10(weight * perWordWins * wsFactor);
    wins += gainWins; lifetime += gainWins;

    // --- XP this word ---
    const masteryXpMult = 1 + MASTERY_XP_STEP * (masteryLevel - 1);
    const gainXp = round10(round10(keyTierXp(kt) * (word.length) * xpModeMult * rebirthMult(rc) * weight * streakMult) * masteryXpMult);
    into += gainXp;
    while (into >= need(level)) { into -= need(level); level += 1; push(t, `level ${level}`);
      if (FRAME_LEVELS.includes(level) && !ownedFrames.has(level)) { ownedFrames.add(level); push(t, `frame LV${level}`); }
    }

    // --- Mastery (main mode) ---
    masteryWords += 1;
    if (masteryLevel < MASTERY_MAX && masteryWords >= masteryNeed(masteryLevel)) {
      masteryWords -= masteryNeed(masteryLevel); masteryLevel += 1; push(t, `mastery M${masteryLevel}`);
    }

    // --- Collection ---
    const before = distinct.size;
    distinct.add(word);
    if (distinct.size !== before) {
      for (const m of COLLECTION_MILESTONES) {
        if (distinct.size >= m.n && !ownedCollMs.has(m.n)) { ownedCollMs.add(m.n); const g = Math.round(m.wins * rebirthMult(rc)); wins += g; lifetime += g; push(t, `collection ${m.n} distinct`); }
      }
    }

    // --- Rebirth (greedy at threshold; an engaged prestige player keeps rebirthing through R10) ---
    if (level >= rebirthThreshold(rc) && rc < REBIRTH_CAP) { rc += 1; level = 1; into = 0; push(t, `REBIRTH ${rc}`); }

    // --- Achievements (evaluate the ones this sim tracks) ---
    checkAch(earnedAch, {
      words: i + 1, winsLifetime: lifetime, level, rebirths: rc, distinct: distinct.size,
      obscure: obscureCount, streak: streakDay, keyTier: kt, wsTier: ws, mastery: masteryLevel,
    }, (id) => push(t, `achievement ${id}`));

    // --- Purchases: greedily buy the cheapest affordable sink each word ---
    // (buy in a loop so a big collection windfall can clear several at once)
    let bought = true;
    while (bought) {
      bought = false;
      const nextKey = kt < 25 ? keyTierCostAt(kt + 1) : Infinity;
      const nextWs = (!NO_WORDSENSE && ws < 25) ? wordSenseCost(ws) : Infinity;
      const nextMom = mom < MOMENTUM_MAX ? momentumCost(mom) : Infinity;
      const nextCos = cosmeticI < COSMETIC_PRICES.length ? COSMETIC_PRICES[cosmeticI] : Infinity;
      const cheapest = Math.min(nextKey, nextWs, nextMom, nextCos);
      if (!Number.isFinite(cheapest) || wins < cheapest) break;
      // buy the cheapest (ties: momentum first — keeps cadence lively, matches greedy sims)
      if (nextMom === cheapest) { wins -= nextMom; mom += 1; push(t, `momentum #${mom}`); if (mom >= MOMENTUM_MAX && momentumMaxT == null) momentumMaxT = t; bought = true; }
      else if (nextCos === cheapest) { wins -= nextCos; cosmeticI += 1; push(t, `cosmetic`); bought = true; }
      else if (nextKey === cheapest) { wins -= nextKey; kt += 1; keyTierT[kt] = t; push(t, `KEY POWER T${kt}`); bought = true; }
      else if (nextWs === cheapest) { wins -= nextWs; ws += 1; push(t, `WORD SENSE T${ws}`); bought = true; }
    }
  }

  // Merge-sort events, compute longest gap (and the tail to 200h).
  events.sort((a, b) => a.t - b.t);
  let longest = 0, gapKind = '', gapStart = 0, prevT = 0, prevKind = 'start';
  // Also: longest gap that STARTS after momentum maxes (the deep-endgame cadence).
  let longestPost = 0, prevPostT = momentumMaxT;
  for (const e of events) {
    const gap = e.t - prevT;
    if (gap > longest) { longest = gap; gapKind = `${prevKind} → ${e.kind}`; gapStart = prevT; }
    if (momentumMaxT != null && prevT >= momentumMaxT) { const g = e.t - prevT; if (g > longestPost) longestPost = g; }
    prevT = e.t; prevKind = e.kind;
  }
  const tail = PLAY_MIN - prevT;
  if (tail > longest) { longest = tail; gapKind = `${prevKind} → (end)`; gapStart = prevT; }
  if (momentumMaxT != null) { const g = PLAY_MIN - Math.max(prevT, momentumMaxT); if (g > longestPost) longestPost = g; }

  return {
    longestGapMin: longest, gapKind, gapStartH: gapStart / 60, totalEvents: events.length - 1,
    momentumMaxH: momentumMaxT == null ? null : momentumMaxT / 60, longestPostMomMaxMin: longestPost,
    keyTierT,
    finalLevel: level, rc, kt, ws, mom, cosmetics: cosmeticI,
    masteryLevel, distinct: distinct.size, obscure: obscureCount, rare: rareCount,
    achievements: earnedAch.size, collectionMs: ownedCollMs.size,
    winsLifetime: lifetime, avgWinsPerMin: lifetime / PLAY_MIN,
  };
}

// A compact achievement evaluator over the sim state (the subset derivable here).
const ACH = [
  ['vol-1', (s) => s.words >= 1], ['vol-100', (s) => s.words >= 100], ['vol-1k', (s) => s.words >= 1000],
  ['vol-10k', (s) => s.words >= 10000], ['vol-50k', (s) => s.words >= 50000],
  ['obs-1', (s) => s.obscure >= 1], ['obs-50', (s) => s.obscure >= 50],
  ['dist-500', (s) => s.distinct >= 500], ['dist-2500', (s) => s.distinct >= 2500],
  ['lv-15', (s) => s.level >= 15], ['reb-1', (s) => s.rebirths >= 1], ['lv-50', (s) => s.level >= 50],
  ['reb-5', (s) => s.rebirths >= 5], ['streak-3', (s) => s.streak >= 3], ['streak-7', (s) => s.streak >= 7],
  ['streak-30', (s) => s.streak >= 30], ['m-main-5', (s) => s.mastery >= 5],
  ['kp-5', (s) => s.keyTier >= 5], ['ws-3', (s) => s.wsTier >= 3],
  ['sec-millionaire', (s) => s.winsLifetime >= 1000000], ['sec-dict', (s) => s.obscure >= 100],
];
function checkAch(earned, s, onEarn) {
  for (const [id, test] of ACH) { if (!earned.has(id) && test(s)) { earned.add(id); onEarn(id); } }
}

const ARCHES = [
  { key: 'wordBomb', name: 'Word Bomb main' },
  { key: 'blitz', name: 'Blitz main' },
  { key: 'satRush', name: 'SAT Rush main (vocab-strong)' },
  { key: 'chain', name: 'Chain main' },
  { key: 'fuse', name: 'Fuse grinder' },
];

console.log('=== 200-HOUR FULL-ECONOMY SIM (all reward channels merged) ===\n');
console.log('archetype                       longest-dead-stretch   #events  final: LV/R/KT/WS/MOM   mastery  distinct(obsc)  ach  collMs');
let worst = { longestGapMin: 0 };
for (const a of ARCHES) {
  const r = simulate(a.key, 0x1234 + a.name.length * 7);
  if (r.longestGapMin > worst.longestGapMin) worst = { ...r, name: a.name };
  const h = (r.longestGapMin / 60).toFixed(2);
  console.log(
    `${a.name.padEnd(30)}  ${h.padStart(6)}h (${(r.longestGapMin).toFixed(0)}m)  ${String(r.totalEvents).padStart(6)}  ` +
    `LV${r.finalLevel}/R${r.rc}/KT${r.kt}/WS${r.ws}/M${r.mom}`.padEnd(22) +
    `  M${r.masteryLevel}     ${String(r.distinct).padStart(5)}(${r.obscure})   ${String(r.achievements).padStart(2)}   ${r.collectionMs}`
  );
  console.log(`     worst gap: ${r.gapKind}  @ start ${r.gapStartH.toFixed(1)}h`);
  console.log(`     momentum maxed (200) at: ${r.momentumMaxH == null ? 'never' : r.momentumMaxH.toFixed(1) + 'h'}   longest gap AFTER mom-max: ${(r.longestPostMomMaxMin / 60).toFixed(2)}h   avg earn: ${r.avgWinsPerMin.toExponential(2)} wins/min (nominal ~700)`);
  const kts = Object.keys(r.keyTierT).map(Number).sort((a, b) => a - b);
  console.log(`     time-to-Key-Power: ${kts.map((k) => `T${k}@${(r.keyTierT[k] / 60).toFixed(1)}h`).join('  ')}`);
}
console.log(`\n→ WORST dead stretch across archetypes: ${(worst.longestGapMin / 60).toFixed(2)}h (${worst.name})`);
console.log(`  gap: ${worst.gapKind}`);
