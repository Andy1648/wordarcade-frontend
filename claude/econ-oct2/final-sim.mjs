#!/usr/bin/env node
// final-sim.mjs — PROGRESSION FINAL (claude/progression-FINAL.md, FROZEN) on the REAL modules — the CI port of
// claude/progression-final-sim.py. Turns the SEASON2 flag on before the economy loads, so every number comes from the
// shipped code behind the flag:
//   game letters → letterXp.creditLetterXp (the ×0.2 typed share) + wins.awardWordXp (the accepted word's own letters
//     topped up to ×1); wins → wins.bankWordWins; POWER → shop.buyKeyPower; menu letters → v3/menuWords (real
//     dictionary words only, ×0.2, the 60 s repeat decay, > 12 letters/s = 0) on the real solo ACCEPT set;
//   every rebirth / ascension → the app's client flow (rebirthFlow.performRebirth / performAscend, season 2) against the
//     JS model of the server (rebirthRules.decideRebirth / decideAscend + finalRules.decideSubmitFinal on an in-memory
//     econ-13 row, on the sim clock) — so the 12-an-hour pace cap and the spend-the-gate rule are the real ones.
//
//   node claude/econ-oct2/final-sim.mjs                 # all bots, 40 h, table + HARD CHECK, exit 1 on any miss
//   node claude/econ-oct2/final-sim.mjs --hours=12 --bots=median,fast --no-gate
//
// ----------------------------------------------------------------------------- MODEL (the md's, stated)
// BOTS (the python sim's M table): lpm_game · wpm_game · lpm_menu · share of play in games
//   casual 60 · 8 · 80 · 60% | median 100 · 14 · 150 · 70% | fast 160 · 26 · 250 · 75% | menu-only 0 · 0 · 150 · 0%
// GAMES: FUSE (MODE ×1, no rarity/combo weight — the md's bare formula) with FRENZY off; words are real words of mean
//   length 5 (the md's reference word: 22 wins); the letters a bot types beyond its words' own letters (lpm − Σ lengths:
//   fumbles, misses) pay the ×0.2 typed share — the real game's rule (the python credits every game letter ×1).
// MENU: real words (the top 3,000 of words.recall.txt, length 3–8) at the bot's menu lpm, each closed by a space.
// STEP: 10 s (the python's tick) — game words, menu words, then the menu return (POWER / REBIRTH / ASCEND).
// NO MARKS, no rolls, no gems spent, no boosts, no achievements (the md: "python, no marks"). POWER bought greedily;
//   REBIRTH whenever the level passes the gate (one server call per rebirth, ≤ 12 an hour); ASCEND whenever R ≥ 10 + 5★.
// MASHER: menu gibberish (random 5–12-letter runs) at the shared 12 letters/s cap, 10 h — must earn ~0 levels.
// SPAMMER: the median's exact dice, plus every 10 min 1,000 rebirth calls through the client flow (half at once, half in a
//   row) and a replay of every old request id straight at the server — must end exactly level with the median.
// HARD CHECK (exit 1 → CI fails): every FINAL-table cell within ±25% (a "—" cell: not reached before 75% of the 40 h
//   horizon); FAST ≤ 2× the median's pace to every milestone both reach; MASHER ≤ 1 level gained and 0 rebirths;
//   SPAMMER's final R / ★ / level = the median's; no server grant below the FINAL gate, > 1 per call, or by a replay.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

globalThis.location = { search: '?season2=1' }; // BEFORE any economy module loads (season.js reads it once)

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  return m ? [m[1], m[2] ?? true] : [a, true];
}));
const SRC = path.resolve(process.env.SIM_SRC || args.src || path.join(HERE, '..', '..', 'src'));
const HOURS = Number(args.hours) || 40;
const TAG = typeof args.tag === 'string' ? args.tag : 'final';
const GATE = !args['no-gate'];

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
const T0 = Date.UTC(2026, 9, 7, 14);
let SIM_NOW = T0;
Date.now = () => SIM_NOW;
globalThis.performance = { now: () => SIM_NOW };

