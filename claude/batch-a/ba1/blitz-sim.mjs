// BA1 — CATEGORY BLITZ bot playtest (50 seeded games, median human vs the real default MEDIUM bot).
// Imports the REAL backend logic (origin/main export): categoryBlitzLogic.js (createGame / submitAnswer /
// endRound / startNextRound / rerollCategory / pickRandomCategory), blitzLists.js (answerKey / onList),
// categoryBlitzBot.js (buildAnswerSchedule / pickAnswer). Math.random is replaced with a seeded PRNG
// BEFORE the modules load, so category picks + bot pacing/picks are reproducible.
//
//   node claude/batch-a/ba1/blitz-sim.mjs [--games 50] [--seed 1] [--be <path to backend export>]
//
// MEDIAN-HUMAN KNOWLEDGE MODEL (documented assumptions — see section-blitz.md):
//   * src/solo/words.recall.txt is NOT usable here: it is a common-word list with almost no proper
//     nouns (kenya, ohio, zeus, mario, pikachu, macbeth are all absent) and Blitz answers are ~all
//     proper nouns. So popularity = rank in Norvig's count_1w.txt (333k web unigrams, proper nouns
//     included; copied next to this file). An answer's rank = rank of its RAREST content token.
//   * P(know | fan of the topic) = 1 / (1 + (rank / 15000)^1.5)  -> rank 5k: 0.84, 15k: 0.5, 50k: 0.14.
//   * Topic familiarity ("fan") is drawn once per round per category: P(fan) by tier/pack (FAN_P below).
//     A non-fan knows an answer with 0.12x that probability (only the household names survive).
//   * Recall: read the prompt 1.2 s, then each next answer costs lognormal(median 1.4 s * (1 + 0.15 i),
//     sigma 0.5) — recall slows as easy answers deplete; known answers come out roughly popular-first.
//   * Typing 40 wpm = 0.30 s/char + 0.35 s submit. 4% typo rate (one adjacent-key substitution), which is
//     submitted, rejected (not_on_list), noticed (0.6 s) and retyped.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const GAMES = Number(arg('--games', 50));
const SEED = Number(arg('--seed', 1));
const BE = arg('--be', path.resolve(HERE, '../../../../ba1-wt/_be'));

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// Seed the global RNG the real modules use (pickRandomCategory, buildAnswerSchedule, pickAnswer).
Math.random = mulberry32(SEED * 7919);
const hrng = mulberry32(SEED * 104729 + 17); // human model rng (separate stream)
const gauss = (r) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
const lognorm = (r, med, sig) => med * Math.exp(sig * gauss(r));

const require = createRequire(path.join(BE, 'x.js'));
const L = require('./categoryBlitzLogic.js');
const B = require('./blitzLists.js');
const BOT = require('./categoryBlitzBot.js');

/* ---------------- popularity ---------------- */
const RANK = new Map();
fs.readFileSync(path.join(HERE, 'count_1w.txt'), 'utf8').split('\n').forEach((ln, i) => {
  const w = ln.split('\t')[0]; if (w && !RANK.has(w)) RANK.set(w, i + 1);
});
const STOP = new Set(['the', 'of', 'and', 'a', 'de', 'la', 'le', 'du', 'in', 'on', 'to', 'for']);
const tokRank = (t) => (/^\d+(st|nd|rd|th)?$/.test(t) ? 1 : RANK.get(t) || 1e6);
function answerRank(a) {
  const toks = String(a).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter((t) => t && !STOP.has(t));
  if (!toks.length) return 1e6;
  return Math.max(...toks.map(tokRank));
}
const pKnowFan = (rank) => 1 / (1 + Math.pow(rank / 15000, 1.5));
const NONFAN_MULT = 0.12;
const RECALL_MED = Number(arg('--recall', 1400)); // ms, median gap before the 1st answer
const RECALL_GROW = Number(arg('--grow', 0.15)); // each later answer's gap grows by this fraction

