#!/usr/bin/env node
// final-sim.mjs — PROGRESSION FINAL v2 (claude/progression-FINAL.md v2, Oct 6 22:30, FROZEN) on the REAL modules — the CI
// port of claude/progression-final-sim.py. Turns the SEASON2 flag on before the economy loads, so every number comes
// from the shipped code behind the flag:
//   game letters → letterXp.creditLetterXp (season 2: every typed game letter ×1, no cap); wins → wins.awardWordXp +
//     wins.bankWordWins; KEY → shop.buyKeyPower (the ladder, 150 × 5^T); menu keys → xp.xpPerInput (×0.2, ANY key,
//     no cap — mashing is the game) through xp.creditXp;
//   every rebirth → the app's client flow (rebirthFlow.performRebirth, season 2) against the JS model of the server
//     (rebirthRules.decideRebirth + finalRules.decideSubmitFinal on an in-memory econ-13 row, on the sim clock) — so the
//     12-an-hour pace cap and the LV 15 + 18·R → LV 1 rule are the real ones (027).
//
//   node claude/econ-oct2/final-sim.mjs                 # all bots, 10 h, table + HARD CHECK, exit 1 on any miss
//   node claude/econ-oct2/final-sim.mjs --hours=4 --bots=median,fast --no-gate
//
// ----------------------------------------------------------------------------- MODEL (the python's, stated)
// BOTS (the python sim's table): lpm_game · wpm_game · lpm_menu · share of play in games
//   casual 60 · 8 · 80 · 60% | median 100 · 14 · 150 · 70% | fast 160 · 26 · 250 · 75% | menu masher 0 · 0 · 500 · 0%
// GAMES: FUSE (MODE ×1, no rarity/combo weight) with FRENZY off; real words of mean length 5.5 (the python's ×1.1 =
//   length/5); every typed game letter pays ×1 (the python credits lpm_game × 10 × KEY × 3^R).
// MENU: ANY key at ×0.2 (xpPerInput) at the bot's menu speed.
// STEP: 10 s (python: 5 s) — game, menu, then the menu return (KEY greedily, REBIRTH whenever the level reaches the gate).
// NO MARKS, no rolls, no gems spent, no boosts, no OVERDRIVE, no achievements (the md: "no marks/overdrive").
// SPAMMER: the median's exact dice, plus every 10 min 1,000 rebirth calls through the client flow (half at once, half in a
//   row) and a replay of every old request id straight at the server — must end exactly level with the median.
// HARD CHECK (exit 1 → CI fails): every doc-table cell (R1 / R3 / R5 first times, the R reached at 10 h) within ±25%
//   (a "—" cell: not reached before 75% of the horizon); FAST ≤ 2× the median's pace to every milestone both reach;
//   SPAMMER's final R / level = the median's; no server grant below the v2 gate, not to LV 1, > 1 per call, or by a
//   replay; no ascension (hidden).
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
const HOURS = Number(args.hours) || 10;
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
const RBRULES = await imp('leaderboard/rebirthRules.js');
const RBFLOW = await imp('leaderboard/rebirthFlow.js');
const FRULES = await imp('leaderboard/finalRules.js');

// ----------------------------------------------------------------------------- WORDS
const readWords = (f) => fs.readFileSync(path.join(SRC, 'solo', f), 'utf8').split(/\s+/).filter(Boolean);
const recall = readWords('words.recall.txt');
const GAME_POOL = new Map(); // length → words (top 9k)
for (const w of recall.slice(0, 9000)) {
  if (!/^[a-z]+$/.test(w) || w.length < 3 || w.length > 12) continue;
  if (!GAME_POOL.has(w.length)) GAME_POOL.set(w.length, []);
  GAME_POOL.get(w.length).push(w);
}

