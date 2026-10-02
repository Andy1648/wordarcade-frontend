// KP2 — minutes of play to BUY KEY POWER T5 / T10 / T20 (and T60 for the no-caps check) at a median
// player's rate: Word Bomb, 8 words/min (claude/econ-visible-sim.mjs THROUGHPUT), 5-letter words, R0,
// no other multipliers. Run on main (v9) and on the branch (v8) for the before/after.
globalThis.localStorage = { _m: new Map(), getItem(k) { return this._m.has(k) ? this._m.get(k) : null; }, setItem(k, v) { this._m.set(k, String(v)); }, removeItem(k) { this._m.delete(k); } };
const xp = await import('../../src/progress/xp.js');
const wins = await import('../../src/progress/wins.js');
const { formatNum } = await import('../../src/format.js');
const WPM = 8;
for (const T of [1, 2, 5, 10, 20, 60]) {
  const perWord = wins.perWordWins({ mode: 'word-bomb', keyTier: T - 1, rebirthCount: 0, wordLength: 5 });
  const cost = xp.keyTierCostAt(T, 0);
  const min = cost / (perWord * WPM);
  console.log(`T${String(T).padEnd(3)} XP/letter ${formatNum(xp.keyTierXp(T)).padEnd(7)} price ${formatNum(cost).padEnd(8)} wins/word before it ${formatNum(perWord).padEnd(7)} → ${min < 1 ? (min * 60).toFixed(0) + ' s' : min < 600 ? min.toFixed(1) + ' min' : (min / 60).toFixed(1) + ' h'}`);
}