const imp = (rel) => import(pathToFileURL(path.join(SRC, rel)).href);
const SEASON = await imp('progress/season.js');
if (!SEASON.SEASON2) throw new Error('final-sim: the SEASON2 flag did not turn on');
await imp('progress/v3/install.js');
const XP = await imp('progress/xp.js');
const WINS = await imp('progress/wins.js');
const SHOP = await imp('progress/shop.js');
const STARS = await imp('progress/stars.js');
const LX = await imp('progress/letterXp.js');
const LUCK = await imp('progress/luck.js');
const ECON = await imp('progress/v3/econ.js');
const STORE = await imp('progress/v3/store.js');
const MW = await imp('progress/v3/menuWords.js');
const RBRULES = await imp('leaderboard/rebirthRules.js');
const RBFLOW = await imp('leaderboard/rebirthFlow.js');
const FRULES = await imp('leaderboard/finalRules.js');

// ----------------------------------------------------------------------------- WORDS
const readWords = (f) => fs.readFileSync(path.join(SRC, 'solo', f), 'utf8').split(/\s+/).filter(Boolean);
const recall = readWords('words.recall.txt');
const DICT = new Set(recall);
for (const w of readWords('words.accept.txt')) DICT.add(w);
const isWord = (w) => DICT.has(w);
const GAME_POOL = new Map(); // length → words (top 9k)
for (const w of recall.slice(0, 9000)) {
  if (!/^[a-z]+$/.test(w) || w.length < 3 || w.length > 12) continue;
  if (!GAME_POOL.has(w.length)) GAME_POOL.set(w.length, []);
  GAME_POOL.get(w.length).push(w);
}
const MENU_POOL = recall.slice(0, 3000).filter((w) => /^[a-z]+$/.test(w) && w.length >= 3 && w.length <= 8);

// ----------------------------------------------------------------------------- THE FINAL TABLE (md "Sim", minutes)
const H = 60;
const FINAL = {
  casual: { R1: 22, R3: 86, R5: 3.4 * H, R10: 19 * H, S1: 19 * H, S2: null },
  median: { R1: 12, R3: 44, R5: 1.8 * H, R10: 9.9 * H, S1: 9.9 * H, S2: 34 * H },
  fast: { R1: 6, R3: 25, R5: 59, R10: 5.6 * H, S1: 5.6 * H, S2: 19 * H },
  menu: { R1: 73, R3: 11.7 * H, R5: null, R10: null, S1: null, S2: null },
};
const BOTS = [
  { id: 'casual', lpm: 60, wpm: 8, mlpm: 80, game: 0.6, seed: 1 },
  { id: 'median', lpm: 100, wpm: 14, mlpm: 150, game: 0.7, seed: 2 },
  { id: 'fast', lpm: 160, wpm: 26, mlpm: 250, game: 0.75, seed: 3 },
  { id: 'menu', lpm: 0, wpm: 0, mlpm: 150, game: 0, seed: 4 },
  { id: 'spammer', lpm: 100, wpm: 14, mlpm: 150, game: 0.7, seed: 2, spam: true },
];
const TOL = 0.25;
const PACE_LIMIT = 2;
const SPAM_EVERY_MIN = 10;
const SPAM_CALLS = 1000;
const RUN_WORDS = 18; // a FUSE run (bankWordWins' 3-word gate per run)
const DT = 1 / 6; // minutes per step: 10 s, the python sim's tick (menu returns are checked every step)

