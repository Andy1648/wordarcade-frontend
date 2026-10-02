#!/usr/bin/env node
// econ-sim.mjs — WHOLE-ECONOMY progression simulator for TYPE A WORD.
//
// Simulates players WORD BY WORD against the LIVE economy modules in src/progress/*.js (and
// src/theme/themes.js, src/gameData.js). Nothing economic is re-implemented here: every XP grant,
// wins bank, purchase, rebirth, mastery tick, mark rank, collection milestone and achievement goes
// through the shipped function, against an in-memory localStorage shim (a Map) installed on
// globalThis before the modules are imported. Re-run it after changing a constant and it simply
// re-imports the modules.
//
//   node claude/progression/econ-sim.mjs                     # writes before.json / before-report-data
//   node claude/progression/econ-sim.mjs --tag=after         # writes after.json (+ after-*.svg)
//   node claude/progression/econ-sim.mjs --hours=50 --quiet  # shorter tail
//   node claude/progression/econ-sim.mjs --src=../other-worktree/src --config=my.json
//
// ----------------------------------------------------------------------------- ASSUMPTIONS
// (all live in CFG below and can be overridden with --config=<json file> (deep-merged))
//  * PLAY TIME: three archetypes — CASUAL 10 min/day, REGULAR 30 min/day, GRINDER 60 min/day —
//    playing EVERY day (so the daily streak reaches x1.25 at day 30). The 30-day result is the
//    prefix of one continuous run that carries on, at the same daily rate, to a 200-HOUR long tail.
//  * PACE (accepted words per minute of PLAY, round overhead included): CASUAL 12, REGULAR 15,
//    GRINDER 18. A typing-test WPM (45 / 55 / 70) is recorded once so the SPEED achievements fire.
//  * MODE MIX (share of accepted words): Word Bomb 30%, CHAIN 25%, FUSE 20%, SAT Rush 15%,
//    Category Blitz 10%. WB/Blitz on difficulty 'easy' (the HARD label, x1.25). Word Race unused.
//  * ROUND LENGTH (accepted words): WB 12, Blitz 10, SAT 15, CHAIN 25, FUSE 20 (+/-40% uniform).
//    Combo resets each round; a miss (8% per word) breaks it (comboBreak). Lucky = live 1-in-40.
//  * WORDS: non-SAT words are drawn from a Zipf(s=1.0) over a 20k-word ranked vocabulary; the band
//    follows the live RARITY_BANDS rank cut-offs (COMMON <3000 ...); 1% are OBSCURE (off-list).
//    Length 3..10, mean ~5.0. Rarity mult = band mult + live lengthBonus(), capped RARITY_MAX_MULT.
//    SAT words come from a 1,000-word deck (mean raw rarity ~3.4, length ~8) and are normalised by
//    the live satRarityMult(). Distinct words feed the live Collection (milestones pay).
//  * SPENDING (greedy-but-sensible): after every round, buy the CHEAPEST affordable item among
//    {next KEY POWER tier, next MOMENTUM, unowned pop styles / sound packs, unowned paid themes};
//    repeat until nothing is affordable. Best owned cosmetic equipped (cosmetics are flair only).
//  * REBIRTH as soon as the current level >= rebirthThreshold(rebirths) (checked after each round).
//  * MARK: after each achievement check, wear the unlocked mark with the best expected multiplier
//    for the mode mix (LINGUIST / METRONOME chance effects are valued at a nominal +5% / +3%; their
//    in-game effect is NOT simulated).
//  * OCT 2 ECONOMY (STEP 48): MOMENTUM is the LETTER FORGE (bought like any sink; words are drawn
//    as letter strings by English letter frequency so the forge sees real letters); FUSE FRENZY is
//    triggered in CFG.frenzyRunP of FUSE rounds (frenzy-sim.mjs median: 19%) at a random word, and
//    the sim clock drives Date.now so the 5-minute window is play time; claims (achievements,
//    milestones, rank-ups, layer reveals) are claimed at the next round end; rebirth waits out a
//    BAD TIME (a star 1-2 levels away) and spends stars greedily (AUTO-KEY/FORGE, FRENZY+, HEAD
//    START, then STAR POWER).
//  * NOT MODELLED: returnBonus (daily players never return from absence), Word Race, menu typing
//    XP, the LINGUIST rarity bump, any server-side difficulty change.
//
// "MEANINGFUL" reward events: first-ever reach of a rank title, ladder frame, free theme, mode
// unlock, new menu tier; every purchase; mastery level-up; mark rank-up; achievement; collection
// milestone; rebirth. A level-up that unlocks none of these is TRIVIAL and is not an event.
// The STRICT view additionally drops MOMENTUM buys (+1% each) and any purchase that cost less than
// 10 seconds of income at the time (a "number that means nothing").
// -----------------------------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');

// ----------------------------------------------------------------------------- CONFIG
const CFG = {
  seed: 1648,
  days30: 30, // the headline window
  tailHours: 200, // continue every archetype to this much total PLAY time
  archetypes: [
    { id: 'casual', label: 'CASUAL 10 min/day', minPerDay: 10, wordsPerMin: 12, typingWpm: 45 },
    { id: 'regular', label: 'REGULAR 30 min/day', minPerDay: 30, wordsPerMin: 15, typingWpm: 55 },
    { id: 'grinder', label: 'GRINDER 60 min/day', minPerDay: 60, wordsPerMin: 18, typingWpm: 70 },
  ],
  // gameData id -> share of accepted words
  modeMix: { 'word-bomb': 0.3, chain: 0.25, fuse: 0.2, 'sat-rush': 0.15, 'category-blitz': 0.1 },
  roundLen: { 'word-bomb': 12, 'category-blitz': 10, 'sat-rush': 15, chain: 25, fuse: 20 },
  roundLenJitter: 0.4,
  difficulty: { 'word-bomb': 'easy', 'category-blitz': 'easy' },
  missRate: 0.08,
  vocab: { size: 20000, zipfS: 1.0, obscureP: 0.01, obscurePool: 3000, satDeck: 1000 },
  // word-length distribution (non-SAT): [len, weight]; mean ~5.0
  lengthDist: [[3, 0.12], [4, 0.26], [5, 0.26], [6, 0.18], [7, 0.1], [8, 0.05], [9, 0.02], [10, 0.01]],
  satLengthDist: [[6, 0.15], [7, 0.25], [8, 0.25], [9, 0.2], [10, 0.15]],
  // SAT deck raw band mix (mean raw rarity ~3.4 incl. length bonus, matching SAT_DECK_MEAN_RARITY)
  satBandMix: [['UNCOMMON', 0.12], ['RARE', 0.5], ['OBSCURE', 0.38]],
  frenzyRunP: 0.19, // share of FUSE rounds that light all 26 letters (claude/econ-oct2/frenzy-sim.mjs, median bot)
  achievementEveryRounds: 5,
  incomeWindowMin: 10, // trailing window for "wins per minute" income
  levelMarks: [10, 25, 50, 75, 100, 125, 150, 200, 250, 300],
  snapshotLevels: [50, 100, 125, 150, 200],
  affordLevels: [100, 125, 150],
  trivialSec: 10,
  wallMin: 60,
  absurd: 1e9,
};

