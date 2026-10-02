// BA1 — RACE (whole-word variant, the one the menu launches: frontend src/App.jsx race_quick_match
// variant 'words'). Drives the REAL backend wordRace.js (origin/main, ../ba1-wt/_be): createRace,
// useWordsVariant (buildWordSequence), goLive, checkWord, applyAccept, standings, botFactor,
// botTypeDelayMs, botsNeeded — scheduled exactly like wordRaceMode.js scheduleBot (one word per delay,
// reschedule after each accept).
// Solo quick match: 1 human + botsNeeded(1) = 2 bots (factors 0.88 / 1.12).
// HUMAN at W wpm (median 40): per word = 350 ms read/react + (len+1) chars * 12000/W ms; 4% typo per
// word -> client precheck rejects, +700 ms notice + retype the word.
// Usage: node claude/batch-a/ba1/race-sim.mjs [races=50]
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const HERE = fileURLToPath(new URL('.', import.meta.url));
const require = createRequire('C:/Users/andyw_tnc0kix/Downloads/wordarcade-frontend_1/ba1-wt/_be/x.js');
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
let rng = mulberry32(1);
Math.random = () => rng();
const R = require('./wordRace.js');
const N = Number(process.argv[2] || 50);
const BOT_PER_CHAR = Number(process.env.RACE_BOT_MS_PER_CHAR || 0); // candidate override
const out = []; const log = (s) => { out.push(s); console.log(s); };
const pct = (a, b) => ((100 * a) / b).toFixed(1) + '%';
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

function botDelay(word, factor) {
  if (!BOT_PER_CHAR) return R.botTypeDelayMs(word, factor);
  const jitter = 0.8 + rng() * 0.45; // wordRace.js:389 verbatim, per-char swapped
  return Math.max(450, Math.round((260 + (word.length + 1) * BOT_PER_CHAR) * factor * jitter));
}
function race(wpm, seed) {
  rng = mulberry32(seed);
  const nb = R.botsNeeded(1);
  const racers = [{ id: 'h', name: 'H' }];
  for (let i = 0; i < nb; i++) racers.push({ id: 'b' + i, name: 'B' + i, isBot: true });
  const g = R.createRace(racers, { seed: seed * 7919 });
  R.useWordsVariant(g);
  R.goLive(g, 0);
  // event queue: next action time per racer
  const next = {};
  const hDelay = (w) => { let t = 350 + (w.length + 1) * (12000 / wpm); if (rng() < 0.04) t += 700 + (w.length + 1) * (12000 / wpm); return t; };
  next.h = hDelay(R.currentFragment(g, R.getRacer(g, 'h')));
  for (let i = 0; i < nb; i++) next['b' + i] = botDelay(R.currentFragment(g, R.getRacer(g, 'b' + i)), R.botFactor(i));
  let now = 0;
  while (g.status === 'in_progress') {
    const [id, t] = Object.entries(next).sort((a, b) => a[1] - b[1])[0];
    now = t;
    if (now >= g.capMs) { R.finish(g, 'cap', g.capMs); break; }
    const r = R.getRacer(g, id); const w = R.currentFragment(g, r);
    const c = R.checkWord(g, id, w); if (c.reason) throw new Error(c.reason);
    R.applyAccept(g, id, w, now);
    if (g.status !== 'in_progress') break;
    const nw = R.currentFragment(g, r);
    next[id] = now + (id === 'h' ? hDelay(nw) : botDelay(nw, R.botFactor(Number(id.slice(1)))));
  }
  const st = R.standings(g);
  const h = R.getRacer(g, 'h');
  return { place: st.findIndex((x) => x.id === 'h') + 1, hWords: h.index, endMs: now, reason: g.endReason, target: g.target, words: g.words };
}
log(`RACE (words variant) BA1 sim — ${N} races per speed; solo = 1 human + ${R.botsNeeded(1)} bots${BOT_PER_CHAR ? ` [CANDIDATE bot ms/char=${BOT_PER_CHAR}]` : ''}`);
const seen = new Map(); let totalW = 0;
for (const wpm of [30, 40, 50, 60]) {
  const rs = []; for (let i = 0; i < N; i++) rs.push(race(wpm, 500 + i));
  if (wpm === 40) for (const r of rs) for (const w of r.words) { seen.set(w, (seen.get(w) || 0) + 1); totalW++; }
  log(`${wpm} wpm: 1st ${pct(rs.filter((r) => r.place === 1).length, N)}, last ${pct(rs.filter((r) => r.place === 3).length, N)}; race ends at median ${(q(rs.map((r) => r.endMs), 0.5) / 1000).toFixed(1)} s; human words when it ends median ${q(rs.map((r) => r.hWords), 0.5)}/${rs[0].target} (p10 ${q(rs.map((r) => r.hWords), 0.1)}); ended by cap ${pct(rs.filter((r) => r.reason === 'cap').length, N)}`);
}
const reps = [...seen.values()].filter((c) => c > 1).length;
log(`word variety over 50 races x 25 words @40wpm: ${seen.size} distinct of ${totalW} shown; words shown in >=3 races: ${[...seen.values()].filter((c) => c >= 3).length}; pool size ${R.getWordPool().length}`);
writeFileSync(`${HERE}race-sim${BOT_PER_CHAR ? '-c' + BOT_PER_CHAR : ''}.txt`, out.join('\n') + '\n');