/* ---------------- member grouping (answers list = members + aliases + misspellings) ---------------- */
function lev(a, b) {
  const m = a.length, n = b.length; if (Math.abs(m - n) > 2) return 9;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) { const cur = [i]; for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; }
  return prev[n];
}
const depl = (k) => k.replace(/(es|s)$/, '');
function groupMembers(cat) {
  const ans = [...new Set(B.listFor(cat).answers)];
  const keys = ans.map(B.answerKey);
  const par = ans.map((_, i) => i);
  const find = (i) => (par[i] === i ? i : (par[i] = find(par[i])));
  const uni = (i, j) => { par[find(i)] = find(j); };
  const toks = ans.map((a) => B.answerKey(a) && a.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter((t) => !STOP.has(t)));
  for (let i = 0; i < ans.length; i++) for (let j = i + 1; j < ans.length; j++) {
    const a = keys[i], b = keys[j];
    if (depl(a) === depl(b)) { uni(i, j); continue; }
    if (a.length >= 6 && b.length >= 6 && lev(a, b) <= 2 && /\d/.test(a + b) === false
      && (answerRank(ans[i]) >= 1e6) !== (answerRank(ans[j]) >= 1e6)) { uni(i, j); continue; } // misspelling of a real word only ("c major"/"d major" stay apart)
  }
  // token-subset that points at exactly ONE superset ("cowboys" -> "dallas cowboys"; "new york" is ambiguous -> kept)
  for (let i = 0; i < ans.length; i++) {
    const sup = [];
    for (let j = 0; j < ans.length; j++) if (i !== j && toks[j].length > toks[i].length && toks[i].every((t) => toks[j].includes(t))) sup.push(j);
    if (sup.length === 1 && keys[i].length >= 4) uni(i, sup[0]);
  }
  const groups = new Map();
  ans.forEach((a, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(a); });
  return [...groups.values()].map((variants) => {
    const ranked = variants.map((v) => ({ v, r: answerRank(v) })).sort((x, y) => x.r - y.r || x.v.length - y.v.length);
    const best = ranked[0];
    return { variants, form: best.v, rank: best.r, misspell: new Set(ranked.filter((x) => {
      const k = B.answerKey(x.v), kb = B.answerKey(best.v);
      return x.r >= 1e6 && best.r < 1e6 && k !== kb && depl(k) !== depl(kb) && lev(k, kb) <= 2;
    }).map((x) => x.v)) };
  });
}

/* ---------------- topic familiarity ---------------- */
function fanP(cat) {
  const t = L.CATEGORY_TIER[cat]; const pack = B.listFor(cat).pack;
  if (t === 1) return 1.0;
  const general = ['world', 'science', 'food', 'movies', 'music', 'literature', 'history', 'geography', 'mythology'].includes(pack);
  if (t === 2) return general ? 0.8 : 0.55;
  if (pack === 'gaming') return 0.3;
  if (pack === 'sports') return 0.4;
  return 0.55;
}

const CAT = {};
for (const c of L.CATEGORIES) {
  const members = groupMembers(c);
  CAT[c] = { members, fan: fanP(c), tier: L.CATEGORY_TIER[c], pack: B.listFor(c).pack, size: B.listFor(c).size };
  CAT[c].expKnown = members.reduce((s, m) => s + pKnowFan(m.rank) * (CAT[c].fan + (1 - CAT[c].fan) * NONFAN_MULT), 0);
}