// ----------------------------------------------------------------------------- CLI
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? true] : [a, true];
  }),
);
function deepMerge(a, b) {
  for (const [k, v] of Object.entries(b || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) deepMerge(a[k], v);
    else a[k] = v;
  }
  return a;
}
if (args.config) deepMerge(CFG, JSON.parse(fs.readFileSync(path.resolve(args.config), 'utf8')));
if (args.hours) CFG.tailHours = Number(args.hours);
if (args.seed) CFG.seed = Number(args.seed);
const TAG = typeof args.tag === 'string' ? args.tag : 'before';
const OUT = path.resolve(typeof args.out === 'string' ? args.out : HERE);
const SRC = path.resolve(typeof args.src === 'string' ? args.src : path.join(REPO, 'src'));
const QUIET = !!args.quiet;

// ----------------------------------------------------------------------------- STORAGE SHIM
function makeStore() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
    key: (i) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
    _map: map,
  };
}
globalThis.localStorage = makeStore();

// ----------------------------------------------------------------------------- LIVE MODULES
const imp = (rel) => import(pathToFileURL(path.join(SRC, rel)).href);
const XP = await imp('progress/xp.js');
const WINS = await imp('progress/wins.js');
const SHOP = await imp('progress/shop.js');
const FORGE = await imp('progress/forge.js');
const FRENZY = await imp('progress/frenzy.js');
const CLAIMS = await imp('progress/claims.js');
const STARS = await imp('progress/stars.js');
// The sim clock drives Date.now so FRENZY's wall-clock window is measured in PLAY time.
let SIM_NOW = Date.UTC(2026, 0, 1, 12);
Date.now = () => SIM_NOW;
// Letters by English frequency, so the LETTER FORGE sees words made of real letters.
const LETTER_FREQ = [['e',12.7],['t',9.1],['a',8.2],['o',7.5],['i',7],['n',6.7],['s',6.3],['h',6.1],['r',6],['d',4.3],['l',4],['c',2.8],['u',2.8],['m',2.4],['w',2.4],['f',2.2],['g',2],['y',2],['p',1.9],['b',1.5],['v',1],['k',0.8],['j',0.15],['x',0.15],['q',0.1],['z',0.07]];
const MAST = await imp('progress/mastery.js');
const MARKS = await imp('progress/marks.js');
const ACH = await imp('progress/achievements.js');
const COLL = await imp('progress/collection.js');
const STREAK = await imp('progress/streak.js');
const LADDER = await imp('progress/unlockLadder.js');
const RANK = await imp('progress/rank.js');
const TIER = await imp('progress/menuTier.js');
const RAR = await imp('progress/rarity.js');
const COMBO = await imp('progress/combo.js');
const LUCK = await imp('progress/luck.js');
const WPM = await imp('progress/wpm.js');
const THEMES = await imp('theme/themes.js');
const GAMEDATA = await imp('gameData.js');

const MODE_UNLOCKS = (GAMEDATA.GAMES || []).filter((g) => g.unlockLevel != null).map((g) => ({ id: g.id, level: g.unlockLevel }));
const PAYOUT_KEY = { 'word-bomb': 'wordBomb', 'category-blitz': 'blitz', 'sat-rush': 'satRush', chain: 'chain', fuse: 'fuse' };

// ----------------------------------------------------------------------------- HELPERS
const fmt = (n) => {
  if (n == null || !Number.isFinite(n)) return n === Infinity ? 'inf' : String(n);
  const a = Math.abs(n);
  if (a >= 1e6) return n.toExponential(2);
  if (a >= 100) return Math.round(n).toLocaleString('en-US');
  if (a >= 1) return n.toFixed(1);
  return n.toFixed(2);
};
const fmtMin = (m) => (m == null ? '—' : m < 1 ? `${(m * 60).toFixed(1)}s` : m < 120 ? `${m.toFixed(1)}m` : `${(m / 60).toFixed(1)}h`);
const pct = (arr, p) => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + 0.5))];
};
function pickWeighted(rng, pairs) {
  let r = rng() * pairs.reduce((s, p) => s + p[1], 0);
  for (const [v, w] of pairs) if ((r -= w) <= 0) return v;
  return pairs[pairs.length - 1][0];
}
function zipfCdf(n, s) {
  const cdf = new Float64Array(n);
  let acc = 0;
  for (let i = 0; i < n; i++) cdf[i] = acc += 1 / Math.pow(i + 1, s);
  for (let i = 0; i < n; i++) cdf[i] /= acc;
  return cdf;
}
function sampleCdf(cdf, u) {
  let lo = 0, hi = cdf.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cdf[mid] < u) lo = mid + 1;
    else hi = mid;
  }
  return lo; // 0-based rank
}
const BAND_MULT = Object.fromEntries([...RAR.RARITY_BANDS.map((b) => [b.name, b.mult]), [RAR.OBSCURE_BAND.name, RAR.OBSCURE_BAND.mult]]);
function bandOfRank(rank1) {
  const b = RAR.bandForRank ? RAR.bandForRank(rank1) : null;
  if (b && b.name) return b.name;
  for (const band of RAR.RARITY_BANDS) if (rank1 < band.maxRank) return band.name;
  return RAR.OBSCURE_BAND.name;
}
const rarityMult = (band, len) => Math.min(RAR.RARITY_MAX_MULT, BAND_MULT[band] + RAR.lengthBonus(len));

