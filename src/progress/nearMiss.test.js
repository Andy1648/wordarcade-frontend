import test from 'node:test';
import assert from 'node:assert/strict';
import { nearMiss, wordShareAt, wordsToLevels, nextAvg, NEAR_MISS_MAX_RUNS } from './nearMiss.js';
import { formatNum } from '../format.js';

// A flat toy economy: every level needs 1,000 XP, a word pays 100 XP → 10 words a level.
const flat = { need: () => 1000, xpPerWord: 100 };

test('wordShareAt: XP over need, floored, 0 when unknowable', () => {
  assert.equal(wordShareAt(1, flat), 0.1);
  assert.equal(wordShareAt(1, { need: 1000, xpPerWord: 100 }), 0.1); // a number works too
  assert.equal(wordShareAt(1, { need: () => 1e6, xpPerWord: 100, floorFrac: () => 0.005 }), 0.005);
  assert.equal(wordShareAt(1, { need: () => 0, xpPerWord: 100 }), 0);
  assert.equal(wordShareAt(1, {}), 0);
});

test('wordsToLevels: remainder of this level + full levels after; Infinity past the cap', () => {
  assert.equal(wordsToLevels({ level: 5, frac: 0.5, levels: 1, ...flat }), 5);
  assert.equal(wordsToLevels({ level: 5, frac: 0.5, levels: 3, ...flat }), 25);
  assert.equal(wordsToLevels({ level: 5, frac: 0.5, levels: 3, cap: 20, ...flat }), Infinity);
  assert.equal(wordsToLevels({ level: 5, frac: 0, levels: 0, ...flat }), 0);
  assert.equal(wordsToLevels({ level: 5, frac: 0, levels: 1, need: () => 0, xpPerWord: 0 }), Infinity);
});

test('level goal: quoted in LETTERS (5 a word) to the NEXT level, through formatNum', () => {
  // 0.9 into LV40 → 1 word = 5 letters left; one run (20 words) gets it.
  const r = nearMiss({ level: 40, frac: 0.9, ...flat, avgWords: 20 });
  assert.equal(r.kind, 'level');
  assert.equal(r.text, '5 LETTERS TO LV 41');
  assert.ok(Math.abs(r.runs - 1 / 20) < 1e-9);
  // big numbers are formatted, never raw digits
  const big = nearMiss({ level: 1234, frac: 0, need: () => 1e6, xpPerWord: 100, avgWords: 20000 });
  assert.equal(big.text, `${formatNum(50000)} LETTERS TO LV ${formatNum(1235)}`);
});

test('shows NOTHING when one more run would not get there', () => {
  // 10 words to the level, but a run is only 5 words.
  assert.equal(nearMiss({ level: 3, frac: 0, ...flat, avgWords: 5 }), null);
  // exactly one run is still "one more run"
  assert.equal(nearMiss({ level: 3, frac: 0, ...flat, avgWords: 10 }).kind, 'level');
  assert.equal(NEAR_MISS_MAX_RUNS, 1);
});

test('no average → nothing (never a guess at zero)', () => {
  assert.equal(nearMiss({ level: 3, frac: 0.99, ...flat, avgWords: 0 }), null);
  assert.equal(nearMiss({ level: 3, frac: 0.99, ...flat }), null);
});

test('the bar floor makes a slow level reachable (and is what is quoted)', () => {
  // raw: 1e6 XP need / 100 a word = 10,000 words; floor 0.5% → 200 words a level.
  const p = { level: 300, frac: 0.95, need: () => 1e6, xpPerWord: 100, avgWords: 12 };
  assert.equal(nearMiss(p), null); // no floor: hopeless
  const r = nearMiss({ ...p, floorFrac: () => 0.005 });
  assert.equal(r.kind, 'level'); // 0.05 / 0.005 = 10 words
  assert.equal(r.text, '50 LETTERS TO LV 301');
});

