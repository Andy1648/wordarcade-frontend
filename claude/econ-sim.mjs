// econ-sim.mjs — TYPE A WORD economy simulation (Job 12). Steps day-by-day through the
// CURRENT LIVE economy for three archetypes and finds, for each, the LONGEST stretch of
// play-hours with NOTHING new to buy or unlock (the churn point). Run:
//   node claude/econ-sim.mjs
//
// It imports the REAL economy source (pure functions only — no localStorage/DOM paths are
// exercised) so every curve/cost/multiplier is the shipped one, and samples the REAL word
// corpora to derive per-mode rarity. Nothing here invents an economy number; the only
// invented inputs are the clearly-labelled PLAY assumptions (words/min, mode mix, combo,
// distinct-word growth) at the top of CONFIG.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// ---- REAL economy source (pure imports) --------------------------------------------------
import {
  need, keyTierXp, keyTierCostAt, rebirthMult, rebirthThreshold,
  cappedWordMult, XP_MULTIPLIERS, KEY_TIERS, round10,
} from '../src/progress/xp.js';

// EXPERIMENT knob: the past-T8 tier COST step. Real economy = 6 (matches source exactly).
// Set EXP_STEP=4 (etc.) to model the recommended change. costAt() below is used for BOTH
// Key Power and Word Sense (they share the ladder). At step 6 it is byte-identical to the
// source keyTierCostAt.
const EXP_STEP = Number(process.env.EXP_STEP) || 6;
// Effect step per tier past T8 (real = 2.5). Lowering cost + effect TOGETHER = finer tier
// granularity (more, smaller tiers) with the SAME terminal power curve.
const EXP_EFFECT = Number(process.env.EXP_EFFECT) || 2.5;
function wsFactor(tier) { const t = Math.max(0, Math.floor(tier)); return Math.pow(EXP_EFFECT, t); }
// EXPERIMENT: multiply the Word Sense PRICE ladder by this so its tiers fall BETWEEN Key
// Power's in cost (=√6 interleaves them at half the log-spacing). Effects are untouched. 1 = live.
const EXP_WS_OFFSET = Number(process.env.EXP_WS_OFFSET) || 1;
const _costMemo = new Map();
function costAt(tier) {
  const t = Math.max(0, Math.floor(tier));
  if (t < KEY_TIERS.length) return KEY_TIERS[t].cost;
  if (_costMemo.has(t)) return _costMemo.get(t);
  let cost = costAt(t - 1) * EXP_STEP;
  cost = Math.round(cost / 10) * 10;
  if (!Number.isFinite(cost)) cost = Number.MAX_VALUE;
  _costMemo.set(t, cost);
  return cost;
}
// Memoized XP-per-letter (source keyTierXp is O(tier) past T8; memoize + cap so low-cost-step
// experiments that push the tier count high still run fast and stay finite).
const _xpMemo = new Map();
function keyTierXpMemo(tier) {
  const t = Math.max(0, Math.floor(tier));
  if (t < KEY_TIERS.length) return KEY_TIERS[t].xp;
  if (_xpMemo.has(t)) return _xpMemo.get(t);
  let xp = keyTierXpMemo(t - 1) * EXP_EFFECT;
  xp = Math.round(xp / 10) * 10;
  if (!Number.isFinite(xp)) xp = Number.MAX_VALUE;
  _xpMemo.set(t, xp);
  return xp;
}
const TIER_CAP = 120; // realism/perf cap on how high a track can climb (T120 effect is astronomical)
import { perWordWins } from '../src/progress/wins.js';
import { wordSenseFactor } from '../src/progress/wordSense.js';
import { POP_STYLES, SOUND_PACKS } from '../src/progress/shop.js';
import { THEMES } from '../src/theme/themes.js';
import { masteryFromWords } from '../src/progress/mastery.js';
import { buildRarityIndex, wordRarity } from '../src/progress/rarity.js';