// ----------------------------------------------------------------------------- THE SERVER (one per bot)
function makeSimServer() {
  const S = { row: { level: 1, rebirths: 0, stars: 0, lifetime_words: 0, lifetime_letters: 0, submitted_at: null, econ: 13 }, recent: [], byId: new Map(), ids: [], calls: 0, grants: 0, ascends: 0, replays: 0, violations: [], refusals: {} };
  S.submit = (sub) => {
    const rb0 = S.row.rebirths;
    const st0 = S.row.stars;
    const d = FRULES.decideSubmitFinal(S.row, sub, SIM_NOW);
    if (d.row) S.row = { ...S.row, ...d.row };
    if (S.row.rebirths > rb0) S.violations.push({ t: SIM_NOW, kind: 'submit-raised' });
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
      const cost = ECON.rebirthCost(rb0); // the CLIENT's FINAL rule, independent of the server model
      if (!(lv0 > cost)) S.violations.push({ t: SIM_NOW, kind: 'below-gate', rebirths: rb0, level: lv0 });
      if (S.row.level !== lv0 - cost) S.violations.push({ t: SIM_NOW, kind: 'not-spent', from: lv0, to: S.row.level });
      if (S.row.rebirths - rb0 !== 1) S.violations.push({ t: SIM_NOW, kind: 'more-than-one' });
      if (r.replay) S.violations.push({ t: SIM_NOW, kind: 'replay-moved' });
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
      return STARS.rebirthWithStars();
    },
    newId: () => `00000000-0000-4000-8000-${(++k).toString(16).padStart(12, '0')}`,
    season: () => 2,
    localAscendReady: () => ECON.canAscend(XP.getRebirths(), STORE.getStarsV3()),
    applyAscend: (target) => SEASON.V3.hooks.ascend(target),
  });
}

// ----------------------------------------------------------------------------- ONE BOT
function freshSave(seed) {
  globalThis.localStorage = makeStore();
  SEASON.V3.hooks.patchStorage(globalThis.localStorage);
  SIM_NOW = T0;
  WINS.resetWinsLedger();
  WINS.consumePendingWinsStamp();
  LX.resetLetterXp();
  Math.random = LUCK.mulberry32(4242 + seed * 31);
  return LUCK.mulberry32(1648 + seed * 7919);
}
const lv = () => XP.loadProgress().level;

