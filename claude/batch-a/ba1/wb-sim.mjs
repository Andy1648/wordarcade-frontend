// BA1 — WORD BOMB unfun-moment sim. Drives the REAL backend logic (origin/main, exported read-only to
// ../ba1-wt/_be): gameLogic.js createGame / submitWord / handleTimeout / pickRandomCombo /
// computeTimerForTurn, the real dictionary.js isValidWord, and wordBombBot.js rollMiss / computeDelayMs /
// pickWord exactly as roomManager.maybeScheduleBotMove (roomManager.js:697-740) wires them.
// PLAY SOLO = 1 human (host, moves first) vs a MEDIUM bot; room preset is CHILL for a first-timer and
// MEDIUM ("CRAZY") for anyone who has played before (frontend src/App.jsx handlePlaySolo).
//
// MEDIAN HUMAN (stated model, same family as claude/econ-oct2/frenzy-sim.mjs):
//   vocab  = top VOCAB words of src/solo/words.recall.txt (default 12k; sensitivity 8k / 20k), and only
//            words the real dictionary accepts.
//   k      = known, valid, unused words containing the combo.
//   think  = lognormal(median 2.0 s + 14 s / sqrt(k), sigma 0.6)  -> k=400: 2.7 s, k=25: 4.8 s, k=4: 9 s
//            (pool-depth dependence; median combo ≈ 3.4 s, matching wb-winrate-sim's 3.5 s think).
//   type   = 0.30 s/letter (40 wpm) + 0.25 s submit; 4% typo -> server not_a_word, +0.8 s notice + retype.
//   word   = frequency-biased pick among known candidates (r^2 over the first 30).
//   k = 0  -> no answer; the player stares at the fuse until it blows (timeout).
// Usage: node claude/batch-a/ba1/wb-sim.mjs [games=50] [vocab=12000]
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const WT = 'C:/Users/andyw_tnc0kix/Downloads/wordarcade-frontend_1/ba1-wt';
const require = createRequire(`${WT}/_be/x.js`);

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let rng = mulberry32(1);
Math.random = () => rng(); // the real modules call Math.random; seed it

const logic = require('./gameLogic.js');
const bot = require('./wordBombBot.js');
const { isValidWord } = require('./dictionary.js');

const GAMES = Number(process.argv[2] || 50);
// CANDIDATE-FIX knobs (env): WB_PRESET_<KEY>='{"startSeconds":..}' patches logic.DIFFICULTY_PRESETS (createGame reads
// that same object); WB_FUMBLE_CAP_S=n makes a choking bot concede after n s instead of burning the whole fuse.
for (const k of Object.keys(logic.DIFFICULTY_PRESETS)) if (process.env['WB_PRESET_' + k.toUpperCase()]) Object.assign(logic.DIFFICULTY_PRESETS[k], JSON.parse(process.env['WB_PRESET_' + k.toUpperCase()]));
const FUMBLE_CAP = Number(process.env.WB_FUMBLE_CAP_S || Infinity);
const PRESET_LIST = (process.env.WB_PRESETS || 'chill,easy,medium').split(',');
const TAG = process.env.WB_TAG || '';
// WB_PRESSURE_FULL_S=n: CANDIDATE bot pressure curve = wordBombBot.js:146-155 missChance verbatim with PRESSURE_FULL_S=n.
const PFULL = Number(process.env.WB_PRESSURE_FULL_S || (process.env.WB_BOT_BASE ? 20 : 0));
const rollMiss = PFULL ? (key, t) => { const base = Number(process.env.WB_BOT_BASE) || bot.BOT_DIFFICULTY[key].miss; const k = Math.min(1, Math.max(0, (PFULL - t) / (PFULL - 8))); return rng() < base * (1 + 1.6 * k); } : bot.rollMiss;
const VOCAB = Number(process.argv[3] || 12000);
const recall = readFileSync(`${WT}/src/solo/words.recall.txt`, 'utf8').split(/\s+/).filter(Boolean);
// recall.txt only carries 3-9 letter words, so 10+ letter words come from botWords.txt (same web-frequency
// family, ~14.5k): a 10+ letter word is "known" if its botWords rank < VOCAB.
const botList = readFileSync(`${WT}/_be/botWords.txt`, 'utf8').split(/\s+/).filter(Boolean);
const rankOf = new Map(recall.map((w, i) => [w, i]));
botList.forEach((w, i) => { if (w.length >= 10 && !rankOf.has(w)) rankOf.set(w, i); });
const known = [];
for (const [w, r] of rankOf) if (r < VOCAB && w.length >= 3 && /^[a-z]+$/.test(w) && (await isValidWord(w))) known.push(w);
known.sort((a, b) => rankOf.get(a) - rankOf.get(b));

