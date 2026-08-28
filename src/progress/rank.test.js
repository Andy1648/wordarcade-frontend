// rank.test.js — rank titles (Job 5). Pure, node --test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RANKS, rankTitle, rankFor, MAX_RANK_NAME_LEN } from './rank.js';

test('there are ~10 bands and names are ALL CAPS, unique, ≤ 8 chars', () => {
  assert.ok(RANKS.length >= 8 && RANKS.length <= 12, `band count ${RANKS.length}`);
  const names = RANKS.map((r) => r.name);
  assert.equal(new Set(names).size, names.length, 'duplicate rank name');
  for (const n of names) {
    assert.ok(n.length <= MAX_RANK_NAME_LEN, `"${n}" is ${n.length} chars`);
    assert.equal(n, n.toUpperCase(), `"${n}" not all caps`);
    assert.ok(/^[A-Z]+$/.test(n), `"${n}" not plain caps letters`);
  }
});

test('bands are strictly increasing and start at LV 1 (a total, gapless partition)', () => {
  assert.equal(RANKS[0].min, 1);
  for (let i = 1; i < RANKS.length; i++) {
    assert.ok(RANKS[i].min > RANKS[i - 1].min, `band ${i} min not increasing`);
  }
});

test('every level 1..1000 maps to EXACTLY ONE rank (total + deterministic)', () => {
  const valid = new Set(RANKS.map((r) => r.name));
  for (let lvl = 1; lvl <= 1000; lvl++) {
    const t = rankTitle(lvl);
    assert.ok(valid.has(t), `level ${lvl} -> unknown rank ${t}`);
    // Determinism: the same level always resolves identically.
    assert.equal(rankTitle(lvl), t);
    // It's the band whose min is the greatest min <= lvl.
    const expected = [...RANKS].reverse().find((r) => lvl >= r.min);
    assert.equal(t, expected.name);
  }
});

test('band boundaries land on the right rank', () => {
  assert.equal(rankTitle(1), 'ROOKIE');
  assert.equal(rankTitle(4), 'ROOKIE');
  assert.equal(rankTitle(5), 'TYPIST');
  assert.equal(rankTitle(9), 'TYPIST');
  assert.equal(rankTitle(10), 'SPELLER');
  assert.equal(rankTitle(30), 'BRAWLER');
  assert.equal(rankTitle(31), 'SHARK');
  assert.equal(rankTitle(100), 'UNREAL');
  assert.equal(rankTitle(99999), 'UNREAL');
});

test('out-of-range / garbage levels fall back to LV 1 (ROOKIE), never throw', () => {
  assert.equal(rankTitle(0), 'ROOKIE');
  assert.equal(rankTitle(-5), 'ROOKIE');
  assert.equal(rankTitle(NaN), 'ROOKIE');
  assert.equal(rankTitle(undefined), 'ROOKIE');
  assert.equal(rankFor(50).name, rankTitle(50));
});
