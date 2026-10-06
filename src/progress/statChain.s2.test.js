// statChain.s2.test.js — the v2 STATS chain (P8, claude/mockups/v2/Stats.dc.html) WITH THE SEASON2 FLAG ON: the chain
// splits v3's REBIRTH factor (2^R × (1 + ★)) into REBIRTH + ASCEND, rebases XP on v3's XP_BASE, and BASE × every chip
// is still exactly what the season-2 game pays (perWordRateNow / letterXpNow). The flag is fixed at module load, so
// this file turns it on BEFORE importing anything (node --test runs each file in its own process).
import test from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
  key: (i) => [...mem.keys()][i] ?? null,
  get length() { return mem.size; },
};
globalThis.location = { search: '?season2=1' };

const { V3 } = await import('./season.js');
await import('./v3/install.js');
const { statBoard, statChain } = await import('./statBoard.js');
const { perWordRateNow } = await import('./wins.js');
const { letterXpNow } = await import('./letterXp.js');
const { STARS_KEY } = await import('./v3/store.js');

const close = (a, b, grid, msg) => assert.ok(Math.abs(a - b) <= Math.max(grid, Math.abs(b) * 1e-9), `${msg}: chain ${a} vs paid ${b}`);
const product = (c) => c.chips.reduce((p, k) => p * k.mult, c.base);

test('SEASON2: REBIRTH 2^R and ASCEND (1 + ★) are separate chips; BASE × chips = the season-2 payout', () => {
  let n = 0;
  for (const [kt, rc, stars] of [[0, 0, 0], [1, 1, 0], [6, 9, 0], [3, 2, 4], [12, 7, 21]]) {
    mem.clear();
    localStorage.setItem('taw.keytier', String(kt));
    localStorage.setItem('taw.rebirths', String(rc));
    localStorage.setItem(STARS_KEY, String(stars));
    const b = statBoard();
    const w = statChain(b.wins, { v3: V3, stars });
    const x = statChain(b.xp, { v3: V3, stars });
    assert.deepEqual(w.chips.map((c) => c.label), ['REBIRTH', 'MARK', 'BOOST', 'ASCEND']);
    assert.deepEqual(x.chips.map((c) => c.label), ['POWER', 'REBIRTH', 'MARK', 'BOOST', 'ASCEND']);
    assert.equal(w.chips[0].mult, 2 ** rc, 'REBIRTH is 2^R');
    assert.equal(w.chips[3].mult, 1 + stars, 'ASCEND is 1 + ★');
    assert.equal(w.base, V3.econ.WINS_BASE, 'FINAL WINS base: 22 a 5-letter word');
    assert.equal(x.base, V3.econ.XP_BASE, 'v3 XP base (econ.XP_BASE)');
    assert.equal(w.total, perWordRateNow({ mode: 'wordBomb' }).rate);
    assert.equal(x.total, letterXpNow());
    close(product(w), w.total, 0.05 + 1e-9, `wins P${kt} R${rc} ★${stars}`);
    close(product(x), x.total, 1e-9, `xp P${kt} R${rc} ★${stars}`);
    n += 1;
  }
  assert.equal(n, 5);
});