// ----------------------------------------------------------------------------- THE FINAL v2 TABLE (md "Sim", minutes)
const H = 60;
const FINAL = {
  casual: { R1: 6, R3: 39, R5: 2.4 * H, END: 7 },
  median: { R1: 3, R3: 21, R5: 77, END: 8 },
  fast: { R1: 2, R3: 12, R5: 45, END: 9 },
  menu: { R1: 4, R3: 1.7 * H, R5: null, END: 4 },
};
const BOTS = [
  { id: 'casual', lpm: 60, wpm: 8, mlpm: 80, game: 0.6, seed: 1 },
  { id: 'median', lpm: 100, wpm: 14, mlpm: 150, game: 0.7, seed: 2 },
  { id: 'fast', lpm: 160, wpm: 26, mlpm: 250, game: 0.75, seed: 3 },
  { id: 'menu', lpm: 0, wpm: 0, mlpm: 500, game: 0, seed: 4 },
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
    if (fn === 'lb_ascend' && r.ok && !r.replay) { S.ascends += 1; S.violations.push({ t: SIM_NOW, kind: 'ascended' }); }
    if (fn === 'lb_rebirth' && S.row.rebirths > rb0) {
      S.grants += 1;
      const gate = ECON.rebirthGate(rb0); // the CLIENT's FINAL v2 rule, independent of the server model
      if (!(lv0 >= gate)) S.violations.push({ t: SIM_NOW, kind: 'below-gate', rebirths: rb0, level: lv0 });
      if (S.row.level !== 1) S.violations.push({ t: SIM_NOW, kind: 'not-lv1', from: lv0, to: S.row.level });
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
  const srv = makeSimServer();
  let words = 0;
  let letters = 0;
  const flow = makeSimFlow(srv, () => ({ level: lv(), rebirths: XP.getRebirths(), words, letters }));
  const first = {};
  const sampleWord = () => {
    const g = Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
    const L = Math.max(3, Math.min(8, Math.round(5.5 + 1.2 * g)));
    const arr = GAME_POOL.get(L);
    return arr[Math.floor(rng() * arr.length)];
  };
  let minute = 0;
  const note = (key) => { if (first[key] == null) first[key] = +(minute).toFixed(2); };
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
    // ---- the game share of this step: every typed letter ×1, words bank wins
    gameCarry += bot.wpm * bot.game * DT;
    const n = Math.floor(gameCarry);
    gameCarry -= n;
    for (let i = 0; i < n; i++) {
      const word = sampleWord();
      WINS.awardWordXp({ mode: 'fuse', wordLength: word.length, word });
      const prev = runWords;
      runWords += 1;
      WINS.bankWordWins({ mode: 'fuse', wordLength: word.length, prevWords: prev, nowWords: runWords, prevWeight: runWeight, nowWeight: (runWeight += 1) });
      if (runWords >= RUN_WORDS) { runWords = 0; runWeight = 0; }
      words += 1;
    }
    letterCarry += bot.lpm * bot.game * DT;
    const typed = Math.floor(letterCarry);
    letterCarry -= typed;
    if (typed) LX.creditLetterXp(typed, { mode: 'fuse' }); // season 2: × 1, the live XP per letter
    letters += typed;
    // ---- the menu share: ANY key at ×0.2 (xpPerInput), no cap
    menuCarry += bot.mlpm * (1 - bot.game) * DT;
    const keys = Math.floor(menuCarry);
    menuCarry -= keys;
    if (keys) {
      const xp = keys * XP.xpPerInput({ mode: 'menu' });
      menuXp += xp;
      XP.saveProgress(XP.creditXp(XP.loadProgress(), xp).state);
    }
    minute += DT;
    SIM_NOW = T0 + Math.round(minute * 60000);
    // ---- the menu return: KEY, REBIRTH (one server call each)
    for (let g = 0; g < 200; g++) if (!SHOP.buyKeyPower().ok) break;
    for (let g = 0; g < 20 && lv() >= XP.rebirthThreshold(XP.getRebirths()); g++) {
      const r = await flow.performRebirth();
      if (!r.ok) break;
      note(`R${r.rc}`);
    }
    if (bot.spam && minute - lastSpam >= SPAM_EVERY_MIN) {
      lastSpam = minute;
      const half = SPAM_CALLS / 2;
      const burst = await Promise.all(Array.from({ length: half }, () => flow.performRebirth()));
      for (const r of burst) if (r.ok) { spam.ok += 1; note(`R${r.rc}`); }
      for (let i = 0; i < half; i++) {
        const r = await flow.performRebirth();
        if (r.ok) { spam.ok += 1; note(`R${r.rc}`); }
      }
      spam.calls += SPAM_CALLS;
      for (const rid of srv.ids.slice(-200)) srv.rpc('lb_rebirth', { p_secret: 'sim', p_request_id: rid, p_season: 2 });
      spam.replaysSent += Math.min(200, srv.ids.length);
      // an ascension attempt is refused (hidden) and applies nothing
      await flow.performAscend();
    }
  }
  return {
    bot: bot.id, hours,
    times: { R1: first.R1 ?? null, R3: first.R3 ?? null, R5: first.R5 ?? null },
    final: { level: lv(), rebirths: XP.getRebirths(), stars: STORE.getStarsV3(), power: XP.getKeyTier(), wins: WINS.getWins() },
    words, letters, menuXp,
    server: { calls: srv.calls, grants: srv.grants, ascends: srv.ascends, replays: srv.replays, refusals: srv.refusals, violations: srv.violations.slice(0, 10), violationCount: srv.violations.length, stored: { rebirths: srv.row.rebirths, stars: srv.row.stars, level: srv.row.level } },
    spam: bot.spam ? spam : null,
  };
}

