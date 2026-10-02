// chain-sim.mjs — BA1: 50 seeded CHAIN runs with a median human, logging UNFUN moments.
//   node claude/batch-a/ba1/chain-sim.mjs          (writes chain-sim.txt + chain-sim.json next to it)
//   GAMES=1000 / VOCAB=9000 / AIM=0 / CHAIN_JS=<patched chain.js> / TAG=-x   (sensitivity + fix probes)
// Real engine: src/solo/chain.js (createChainEngine), fed exactly like ChainGame.jsx:75
// ({accept, topCommon}). Clock: useSoloGame.js — budget = e.currentTMax() (ChainGame.jsx:81) read when
// the turn clock starts (useSoloGame.js:130-138); a timeout is always death (ChainGame.jsx:82-85);
// word 1 is armed on its first typed char (useSoloGame.js:166-178).
// Human: solo-common.mjs (calibrated produce-time model + depletion + typos). Word choice: with
// probability AIM (0.5, = frenzy-sim median "aim") prefer a candidate whose END letter is fresh this
// run (the multiplier rule the HUD advertises), else a random one of the first 30 known candidates.
import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { imp, SRC, loadWords, produceMs, pct, quant, mean } from './solo-common.mjs';

const chainMod = process.env.CHAIN_JS ? await import(pathToFileURL(process.env.CHAIN_JS).href) : await imp('solo/chain.js');
const { createChainEngine, chainT, heatMul, DEAD_END_BELOW } = chainMod;
const { mulberry32 } = await imp('solo/shared.js');
const HERE = path.dirname(fileURLToPath(import.meta.url));

const GAMES = +(process.env.GAMES || 50);
const VOCAB = +(process.env.VOCAB || 15000);
const PUMP = process.env.AIM === 'pump'; // exploit probe: always end on 's' (the plural pump chain.js:55-57 guards)
const AIM = PUMP ? 0 : process.env.AIM != null ? +process.env.AIM : 0.5;
const { recall, accept, rank, topCommon } = loadWords();

const byFirst = new Map();
for (const w of recall.slice(0, VOCAB)) {
  if (w.length < 3) continue;
  let a = byFirst.get(w[0]); if (!a) byFirst.set(w[0], (a = [])); a.push(w);
}
const ABC = 'abcdefghijklmnopqrstuvwxyz'.split('');

// static audit: per letter — engine's top-3000 supply (dead-end test) vs what the median knows,
// and how often a known word ENDS on it (how often the chain lands there).
const endShare = {};
let knownN = 0;
for (const w of recall.slice(0, VOCAB)) { if (w.length < 3) continue; knownN++; endShare[w[w.length - 1]] = (endShare[w[w.length - 1]] || 0) + 1; }
const letterAudit = ABC.map((c) => ({ c, top3000: topCommon.filter((w) => w[0] === c).length, medianKnows: (byFirst.get(c) || []).length, endsHere: pct(endShare[c] || 0, knownN) }));

const MU = {}; // multiplier on accepted words, bucketed by k
const mu = (k, m) => { const b = Math.min(20, Math.floor(k / 5) * 5); const a = MU[b] || (MU[b] = []); a.push(m); };
const HZ = {};
const hz = (k, exp) => { const b = Math.min(40, Math.floor(k / 5) * 5); const a = HZ[b] || (HZ[b] = [0, 0]); a[0]++; if (exp) a[1]++; };

function play(seed) {
  const rng = mulberry32(seed);
  const eng = createChainEngine({ accept, topCommon, rng });
  const s = eng.state;
  const g = { words: 0, clockMs: 0, wallMs: 0, reroutes: 0, landings: [], thinLandings: 0, death: null, words_: [], hotTurns: 0, minBudget: Infinity, scarceTurns: 0 };
  let armed = false;
  for (let turn = 0; turn < 5000 && s.alive; turn++) {
    const L = s.requiredLetter;
    const budget = eng.currentTMax();
    g.minBudget = Math.min(g.minBudget, budget);
    const pool = byFirst.get(L) || [];
    const cands = [];
    for (const w of pool) { if (!s.used.has(w)) cands.push(w); if (cands.length >= 30) break; }
    if (cands.length < 6) g.scarceTurns++;
    if (heatMul(eng.endCountOf(L)) < 0.85) g.hotTurns++;
    let word = null;
    if (cands.length) {
      const pumpC = PUMP ? pool.filter((w) => !s.used.has(w) && w.endsWith('s')).slice(0, 30) : [];
      if (pumpC.length) { word = pumpC[Math.floor(rng() * pumpC.length)]; } else {
      const fresh = cands.filter((w) => !s.endedLetters.has(w[w.length - 1]));
      word = fresh.length && rng() < AIM ? fresh[Math.floor(rng() * fresh.length)] : cands[Math.floor(rng() * cands.length)];
      }
    }
    const t = word ? produceMs(rng, word, cands, rank) : null;
    const onClock = t ? (armed ? t.total : t.type + t.typo) : Infinity;
    hz(s.k, onClock > budget);
    if (onClock > budget) {
      eng.timeout();
      g.clockMs += budget; g.wallMs += budget;
      const known = (byFirst.get(L) || []).filter((w) => !s.used.has(w)).length;
      g.death = { letter: L, k: s.k, budget: Math.round(budget), base: Math.round(chainT(s.k)), heat: eng.endCountOf(L), heatMul: +heatMul(eng.endCountOf(L)).toFixed(2), knownUnused: known, need: t ? Math.round(onClock) : null, deadEnd: s.killedWasDeadEnd, atClockSec: +(g.clockMs / 1000).toFixed(1) };
      break;
    }
    armed = true;
    const r = eng.submit(word);
    if (!r.ok) throw new Error('rejected known word ' + word + ' ' + r.reason);
    g.words++; g.clockMs += onClock; g.wallMs += t.total; g.words_.push(word);
    if (r.rerouted) g.reroutes++;
    mu(s.k - 1, r.multiplier);
    g.landings.push(r.requiredLetter);
    const knownNext = (byFirst.get(r.requiredLetter) || []).filter((w) => !s.used.has(w)).length;
    if (knownNext < 30) g.thinLandings++;
  }
  g.score = s.score;
  return g;
}