const knownByCombo = new Map();
for (const c of logic.COMBOS) knownByCombo.set(c, known.filter((w) => w.includes(c)));

function lognormal(med, sigma) {
  const u = 1 - rng(), v = rng();
  return med * Math.exp(sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v));
}

async function playGame(preset, seed) {
  rng = mulberry32(seed);
  const game = logic.createGame([{ id: 'h', name: 'HUMAN' }, { id: 'b', name: 'BOT' }], preset);
  const ev = { turns: [], seconds: 0 };
  let guard = 0;
  while (game.status === 'in_progress' && guard++ < 500) {
    const who = logic.getCurrentPlayerId(game);
    const T = game.currentTimerSeconds;
    const combo = game.currentCombo;
    const livesBefore = { h: game.players[0].lives, b: game.players[1].lives };
    const rec = { who, T, combo, turn: game.completedTurnCount, livesBefore };
    if (who === 'h') {
      const cands = knownByCombo.get(combo).filter((w) => !game.usedWords.has(w));
      rec.k = cands.length;
      let t = Infinity, word = null;
      if (cands.length) {
        const r = rng();
        word = cands[Math.floor(r * r * Math.min(30, cands.length))];
        t = lognormal(2.0 + 14 / Math.sqrt(cands.length), 0.6) + 0.3 * word.length + 0.25;
        if (rng() < 0.04) { t += 0.8 + 0.3 * word.length + 0.25; rec.typo = true; }
      }
      if (t < T) {
        const r = await logic.submitWord(game, word);
        if (!r.accepted) throw new Error(`human word rejected ${word} ${r.reason}`);
        rec.ok = true; rec.word = word; rec.dt = t;
      } else {
        logic.handleTimeout(game); rec.ok = false; rec.dt = T;
      }
    } else {
      if (rollMiss('medium', T)) {
        logic.handleTimeout(game, FUMBLE_CAP < T ? 'skip' : 'timeout'); rec.ok = false; rec.dt = Math.min(T, FUMBLE_CAP); rec.fumble = true;
      } else {
        const d = bot.computeDelayMs('medium', T) / 1000;
        const word = bot.pickWord(combo, game.usedWords);
        if (!word) { logic.handleTimeout(game); rec.ok = false; rec.dt = T; rec.noWord = true; }
        else {
          const r = await logic.submitWord(game, word);
          if (!r.accepted) { rec.rejected = r.reason; } // bot word the dictionary refuses -> miss
          rec.ok = r.accepted; rec.word = word; rec.dt = d; rec.rank = rankOf.has(word) ? rankOf.get(word) : -1;
          if (!r.accepted) { logic.handleTimeout(game); rec.dt = T; }
        }
      }
    }
    ev.seconds += rec.dt;
    rec.at = ev.seconds;
    ev.turns.push(rec);
  }
  ev.winner = game.winnerId;
  return ev;
}

const pct = (a, b) => (b ? ((100 * a) / b).toFixed(1) + '%' : '-');
const q = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0; };
const out = [];
const log = (...a) => { const s = a.join(' '); out.push(s); console.log(s); };
const json = { vocab: VOCAB, games: GAMES, presets: {} };