// ----------------------------------------------------------------------------- RUN
const fmt = (m) => (m == null ? '—' : m < 90 ? `${Math.round(m * 10) / 10} min` : `${(m / 60).toFixed(1)} h`);
const want = typeof args.bots === 'string' ? args.bots.split(',') : BOTS.map((b) => b.id);
const results = [];
for (const b of BOTS.filter((x) => want.includes(x.id))) {
  const t = process.hrtime.bigint();
  const r = await simulate(b);
  results.push(r);
  console.log(`=== FINAL ${b.id.toUpperCase()} (${b.lpm}/${b.wpm} game · ${b.mlpm} menu · ${Math.round(b.game * 100)}% games) ${(Number(process.hrtime.bigint() - t) / 1e9).toFixed(1)}s`);
  console.log(`  first: ${Object.entries(r.times).map(([k, v]) => `${k} ${fmt(v)}`).join(' · ')}`);
  console.log(`  at ${HOURS} h: R${r.final.rebirths} ★${r.final.stars} KEY T${r.final.power} LV${r.final.level} · ${r.words} game words · menu XP ${Math.round(r.menuXp)} · server ${r.server.grants} grants / ${r.server.ascends} ascends, refused ${JSON.stringify(r.server.refusals)}, violations ${r.server.violationCount}${r.spam ? ` · spam ${r.spam.calls} calls → ${r.spam.ok} ok, ${r.spam.replaysSent} replays` : ''}`);
}

