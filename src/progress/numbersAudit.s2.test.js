// numbersAudit.s2.test.js — NUMBERS AUDIT (Andy item 5), SEASON2 ON: "stats screen = BASE × each multiplier = TOTAL
// and the math must multiply out". For every state below, the v2 STATS chain (statChain over statBoard):
//   1. multiplies out AS DISPLAYED — the printed BASE × every printed chip lands on the printed TOTAL (to display
//      precision: chips print exact to 2 decimals below ×10,000);
//   2. multiplies out EXACTLY — BASE × every chip value = TOTAL;
//   3. TOTAL is what the game PAYS — perWordRateNow / letterXpNow, the real bank (bankWordWins) and the real letter
//      credit (creditLetterXp);
//   4. TOTAL is PROGRESSION FINAL's formula (v3/econ.js, claude/progression-FINAL.md):
//        XP / letter = 10 × 2.5^P × 2^R × (1 + ★) × MARK
//        WINS / word = 22 × len/5 × MODE × 2^R × (1 + ★) × MARK   (MODE: WB/Blitz 1 · RACE 1.5 · CHAIN 2 · SAT 3 · FUSE 1)
//      with MARK = FINAL's tier multiplier (COMMON 1.1 … LEGENDARY 2 … MYTHIC 3 … SECRET 5) × the INDEX it carries.
// States: R0/P0/★0, R3/P2/★0, R10/P5/★2 · no mark, +% WINS, +% XP, +BASE WINS, LEGENDARY, MYTHIC · every MODE.
// The flag is fixed at module load, so it is turned on BEFORE anything is imported (node --test: one process a file).
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
const { statBoard, statChain, boardMult } = await import('./statBoard.js');
const { perWordRateNow, bankWordWins, getWins } = await import('./wins.js');
const { letterXpNow, creditLetterXp, resetLetterXp } = await import('./letterXp.js');
const { roundWordXp, xpPerInput, keyTierCost } = await import('./xp.js');
const { ROLL_STATE_KEY } = await import('./markRolls.js');
const { MARKS_EQUIPPED_KEY } = await import('./marks.js');
const { indexMult, loadRollState, rollMarkById } = await import('./markRollsCore.js');
const { STARS_KEY } = await import('./v3/store.js');
const { formatStatRate, SUFFIXES } = await import('../format.js');
const E = V3.econ;

// payout key → gameData id (econ's MODE table) + FINAL's MODE multiplier, spelled out so a table drift fails here
const MODES = [
  ['wordBomb', 'word-bomb', 1],
  ['blitz', 'category-blitz', 1],
  ['wordRace', 'word-race', 1.5],
  ['chain', 'chain', 2],
  ['satRush', 'sat-rush', 5],
  ['fuse', 'fuse', 1],
];
const STATES = [
  { p: 0, r: 0, s: 0 },
  { p: 2, r: 3, s: 0 },
  { p: 5, r: 10, s: 2 },
];
const MARKS = [null, 'mk-bomber', 'mk-sprinter', 'mk-sparky', 'mk-eclipse', 'mk-singularity'];
const FINAL_TIER = { common: 1.1, rare: 1.25, epic: 1.5, legendary: 2, mythic: 3, secret: 5 };

