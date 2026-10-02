// fuse-sim.mjs — BA1: 50 seeded FUSE runs with a median human, logging UNFUN moments.
//   node claude/batch-a/ba1/fuse-sim.mjs            (writes fuse-sim.txt + fuse-sim.json next to it)
//   VOCAB=9000 node ... / GAMES=1000 node ...       (sensitivity rows)
// Real engine: src/solo/fuse.js (createFuseEngine). Clock: useSoloGame.js — budget = e.state.fuseMs
// (FuseGame.jsx:132), clock restarts on accept (useSoloGame.js:212) and after a survived expire
// (useSoloGame.js:153-156), word 1 armed on first char (useSoloGame.js:166-178).
import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { imp, SRC, loadWords, produceMs, pct, quant, mean } from './solo-common.mjs';

// FIX-PROBES (re-measure a proposed fix without touching src): FUSE_JS=<path to a patched fuse.js>,
// STEERP=<0..1>, POOL_ADD="m:jo,ju;e:ze" (extra fragments appended to a tier).
const { createFuseEngine } = process.env.FUSE_JS ? await import(pathToFileURL(process.env.FUSE_JS).href) : await imp('solo/fuse.js');
const STEERP = process.env.STEERP != null ? +process.env.STEERP : undefined;
const { mulberry32 } = await imp('solo/shared.js');
const HERE = path.dirname(fileURLToPath(import.meta.url));

const GAMES = +(process.env.GAMES || 50);
const VOCAB = +(process.env.VOCAB || 15000);
const AIM = 0.5; // frenzy-sim.mjs median: 50% of picks aim at a still-dark letter
const { recall, accept, rank, pools } = loadWords();
for (const part of (process.env.POOL_ADD || '').split(';').filter(Boolean)) { const [t, fs] = part.split(':'); for (const f of fs.split(',')) if (!pools[t].includes(f)) pools[t].push(f); }
const poolSet = new Set([...pools.e, ...pools.m, ...pools.h, ...pools.b]);
const maxF = Math.max(...[...poolSet].map((f) => f.length));

// known words indexed by every servable fragment they contain (frequency order kept)
const byFrag = new Map();
for (const w of recall.slice(0, VOCAB)) {
  if (w.length < 3) continue;
  const seen = new Set();
  for (let L = 2; L <= maxF; L++) for (let i = 0; i + L <= w.length; i++) { const f = w.slice(i, i + L); if (poolSet.has(f)) seen.add(f); }
  for (const f of seen) { let a = byFrag.get(f); if (!a) byFrag.set(f, (a = [])); a.push(w); }
}

// ---- static audit: how many words does the median know for each fragment, per tier ----
const audit = {};
for (const t of ['e', 'm', 'h', 'b']) {
  const counts = pools[t].map((f) => [f, (byFrag.get(f) || []).length]);
  audit[t] = {
    n: counts.length,
    lt3: counts.filter(([, c]) => c < 3).map(([f, c]) => `${f}:${c}`),
    lt10: counts.filter(([, c]) => c < 10).length,
  };
}
const tierOf = {};
for (const t of ['e', 'm', 'h', 'b']) for (const f of pools[t]) (tierOf[f] = tierOf[f] || []).push(t);
const crossTier = Object.entries(tierOf).filter(([, v]) => v.length > 1);