// ---- THE TABLE vs FINAL v2 (markdown rows start with '|': the CI job copies them into the summary) -------------------
const KEYS = ['R1', 'R3', 'R5', 'END'];
const LABEL = { R1: 'R1', R3: 'R3', R5: 'R5', END: `R at ${HOURS} h` };
const misses = [];
const cellOf = (bot, key) => {
  const r = results.find((x) => x.bot === bot);
  if (!r) return '—';
  const want = FINAL[bot][key];
  if (key === 'END') {
    const got = r.final.rebirths;
    if (HOURS !== 10) return `R${got} (FINAL R${want} is the 10 h end — not checked at ${HOURS} h)`;
    const dev = got / want - 1;
    const ok = Math.abs(dev) <= TOL;
    if (!ok) misses.push(`${bot} ${LABEL[key]}: R${got} vs FINAL R${want}`);
    return `R${got} (FINAL R${want}, ${dev >= 0 ? '+' : ''}${Math.round(dev * 100)}%)${ok ? '' : ' **MISS**'}`;
  }
  const got = r.times[key];
  if (want == null) {
    const ok = got == null || got >= 0.75 * HOURS * 60;
    if (!ok) misses.push(`${bot} ${LABEL[key]}: ${fmt(got)} vs FINAL — (not before ${fmt(0.75 * HOURS * 60)})`);
    return `${fmt(got)} (FINAL —)${ok ? '' : ' **MISS**'}`;
  }
  const dev = got == null ? null : got / want - 1;
  const ok = dev != null && Math.abs(dev) <= TOL;
  if (!ok) misses.push(`${bot} ${LABEL[key]}: ${fmt(got)} vs FINAL ${fmt(want)}`);
  return `${fmt(got)} (FINAL ${fmt(want)}, ${dev == null ? 'never' : `${dev >= 0 ? '+' : ''}${Math.round(dev * 100)}%`})${ok ? '' : ' **MISS**'}`;
};
const table = [];
const tbots = ['casual', 'median', 'fast', 'menu'].filter((b) => results.some((r) => r.bot === b));
table.push(`| FINAL v2 (${HOURS} h, real modules) | ${tbots.join(' | ')} |`);
table.push(`|---|${tbots.map(() => '---').join('|')}|`);
for (const k of KEYS) table.push(`| ${LABEL[k]} | ${tbots.map((b) => cellOf(b, k)).join(' | ')} |`);

// ---- HARD CHECK ------------------------------------------------------------------------------------------------------
const med = results.find((r) => r.bot === 'median');
const fast = results.find((r) => r.bot === 'fast');
const sp = results.find((r) => r.bot === 'spammer');
const paceRows = [];
if (med && fast) {
  for (const k of ['R1', 'R3', 'R5']) {
    const m = med.times[k];
    const f = fast.times[k];
    if (m == null || f == null) continue;
    const ratio = m / f;
    paceRows.push(`${LABEL[k]} ×${ratio.toFixed(2)}`);
    if (ratio > PACE_LIMIT) misses.push(`FAST ${LABEL[k]} is ×${ratio.toFixed(2)} the median's pace (limit ×${PACE_LIMIT})`);
  }
}
if (sp && med && (sp.final.rebirths !== med.final.rebirths || sp.final.level !== med.final.level)) misses.push(`SPAMMER ended R${sp.final.rebirths} LV${sp.final.level} vs the median's R${med.final.rebirths} LV${med.final.level}`);
const stars = results.reduce((a, r) => a + r.final.stars + r.server.stored.stars, 0);
if (stars) misses.push(`${stars} ★ granted — ascension is hidden in FINAL v2`);
const violations = results.reduce((a, r) => a + r.server.violationCount, 0);
if (violations) misses.push(`${violations} server violations (grant below the v2 gate / not to LV 1 / > 1 per call / by a replay / an ascension)`);

table.push(`| FAST ÷ MEDIAN pace (≤ ×${PACE_LIMIT}) | ${paceRows.join(' · ') || '—'} |${tbots.slice(1).map(() => '').join(' |')}`);
table.push(`| SPAMMER vs MEDIAN | ${sp && med ? `R${sp.final.rebirths} LV${sp.final.level} vs R${med.final.rebirths} LV${med.final.level} · ${sp.spam.calls} spam calls → ${sp.spam.ok} granted` : '—'} |${tbots.slice(1).map(() => '').join(' |')}`);
console.log('\n=== FINAL v2 TABLE (claude/progression-FINAL.md "Sim", ±25%)');
for (const l of table) console.log(l);
const pass = misses.length === 0;
console.log(`\n=== FINAL HARD CHECK: ${pass ? 'PASS' : `FAIL (${misses.length})`}`);
for (const m of misses) console.log(`  MISS ${m}`);
fs.writeFileSync(path.join(HERE, `final-sim-${TAG}.json`), JSON.stringify({ hours: HOURS, final: FINAL, results, table, misses, pass }, null, 1));
if (GATE && !pass) process.exitCode = 1;