/* ---------------- human round ---------------- */
const KEYS = 'qwertyuiopasdfghjklzxcvbnm';
function typo(s) { const i = Math.floor(hrng() * s.length); const ch = s[i]; if (!/[a-z]/i.test(ch)) return s + 'x'; const k = KEYS.indexOf(ch.toLowerCase()); const sub = KEYS[(k + 1) % KEYS.length]; return s.slice(0, i) + sub + s.slice(i + 1); }
function planHuman(cat) {
  const C = CAT[cat]; const fan = hrng() < C.fan;
  const known = C.members.filter((m) => hrng() < pKnowFan(m.rank) * (fan ? 1 : NONFAN_MULT));
  known.forEach((m) => { m._o = Math.log(m.rank) + 1.2 * gauss(hrng); });
  known.sort((a, b) => a._o - b._o);
  const events = []; let t = 1200;
  for (let i = 0; i < known.length; i++) {
    t += lognorm(hrng, RECALL_MED * (1 + RECALL_GROW * i), 0.5);
    const form = known[i].form;
    const typeMs = form.length * 300 + 350;
    if (hrng() < 0.04) { t += typeMs; events.push({ t, text: typo(form), typo: true }); t += 600; }
    t += typeMs; events.push({ t, text: form });
  }
  return { fan, nKnown: known.length, events: events.filter((e) => e.t <= 30000) };
}

/* ---------------- game loop ---------------- */
const stats = { rounds: [], games: [], botAnswers: [], catCount: {}, rejects: { typo: 0, other: 0 } };
async function playRound(game, cat, roundIdx, g, scenario) {
  const plan = planHuman(cat);
  const sched = BOT.buildAnswerSchedule('medium', game.roundTimeSeconds).map((t) => ({ t, bot: true }));
  const evs = [...plan.events.map((e) => ({ ...e })), ...sched].sort((a, b) => a.t - b.t);
  const H = game.players[0], Bp = game.players[1];
  let firstHumanMs = null; let firstBotMs = null; const botAns = [];
  for (const e of evs) {
    if (e.bot) {
      const a = BOT.pickAnswer(cat, Bp.answers); if (!a) continue;
      const r = await L.submitAnswer(game, 'bot', a);
      if (r.accepted) { botAns.push({ a, t: e.t }); if (firstBotMs == null) firstBotMs = e.t; }
    } else {
      const r = await L.submitAnswer(game, 'human', e.text);
      if (r.accepted && firstHumanMs == null) firstHumanMs = e.t;
      if (!r.accepted) stats.rejects[e.typo ? 'typo' : 'other'] += 1;
    }
  }
  const C = CAT[cat];
  // bot answer quality
  const memberOf = new Map(); C.members.forEach((m, i) => m.variants.forEach((v) => memberOf.set(B.answerKey(v), i)));
  const seenMembers = new Map(); let dupMember = 0;
  for (const { a, t } of botAns) {
    const mi = memberOf.get(B.answerKey(a)); const m = C.members[mi];
    const obscure = pKnowFan(m.rank) < 0.15; // a FAN would know it < 15% of the time
    const misspelled = m.misspell.has(a);
    if (seenMembers.has(mi)) dupMember += 1; else seenMembers.set(mi, a);
    stats.botAnswers.push({ cat, a, t, obscure, misspelled, alias: B.answerKey(a) !== B.answerKey(m.form), dup: seenMembers.get(mi) !== a });
  }
  const rec = { g, scenario, round: roundIdx, cat, tier: C.tier, pack: C.pack, fan: plan.fan, nKnown: plan.nKnown, human: H.answers.length, bot: Bp.answers.length, firstHumanMs, firstBotMs, dupMember };
  stats.rounds.push(rec);
  return rec;
}

async function playGame(g, scenario) {
  const game = L.createGame([{ id: 'human', name: 'HUMAN' }, { id: 'bot', name: 'BOT' }], 'medium', true, null, null);
  const rounds = []; let rerollsUsed = 0;
  for (let r = 1; r <= game.rounds; r++) {
    if (r > 1) L.startNextRound(game);
    // smart-reroll scenario: the solo player rerolls a prompt they'd expect to name < 3 answers for
    if (scenario === 'reroll') {
      while (game.rerollsRemaining > 0 && CAT[game.currentCategory].expKnown < 3) { L.rerollCategory(game); rerollsUsed++; }
    }
    const cat = game.currentCategory;
    stats.catCount[cat] = (stats.catCount[cat] || 0) + 1;
    rounds.push(await playRound(game, cat, r, g, scenario));
    L.endRound(game);
  }
  L.startNextRound(game); // -> finished, winner resolved by the real determineWinner
  const h = game.players[0].score, b = game.players[1].score;
  const r1 = rounds[0]; const r1Lead = r1.human === r1.bot ? 'tie' : r1.human > r1.bot ? 'human' : 'bot';
  const res = { g, scenario, cats: rounds.map((x) => x.cat), h, b, winner: game.winnerId, r1Lead, r1Margin: r1.bot - r1.human, rerollsUsed };
  stats.games.push(res); return res;
}

