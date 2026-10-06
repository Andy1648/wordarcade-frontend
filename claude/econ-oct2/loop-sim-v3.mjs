#!/usr/bin/env node
// loop-sim-v3.mjs — the PROGRESSION v3 (SEASON2) mode of loop-sim (claude/mockups/v2/progression-v3.md, Andy oct5
// phase 3). Run through loop-sim with SIM_SEASON2=1 (or directly):
//   SIM_SEASON2=1 SIM_SRC=src node claude/econ-oct2/loop-sim.mjs --hours=10 --tag=ci-s2
//   SIM_SEASON2=1 SIM_SRC=src node claude/econ-oct2/loop-sim.mjs --hours=1 --tag=smoke      (the local smoke)
//
// It turns the flag on BEFORE the economy modules load (globalThis.__TAW_SEASON2__ — season.js reads it once), so
// every number below comes from the SHIPPED v3 code behind the flag: letters → letterXp.creditLetterXp, words →
// wins.awardWordXp + wins.bankWordWins, POWER → shop.buyKeyPower, rolls → markRollShop.buyMarkRoll (75 gems,
// pity, luck — the R7 ×1.25 included), WB results → gems.payGameResult, ACHIEVEMENTS → v3/achievements, every
// rebirth → the app's client flow (rebirthFlow.performRebirth, season 2) against the JS model of the server
// (rebirthRules.decideRebirth + submitRules.decideSubmitS2 on an in-memory econ-13 row, on the sim clock).
//
// ----------------------------------------------------------------------------- MODEL (stated)
// BOTS (the spec's): casual 60 letters/min · 8 words/min, median 100 · 14, fast 160 · 26. Words are real words
//   (words.recall.txt) of mean length 5 (the spec's reference word: 15 wins); letters typed per word = lpm / wpm —
//   the accepted word's own letters pay the full XP per letter, every other typed letter (fumbles, misses) the
//   ×0.2 typed share, exactly as the game credits them (letterXp.js).
// MODE MIX: FUSE 35% · CHAIN 35% · WORD BOMB 30% (CHAIN ×2 MODE POWER; FUSE FRENZY as loop-sim models it). Run
//   lengths and WB win rates as loop-sim. SESSION: 60 min of play a day.
// POLICY at every menu return (= round end): claim every ready ACHIEVEMENT (gems); REBIRTH at the gate (one at a
//   time, through the server); HOLD at R10 (no further rebirths; SIM_S2_ASCEND=1 ascends at R10 instead); every
//   win → POWER; once the ROLL screen is open (R1) every 75 gems → a roll (auto-equip the better MAIN; from R5 the
//   2nd MARK slot wears the next best). No codes, no menu typing (except the MASHER), no cosmetics (gems → rolls).
// OVERDRIVE is not in the v3 formulas (off with the flag). Not modelled: Blitz / SAT / Race, codes / BOOST slots.
// SPAMMER: plays exactly like the median and at every menu return also fires the rebirth 1,000× through the client
//   flow (half at once, half in a row) and replays every old request id at the server — it must end level with the
//   median. MASHER: menu gibberish at the shared letter cap (no wins → no POWER), rebirths through the server.
// HARD CHECK (exit 1 → CI fails): any bot's rebirths > 2× the median's at 60 / 300 / 600 min; FAST more than 2× the
//   median's pace to R1 / R5 / R10; any server grant below the v3 gate (or > 1 per call, or by a replay); the spammer
//   not ending with the median's rebirths.
// TARGETS (spec, first time to): casual R1 18 min · R5 2.5 h · R10 11.4 h; median 12 min · 1.5 h · 6.8 h; fast
//   6 min · 54 min · 4.1 h. Levels by 10 h: casual 221K, median 1.1M, fast 3.2M. Reported, not gated.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

globalThis.location = { search: '?season2=1' }; // BEFORE any economy module loads (season.js reads it once)

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  return m ? [m[1], m[2] ?? true] : [a, true];
}));
let SRC = path.resolve(process.env.SIM_SRC || args.src || path.join(HERE, '..', '..', 'src'));
const TAG = typeof args.tag === 'string' ? args.tag : 's2';
const HOURS = Number(args.hours) || 10;
const QUIET = !!args.quiet;
const ASCEND = process.env.SIM_S2_ASCEND === '1';

