// statBoard.test.js — the STAT BOARD (Andy oct5) never claims a bonus the game does not pay: BASE × every line
// = TOTAL, and TOTAL is the payout's own number (perWordRateNow / letterXpNow), across many saves.
import test from 'node:test';
import assert from 'node:assert/strict';
import { statBoard, boardProduct, boardMult, BOARD_MODE } from './statBoard.js';
import { perWordRateNow } from './wins.js';
import { letterXpNow } from './letterXp.js';
import { ROLL_STATE_KEY } from './markRolls.js';
import { MARKS_EQUIPPED_KEY } from './marks.js';
import { BOOST_KEY } from './boost.js';
import { FRENZY_KEY } from './frenzy.js';

function withStorage(seed, fn) {
  const map = new Map(Object.entries(seed || {}));
  const saved = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    key: (i) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
  try {
    return fn(map);
  } finally {
    if (saved === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = saved;
  }
}

const MARK_IDS = [
  null, // nothing worn
  'mk-bomber', // COMMON +% WINS (legacy id)
  'mk-sprinter', // COMMON +% XP
  'mk-sparky', // COMMON +BASE WINS
  'mk-dasher', // COMMON +BASE XP
  'mk-inkwell', // luck — touches neither stack
  'mk-tinder', // OVERDRIVE length — touches neither stack
  'mk-nova', // EPIC +% WINS
  'mk-golem', // EPIC +BASE XP
  'mk-leviathan', // LEGENDARY +% XP + DOUBLE LETTERS
  'mk-eclipse', // LEGENDARY +% WINS
  'mk-singularity', // MYTHIC +90 BASE WINS
  'mk-kraken', // MYTHIC +90 BASE XP
  'mk-origin', // SECRET +2400% WINS (FRENZY in every mode)
  'mk-legend', // PERMANENT — MAIN on wins AND XP
];

function save({ mark, copies = 1, kt = 0, rc = 0, boost = false, frenzy = false }) {
  const owned = {};
  for (const id of MARK_IDS) if (id) owned[id] = { n: id === mark ? copies : 1 };
  const s = {
    [ROLL_STATE_KEY]: JSON.stringify({ v: 2, starter: true, marks: owned }),
    'taw.keytier': String(kt),
    'taw.rebirths': String(rc),
  };
  if (mark) s[MARKS_EQUIPPED_KEY] = mark;
  if (boost) s[BOOST_KEY] = JSON.stringify({ until: Date.now() + 600000, mult: 3 });
  if (frenzy) s[FRENZY_KEY] = String(Date.now() + 600000);
  return s;
}

// wins are paid on a whole-XP grid (a tenth of a win); XP per letter is unrounded
const close = (a, b, grid, msg) => {
  const tol = Math.max(grid, Math.abs(b) * 1e-9);
  assert.ok(Math.abs(a - b) <= tol, `${msg}: board ${a} vs paid ${b}`);
};

test('BASE × every line = TOTAL = what the game pays, across saves (wins/word and XP/letter)', () => {
  let n = 0;
  for (const mark of MARK_IDS) {
    for (const [kt, rc] of [[0, 0], [3, 1], [9, 4], [14, 12], [40, 60]]) {
      for (const [boost, frenzy, copies] of [[false, false, 1], [true, false, 16], [true, true, 4]]) {
        withStorage(save({ mark, kt, rc, boost, frenzy, copies }), () => {
          const b = statBoard();
          const tag = `${mark} T${kt} R${rc} boost=${boost} frenzy=${frenzy} x${copies}`;
          assert.equal(b.wins.total, perWordRateNow({ mode: BOARD_MODE }).rate, `${tag} wins TOTAL is the payout`);
          assert.equal(b.xp.total, letterXpNow(), `${tag} XP TOTAL is the payout`);
          close(boardProduct(b.wins), b.wins.total, 0.05 + 1e-9, `${tag} wins`);
          close(boardProduct(b.xp), b.xp.total, 1e-9, `${tag} xp`);
          n += 1;
        });
      }
    }
  }
  assert.ok(n >= 200);
});

test('the lines are Andy\'s: wins = REBIRTH · MARK · BOOST; XP = KEY · REBIRTH · MARK · BOOST', () => {
  withStorage({}, () => {
    // a fresh save: nothing owned (no INDEX bonus), nothing worn
    const b = statBoard();
    assert.deepEqual(b.wins.lines.map((l) => l.label), ['REBIRTH', 'MARK', 'BOOST']);
    assert.deepEqual(b.xp.lines.map((l) => l.label), ['POWER', 'REBIRTH', 'MARK', 'BOOST']);
    assert.equal(b.wins.base, 10);
    assert.equal(b.xp.base, 10);
    assert.equal(b.wins.total, 10);
    assert.equal(b.xp.total, 10);
  });
});

test('+N BASE stats land in BASE (before every multiplier), not in a line', () => {
  withStorage(save({ mark: 'mk-singularity', rc: 1 }), () => {
    const b = statBoard();
    assert.equal(b.wins.base, 100);
    assert.equal(b.xp.base, 10);
  });
  withStorage(save({ mark: 'mk-kraken' }), () => {
    const b = statBoard();
    assert.equal(b.xp.base, 100);
    assert.equal(b.wins.base, 10);
  });
});

test('tier colours: KEY and REBIRTH from their ramps, MARK from the worn mark\'s rarity', () => {
  withStorage(save({ mark: 'mk-eclipse', kt: 4, rc: 3 }), () => {
    const b = statBoard();
    const by = (s, id) => s.lines.find((l) => l.id === id);
    assert.equal(by(b.xp, 'key').tier, 'epic');
    assert.equal(by(b.xp, 'rebirth').tier, 'epic');
    assert.equal(by(b.wins, 'mark').tier, 'legendary');
    assert.equal(by(b.xp, 'mark').tier, 'legendary');
  });
  withStorage(save({ mark: null }), () => {
    const b = statBoard();
    assert.equal(b.wins.lines.find((l) => l.id === 'mark').tier, null);
    assert.equal(b.wins.lines.find((l) => l.id === 'rebirth').tier, null, 'R0 has no rebirth tier');
  });
});

test('boardMult: exact below ×10, whole from ×10 (no ×27.98), abbreviated from ×10,000', () => {
  assert.equal(boardMult(1), '1');
  assert.equal(boardMult(1.05), '1.05');
  assert.equal(boardMult(3.017), '3.02');
  assert.equal(boardMult(27.98), '28');
  assert.equal(boardMult(125), '125');
  assert.equal(boardMult(9765625), '9.77M');
  assert.doesNotMatch(boardMult(1e300), /e|Infinity|NaN/);
});

test('statChain (flag OFF): the stack\'s own lines, no ASCEND; BASE × every chip = TOTAL', async () => {
  const { statChain } = await import('./statBoard.js');
  withStorage(save({ mark: 'mk-eclipse', kt: 4, rc: 3, boost: true }), () => {
    const b = statBoard();
    const w = statChain(b.wins);
    const x = statChain(b.xp);
    assert.deepEqual(w.chips.map((c) => c.label), ['REBIRTH', 'MARK', 'BOOST']);
    assert.deepEqual(x.chips.map((c) => c.label), ['POWER', 'REBIRTH', 'MARK', 'BOOST']);
    for (const c of [w, x]) close(c.chips.reduce((p, k) => p * k.mult, c.base), c.total, 0.05 + 1e-9, c.id);
  });
});