function play(seed) {
  const rng = mulberry32(seed);
  const eng = createFuseEngine({ accept, pools, rng, ...(STEERP != null ? { steerP: STEERP } : {}) });
  let served = eng.start();
  const g = { words: 0, expires: 0, clockMs: 0, wallMs: 0, frenzyAtMs: null, frenzyAtWord: null, served: [], deadTurns: 0, thinTurns: 0,
    expireStreakMax: 0, longestNoWordMs: 0, budgets: [], margins: [], litAtDeath: 0, darkAtDeath: '', litPeak: 0, tiers: { e: 0, m: 0, h: 0, b: 0 },
    expireByTier: { e: 0, m: 0, h: 0, b: 0 }, deathFrags: [], firstExpireAtWord: null };
  let streak = 0, noWordMs = 0, armed = false;
  for (let turn = 0; turn < 5000 && eng.state.alive; turn++) {
    const frag = served.fragment, tier = eng.state.tier, budget = eng.state.fuseMs;
    g.served.push(frag); g.tiers[tier]++; g.budgets.push(budget);
    const pool = byFrag.get(frag) || [];
    const cands = [];
    for (const w of pool) { if (!eng.state.used.has(w)) cands.push(w); if (cands.length >= 30) break; }
    if (cands.length === 0) g.deadTurns++;
    else if (cands.length < 3) g.thinTurns++;
    let word = null;
    if (cands.length) {
      const lit = eng.state.lettersUsed;
      const dark = cands.filter((w) => [...w].some((c) => !lit.has(c)));
      word = dark.length && rng() < AIM ? dark[Math.floor(rng() * dark.length)] : cands[Math.floor(rng() * cands.length)];
    }
    let t = word ? produceMs(rng, word, cands, rank) : null;
    let onClock = t ? (armed ? t.total : t.type + t.typo) : Infinity; // word 1: think is off-clock
    const wall = t ? t.total : budget;
    hz(eng.state.wordsSolved, tier, onClock > budget);
    if (onClock > budget) {
      // expire: the whole fuse burns, a life goes (FuseGame.jsx:133 → fuse.js:246)
      g.expires++; g.expireByTier[tier]++; if (g.firstExpireAtWord === null) g.firstExpireAtWord = g.words;
      armed = true; streak++; g.expireStreakMax = Math.max(g.expireStreakMax, streak);
      g.clockMs += budget; g.wallMs += budget; noWordMs += budget;
      g.longestNoWordMs = Math.max(g.longestNoWordMs, noWordMs);
      const r = eng.expire();
      if (r.ended) { g.deathFrags.push(frag); break; }
      served = { fragment: eng.state.fragment };
      continue;
    }
    g.margins.push(budget - onClock);
    armed = true;
    const r = eng.submit(word);
    if (!r.ok) throw new Error('engine rejected a known word: ' + word + ' ' + r.reason);
    streak = 0; noWordMs = 0;
    g.clockMs += onClock; g.wallMs += wall; g.words++;
    g.litPeak = Math.max(g.litPeak, r.stripCleared ? 26 : eng.state.lettersUsed.size);
    if (r.stripCleared && g.frenzyAtMs === null) { g.frenzyAtMs = g.wallMs; g.frenzyAtWord = g.words; }
    served = r;
  }
  g.litAtDeath = eng.state.lettersUsed.size;
  g.darkAtDeath = 'abcdefghijklmnopqrstuvwxyz'.split('').filter((c) => !eng.state.lettersUsed.has(c)).join('');
  const seen = new Map(); let rep = 0; const repFr = [];
  for (const f of g.served) { if (seen.has(f)) { rep++; repFr.push(f); } seen.set(f, 1); }
  g.repeats = rep; g.repeatFrags = repFr;
  g.strips = eng.state.stripsCleared;
  return g;
}

const HZ = {}; // hazard table: words-solved bucket x tier -> [turns, expires]
const hz = (w, t, exp) => { const k = `${Math.min(30, Math.floor(w / 5) * 5)}${t}`; const a = HZ[k] || (HZ[k] = [0, 0]); a[0]++; if (exp) a[1]++; };
const games = [];
for (let i = 0; i < GAMES; i++) games.push(play(1000 + i * 7919));

const N = games.length;
const turns = games.reduce((s, g) => s + g.served.length, 0);
const darkHist = {};
for (const g of games) if (g.strips === 0 && g.litAtDeath >= 20) for (const c of g.darkAtDeath) darkHist[c] = (darkHist[c] || 0) + 1;
const reachedGames = games.filter((g) => g.frenzyAtMs !== null);
const deathFrag = {};
for (const g of games) for (const f of g.deathFrags) deathFrag[f] = (deathFrag[f] || 0) + 1;
const expTot = { e: 0, m: 0, h: 0, b: 0 }, tierTot = { e: 0, m: 0, h: 0, b: 0 };
for (const g of games) for (const t of 'emhb') { expTot[t] += g.expireByTier[t]; tierTot[t] += g.tiers[t]; }
// late-game hazard: words-solved bucket vs expire rate
const marginsAll = games.flatMap((g) => g.margins);

