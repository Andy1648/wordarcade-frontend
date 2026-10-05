#!/usr/bin/env node
// loop-sim.mjs — PROGRESSION LOOP sim for TYPE A WORD ("when the progress system crashes, people
// don't get addicted"). Bot players at three skill levels play from a FRESH LV1 save through 20 h of
// play, word by word, against the REAL economy modules (src/progress/*.js) behind an in-memory
// localStorage shim. Nothing economic is re-implemented: every XP grant (wins.awardWordXp), wins
// bank (wins.bankWordWins), buy (shop.buyKeyPower / buyForge / buy), rebirth (stars.rebirthWithStars),
// achievement / rank / mark / collection claim (achievements.checkAchievements + claims.claimAll),
// FRENZY (frenzy.startFrenzy), BOOST (claims 'boost' handler → boost.startBoost) and per-level code
// (claims.claimAmount) goes through the shipped function. The sim clock drives Date.now.
//
//   node claude/econ-oct2/loop-sim.mjs                          # all skills, 20 h, writes loop-sim.json
//   SIM_SRC=../other/src node claude/econ-oct2/loop-sim.mjs     # another source tree
//   node claude/econ-oct2/loop-sim.mjs --skills=median --tag=probeA
//   SIM_PATCH='[["progress/forge.js","FORGE_PRICE_WORDS = 12","FORGE_PRICE_WORDS = 20"]]' node ... --tag=p1
//     (SIM_PATCH copies src to a temp dir and applies literal find→replace patches before import —
//      how a constant change is probed without touching the tree.)
//
// ----------------------------------------------------------------------------- MODEL (stated)
// SKILL (accepted words per minute of PLAY incl. round overhead; mean word length; vocabulary =
// top-N of words.recall.txt; share of off-corpus OBSCURE words; miss rate that breaks the combo;
// typing WPM recorded per solo run for the SPEED achievements; FUSE FRENZY rate per run):
//   casual  6 w/min, len 5, vocab 4k,  obscure 0.5%, miss 15%, 35 WPM, FRENZY 0.1% of FUSE runs
//   median 10 w/min, len 6, vocab 9k,  obscure 1.5%, miss 8%,  50 WPM, FRENZY 19.2% of FUSE runs
//   strong 16 w/min, len 7, vocab 20k, obscure 4%,   miss 4%,  75 WPM, FRENZY 98.9% (1.68 strips/run)
//   (FRENZY rates = claude/econ-oct2/frenzy-sim.txt AFTER rows, weak/median/strong bots.)
// RUN LENGTH (accepted words): FUSE 10/18/40 (frenzy-sim wordsPerRun), CHAIN 10/16/25 (ba1
// chain-sim p50 16), WORD BOMB 6/10/14 (per player per game). ±30% jitter.
// MODE MIX (share of runs): FUSE 35%, CHAIN 35%, WORD BOMB 30%, restricted to unlocked modes
// (gameData unlockLevel: CHAIN LV2, FUSE LV3). WB difficulty: 'chill' first game, then 'easy'
// (App.jsx SOLO_RETURNING_PRESET). FUSE CLUTCH: 5% of FUSE words (assumed; no measured rate).
// SESSION: 60 min of play per day (20 h = 20 days); streak recorded each day; the clock jumps to
// the next day between sessions (FRENZY/BOOST timers keep running in wall time, as in the app).
// POLICY (greedy but sensible), at every menu return (= round end):
//   1. check achievements (queues claims), CLAIM ALL at once, equip the best owned MARK.
//   2. REBIRTH as soon as level >= rebirthThreshold (no waiting out BAD TIME); spend ★:
//      AUTO-KEY, AUTO-FORGE, FRENZY+, HEAD START, then STAR POWER.
//   3. run AUTOMATION (as Homepage does), then buy the next KEY tier whenever affordable; otherwise
//      the cheapest affordable FORGE / cosmetic whose price is <= 25% of the next KEY price (so the
//      KEY savings are never blown on one cosmetic), repeat until nothing qualifies.
// CODES: a 1,000-wins per_level code is redeemed at 60 min, a BOOST ×3 / 10 min code at 300 min
// (claims.queueClaim exactly as leaderboard/client.js redeemCode does), claimed at the next menu.
// WORDS are real words from words.recall.txt (rarity via rarity.wordRarity over the real rank index;
// LETTER FORGE sees their real letters; Collection sees distinct real words).
// LETTER XP (PROGRESSION v11, amended oct3 18:15): GAME WORDS PAY WINS ONLY; the bar fills from LETTERS
// typed. In a tree that ships progress/letterXp.js, every accepted word credits the letters the bot typed
// for it — the word's length, plus the word's length again when the bot fumbled an attempt first (the
// SKILLS miss rate) — through letterXp.creditLetterXp at the live XP-per-letter (BASE 10 × KEY × rebirth ×
// the worn mark). RR anti-gibberish (trees with letterXp.creditAcceptedWordLetters): typed letters pay the
// menu ×0.2 share and awardWordXp tops the accepted word's own letters up to ×1 — a fumble stays at ×0.2. The 30-letters/s cap never binds at bot speed. A tree WITHOUT letterXp.js (main / v10)
// keeps its own word-XP path inside awardWordXp, so rule P compares the two models as shipped.
// PROGRESSION v11 METRICS (claude/econ-oct2/v11-spec.md): `v11.barPct` = the share of the CURRENT level
// each accepted game word moved the bar (credited ÷ need(level before)), by level band (≤50, 51–100 …
// 351–400): min / p10 / median. DEAD BAR = p10 < 0.2% in any band up to LV400. `v11.reclimb` = minutes
// to gain the first 10 levels of each climb (fresh start, then after every rebirth) — a re-climb must
// be FASTER than the first climb (the rebirth XP boost is a reward). `v11.pace` = MINUTES PER LEVEL at
// LV10 / 50 / 100 / 200 (the first time the level is reached: minutes from reaching L to reaching L+1 in
// the same climb). `v11.key` = KEY tier purchase times in the first hour (count, max gap) and the median
// XP-per-letter step a KEY buy gave (×1.2 = "+20% XP / LETTER").
// MENU MASHER (v11 round 2): a 4th bot that only types gibberish in the MENU at the shared letter cap
// (letterXp.LETTER_RATE_CAP letters every second; 30 on a tree without letterXp.js), earns no wins (so no KEY),
// rebirths at every gate and buys star perks like the others. Its cumulative level-ups are compared with the
// MEDIAN bot's at 10 / 30 / 60 / 300 / 1200 min (`masher` in the JSON, a `v11 MASHER` line in the console):
// PASS when it never beats the median by more than ×1.5. Menu letters use the shipped XP.xpPerInput.
// NOT MODELLED: menu typing XP for the three players, Category Blitz / SAT Rush / Word Race, returnBonus, theme worlds.
// -----------------------------------------------------------------------------------------------
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  return m ? [m[1], m[2] ?? true] : [a, true];
}));
let SRC = path.resolve(process.env.SIM_SRC || args.src || path.join(HERE, '..', '..', '..', 'sim-wt', 'src'));
const TAG = typeof args.tag === 'string' ? args.tag : 'base';
const HOURS = Number(args.hours) || 20;
const QUIET = !!args.quiet;

// ---- optional constant probes: copy src to a temp dir and patch literal strings
if (process.env.SIM_PATCH) {
  const patches = JSON.parse(process.env.SIM_PATCH);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'loopsim-'));
  fs.cpSync(SRC, path.join(tmp, 'src'), { recursive: true, filter: (p) => !/\.test\.js$|[\\/]assets[\\/]/.test(p) });
  for (const [file, find, repl] of patches) {
    const f = path.join(tmp, 'src', file);
    const t = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n'); // worktrees may be CRLF
    if (!t.includes(find)) throw new Error(`SIM_PATCH: "${find}" not found in ${file}`);
    fs.writeFileSync(f, t.split(find).join(repl));
  }
  SRC = path.join(tmp, 'src');
  process.on('exit', () => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* */ } });
}

// ----------------------------------------------------------------------------- STORAGE SHIM + CLOCK
function makeStore() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
    key: (i) => [...map.keys()][i] ?? null,
    get length() { return map.size; },
  };
}
globalThis.localStorage = makeStore();
const T0 = Date.UTC(2026, 0, 5, 14);
let SIM_NOW = T0;
Date.now = () => SIM_NOW;

const imp = (rel) => import(pathToFileURL(path.join(SRC, rel)).href);
const XP = await imp('progress/xp.js');
const WINS = await imp('progress/wins.js');
const SHOP = await imp('progress/shop.js');
const FORGE = await imp('progress/forge.js');
const FRENZY = await imp('progress/frenzy.js');
const BOOST = await imp('progress/boost.js');
const CLAIMS = await imp('progress/claims.js');
const STARS = await imp('progress/stars.js');
const MARKS = await imp('progress/marks.js');
const ACH = await imp('progress/achievements.js');
const COLL = await imp('progress/collection.js');
const STREAK = await imp('progress/streak.js');
const RANK = await imp('progress/rank.js');
const RAR = await imp('progress/rarity.js');
const COMBO = await imp('progress/combo.js');
const LUCK = await imp('progress/luck.js');
const WPM = await imp('progress/wpm.js');
const WC = await imp('wordCount.js');
const FMT = await imp('format.js');
const GAMEDATA = await imp('gameData.js');
// MARK ROLLS (claude/econ-oct2/marks-spec.md). Present only in trees that ship progress/markRolls.js,
// so compare.sh BEFORE (no engine) vs AFTER (engine) measures the rolls as a player would use them.
//   SIM_ROLLS=0        never roll (engine present but unused - the payout hook is then exactly x1)
//   SIM_ROLL_SHARE=0.2 share of every wins credit the bot earmarks for rolls (the rest: the normal shop)
//   SIM_SPEC_CUT=1     also apply the spec's achievement CUTS (keep only ACHIEVEMENT_PLAN 'keep')
// LETTER XP (v11 amended) — present only in trees that ship progress/letterXp.js.
const LX = fs.existsSync(path.join(SRC, 'progress', 'letterXp.js')) ? await imp('progress/letterXp.js') : null;
const MR = fs.existsSync(path.join(SRC, 'progress', 'markRolls.js')) && process.env.SIM_ROLLS !== '0' ? await imp('progress/markRolls.js') : null;
// THE MARK (rolls rework): ONE function, markRollsCore.markMult({ markId }) — the number wins AND XP per letter
// pay. Loaded on its own (not via MR) so SIM_ROLLS=0 still scores marks; absent in older trees.
const MRC = fs.existsSync(path.join(SRC, 'progress', 'markRollsCore.js')) ? await imp('progress/markRollsCore.js') : null;
const ROLL_SHARE = Number(process.env.SIM_ROLL_SHARE ?? 0.2);
// GEMS (Andy oct5) — present only in trees that ship progress/gems.js. Rolls cost GEMS there (wins never buy rolls),
// so the roll purse below is NOT earmarked from wins; the bot spends GEMS on rolls instead. Every gem source goes
// through the shipped functions: the word DROP (wins.awardWordXp), LEVEL UP (xp.saveProgress), REBIRTH
// (stars.rebirthWithStars), and the WB game result (gems.payGameResult, modelled below). The starting grant
// (gemsMigrate) runs once per bot so the LEVEL UP mark is stamped (a fresh save: 0 gems).
const GEMS = fs.existsSync(path.join(SRC, 'progress', 'gems.js')) ? await imp('progress/gems.js') : null;
const GEMS_MIG = GEMS && fs.existsSync(path.join(SRC, 'progress', 'gemsMigrate.js')) ? await imp('progress/gemsMigrate.js') : null;
// WB game results (assumed, no measured rate): the share of WB games WON per skill, and the share played with PEOPLE
// (3-player rooms: 2 rivals) rather than a bot. A people game won beats both; lost, it beats one half the time.
const WB_WIN = { casual: 0.35, median: 0.5, strong: 0.7, fast: 0.8 };
const WB_PEOPLE_SHARE = 0.25;
if (MR && process.env.SIM_SPEC_CUT === '1') {
  const keep = new Set(MR.KEPT_ACHIEVEMENTS);
  for (let i = ACH.ACHIEVEMENTS.length - 1; i >= 0; i--) if (!keep.has(ACH.ACHIEVEMENTS[i].id)) ACH.ACHIEVEMENTS.splice(i, 1);
}