async function simulate(bot, hours = HOURS) {
  const rng = freshSave(bot.seed);
  const judge = MW.createMenuWordJudge({ isWord });
  const srv = makeSimServer();
  let words = 0;
  let letters = 0;
  const flow = makeSimFlow(srv, () => ({ level: lv(), rebirths: XP.getRebirths(), words, letters }));
  const first = {};
  const note = (key) => { if (first[key] == null) first[key] = +(minute).toFixed(2); };
  const sampleWord = () => {
    const g = Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
    const L = Math.max(3, Math.min(8, Math.round(5 + 1.2 * g)));
    const arr = GAME_POOL.get(L);
    return arr[Math.floor(rng() * arr.length)];
  };
  let minute = 0;
  let runWords = 0;
  let runWeight = 0;
  let gameCarry = 0;
  let letterCarry = 0;
  let menuCarry = 0;
  let menuXp = 0;
  const spam = { calls: 0, ok: 0, replaysSent: 0 };
  let lastSpam = 0;
  const totalMin = hours * 60;
  while (minute < totalMin) {
    // ---- the game share of this minute
    gameCarry += bot.wpm * bot.game * DT;
    const n = Math.floor(gameCarry);
    gameCarry -= n;
    letterCarry += bot.lpm * bot.game * DT;
    let wordLetters = 0;
    for (let i = 0; i < n; i++) {
      const word = sampleWord();
      wordLetters += word.length;
      LX.creditLetterXp(word.length, { mode: 'fuse', perLetter: LX.letterXpNow() * XP.MENU_LETTER_SHARE }); // typed at ×0.2
      WINS.awardWordXp({ mode: 'fuse', wordLength: word.length, word }); // the accepted word's letters → ×1
      const prev = runWords;
      runWords += 1;
      WINS.bankWordWins({ mode: 'fuse', wordLength: word.length, prevWords: prev, nowWords: runWords, prevWeight: runWeight, nowWeight: (runWeight += 1) });
      if (runWords >= RUN_WORDS) { runWords = 0; runWeight = 0; }
      words += 1;
    }
    const typed = Math.floor(letterCarry);
    letterCarry -= typed;
    const fumbles = Math.max(0, typed - wordLetters);
    if (fumbles) LX.creditLetterXp(fumbles, { mode: 'fuse', perLetter: LX.letterXpNow() * XP.MENU_LETTER_SHARE });
    letters += Math.max(typed, wordLetters);
    // ---- the menu share: real words at the bot's menu speed, each closed by a space
    menuCarry += bot.mlpm * (1 - bot.game) * DT;
    const menuStart = SIM_NOW + bot.game * 60000 * DT;
    const msPerLetter = bot.mlpm > 0 ? 60000 / bot.mlpm : 0;
    let t = menuStart;
    while (menuCarry >= 3) {
      const w = MENU_POOL[Math.floor(rng() * MENU_POOL.length)];
      if (w.length > menuCarry) break;
      menuCarry -= w.length;
      const t0 = t;
      t += w.length * msPerLetter;
      const f = judge.judge(w, t0, t);
      const xp = MW.menuWordXp(w.length, XP.levelXpPerLetter(undefined, undefined, 1), f);
      if (xp > 0) {
        menuXp += xp;
        const res = XP.creditXp(XP.loadProgress(), xp);
        XP.saveProgress(res.state);
      }
      t += msPerLetter; // the space
    }
    minute += DT;
    SIM_NOW = T0 + Math.round(minute * 60000);
    // ---- the menu return: POWER, REBIRTH (one server call each), ASCEND
    for (let g = 0; g < 200; g++) if (!SHOP.buyKeyPower().ok) break;
    for (let g = 0; g < 20 && lv() >= XP.rebirthThreshold(XP.getRebirths()); g++) {
      const r = await flow.performRebirth();
      if (!r.ok) break;
      note(`${STORE.getStarsV3()}:R${r.rc}`);
    }
    if (ECON.canAscend(XP.getRebirths(), STORE.getStarsV3())) {
      const a = await flow.performAscend();
      if (a.ok) note(`S${a.stars}`);
    }
    if (bot.spam && minute - lastSpam >= SPAM_EVERY_MIN) {
      lastSpam = minute;
      const half = SPAM_CALLS / 2;
      const burst = await Promise.all(Array.from({ length: half }, () => flow.performRebirth()));
      for (const r of burst) if (r.ok) { spam.ok += 1; note(`${STORE.getStarsV3()}:R${r.rc}`); }
      for (let i = 0; i < half; i++) {
        const r = await flow.performRebirth();
        if (r.ok) { spam.ok += 1; note(`${STORE.getStarsV3()}:R${r.rc}`); }
      }
      spam.calls += SPAM_CALLS;
      for (const rid of srv.ids.slice(-200)) srv.rpc('lb_rebirth', { p_secret: 'sim', p_request_id: rid, p_season: 2 });
      spam.replaysSent += Math.min(200, srv.ids.length);
    }
  }
  const at = (k) => first[`0:R${k}`] ?? null;
  return {
    bot: bot.id, hours,
    times: { R1: at(1), R3: at(3), R5: at(5), R10: at(10), S1: first.S1 ?? null, S2: first.S2 ?? null, S3: first.S3 ?? null },
    final: { level: lv(), rebirths: XP.getRebirths(), stars: STORE.getStarsV3(), power: XP.getKeyTier(), wins: WINS.getWins() },
    words, letters, menuXp,
    server: { calls: srv.calls, grants: srv.grants, ascends: srv.ascends, replays: srv.replays, refusals: srv.refusals, violations: srv.violations.slice(0, 10), violationCount: srv.violations.length, stored: { rebirths: srv.row.rebirths, stars: srv.row.stars, level: srv.row.level } },
    spam: bot.spam ? spam : null,
  };
}