// streakMultiplier + returnBonusWins reimplemented (streak.js pulls records.js at import;
// keeping the sim self-contained here — the math is copied verbatim from the source):
function streakMultiplier(count) {
  const c = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  if (c >= 30) return 1.25; if (c >= 14) return 1.2; if (c >= 7) return 1.1; if (c >= 3) return 1.05; return 1;
}
function returnBonusWins(hoursAway, rc) {
  const h = Math.min(hoursAway, 12); if (h < 6) return 0; return Math.round(h * 100 * rebirthMult(rc));
}

// Catalogs hardcoded from source (avoids import side effects); values verified against files.
const COLLECTION_MILESTONES = [
  { n: 100, wins: 5000 }, { n: 500, wins: 50000 }, { n: 1000, wins: 250000 },
  { n: 2500, wins: 2000000 }, { n: 5000, wins: 20000000 },
];
const LADDER_FRAMES = [
  { level: 3, id: 'frame-bolt' }, { level: 11, id: 'frame-tape' }, { level: 19, id: 'frame-chrome' },
  { level: 27, id: 'frame-spike' }, { level: 35, id: 'frame-gold' },
];
// Achievements (base wins × rebirthMult at grant). Predicates read the sim state snapshot.
const ACHIEVEMENTS = [
  { id: 'vol-1', base: 100, t: s => s.words >= 1 }, { id: 'vol-100', base: 500, t: s => s.words >= 100 },
  { id: 'vol-1k', base: 2000, t: s => s.words >= 1000 }, { id: 'vol-10k', base: 20000, t: s => s.words >= 10000 },
  { id: 'vol-50k', base: 100000, t: s => s.words >= 50000 },
  { id: 'wpm-40', base: 1000, t: s => s.bestWpm >= 40 }, { id: 'wpm-70', base: 3000, t: s => s.bestWpm >= 70 },
  { id: 'wpm-100', base: 10000, t: s => s.bestWpm >= 100 },
  { id: 'obs-1', base: 500, t: s => s.obscure >= 1 }, { id: 'obs-50', base: 10000, t: s => s.obscure >= 50 },
  { id: 'dist-500', base: 5000, t: s => s.distinct >= 500 }, { id: 'dist-2500', base: 50000, t: s => s.distinct >= 2500 },
  { id: 'lv-15', base: 1000, t: s => s.level >= 15 }, { id: 'reb-1', base: 5000, t: s => s.rebirths >= 1 },
  { id: 'lv-50', base: 20000, t: s => s.level >= 50 }, { id: 'reb-5', base: 50000, t: s => s.rebirths >= 5 },
  { id: 'streak-3', base: 1000, t: s => s.streak >= 3 }, { id: 'streak-7', base: 5000, t: s => s.streak >= 7 },
  { id: 'streak-30', base: 50000, t: s => s.streak >= 30 },
  { id: 'm-wb-5', base: 2000, t: s => s.mastery['word-bomb'] >= 5 }, { id: 'm-blitz-5', base: 2000, t: s => s.mastery['category-blitz'] >= 5 },
  { id: 'm-sat-5', base: 2000, t: s => s.mastery['sat-rush'] >= 5 }, { id: 'm-chain-5', base: 2000, t: s => s.mastery['chain'] >= 5 },
  { id: 'm-fuse-5', base: 2000, t: s => s.mastery['fuse'] >= 5 }, { id: 'm-all-3', base: 10000, t: s => s.minMastery >= 3 },
  { id: 'kp-5', base: 10000, t: s => s.keyTier >= 5 }, { id: 'ws-3', base: 10000, t: s => s.wsTier >= 3 },
  { id: 'sec-millionaire', base: 20000, t: s => s.winsLifetime >= 1000000 }, { id: 'sec-dict', base: 25000, t: s => s.obscure >= 100 },
  { id: 'sec-eternal', base: 100000, t: s => s.rebirths >= 10 }, { id: 'sec-truemaster', base: 200000, t: s => s.minMastery >= 10 },
];