function seed({ p, r, s }, mark) {
  mem.clear();
  resetLetterXp();
  localStorage.setItem('taw.keytier', String(p));
  localStorage.setItem('taw.rebirths', String(r));
  localStorage.setItem(STARS_KEY, String(s));
  if (mark) {
    localStorage.setItem(ROLL_STATE_KEY, JSON.stringify({ v: 2, starter: true, marks: { [mark]: { n: 1 } } }));
    localStorage.setItem(MARKS_EQUIPPED_KEY, mark);
  }
}
/** FINAL's MARK factors for the worn mark: { wins, xp, winsBase, xpBase } (the +N BASE stats are BASE addends). */
function finalMark(mark) {
  const out = { wins: 1, xp: 1, winsBase: 0, xpBase: 0 };
  if (!mark) return out;
  const m = rollMarkById(mark);
  const f = FINAL_TIER[m.tier];
  if (m.stat.kind === 'winsPct') out.wins = f;
  if (m.stat.kind === 'xpPct') out.xp = f;
  if (m.stat.kind === 'baseWins') out.winsBase = (f - 1) * 10; // sized on BASE 10: a +N BASE is worth ×(1 + N/10)
  if (m.stat.kind === 'baseXp') out.xpBase = (f - 1) * 10;
  return out;
}
/** A printed number back to a value: "×1,024" → 1024, "67.6K" → 67,600 (formatNum's named suffixes). */
function shownNum(t) {
  const m = /^×?(-?[\d,]*\.?\d+)(.*)$/.exec(String(t));
  const i = m[2] ? SUFFIXES.indexOf(m[2]) : 0;
  assert.ok(i >= 0, `unknown suffix in ${t}`);
  return Number(m[1].replace(/,/g, '')) * 1000 ** i;
}
const relClose = (a, b, rel, msg) => assert.ok(Math.abs(a - b) <= Math.max(1e-9, Math.abs(b) * rel), `${msg}: ${a} vs ${b}`);