// ----------------------------------------------------------------------------- WORDS
const recall = fs.readFileSync(path.join(SRC, 'solo', 'words.recall.txt'), 'utf8').split(' ').filter(Boolean);
const rankIndex = RAR.buildRarityIndex(recall);
const acceptOnly = fs.readFileSync(path.join(SRC, 'solo', 'words.accept.txt'), 'utf8').split(' ')
  .filter((w) => w && /^[a-z]+$/.test(w) && w.length >= 4 && !rankIndex.has(w));

const SKILLS = [
  { id: 'casual', wpm: 6, len: 5, vocab: 4000, obscure: 0.005, miss: 0.15, typing: 35, frenzyRunP: 0.001, strips: 1, runLen: { fuse: 10, chain: 10, 'word-bomb': 6 } },
  { id: 'median', wpm: 10, len: 6, vocab: 9000, obscure: 0.015, miss: 0.08, typing: 50, frenzyRunP: 0.192, strips: 1, runLen: { fuse: 18, chain: 16, 'word-bomb': 10 } },
  { id: 'strong', wpm: 16, len: 7, vocab: 20000, obscure: 0.04, miss: 0.04, typing: 75, frenzyRunP: 0.989, strips: 1.68, runLen: { fuse: 40, chain: 25, 'word-bomb': 14 } },
  // FAST (Andy oct5, the R100 row): the fastest honest player — 24 words a minute, long words, rebirths the moment the
  // gate allows and spends every win on KEY (the shared policy). Must stay within FAST_LIMIT × the median's rebirths,
  // and the board (020) must never clip it: its words at every rebirth ≥ WORDS_PER_RB × that rebirth.
  { id: 'fast', wpm: 24, len: 7, vocab: 20000, obscure: 0.05, miss: 0.02, typing: 100, frenzyRunP: 0.99, strips: 1.68, runLen: { fuse: 40, chain: 25, 'word-bomb': 14 } },
];
const MODE_MIX = [['fuse', 0.35], ['chain', 0.35], ['word-bomb', 0.3]];
const PAYOUT_KEY = { 'word-bomb': 'wordBomb', chain: 'chain', fuse: 'fuse' };
const UNLOCK = Object.fromEntries((GAMEDATA.GAMES || []).filter((g) => g.unlockLevel != null).map((g) => [g.id, g.unlockLevel]));
const CLUTCH_P = 0.05;
const SESSION_MIN = 60;
const CODE_PERLEVEL_AT = 60; // min
const CODE_BOOST_AT = 300; // min
const OTHER_BUY_FRACTION = 0.25; // buy a non-KEY item only if it costs <= this × the next KEY

const WINDOWS = [
  { id: '10m', a: 0, b: 10, maxGap: 0.75 },
  { id: '1h', a: 50, b: 70, maxGap: 3 },
  { id: '5h', a: 270, b: 330, maxGap: 8 },
  { id: '20h', a: HOURS * 60 - 90, b: HOURS * 60, maxGap: 12 },
];
const WALL_MIN = 15;
const RUNAWAY_LEVELS = 3;

const pct = (arr, p) => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)];
};
function pickWeighted(rng, pairs) {
  let r = rng() * pairs.reduce((s, p) => s + p[1], 0);
  for (const [v, w] of pairs) if ((r -= w) <= 0) return v;
  return pairs[pairs.length - 1][0];
}
function makeVocab(skill) {
  const byLen = new Map();
  for (const w of recall.slice(0, skill.vocab)) {
    if (!/^[a-z]+$/.test(w) || w.length < 3) continue;
    const L = Math.min(12, w.length);
    if (!byLen.has(L)) byLen.set(L, []);
    byLen.get(L).push(w);
  }
  const cdf = new Map();
  for (const [L, arr] of byLen) {
    const c = new Float64Array(arr.length);
    let acc = 0;
    for (let i = 0; i < arr.length; i++) c[i] = acc += 1 / Math.pow(i + 1, 0.9);
    for (let i = 0; i < arr.length; i++) c[i] /= acc;
    cdf.set(L, c);
  }
  return { byLen, cdf };
}
function sampleWord(rng, skill, V) {
  if (rng() < skill.obscure) return acceptOnly[Math.floor(rng() * acceptOnly.length)];
  // length ~ N(mean, 1.4) clamped 3..12
  const g = Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
  let L = Math.max(3, Math.min(12, Math.round(skill.len + 1.4 * g)));
  while (!V.byLen.has(L) && L > 3) L--;
  const arr = V.byLen.get(L);
  const c = V.cdf.get(L);
  const u = rng();
  let lo = 0, hi = c.length - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; if (c[m] < u) lo = m + 1; else hi = m; }
  return arr[lo];
}