async function simulateMasher(hours = 10) {
  const rng = freshSave(9);
  const judge = MW.createMenuWordJudge({ isWord });
  const srv = makeSimServer();
  const flow = makeSimFlow(srv, () => ({ level: lv(), rebirths: XP.getRebirths(), words: 0, letters: 0 }));
  const CAP = LX.LETTER_RATE_CAP; // 12 letters a second
  let t = T0;
  const end = T0 + hours * 3600e3;
  let hits = 0;
  let mashed = 0;
  while (t < end) {
    const len = 5 + Math.floor(rng() * 8);
    const w = Array.from({ length: len }, () => String.fromCharCode(97 + Math.floor(rng() * 26))).join('');
    const t0 = t;
    t += (len * 1000) / CAP;
    SIM_NOW = t;
    const f = judge.judge(w, t0, t);
    mashed += 1;
    if (f > 0) {
      hits += 1;
      const res = XP.creditXp(XP.loadProgress(), MW.menuWordXp(len, XP.levelXpPerLetter(undefined, undefined, 1), f));
      XP.saveProgress(res.state);
      if (lv() >= XP.rebirthThreshold(XP.getRebirths())) await flow.performRebirth();
    }
    t += 1000 / CAP; // the space
  }
  return { hours, mashed, hits, level: lv(), rebirths: XP.getRebirths(), server: { grants: srv.grants, violationCount: srv.violations.length } };
}

// ----------------------------------------------------------------------------- RUN
const fmt = (m) => (m == null ? '—' : m < 90 ? `${Math.round(m)} min` : `${(m / 60).toFixed(1)} h`);
const want = typeof args.bots === 'string' ? args.bots.split(',') : BOTS.map((b) => b.id);
const results = [];
for (const b of BOTS.filter((x) => want.includes(x.id))) {
  const t = process.hrtime.bigint();
  const r = await simulate(b);
  results.push(r);
  console.log(`=== FINAL ${b.id.toUpperCase()} (${b.lpm}/${b.wpm} game · ${b.mlpm} menu · ${Math.round(b.game * 100)}% games) ${(Number(process.hrtime.bigint() - t) / 1e9).toFixed(1)}s`);
  console.log(`  first: ${Object.entries(r.times).map(([k, v]) => `${k.replace('S', '★')} ${fmt(v)}`).join(' · ')}`);
  console.log(`  at ${HOURS} h: R${r.final.rebirths} ★${r.final.stars} P${r.final.power} LV${r.final.level} · ${r.words} game words · menu XP ${Math.round(r.menuXp)} · server ${r.server.grants} grants / ${r.server.ascends} ascends, refused ${JSON.stringify(r.server.refusals)}, violations ${r.server.violationCount}${r.spam ? ` · spam ${r.spam.calls} calls → ${r.spam.ok} ok, ${r.spam.replaysSent} replays` : ''}`);
}
const masher = want.includes('masher') || !args.bots ? await simulateMasher(Math.min(10, HOURS)) : null;
if (masher) console.log(`=== FINAL MASHER (${LX.LETTER_RATE_CAP} letters/s gibberish, ${masher.hours} h): ${masher.mashed} mashes → ${masher.hits} dictionary hits · LV${masher.level} R${masher.rebirths}`);

// ---- THE TABLE vs FINAL (markdown rows start with '|': the CI job copies them into the summary) ------------------------
const KEYS = ['R1', 'R3', 'R5', 'R10', 'S1', 'S2'];
const LABEL = { R1: 'R1', R3: 'R3', R5: 'R5', R10: 'R10', S1: '★1', S2: '★2' };
const misses = [];
const cellOf = (bot, key) => {
  const r = results.find((x) => x.bot === bot);
  if (!r) return '—';
  const want = FINAL[bot][key];
  const got = r.times[key];
  if (want == null) {
    const ok = got == null || got >= 0.75 * HOURS * 60;
    if (!ok) misses.push(`${bot} ${LABEL[key]}: ${fmt(got)} vs FINAL — (not before ${fmt(0.75 * HOURS * 60)})`);
    return `${fmt(got)} (FINAL —)${ok ? '' : ' **MISS**'}`;
  }
  if (want > HOURS * 60) return `${fmt(got)} (FINAL ${fmt(want)}, past horizon)`;
  const dev = got == null ? null : got / want - 1;
  const ok = dev != null && Math.abs(dev) <= TOL;
  if (!ok) misses.push(`${bot} ${LABEL[key]}: ${fmt(got)} vs FINAL ${fmt(want)}`);
  return `${fmt(got)} (FINAL ${fmt(want)}, ${dev == null ? 'never' : `${dev >= 0 ? '+' : ''}${Math.round(dev * 100)}%`})${ok ? '' : ' **MISS**'}`;
};
const table = [];
const tbots = ['casual', 'median', 'fast', 'menu'].filter((b) => results.some((r) => r.bot === b));
table.push(`| first time to (${HOURS} h, real modules) | ${tbots.join(' | ')} |`);
table.push(`|---|${tbots.map(() => '---').join('|')}|`);
for (const k of KEYS) table.push(`| ${LABEL[k]} | ${tbots.map((b) => cellOf(b, k)).join(' | ')} |`);