log(`WORD BOMB BA1 sim — ${GAMES} games/preset, median vocab ${VOCAB} (known valid words: ${known.length})`);
// ---- static: combos the median can barely answer ----
const thin = logic.COMBOS.map((c) => [c, knownByCombo.get(c).length]).sort((a, b) => a[1] - b[1]);
log(`\nCOMBO POOL (median-known valid words containing combo): min ${thin[0][1]}, p10 ${q(thin.map((x) => x[1]), 0.1)}, median ${q(thin.map((x) => x[1]), 0.5)}`);
log(`combos with <=10 known: ${thin.filter((x) => x[1] <= 10).length}/${logic.COMBOS.length}: ${thin.filter((x) => x[1] <= 10).map((x) => x.join(':')).join(' ')}`);
log(`combos with 11-25 known: ${thin.filter((x) => x[1] > 10 && x[1] <= 25).map((x) => x.join(':')).join(' ')}`);
// how often each thin combo is picked at turn 0 / 16 / 32 (real pickRandomCombo weights, 20k draws)
for (const t of [0, 16, 32]) {
  rng = mulberry32(99 + t);
  let thinN = 0; const N = 20000;
  for (let i = 0; i < N; i++) if (knownByCombo.get(logic.pickRandomCombo(null, t)).length <= 10) thinN++;
  log(`P(draw a <=10-known combo) at completedTurnCount=${t}: ${pct(thinN, N)}`);
}
json.thinCombos = thin.filter((x) => x[1] <= 25);

