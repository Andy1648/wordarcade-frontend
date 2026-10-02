// BA2 — Word Bomb: how often does a MEDIAN human beat the MEDIUM bot? (PLAY SOLO = chill timer + medium bot)
// Human model (stated, not measured): per turn, time-to-answer = THINK (lognormal, median `thinkMed` s,
// sigma 0.75 — fragments vary a lot) + TYPE (6 letters at 40 WPM ≈ 1.8 s) + 0.25 s submit. The turn is
// lost if that exceeds the fuse. Bot model: wordBombBot.js as shipped (miss roll per turn; delay is
// clamped under the fuse, so only the miss roll can cost it a life) or a CANDIDATE pressure model.
// node claude/batch-a/wb-winrate-sim.mjs
const PRESETS = { chill: { start: 20, every: 4, floor: 8, lives: 3 } };
const BOT = { medium: { miss: 0.05 } };
function lognormal(med, sigma, r = Math.random) {
  const u = 1 - r(), v = r();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return med * Math.exp(sigma * z);
}
function game({ thinkMed, botMiss }) {
  const p = PRESETS.chill;
  let lives = { h: p.lives, b: p.lives };
  let turn = 0;
  let who = Math.random() < 0.5 ? 'h' : 'b';
  for (let guard = 0; guard < 2000; guard += 1) {
    const T = Math.max(p.floor, p.start - Math.floor(turn / p.every));
    let ok;
    if (who === 'h') ok = lognormal(thinkMed, 0.75) + 1.8 + 0.25 < T;
    else ok = Math.random() >= botMiss(T);
    if (!ok) { lives[who] -= 1; if (lives[who] <= 0) return who === 'h' ? 'b' : 'h'; }
    turn += 1;
    who = who === 'h' ? 'b' : 'h';
  }
  return 'draw';
}
function rate(opts, n = 20000) {
  let w = 0;
  for (let i = 0; i < n; i += 1) if (game(opts) === 'h') w += 1;
  return w / n;
}
const SHIPPED = () => BOT.medium.miss;
// CANDIDATE: the bot feels the fuse too. 5% at a full 20 s fuse, rising linearly to `atFloor` at 8 s.
const pressure = (atFloor) => (T) => 0.05 + (atFloor - 0.05) * Math.min(1, Math.max(0, (20 - T) / 12));
const rows = [];
for (const thinkMed of [2.5, 3.5, 4.5]) {
  const r = { thinkMed, shipped: rate({ thinkMed, botMiss: SHIPPED }) };
  for (const f of (process.argv[2] ? process.argv[2].split(',').map(Number) : [0.15, 0.2, 0.25, 0.3])) r[`pressure@${f}`] = rate({ thinkMed, botMiss: pressure(f) });
  rows.push(r);
}
console.log('human win rate vs MEDIUM bot (chill), 20,000 games each');
for (const r of rows) console.log(Object.entries(r).map(([k, v]) => `${k}=${typeof v === 'number' && v < 1 ? (v * 100).toFixed(1) + '%' : v}`).join('  '));