// ----------------------------------------------------------------------------- ONE PLAYER
function simulate(arch) {
  globalThis.localStorage = makeStore();
  SIM_NOW = Date.UTC(2026, 0, 1, 12);
  WINS.resetWinsLedger();
  WINS.consumePendingWinsStamp();
  const rng = LUCK.mulberry32((CFG.seed ^ arch.minPerDay * 7919) >>> 0);
  const luckRng = LUCK.makeLuckyOracle((CFG.seed * 31 + arch.wordsPerMin) >>> 0);
  const zipf = zipfCdf(CFG.vocab.size, CFG.vocab.zipfS);
  const modePairs = Object.entries(CFG.modeMix);
  const totalMin = CFG.tailHours * 60;
  const min30 = CFG.days30 * arch.minPerDay;
  const dt = 1 / arch.wordsPerMin;

  // ---- tracked state
  let minute = 0;
  let day = 0;
  let dayMinLeft = arch.minPerDay;
  let words = 0;
  let rounds = 0;
  let maxLevel = 1;
  let totalLevelUps = 0;
  let maxLevelsOneWord = 0;
  let maxMenuTier = 0;
  const seenRanks = new Set([RANK.rankTitle(1)]);
  const seenModeUnlock = new Set();
  const distinct = new Set();
  const events = []; // meaningful
  const purchases = [];
  const rebirths = [];
  let rbTrack = null; // the latest rebirth, while we watch how fast the level comes back
  const levelFirst = {}; // L -> {minute, rebirths, totalLevelUps}
  const snapshots = {}; // L -> numbers
  const afford = {}; // L -> afford table
  const series = []; // [minute, level, maxLevel]
  const incomeSamples = [[0, 0]]; // [minute, cumulative wins earned]
  let winsEarned = 0;
  let wordWinsEarned = 0;
  let snap30 = null;
  let lastAch = 0;
  const allCosmeticsOwnedAt = { minute: null };

  const ledgerUnsub = WINS.subscribeWins((e) => {
    winsEarned += e.amount;
    if (e.kind === 'word') wordWinsEarned += e.amount;
    else if (/^COLLECTION/.test(e.label)) addEvent('collection', e.label, { wins: e.amount });
    // achievement grants are recorded from checkAchievements' return (with name)
  });

  const level = () => XP.loadProgress().level;
  const ctx = () => ({ minute, level: level(), rebirths: XP.getRebirths(), keyTier: XP.getKeyTier(), day });
  function addEvent(kind, label, extra = {}) {
    events.push({ kind, label, ...ctx(), ...extra });
  }
  function incomePerMin() {
    // wins earned (all sources) over the trailing window
    const w = CFG.incomeWindowMin;
    const t0 = Math.max(0, minute - w);
    let lo = 0, hi = incomeSamples.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (incomeSamples[mid][0] < t0) lo = mid + 1;
      else hi = mid;
    }
    const [m0, c0] = incomeSamples[lo];
    const span = minute - m0;
    return span > 0.5 ? (winsEarned - c0) / span : null;
  }
  function wordRateNow(mode = 'chain') {
    return WINS.perWordRateNow({ mode: PAYOUT_KEY[mode], difficulty: CFG.difficulty[mode] });
  }
  function shopCandidates() {
    const c = [];
    c.push({ kind: 'key', id: `T${XP.getKeyTier() + 1}`, price: XP.keyTierCost(XP.getKeyTier()) });
    c.push({ kind: 'forge', id: `F${FORGE.forgeBuys() + 1}`, price: FORGE.forgeCost(FORGE.forgeBuys()) });
    const owned = new Set(SHOP.getOwned());
    for (const it of [...SHOP.POP_STYLES, ...SHOP.SOUND_PACKS]) if (it.price > 0 && !owned.has(it.id)) c.push({ kind: 'cosmetic', id: it.id, price: it.price });
    for (const t of THEMES.THEMES) if (t.price > 0 && !THEMES.isThemeOwned(t.id)) c.push({ kind: 'theme', id: t.id, price: t.price });
    return c;
  }
  function cheapestCosmetic() {
    const c = shopCandidates().filter((x) => x.kind === 'cosmetic' || x.kind === 'theme');
    return c.length ? c.reduce((a, b) => (b.price < a.price ? b : a)) : null;
  }
  function shop() {
    for (let guard = 0; guard < 10000; guard++) {
      const bal = WINS.getWins();
      const aff = shopCandidates().filter((x) => x.price <= bal);
      if (!aff.length) return;
      const it = aff.reduce((a, b) => (b.price < a.price ? b : a));
      const inc = incomePerMin();
      let ok = false;
      if (it.kind === 'key') ok = SHOP.buyKeyPower().ok;
      else if (it.kind === 'forge') ok = SHOP.buyForge().ok;
      else if (it.kind === 'cosmetic') {
        ok = SHOP.buy(it.id).ok;
        if (ok) SHOP.equip(it.id);
      } else if (it.kind === 'theme') ok = THEMES.buyTheme(it.id, { getWins: WINS.getWins, saveWins: WINS.saveWins }).ok;
      if (!ok) return;
      const secOfIncome = inc && inc > 0 ? (it.price / inc) * 60 : null;
      const p = { ...it, ...ctx(), incomePerMin: inc, secOfIncome, trivial: secOfIncome != null && secOfIncome < CFG.trivialSec };
      purchases.push(p);
      addEvent('buy-' + it.kind, `${it.kind.toUpperCase()} ${it.id}`, { price: it.price, trivial: p.trivial });
      if (allCosmeticsOwnedAt.minute == null && !cheapestCosmetic()) allCosmeticsOwnedAt.minute = minute;
    }
  }
  function onLevelReached(L) {
    // ranks (first-ever only)
    const r = RANK.rankTitle(L);
    if (!seenRanks.has(r)) {
      seenRanks.add(r);
      addEvent('rank', `RANK ${r}`);
    }
    for (const id of LADDER.grantUnlocks(L)) addEvent('frame', `FRAME ${id}`);
    for (const id of THEMES.syncThemeUnlocks(L)) addEvent('theme-free', `THEME ${id} (free)`);
    for (const mu of MODE_UNLOCKS) if (L >= mu.level && !seenModeUnlock.has(mu.id)) {
      seenModeUnlock.add(mu.id);
      addEvent('mode-unlock', `MODE ${mu.id}`);
    }
    const mt = TIER.menuTier(L, XP.getRebirths());
    if (mt > maxMenuTier) {
      maxMenuTier = mt;
      addEvent('menu-tier', `MENU TIER ${TIER.TIER_NAMES[mt]}`);
    }
    if (L > maxLevel) {
      maxLevel = L;
      for (const m of CFG.levelMarks) if (L >= m && !levelFirst[m]) levelFirst[m] = { minute, hours: minute / 60, words, rebirths: XP.getRebirths(), totalLevelUps, keyTier: XP.getKeyTier() };
      if (CFG.snapshotLevels.includes(L)) snapshots[L] = numbersAt(L);
      if (CFG.affordLevels.includes(L)) afford[L] = affordAt(L);
    }
  }
  function numbersAt(L) {
    const rate = wordRateNow('chain');
    const rateWb = wordRateNow('word-bomb');
    const needL = XP.need(L);
    return {
      level: L,
      minute,
      rebirths: XP.getRebirths(),
      keyTier: XP.getKeyTier(),
      forge: FORGE.forgeBuys(),
      stars: STARS.starsState().earned,
      xpToNextLevel: needL,
      xpPerWordChain: rate.xp,
      winsPerWordChain: rate.rate,
      xpPerWordWB: rateWb.xp,
      winsPerWordWB: rateWb.rate,
      wordsPerLevel: needL / ((rate.xp + rateWb.xp) / 2),
      winsBalance: WINS.getWins(),
      winsLifetime: WINS.getWinsLifetime(),
      nextKeyCost: XP.keyTierCost(XP.getKeyTier()),
      incomePerMin: incomePerMin(),
      rebirthMult: XP.rebirthMult(XP.getRebirths()),
      overMaxSafe: needL > Number.MAX_SAFE_INTEGER,
    };
  }
  function affordAt(L) {
    const inc = incomePerMin();
    const mk = (price) => {
      if (price == null || !Number.isFinite(price)) return { price: price ?? null, minutes: null, flag: price == null ? 'none-left' : 'maxed' };
      const minutes = inc > 0 ? price / inc : null;
      const flag = minutes == null ? '?' : minutes * 60 < CFG.trivialSec ? 'TRIVIAL' : minutes > CFG.wallMin ? 'WALL' : 'ok';
      return { price, minutes, flag };
    };
    const cc = cheapestCosmetic();
    const rbNext = XP.rebirthThreshold(XP.getRebirths());
    return {
      level: L,
      minute,
      rebirths: XP.getRebirths(),
      incomePerMin: inc,
      keyPower: { tier: XP.getKeyTier() + 1, ...mk(XP.keyTierCost(XP.getKeyTier())) },
      momentum: { count: FORGE.forgeBuys() + 1, ...mk(FORGE.forgeCost(FORGE.forgeBuys())) },
      cosmetic: cc ? { id: cc.id, ...mk(cc.price) } : { id: null, ...mk(null), ownedAllAtMin: allCosmeticsOwnedAt.minute },
      nextRebirthAt: rbNext,
    };
  }
  function bestMark() {
    const earned = ACH.loadEarned();
    const un = MARKS.unlockedMarks(earned);
    if (!un.length) return;
    let best = null, bestV = 0;
    // STEP 49: a mark's value is its MAIN bonus × its flavour, averaged over the mode mix.
    for (const m of un) {
      let v = 0;
      for (const [gm, share] of modePairs) v += share * ((MARKS.markWinsFactors({ markId: m.id, mode: PAYOUT_KEY[gm] }).mark || 1) * MARKS.markXpMult(m.id));
      if (v > bestV) (bestV = v), (best = m.id);
    }
    if (best && MARKS.getEquippedMark() !== best) MARKS.equipMark(best, earned);
  }
  function checkAch() {
    const newly = ACH.checkAchievements();
    for (const a of newly) addEvent('achievement', `ACH ${a.name}`, { wins: a.wins });
    // Oct 2: rewards are CLAIMED — the sim's player claims everything pending right away.
    for (const c of CLAIMS.listClaims()) if (c.kind === 'rank') addEvent('rank-claim', c.label, { wins: c.amount });
    CLAIMS.claimAll();
    bestMark();
  }

  // ---- one-time setup
  WPM.recordSession({ mode: 'chain', chars: arch.typingWpm * 5, ms: 60000 });
  const dayMs = (d) => Date.UTC(2026, 0, 1, 12) + d * 86400000;
  STREAK.recordStreakActivity(dayMs(0));
  onLevelReached(1);

  // ---- main loop: rounds of words
  let wordCountTotal = 0;
  while (minute < totalMin) {
    const mode = pickWeighted(rng, modePairs);
    const meanLen = CFG.roundLen[mode];
    const n = Math.max(3, Math.round(meanLen * (1 - CFG.roundLenJitter + 2 * CFG.roundLenJitter * rng())));
    let combo = COMBO.freshCombo();
    let weightSum = 0;
    const diff = CFG.difficulty[mode];
    const pkey = PAYOUT_KEY[mode];
    // FUSE FRENZY: this round lights the whole strip at a random word (or not).
    const frenzyAt = mode === 'fuse' && rng() < CFG.frenzyRunP ? 1 + Math.floor(rng() * n) : -1;
    for (let i = 1; i <= n && minute < totalMin; i++) {
      if (rng() < CFG.missRate) combo = COMBO.comboBreak(combo);
      // ---- the word
      let band, len, wid, rm;
      if (mode === 'sat-rush') {
        band = pickWeighted(rng, CFG.satBandMix);
        len = pickWeighted(rng, CFG.satLengthDist);
        wid = `sat${Math.floor(rng() * CFG.vocab.satDeck)}`;
        rm = RAR.satRarityMult(rarityMult(band, len));
      } else {
        len = pickWeighted(rng, CFG.lengthDist);
        if (rng() < CFG.vocab.obscureP) {
          band = RAR.OBSCURE_BAND.name;
          wid = `obs${Math.floor(rng() * CFG.vocab.obscurePool)}`;
        } else {
          const r = sampleCdf(zipf, rng());
          band = bandOfRank(r + 1);
          wid = `w${r}`;
        }
        rm = rarityMult(band, len);
      }
      combo = COMBO.comboAccept(combo);
      const lucky = LUCK.luckyReward(luckRng.next());
      const weight = XP.cappedWordMult(rm, combo.mult, lucky.winsWeight);
      let letters = '';
      for (let k = 0; k < len; k++) letters += pickWeighted(rng, LETTER_FREQ);
      const prevW = weightSum;
      weightSum += WINS.bankWeight(weight, letters);
      const before = XP.loadProgress().level;
      const res = WINS.awardWordXp({ mode, difficulty: diff, wordLength: len, weight, word: letters });
      WINS.bankWordWins({ mode: pkey, difficulty: diff, wordLength: len, prevWords: i - 1, nowWords: i, prevWeight: prevW, nowWeight: weightSum });
      if (res.mastery && res.mastery.leveledUp) addEvent('mastery', `MASTERY ${mode} M${res.mastery.level}`, { mode, mlevel: res.mastery.level });
      if (res.mark && res.mark.rankedUp) addEvent('mark-rank', `MARK ${res.mark.id} rank ${res.mark.rank}`);
      if (!distinct.has(wid)) {
        distinct.add(wid);
        if (distinct.size <= COLL.COLLECTION_CAP) COLL.recordAcceptedWord(wid, { mode, band });
      }
      const after = res.level;
      if (after > before) {
        const k = after - before;
        totalLevelUps += k;
        if (k > maxLevelsOneWord) maxLevelsOneWord = k;
        for (let L = before + 1; L <= after; L++) onLevelReached(L);
      }
      words++;
      if (rbTrack) {
        const lv = res.level;
        if (rbTrack.levelAfter1Word == null) rbTrack.levelAfter1Word = lv;
        if (rbTrack.levelAfter1Min == null && minute + dt - rbTrack.minute >= 1) rbTrack.levelAfter1Min = lv;
        if (rbTrack.minToPrevGate == null && lv >= rbTrack.levelAt) rbTrack.minToPrevGate = minute + dt - rbTrack.minute;
        if (rbTrack.levelAfter1Min != null && rbTrack.minToPrevGate != null) rbTrack = null;
      }
      if (i === frenzyAt) {
        const fz = FRENZY.startFrenzy();
        const bonus = Math.round(FRENZY.FRENZY_TRIGGER_WORDS * WINS.perWordWins({ mode: 'fuse' }));
        if (bonus > 0) WINS.grantWins(bonus, fz.started ? 'FRENZY!' : 'FULL STRIP', { mode: 'fuse' });
        if (fz.started) addEvent('frenzy', 'FRENZY');
      }
      wordCountTotal++;
      minute += dt;
      SIM_NOW += dt * 60000;
      dayMinLeft -= dt;
      if (snap30 == null && minute >= min30) snap30 = snapshotState();
    }
    // ---- round end
    rounds++;
    localStorage.setItem('wa_words', JSON.stringify({ v: 1, total: wordCountTotal, byMode: { 'word-bomb': 0, 'category-blitz': 0, 'sat-rush': 0 } }));
    const r = WINS.getRounds();
    if (r[pkey] != null) {
      /* bankWordWins already bumped it */
    }
    incomeSamples.push([minute, winsEarned]);
    if (rounds - lastAch >= CFG.achievementEveryRounds) {
      lastAch = rounds;
      checkAch();
    }
    // rebirth
    while (XP.loadProgress().level >= XP.rebirthThreshold(XP.getRebirths()) && !STARS.rebirthAdvice(XP.loadProgress().level, XP.getRebirths()).badTime) {
      const lvAt = XP.loadProgress().level;
      const { rc, stars } = STARS.rebirthWithStars();
      if (stars) addEvent('stars', `+${stars} STARS`);
      LADDER.grantRebirthUnlock(rc);
      rbTrack = { n: rc, minute, hours: minute / 60, levelAt: lvAt, mult: XP.rebirthMult(rc), keyTier: XP.getKeyTier(), day, levelAfter1Word: null, levelAfter1Min: null, minToPrevGate: null };
      rebirths.push(rbTrack);
      addEvent('rebirth', `REBIRTH ${rc} (x${fmt(XP.rebirthMult(rc))})`);
      const mt = TIER.menuTier(1, rc);
      if (mt > maxMenuTier) {
        maxMenuTier = mt;
        addEvent('menu-tier', `MENU TIER ${TIER.TIER_NAMES[mt]}`);
      }
      checkAch();
      // Spend stars: automation first, then the capped perks, then the uncapped STAR POWER.
      for (const id of ['autoKey', 'autoForge', 'frenzy', 'head', 'power', 'power', 'power', 'power']) {
        while (STARS.buyPerk(id, XP.getRebirths()).ok) {
          addEvent('perk', `PERK ${id}`);
          if (id === 'power') break;
        }
      }
    }
    shop();
    if (!series.length || series[series.length - 1][1] !== level() || minute - series[series.length - 1][0] > 30) series.push([+minute.toFixed(2), level(), maxLevel]);
    // new day
    if (dayMinLeft <= 0) {
      day++;
      dayMinLeft += arch.minPerDay;
      STREAK.recordStreakActivity(dayMs(day));
    }
  }
  if (snap30 == null) snap30 = snapshotState();
  checkAch();
  ledgerUnsub();
  const finalState = snapshotState();

  function snapshotState() {
    return {
      minute,
      hours: minute / 60,
      day,
      level: XP.loadProgress().level,
      highestLevel: maxLevel,
      totalLevelUps,
      rebirths: XP.getRebirths(),
      keyTier: XP.getKeyTier(),
      momentum: FORGE.forgeBuys(),
      stars: STARS.starsState().earned,
      starPerks: STARS.starsState().perks,
      wins: WINS.getWins(),
      winsLifetime: WINS.getWinsLifetime(),
      words,
      distinctWords: distinct.size,
      ownedCosmetics: SHOP.getOwned().length,
      ownedThemes: THEMES.THEMES.filter((t) => THEMES.isThemeOwned(t.id)).length,
      mastery: Object.fromEntries(MAST.MASTERY_MODES.map((m) => [m, MAST.masteryState(m).level])),
      achievements: ACH.loadEarned().length,
      equippedMark: MARKS.getEquippedMark(),
      incomePerMin: incomePerMin(),
    };
  }

  return { arch, events, purchases, rebirths, levelFirst, snapshots, afford, series, snap30, final: finalState, maxLevelsOneWord, allCosmeticsOwnedAt: allCosmeticsOwnedAt.minute, min30 };
}