for (const preset of PRESET_LIST) {
  const games = [];
  for (let g = 0; g < GAMES; g++) games.push(await playGame(preset, 1000 + g));
  const H = games.flatMap((g) => g.turns.filter((t) => t.who === 'h'));
  const B = games.flatMap((g) => g.turns.filter((t) => t.who === 'b'));
  const hLoss = H.filter((t) => !t.ok);
  const wins = games.filter((g) => g.winner === 'h').length;
  log(`\n=== preset ${preset.toUpperCase()} ${JSON.stringify(logic.DIFFICULTY_PRESETS[preset])} vs MEDIUM bot ===`);
  log(`human win rate: ${pct(wins, GAMES)}; game length s: p10 ${q(games.map((g) => g.seconds), 0.1).toFixed(0)} median ${q(games.map((g) => g.seconds), 0.5).toFixed(0)} p90 ${q(games.map((g) => g.seconds), 0.9).toFixed(0)}; turns median ${q(games.map((g) => g.turns.length), 0.5)}`);
  // 1. dead turns
  const dead = H.filter((t) => t.k <= 3);
  log(`[dead turns] human turns with <=3 known answers: ${dead.length}/${H.length} (${pct(dead.length, H.length)}); k=0: ${H.filter((t) => t.k === 0).length}; share of human life losses on <=3-known combos: ${pct(hLoss.filter((t) => t.k <= 3).length, hLoss.length)}; on <=10-known: ${pct(hLoss.filter((t) => t.k <= 10).length, hLoss.length)}`);
  const deadCombos = {};
  for (const t of hLoss) deadCombos[t.combo] = (deadCombos[t.combo] || 0) + 1;
  log(`  combos costing the human a life (top 15): ${Object.entries(deadCombos).sort((a, b) => b[1] - a[1]).slice(0, 15).map((x) => x.join('×')).join(' ')}`);
  log(`  games with >=1 dead (<=3-known) human turn: ${pct(games.filter((g) => g.turns.some((t) => t.who === 'h' && t.k <= 3)).length, GAMES)}`);
  // 2. timer: human losses by fuse length
  const byT = {};
  for (const t of H) { const k = t.T; byT[k] = byT[k] || [0, 0]; byT[k][0]++; if (!t.ok) byT[k][1]++; }
  log(`[timer] human fail rate by fuse s: ${Object.entries(byT).sort((a, b) => b[0] - a[0]).map(([T, [n, f]]) => `${T}s:${f}/${n}`).join(' ')}`);
  log(`  share of human life losses at fuse <=5 s: ${pct(hLoss.filter((t) => t.T <= 5).length, hLoss.length)}; bot life losses at <=5s: ${pct(B.filter((t) => !t.ok && t.T <= 5).length, B.filter((t) => !t.ok).length)}`);
  // 3. decided early
  const firstLoss = games.map((g) => { const t = g.turns.find((x) => x.who === 'h' && !x.ok); return t ? t.at : Infinity; });
  log(`[early] human loses a life within first 30 s: ${pct(firstLoss.filter((x) => x <= 30).length, GAMES)}; games over < 60 s: ${pct(games.filter((g) => g.seconds < 60).length, GAMES)}; human losses where human lost every life before bot lost one: ${pct(games.filter((g) => g.winner === 'b' && g.turns.every((t) => t.who === 'h' || t.ok)).length, GAMES)}`);
  const firstAny = games.map((g) => { const t = g.turns.find((x) => !x.ok); return t ? t.at : g.seconds; });
  log(`[slow open] seconds until ANYONE loses a life: p25 ${q(firstAny, 0.25).toFixed(0)} median ${q(firstAny, 0.5).toFixed(0)} p75 ${q(firstAny, 0.75).toFixed(0)}; games with no life lost in first 90 s: ${pct(firstAny.filter((x) => x > 90).length, GAMES)}`);
  // 4. bot words a median wouldn't know
  const bw = B.filter((t) => t.word && t.ok);
  const obscure = bw.filter((t) => t.rank < 0 || t.rank >= VOCAB);
  log(`[bot words] bot words outside median vocab (rank>=${VOCAB} or not in recall list): ${obscure.length}/${bw.length} (${pct(obscure.length, bw.length)}); not in median vocab at all (unlisted): ${pct(bw.filter((t) => t.rank < 0).length, bw.length)}; games with >=3 such: ${pct(games.filter((g) => g.turns.filter((t) => t.who === 'b' && t.ok && (t.rank < 0 || t.rank >= VOCAB)).length >= 3).length, GAMES)}`);
  log(`  sample: ${obscure.slice(0, 40).map((t) => `${t.word}(${t.combo})`).join(' ')}`);
  log(`  bot dictionary-rejected words: ${B.filter((t) => t.rejected).length}; bot noWord: ${B.filter((t) => t.noWord).length}`);
  // 5. dead air: bot fumble stretches + human staring at a k=0 combo
  const fum = B.filter((t) => t.fumble);
  log(`[dead air] bot fumble turns: ${fum.length}/${B.length} (${pct(fum.length, B.length)}), fumble duration mean ${(fum.reduce((s, t) => s + t.dt, 0) / (fum.length || 1)).toFixed(1)} s; games with a >=15 s fumble: ${pct(games.filter((g) => g.turns.some((t) => t.fumble && t.dt >= 15)).length, GAMES)}`);
  // 6. repeats
  let reps = 0, tot = 0, gamesRep = 0;
  for (const g of games) { const seen = new Set(); let r = 0; let prev = null; for (const t of g.turns) { if (t.combo !== prev) { tot++; if (seen.has(t.combo)) r++; seen.add(t.combo); } prev = t.combo; } reps += r; if (r) gamesRep++; }
  log(`[repeats] a combo served again later in the same game: ${reps}/${tot} serves (${pct(reps, tot)}); games with a repeat: ${pct(gamesRep, GAMES)}`);
  // 7. hopeless: human at 1 life while bot at full
  log(`[hopeless] games where human reaches last life while bot still has all lives: ${pct(games.filter((g) => g.turns.some((t) => t.livesBefore.h === 1 && t.livesBefore.b === logic.DIFFICULTY_PRESETS[preset].lives)).length, GAMES)}`);
  // after a human timeout the SAME combo goes to the bot, which answers it (shows the "easy" answer)
  let sameCombo = 0, sameTot = 0;
  for (const g of games) for (let i = 0; i + 1 < g.turns.length; i++) if (g.turns[i].who === 'h' && !g.turns[i].ok) { sameTot++; if (g.turns[i + 1].combo === g.turns[i].combo && g.turns[i + 1].ok) sameCombo++; }
  log(`[after human fail] bot then answers the same combo instantly: ${sameCombo}/${sameTot} (${pct(sameCombo, sameTot)})`);
  json.presets[preset] = { winRate: wins / GAMES, games: games.map((g) => ({ winner: g.winner, seconds: Math.round(g.seconds), turns: g.turns.length })) , deadCombos };
}
writeFileSync(`${HERE}wb-sim${VOCAB === 12000 ? '' : '-v' + VOCAB}${TAG}.txt`, out.join('\n') + '\n');
writeFileSync(`${HERE}wb-sim${VOCAB === 12000 ? '' : '-v' + VOCAB}${TAG}.json`, JSON.stringify(json, null, 1));
