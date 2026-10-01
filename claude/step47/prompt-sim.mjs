// claude/step47/prompt-sim.mjs — who sees "YOU'D BE #N" (rank <= 100) on boards of 0 / 10 / 150 / 1000
// players. Board players are drawn from a long-tail mix (most casual, a few grinders); seeded RNG.
import { hypotheticalRank } from '../../src/leaderboard/client.js';
let seed = 47;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
function player() {
  const u = rand();
  if (u < 0.6) return { rebirths: 0, level: 1 + Math.floor(rand() * 20), lifetime_words: Math.floor(10 + rand() * 400) };
  if (u < 0.9) return { rebirths: 0, level: 20 + Math.floor(rand() * 80), lifetime_words: Math.floor(400 + rand() * 6000) };
  return { rebirths: 1 + Math.floor(rand() * 5), level: 1 + Math.floor(rand() * 150), lifetime_words: Math.floor(6000 + rand() * 60000) };
}
const BOTS = {
  weak: { rebirths: 0, level: 4, lifetimeWords: 35 },
  median: { rebirths: 0, level: 24, lifetimeWords: 700 },
  strong: { rebirths: 2, level: 60, lifetimeWords: 15000 },
};
const rows = [];
for (const n of [0, 10, 150, 1000]) {
  const board = Array.from({ length: n }, player).sort((a, b) => b.rebirths - a.rebirths || b.level - a.level || b.lifetime_words - a.lifetime_words).slice(0, 100);
  const line = { players: n };
  for (const [k, s] of Object.entries(BOTS)) line[k] = hypotheticalRank(board, s) ?? 'off top-100 (no prompt)';
  rows.push(line);
}
console.table(rows);