// ----------------------------------------------------------------------------- ANALYSIS
function gapStats(events, endMinute, filter) {
  const ev = events.filter(filter);
  const gaps = [];
  let prev = { minute: 0, level: 1, rebirths: 0, label: 'START' };
  for (const e of ev) {
    gaps.push({ len: e.minute - prev.minute, startMin: prev.minute, endMin: e.minute, from: prev.label, to: e.label, levelAtEnd: e.level, rebirths: e.rebirths, keyTier: e.keyTier });
    prev = e;
  }
  gaps.push({ len: endMinute - prev.minute, startMin: prev.minute, endMin: endMinute, from: prev.label, to: '(end of sim — still waiting)', levelAtEnd: null, rebirths: prev.rebirths, open: true });
  const lens = gaps.filter((g) => g.len > 0).map((g) => g.len);
  const top = [...gaps].sort((a, b) => b.len - a.len).slice(0, 6);
  return { count: ev.length, median: pct(lens, 0.5), p90: pct(lens, 0.9), max: lens.reduce((a, b) => (b > a ? b : a), -Infinity), over10: gaps.filter((g) => g.len > 10).length, top, gaps };
}
const isMeaningful = () => true;
const isStrict = (e) => e.kind !== 'buy-forge' && !e.trivial;

function analyse(res) {
  const endAll = res.final.minute;
  const ev30 = res.events.filter((e) => e.minute <= res.min30);
  const out = {
    archetype: res.arch,
    timeToLevel: res.levelFirst,
    at30days: res.snap30,
    at200h: res.final,
    rebirths: res.rebirths,
    maxLevelsInOneWord: res.maxLevelsOneWord,
    allCosmeticsOwnedAtMin: res.allCosmeticsOwnedAt,
    momentumMaxedAtMin: (res.purchases.filter((x) => x.kind === 'momentum')[200 - 1] || {}).minute ?? null,
    gaps: {
      days30: { all: gapStats(ev30, res.min30, isMeaningful), strict: gapStats(ev30, res.min30, isStrict) },
      tail: { all: gapStats(res.events, endAll, isMeaningful), strict: gapStats(res.events, endAll, isStrict) },
    },
    firstEvents: res.events.slice(0, 80).map((e) => `${fmtMin(e.minute)} L${e.level} R${e.rebirths} T${e.keyTier} ${e.label}${e.price != null ? ' $' + fmt(e.price) : ''}${e.wins != null ? ' +' + fmt(e.wins) + 'w' : ''}`),
    eventCounts: res.events.reduce((m, e) => ((m[e.kind] = (m[e.kind] || 0) + 1), m), {}),
    purchases: {
      total: res.purchases.length,
      trivial: res.purchases.filter((p) => p.trivial).length,
      byKind: res.purchases.reduce((m, p) => ((m[p.kind] = (m[p.kind] || 0) + 1), m), {}),
      cosmetics: res.purchases.filter((p) => p.kind === 'cosmetic' || p.kind === 'theme').map((p) => ({ id: p.id, price: p.price, minute: p.minute, level: p.level, secOfIncome: p.secOfIncome })),
      keyTiers: res.purchases.filter((p) => p.kind === 'key').map((p) => ({ id: p.id, price: p.price, minute: p.minute, level: p.level, rebirths: p.rebirths, secOfIncome: p.secOfIncome })),
    },
    snapshots: res.snapshots,
    afford: res.afford,
    mastery: res.events.filter((e) => e.kind === 'mastery' && (e.mode === 'chain' || e.mode === 'fuse')).map((e) => ({ mode: e.mode, m: e.mlevel, minute: e.minute })),
  };
  // gap by level band (strict, tail)
  const bands = [[1, 25], [26, 50], [51, 75], [76, 100], [101, 125], [126, 150], [151, 1e9]];
  out.gapsByLevelBand = bands.map(([lo, hi]) => {
    const g = out.gaps.tail.strict.gaps.filter((x) => x.levelAtEnd != null && x.levelAtEnd >= lo && x.levelAtEnd <= hi).map((x) => x.len);
    return { band: `L${lo}-${hi > 1e8 ? '+' : hi}`, n: g.length, median: pct(g, 0.5), p90: pct(g, 0.9), max: g.length ? g.reduce((a, b) => (b > a ? b : a), -Infinity) : null };
  });
  out.series = res.series;
  out.strictGapPoints = out.gaps.tail.strict.gaps.map((g) => [g.endMin, g.len]);
  return out;
}