test('FINAL v2: BASE × every chip = TOTAL (exact AND as printed) = the payout = 10 × len/5 × MODE × 3^R × MARK', () => {
  let n = 0;
  for (const st of STATES) {
    for (const mark of MARKS) {
      for (const [key, id, modeX] of MODES) {
        seed(st, mark);
        const tag = `P${st.p} R${st.r} ★${st.s} ${mark || 'no mark'} ${key}`;
        const c = statChain(statBoard({ mode: key }).wins, { v3: V3, stars: st.s });
        // the chain names FINAL's factors, in FINAL's order
        const by = Object.fromEntries(c.chips.map((k) => [k.id, k.mult]));
        assert.equal(by.mode, modeX, `${tag}: MODE`);
        assert.equal(by.rebirth, 3 ** st.r, `${tag}: REBIRTH 3^R`);
        assert.equal(by.ascend, undefined, `${tag}: no STARS chip (ascension hidden)`);
        const fm = finalMark(mark);
        const idx = indexMult(loadRollState());
        assert.ok(Math.abs(by.mark - fm.wins) < 1e-9, `${tag}: MARK is FINAL's tier ×${fm.wins} (was ${by.mark})`);
        // 2. exact
        relClose(c.chips.reduce((p, k) => p * k.mult, c.base), c.total, 0.05 / Math.max(1, c.total) + 1e-12, `${tag} exact`);
        // 1. as printed (base and result through formatStatRate — StatsV2's — chips through boardMult)
        const shown = c.chips.reduce((p, k) => p * shownNum(boardMult(k.mult)), shownNum(formatStatRate(c.base)));
        relClose(shown, c.total, 0.002 + 0.05 / c.total, `${tag} printed chips vs TOTAL`); // + the payout's tenth-of-a-win grid // chips print to 3 decimals (<×10) / 2 (<×10,000)
        relClose(shownNum(formatStatRate(c.total)), shown, 0.006, `${tag} as printed`); // the printed TOTAL is 3 sig. figs from 10,000
        // 3. the payout
        assert.equal(c.total, perWordRateNow({ mode: key }).rate, `${tag}: TOTAL is the payout`);
        // 4. FINAL's formula (whole-XP grid: a word is whole tenths of a win)
        const final = E.winsPerWord({ length: 5, mode: id, rebirths: st.r, stars: st.s, mark: fm.wins * idx, markBase: fm.winsBase });
        assert.equal(c.total, roundWordXp(final * 10) / 10, `${tag}: TOTAL is FINAL's formula`);
        // the REAL bank: three 5-letter words clear the gate and pay 3 × TOTAL (tenths carried)
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

test('FINAL v3: XP / LETTER chain — BASE 1 × (10 + N)/10 × KEY 2^T × REBIRTH 3^R × MARK = TOTAL = what a letter credits', () => {
  let n = 0;
  for (const st of STATES) {
    for (const mark of MARKS) {
      seed(st, mark);
      const tag = `P${st.p} R${st.r} ★${st.s} ${mark || 'no mark'} XP`;
      const fm = finalMark(mark);
      const c = statChain(statBoard().xp, { v3: V3, stars: st.s, markBaseXp: fm.xpBase });
      const by = Object.fromEntries(c.chips.map((k) => [k.id, k.mult]));
      assert.equal(c.base, (10 + fm.xpBase) / 10, `${tag}: BASE (1, a +N BASE mark sized against 10)`);
      assert.equal(by.power, 2 ** st.p, `${tag}: KEY 2^T`);
      assert.equal(by.rebirth, 3 ** st.r, `${tag}: REBIRTH 3^R`);
      assert.equal(by.ascend, undefined, `${tag}: no STARS chip`);
      assert.ok(Math.abs(by.mark - fm.xp) < 1e-9, `${tag}: MARK is FINAL's tier ×${fm.xp} (was ${by.mark})`);
      relClose(c.chips.reduce((p, k) => p * k.mult, c.base), c.total, 1e-9, `${tag} exact`);
      const shown = c.chips.reduce((p, k) => p * shownNum(boardMult(k.mult)), shownNum(formatStatRate(c.base)));
      relClose(shown, c.total, 0.002, `${tag} printed chips vs TOTAL`); // chips print to 3 decimals (<×10) / 2 (<×10,000)
      relClose(shownNum(formatStatRate(c.total)), shown, 0.006, `${tag} as printed`); // the printed TOTAL is 3 sig. figs from 10,000
      assert.equal(c.total, letterXpNow(), `${tag}: TOTAL is letterXpNow`);
      const idx = indexMult(loadRollState());
      const final = E.xpPerLetter({ power: st.p, rebirths: st.r, stars: st.s, mark: fm.xp * idx, markBase: fm.xpBase });
      relClose(c.total, final, 1e-12, `${tag}: TOTAL is FINAL's formula`);
      // a game letter credits exactly TOTAL (season 2: a typed game letter pays ×1 at once)
      const r = creditLetterXp(1, { mode: 'chain' });
      relClose(r.xp, c.total, 1e-12, `${tag}: one letter credits TOTAL (season 2 keeps the fraction)`);
      n += 1;
    }
  }
  assert.equal(n, STATES.length * MARKS.length);
});

test('FINAL mark tiers reach the rolled pool: LEGENDARY ×2, MYTHIC +20 BASE (×3), SECRET ×5 — not the live ×3 / +90 / ×25', () => {
  assert.equal(rollMarkById('mk-eclipse').stat.value, 100);
  assert.equal(rollMarkById('mk-singularity').stat.value, 20);
  assert.equal(rollMarkById('mk-origin').stat.value, 400);
});

// The menu's rate line and the rail's UPGRADES tile at the very start (T0 R0, nothing worn): "MENU +1 XP / KEY · GAMES +1
// XP / LETTER", and the UPGRADES tile prints the T1 price (150 wins).
test('FINAL v3 at T0 R0: a menu key pays +1 XP (×0.2 rounded, floor 1), a game letter +1 XP; UPGRADES shows the T1 price 150', () => {
  localStorage.clear();
  assert.equal(xpPerInput({ mode: 'menu' }), 1, 'MENU +1 XP / KEY');
  assert.equal(letterXpNow(), 1, 'GAMES +1 XP / LETTER');
  resetLetterXp();
  assert.equal(creditLetterXp(1, { mode: 'chain' }).xp, 1, 'one game letter credits 1');
  assert.equal(keyTierCost(0), 150, 'UPGRADES: the T1 price');
  assert.deepEqual([1, 2, 3].map((t) => keyTierCost(t)), [750, 3750, 18750]);
  // the menu key's floor: ×0.2 of 1, 2 and 4 XP all round to 0 → 1; at 8 XP a letter (T3) it is 2
  localStorage.setItem('taw.keytier', '2');
  assert.equal(xpPerInput({ mode: 'menu' }), 1);
  localStorage.setItem('taw.keytier', '3');
  assert.equal(xpPerInput({ mode: 'menu' }), 2);
  localStorage.clear();
});