// ----------------------------------------------------------------------------- ONE BOT
// REBIRTH RUSH (PROGRESSION-FINAL.md) — detected by xp.js REBIRTH_POWER. The LETTER FORGE is out of the payout
// formula there, so the bot never buys it (a dead purchase would only distort the targets).
const RR = Number.isFinite(XP.REBIRTH_POWER);
function simulate(skill, start = null) {
  globalThis.localStorage = makeStore();
  // OVERDRIVE (overdrive.js) and anything else that rolls through Math.random: seeded per bot, so a run repeats.
  Math.random = LUCK.mulberry32(4242 + skill.wpm * 31 + (Number(process.env.SIM_SEED) || 0) * 977);
  // --board: start from a REAL save (level, rebirths, KEY tier; the bar empty, no wins banked)
  if (start) {
    localStorage.setItem('taw.econ', '11');
    localStorage.setItem('taw.rebirths', String(start.rc));
    localStorage.setItem('taw.keytier', String(start.kt));
    localStorage.setItem('taw.records', JSON.stringify({ maxLevel: start.lv }));
    XP.saveProgress({ level: start.lv, frac: 0 });
  }
  SIM_NOW = T0;
  WINS.resetWinsLedger();
  WINS.consumePendingWinsStamp();
  // GEMS: a seeded drop rng, the starting grant (stamps the LEVEL UP mark), and a by-source tally
  const gemsBy = {};
  let gemsEarned = 0;
  let gemRolls = 0;
  let gemsOff = null;
  const gemTrail = [[0, 0]]; // [minute, cumulative gems earned (no starting grant)]
  if (GEMS) {
    GEMS.resetGemsLedger();
    GEMS.setGemRng(LUCK.mulberry32(9001 + skill.wpm * 37 + (Number(process.env.SIM_SEED) || 0) * 3571));
    if (GEMS_MIG) GEMS_MIG.migrateGems();
    gemsOff = GEMS.subscribeGemLedger((e) => {
      if (!e || e.reason === 'start') return;
      gemsBy[e.reason] = (gemsBy[e.reason] || 0) + e.amount;
      gemsEarned += e.amount;
    });
  }
  const rng = LUCK.mulberry32(1648 + skill.wpm * 7919 + (Number(process.env.SIM_SEED) || 0) * 104729);
  const V = makeVocab(skill);
  const totalMin = HOURS * 60;
  const dt = 1 / skill.wpm;

  let minute = 0;
  let day = 0;
  let sessionLeft = SESSION_MIN;
  let words = 0;
  let wbGames = 0;
  const good = []; // { t, kind, label }
  const lumps = []; // bonus credits
  const buys = [];
  const etaSamples = []; // { t, key, shop, forge, cosmetic }
  const mech = {};
  const levelTrail = []; // [t, cumulativeLevelUps]
  let levelUps = 0;
  const barPct = new Map(); // v11: band → [% of the level per word]
  const climbs = [{ rc: 0, t0: 0, startLevel: 1, to10: null }]; // v11: per climb, minutes to gain 10 levels
  // KEYBOARD ESCAPE (Andy oct3 19:54): one entry per RUN (a climb that ends in a rebirth) — its length, its
  // peak, and the minutes the LAST level took (the wall it ended on); plus % of a level per word BELOW the gate.
  const runs = [];
  let runT0 = 0;
  let lastLevelT = 0;
  let lastLevelMin = null;
  const inRunPct = [];
  let passOldWallAt = null; // minutes into the CURRENT run when the level passed the previous run's peak
  const PACE_LEVELS = [10, 50, 100, 200]; // v11: minutes per level here, first time reached
  const pace = {};
  let paceStart = {};
  const keyXpSteps = []; // v11: XP-per-letter after / before each KEY buy
  const letterRate = () => (LX ? LX.letterXpNow() : null);
  let winsAll = 0;
  let winsWord = 0;
  const incomeTrail = [[0, 0, 0]]; // [t, winsAll, winsWord]
  const seenRanks = new Set([RANK.rankTitle(1)]);
  const extremes = { balance: 0, lifetime: 0, keyPrice: 0, forgePrice: 0, cosmeticPrice: 0, rate: 0, xpPerWord: 0, need: 0, lump: 0 };
  // PV10: the first minute the CURRENT level reaches each milestone (rebirth resets count against it)
  const REACH = [50, 100, 150, 225, 300, 400, 600, 1000];
  const firstReach = {};
  let maxLevel = 1;
  const windowState = {};
  let codesDone = { perLevel: false, boost: false };
  let lastLumpCtx = null;

  // Reference per-word wins NOW (mode-mix average of perWordRateNow, 5-letter COMMON word, every
  // permanent multiplier; FRENZY/BOOST excluded by using the base factors) and the measured ratio
  // of real word wins to that reference (combo/rarity/lucky/forge/frenzy uplift) — so a lump can be
  // priced in MINUTES OF PLAY without the lag of a trailing income window.
  const refMix = () => MODE_MIX.reduce((s, [m, sh]) => {
    const r = WINS.perWordRateNow({ mode: PAYOUT_KEY[m], difficulty: m === 'word-bomb' ? 'easy' : undefined });
    const f = r.factors || {};
    return s + sh * r.rate / ((f.frenzy || 1) * (f.boost || 1));
  }, 0);
  let refSum = 0;
  // ---- MARK ROLLS state (only when MR)
  const rollRng = LUCK.mulberry32(77 + skill.wpm * 131 + (Number(process.env.SIM_SEED) || 0) * 7717);
  let purse = 0;
  const rollLog = [];
  const refWordsTrail = []; // [t, trailing income per minute in reference words at the CURRENT rate]
  const achTimes = {};
  const sub = WINS.subscribeWins((e) => {
    winsAll += e.amount;
    if (MR && !GEMS && e.amount > 0 && rollsOpen()) purse += e.amount * ROLL_SHARE; // GEMS trees: wins never buy rolls
    if (e.kind === 'word') winsWord += e.amount;
    else {
      const ref = refMix();
      const uplift = refSum > 0 ? winsWord / refSum : 1;
      const minutesNow = e.amount / (ref * uplift * skill.wpm);
      lumps.push({ t: minute, amount: e.amount, label: e.label, level: XP.loadProgress().level, ctx: lastLumpCtx, refWins: ref, uplift, wordsWorth: e.amount / ref, minutesNow });
      if (e.amount > extremes.lump) extremes.lump = e.amount;
    }
  });
  const lv = () => XP.loadProgress().level;
  const addGood = (kind, label) => good.push({ t: minute, kind, label });
  const firstAt = (k, extra) => { if (!mech[k]) mech[k] = { t: +minute.toFixed(2), level: lv(), rebirths: XP.getRebirths(), ...extra }; };

  function trailing(arr, span, idx) {
    const t0 = Math.max(0, minute - span);
    let i = arr.length - 1;
    while (i > 0 && arr[i - 1][0] >= t0) i--;
    const [ta] = arr[i];
    const dtm = minute - ta;
    if (dtm < 0.5) return null;
    return (arr[arr.length - 1][idx] - arr[i][idx]) / dtm;
  }
  const incomeAll = () => trailing(incomeTrail, 10, 1);
  const incomeWord = () => trailing(incomeTrail, 10, 2);
  const levelsPerMin = () => trailing(levelTrail.length ? levelTrail : [[0, 0]], 15, 1);

  function forgeOpen() { return CLAIMS.layerOpen('forge') || FORGE.forgeBuys() > 0; }
  function cosmetics() {
    const owned = new Set(SHOP.getOwned());
    return [...SHOP.POP_STYLES, ...SHOP.SOUND_PACKS].filter((it) => it.price > 0 && !owned.has(it.id));
  }
  function refRate() { return WINS.perWordRateNow({ mode: 'fuse' }); }
  function shop() {
    for (let guard = 0; guard < 5000; guard++) {
      const bal = WINS.getWins() - (MR ? Math.min(purse, WINS.getWins()) : 0);
      const kCost = XP.keyTierCost(XP.getKeyTier());
      const before = refRate().xp;
      if (bal >= kCost) {
        const lr0 = letterRate();
        const r = SHOP.buyKeyPower();
        if (!r.ok) return;
        if (lr0) keyXpSteps.push(letterRate() / lr0);
        const after = refRate().xp;
        buys.push({ t: minute, kind: 'KEY', id: `T${r.tier}`, price: kCost, level: lv(), rateStep: after / before });
        addGood('buy', `KEY T${r.tier}`);
        continue;
      }
      const cands = [];
      if (!RR && forgeOpen()) cands.push({ kind: 'FORGE', id: `F${FORGE.forgeBuys() + 1}`, price: FORGE.forgeCost(FORGE.forgeBuys()) });
      for (const it of cosmetics()) cands.push({ kind: 'COSMETIC', id: it.id, price: it.price });
      const ok = cands.filter((c) => c.price <= bal && c.price <= OTHER_BUY_FRACTION * kCost);
      if (!ok.length) return;
      const it = ok.reduce((a, b) => (b.price < a.price ? b : a));
      const r = it.kind === 'FORGE' ? SHOP.buyForge() : SHOP.buy(it.id);
      if (!r.ok) return;
      const after = refRate().xp;
      buys.push({ t: minute, kind: it.kind, id: it.id, price: it.price, level: lv(), rateStep: after / before });
      addGood('buy', `${it.kind} ${it.id}`);
    }
  }
  function rollsOpen() {
    return MR && (lv() >= MR.ROLL_UNLOCK_LEVEL || XP.getRebirths() > 0);
  }
  function oneRoll(starter) {
    const L = lv();
    const r0 = refMix();
    const res = MR.rollAndSave(rollRng, { boost: BOOST.isBoostActive() });
    // INDEX milestone lumps, priced in words at the live rate (MARKS v2: milestones are LUCK only → 0)
    if (res.milestones.length) {
      lastLumpCtx = 'index';
      for (const id of res.milestones) {
        const w = MR.milestoneWins(id, MR.refWordWins());
        if (w > 0) WINS.grantWins(w, `INDEX ${id}`, { detail: 'index' });
      }
      lastLumpCtx = null;
    }
    // MARKS v2 INDEX rewards: a NEW mark, a ★ level-up, a completed tier — words at your rate (markRollShop pays
    // the same through buyMarkRoll; the bot rolls through rollAndSave, so it pays them here)
    if (typeof MR.indexRewardWins === 'function') {
      const w = MR.indexRewardWins(res, MR.refWordWins());
      if (w > 0) {
        lastLumpCtx = 'index';
        WINS.grantWins(w, 'MARKS INDEX', { detail: 'index' });
        lastLumpCtx = null;
      }
    }
    // Andy M6 (REVISED, PR #156 review): any roll whose MAIN is HIGHER than the worn MAIN auto-equips
    // (always when nothing is worn); a sidegrade does nothing. The bot's bestMark() below keeps the best by value
    let worn = null;
    try { worn = localStorage.getItem('taw.mark'); } catch { worn = null; }
    if (MR.shouldAutoEquip(res.markId, worn)) {
      const m = MR.rollMarkById(res.markId);
      if (m.legacy) MARKS.equipMark(res.markId, ACH.loadEarned()); else MR.equipRolled(res.markId);
    }
    bestMark();
    const step = refMix() / r0;
    const g = XP.need(L + 1) / XP.need(L);
    rollLog.push({ t: +minute.toFixed(2), level: L, rebirths: XP.getRebirths(), markId: res.markId, tier: res.tier, pity: res.pityHit, bonus: res.bonusRoll, luck: +res.luck.toFixed(3), step: +step.toFixed(4), curveLevels: +(Math.log(step) / Math.log(g)).toFixed(2), starter: !!starter, newMark: res.newMark, goldUp: res.goldUp, rainbowUp: res.rainbowUp, pipUp: !!res.pipUp, pips: res.pips, copies: res.copies });
    // RULE-P GAP METRIC (Andy oct3, decision 5): a roll is a "good event" when it is a NEW mark (first
    // copy), a GOLD step-up, or a RAINBOW step-up — each is a visible moment the player gets. A plain dupe
    // (perk +10% of base, no new badge) is not. Recorded under kind 'mark' so GOOD_KINDS counts them.
    if (res.newMark) addGood('mark', `ROLL ${res.tier} ${res.markId}`);
    if (res.goldUp) addGood('mark', `ROLL GOLD ${res.markId} (G${res.gold})`);
    if (res.rainbowUp) addGood('mark', `ROLL RAINBOW ${res.markId} (R${res.rainbow})`);
    if (res.pipUp) addGood('mark', `ROLL ★${res.pips} ${res.markId}`); // MARKS v2: a ★ pip replaces GOLD / RAINBOW
    return res;
  }
  function doRolls() {
    if (!rollsOpen()) return;
    const st = MR.ensureRollState();
    if (!st.starter) {
      // the MARKS unlock gives ONE free roll (spec section 3) - the system's own x2 moment
      firstAt('rollsOpen', {});
      oneRoll(true);
      const s2 = MR.loadRollState();
      MR.saveRollState({ ...s2, starter: true });
    }
    // MARKS v2 (no ×10): the AUTO ROLL habit — once the purse can pay ~AUTO_ROLL_AFFORD rolls, auto-roll until an
    // EPIC-or-better (or the purse runs dry), one roll at a time — markRollShop.autoRoll({ until: 'epic' }) as a
    // player taps it. Older trees (no v2 engine) keep the old roll-whenever-affordable loop.
    // GEMS trees: the bot rolls whenever it can pay 10 GEMS, one roll at a time (gems.spendGems — the shop's door)
    if (GEMS) {
      for (let guard = 0; guard < 100000; guard++) {
        if (!GEMS.spendGems(GEMS.ROLL_PRICE_GEMS)) return;
        gemRolls++;
        oneRoll(false);
      }
      return;
    }
    const v2 = typeof MR.pityLadder === 'function';
    const AUTO_ROLL_AFFORD = 10;
    let streak = false;
    for (let guard = 0; guard < 10000; guard++) {
      const price = MR.rollPriceNow(lv());
      const bal = WINS.getWins();
      if (purse < price || bal < price) return;
      if (v2 && !streak && (purse < AUTO_ROLL_AFFORD * price || bal < AUTO_ROLL_AFFORD * price)) return;
      streak = true;
      WINS.saveWins(bal - price);
      purse -= price;
      const res = oneRoll(false);
      if (v2 && res && ['epic', 'legendary', 'mythic', 'secret'].includes(res.tier)) streak = false; // the hit stops it
    }
  }
  function bestMark() {
    const earned = ACH.loadEarned();
    const un = MARKS.unlockedMarks(earned);
    if (!un.length) return;
    let best = null, bestV = 0;
    // A mark's value: MARKS v2 — its STRENGTH (markRollsCore.mainMultOf: the stat's equivalent multiplier, what the
    // game's auto-equip compares); else markRollsCore.markMult (one MARK on wins AND XP) when the tree has it; else
    // the old per-mode wins factor × markXpMult (guarded — the rolls rework removed markXpMult).
    const markValue = (id) => {
      if (MRC && typeof MRC.statOf === 'function') return MRC.mainMultOf(id);
      if (MRC && typeof MRC.markMult === 'function') return MRC.markMult({ markId: id });
      let v = 0;
      for (const [gm, share] of MODE_MIX) {
        const xpM = typeof MARKS.markXpMult === 'function' ? MARKS.markXpMult(id) : 1;
        v += share * ((MARKS.markWinsFactors({ markId: id, mode: PAYOUT_KEY[gm] }).mark || 1) * xpM);
      }
      return v;
    };
    for (const m of un) {
      const v = markValue(m.id);
      if (v > bestV) { bestV = v; best = m.id; }
    }
    // MARK ROLLS: a worn NEW rolled id pays its tier MAIN (no marks.js perk); compare like for like.
    let rolledBest = null;
    if (MR) {
      const st = MR.loadRollState();
      if (st) for (const id of Object.keys(st.marks)) {
        const m = MR.rollMarkById(id);
        if (!m || m.legacy) continue;
        const v = MRC && typeof MRC.markMult === 'function' ? markValue(id) : MR.mainMultOf(id);
        if (v > bestV) { bestV = v; best = id; rolledBest = id; }
      }
    }
    let worn = null;
    try { worn = localStorage.getItem('taw.mark'); } catch { worn = null; }
    if (best && worn !== best) {
      if (rolledBest === best) MR.equipRolled(best); else MARKS.equipMark(best, earned);
      firstAt('markEquipped', { mark: best });
    }
  }
  function menuReturn() {
    lastLumpCtx = 'claim';
    const newly = ACH.checkAchievements();
    for (const a of newly) { addGood('achievement', `ACH ${a.name}`); if (achTimes[a.id] == null) achTimes[a.id] = +minute.toFixed(1); }
    for (const c of CLAIMS.listClaims()) {
      if (c.kind === 'rank') addGood('rank', c.label);
      if (c.kind === 'mark') { addGood('mark', c.label); firstAt('mark', { mark: c.detail }); }
      if (c.kind === 'boost') firstAt('boost', {});
      if (c.kind === 'layer') addGood('layer', c.label);
    }
    CLAIMS.claimAll();
    lastLumpCtx = null;
    bestMark();
    // rebirth at the gate
    while (lv() >= XP.rebirthThreshold(XP.getRebirths())) {
      const at = lv();
      const runMin = minute - runT0;
      runs.push({ rc: XP.getRebirths(), words, min: +runMin.toFixed(2), peak: at, lastLevelMin: lastLevelMin == null ? null : +lastLevelMin.toFixed(2), keyTier: XP.getKeyTier(), passOldWallShare: passOldWallAt == null || runMin <= 0 ? null : +(passOldWallAt / runMin).toFixed(3) });
      passOldWallAt = null;
      runT0 = minute;
      lastLevelT = minute;
      lastLevelMin = null;
      const { rc, stars } = STARS.rebirthWithStars();
      climbs.push({ rc, t0: minute, startLevel: lv(), to10: null }); // v11 re-climb clock
      paceStart = {}; // a rebirth cuts any level-in-progress timing short
      addGood('rebirth', `REBIRTH ${rc} (from LV${at}, +${stars}★)`);
      firstAt('rebirth', { fromLevel: at });
      for (const id of RR ? ['autoKey', 'frenzy', 'head'] : ['autoKey', 'autoForge', 'frenzy', 'head', 'power', 'power', 'power', 'power']) {
        while (STARS.buyPerk(id, XP.getRebirths()).ok) { if (id === 'power') break; }
      }
      lastLumpCtx = 'claim';
      ACH.checkAchievements();
      for (const c of CLAIMS.listClaims()) if (c.kind === 'mark') { addGood('mark', c.label); firstAt('mark', { mark: c.detail }); }
      CLAIMS.claimAll();
      lastLumpCtx = null;
      bestMark();
    }
    {
      // AUTOMATION (Homepage runs it on every menu return) — its buys are buys too.
      const kt0 = XP.getKeyTier();
      const fb0 = FORGE.forgeBuys();
      const r0 = refRate().xp;
      // the roll purse is not the automation's to spend: set it aside while AUTO-KEY / AUTO-FORGE run
      const held = MR ? Math.min(purse, WINS.getWins()) : 0;
      if (held > 0) WINS.saveWins(WINS.getWins() - held);
      const lrA = letterRate();
      const res = STARS.runAutomation({ buyKey: SHOP.buyKeyPower, buyForge: SHOP.buyForge });
      if (lrA && XP.getKeyTier() > kt0) keyXpSteps.push(Math.pow(letterRate() / lrA, 1 / (XP.getKeyTier() - kt0)));
      if (held > 0) WINS.saveWins(WINS.getWins() + held);
      const step = refRate().xp / r0;
      for (let t = kt0 + 1; t <= XP.getKeyTier(); t++) { buys.push({ t: minute, kind: 'KEY', id: `T${t}`, price: XP.keyTierCostAt(t), level: lv(), rateStep: step, auto: true }); addGood('buy', `AUTO-KEY T${t}`); }
      if (FORGE.forgeBuys() > fb0) { buys.push({ t: minute, kind: 'FORGE', id: `F${fb0 + 1}..F${FORGE.forgeBuys()}`, price: 0, level: lv(), rateStep: XP.getKeyTier() > kt0 ? 1 : step, auto: true }); addGood('buy', `AUTO-FORGE ×${res.forges}`); }
    }
    if (MR) { doRolls(); const inc0 = incomeAll(); if (inc0 != null) refWordsTrail.push([minute, inc0 / MR.refWordWins()]); }
    shop();
    // ETA sample: minutes of play to afford the next KEY / next shop item at the trailing income
    const inc = incomeAll();
    if (inc && inc > 0 && minute >= 1) {
      // the roll purse is not KEY money: an ETA counts only what the shop may spend (marks.md caveat)
      const bal = WINS.getWins() - (MR ? Math.min(purse, WINS.getWins()) : 0);
      const eta = (p) => Math.max(0, p - bal) / inc;
      const key = eta(XP.keyTierCost(XP.getKeyTier()));
      const forge = forgeOpen() ? eta(FORGE.forgeCost(FORGE.forgeBuys())) : null;
      const cos = cosmetics();
      const cosmetic = cos.length ? eta(Math.min(...cos.map((c) => c.price))) : null;
      const shopEta = Math.min(...[forge, cosmetic].filter((x) => x != null));
      etaSamples.push({ t: minute, key, forge, cosmetic, shop: Number.isFinite(shopEta) ? shopEta : null, level: lv(), tier: XP.getKeyTier() });
    }
    // extremes for the formatter check
    { const cl = lv(); if (cl > maxLevel) maxLevel = cl; for (const L of REACH) if (cl >= L && firstReach[L] == null) firstReach[L] = +minute.toFixed(1); }
    extremes.balance = Math.max(extremes.balance, WINS.getWins());
    extremes.lifetime = Math.max(extremes.lifetime, WINS.getWinsLifetime());
    extremes.keyPrice = Math.max(extremes.keyPrice, XP.keyTierCost(XP.getKeyTier()));
    extremes.forgePrice = Math.max(extremes.forgePrice, FORGE.forgeCost(FORGE.forgeBuys()));
    const cos = cosmetics();
    if (cos.length) extremes.cosmeticPrice = Math.max(extremes.cosmeticPrice, Math.max(...cos.map((c) => c.price)));
    const rr = refRate();
    extremes.rate = Math.max(extremes.rate, rr.rate);
    extremes.xpPerWord = Math.max(extremes.xpPerWord, rr.xp);
    extremes.need = Math.max(extremes.need, XP.need(lv()));
    incomeTrail.push([minute, winsAll, winsWord]);
  }
  function snapshot() {
    const rr = refRate();
    return {
      t: +minute.toFixed(1), level: lv(), rebirths: XP.getRebirths(), keyTier: XP.getKeyTier(), forge: FORGE.forgeBuys(),
      mark: MARKS.getEquippedMark(), stars: STARS.starsState().earned, balance: WINS.getWins(), lifetime: WINS.getWinsLifetime(),
      winsPerMin: incomeAll(), fuseWordWins: rr.rate, words,
    };
  }

  // ---- setup
  STREAK.recordStreakActivity(SIM_NOW);
  const wi = WINDOWS.map((w) => ({ ...w, done: false }));

  while (minute < totalMin) {
    // codes (redeemed in the shop → claimed at the next menu return)
    if (!codesDone.perLevel && minute >= CODE_PERLEVEL_AT) {
      codesDone.perLevel = true;
      // the 010 docs' example per_level code: wins 30 (R10: × level; K2: 30 words at your rate)
      const code = { id: 'code:SIMLEVEL', kind: 'code', label: 'CODE — SIM PER LEVEL', amount: 30, meta: { perLevel: true } };
      mech.perLevelCode = { t: +minute.toFixed(2), level: lv(), pays: CLAIMS.claimAmount(code) };
      CLAIMS.queueClaim(code);
    }
    if (!codesDone.boost && minute >= CODE_BOOST_AT) {
      codesDone.boost = true;
      CLAIMS.queueClaim({ id: 'code:SIMBOOST', kind: 'boost', label: 'BOOST — SIM', amount: 0, meta: { mult: 3, min: 10 } });
    }
    const level = lv();
    const modes = MODE_MIX.filter(([m]) => level >= (UNLOCK[m] || 0));
    const mode = pickWeighted(rng, modes);
    const pkey = PAYOUT_KEY[mode];
    const n = Math.max(3, Math.round(skill.runLen[mode] * (0.7 + 0.6 * rng())));
    const diff = mode === 'word-bomb' ? (wbGames++ === 0 ? 'chill' : 'easy') : undefined;
    let combo = COMBO.freshCombo();
    const lucky = LUCK.makeLuckyOracle((rng() * 0xffffffff) >>> 0 || 1);
    let weightSum = 0;
    // FRENZY strips: which words in this FUSE run complete the a–z strip
    const stripAt = new Set();
    if (mode === 'fuse' && rng() < skill.frenzyRunP) {
      const k = skill.strips > 1 && rng() < skill.strips - 1 ? 2 : 1;
      for (let s = 0; s < k; s++) stripAt.add(Math.max(1, Math.round(n * (0.45 + 0.5 * rng()) * (s + 1) / k)));
    }
    let chars = 0;
    for (let i = 1; i <= n && minute < totalMin; i++) {
      const missed = rng() < skill.miss;
      if (missed) {
        if (!(rng() < MARKS.markComboKeep())) combo = COMBO.comboBreak(combo);
      }
      const word = sampleWord(rng, skill, V);
      let rw = RAR.wordRarity(word, rankIndex);
      if (rng() < MARKS.markRarityStep()) rw = RAR.bumpRarity(rw);
      combo = COMBO.comboAccept(combo);
      const lk = LUCK.luckyReward(lucky.next());
      const w = XP.cappedWordMult(rw.mult, combo.mult, lk.winsWeight);
      const prevW = weightSum;
      weightSum += WINS.bankWeight(w, word);
      const before = lv();
      // v11 (amended): the LETTERS typed for this word fill the bar (a fumbled attempt is letters too).
      // RR anti-gibberish: in a tree with creditAcceptedWordLetters, TYPED letters (the word + a fumble) pay the
      // menu share (×0.2) and awardWordXp tops the ACCEPTED word's letters up to full — so a fumble pays ×0.2,
      // the word's own letters ×1. An older tree credits every typed letter at full, as it shipped.
      const topUpTree = !!(LX && typeof LX.creditAcceptedWordLetters === 'function');
      const share = topUpTree && Number.isFinite(XP.MENU_LETTER_SHARE) ? XP.MENU_LETTER_SHARE : 1;
      const typed = word.length + (missed ? word.length : 0);
      const lx = LX ? LX.creditLetterXp(typed, { mode, perLetter: share < 1 ? LX.letterXpNow() * share : undefined }) : null;
      const topUpXp = topUpTree ? XP.roundWordXp(word.length * LX.letterXpNow() * (1 - share)) : 0;
      lastLumpCtx = 'mastery';
      const res = WINS.awardWordXp({ mode, difficulty: diff, wordLength: word.length, weight: w, word });
      lastLumpCtx = null;
      const after = lv();
      {
        // the bar movement of this word as a share of the level it landed on (letters, or main's word XP)
        const wordBar = Number.isFinite(res.credited) ? res.credited : LX ? topUpXp : res.gain;
        const pctW = (((lx && lx.xp) || 0) + wordBar) / XP.need(before) * 100;
        if (Number.isFinite(pctW) && before < XP.rebirthThreshold(XP.getRebirths())) inRunPct.push(pctW);
        if (after > before) { lastLevelMin = minute - lastLevelT; lastLevelT = minute; }
        if (passOldWallAt == null && runs.length && after > runs[runs.length - 1].peak) passOldWallAt = minute - runT0;
        if (before <= 400 && Number.isFinite(pctW)) {
          const band = Math.max(50, Math.ceil(before / 50) * 50);
          if (!barPct.has(band)) barPct.set(band, []);
          barPct.get(band).push(pctW);
        }
        const c = climbs[climbs.length - 1];
        if (c.to10 == null && after >= c.startLevel + 10) c.to10 = +(minute - c.t0).toFixed(3);
        for (const L of PACE_LEVELS) {
          if (pace[L] != null) continue;
          if (paceStart[L] != null && after > L) pace[L] = +(minute - paceStart[L]).toFixed(3);
          else if (paceStart[L] == null && before < L && after === L) paceStart[L] = minute;
        }
      }
      // feat/wb-bonus-boost: pkey 'wordBomb' is a WEIGHTED mode (wins.js WEIGHTED_MODES), so a WB word banks its
      // rarity x combo x lucky weight (the BOOST word bonus); CHAIN / FUSE ignore the weight and pay by count.
      WINS.bankWordWins({ mode: pkey, difficulty: diff, wordLength: word.length, prevWords: i - 1, nowWords: i, prevWeight: prevW, nowWeight: weightSum });
      if (mode === 'word-bomb') WC.addWords('word-bomb');
      COLL.recordAcceptedWord(word, { mode, band: rw.band });
      if (res.mark && res.mark.rankedUp) addGood('mark', `MARK RANK ${res.mark.rank}`);
      if (after > before) {
        const k = after - before;
        levelUps += k;
        addGood('level', `LV${after}`);
        for (let L = before + 1; L <= after; L++) {
          const r = RANK.rankTitle(L);
          if (!seenRanks.has(r)) { seenRanks.add(r); addGood('rank', `RANK ${r}`); }
        }
        levelTrail.push([minute, levelUps]);
      }
      refSum += refMix();
      if (words === 0) firstAt('weeklyBoard', { note: 'first accepted word → on the weekly board' });
      words++;
      chars += word.length;
      if (mode === 'fuse') {
        lastLumpCtx = 'fuse-bonus';
        if (rng() < CLUTCH_P) {
          const cb = Math.round(FRENZY.CLUTCH_WORDS * WINS.perWordWins({ mode: 'fuse' }));
          if (cb > 0) WINS.grantWins(cb, 'CLUTCH!', { mode: 'fuse', detail: 'clutch' });
        }
        if (stripAt.has(i)) {
          const fz = FRENZY.startFrenzy();
          const bonus = Math.round(FRENZY.FRENZY_TRIGGER_WORDS * WINS.perWordWins({ mode: 'fuse' }));
          if (bonus > 0) WINS.grantWins(bonus, fz.started ? 'FRENZY!' : 'FULL STRIP', { mode: 'fuse', detail: 'frenzy' });
          if (fz.started) { firstAt('frenzy', {}); addGood('frenzy', 'FRENZY'); }
        }
        lastLumpCtx = null;
      }
      minute += dt;
      SIM_NOW += dt * 60000;
      sessionLeft -= dt;
      for (const w of wi) if (!w.done && minute >= w.b) { w.done = true; windowState[w.id] = snapshot(); }
    }
    if (mode !== 'word-bomb') WPM.recordSession({ mode, chars: skill.typing * 5, ms: 60000 });
    // GEMS: the WB game's result (a bot game, or WB_PEOPLE_SHARE of the time a 3-player people game), paid through
    // the shipped gems.payGameResult — BOT_WIN / PER_PLAYER_BEATEN and the win streak.
    if (GEMS && mode === 'word-bomb') {
      const iWon = rng() < (WB_WIN[skill.id] ?? 0.5);
      const people = rng() < WB_PEOPLE_SHARE;
      const rivals = people
        ? [{ id: 'p1', isBot: false, beaten: iWon }, { id: 'p2', isBot: false, beaten: iWon || rng() < 0.5 }]
        : [{ id: 'bot', isBot: true, beaten: iWon }];
      GEMS.payGameResult({ key: `sim-wb-${wbGames}`, iWon, rivals, mode: 'word-bomb' });
    }
    if (GEMS) gemTrail.push([minute, gemsEarned]);
    menuReturn();
    if (BOOST.isBoostActive() && !mech.boostLive) mech.boostLive = { t: +minute.toFixed(2), level: lv() };
    if (sessionLeft <= 0 && minute < totalMin) {
      day++;
      sessionLeft += SESSION_MIN;
      SIM_NOW = T0 + day * 86400000;
      STREAK.recordStreakActivity(SIM_NOW);
    }
  }
  for (const w of wi) if (!w.done) windowState[w.id] = snapshot();
  sub();
  if (gemsOff) gemsOff();
  if (GEMS) GEMS.setGemRng(null);
  // GEMS summary: earned (no starting grant) per minute of play → rolls per minute at ROLL_PRICE_GEMS, by source,
  // overall and per window (first 10 min, the first hour, the last hour)
  let gems = null;
  if (GEMS) {
    const at = (t) => { let v = 0; for (const [m, g] of gemTrail) { if (m <= t) v = g; else break; } return v; };
    const price = GEMS.ROLL_PRICE_GEMS;
    const span = (a, b) => { const g = at(b) - at(a); return { gemsPerMin: +(g / (b - a)).toFixed(2), rollsPerMin: +(g / price / (b - a)).toFixed(3) }; };
    gems = {
      earned: gemsEarned,
      gemsPerMin: +(gemsEarned / totalMin).toFixed(2),
      rollsPerMin: +(gemsEarned / price / totalMin).toFixed(3),
      minPerRoll: gemsEarned > 0 ? +(totalMin * price / gemsEarned).toFixed(2) : null,
      bySourcePerMin: Object.fromEntries(Object.entries(gemsBy).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, +(v / totalMin).toFixed(2)])),
      byShare: Object.fromEntries(Object.entries(gemsBy).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, +(v / Math.max(1, gemsEarned)).toFixed(3)])),
      windows: { '0-10m': span(0, Math.min(10, totalMin)), '0-60m': span(0, Math.min(60, totalMin)), lastHour: span(Math.max(0, totalMin - 60), totalMin) },
      rollsBought: gemRolls,
      balanceEnd: GEMS.getGems(),
      constants: { dropChance: GEMS.GEM_DROP_CHANCE, dropMin: GEMS.GEM_DROP_MIN, dropMax: GEMS.GEM_DROP_MAX, botWin: GEMS.BOT_WIN, perPlayerBeaten: GEMS.PER_PLAYER_BEATEN, streakPerWin: GEMS.STREAK_PER_WIN, levelUp: GEMS.LEVEL_UP, rebirth: GEMS.REBIRTH, price },
    };
  }

  // ---- MEASURES
  const GOOD_KINDS = new Set(['level', 'buy', 'mark', 'achievement', 'rank', 'rebirth']);
  const gt = good.filter((g) => GOOD_KINDS.has(g.kind)).map((g) => g.t);
  const times = [0, ...gt, totalMin];
  const gaps = [];
  for (let i = 1; i < times.length; i++) gaps.push({ a: times[i - 1], b: times[i], len: times[i] - times[i - 1] });
  const keyIntervals = [];
  {
    const kb = buys.filter((b) => b.kind === 'KEY');
    let prev = 0;
    for (const b of kb) { keyIntervals.push({ a: prev, b: b.t, len: b.t - prev, tier: b.id }); prev = b.t; }
    keyIntervals.push({ a: prev, b: totalMin, len: totalMin - prev, tier: `T${XP.getKeyTier() + 1}`, open: true });
  }
  // STRICT view: the same events minus LETTER FORGE buys (+5% on one letter each, ~+1% income).
  const st = [0, ...good.filter((g) => GOOD_KINDS.has(g.kind) && !/FORGE/.test(g.label)).map((g) => g.t), totalMin];
  const strictGaps = [];
  for (let i = 1; i < st.length; i++) strictGaps.push({ a: st[i - 1], b: st[i], len: st[i] - st[i - 1] });
  const perWindow = {};
  for (const w of WINDOWS) {
    const g = gaps.filter((x) => x.b > w.a && x.a < w.b && x.len > 0);
    const lens = g.map((x) => x.len);
    const worst = g.reduce((m, x) => (!m || x.len > m.len ? x : m), null);
    const inW = (t) => t >= w.a && t < w.b;
    const eta = etaSamples.filter((s) => inW(s.t) && s.t >= 5); // projections are noise in the first minutes
    const worstKey = eta.reduce((m, s) => (!m || s.key > m.key ? s : m), null);
    const worstShop = eta.filter((s) => s.shop != null).reduce((m, s) => (!m || s.shop > m.shop ? s : m), null);
    const kI = keyIntervals.filter((x) => x.b > w.a && x.a < w.b).reduce((m, x) => (!m || x.len > m.len ? x : m), null);
    const sg = strictGaps.filter((x) => x.b > w.a && x.a < w.b && x.len > 0);
    const sWorst = sg.reduce((m, x) => (!m || x.len > m.len ? x : m), null);
    const kinds = {};
    for (const x of good) if (inW(x.t) && GOOD_KINDS.has(x.kind)) kinds[x.kind] = (kinds[x.kind] || 0) + 1;
    perWindow[w.id] = {
      window: [w.a, w.b], gapLimitMin: w.maxGap,
      maxGapMin: worst ? +worst.len.toFixed(2) : null, maxGapAt: worst ? [+worst.a.toFixed(2), +worst.b.toFixed(2)] : null,
      p90GapMin: lens.length ? +pct(lens, 0.9).toFixed(2) : null, events: kinds,
      gapPass: worst ? worst.len <= w.maxGap : true,
      strictMaxGapMin: sWorst ? +sWorst.len.toFixed(2) : null, strictP90GapMin: sg.length ? +pct(sg.map((x) => x.len), 0.9).toFixed(2) : null, strictMaxGapAt: sWorst ? [+sWorst.a.toFixed(2), +sWorst.b.toFixed(2)] : null,
      levelsGained: good.filter((x) => x.kind === 'level' && inW(x.t)).length,
      worstKeyEtaMin: worstKey ? +worstKey.key.toFixed(2) : null, worstKeyAt: worstKey ? { t: +worstKey.t.toFixed(1), tier: worstKey.tier, level: worstKey.level } : null,
      worstShopEtaMin: worstShop ? +worstShop.shop.toFixed(2) : null, worstShopAt: worstShop ? { t: +worstShop.t.toFixed(1), level: worstShop.level } : null,
      keyRealisedMin: kI ? +kI.len.toFixed(2) : null, keyRealisedAt: kI ? { from: +kI.a.toFixed(1), to: +kI.b.toFixed(1), tier: kI.tier, open: !!kI.open } : null,
      wallPass: (!kI || kI.len <= WALL_MIN) && (!worstShop || worstShop.shop <= WALL_MIN),
      state: windowState[w.id],
    };
  }
  // NO WALL over the whole run
  const allKey = etaSamples.reduce((m, s) => (!m || s.key > m.key ? s : m), null);
  const allShop = etaSamples.filter((s) => s.shop != null).reduce((m, s) => (!m || s.shop > m.shop ? s : m), null);
  // KEY realised: minutes between consecutive KEY buys
  const keyBuys = buys.filter((b) => b.kind === 'KEY');
  let keyRealised = null;
  for (let i = 0; i < keyBuys.length; i++) {
    const prev = i ? keyBuys[i - 1].t : 0;
    const d = keyBuys[i].t - prev;
    if (!keyRealised || d > keyRealised.min) keyRealised = { min: +d.toFixed(2), tier: keyBuys[i].id, at: +keyBuys[i].t.toFixed(1) };
  }
  const tailKey = { min: +(totalMin - (keyBuys.length ? keyBuys[keyBuys.length - 1].t : 0)).toFixed(2), tier: `T${XP.getKeyTier() + 1}`, note: 'still unbought at end' };
  if (!keyRealised || tailKey.min > keyRealised.min) keyRealised = tailKey;
  // RUNAWAY: lump credits in levels' worth = (amount / trailing word-wins income) × trailing levels/min
  // — evaluated with the income/levels samples at the time of the lump.
  const levelRate = (t) => {
    const t0 = Math.max(0, t - 15);
    const a = levelTrail.filter((x) => x[0] >= t0 && x[0] <= t);
    const before = levelTrail.filter((x) => x[0] < t0);
    const base = before.length ? before[before.length - 1][1] : 0;
    const last = a.length ? a[a.length - 1][1] : base;
    const span = Math.max(1, t - t0);
    return (last - base) / span;
  };
  const wordIncome = (t) => {
    const t0 = Math.max(0, t - 10);
    let i = 0;
    while (i < incomeTrail.length - 1 && incomeTrail[i][0] < t0) i++;
    let j = incomeTrail.length - 1;
    while (j > 0 && incomeTrail[j][0] > t) j--;
    const span = Math.max(1, incomeTrail[j][0] - incomeTrail[i][0]);
    return (incomeTrail[j][2] - incomeTrail[i][2]) / span;
  };
  const lumpEval = lumps.map((l) => {
    const minutes = Number.isFinite(l.minutesNow) ? l.minutesNow : null;
    const lr = (levelRate(Math.min(totalMin, l.t + 15)) + levelRate(l.t)) / 2; // levels/min around the lump
    const lvl = minutes != null ? minutes * lr : null;
    return { t: +l.t.toFixed(2), label: l.label, amount: l.amount, level: l.level, wordsWorth: +l.wordsWorth.toPrecision(3), fail: lvl != null && lvl > RUNAWAY_LEVELS && minutes > 3, minutesOfPlay: minutes != null ? +minutes.toPrecision(3) : null, levelsWorth: lvl != null ? +lvl.toFixed(2) : null };
  });
  const isDev = (l) => false && l; // no dev codes simulated
  const runawayList = lumpEval.filter((l) => !isDev(l) && l.levelsWorth != null).sort((a, b) => b.levelsWorth - a.levelsWorth);
  const buyStep = buys.map((b) => {
    const L = b.level;
    const g = XP.need(L + 1) / XP.need(L);
    return { ...b, t: +b.t.toFixed(2), rateStep: +b.rateStep.toFixed(3), curveLevels: +(Math.log(b.rateStep) / Math.log(g)).toFixed(2) };
  }).sort((a, b) => b.curveLevels - a.curveLevels);

  // v11 summary: bar movement per band + re-climb speed
  const bands = {};
  let deadBar = false;
  for (const [b, arr] of [...barPct.entries()].sort((x, y) => x[0] - y[0])) {
    const srt = [...arr].sort((x, y) => x - y);
    const q = (p) => srt[Math.min(srt.length - 1, Math.floor(p * srt.length))];
    bands[b] = { n: srt.length, min: +srt[0].toPrecision(3), p10: +q(0.1).toPrecision(3), p50: +q(0.5).toPrecision(3) };
    if (q(0.1) < 0.2) deadBar = true;
  }
  const first10 = climbs[0].to10;
  const reclimb = climbs.map((c) => ({ rc: c.rc, start: +c.t0.toFixed(1), startLevel: c.startLevel, minTo10: c.to10, vsFirst: first10 && c.to10 != null ? +(c.to10 / first10).toFixed(3) : null }));
  const kb = buys.filter((b) => b.kind === 'KEY');
  const firstHour = kb.filter((b) => b.t <= 60).map((b) => b.t);
  let maxGap = 0;
  for (let i = 0, prev = 0; i < firstHour.length; i++) { maxGap = Math.max(maxGap, firstHour[i] - prev); prev = firstHour[i]; }
  const steps = [...keyXpSteps].sort((a, b) => a - b);
  const key = { firstHourBuys: firstHour.length, firstHourMaxGapMin: +maxGap.toFixed(2), firstHourTimes: firstHour.map((t) => +t.toFixed(1)), medianXpStep: steps.length ? +steps[Math.floor(steps.length / 2)].toFixed(3) : null };
  const upsAt = {};
  for (const T of MASHER_CHECKS) {
    let u = 0;
    for (const [tm, c] of levelTrail) { if (tm <= T) u = c; else break; }
    upsAt[T] = u;
  }
  const srtIn = [...inRunPct].sort((a, b) => a - b);
  const qIn = (p) => (srtIn.length ? +srtIn[Math.min(srtIn.length - 1, Math.floor(p * srtIn.length))].toPrecision(3) : null);
  const early = runs.map((r) => r.min).slice(0, 3);
  const ke = {
    runs,
    inRunBar: { n: srtIn.length, p1: qIn(0.01), p10: qIn(0.1), p50: qIn(0.5), pass: srtIn.length > 0 && qIn(0.1) >= 0.4 },
    earlyRebirthMin: early,
    earlyPass: early.length >= 1 && early.every((m) => m >= 15 && m <= 90),
    // PROGRESSION-FINAL TARGETS (median: first rebirth ~2 min, run 5 ~3, run 10 ~4, run 20 ~12 min, ~36 rebirths
    // in 10 h; casual ~31, strong ~41; the old wall passed ~17% into a run; no R > 80 in 10 h)
    target: {
      run1: runs[0] ? runs[0].min : null,
      run5: runs[4] ? runs[4].min : null,
      run10: runs[9] ? runs[9].min : null,
      run20: runs[19] ? runs[19].min : null,
      rebirthsBy10h: runs.filter((r, i) => runs.slice(0, i + 1).reduce((a, x) => a + x.min, 0) <= 600).length,
      passOldWallMedian: (() => { const v = runs.map((r) => r.passOldWallShare).filter((x) => x != null).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : null; })(),
      maxR: XP.getRebirths(),
    },
    furtherShare: runs.length > 1 ? +(runs.slice(1).filter((r, i) => r.peak > runs[i].peak).length / (runs.length - 1)).toFixed(3) : null,
  };
  const v11 = { ke, pace, key, upsAt, barPct: bands, deadBar, firstClimbTo10: first10, reclimb, reclimbFasterShare: reclimb.length > 1 ? +(reclimb.slice(1).filter((c) => c.vsFirst != null && c.vsFirst < 1).length / Math.max(1, reclimb.slice(1).filter((c) => c.vsFirst != null).length)).toFixed(3) : null };

  return {
    skill: skill.id, words, levelUps, perWindow, v11,
    wall: { worstKeyEta: allKey && { min: +allKey.key.toFixed(2), t: +allKey.t.toFixed(1), tier: allKey.tier, level: allKey.level }, worstShopEta: allShop && { min: +allShop.shop.toFixed(2), t: +allShop.t.toFixed(1), level: allShop.level }, keyRealised },
    runaway: { failCount: lumpEval.filter((l) => l.fail).length, codes: lumpEval.filter((l) => /^CODE|^BOOST/.test(l.label)), worstByMinutes: [...lumpEval].filter((l) => l.minutesOfPlay != null).sort((a, b) => b.minutesOfPlay - a.minutesOfPlay).slice(0, 15), worstLumps: runawayList.slice(0, 12), worstBuys: buyStep.slice(0, 8), lumpCount: lumps.length },
    early: { lumps: lumpEval.filter((l) => l.t < 15), buys: buys.filter((b) => b.t < 15).map((b) => ({ ...b, t: +b.t.toFixed(2) })), good: good.filter((g) => g.t < 15).map((g) => [+g.t.toFixed(2), g.kind, g.label]) },
    mechanics: mech, extremes, final: snapshot(),
    counts: Object.fromEntries([...new Set(good.map((g) => g.kind))].map((k) => [k, good.filter((g) => g.kind === k).length])),
    rebirthTimes: good.filter((g) => g.kind === 'rebirth').map((g) => [+g.t.toFixed(1), g.label]),
    keyTimes: keyBuys.map((b) => [+b.t.toFixed(1), b.id, b.level]),
    firstReach, maxLevel, achTimes,
    rolls: MR ? summariseRolls(rollLog, totalMin, refWordsTrail) : null,
    gems,
  };
}

