// menuWords.test.js — PROGRESSION FINAL menu anti-mash (v3/menuWords.js): real dictionary words only, ×0.2, the 60 s
// repeat decay ×1 / ×0.5 / ×0.25 / 0, and more than 12 letters a second earns 0.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createMenuWordJudge, menuWordXp, MENU_REPEAT_FACTORS, MENU_MAX_LETTERS_PER_SEC, MENU_REPEAT_WINDOW_MS } from './menuWords.js';

const DICT = new Set(['cat', 'house', 'words', 'a', 'zebra']);
const isWord = (w) => DICT.has(w);

test('constants are the FINAL spec', () => {
  assert.deepEqual(MENU_REPEAT_FACTORS, [1, 0.5, 0.25, 0]);
  assert.equal(MENU_MAX_LETTERS_PER_SEC, 12);
  assert.equal(MENU_REPEAT_WINDOW_MS, 60000);
});

test('only dictionary words pay; gibberish and 1-letter words pay 0', () => {
  const j = createMenuWordJudge({ isWord });
  assert.equal(j.judge('house', 0, 1000), 1);
  assert.equal(j.judge('hosue', 2000, 3000), 0);
  assert.equal(j.judge('asdfgh', 4000, 5000), 0);
  assert.equal(j.judge('a', 6000, 7000), 0, 'shorter than 2 letters');
  assert.equal(j.judge('HOUSE', 8000, 9000), 0.5, 'case-insensitive (and a repeat)');
  assert.equal(createMenuWordJudge({}).judge('house', 0, 1000), 0, 'no dictionary loaded → 0');
});

test('the same word within 60 s: ×1, ×0.5, ×0.25, then 0 — a 60 s gap starts it over', () => {
  const j = createMenuWordJudge({ isWord });
  const t = [0, 5000, 10000, 15000, 20000];
  assert.deepEqual(t.map((s) => j.judge('cat', s, s + 1000)), [1, 0.5, 0.25, 0, 0]);
  assert.equal(j.judge('cat', 200000, 201000), 1, 'after 60 s quiet the ladder resets');
  assert.equal(j.judge('zebra', 201500, 202500), 1, 'other words are independent');
});

test('faster than 12 letters a second earns 0 (and still counts as a repeat)', () => {
  const j = createMenuWordJudge({ isWord });
  assert.equal(j.judge('house', 0, 500), 1, '5 letters in 0.5 s = 10/s pays');
  assert.equal(createMenuWordJudge({ isWord }).judge('house', 0, 400), 0, '5 letters in 0.4 s = 12.5/s earns 0');
  const k = createMenuWordJudge({ isWord });
  assert.equal(k.judge('house', 0, 300), 0, '5 letters in 0.3 s = 16.7/s');
  assert.equal(k.judge('house', 1000, 2000), 0.5, 'the fast one still used the ×1');
  const z = createMenuWordJudge({ isWord });
  assert.equal(z.judge('words', 1000, 1000), 0, 'zero time = infinitely fast');
});

test('menuWordXp = letters × XP per game letter × 0.2 × factor, whole XP', () => {
  assert.equal(menuWordXp(5, 10, 1), 10);
  assert.equal(menuWordXp(5, 10, 0.5), 5);
  assert.equal(menuWordXp(5, 10, 0), 0);
  assert.equal(menuWordXp(4, 250, 0.25), 50);
  assert.equal(menuWordXp(0, 10, 1), 0);
});

test('a masher (12 random letters a second, 10 min) earns ~0', () => {
  const j = createMenuWordJudge({ isWord: (w) => DICT.has(w) });
  let rng = 42;
  const r = () => ((rng = (rng * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  let paid = 0;
  let t = 0;
  for (let i = 0; i < 1200; i++) {
    const len = 3 + Math.floor(r() * 5);
    const w = Array.from({ length: len }, () => String.fromCharCode(97 + Math.floor(r() * 26))).join('');
    const t1 = t + (len * 1000) / 12;
    paid += menuWordXp(len, 10, j.judge(w, t, t1));
    t = t1 + 83;
  }
  assert.equal(paid, 0);
});