// ---- PLAY ASSUMPTIONS (the invented inputs — all economy numbers above are the real source) ----
const CONFIG = {
  targetPlayHours: 200,
  archetypes: [
    { name: 'CASUAL',  minPerDay: 10,  bestWpm: 45 },
    { name: 'REGULAR', minPerDay: 30,  bestWpm: 65 },
    { name: 'GRINDER', minPerDay: 120, bestWpm: 85 },
  ],
  // Effective VALID words/min for the LOCAL player, per mode. Turn-based multiplayer modes are
  // far slower for one player (you only type on your turn); solo modes run at full typing speed.
  wpm: { 'word-bomb': 5, 'category-blitz': 14, 'sat-rush': 9, chain: 16, fuse: 11 },
  // Difficulty tier the player runs the multiplayer modes at (App defaults returning players to
  // 'medium'). Solo modes have no difficulty.
  difficulty: { 'word-bomb': 'medium', 'category-blitz': 'medium', 'sat-rush': null, chain: null, fuse: null },
  // Solo skill knobs (CHAIN/FUSE only): time-avg combo across a run, and the mean per-word wins/xp
  // multiplier contributed by the 1/40 lucky roll ( (39*1+1*5)/40 = 1.1 ).
  combo: { chain: 2.2, fuse: 2.2 },
  luckyFactor: 1.1,
  // Distinct-word growth (Heaps' law: distinct ≈ K * N^beta, capped). LEAST-certain input.
  heapsK: 6.7, heapsBeta: 0.55, distinctCeiling: 8000,
  daysCap: 4000,
};

// ---- corpus + per-mode rarity (Monte Carlo over the REAL word lists) ---------------------
const U = p => fileURLToPath(new URL(p, import.meta.url));
const recall = readFileSync(U('../src/solo/words.recall.txt'), 'utf8').split(' ');
const idx = buildRarityIndex(recall);
const satDeck = JSON.parse(readFileSync(U('../src/data/satRush/words.json'), 'utf8')).map(x => x.word);

function mulberry32(seed) { let a = seed >>> 0; return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// Frequency-weighted typist: p(word) ∝ 1/(rank+50) within [minLen, topVocab] — same model the
// repo's rarity-sim.mjs uses for the player-choice modes.
function freqPool(topVocab, minLen) {
  const pool = []; const cum = []; let acc = 0;
  for (let i = 0; i < Math.min(topVocab, recall.length); i++) {
    const w = recall[i]; if (w.length < minLen) continue;
    acc += 1 / (i + 50); pool.push(w); cum.push(acc);
  }
  return { pool, cum, total: acc };
}
function sampleMode(kind, n = 30000) {
  const rng = mulberry32(kind === 'sat-rush' ? 77 : kind.length * 131 + 7);
  let sumMult = 0, sumLen = 0, obscure = 0;
  const draw = (() => {
    if (kind === 'sat-rush') return () => satDeck[Math.floor(rng() * satDeck.length)];
    const cfg = { 'word-bomb': [12000, 3], 'category-blitz': [12000, 3], chain: [9000, 3], fuse: [9000, 5] }[kind];
    const { pool, cum, total } = freqPool(cfg[0], cfg[1]);
    return () => { const r = rng() * total; let lo = 0, hi = cum.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < r) lo = m + 1; else hi = m; } return pool[lo]; };
  })();
  for (let i = 0; i < n; i++) { const w = draw(); const rar = wordRarity(w, idx); sumMult += rar.mult; sumLen += w.length; if (rar.band === 'OBSCURE') obscure++; }
  return { meanMult: sumMult / n, meanExcess: (sumMult / n) - 1, meanLen: sumLen / n, obscureShare: obscure / n };
}
const MODES = ['word-bomb', 'category-blitz', 'sat-rush', 'chain', 'fuse'];
const RAR = Object.fromEntries(MODES.map(m => [m, sampleMode(m)]));
const winsKey = { 'word-bomb': 'wordBomb', 'category-blitz': 'blitz', 'sat-rush': 'satRush', chain: 'chain', fuse: 'fuse' };

// ---- mode mix by current level (which modes are unlocked) ---------------------------------
function modeMix(level) {
  let w;
  if (level < 20) w = { 'word-bomb': 0.4, 'category-blitz': 0.3, 'sat-rush': 0.3 };
  else if (level < 25) w = { chain: 0.4, 'sat-rush': 0.25, 'category-blitz': 0.2, 'word-bomb': 0.15 };
  else w = { fuse: 0.35, chain: 0.35, 'sat-rush': 0.15, 'category-blitz': 0.1, 'word-bomb': 0.05 };
  const s = Object.values(w).reduce((a, b) => a + b, 0);
  for (const k of Object.keys(w)) w[k] /= s;
  return w;
}