const out = [];
const log = (...a) => { const s = a.join(' '); out.push(s); console.log(s); };
const pct = (n, d) => (d ? ((100 * n) / d).toFixed(1) + '%' : 'n/a');

// PROPOSED FIX (data-only): re-tier the curated pool so tier 1 isn't 2 categories carrying 50% of draws.
// L.CATEGORY_TIER is the live object pickWeightedByTier reads, so mutating it simulates editing
// TIER_BROAD / TIER_NICHE in categoryBlitzLogic.js.
export const FIX_PROMOTE_T1 = ['Asian countries', 'European national capitals', 'African countries', 'US state capitals',
  'US presidents', 'Summer Olympic sports', 'Major human organs', 'Pixar feature films', 'Latin American countries',
  'NBA teams', 'NFL teams', 'English & British monarchs'];
// fix2 also drops the measured-dead categories (P(<3 found) >= 0.6) from rotation.
export const FIX_DROP = ['Pokémon starters', 'Japanese shoguns', 'Inca emperors', 'Skyrim races', 'Minecraft Ore Blocks', 'Dark Souls 1 bosses', "Donkey Kong's Kong family"];
const SAVED_CATS = L.CATEGORIES.slice();
export const FIX_DEMOTE_T3 = ['Japanese shoguns', 'Inca emperors', 'Major and minor keys', 'Boxing weight classes'];
const SAVED_TIER = { ...L.CATEGORY_TIER };
function applyFix(on, drop) {
  L.CATEGORIES.length = 0; SAVED_CATS.forEach((c) => { if (!(drop && FIX_DROP.includes(c))) L.CATEGORIES.push(c); });
  for (const c of L.CATEGORIES) L.CATEGORY_TIER[c] = SAVED_TIER[c];
  if (on) { FIX_PROMOTE_T1.forEach((c) => { L.CATEGORY_TIER[c] = 1; }); FIX_DEMOTE_T3.forEach((c) => { L.CATEGORY_TIER[c] = 3; }); }
}
for (const scenario of ['noreroll', 'reroll', 'fix', 'fix2']) { applyFix(scenario.startsWith('fix'), scenario === 'fix2'); for (let g = 0; g < GAMES; g++) await playGame(g, scenario); }
applyFix(false);

log(`# BA1 Category Blitz sim — ${GAMES} games x 2 scenarios, seed ${SEED}, 1 human vs 1 MEDIUM bot (the default add_bot), difficulty medium (4 rerolls), 3 x ${L.ROUND_TIME_SECONDS}s`);
log(`library: ${L.CATEGORIES.length} curated categories; tiers: T1=${L.TIER_POOLS[1].length} T2=${L.TIER_POOLS[2].length} T3=${L.TIER_POOLS[3].length}; TIER_WEIGHTS ${JSON.stringify(L.TIER_WEIGHTS)}`);
log(`T1 pool: ${L.TIER_POOLS[1].join(', ')}`);