if (process.env.SIM_PATCH) {
  const patches = JSON.parse(process.env.SIM_PATCH);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'loopsim3-'));
  fs.cpSync(SRC, path.join(tmp, 'src'), { recursive: true, filter: (p) => !/\.test\.js$|[\\/]assets[\\/]/.test(p) });
  for (const [file, find, repl] of patches) {
    const f = path.join(tmp, 'src', file);
    const t = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
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
const SEASON = await imp('progress/season.js');
if (!SEASON.SEASON2) throw new Error('loop-sim-v3: the SEASON2 flag did not turn on (is this a tree with progress/season.js?)');
await imp('progress/v3/install.js'); // the v3 rules (main.jsx installs them before the first render)
const XP = await imp('progress/xp.js');
const WINS = await imp('progress/wins.js');
const SHOP = await imp('progress/shop.js');
const STARS = await imp('progress/stars.js');
const GEMS = await imp('progress/gems.js');
const FRENZY = await imp('progress/frenzy.js');
const LX = await imp('progress/letterXp.js');
const MR = await imp('progress/markRolls.js');
const MRS = await imp('progress/markRollShop.js');
const RAR = await imp('progress/rarity.js');
const COMBO = await imp('progress/combo.js');
const LUCK = await imp('progress/luck.js');
const GAMEDATA = await imp('gameData.js');
const V3 = await imp('progress/v3/econ.js');
const ACH = await imp('progress/v3/achievements.js');
const UNL = await imp('progress/v3/unlocks.js');
const RANKS = await imp('progress/v3/ranks.js');
const STORE = await imp('progress/v3/store.js');
const RBRULES = await imp('leaderboard/rebirthRules.js');
const RBFLOW = await imp('leaderboard/rebirthFlow.js');
const SUBRULES = await imp('leaderboard/submitRules.js');

// ----------------------------------------------------------------------------- WORDS
const recall = fs.readFileSync(path.join(SRC, 'solo', 'words.recall.txt'), 'utf8').split(' ').filter(Boolean);
const rankIndex = RAR.buildRarityIndex(recall);
function makeVocab(n) {
  const byLen = new Map();
  for (const w of recall.slice(0, n)) {
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
function sampleWord(rng, mean, V) {
  const g = Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
  let L = Math.max(3, Math.min(12, Math.round(mean + 1.4 * g)));
  while (!V.byLen.has(L) && L > 3) L--;
  const arr = V.byLen.get(L);
  const c = V.cdf.get(L);
  const u = rng();
  let lo = 0;
  let hi = c.length - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; if (c[m] < u) lo = m + 1; else hi = m; }
  return arr[lo];
}
function pickWeighted(rng, pairs) {
  let r = rng() * pairs.reduce((s, p) => s + p[1], 0);
  for (const [v, w] of pairs) if ((r -= w) <= 0) return v;
  return pairs[pairs.length - 1][0];
}

// ----------------------------------------------------------------------------- BOTS
const SKILLS = [
  { id: 'casual', lpm: 60, wpm: 8, len: 5, vocab: 4000, miss: 0.15, win: 0.35, frenzyRunP: 0.001, runLen: { fuse: 10, chain: 10, 'word-bomb': 6 } },
  { id: 'median', lpm: 100, wpm: 14, len: 5, vocab: 9000, miss: 0.08, win: 0.5, frenzyRunP: 0.192, runLen: { fuse: 18, chain: 16, 'word-bomb': 10 } },
  { id: 'fast', lpm: 160, wpm: 26, len: 5, vocab: 20000, miss: 0.02, win: 0.8, frenzyRunP: 0.99, runLen: { fuse: 40, chain: 25, 'word-bomb': 14 } },
  { id: 'spammer', spam: true, lpm: 100, wpm: 14, len: 5, vocab: 9000, miss: 0.08, win: 0.5, frenzyRunP: 0.192, runLen: { fuse: 18, chain: 16, 'word-bomb': 10 } },
];
const SEED_OF = { casual: 1, median: 2, fast: 3, spammer: 2 }; // the spammer replays the median's dice exactly
const TARGETS = { // minutes (spec table)
  casual: { R1: 18, R5: 150, R10: 684, lv10h: 221e3 },
  median: { R1: 12, R5: 90, R10: 408, lv10h: 1.1e6 },
  fast: { R1: 6, R5: 54, R10: 246, lv10h: 3.2e6 },
};
const MODE_MIX = [['fuse', 0.35], ['chain', 0.35], ['word-bomb', 0.3]];
const PAYOUT_KEY = { 'word-bomb': 'wordBomb', chain: 'chain', fuse: 'fuse' };
const UNLOCK = Object.fromEntries((GAMEDATA.GAMES || []).filter((g) => g.unlockLevel != null).map((g) => [g.id, g.unlockLevel]));
const SESSION_MIN = 60;
const WB_PEOPLE_SHARE = 0.25;
const SPAM_CALLS = 1000;
const PACE_LIMIT = 2;
const PACE_CHECKS = [60, 300, 600];
const MILESTONES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// ----------------------------------------------------------------------------- THE SERVER (one per bot)
function makeSimServer() {
  const S = {
    row: { level: 1, rebirths: 0, stars: 0, lifetime_words: 0, lifetime_letters: 0, submitted_at: null, econ: 13 },
    recent: [], byId: new Map(), calls: 0, grants: 0, ascends: 0, violations: [], refusals: {}, replays: 0, replayMoves: 0, submits: 0, ids: [],
  };
  S.submit = (sub) => {
    S.submits += 1;
    const rb0 = S.row.rebirths;
    const st0 = S.row.stars;
    const d = SUBRULES.decideSubmitS2(S.row, sub, SIM_NOW);
    if (d.row) S.row = { ...S.row, ...d.row };
    if (S.row.rebirths > rb0) S.violations.push({ t: SIM_NOW, kind: 'submit-raised', from: rb0, to: S.row.rebirths });
    if (S.row.stars !== st0) S.violations.push({ t: SIM_NOW, kind: 'submit-stars' });
    return d;
  };
  S.rpc = (fn, body) => {
    S.calls += 1;
    while (S.recent.length && S.recent[0].created_at <= SIM_NOW - RBRULES.RB_WINDOW_SECS * 1000) S.recent.shift();
    const prev = S.byId.get(body.p_request_id);
    const log = prev && !S.recent.includes(prev) ? [prev, ...S.recent] : S.recent;
    const rb0 = S.row.rebirths;
    const lv0 = S.row.level;
    const decide = fn === 'lb_ascend' ? RBRULES.decideAscend : RBRULES.decideRebirth;
    const out = decide(S.row, { requestId: body.p_request_id, season: body.p_season }, log, SIM_NOW);
    S.row = { ...S.row, ...out.row };
    if (out.entry) { S.recent.push(out.entry); S.byId.set(out.entry.request_id, out.entry); S.ids.push(out.entry.request_id); }
    const r = out.result;
    if (r.replay) S.replays += 1;
    if (!r.ok) S.refusals[r.reason] = (S.refusals[r.reason] || 0) + 1;
    if (fn === 'lb_ascend' && r.ok && !r.replay) S.ascends += 1;
    if (fn === 'lb_rebirth' && S.row.rebirths > rb0) {
      S.grants += 1;
      const gate = V3.rebirthGate(rb0); // the CLIENT's v3 gate, independent of the model's own
      if (lv0 < gate) S.violations.push({ t: SIM_NOW, kind: 'below-gate', rebirths: rb0, level: lv0, gate });
      if (S.row.rebirths - rb0 !== 1) S.violations.push({ t: SIM_NOW, kind: 'more-than-one', from: rb0, to: S.row.rebirths });
      if (r.replay) { S.replayMoves += 1; S.violations.push({ t: SIM_NOW, kind: 'replay-moved' }); }
    }
    return r;
  };
  return S;
}
function makeSimFlow(S, statsNow) {
  let k = 0;
  return RBFLOW.makeRebirthFlow({
    serverEnabled: async () => true,
    pushStats: async () => { S.submit(statsNow()); return true; },
    call: async (fn, body) => S.rpc(fn, body),
    secret: () => 'sim',
    storage: { get: (key) => localStorage.getItem(key), set: (key, v) => localStorage.setItem(key, v), remove: (key) => localStorage.removeItem(key) },
    localRebirths: () => XP.getRebirths(),
    localReady: () => XP.loadProgress().level >= XP.rebirthThreshold(XP.getRebirths()),
    applyLocal: (target) => {
      if (Number.isFinite(target) && target >= 1) XP.saveRebirths(target - 1);
      const { rc, stars } = STARS.rebirthWithStars();
      return { rc, stars };
    },
    newId: () => `00000000-0000-4000-8000-${(++k).toString(16).padStart(12, '0')}`,
    season: () => 2,
    localAscendReady: () => XP.getRebirths() >= V3.ASCEND_AT,
    applyAscend: (target) => SEASON.V3.hooks.ascend(target),
  });
}

// ----------------------------------------------------------------------------- ONE BOT
const mainValue = (id) => (id ? MR.mainMultOf(id) : 1);
async function simulate(skill) {
  globalThis.localStorage = makeStore();
  SEASON.V3.hooks.patchStorage(globalThis.localStorage); // the season's own keys (taw.s2.*), as install maps them
  SIM_NOW = T0;
  const seed = SEED_OF[skill.id] + (Number(process.env.SIM_SEED) || 0) * 7919;
  Math.random = LUCK.mulberry32(4242 + seed * 31);
  WINS.resetWinsLedger();
  WINS.consumePendingWinsStamp();
  GEMS.resetGemsLedger();
  GEMS.setGemRng(LUCK.mulberry32(9001 + seed * 37));
  LX.resetLetterXp();
  const rng = LUCK.mulberry32(1648 + seed * 7919);
  const rollRng = LUCK.mulberry32(77 + seed * 131);
  const V = makeVocab(skill.vocab);
  const totalMin = HOURS * 60;
  const dt = 1 / skill.wpm;
  const lettersPerWord = skill.lpm / skill.wpm;

  let minute = 0;
  let day = 0;
  let sessionLeft = SESSION_MIN;
  let words = 0;
  let letters = 0;
  let letterCarry = 0;
  let wbGames = 0;
  let rolls = 0;
  let achGems = 0;
  let achClaims = 0;
  const firstR = {};
  const rbAt = {};
  const powerAt = {};
  const runs = [];
  let runT0 = 0;
  let lv10h = null;
  let ascends = 0;
  const gemsBy = {};
  const gemsOff = GEMS.subscribeGemLedger((e) => { if (e && e.reason !== 'start') gemsBy[e.reason] = (gemsBy[e.reason] || 0) + e.amount; });
  const winsBy = {};
  const winsOff = WINS.subscribeWins((e) => { const k = e.kind === 'word' ? `WORDS ${e.mode || ''}`.trim() : String(e.label).replace(/ —.*$/, ''); winsBy[k] = (winsBy[k] || 0) + e.amount; });
  const lv = () => XP.loadProgress().level;
  const srv = makeSimServer();
  const flow = makeSimFlow(srv, () => ({ level: lv(), rebirths: XP.getRebirths(), words, letters }));
  const spam = { calls: 0, ok: 0, replaysSent: 0 };

  const noteRebirth = (rc, at) => {
    runs.push({ rc, min: +(minute - runT0).toFixed(2), at: +minute.toFixed(2), fromLevel: at, power: XP.getKeyTier() });
    runT0 = minute;
    if (firstR[rc] == null) firstR[rc] = +minute.toFixed(2);
  };
  function doRolls() {
    if (!UNL.featureOpen('rollScreen')) return;
    for (let guard = 0; guard < 100000; guard++) {
      const st = MR.ensureRollState();
      const cost = MRS.nextRollCost(1, st);
      if (!cost.free && GEMS.getGems() < cost.gems) break;
      const res = MRS.buyMarkRoll({ rng: rollRng });
      if (!res) break;
      rolls += 1;
      MRS.applyRollEquip(res, []);
    }
    // R5: the 2nd MARK slot wears the best owned mark that is not the worn one
    if (UNL.featureOpen('mark2')) {
      const st = MR.loadRollState();
      const worn = MR.wornMarkId();
      let best = null;
      let bestV = 1;
      for (const id of Object.keys((st && st.marks) || {})) {
        const m = MR.rollMarkById(id);
        if (!m || m.legacy || id === worn) continue;
        const v = mainValue(id);
        if (v > bestV) { bestV = v; best = id; }
      }
      if (best && STORE.mark2Id() !== best) SEASON.V3.hooks.equipMark2(best);
    }
  }
  async function menuReturn() {
    // 1. ACHIEVEMENTS: claim every ready tier (gems)
    for (let guard = 0; guard < 50; guard++) {
      const ready = ACH.achievementsV3().filter((r) => r.ready);
      if (!ready.length) break;
      for (const r of ready) { const c = ACH.claimAchievementV3(r.id); if (c.ok) { achGems += c.gems; achClaims += 1; } }
    }
    // 2. REBIRTH at the gate, one at a time, through the server (hold at R10 unless SIM_S2_ASCEND)
    while (XP.getRebirths() < V3.ASCEND_AT && lv() >= XP.rebirthThreshold(XP.getRebirths())) {
      const at = lv();
      const r = await flow.performRebirth();
      if (!r.ok) break;
      noteRebirth(r.rc, at);
    }
    if (ASCEND && XP.getRebirths() >= V3.ASCEND_AT) {
      const a = await flow.performAscend();
      if (a.ok) { ascends += 1; runT0 = minute; }
    }
    if (skill.spam && XP.getRebirths() < V3.ASCEND_AT) {
      // (below R10 only: at R10 the honest bots HOLD by policy, so a legit gate-passing rebirth there is not a spam win)
      const half = Math.floor(SPAM_CALLS / 2);
      const at0 = lv();
      const burst = await Promise.all(Array.from({ length: half }, () => flow.performRebirth()));
      for (const r of burst) if (r.ok) { spam.ok += 1; noteRebirth(r.rc, at0); }
      for (let i = 0; i < SPAM_CALLS - half; i++) {
        const at = lv();
        const r = await flow.performRebirth();
        if (r.ok) { spam.ok += 1; noteRebirth(r.rc, at); }
      }
      spam.calls += SPAM_CALLS;
      for (const rid of srv.ids.slice()) srv.rpc('lb_rebirth', { p_secret: 'sim', p_request_id: rid, p_season: 2 });
      spam.replaysSent += srv.ids.length;
    }
    // 3. every win → POWER
    for (let guard = 0; guard < 500; guard++) if (!SHOP.buyKeyPower().ok) break;
    // 4. gems → rolls
    doRolls();
  }

  while (minute < totalMin) {
    const level = lv();
    const modes = MODE_MIX.filter(([m]) => level >= (UNLOCK[m] || 0) || XP.getRebirths() > 0);
    const mode = pickWeighted(rng, modes);
    const pkey = PAYOUT_KEY[mode];
    const n = Math.max(3, Math.round(skill.runLen[mode] * (0.7 + 0.6 * rng())));
    const diff = mode === 'word-bomb' ? (wbGames++ === 0 ? 'chill' : 'easy') : undefined;
    let combo = COMBO.freshCombo();
    const lucky = LUCK.makeLuckyOracle((rng() * 0xffffffff) >>> 0 || 1);
    let weightSum = 0;
    const stripAt = new Set();
    if (mode === 'fuse' && rng() < skill.frenzyRunP && process.env.SIM_S2_FRENZY !== '0') stripAt.add(Math.max(1, Math.round(n * (0.45 + 0.5 * rng()))));
    for (let i = 1; i <= n && minute < totalMin; i++) {
      if (rng() < skill.miss) combo = COMBO.comboBreak(combo);
      const word = sampleWord(rng, skill.len, V);
      const rw = RAR.wordRarity(word, rankIndex);
      combo = COMBO.comboAccept(combo);
      const lk = LUCK.luckyReward(lucky.next());
      const w = XP.cappedWordMult(rw.mult, combo.mult, lk.winsWeight);
      const prevW = weightSum;
      weightSum += WINS.bankWeight(w, word);
      // LETTERS: lpm/wpm typed per word at the typed share; awardWordXp tops the word's own letters up to full
      letterCarry += lettersPerWord;
      const typed = Math.max(word.length, Math.floor(letterCarry));
      letterCarry -= typed;
      LX.creditLetterXp(typed, { mode, perLetter: LX.letterXpNow() * XP.MENU_LETTER_SHARE });
      WINS.awardWordXp({ mode, difficulty: diff, wordLength: word.length, weight: w, word });
      WINS.bankWordWins({ mode: pkey, difficulty: diff, wordLength: word.length, prevWords: i - 1, nowWords: i, prevWeight: prevW, nowWeight: weightSum });
      words += 1;
      letters += typed;
      if (mode === 'fuse' && stripAt.has(i)) {
        const fz = FRENZY.startFrenzy();
        const bonus = Math.round(FRENZY.FRENZY_TRIGGER_WORDS * WINS.perWordWins({ mode: 'fuse' }));
        if (bonus > 0) WINS.grantWins(bonus, fz.started ? 'FRENZY!' : 'FULL STRIP', { mode: 'fuse', detail: 'frenzy' });
      }
      minute += dt;
      SIM_NOW += dt * 60000;
      sessionLeft -= dt;
      for (const T of PACE_CHECKS) if (rbAt[T] == null && minute >= T) rbAt[T] = XP.getRebirths();
      for (const T of PACE_CHECKS) if (powerAt[T] == null && minute >= T) powerAt[T] = XP.getKeyTier();
      if (lv10h == null && minute >= 600) lv10h = { level: lv(), rebirths: XP.getRebirths(), stars: STORE.getStarsV3() };
    }
    if (mode === 'word-bomb') {
      const iWon = rng() < skill.win;
      const people = rng() < WB_PEOPLE_SHARE;
      const rivals = people
        ? [{ id: 'p1', isBot: false, beaten: iWon }, { id: 'p2', isBot: false, beaten: iWon || rng() < 0.5 }]
        : [{ id: 'bot', isBot: true, beaten: iWon }];
      GEMS.payGameResult({ key: `sim-wb-${wbGames}`, iWon, rivals, mode: 'word-bomb' });
    }
    await menuReturn();
    if (sessionLeft <= 0 && minute < totalMin) {
      day++;
      sessionLeft += SESSION_MIN;
      SIM_NOW = T0 + day * 86400000;
    }
  }
  for (const T of PACE_CHECKS) if (rbAt[T] == null && totalMin >= T) rbAt[T] = XP.getRebirths();
  gemsOff();
  winsOff();
  GEMS.setGemRng(null);
  return {
    skill: skill.id, lpm: skill.lpm, wpm: skill.wpm, words, letters, minutes: totalMin,
    firstR, rbAt, powerAt, runs, lv10h, ascends,
    final: { level: lv(), rebirths: XP.getRebirths(), power: XP.getKeyTier(), stars: STORE.getStarsV3(), wins: WINS.getWins(), gems: GEMS.getGems(), rank: RANKS.liveRankV3().name, rolls, achGems, achClaims, achTiers: ACH.tierCountsV3(), mark: MR.wornMarkId(), mark2: STORE.mark2Id(), markMain: mainValue(MR.wornMarkId()) },
    winsBy: Object.fromEntries(Object.entries(winsBy).sort((a, b) => b[1] - a[1])),
    gems: { byReason: gemsBy, perMin: +(Object.values(gemsBy).reduce((a, b) => a + b, 0) / totalMin).toFixed(2) },
    server: { calls: srv.calls, grants: srv.grants, ascends: srv.ascends, storedRebirths: srv.row.rebirths, storedLevel: srv.row.level, refusals: srv.refusals, replays: srv.replays, replayMoves: srv.replayMoves, violations: srv.violations.slice(0, 20), violationCount: srv.violations.length, submits: srv.submits, spam: skill.spam ? spam : null },
  };
}

async function simulateMasher(hours) {
  globalThis.localStorage = makeStore();
  SEASON.V3.hooks.patchStorage(globalThis.localStorage); // the season's own keys (taw.s2.*), as install maps them
  SIM_NOW = T0;
  LX.resetLetterXp();
  const srv = makeSimServer();
  const flow = makeSimFlow(srv, () => ({ level: XP.loadProgress().level, rebirths: XP.getRebirths(), words: 0, letters: 0 }));
  const rbAt = {};
  const cap = LX.LETTER_RATE_CAP;
  const totalSec = hours * 3600;
  let gain = null;
  for (let sec = 0; sec < totalSec; sec++) {
    const minute = sec / 60;
    for (const T of PACE_CHECKS) if (rbAt[T] == null && minute >= T) rbAt[T] = XP.getRebirths();
    if (gain == null) gain = XP.xpPerInput({ mode: 'menu', markMult: LX.markXpBoost() });
    const before = XP.loadProgress();
    const res = XP.creditXp(before, cap * gain);
    XP.saveProgress(res.state);
    while (XP.getRebirths() < V3.ASCEND_AT && XP.loadProgress().level >= XP.rebirthThreshold(XP.getRebirths())) {
      const r = await flow.performRebirth();
      if (!r.ok) break;
      gain = null;
    }
    SIM_NOW += 1000;
  }
  for (const T of PACE_CHECKS) if (rbAt[T] == null && totalSec / 60 >= T) rbAt[T] = XP.getRebirths();
  return { cap, menuLetterXp: XP.xpPerInput({ mode: 'menu' }), rbAt, rebirths: XP.getRebirths(), level: XP.loadProgress().level, server: { calls: srv.calls, grants: srv.grants, refusals: srv.refusals, violations: srv.violations.slice(0, 20), violationCount: srv.violations.length } };
}

// ----------------------------------------------------------------------------- RUN
const fmtMin = (m) => (m == null ? '—' : m >= 60 ? `${(m / 60).toFixed(2)} h` : `${m.toFixed(1)} min`);
const fmtLv = (n) => (n == null ? '—' : n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(0)}K` : String(n));
const want = typeof args.skills === 'string' ? args.skills.split(',') : SKILLS.map((s) => s.id);
const results = [];
for (const s of SKILLS.filter((x) => want.includes(x.id))) {
  const t = process.hrtime.bigint();
  const r = await simulate(s);
  results.push(r);
  if (!QUIET) {
    console.log(`\n=== S2 ${s.id.toUpperCase()} (${s.lpm} letters/min · ${s.wpm} w/min) — ${r.words} words, ${(Number(process.hrtime.bigint() - t) / 1e9).toFixed(1)}s`);
    console.log(`  first time to ${MILESTONES.map((k) => `R${k} ${fmtMin(r.firstR[k])}`).join(' · ')}`);
    console.log(`  runs (R ← min, from LV, POWER) ${r.runs.slice(0, 12).map((x) => `R${x.rc}:${x.min}m LV${x.fromLevel} P${x.power}`).join(' | ')}`);
    console.log(`  at 10 h: ${r.lv10h ? `LV ${fmtLv(r.lv10h.level)} R${r.lv10h.rebirths} ★${r.lv10h.stars}` : '— (run shorter than 10 h)'} | final ${JSON.stringify(r.final)}`);
    console.log(`  rebirths at ${PACE_CHECKS.join('/')} min: ${PACE_CHECKS.map((T) => r.rbAt[T] ?? '—').join(' / ')} · POWER ${PACE_CHECKS.map((T) => r.powerAt[T] ?? '—').join(' / ')}`);
    { const tot = Object.values(r.winsBy).reduce((a, b) => a + b, 0) || 1; console.log(`  WINS by source ${Object.entries(r.winsBy).map(([k, v]) => `${k} ${Math.round((v / tot) * 100)}%`).join(' · ')}`); }
    console.log(`  GEMS ${r.gems.perMin}/min ${JSON.stringify(r.gems.byReason)} · rolls ${r.final.rolls} · achievements ${r.final.achClaims} tiers → ${r.final.achGems} gems`);
  }
}
let masher = null;
if (!args['no-masher']) {
  masher = await simulateMasher(Math.min(HOURS, 10));
  if (!QUIET) console.log(`\n=== S2 MASHER (${masher.cap} menu letters/s, ${masher.menuLetterXp} XP a key, no wins) rebirths at ${PACE_CHECKS.join('/')} min: ${PACE_CHECKS.map((T) => masher.rbAt[T] ?? '—').join(' / ')} | R${masher.rebirths} LV${masher.level}`);
}

// ---- HARD CHECK ------------------------------------------------------------------------------------------------------
const med = results.find((r) => r.skill === 'median');
const fast = results.find((r) => r.skill === 'fast');
let hard = null;
if (med) {
  const checks = PACE_CHECKS.filter((T) => T <= HOURS * 60);
  const rows = [];
  const bots = [...results.map((r) => [r.skill, r.rbAt]), ...(masher ? [['masher', masher.rbAt]] : [])];
  for (const [bot, at] of bots) {
    for (const T of checks) {
      const mine = at[T];
      const m = med.rbAt[T];
      if (mine == null || m == null) continue;
      rows.push({ bot, min: T, rebirths: mine, median: m, ratio: m > 0 ? +(mine / m).toFixed(2) : null, fail: m > 0 ? mine > PACE_LIMIT * m : mine > 1 });
    }
  }
  // FAST ≤ 2× the median's pace to each milestone both reached
  const paceRows = [];
  if (fast) {
    for (const k of [1, 5, 10]) {
      const f = fast.firstR[k];
      const m = med.firstR[k];
      if (f == null) continue;
      const ratio = m != null ? +(m / f).toFixed(2) : null;
      // the median not there yet: FAST may not be more than 2× ahead of the run's end
      const fail = m != null ? m / f > PACE_LIMIT : HOURS * 60 / f > PACE_LIMIT;
      paceRows.push({ milestone: `R${k}`, fast: f, median: m, ratio, fail });
    }
  }
  const servers = [...results.map((r) => [r.skill, r.server]), ...(masher ? [['masher', masher.server]] : [])];
  const violationCount = servers.reduce((a, [, x]) => a + (x.violationCount || 0), 0);
  const violations = servers.flatMap(([bot, x]) => (x.violations || []).map((v) => ({ bot, ...v }))).slice(0, 20);
  const sp = results.find((r) => r.skill === 'spammer');
  const spammerEqual = !sp || (sp.server.storedRebirths === med.final.rebirths && sp.final.rebirths === med.final.rebirths);
  const paceFails = rows.filter((x) => x.fail);
  const fastFails = paceRows.filter((x) => x.fail);
  hard = { limit: PACE_LIMIT, rows, paceFails, paceRows, fastFails, violationCount, violations, spammerEqual, pass: !paceFails.length && !fastFails.length && violationCount === 0 && spammerEqual };
  if (!QUIET) {
    console.log('\n=== S2 HARD CHECK (CI fails on it)');
    for (const T of checks) console.log(`  ${T}m: ${rows.filter((x) => x.min === T).map((x) => `${x.bot} ${x.rebirths}${x.ratio != null ? ` (×${x.ratio})` : ''}${x.fail ? ' FAIL' : ''}`).join(' · ')}`);
    console.log(`  FAST pace vs median (≤ ×${PACE_LIMIT}): ${paceRows.map((x) => `${x.milestone} ${fmtMin(x.fast)} vs ${fmtMin(x.median)} ×${x.ratio ?? '—'}${x.fail ? ' FAIL' : ''}`).join(' · ') || '—'}`);
    for (const [bot, x] of servers) console.log(`  server[${bot}]: ${x.calls} calls, ${x.grants} granted, refused ${JSON.stringify(x.refusals)}${x.replays != null ? `, ${x.replays} replays (${x.replayMoves} moved the row)` : ''}${x.spam ? `, spam ${x.spam.calls} calls → ${x.spam.ok} ok, ${x.spam.replaysSent} replays sent` : ''}, violations ${x.violationCount}`);
    console.log(`  SPAMMER ends with the median's rebirths: ${sp ? `${sp.final.rebirths} vs ${med.final.rebirths} (server ${sp.server.storedRebirths})` : '—'}`);
    console.log(`  S2 HARD CHECK: ${hard.pass ? 'PASS' : 'FAIL'} (pace ≤ ×${PACE_LIMIT} median at ${checks.join('/')} min and to R1/R5/R10; no rebirth without the v3 gate)`);
  }
}