const games = [];
for (let i = 0; i < GAMES; i++) games.push(play(2000 + i * 7919));
const N = games.length;
const deaths = games.map((g) => g.death).filter(Boolean);
const tally = (arr) => Object.fromEntries(Object.entries(arr.reduce((m, x) => ((m[x] = (m[x] || 0) + 1), m), {})).sort((a, b) => b[1] - a[1]));
const landTot = games.reduce((s, g) => s + g.landings.length, 0);

const out = {
  src: SRC, games: N, vocab: VOCAB, aim: AIM, probe: process.env.CHAIN_JS || null,
  wordsPerRun: { mean: mean(games.map((g) => g.words)), p10: quant(games.map((g) => g.words), 0.1), p50: quant(games.map((g) => g.words), 0.5), p90: quant(games.map((g) => g.words), 0.9), max: quant(games.map((g) => g.words), 1) },
  runClockSec: { p10: +(quant(games.map((g) => g.clockMs), 0.1) / 1000).toFixed(1), p50: +(quant(games.map((g) => g.clockMs), 0.5) / 1000).toFixed(1), p90: +(quant(games.map((g) => g.clockMs), 0.9) / 1000).toFixed(1) },
  runsDeadIn15sClock: pct(games.filter((g) => g.clockMs < 15000).length, N),
  runsUnder5Words: pct(games.filter((g) => g.words < 5).length, N),
  deathLetter: tally(deaths.map((d) => d.letter)),
  deathsOnHotLetter_heatMulLt085: pct(deaths.filter((d) => d.heatMul < 0.85).length, deaths.length),
  deathsOnHotLetter_heatMulLt07: pct(deaths.filter((d) => d.heatMul < 0.7).length, deaths.length),
  deathBudgetMs: { p10: quant(deaths.map((d) => d.budget), 0.1), p50: quant(deaths.map((d) => d.budget), 0.5), p90: quant(deaths.map((d) => d.budget), 0.9) },
  deathHeat: { p50: quant(deaths.map((d) => d.heat), 0.5), p90: quant(deaths.map((d) => d.heat), 0.9) },
  deathsWhereMedianKnowsLt30Unused: pct(deaths.filter((d) => d.knownUnused < 30).length, deaths.length),
  deathsFlaggedDeadEnd: pct(deaths.filter((d) => d.deadEnd).length, deaths.length),
  deathK: { p50: quant(deaths.map((d) => d.k), 0.5) },
  landingLetters: tally(games.flatMap((g) => g.landings)),
  landingShareTop: null,
  thinLandingsPct: pct(games.reduce((s, g) => s + g.thinLandings, 0), landTot),
  reroutesPerRun: mean(games.map((g) => g.reroutes)),
  scarceTurnsPct: pct(games.reduce((s, g) => s + g.scarceTurns, 0), games.reduce((s, g) => s + g.words + 1, 0)),
  hotTurnsPct: pct(games.reduce((s, g) => s + g.hotTurns, 0), games.reduce((s, g) => s + g.words + 1, 0)),
  hazardByK: Object.fromEntries(Object.entries(HZ).map(([k, [n, e]]) => [k, `${pct(e, n)}% of ${n}`])),
  multiplierByK: Object.fromEntries(Object.entries(MU).map(([k, a]) => [k, { mean: mean(a), atBasePct: pct(a.filter((m) => m <= 1.0001).length, a.length), atCapPct: pct(a.filter((m) => m >= 2.5).length, a.length) }])),
  tMaxCurve: [0, 5, 10, 15, 20, 25, 30].map((k) => [k, Math.round(chainT(k))]),
  letterAudit: letterAudit.filter((x) => x.medianKnows < 200 || x.endsHere > 6),
  sampleDeaths: deaths.slice(0, 12),
};
const lt = Object.entries(out.landingLetters);
out.landingShareTop = lt.slice(0, 6).map(([c, n]) => `${c}:${pct(n, landTot)}%`);

const txt = `CHAIN BA1 sim — ${N} games, vocab top ${VOCAB}, src ${SRC}\n` + JSON.stringify(out, null, 1);
console.log(txt);
const tag = process.env.TAG || '';
writeFileSync(path.join(HERE, `chain-sim${tag}.txt`), txt);
writeFileSync(path.join(HERE, `chain-sim${tag}.json`), JSON.stringify({ summary: out, games }, null, 1));