// ---- per-word wins / xp for a mode given the live state -----------------------------------
function perWordWinsAmt(mode, st) {
  const base = perWordWins({ mode: winsKey[mode], difficulty: CONFIG.difficulty[mode], rebirthCount: st.rc });
  const combo = CONFIG.combo[mode] || 1;
  const lucky = (mode === 'chain' || mode === 'fuse') ? CONFIG.luckyFactor : 1;
  const capped = cappedWordMult(RAR[mode].meanMult, combo, lucky);
  const wsBoost = 1 + RAR[mode].meanExcess * (wsFactor(st.wsTier) - 1); // WORD SENSE, outside the ×40 cap
  return base * capped * wsBoost;
}
function perWordXpAmt(mode, st, streakMult, masteryMult) {
  const combo = CONFIG.combo[mode] || 1;
  const lucky = (mode === 'chain' || mode === 'fuse') ? CONFIG.luckyFactor : 1;
  const xpWeight = cappedWordMult(RAR[mode].meanMult, combo, lucky);
  return keyTierXpMemo(st.kt) * RAR[mode].meanLen * XP_MULTIPLIERS[mode] * rebirthMult(st.rc) * xpWeight * streakMult * masteryMult;
}

// ---- one archetype run --------------------------------------------------------------------
function runArchetype(arch) {
  const st = {
    level: 1, intoLevel: 0, wins: 0, winsLifetime: 0, rc: 0, kt: 0, wsTier: 0,
    wordsTotal: 0, wordsByMode: Object.fromEntries(MODES.map(m => [m, 0])),
    obscureWords: 0, distinct: 0,
    ownedPop: new Set(['classic']), ownedSound: new Set(['thock', 'clack', 'cream']),
    ownedTheme: new Set(['default']), frames: new Set(), earnedAch: new Set(), claimedMs: new Set(),
    firedUnlocks: new Set(), // one-shot menu-unlock events (mode/theme-free/frame first reach)
  };
  const events = [];   // { h, day, type, label }
  const timeline = { keyPower: {}, wordSense: {}, modeUnlock: {}, themeUnlock: {}, rebirth: [], levelSamples: [] };
  const logEvent = (h, day, type, label) => events.push({ h, day, type, label });

  let day = 0, playHours = 0;
  const minPerDay = arch.minPerDay;

  function creditXp(gain) {
    if (!Number.isFinite(gain)) gain = 0;
    st.intoLevel += gain;
    // Safety: keyTierXp grows ×2.5/tier and can overflow to Infinity in low-cost-step
    // experiments; cap the carry loop so an overflowed gain can't spin forever. LV650 is
    // already past every rebirth threshold modelled, so capping there changes no result.
    let guard = 0;
    while (st.intoLevel >= need(st.level) && Number.isFinite(need(st.level)) && st.level < 650 && guard++ < 5000) {
      st.intoLevel -= need(st.level); st.level += 1;
    }
    if (st.level >= 650) st.intoLevel = 0;
  }
  function grantWins(n) { let a = Math.max(0, n); if (!Number.isFinite(a)) a = 0; st.wins = Math.min(st.wins + a, 1e300); st.winsLifetime = Math.min(st.winsLifetime + a, 1e300); }

  while (playHours < CONFIG.targetPlayHours && day < CONFIG.daysCap) {
    day += 1;
    playHours += minPerDay / 60;

    // Daily streak (plays every day) + return bonus (>=24h away, once/day).
    const streakMult = streakMultiplier(day);
    grantWins(returnBonusWins(24, st.rc));

    // ---- PLAY: distribute the day's minutes over unlocked modes -----------------------------
    const mix = modeMix(st.level);
    let dayXp = 0, obscureToday = 0, wordsToday = 0;
    for (const [mode, frac] of Object.entries(mix)) {
      const mins = minPerDay * frac;
      const words = CONFIG.wpm[mode] * mins;
      if (words <= 0) continue;
      wordsToday += words;
      st.wordsByMode[mode] += words;
      const masteryMult = 1 + 0.03 * (masteryFromWords(st.wordsByMode[mode]).level - 1);
      grantWins(perWordWinsAmt(mode, st) * words);
      dayXp += perWordXpAmt(mode, st, streakMult, masteryMult) * words;
      obscureToday += words * RAR[mode].obscureShare;
    }
    st.wordsTotal += wordsToday;
    st.obscureWords += obscureToday;
    const beforeLevel = st.level;
    creditXp(dayXp);

    // Distinct words (Heaps) + obscure distinct (approx: distinct × lifetime obscure-word share).
    st.distinct = Math.min(CONFIG.distinctCeiling, Math.floor(CONFIG.heapsK * Math.pow(st.wordsTotal, CONFIG.heapsBeta)));
    const obscureShareLife = st.wordsTotal > 0 ? st.obscureWords / st.wordsTotal : 0;
    const obscureDistinct = Math.floor(st.distinct * obscureShareLife);

    // ---- Level-driven unlocks (fire once) ---------------------------------------------------
    if (beforeLevel < st.level) {
      // Mode unlocks
      for (const [lv, mode, label] of [[20, 'chain', 'CHAIN unlocked'], [25, 'fuse', 'FUSE unlocked']]) {
        if (st.level >= lv && !st.firedUnlocks.has('mode-' + mode)) {
          st.firedUnlocks.add('mode-' + mode); timeline.modeUnlock[mode] = { h: playHours, day };
          logEvent(playHours, day, 'modeunlock', label);
        }
      }
      // Free theme unlocks (midnight LV10, toxic LV30)
      for (const t of THEMES) {
        if (t.unlockLevel > 0 && st.level >= t.unlockLevel && !st.ownedTheme.has(t.id)) {
          st.ownedTheme.add(t.id); st.firedUnlocks.add('theme-' + t.id); timeline.themeUnlock[t.id] = { h: playHours, day };
          logEvent(playHours, day, 'theme', `${t.name} theme (free @LV${t.unlockLevel})`);
        }
      }
      // Frame ladder
      for (const f of LADDER_FRAMES) {
        if (st.level >= f.level && !st.frames.has(f.id)) { st.frames.add(f.id); logEvent(playHours, day, 'frame', `${f.id} (LV${f.level})`); }
      }
    }

    // ---- Collection milestones --------------------------------------------------------------
    for (const m of COLLECTION_MILESTONES) {
      if (st.distinct >= m.n && !st.claimedMs.has(m.n)) {
        st.claimedMs.add(m.n); const g = Math.round(m.wins * rebirthMult(st.rc)); grantWins(g);
        logEvent(playHours, day, 'collection', `${m.n} distinct words (+${fmt(g)} wins)`);
      }
    }

    // ---- Achievements -----------------------------------------------------------------------
    const masteryLevels = Object.fromEntries(MODES.map(m => [m, masteryFromWords(st.wordsByMode[m]).level]));
    const snap = {
      words: st.wordsTotal, winsLifetime: st.winsLifetime, level: st.level, rebirths: st.rc,
      distinct: st.distinct, obscure: obscureDistinct, streak: day, bestWpm: arch.bestWpm,
      keyTier: st.kt, wsTier: st.wsTier, mastery: masteryLevels, minMastery: Math.min(...MODES.map(m => masteryLevels[m])),
    };
    for (const a of ACHIEVEMENTS) {
      if (!st.earnedAch.has(a.id) && a.t(snap)) {
        st.earnedAch.add(a.id); const g = Math.round(a.base * rebirthMult(st.rc)); grantWins(g);
        logEvent(playHours, day, 'achievement', `${a.id} (+${fmt(g)} wins)`);
      }
    }

    // ---- Spend: buy the cheapest affordable NEW thing, repeat ------------------------------
    let guard = 0;
    while (guard++ < 50) {
      const cands = [];
      if (st.kt < TIER_CAP) cands.push({ cost: costAt(st.kt + 1), kind: 'keypower' });
      if (st.wsTier < TIER_CAP) cands.push({ cost: Math.round(costAt(st.wsTier + 1) * EXP_WS_OFFSET / 10) * 10, kind: 'wordsense' });
      for (const p of POP_STYLES) if (p.price > 0 && !st.ownedPop.has(p.id)) cands.push({ cost: p.price, kind: 'pop', id: p.id, name: p.name });
      for (const s of SOUND_PACKS) if (s.price > 0 && !st.ownedSound.has(s.id)) cands.push({ cost: s.price, kind: 'sound', id: s.id, name: s.name });
      for (const t of THEMES) if (t.price > 0 && !st.ownedTheme.has(t.id)) cands.push({ cost: t.price, kind: 'themebuy', id: t.id, name: t.name });
      cands.sort((a, b) => a.cost - b.cost);
      const pick = cands.find(c => c.cost <= st.wins);
      if (!pick) break;
      st.wins -= pick.cost;
      if (pick.kind === 'keypower') { st.kt += 1; timeline.keyPower[st.kt] = { h: playHours, day, cost: pick.cost }; logEvent(playHours, day, 'keypower', `KEY POWER T${st.kt} (${fmt(pick.cost)} wins)`); }
      else if (pick.kind === 'wordsense') { st.wsTier += 1; timeline.wordSense[st.wsTier] = { h: playHours, day, cost: pick.cost }; logEvent(playHours, day, 'wordsense', `WORD SENSE T${st.wsTier} (${fmt(pick.cost)} wins)`); }
      else if (pick.kind === 'pop') { st.ownedPop.add(pick.id); logEvent(playHours, day, 'cosmetic', `pop:${pick.name} (${fmt(pick.cost)})`); }
      else if (pick.kind === 'sound') { st.ownedSound.add(pick.id); logEvent(playHours, day, 'cosmetic', `sound:${pick.name} (${fmt(pick.cost)})`); }
      else if (pick.kind === 'themebuy') { st.ownedTheme.add(pick.id); logEvent(playHours, day, 'theme', `${pick.name} theme (${fmt(pick.cost)} wins)`); }
    }

    // ---- Rebirth when eligible (greedy — the prestige frame + multiplier are "new") ---------
    if (st.level >= rebirthThreshold(st.rc)) {
      st.rc += 1; st.level = 1; st.intoLevel = 0;
      timeline.rebirth.push({ h: playHours, day, rc: st.rc, mult: rebirthMult(st.rc) });
      logEvent(playHours, day, 'rebirth', `REBIRTH ${st.rc} (×${rebirthMult(st.rc)} perm)`);
    }

    if (day % 5 === 0 || playHours >= CONFIG.targetPlayHours) timeline.levelSamples.push({ h: round1(playHours), day, level: st.level, rc: st.rc, wins: st.wins, lifetime: st.winsLifetime, kt: st.kt, ws: st.wsTier });
  }

  // ---- dead-stretch analysis: longest play-hour gap between consecutive "new" events -------
  const sorted = events.slice().sort((a, b) => a.h - b.h);
  let longest = { from: 0, to: 0, len: 0, afterLabel: 'START', beforeLabel: 'END' };
  let prevH = 0, prevLabel = 'START (LV1)';
  for (const e of sorted) {
    const gap = e.h - prevH;
    if (gap > longest.len) longest = { from: prevH, to: e.h, len: gap, afterLabel: prevLabel, beforeLabel: e.label };
    prevH = e.h; prevLabel = `${e.type}: ${e.label}`;
  }
  const tail = CONFIG.targetPlayHours - prevH;
  if (tail > longest.len) longest = { from: prevH, to: CONFIG.targetPlayHours, len: tail, afterLabel: prevLabel, beforeLabel: 'HORIZON (200h, nothing new)' };

  return { arch, st, events: sorted, timeline, longest, day, playHours };
}