// ----------------------------------------------------------------------------- ROLL SUMMARY
function summariseRolls(log, totalMin, refTrail = []) {
  const paid = log.filter((r) => !r.starter);
  const perHour = [];
  for (let h = 0; h < totalMin / 60; h++) perHour.push(paid.filter((r) => r.t >= h * 60 && r.t < (h + 1) * 60).length);
  const first = (pred) => { const r = paid.find(pred); return r ? { t: r.t, roll: paid.indexOf(r) + 1, level: r.level, mark: r.markId, pity: r.pity } : null; };
  const tiers = {};
  for (const r of paid) tiers[r.tier] = (tiers[r.tier] || 0) + 1;
  const worst = [...log].sort((a, b) => b.curveLevels - a.curveLevels);
  const worstPaid = [...paid].sort((a, b) => b.curveLevels - a.curveLevels);
  return {
    refWordsPerMinByHour: perHour.map((_, h) => { const a = refTrail.filter((x) => x[0] >= h * 60 && x[0] < (h + 1) * 60).map((x) => x[1]); const s = [...a].sort((x, y) => x - y); return s.length ? +s[Math.floor(s.length / 2)].toFixed(1) : null; }),
    paidRolls: paid.length, perHour, meanPerHour: +(paid.length / (totalMin / 60)).toFixed(1),
    firstHour: perHour[0], tiers,
    firstEpic: first((r) => r.tier === 'epic' || r.tier === 'legendary'), firstLegendary: first((r) => r.tier === 'legendary'),
    pityEpic: paid.filter((r) => r.pity === 'epic').length, pityLegendary: paid.filter((r) => r.pity === 'legendary').length,
    golds: paid.filter((r) => r.goldUp).length, rainbows: paid.filter((r) => r.rainbowUp).length,
    pipUps: paid.filter((r) => r.pipUp).length,
    starter: log.find((r) => r.starter) || null,
    maxStepPaid: worstPaid[0] || null, overThreeLevels: paid.filter((r) => r.curveLevels > 3).length,
    log,
    worst: worst.slice(0, 8),
  };
}