for (const sc of ['noreroll', 'reroll', 'fix', 'fix2']) {
  const R = stats.rounds.filter((r) => r.scenario === sc); const G = stats.games.filter((x) => x.scenario === sc);
  log(`\n## scenario: ${sc}  (${G.length} games, ${R.length} rounds)`);
  const lt3 = R.filter((r) => r.human < 3), zero = R.filter((r) => r.human === 0);
  log(`human < 3 answers in round: ${lt3.length}/${R.length} = ${pct(lt3.length, R.length)}; zero answers: ${zero.length} = ${pct(zero.length, R.length)}`);
  for (const t of [1, 2, 3]) { const rt = R.filter((r) => r.tier === t); log(`  tier ${t}: rounds ${rt.length}, <3: ${pct(rt.filter((r) => r.human < 3).length, rt.length)}, mean human ${(rt.reduce((s, r) => s + r.human, 0) / (rt.length || 1)).toFixed(2)}, mean bot ${(rt.reduce((s, r) => s + r.bot, 0) / (rt.length || 1)).toFixed(2)}`); }
  const byPack = {}; R.forEach((r) => { (byPack[r.pack] ||= []).push(r); });
  for (const [p, rs] of Object.entries(byPack)) log(`  pack ${p}: rounds ${rs.length}, <3: ${pct(rs.filter((r) => r.human < 3).length, rs.length)}, mean human ${(rs.reduce((s, r) => s + r.human, 0) / rs.length).toFixed(2)}`);
  const hopeless = R.filter((r) => r.bot - r.human >= 4);
  log(`hopeless rounds (bot >= human+4): ${hopeless.length} = ${pct(hopeless.length, R.length)}`);
  const noFirst10 = R.filter((r) => r.firstHumanMs == null || r.firstHumanMs > 10000);
  log(`rounds where human has nothing on the board by 10s: ${pct(noFirst10.length, R.length)}`);
  const hw = G.filter((x) => x.winner === 'human').length;
  log(`games: human wins ${hw}/${G.length} = ${pct(hw, G.length)}; mean score human ${(G.reduce((s, x) => s + x.h, 0) / G.length).toFixed(1)} vs bot ${(G.reduce((s, x) => s + x.b, 0) / G.length).toFixed(1)}`);
  const decided = G.filter((x) => x.r1Lead !== 'tie' && x.winner === x.r1Lead).length;
  log(`R1 leader (non-tie) wins the game: ${decided}/${G.filter((x) => x.r1Lead !== 'tie').length}; games bot leads R1 by >=4: ${pct(G.filter((x) => x.r1Margin >= 4).length, G.length)} — of those human came back: ${G.filter((x) => x.r1Margin >= 4 && x.winner === 'human').length}`);
  if (sc === 'reroll') log(`rerolls used per game: mean ${(G.reduce((s, x) => s + x.rerollsUsed, 0) / G.length).toFixed(2)}; games that ran out (4 used): ${G.filter((x) => x.rerollsUsed >= 4).length}`);
  // repetition
  const cc = {}; G.forEach((x) => x.cats.forEach((c) => { cc[c] = (cc[c] || 0) + 1; }));
  const top = Object.entries(cc).sort((a, b) => b[1] - a[1]).slice(0, 8);
  log(`category appearances (top): ${top.map(([c, n]) => `${c} ${n} (${pct(n, G.length)} of games)`).join('; ')}`);
  log(`distinct categories seen: ${Object.keys(cc).length}/${L.CATEGORIES.length}`);
  let consecShare = 0; for (let i = 1; i < G.length; i++) if (G[i].cats.some((c) => G[i - 1].cats.includes(c))) consecShare++;
  log(`back-to-back games sharing >=1 category: ${consecShare}/${G.length - 1} = ${pct(consecShare, G.length - 1)}`);
  // worst categories actually met
  const byCat = {}; R.forEach((r) => { (byCat[r.cat] ||= []).push(r.human); });
  const worst = Object.entries(byCat).map(([c, xs]) => [c, xs.reduce((s, v) => s + v, 0) / xs.length, xs.length]).sort((a, b) => a[1] - b[1]).slice(0, 12);
  log(`worst categories met (mean human answers, n rounds): ${worst.map(([c, m, n]) => `${c} ${m.toFixed(1)} (n${n})`).join('; ')}`);
}