// ---- HARD CHECK ------------------------------------------------------------------------------------------------------
const med = results.find((r) => r.bot === 'median');
const fast = results.find((r) => r.bot === 'fast');
const sp = results.find((r) => r.bot === 'spammer');
const paceRows = [];
if (med && fast) {
  for (const k of KEYS) {
    const m = med.times[k];
    const f = fast.times[k];
    if (m == null || f == null) continue;
    const ratio = m / f;
    paceRows.push(`${LABEL[k]} ×${ratio.toFixed(2)}`);
    if (ratio > PACE_LIMIT) misses.push(`FAST ${LABEL[k]} is ×${ratio.toFixed(2)} the median's pace (limit ×${PACE_LIMIT})`);
  }
}
if (masher && (masher.level > 2 || masher.rebirths > 0)) misses.push(`MASHER earned LV${masher.level} R${masher.rebirths} (must be ≈ 0)`);
if (sp && med && (sp.final.rebirths !== med.final.rebirths || sp.final.stars !== med.final.stars || sp.final.level !== med.final.level)) misses.push(`SPAMMER ended R${sp.final.rebirths} ★${sp.final.stars} LV${sp.final.level} vs the median's R${med.final.rebirths} ★${med.final.stars} LV${med.final.level}`);
const violations = results.reduce((a, r) => a + r.server.violationCount, 0) + (masher ? masher.server.violationCount : 0);
if (violations) misses.push(`${violations} server violations (grant below the FINAL gate / not spent / > 1 per call / by a replay)`);

table.push(`| FAST ÷ MEDIAN pace (≤ ×${PACE_LIMIT}) | ${paceRows.join(' · ') || '—'} |${tbots.slice(1).map(() => '').join(' |')}`);
table.push(`| MASHER (${LX.LETTER_RATE_CAP}/s gibberish, ${masher ? masher.hours : '—'} h) | ${masher ? `LV${masher.level} R${masher.rebirths} (${masher.hits} hits / ${masher.mashed})` : '—'} |${tbots.slice(1).map(() => '').join(' |')}`);
table.push(`| SPAMMER vs MEDIAN | ${sp && med ? `R${sp.final.rebirths} ★${sp.final.stars} LV${sp.final.level} vs R${med.final.rebirths} ★${med.final.stars} LV${med.final.level} · ${sp.spam.calls} spam calls → ${sp.spam.ok} granted` : '—'} |${tbots.slice(1).map(() => '').join(' |')}`);
console.log('\n=== FINAL TABLE (claude/progression-FINAL.md "Sim", ±25%)');
for (const l of table) console.log(l);
const pass = misses.length === 0;
console.log(`\n=== FINAL HARD CHECK: ${pass ? 'PASS' : `FAIL (${misses.length})`}`);
for (const m of misses) console.log(`  MISS ${m}`);
fs.writeFileSync(path.join(HERE, `final-sim-${TAG}.json`), JSON.stringify({ hours: HOURS, final: FINAL, results, masher, table, misses, pass }, null, 1));
if (GATE && !pass) process.exitCode = 1;
