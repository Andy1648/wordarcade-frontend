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
// NOT MODELLED: menu typing XP, Category Blitz / SAT Rush / Word Race, returnBonus, theme worlds.
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

// ----------------------------------------------------------------------------- WORDS
const recall = fs.readFileSync(path.join(SRC, 'solo', 'words.recall.txt'), 'utf8').split(' ').filter(Boolean);
const rankIndex = RAR.buildRarityIndex(recall);
const acceptOnly = fs.readFileSync(path.join(SRC, 'solo', 'words.accept.txt'), 'utf8').split(' ')
  .filter((w) => w && /^[a-z]+$/.test(w) && w.length >= 4 && !rankIndex.has(w));

const SKILLS = [
  { id: 'casual', wpm: 6, len: 5, vocab: 4000, obscure: 0.005, miss: 0.15, typing: 35, frenzyRunP: 0.001, strips: 1, runLen: { fuse: 10, chain: 10, 'word-bomb': 6 } },
  { id: 'median', wpm: 10, len: 6, vocab: 9000, obscure: 0.015, miss: 0.08, typing: 50, frenzyRunP: 0.192, strips: 1, runLen: { fuse: 18, chain: 16, 'word-bomb': 10 } },
  { id: 'strong', wpm: 16, len: 7, vocab: 20000, obscure: 0.04, miss: 0.04, typing: 75, frenzyRunP: 0.989, strips: 1.68, runLen: { fuse: 40, chain: 25, 'word-bomb': 14 } },
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
function simulate(skill) {
  globalThis.localStorage = makeStore();
  SIM_NOW = T0;
  WINS.resetWinsLedger();
  WINS.consumePendingWinsStamp();
  const rng = LUCK.mulberry32(1648 + skill.wpm * 7919);
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
  let winsAll = 0;
  let winsWord = 0;
  const incomeTrail = [[0, 0, 0]]; // [t, winsAll, winsWord]
  const seenRanks = new Set([RANK.rankTitle(1)]);
  const extremes = { balance: 0, lifetime: 0, keyPrice: 0, forgePrice: 0, cosmeticPrice: 0, rate: 0, xpPerWord: 0, need: 0, lump: 0 };
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
  const sub = WINS.subscribeWins((e) => {
    winsAll += e.amount;
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
      const bal = WINS.getWins();
      const kCost = XP.keyTierCost(XP.getKeyTier());
      const before = refRate().xp;
      if (bal >= kCost) {
        const r = SHOP.buyKeyPower();
        if (!r.ok) return;
        const after = refRate().xp;
        buys.push({ t: minute, kind: 'KEY', id: `T${r.tier}`, price: kCost, level: lv(), rateStep: after / before });
        addGood('buy', `KEY T${r.tier}`);
        continue;
      }
      const cands = [];
      if (forgeOpen()) cands.push({ kind: 'FORGE', id: `F${FORGE.forgeBuys() + 1}`, price: FORGE.forgeCost(FORGE.forgeBuys()) });
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
  function bestMark() {
    const earned = ACH.loadEarned();
    const un = MARKS.unlockedMarks(earned);
    if (!un.length) return;
    let best = null, bestV = 0;
    for (const m of un) {
      let v = 0;
      for (const [gm, share] of MODE_MIX) v += share * ((MARKS.markWinsFactors({ markId: m.id, mode: PAYOUT_KEY[gm] }).mark || 1) * MARKS.markXpMult(m.id));
      if (v > bestV) { bestV = v; best = m.id; }
    }
    if (best && MARKS.getEquippedMark() !== best) {
      MARKS.equipMark(best, earned);
      firstAt('markEquipped', { mark: best });
    }
  }
  function menuReturn() {
    lastLumpCtx = 'claim';
    const newly = ACH.checkAchievements();
    for (const a of newly) addGood('achievement', `ACH ${a.name}`);
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
      const { rc, stars } = STARS.rebirthWithStars();
      addGood('rebirth', `REBIRTH ${rc} (from LV${at}, +${stars}★)`);
      firstAt('rebirth', { fromLevel: at });
      for (const id of ['autoKey', 'autoForge', 'frenzy', 'head', 'power', 'power', 'power', 'power']) {
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
      const res = STARS.runAutomation({ buyKey: SHOP.buyKeyPower, buyForge: SHOP.buyForge });
      const step = refRate().xp / r0;
      for (let t = kt0 + 1; t <= XP.getKeyTier(); t++) { buys.push({ t: minute, kind: 'KEY', id: `T${t}`, price: XP.keyTierCostAt(t), level: lv(), rateStep: step, auto: true }); addGood('buy', `AUTO-KEY T${t}`); }
      if (FORGE.forgeBuys() > fb0) { buys.push({ t: minute, kind: 'FORGE', id: `F${fb0 + 1}..F${FORGE.forgeBuys()}`, price: 0, level: lv(), rateStep: XP.getKeyTier() > kt0 ? 1 : step, auto: true }); addGood('buy', `AUTO-FORGE ×${res.forges}`); }
    }
    shop();
    // ETA sample: minutes of play to afford the next KEY / next shop item at the trailing income
    const inc = incomeAll();
    if (inc && inc > 0 && minute >= 1) {
      const bal = WINS.getWins();
      const eta = (p) => Math.max(0, p - bal) / inc;
      const key = eta(XP.keyTierCost(XP.getKeyTier()));
      const forge = forgeOpen() ? eta(FORGE.forgeCost(FORGE.forgeBuys())) : null;
      const cos = cosmetics();
      const cosmetic = cos.length ? eta(Math.min(...cos.map((c) => c.price))) : null;
      const shopEta = Math.min(...[forge, cosmetic].filter((x) => x != null));
      etaSamples.push({ t: minute, key, forge, cosmetic, shop: Number.isFinite(shopEta) ? shopEta : null, level: lv(), tier: XP.getKeyTier() });
    }
    // extremes for the formatter check
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
      CLAIMS.queueClaim({ id: 'code:SIMLEVEL', kind: 'code', label: 'CODE — SIM PER LEVEL', amount: 1000, meta: { perLevel: true } });
      mech.perLevelCode = { t: +minute.toFixed(2), level: lv(), pays: 1000 * lv() };
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
      if (rng() < skill.miss) {
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
      lastLumpCtx = 'mastery';
      const res = WINS.awardWordXp({ mode, difficulty: diff, wordLength: word.length, weight: w, word });
      lastLumpCtx = null;
      WINS.bankWordWins({ mode: pkey, difficulty: diff, wordLength: word.length, prevWords: i - 1, nowWords: i, prevWeight: prevW, nowWeight: weightSum });
      if (mode === 'word-bomb') WC.addWords('word-bomb');
      COLL.recordAcceptedWord(word, { mode, band: rw.band });
      if (res.mark && res.mark.rankedUp) addGood('mark', `MARK RANK ${res.mark.rank}`);
      if (res.level > before) {
        const k = res.level - before;
        levelUps += k;
        addGood('level', `LV${res.level}`);
        for (let L = before + 1; L <= res.level; L++) {
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

  return {
    skill: skill.id, words, levelUps, perWindow,
    wall: { worstKeyEta: allKey && { min: +allKey.key.toFixed(2), t: +allKey.t.toFixed(1), tier: allKey.tier, level: allKey.level }, worstShopEta: allShop && { min: +allShop.shop.toFixed(2), t: +allShop.t.toFixed(1), level: allShop.level }, keyRealised },
    runaway: { failCount: lumpEval.filter((l) => l.fail).length, codes: lumpEval.filter((l) => /^CODE|^BOOST/.test(l.label)), worstByMinutes: [...lumpEval].filter((l) => l.minutesOfPlay != null).sort((a, b) => b.minutesOfPlay - a.minutesOfPlay).slice(0, 15), worstLumps: runawayList.slice(0, 12), worstBuys: buyStep.slice(0, 8), lumpCount: lumps.length },
    early: { lumps: lumpEval.filter((l) => l.t < 15), buys: buys.filter((b) => b.t < 15).map((b) => ({ ...b, t: +b.t.toFixed(2) })), good: good.filter((g) => g.t < 15).map((g) => [+g.t.toFixed(2), g.kind, g.label]) },
    mechanics: mech, extremes, final: snapshot(),
    counts: Object.fromEntries([...new Set(good.map((g) => g.kind))].map((k) => [k, good.filter((g) => g.kind === k).length])),
    rebirthTimes: good.filter((g) => g.kind === 'rebirth').map((g) => [+g.t.toFixed(1), g.label]),
    keyTimes: keyBuys.map((b) => [+b.t.toFixed(1), b.id, b.level]),
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

// ----------------------------------------------------------------------------- RUN
const want = typeof args.skills === 'string' ? args.skills.split(',') : SKILLS.map((s) => s.id);
const results = [];
for (const s of SKILLS.filter((x) => want.includes(x.id))) {
  const t = Date.now.call ? process.hrtime.bigint() : 0n;
  const r = simulate(s);
  results.push(r);
  if (!QUIET) {
    console.log(`\n=== ${s.id.toUpperCase()} — ${r.words} words, ${r.levelUps} level-ups, ${(Number(process.hrtime.bigint() - t) / 1e9).toFixed(1)}s`);
    for (const [id, w] of Object.entries(r.perWindow)) {
      console.log(`  ${id.padEnd(4)} gap max ${w.maxGapMin}m (limit ${w.gapLimitMin}) ${w.gapPass ? 'PASS' : 'FAIL'} @${JSON.stringify(w.maxGapAt)} p90 ${w.p90GapMin}m strict max ${w.strictMaxGapMin}m p90 ${w.strictP90GapMin}m lv+${w.levelsGained} | KEY realised ${w.keyRealisedMin}m ${JSON.stringify(w.keyRealisedAt)} eta ${w.worstKeyEtaMin}m shop eta ${w.worstShopEtaMin}m ${w.wallPass ? 'PASS' : 'FAIL'} | LV${w.state && w.state.level} R${w.state && w.state.rebirths} T${w.state && w.state.keyTier} F${w.state && w.state.forge} ${JSON.stringify(w.events)}`);
    }
    console.log('  wall', JSON.stringify(r.wall));
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
const fmtRows = formatCheck(results);
if (!QUIET) {
  console.log('\n=== FORMAT');
  for (const f of fmtRows) console.log(`  ${f.ok ? 'ok  ' : 'FAIL'} ${f.fn}(${f.label} = ${f.value}) -> "${f.out}"`);
}
const outFile = path.join(HERE, `loop-sim${TAG === 'base' ? '' : '-' + TAG}.json`);
fs.writeFileSync(outFile, JSON.stringify({ src: SRC, tag: TAG, hours: HOURS, patch: process.env.SIM_PATCH || null, results, format: fmtRows }, null, 1));
if (!QUIET) console.log(`\nwrote ${outFile}`);