// ----------------------------------------------------------------------------- FORMAT CHECK
function formatCheck(results) {
  const bad = /NaN|Infinity|undefined|e\+|e-|\d{5,}/;
  const rows = [];
  const check = (label, v, fn = FMT.formatNum, name = 'formatNum') => {
    const out = fn(v);
    rows.push({ label, value: v, fn: name, out, ok: !bad.test(out) && out.length <= 9 });
  };
  for (const r of results) for (const [k, v] of Object.entries(r.extremes)) {
    check(`${r.skill} ${k}`, v);
    if (k === 'rate') check(`${r.skill} rate (formatRate)`, v, FMT.formatRate, 'formatRate');
  }
  for (const v of [9999, 9999.6, 10000, 999950, 999999, 1e15, 1e30, 1e100, 1e300, 9.99e299, 1.2345e300, 1e303]) check(`synthetic ${v}`, v);
  for (const v of [1.05, 2.5, 11, 1e15, 1e300]) check(`mult ${v}`, v, FMT.formatMult, 'formatMult');
  for (const v of [10.1, 1234.5, 1e15, 1e300]) check(`rate ${v}`, v, FMT.formatRate, 'formatRate');
  return rows;
}

// ----------------------------------------------------------------------------- MENU MASHER (v11 round 2)
const MASHER_CHECKS = [10, 30, 60, 300, 1200];
const MASHER_LIMIT = 1.5;
function simulateMasher(hours) {
  globalThis.localStorage = makeStore();
  SIM_NOW = T0;
  WINS.resetWinsLedger();
  const cap = LX && Number.isFinite(LX.LETTER_RATE_CAP) ? LX.LETTER_RATE_CAP : 30;
  const totalSec = Math.min(hours, 20) * 3600;
  let ups = 0;
  const upsAt = {};
  let gain = null; // XP for one menu letter, re-read after every rebirth (the only thing that changes it)
  const lvl = () => XP.loadProgress().level;
  for (let sec = 0; sec < totalSec; sec++) {
    const minute = sec / 60;
    for (const T of MASHER_CHECKS) if (upsAt[T] == null && minute >= T) upsAt[T] = ups;
    if (gain == null) gain = XP.xpPerInput({ mode: 'menu', markMult: LX ? LX.markXpBoost() : 1 });
    const before = XP.loadProgress();
    const res = XP.creditXp(before, cap * gain);
    XP.saveProgress(res.state);
    if (res.level > before.level) ups += res.level - before.level;
    while (lvl() >= XP.rebirthThreshold(XP.getRebirths())) {
      STARS.rebirthWithStars();
      for (const id of RR ? ['autoKey', 'frenzy', 'head'] : ['autoKey', 'autoForge', 'frenzy', 'head', 'power', 'power', 'power', 'power']) {
        while (STARS.buyPerk(id, XP.getRebirths()).ok) { if (id === 'power') break; }
      }
      gain = null;
    }
    SIM_NOW += 1000;
  }
  return { cap, upsAt, rebirths: XP.getRebirths(), level: lvl(), menuLetterXp: gain };
}