const BA = stats.botAnswers;
log(`\n## bot answer quality (both scenarios, ${BA.length} accepted bot answers)`);
log(`obscure (a FAN of the topic knows it < 15% of the time): ${BA.filter((x) => x.obscure).length} = ${pct(BA.filter((x) => x.obscure).length, BA.length)}`);
log(`misspelled variant submitted & scored (e.g. "djbouti"): ${BA.filter((x) => x.misspelled).length} = ${pct(BA.filter((x) => x.misspelled).length, BA.length)}`);
log(`2nd+ variant of a member it already scored this round (double point for one thing): ${BA.filter((x) => x.dup).length} = ${pct(BA.filter((x) => x.dup).length, BA.length)}`);
log(`bot answer before 2.0s: ${pct(BA.filter((x) => x.t < 2000).length, BA.length)}; rounds where bot's first answer lands before human's first: ${pct(stats.rounds.filter((r) => r.firstBotMs != null && (r.firstHumanMs == null || r.firstBotMs < r.firstHumanMs)).length, stats.rounds.length)}`);
log(`examples obscure: ${[...new Set(BA.filter((x) => x.obscure).map((x) => `${x.a} [${x.cat}]`))].slice(0, 14).join(', ')}`);
log(`examples misspelled: ${[...new Set(BA.filter((x) => x.misspelled).map((x) => `${x.a} [${x.cat}]`))].slice(0, 14).join(', ')}`);
log(`examples dup-member: ${[...new Set(BA.filter((x) => x.dup).map((x) => `${x.a} [${x.cat}]`))].slice(0, 14).join(', ')}`);
for (const c of ['US states', 'Human body systems']) { const xs = BA.filter((x) => x.cat === c); log('  ' + c + ': bot answers ' + xs.length + ', alias/misspelling (not the canonical form): ' + pct(xs.filter((x) => x.alias).length, xs.length) + ', double-scored member: ' + pct(xs.filter((x) => x.dup).length, xs.length)); }
{ const R = stats.rounds; const byT = [1, 2, 3].map((t) => R.filter((r) => r.tier === t)); log('bot-vs-human gap by tier (all scenarios): ' + byT.map((rs, i) => 'T' + (i + 1) + ' human ' + (rs.reduce((s, r) => s + r.human, 0) / rs.length).toFixed(2) + ' bot ' + (rs.reduce((s, r) => s + r.bot, 0) / rs.length).toFixed(2) + ' hopeless(bot>=h+4) ' + pct(rs.filter((r) => r.bot - r.human >= 4).length, rs.length)).join(' | ')); }
log(`human rejects: typo ${stats.rejects.typo}, other ${stats.rejects.other}`);

/* ---------------- full library pass ---------------- */
log(`\n## full library pass — expected answers a median player FINDS in 30 s (400 MC trials each, typos on)`);
const lib = [];
for (const c of L.CATEGORIES) {
  let found = 0, lt3 = 0; const N = 400;
  for (let i = 0; i < N; i++) { const p = planHuman(c); const keys = new Set(); p.events.forEach((e) => { if (!e.typo && B.onList(c, e.text)) keys.add(B.answerKey(e.text)); }); found += keys.size; if (keys.size < 3) lt3++; }
  const C = CAT[c];
  const misspellN = C.members.reduce((s, m) => s + m.misspell.size, 0);
  const variantsExtra = B.listFor(c).answers.length - C.members.length;
  const dupable = C.members.filter((m) => new Set(m.variants.filter((v) => answerRank(v) < 1e6).map(B.answerKey)).size >= 2).length;
  lib.push({ c, tier: C.tier, pack: C.pack, size: C.size, groups: C.members.length, fanP: C.fan, expKnown: +C.expKnown.toFixed(1), found30: +(found / N).toFixed(2), pLt3: +(lt3 / N).toFixed(2), misspellN, variantsExtra, dupable, drawP: 0 });
}
// real draw probability per category (round 1 of a fresh game, real pickRandomCategory)
const drawN = 20000; const drawCnt = {};
for (let i = 0; i < drawN; i++) { const c = L.pickRandomCategory(null, null); drawCnt[c] = (drawCnt[c] || 0) + 1; }
lib.forEach((x) => { x.drawP = +((drawCnt[x.c] || 0) / drawN).toFixed(4); });
lib.sort((a, b) => a.found30 - b.found30);
log(`categories with P(<3 found) >= 50%: ${lib.filter((x) => x.pLt3 >= 0.5).length}/${lib.length}; weighted by real draw odds: ${pct(lib.filter((x) => x.pLt3 >= 0.5).reduce((s, x) => s + x.drawP, 0) * 100, 100)} of round-1 draws`);
log(`round-weighted P(<3 found) over the whole library (real draw odds): ${(lib.reduce((s, x) => s + x.drawP * x.pLt3, 0) * 100).toFixed(1)}%`);
log('tier\tpack\tsize\tgrp\tfanP\texpKnown\tfound30\tP(<3)\tdrawP\tmisspell\tcategory');
for (const x of lib) log(`${x.tier}\t${x.pack}\t${x.size}\t${x.groups}\t${x.fanP}\t${x.expKnown}\t${x.found30}\t${x.pLt3}\t${x.drawP}\t${x.misspellN}\t${x.c}`);