const out = {
  src: SRC, games: N, vocab: VOCAB, probes: { FUSE_JS: process.env.FUSE_JS || null, STEERP: STEERP ?? null, POOL_ADD: process.env.POOL_ADD || null },
  wordsPerRun: { mean: mean(games.map((g) => g.words)), p10: quant(games.map((g) => g.words), 0.1), p50: quant(games.map((g) => g.words), 0.5), p90: quant(games.map((g) => g.words), 0.9) },
  runWallSec: { p10: +(quant(games.map((g) => g.wallMs), 0.1) / 1000).toFixed(1), p50: +(quant(games.map((g) => g.wallMs), 0.5) / 1000).toFixed(1), p90: +(quant(games.map((g) => g.wallMs), 0.9) / 1000).toFixed(1) },
  runsUnder5Words: pct(games.filter((g) => g.words < 5).length, N),
  runsUnder30sWall: pct(games.filter((g) => g.wallMs < 30000).length, N),
  frenzyRunPct: pct(reachedGames.length, N),
  frenzyAtWord: { p50: quant(reachedGames.map((g) => g.frenzyAtWord), 0.5), min: quant(reachedGames.map((g) => g.frenzyAtWord), 0) },
  frenzyAtSec: { p50: reachedGames.length ? +(quant(reachedGames.map((g) => g.frenzyAtMs), 0.5) / 1000).toFixed(0) : null },
  litPeakMean: mean(games.map((g) => g.litPeak)),
  runsDiedWith20to25Lit: pct(games.filter((g) => g.strips === 0 && g.litAtDeath >= 20).length, N),
  runsDiedWith23to25Lit: pct(games.filter((g) => g.strips === 0 && g.litAtDeath >= 23).length, N),
  darkLetterAtDeath_whenLit20plus: Object.fromEntries(Object.entries(darkHist).sort((a, b) => b[1] - a[1])),
  deadTurnsPct: pct(games.reduce((s, g) => s + g.deadTurns, 0), turns),
  thinTurnsPct: pct(games.reduce((s, g) => s + g.thinTurns, 0), turns),
  runsWithADeadTurn: pct(games.filter((g) => g.deadTurns > 0).length, N),
  expirePct: pct(games.reduce((s, g) => s + g.expires, 0), turns),
  expirePctByTier: Object.fromEntries('emhb'.split('').map((t) => [t, pct(expTot[t], tierTot[t])])),
  servedByTier: tierTot,
  firstExpireAtWord_p50: quant(games.filter((g) => g.firstExpireAtWord !== null).map((g) => g.firstExpireAtWord), 0.5),
  runsWith2ExpiresBackToBack: pct(games.filter((g) => g.expireStreakMax >= 2).length, N),
  longestNoWordSec_p50: +(quant(games.map((g) => g.longestNoWordMs), 0.5) / 1000).toFixed(1),
  marginMs: { p10: Math.round(quant(marginsAll, 0.1)), p50: Math.round(quant(marginsAll, 0.5)), p90: Math.round(quant(marginsAll, 0.9)) },
  runsWithRepeatFragment: pct(games.filter((g) => g.repeats > 0).length, N),
  repeatsPerRun: mean(games.map((g) => g.repeats)),
  repeatFragExamples: games.flatMap((g) => g.repeatFrags).slice(0, 30),
  deathFragTop: Object.entries(deathFrag).sort((a, b) => b[1] - a[1]).slice(0, 15),
  audit: { ...audit, crossTierFragments: crossTier.length, crossTierExamples: crossTier.slice(0, 15).map(([f, v]) => `${f}:${v.join('')}`) },
};

// fuse budget by words solved (engine's own curve) vs median produce
const { fuseBase, FUSE_TIER_MULT } = await imp('solo/fuse.js');
out.hazardByWordsTier = Object.fromEntries(Object.entries(HZ).sort().map(([k, [n, e]]) => [k, `${pct(e, n)}% of ${n}`]));
out.fuseBaseCurve = [0, 5, 10, 15, 20, 25, 30, 40].map((w) => [w, Math.round(fuseBase(w))]);

const txt = [
  `FUSE BA1 sim — ${N} games, vocab top ${VOCAB}, src ${SRC}`,
  JSON.stringify(out, null, 1),
].join('\n');
console.log(txt);
const tag = process.env.TAG || '';
writeFileSync(path.join(HERE, `fuse-sim${tag}.txt`), txt);
writeFileSync(path.join(HERE, `fuse-sim${tag}.json`), JSON.stringify({ summary: out, games: games.map((g) => ({ ...g, budgets: undefined, margins: undefined })) }, null, 1));