// ---- TARGETS TABLE (markdown lines start with '|' — the CI job copies them into the summary) ----------------------
const table = [];
table.push(`| first time to (${HOURS} h run) | casual | median | fast |`);
table.push('|---|---|---|---|');
const cell = (skill, key) => {
  const r = results.find((x) => x.skill === skill);
  const tg = TARGETS[skill];
  if (!r || !tg) return '—';
  if (key === 'lv10h') return `${r.lv10h ? fmtLv(r.lv10h.level) : '—'} (spec ${fmtLv(tg.lv10h)})`;
  const k = Number(key.slice(1));
  const v = r.firstR[k];
  const dev = v != null ? ` ${v / tg[key] >= 1 ? '+' : ''}${Math.round((v / tg[key] - 1) * 100)}%` : '';
  return `${fmtMin(v)} (spec ${fmtMin(tg[key])}${dev})`;
};
for (const key of ['R1', 'R5', 'R10']) table.push(`| ${key}${key === 'R10' ? ' (ascend)' : ''} | ${cell('casual', key)} | ${cell('median', key)} | ${cell('fast', key)} |`);
table.push(`| LEVELS at 10 h | ${cell('casual', 'lv10h')} | ${cell('median', 'lv10h')} | ${cell('fast', 'lv10h')} |`);
if (fast && med) table.push(`| FAST ÷ MEDIAN pace | ${hard ? hard.paceRows.map((x) => `${x.milestone} ×${x.ratio ?? '—'}`).join(' · ') : '—'} | (limit ×${PACE_LIMIT}) | ${hard && hard.pass ? 'HARD CHECK PASS' : 'HARD CHECK FAIL'} |`);
if (!QUIET) {
  console.log('\n=== S2 TARGETS (spec: progression-v3.md "Sim")');
  for (const l of table) console.log(l);
}

const outFile = path.join(HERE, `loop-sim-${TAG}.json`);
fs.writeFileSync(outFile, JSON.stringify({ season: 2, src: SRC, tag: TAG, hours: HOURS, ascend: ASCEND, patch: process.env.SIM_PATCH || null, targets: TARGETS, results, masher, hard, table }, null, 1));
if (!QUIET) console.log(`\nwrote ${outFile}`);
if (hard && !hard.pass) process.exitCode = 1;