/* ---------------- large-N draw check of each config (20k games of real category draws, no play) ---------------- */
const pLt3 = Object.fromEntries(lib.map((x) => [x.c, x.pLt3]));
for (const [name, on, drop] of [['baseline', false, false], ['fix (re-tier)', true, false], ['fix2 (re-tier + drop 7 dead)', true, true]]) {
  applyFix(on, drop);
  const N = 20000; const per = {}; let lt3 = 0, rounds = 0, share = 0; let prev = null;
  for (let i = 0; i < N; i++) {
    const used = new Set(); const cats = [];
    for (let r = 0; r < 3; r++) { const c = L.pickRandomCategory(used, null); used.add(c); cats.push(c); per[c] = (per[c] || 0) + 1; lt3 += pLt3[c]; rounds++; }
    if (prev && cats.some((c) => prev.includes(c))) share++;
    prev = cats;
  }
  const top = Object.entries(per).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([c, n]) => c + ' ' + pct(n, N) + ' of games');
  log(name + ': expected rounds with <3 found ' + pct(lt3, rounds) + '; back-to-back games sharing a category ' + pct(share, N - 1) + '; top: ' + top.join(', '));
}
applyFix(false, false);

/* ---------------- variant probe: natural plural/singular of an accepted answer that scores TWICE ---------------- */
let twice = 0, probes = 0; const ex = [];
for (const c of L.CATEGORIES) {
  const keys = B.listFor(c).keys;
  for (const k of keys) { if (keys.has(k + 's') && !k.endsWith('s')) { twice++; if (ex.length < 16) ex.push(`${c}: ${k}/${k}s`); } probes++; }
}
log(`\n## same-member double scoring available to a human: ${twice} singular/plural key pairs both on-list (each scores separately; answerKey keeps the 's'). e.g. ${ex.join('; ')}`);

// would a depluralising answerKey merge two DIFFERENT members? (safety check for the proposed fix)
let coll = 0; const cex = [];
for (const c of L.CATEGORIES) {
  const owner = new Map();
  CAT[c].members.forEach((m, mi) => m.variants.forEach((v) => { const k = depl(B.answerKey(v)); if (owner.has(k) && owner.get(k) !== mi) { coll++; if (cex.length < 12) cex.push(c + ': ' + v + ' ~ ' + CAT[c].members[owner.get(k)].form); } else owner.set(k, mi); }));
}
log('depluralised-key collisions between DIFFERENT members (heuristic grouping): ' + coll + (cex.length ? ' e.g. ' + cex.join('; ') : ''));
fs.writeFileSync(path.join(HERE, 'blitz-sim.txt'), out.join('\n') + '\n');
fs.writeFileSync(path.join(HERE, 'blitz-sim.json'), JSON.stringify({ games: stats.games, rounds: stats.rounds, library: lib }, null, 1));