// ---- formatting helpers -------------------------------------------------------------------
function fmt(n) { n = Math.round(n); if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T'; if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B'; if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k'; return String(n); }
function round1(x) { return Math.round(x * 10) / 10; }

// ---- run + report -------------------------------------------------------------------------
console.log('=== PER-MODE RARITY (Monte Carlo over real corpora) ===');
for (const m of MODES) console.log(`  ${m.padEnd(15)} meanMult ${RAR[m].meanMult.toFixed(2)}  meanLen ${RAR[m].meanLen.toFixed(1)}  OBSCURE ${(RAR[m].obscureShare * 100).toFixed(1)}%`);

const results = CONFIG.archetypes.map(runArchetype);

for (const r of results) {
  console.log(`\n\n########## ${r.arch.name} — ${r.arch.minPerDay} min/day ##########`);
  console.log(`Reached 200 play-hours in ${r.day} days (${(r.day / 365).toFixed(1)} yr). Final: LV${r.st.level} R${r.st.rc}  KeyPower T${r.st.kt}  WordSense T${r.st.wsTier}  distinct ${r.st.distinct}  lifetimeWins ${fmt(r.st.winsLifetime)}`);
  console.log('\n-- level / wins over time (sampled) --');
  console.log('  play-h   day   LV   R   KP  WS   balance    lifetime');
  const step = Math.max(1, Math.ceil(r.timeline.levelSamples.length / 14));
  for (const s of r.timeline.levelSamples.filter((_, i) => i % step === 0)) {
    console.log(`  ${String(s.h).padStart(6)} ${String(s.day).padStart(5)} ${String(s.level).padStart(4)} ${String(s.rc).padStart(3)} ${String(s.kt).padStart(3)} ${String(s.ws).padStart(3)}  ${fmt(s.wins).padStart(9)}  ${fmt(s.lifetime).padStart(9)}`);
  }
  console.log('\n-- KEY POWER tiers bought (play-hours) --');
  for (const [t, v] of Object.entries(r.timeline.keyPower)) console.log(`   T${t}: ${round1(v.h)}h (day ${v.day}, ${fmt(v.cost)} wins)`);
  console.log('-- WORD SENSE tiers bought (play-hours) --');
  for (const [t, v] of Object.entries(r.timeline.wordSense)) console.log(`   T${t}: ${round1(v.h)}h (day ${v.day}, ${fmt(v.cost)} wins)`);
  console.log('-- mode unlocks --');
  for (const [m, v] of Object.entries(r.timeline.modeUnlock)) console.log(`   ${m}: ${round1(v.h)}h (day ${v.day})`);
  console.log('-- rebirths --');
  console.log('   ' + (r.timeline.rebirth.map(x => `R${x.rc}@${round1(x.h)}h`).join('  ') || 'none'));
  console.log(`\n>>> LONGEST DEAD STRETCH: ${round1(r.longest.len)} play-hours <<<`);
  console.log(`    from ${round1(r.longest.from)}h [after: ${r.longest.afterLabel}]`);
  console.log(`    to   ${round1(r.longest.to)}h [next: ${r.longest.beforeLabel}]`);
  const gaps = [];
  let ph = 0, pl = 'START';
  for (const e of r.events) { gaps.push({ len: e.h - ph, from: ph, to: e.h, after: pl, before: `${e.type}: ${e.label}` }); ph = e.h; pl = `${e.type}: ${e.label}`; }
  gaps.push({ len: CONFIG.targetPlayHours - ph, from: ph, to: 200, after: pl, before: 'HORIZON' });
  gaps.sort((a, b) => b.len - a.len);
  console.log('    top 5 dead stretches (play-hours):');
  for (const g of gaps.slice(0, 5)) console.log(`      ${round1(g.len).toString().padStart(6)}h  ${round1(g.from)}→${round1(g.to)}h   after ${g.after.slice(0, 42)}  |  next ${g.before.slice(0, 42)}`);
}

console.log('\n\n=== SUMMARY: longest dead stretch per archetype ===');
for (const r of results) console.log(`  ${r.arch.name.padEnd(8)} ${round1(r.longest.len)} play-hours   (${r.longest.afterLabel.slice(0, 40)} → ${r.longest.beforeLabel.slice(0, 40)})`);