// ----------------------------------------------------------------------------- SVG
function svgChart({ title, series, xLog, yLog, xLabel, yLabel, xMin, xMax, yMin, yMax, refLines = [], scatter = false }) {
  const W = 900, H = 460, L = 70, R = 170, T = 40, B = 50;
  const pw = W - L - R, ph = H - T - B;
  const tx = (v) => L + pw * (xLog ? (Math.log10(Math.max(v, xMin)) - Math.log10(xMin)) / (Math.log10(xMax) - Math.log10(xMin)) : (v - xMin) / (xMax - xMin));
  const ty = (v) => T + ph - ph * (yLog ? (Math.log10(Math.max(v, yMin)) - Math.log10(yMin)) / (Math.log10(yMax) - Math.log10(yMin)) : (v - yMin) / (yMax - yMin));
  const colors = ['#d6336c', '#1c7ed6', '#e67700', '#2b8a3e', '#7048e8'];
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="monospace" font-size="12">`;
  s += `<rect width="${W}" height="${H}" fill="#fff"/><text x="${L}" y="22" font-size="15" font-weight="bold">${title}</text>`;
  const ticks = (lo, hi, log) => {
    if (log) {
      const o = [];
      for (let e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e++) if (10 ** e >= lo && 10 ** e <= hi) o.push(10 ** e);
      return o;
    }
    const step = Math.pow(10, Math.floor(Math.log10((hi - lo) / 5)));
    const st = (hi - lo) / step > 10 ? step * 2 : step;
    const o = [];
    for (let v = Math.ceil(lo / st) * st; v <= hi; v += st) o.push(v);
    return o;
  };
  for (const v of ticks(xMin, xMax, xLog)) s += `<line x1="${tx(v)}" x2="${tx(v)}" y1="${T}" y2="${T + ph}" stroke="#eee"/><text x="${tx(v)}" y="${T + ph + 16}" text-anchor="middle">${v}</text>`;
  for (const v of ticks(yMin, yMax, yLog)) s += `<line x1="${L}" x2="${L + pw}" y1="${ty(v)}" y2="${ty(v)}" stroke="#eee"/><text x="${L - 6}" y="${ty(v) + 4}" text-anchor="end">${v}</text>`;
  for (const rl of refLines) s += `<line x1="${L}" x2="${L + pw}" y1="${ty(rl.y)}" y2="${ty(rl.y)}" stroke="#888" stroke-dasharray="4 4"/><text x="${L + pw - 4}" y="${ty(rl.y) - 4}" text-anchor="end" fill="#666">${rl.label}</text>`;
  s += `<rect x="${L}" y="${T}" width="${pw}" height="${ph}" fill="none" stroke="#333"/>`;
  s += `<text x="${L + pw / 2}" y="${H - 10}" text-anchor="middle">${xLabel}</text><text transform="translate(16 ${T + ph / 2}) rotate(-90)" text-anchor="middle">${yLabel}</text>`;
  series.forEach((ser, i) => {
    const c = colors[i % colors.length];
    const pts = ser.points.filter(([x, y]) => x >= xMin && x <= xMax && (!yLog || y > 0));
    if (scatter) for (const [x, y] of pts) s += `<circle cx="${tx(x).toFixed(1)}" cy="${ty(Math.min(y, yMax)).toFixed(1)}" r="2.2" fill="${c}" fill-opacity="0.55"/>`;
    else if (pts.length) s += `<polyline fill="none" stroke="${c}" stroke-width="${ser.width || 1.5}" ${ser.dash ? `stroke-dasharray="${ser.dash}"` : ''} points="${pts.map(([x, y]) => `${tx(x).toFixed(1)},${ty(Math.min(y, yMax)).toFixed(1)}`).join(' ')}"/>`;
    s += `<rect x="${L + pw + 12}" y="${T + 6 + i * 20}" width="12" height="12" fill="${c}"/><text x="${L + pw + 30}" y="${T + 16 + i * 20}">${ser.name}</text>`;
  });
  return s + '</svg>';
}

// ----------------------------------------------------------------------------- RUN
// Each archetype runs in its OWN worker thread: a fresh copy of every live module (no shared module
// state such as the wins ledger or the collection cache) and wall time = the slowest archetype.
// --serial runs them in-process one after another instead.
if (!isMainThread) {
  const ts = Date.now();
  const r = simulate(workerData.arch);
  const out = analyse(r);
  out.simSeconds = (Date.now() - ts) / 1000;
  parentPort.postMessage(out);
  process.exit(0);
}
const t0 = Date.now();
let results;
if (args.serial) {
  results = CFG.archetypes.map((arch) => analyse(simulate(arch)));
} else {
  results = await Promise.all(
    CFG.archetypes.map(
      (arch) =>
        new Promise((resolve, reject) => {
          const w = new Worker(new URL(import.meta.url), { workerData: { arch }, argv: process.argv.slice(2) });
          w.once('message', resolve);
          w.once('error', reject);
        }),
    ),
  );
}
if (!QUIET) for (const r of results) console.error(`  simulated ${r.archetype.id}: ${r.at200h.words.toLocaleString()} words${r.simSeconds ? `, ${r.simSeconds.toFixed(1)}s` : ''}`);

// ---- static curve facts (straight from the modules)
const curve = {
  needAt: Object.fromEntries([1, 10, 30, 50, 75, 100, 125, 150, 200, 250, 300].map((L) => [L, XP.need(L)])),
  constants: { CURVE_BASE: XP.CURVE_BASE, CURVE_BREAK: XP.CURVE_BREAK, EARLY_CURVE_EXP: XP.EARLY_CURVE_EXP, TOP_CURVE_EXP: XP.TOP_CURVE_EXP, REBIRTH_MULT_BASE: XP.REBIRTH_MULT_BASE, MOMENTUM_BASE: FORGE.MOMENTUM_BASE, MOMENTUM_RATIO: FORGE.MOMENTUM_RATIO, MOMENTUM_MAX: 200, MASTERY_MAX: MAST.MASTERY_MAX, MASTERY_BASE: MAST.MASTERY_BASE, MASTERY_GROWTH: MAST.MASTERY_GROWTH },
  rebirthThresholds: Array.from({ length: 14 }, (_, i) => XP.rebirthThreshold(i)),
  // XP cost of the levels a rebirth asks you to re-climb vs the multiplier it pays
  rebirthEconomics: Array.from({ length: 13 }, (_, i) => {
    const lv = XP.rebirthThreshold(i);
    let sum = 0;
    for (let L = 1; L < lv; L++) sum += XP.need(L);
    return { rebirth: i + 1, gateLevel: lv, xpToClimb: sum, multAfter: XP.rebirthMult(i + 1), xpToClimbOverMult: sum / XP.rebirthMult(i) };
  }),
  keyTiers: Array.from({ length: 17 }, (_, t) => ({ tier: t, xpPerLetter: XP.keyTierXp(t), costToReach: XP.keyTierCostAt(t) })),
  masteryWordsToMax: MAST.masteryWordsToReach(MAST.MASTERY_MAX),
  masteryWordsTo: Object.fromEntries([2, 5, 10, 15, 20].map((l) => [l, MAST.masteryWordsToReach(l)])),
  cosmeticPrices: [...SHOP.POP_STYLES, ...SHOP.SOUND_PACKS].filter((i) => i.price > 0).map((i) => ({ id: i.id, price: i.price })),
  themePrices: THEMES.THEMES.map((t) => ({ id: t.id, price: t.price, freeAt: t.unlockLevel })),
};

// ----------------------------------------------------------------------------- PRINT
const lines = [];
const p = (s = '') => lines.push(s);
p(`TYPE A WORD — whole-economy sim [${TAG}]  (src: ${path.relative(REPO, SRC) || SRC})`);
p(`archetypes play daily; 30-day window + tail to ${CFG.tailHours}h total play. Run time ${((Date.now() - t0) / 1000).toFixed(1)}s.`);
p();
p('1) TIME TO FIRST REACH LEVEL (play time; rebirth resets counted)');
p('   level   ' + results.map((r) => r.archetype.id.padStart(26)).join(''));
for (const L of CFG.levelMarks) p(`   L${String(L).padEnd(6)}` + results.map((r) => { const f = r.timeToLevel[L]; return (f ? `${fmtMin(f.minute)} ${f.words}w R${f.rebirths} d${Math.floor(f.minute / r.archetype.minPerDay) + 1}` : 'never').padStart(26); }).join(''));
for (const k of ['at30days', 'at200h']) {
  p(`   ${k}: ` + results.map((r) => { const s = r[k]; return `${r.archetype.id} L${s.level} (max L${s.highestLevel}) R${s.rebirths} T${s.keyTier} mom${s.momentum} levelUps=${s.totalLevelUps}`; }).join(' | '));
}
p('   rebirths: R<n>@<play time> [level 1 word after the reset / 1 minute after / time to regain the level you left]:');
for (const r of results) {
  p(`     ${r.archetype.id}:`);
  p('       ' + r.rebirths.map((b) => `R${b.n}@${fmtMin(b.minute)}[L${b.levelAfter1Word ?? '?'}/L${b.levelAfter1Min ?? '?'}/${b.minToPrevGate != null ? fmtMin(b.minToPrevGate) : 'never'}]`).join(' '));
}
p();
p(`2) GAPS BETWEEN MEANINGFUL REWARD EVENTS (minutes of play). strict = no momentum, no <${CFG.trivialSec}s purchases`);
for (const r of results) for (const win of ['days30', 'tail']) for (const v of ['all', 'strict']) {
  const g = r.gaps[win][v];
  p(`   ${r.archetype.id.padEnd(8)} ${win.padEnd(6)} ${v.padEnd(6)} n=${String(g.count).padEnd(5)} median ${fmtMin(g.median).padEnd(7)} p90 ${fmtMin(g.p90).padEnd(7)} max ${fmtMin(g.max).padEnd(7)} gaps>10m: ${g.over10}`);
}
p('   longest STRICT gaps over the full tail:');
for (const r of results) for (const g of r.gaps.tail.strict.top.slice(0, 3)) p(`     ${r.archetype.id.padEnd(8)} ${fmtMin(g.len).padEnd(7)} from ${fmtMin(g.startMin)} [${g.from}] -> [${g.to}] (R${g.rebirths}${g.levelAtEnd ? ', L' + g.levelAtEnd : ''})`);
p('   strict gap by level band (median / p90 / max):');
for (const r of results) p(`     ${r.archetype.id.padEnd(8)} ` + r.gapsByLevelBand.map((b) => `${b.band}:${b.n ? `${fmtMin(b.median)}/${fmtMin(b.p90)}/${fmtMin(b.max)}` : '—'}`).join('  '));
p();
p(`3) AFFORDABILITY at first reach of L${CFG.affordLevels.join('/L')} (price / income → minutes; TRIVIAL <${CFG.trivialSec}s, WALL >${CFG.wallMin}m)`);
for (const r of results) for (const L of CFG.affordLevels) {
  const a = r.afford[L];
  if (!a) { p(`   ${r.archetype.id.padEnd(8)} L${L}: not reached`); continue; }
  const cell = (x, name) => `${name} ${x.price == null ? '(none left' + (x.ownedAllAtMin != null ? ' since ' + fmtMin(x.ownedAllAtMin) : '') + ')' : fmt(x.price) + ' = ' + fmtMin(x.minutes) + ' ' + x.flag}`;
  p(`   ${r.archetype.id.padEnd(8)} L${L} R${a.rebirths} income ${fmt(a.incomePerMin)}/min | ${cell(a.keyPower, 'KEY T' + a.keyPower.tier)} | ${cell(a.momentum, 'MOM#' + a.momentum.count)} | ${cell(a.cosmetic, 'COSMETIC')}`);
}
p('   sinks exhausted: ' + results.map((r) => `${r.archetype.id}: all cosmetics+themes owned at ${fmtMin(r.allCosmeticsOwnedAtMin)}, MOMENTUM ${200}/${200} at ${fmtMin(r.momentumMaxedAtMin)}`).join(' | '));
p();
p(`4) MAGNITUDES at first reach (flag > ${CFG.absurd.toExponential(0)}; '!!' = above MAX_SAFE_INTEGER)`);
for (const r of results) for (const L of CFG.snapshotLevels) {
  const s = r.snapshots[L];
  if (!s) continue;
  const f = (v) => (v > Number.MAX_SAFE_INTEGER ? '!!' : v > CFG.absurd ? '*' : '') + fmt(v);
  p(`   ${r.archetype.id.padEnd(8)} L${String(L).padEnd(4)} R${s.rebirths} T${s.keyTier}: need ${f(s.xpToNextLevel)} XP | XP/word ${f(s.xpPerWordChain)} | wins/word ${f(s.winsPerWordChain)} | words/level ${fmt(s.wordsPerLevel)} | balance ${f(s.winsBalance)} | next key ${f(s.nextKeyCost)}`);
}
p();
p(`5) MASTERY (MASTERY_MAX ${MAST.MASTERY_MAX}; words to max ${curve.masteryWordsToMax.toLocaleString()}; to M10 ${curve.masteryWordsTo[10].toLocaleString()})`);
for (const r of results) {
  const last = (m) => r.mastery.filter((x) => x.mode === m).slice(-1)[0];
  const at = (m, lv) => (r.mastery.find((x) => x.mode === m && x.m === lv) || {}).minute;
  for (const m of ['chain', 'fuse']) {
    const l = last(m);
    p(`   ${r.archetype.id.padEnd(8)} ${m.padEnd(5)} final M${r.at200h.mastery[m]} (30d M${r.at30days.mastery[m]}) | M5 ${fmtMin(at(m, 5))} M10 ${fmtMin(at(m, 10))} M15 ${fmtMin(at(m, 15))} M20 ${fmtMin(at(m, 20))} | last level-up ${l ? fmtMin(l.minute) : '—'}`);
  }
}
p();
p('CURVE FACTS: need(L): ' + Object.entries(curve.needAt).map(([L, v]) => `L${L} ${fmt(v)}`).join(', '));
p('  rebirth: XP to re-climb to the gate ÷ the PREVIOUS multiplier (= base-XP effort per rebirth):');
p('  ' + curve.rebirthEconomics.map((x) => `R${x.rebirth}@L${x.gateLevel}:${fmt(x.xpToClimbOverMult)}`).join('  '));
const report = lines.join('\n');
console.log(report);

// ----------------------------------------------------------------------------- WRITE
fs.mkdirSync(OUT, { recursive: true });
const json = {
  tag: TAG,
  generatedAt: new Date().toISOString(),
  config: CFG,
  curve,
  archetypes: results.map((r) => {
    const { series, strictGapPoints, ...rest } = r;
    // keep the JSON readable: drop the full gap lists, keep top gaps
    for (const w of ['days30', 'tail']) for (const v of ['all', 'strict']) delete rest.gaps[w][v].gaps;
    return { ...rest, levelSeries: series.filter((_, i) => i % Math.max(1, Math.floor(series.length / 600)) === 0) };
  }),
};
fs.writeFileSync(path.join(OUT, `${TAG}.json`), JSON.stringify(json, null, 1));
fs.writeFileSync(path.join(OUT, `${TAG}-console.txt`), report + '\n');

const xMinH = 0.05, xMaxH = CFG.tailHours;
fs.writeFileSync(
  path.join(OUT, `${TAG}-level-vs-time.svg`),
  svgChart({
    title: `Level vs play hours [${TAG}] — solid: current level, dashed: highest ever`,
    xLog: true, xMin: xMinH, xMax: xMaxH, yMin: 0, yMax: Math.max(160, ...results.map((r) => r.at200h.highestLevel)) + 10,
    xLabel: 'play hours (log)', yLabel: 'level',
    series: results.flatMap((r) => [
      { name: r.archetype.id, points: r.series.map(([m, l]) => [m / 60, l]) },
    ]),
  }),
);
fs.writeFileSync(
  path.join(OUT, `${TAG}-gaps.svg`),
  svgChart({
    title: `Strict gap length between meaningful rewards [${TAG}]`,
    xLog: true, yLog: true, xMin: xMinH, xMax: xMaxH, yMin: 0.01, yMax: 10000, scatter: true,
    xLabel: 'play hours at gap end (log)', yLabel: 'gap, minutes (log)',
    refLines: [{ y: 2, label: '2 min' }, { y: 10, label: '10 min target' }, { y: 60, label: '60 min' }],
    series: results.map((r) => ({ name: r.archetype.id, points: r.strictGapPoints.map(([m, g]) => [m / 60, Math.max(g, 0.011)]) })),
  }),
);
if (!QUIET) console.error(`\nwrote ${path.relative(REPO, path.join(OUT, TAG + '.json'))}, ${TAG}-console.txt, ${TAG}-level-vs-time.svg, ${TAG}-gaps.svg  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