// ----------------------------------------------------------------------------- BOARD (--board)
// Every REAL board save (the live board, oct3 19:50: level + rebirths; KEY tier is not on the board, so a
// stand-in T = 8 + R), played by the MEDIAN bot for --hours. TODAY = the minutes a level takes them on the
// live v10 curve (claude/econ-oct2/v10-existing-players.md, median pace by level band).
const BOARD = [
  ['snapplemelon', 195, 4], ['Xavi', 168, 8], ['elol', 156, 7], ['Daan', 144, 9], ['Tangie', 126, 10],
  ['maSON_im_cRYAN', 119, 8], ['creator', 118, 6], ['ford', 21, 0], ['NoBuffCookies', 17, 7], ['jamal', 16, 0],
  ['twinkletoes', 15, 0], ['InnerCityBoy', 1, 5], ['Joseph', 1, 6],
];
const todayMinPerLevel = (lv) => (lv >= 225 ? 38 : lv >= 150 ? 22 : lv >= 100 ? 13 : lv >= 50 ? 7 : 2);
if (args.board) {
  const med = SKILLS.find((x) => x.id === 'median');
  console.log(`=== BOARD SAVES (median bot, ${HOURS} h each; KEY stand-in T = 8 + R)`);
  let allOk = true;
  const EM = RR ? await imp('progress/econMigrate.js') : null;
  for (const [name, lv0, rc0] of BOARD) {
    const kt = 8 + rc0;
    // Rebirth Rush: the one-time conversion first (levels past the gate → rebirths, LV1)
    const conv = EM && EM.rebirthRushConvert ? EM.rebirthRushConvert(lv0, rc0) : { level: lv0, rebirths: rc0, added: 0 };
    const lv = conv.level;
    const rc = conv.rebirths;
    if (conv.added) console.log(`  ${name.padEnd(15)} CONVERTED LV${lv0} R${rc0} → LV${lv} R${rc} (+${conv.added} rebirths)`);
    const gate = XP.rebirthThreshold(rc);
    const r = simulate(med, { lv, rc, kt });
    const firstRun = r.v11.ke.runs[0];
    const levelsFirstHour = r.v11.upsAt[60];
    const todayPerHour = 60 / todayMinPerLevel(lv0);
    const canNow = lv >= gate;
    const faster = levelsFirstHour > todayPerHour;
    const ok = faster && r.v11.ke.inRunBar.pass !== false;
    if (!ok) allOk = false;
    console.log(`  ${name.padEnd(15)} LV${lv} R${rc} T${kt} | gate LV${gate} ${canNow ? 'REBIRTH NOW' : `${gate - lv} levels away`} | level-ups in the first hour ${levelsFirstHour} vs today ~${todayPerHour.toFixed(1)} → ${faster ? 'FASTER' : 'SLOWER'} | R after ${HOURS} h: R${r.final.rebirths} LV${r.final.level} | first run ${firstRun ? `${firstRun.min}m to R${firstRun.rc + 1}` : '—'} | bar p10 ${r.v11.ke.inRunBar.p10}% ${ok ? 'OK' : 'CHECK'}`);
  }
  console.log(`  BOARD VERDICT: ${allOk ? 'PASS — every save levels faster than today and no dead bar' : 'CHECK — see rows'}`);
  process.exit(0);
}

