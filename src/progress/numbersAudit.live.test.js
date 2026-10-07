// numbersAudit.live.test.js — NUMBERS AUDIT (Andy item 5), SEASON2 OFF (the live season-1 economy, Rebirth Rush):
// the STATS chain (statChain over statBoard — the live StatBoard renders the same stacks) multiplies out exactly and as
// printed, its TOTAL is what the game pays (perWordRateNow / letterXpNow, the real bank, a real letter credit), and it
// is the live formula:
//   WINS / word = BASE 10 × (10 + N)/10 × len/5 × MODE × 5^R × MARK × INDEX × BOOST   (MODE: WB/Blitz 1 · RACE 1.5 · CHAIN 2 · SAT 5 · FUSE 1)
//   XP / letter = (10 + N) × KEY (1, 2, 5, 10, 25 …) × 5^R × MARK × INDEX × BOOST
// with the live mark tiers (COMMON 1.1 · LEGENDARY 3 · MYTHIC +90 BASE).
// No flag here: node --test runs each file in its own process, and this one never sets ?season2=1.
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

const { SEASON2 } = await import('./season.js');
const { statBoard, statChain, boardMult } = await import('./statBoard.js');
const { perWordRateNow, bankWordWins, getWins } = await import('./wins.js');
const { letterXpNow, creditLetterXp, resetLetterXp } = await import('./letterXp.js');
const { roundWordXp, KEY_LADDER } = await import('./xp.js');
const { ROLL_STATE_KEY } = await import('./markRolls.js');
const { MARKS_EQUIPPED_KEY } = await import('./marks.js');
const { indexMult, loadRollState, rollMarkById } = await import('./markRollsCore.js');
const { formatRate, SUFFIXES } = await import('../format.js');

const MODES = [
  ['wordBomb', 1],
  ['blitz', 1],
  ['wordRace', 1.5],
  ['chain', 2],
  ['satRush', 5],
  ['fuse', 1],
];
// the live save's KEY + rebirths (the same three shapes as the season-2 file: fresh, early, deep)
const STATES = [
  { k: 0, r: 0 },
  { k: 2, r: 3 },
  { k: 5, r: 10 },
];
const MARKS = [null, 'mk-bomber', 'mk-sprinter', 'mk-sparky', 'mk-eclipse', 'mk-singularity'];
const LIVE_TIER = { common: 1.1, rare: 1.25, epic: 1.5, legendary: 3, mythic: 10, secret: 25 };

function seed({ k, r }, mark) {
  mem.clear();
  resetLetterXp();
  localStorage.setItem('taw.keytier', String(k));
  localStorage.setItem('taw.rebirths', String(r));
  if (mark) {
    localStorage.setItem(ROLL_STATE_KEY, JSON.stringify({ v: 2, starter: true, marks: { [mark]: { n: 1 } } }));
    localStorage.setItem(MARKS_EQUIPPED_KEY, mark);
  }
}
function liveMark(mark) {
  const out = { wins: 1, xp: 1, winsBase: 0, xpBase: 0 };
  if (!mark) return out;
  const m = rollMarkById(mark);
  const f = LIVE_TIER[m.tier];
  if (m.stat.kind === 'winsPct') out.wins = f;
  if (m.stat.kind === 'xpPct') out.xp = f;
  if (m.stat.kind === 'baseWins') out.winsBase = (f - 1) * 10;
  if (m.stat.kind === 'baseXp') out.xpBase = (f - 1) * 10;
  return out;
}
function shownNum(t) {
  const m = /^×?(-?[\d,]*\.?\d+)(.*)$/.exec(String(t));
  const i = m[2] ? SUFFIXES.indexOf(m[2]) : 0;
  assert.ok(i >= 0, `unknown suffix in ${t}`);
  return Number(m[1].replace(/,/g, '')) * 1000 ** i;
}
const relClose = (a, b, rel, msg) => assert.ok(Math.abs(a - b) <= Math.max(1e-9, Math.abs(b) * rel), `${msg}: ${a} vs ${b}`);

test('the flag is OFF in this file', () => assert.equal(SEASON2, false));