test('KEY TIER: words = (cost − balance) / wins per word; picked when it is the closest', () => {
  const r = nearMiss({ level: 10, frac: 0, ...flat, avgWords: 15, key: { tier: 4, cost: 12960, balance: 12000, rate: 80 } });
  // level needs 10 words; key needs 960/80 = 12 words → level is closer
  assert.equal(r.kind, 'level');
  const k = nearMiss({ level: 10, frac: 0, ...flat, avgWords: 15, key: { tier: 4, cost: 12960, balance: 12500, rate: 80 } });
  // 460/80 = 5.75 words → KEY wins, rounded UP to whole words
  assert.equal(k.kind, 'key');
  assert.equal(k.text, 'POWER 5 IN 6 WORDS');
  const one = nearMiss({ level: 10, frac: 0, ...flat, avgWords: 15, key: { tier: 0, cost: 10, balance: 5, rate: 40 } });
  assert.equal(one.text, 'POWER 1 IN 1 WORD');
});

test('KEY TIER already affordable is not a near miss', () => {
  const r = nearMiss({ level: 10, frac: 0, ...flat, avgWords: 5, key: { tier: 2, cost: 360, balance: 400, rate: 10 } });
  assert.equal(r, null);
});

test('BOARD: levels to the row above; level-tied rows are skipped', () => {
  const board = { rank: 8, aboveRank: 7, aboveLevel: 41 };
  const r = nearMiss({ level: 40, frac: 0.5, ...flat, avgWords: 20, board });
  // board (1 LV) and level tie at 5 words → board wins the tie
  assert.equal(r.kind, 'board');
  assert.equal(r.text, '1 LV TO #7');
  const tied = nearMiss({ level: 40, frac: 0.5, ...flat, avgWords: 20, board: { rank: 8, aboveRank: 7, aboveLevel: 40 } });
  assert.equal(tied.kind, 'level');
  // #1 has nobody above
  assert.equal(nearMiss({ level: 40, frac: 0.5, ...flat, avgWords: 20, board: { rank: 1, aboveRank: 0, aboveLevel: 99 } }).kind, 'level');
  // two levels away, inside one run (5 + 10 = 15 words of 20)
  const two = nearMiss({ level: 40, frac: 0.5, ...flat, avgWords: 20, board: { rank: 8, aboveRank: 7, aboveLevel: 42 } });
  assert.equal(two.kind, 'level'); // still: the next level is closer than the board row
});

test('tie order: board > level > key', () => {
  // board 1 LV (5 words) == level (5 words) == key (50/10 = 5 words)
  const key = { tier: 1, cost: 60, balance: 10, rate: 10 };
  const r = nearMiss({ level: 40, frac: 0.5, ...flat, avgWords: 20, board: { rank: 3, aboveRank: 2, aboveLevel: 41 }, key });
  assert.equal(r.kind, 'board');
  assert.equal(nearMiss({ level: 40, frac: 0.5, ...flat, avgWords: 20, key }).kind, 'level');
  // and key beats nothing-closer: level out of reach, key in reach
  assert.equal(nearMiss({ level: 40, frac: 0, ...flat, avgWords: 6, key }).kind, 'key');
});

test('garbage in → null or a sane line, never a throw', () => {
  assert.equal(nearMiss(), null);
  assert.equal(nearMiss({ level: NaN, frac: NaN, need: () => NaN, xpPerWord: NaN, avgWords: 10 }), null);
  const r = nearMiss({ level: -3, frac: 2, ...flat, avgWords: 10 });
  assert.equal(r.text, '1 LETTER TO LV 2'); // frac clamps to 1 → the minimum one letter
});

test('nextAvg: first run seeds it; later runs are smoothed; a zero run changes nothing', () => {
  assert.equal(nextAvg(0, 100), 100);
  assert.equal(nextAvg(null, 100), 100);
  assert.equal(nextAvg(100, 200), 130);
  assert.equal(nextAvg(100, 0), 100);
  assert.equal(nextAvg(0, 0), 0);
});