// ----------------------------------------------------------------------------- RUN
const want = typeof args.skills === 'string' ? args.skills.split(',') : SKILLS.map((s) => s.id);
const results = [];
for (const s of SKILLS.filter((x) => want.includes(x.id))) {
  const t = Date.now.call ? process.hrtime.bigint() : 0n;
  const r = simulate(s);
  results.push(r);
  if (!QUIET) {
    console.log(`\n=== ${s.id.toUpperCase()} — ${r.words} words, ${r.levelUps} level-ups, ${LX ? 'LETTER XP (v11)' : 'word XP'}, ${(Number(process.hrtime.bigint() - t) / 1e9).toFixed(1)}s`);
    for (const [id, w] of Object.entries(r.perWindow)) {
      console.log(`  ${id.padEnd(4)} gap max ${w.maxGapMin}m (limit ${w.gapLimitMin}) ${w.gapPass ? 'PASS' : 'FAIL'} @${JSON.stringify(w.maxGapAt)} p90 ${w.p90GapMin}m strict max ${w.strictMaxGapMin}m p90 ${w.strictP90GapMin}m lv+${w.levelsGained} | KEY realised ${w.keyRealisedMin}m ${JSON.stringify(w.keyRealisedAt)} eta ${w.worstKeyEtaMin}m shop eta ${w.worstShopEtaMin}m ${w.wallPass ? 'PASS' : 'FAIL'} | LV${w.state && w.state.level} R${w.state && w.state.rebirths} T${w.state && w.state.keyTier} F${w.state && w.state.forge} ${JSON.stringify(w.events)}`);
    }
    console.log('  wall', JSON.stringify(r.wall));
    console.log('  reach (min)', JSON.stringify(r.firstReach), 'maxLevel', r.maxLevel);
    console.log(`  v11 pace (min/level, first time) LV10 ${r.v11.pace[10] ?? '—'} · LV50 ${r.v11.pace[50] ?? '—'} · LV100 ${r.v11.pace[100] ?? '—'} · LV200 ${r.v11.pace[200] ?? '—'}`);
    console.log(`  v11 KEY first hour: ${r.v11.key.firstHourBuys} buys, max gap ${r.v11.key.firstHourMaxGapMin}m @ ${JSON.stringify(r.v11.key.firstHourTimes)} | XP/letter step per KEY tier ×${r.v11.key.medianXpStep ?? '—'}`);
    console.log(`  v11 bar %/word by band (p10) ${Object.entries(r.v11.barPct).map(([b, x]) => `${b}:${x.p10}`).join(' ')} | dead bar (p10 < 0.2% to LV400): ${r.v11.deadBar ? 'FAIL' : 'PASS'}`);
    {
      const k = r.v11.ke;
      console.log(`  KE runs (R → peak LV, run min, last level min, KEY T): ${k.runs.slice(0, 16).map((x) => `R${x.rc}→LV${x.peak} ${x.min}m last ${x.lastLevelMin}m T${x.keyTier}`).join(' | ')}`);
      const tg = k.target;
      console.log(`  RR TARGETS run1 ${tg.run1}m (~2) · run5 ${tg.run5}m (~3) · run10 ${tg.run10}m (~4) · run20 ${tg.run20}m (~12) · rebirths in 10 h ${tg.rebirthsBy10h} (median ~36 / casual ~31 / strong ~41) · old wall passed at ${tg.passOldWallMedian} of a run (~0.17) · R at end ${tg.maxR} (runaway if > 80 in 10 h)`);
      console.log(`  KE first rebirths ${JSON.stringify(k.earlyRebirthMin)} min apart (15–90): ${k.earlyPass ? 'PASS' : 'FAIL'} | runs reaching further than the last: ${k.furtherShare} | in-run bar %/word below the gate p1 ${k.inRunBar.p1} p10 ${k.inRunBar.p10} p50 ${k.inRunBar.p50} (p10 ≥ 0.4): ${k.inRunBar.pass ? 'PASS' : 'FAIL'}`);
    }
    console.log(`  v11 re-climb: first 10 levels ${r.v11.firstClimbTo10}m; after rebirths (min, ×first) ${r.v11.reclimb.slice(1, 13).map((c) => `R${c.rc}:${c.minTo10}m×${c.vsFirst}`).join(' ')} | faster than first: ${r.v11.reclimbFasterShare}`);
    console.log('  achievements (min)', JSON.stringify(r.achTimes));
    if (r.rolls) console.log('  ROLLS', JSON.stringify({ ...r.rolls, log: undefined, worst: r.rolls.worst.slice(0, 5) }));
    if (r.gems) {
      const g = r.gems;
      const w = g.windows;
      console.log(`  GEMS: rolls per minute ${g.rollsPerMin} (1 per ${g.minPerRoll ?? '—'} min; target 1 per 2–3 min = 0.33–0.5), gems/min ${g.gemsPerMin}, by source ${Object.entries(g.bySourcePerMin).map(([k, v]) => `${k} ${v}/min (${Math.round(g.byShare[k] * 100)}%)`).join(' · ')} | windows: 0-10m ${w['0-10m'].rollsPerMin} rolls/min · 0-60m ${w['0-60m'].rollsPerMin} · last hour ${w.lastHour.rollsPerMin} | rolls bought ${g.rollsBought}`);
    }
    console.log('  runaway FAIL lumps', r.runaway.failCount, 'of', r.runaway.lumpCount);
    console.log('  codes', JSON.stringify(r.runaway.codes));
    console.log('  runaway top lumps by minutes', JSON.stringify(r.runaway.worstByMinutes.slice(0, 6)));
    console.log('  runaway top lumps', JSON.stringify(r.runaway.worstLumps.slice(0, 4)));
    console.log('  runaway top buys', JSON.stringify(r.runaway.worstBuys.slice(0, 3)));
    console.log('  mechanics', JSON.stringify(r.mechanics));
    console.log('  rebirths', JSON.stringify(r.rebirthTimes.slice(0, 12)));
    console.log('  keys', JSON.stringify(r.keyTimes));
    console.log('  final', JSON.stringify(r.final));
  }
}
let masher = null;
const medianRes = results.find((r) => r.skill === 'median');
if (medianRes && !args['no-masher']) {
  const m = simulateMasher(HOURS);
  const vs = MASHER_CHECKS.filter((T) => T <= HOURS * 60 && m.upsAt[T] != null).map((T) => {
    const med = medianRes.v11.upsAt[T];
    return { min: T, masher: m.upsAt[T], median: med, ratio: med > 0 ? +(m.upsAt[T] / med).toFixed(2) : null };
  });
  const worst = Math.max(...vs.map((v) => v.ratio ?? 0));
  masher = { ...m, vs, worstRatio: worst, pass: worst <= MASHER_LIMIT };
  if (!QUIET) console.log(`\n=== MASHER\n  v11 MASHER (${m.cap} letters/s menu gibberish, no wins) vs median, cumulative level-ups: ${vs.map((v) => `${v.min}m ×${v.ratio}`).join(' · ')} | worst ×${worst} ${masher.pass ? 'PASS' : 'FAIL'} (limit ×${MASHER_LIMIT}) | R${m.rebirths} LV${m.level}`);
}
// FAST vs MEDIAN (Andy oct5): rebirths reached by 60 / 300 / 600 min; the fast bot may lead by at most FAST_LIMIT×.
// And the board rule (020, src/leaderboard/submitRules.js) must never clip it: words at rebirth n ≥ WORDS_PER_RB × n.
const FAST_LIMIT = 1.5;
let fast = null;
{
  const f = results.find((r) => r.skill === 'fast');
  const m = results.find((r) => r.skill === 'median');
  if (f && m) {
    const rbBy = (r, T) => { let t = 0; let n = 0; for (const x of r.v11.ke.runs) { t += x.min; if (t <= T) n += 1; } return n; };
    const vs = [60, 300, 600].filter((T) => T <= HOURS * 60).map((T) => ({ min: T, fast: rbBy(f, T), median: rbBy(m, T), ratio: rbBy(m, T) > 0 ? +(rbBy(f, T) / rbBy(m, T)).toFixed(2) : null }));
    const worst = Math.max(0, ...vs.map((v) => (v.ratio == null ? (v.fast > 1 ? 99 : 0) : v.ratio)));
    let wordsPerRb = null;
    try { ({ WORDS_PER_RB: wordsPerRb } = await import(pathToFileURL(path.join(SRC, 'leaderboard', 'submitRules.js')).href)); } catch { wordsPerRb = null; }
    const clipped = wordsPerRb ? f.v11.ke.runs.filter((x) => x.words < wordsPerRb * (x.rc + 1)).map((x) => ({ rc: x.rc + 1, words: x.words })) : [];
    const perHour = f.v11.ke.runs.length ? +(f.v11.ke.runs.length / (f.v11.ke.runs.reduce((a, x) => a + x.min, 0) / 60)).toFixed(2) : 0;
    fast = { vs, worstRatio: worst, pass: worst <= FAST_LIMIT, rebirthsPerHour: perHour, wordsPerRb, serverClips: clipped, serverPass: clipped.length === 0 };
    if (!QUIET) console.log(`
=== FAST
  FAST (24 w/min, rebirth at the gate, all wins → KEY) vs median rebirths: ${vs.map((v) => `${v.min}m ${v.fast} vs ${v.median} ×${v.ratio}`).join(' · ')} | worst ×${worst} ${fast.pass ? 'PASS' : 'FAIL'} (limit ×${FAST_LIMIT}) | ${perHour} rebirths/h | board 020 (≥ ${wordsPerRb} words a rebirth) clips the honest fast bot: ${clipped.length ? 'FAIL ' + JSON.stringify(clipped.slice(0, 5)) : 'never — PASS'}`);
  }
}
const fmtRows = formatCheck(results);
if (!QUIET) {
  console.log('\n=== FORMAT');
  for (const f of fmtRows) console.log(`  ${f.ok ? 'ok  ' : 'FAIL'} ${f.fn}(${f.label} = ${f.value}) -> "${f.out}"`);
}
const outFile = path.join(HERE, `loop-sim${TAG === 'base' ? '' : '-' + TAG}.json`);
fs.writeFileSync(outFile, JSON.stringify({ src: SRC, tag: TAG, hours: HOURS, patch: process.env.SIM_PATCH || null, results, masher, fast, format: fmtRows }, null, 1));
if (!QUIET) console.log(`\nwrote ${outFile}`);