test('LIVE: BASE × every chip = TOTAL (exact AND as printed) = the payout = 10 × len/5 × MODE × 5^R × MARK × INDEX', () => {
  let n = 0;
  for (const st of STATES) {
    for (const mark of MARKS) {
      for (const [key, modeX] of MODES) {
        seed(st, mark);
        const tag = `K${st.k} R${st.r} ${mark || 'no mark'} ${key}`;
        const c = statChain(statBoard({ mode: key }).wins);
        const by = Object.fromEntries(c.chips.map((x) => [x.id, x.mult]));
        assert.equal(by.mode, modeX, `${tag}: MODE`);
        assert.equal(by.rebirth, 5 ** st.r, `${tag}: REBIRTH 5^R`);
        assert.equal(by.ascend, undefined, `${tag}: no STARS chip with the flag off`);
        const lm = liveMark(mark);
        assert.ok(Math.abs(by.mark - lm.wins) < 1e-9, `${tag}: MARK ×${lm.wins} (was ${by.mark})`);
        relClose(c.chips.reduce((p, x) => p * x.mult, c.base), c.total, 0.05 / Math.max(1, c.total) + 1e-12, `${tag} exact`);
        const shown = c.chips.reduce((p, x) => p * shownNum(boardMult(x.mult)), shownNum(formatRate(c.base)));
        relClose(shown, c.total, 0.002 + 0.05 / c.total, `${tag} printed chips vs TOTAL`); // + the payout's tenth-of-a-win grid
        relClose(shownNum(formatRate(c.total)), shown, 0.006, `${tag} as printed`);
        assert.equal(c.total, perWordRateNow({ mode: key }).rate, `${tag}: TOTAL is the payout`);
        const idx = indexMult(loadRollState());
        const formula = 10 * ((10 + lm.winsBase) / 10) * modeX * 5 ** st.r * lm.wins * idx;
        assert.equal(c.total, roundWordXp(formula * 10) / 10, `${tag}: TOTAL is the live formula`);
        const before = getWins();
        const paid = bankWordWins({ mode: key, prevWords: 0, nowWords: 3, wordLength: 5 });
        assert.equal(paid, Math.floor(roundWordXp(3 * c.total * 10) / 10), `${tag}: the bank paid 3 × TOTAL`);
        assert.equal(getWins() - before, paid);
        n += 1;
      }
    }
  }
  assert.equal(n, STATES.length * MARKS.length * MODES.length);
});

test('LIVE: XP / LETTER chain — (10 + N) × KEY × REBIRTH 5^R × MARK × INDEX = TOTAL = what a letter credits', () => {
  let n = 0;
  for (const st of STATES) {
    for (const mark of MARKS) {
      seed(st, mark);
      const tag = `K${st.k} R${st.r} ${mark || 'no mark'} XP`;
      const lm = liveMark(mark);
      const c = statChain(statBoard().xp);
      const by = Object.fromEntries(c.chips.map((x) => [x.id, x.mult]));
      assert.equal(c.base, 10 + lm.xpBase, `${tag}: BASE`);
      assert.equal(by.power, KEY_LADDER[st.k], `${tag}: KEY`);
      assert.equal(by.rebirth, 5 ** st.r, `${tag}: REBIRTH 5^R`);
      assert.ok(Math.abs(by.mark - lm.xp) < 1e-9, `${tag}: MARK ×${lm.xp} (was ${by.mark})`);
      relClose(c.chips.reduce((p, x) => p * x.mult, c.base), c.total, 1e-9, `${tag} exact`);
      const shown = c.chips.reduce((p, x) => p * shownNum(boardMult(x.mult)), shownNum(formatRate(c.base)));
      relClose(shown, c.total, 0.002, `${tag} printed chips vs TOTAL`);
      relClose(shownNum(formatRate(c.total)), shown, 0.006, `${tag} as printed`);
      assert.equal(c.total, letterXpNow(), `${tag}: TOTAL is letterXpNow`);
      const idx = indexMult(loadRollState());
      relClose(c.total, (10 + lm.xpBase) * KEY_LADDER[st.k] * 5 ** st.r * lm.xp * idx, 1e-12, `${tag}: TOTAL is the live formula`);
      const r = creditLetterXp(1, { mode: 'chain' });
      assert.equal(r.xp, roundWordXp(c.total), `${tag}: one letter credits TOTAL`);
      n += 1;
    }
  }
  assert.equal(n, STATES.length * MARKS.length);
});
