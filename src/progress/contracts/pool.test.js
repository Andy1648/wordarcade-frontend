// pool.test.js — DAILY CONTRACTS: the pool's shape, the deterministic day pick (tiers, distinct modes, locked modes),
// the one reroll, and the event reducer (count / best-of-run / distinct / letters).
import test from 'node:test';
import assert from 'node:assert/strict';
import { POOL, BY_ID, MODES, TIER_GEMS, pickDay, freshDay, rerollSlot, applyEvent, allDone, progressOf, modeOf } from './pool.js';

test('the pool: ~40 tasks, unique ids, every mode covered at every sensible tier, a reward per tier', () => {
  assert.ok(POOL.length >= 38 && POOL.length <= 44, `pool size ${POOL.length}`);
  assert.equal(new Set(POOL.map((c) => c.id)).size, POOL.length);
  for (const m of [...MODES, 'any']) assert.ok(POOL.some((c) => c.mode === m), m);
  for (const c of POOL) {
    assert.ok([1, 2, 3].includes(c.tier), c.id);
    assert.ok(TIER_GEMS[c.tier] > 0);
    assert.ok(c.target >= 1 && typeof c.when === 'function', c.id);
    assert.ok(['word', 'run', 'game', 'sat', 'combo', 'lucky'].includes(c.on), c.id);
  }
});

test('pickDay: deterministic per date, one per tier, three different modes, at most one ANY', () => {
  for (let d = 1; d <= 60; d += 1) {
    const day = `2026-11-${String((d % 28) + 1).padStart(2, '0')}-${d}`;
    const a = pickDay(day);
    assert.deepEqual(a, pickDay(day));
    assert.equal(a.length, 3);
    assert.deepEqual(a.map((id) => BY_ID[id].tier), [1, 2, 3]);
    const modes = a.map((id) => BY_ID[id].mode);
    assert.equal(new Set(modes).size, 3, `${day} ${modes}`);
  }
  // different days differ (not one fixed trio)
  const trios = new Set(Array.from({ length: 20 }, (_, i) => pickDay(`2026-10-${i + 1}`).join()));
  assert.ok(trios.size > 10);
});

test('pickDay: never deals a locked mode', () => {
  const open = ['wb', 'blitz', 'sat', 'race']; // CHAIN (LV25) + FUSE (LV50) still locked
  for (let i = 0; i < 80; i += 1) {
    for (const id of pickDay(`d${i}`, open)) assert.ok(['any', ...open].includes(BY_ID[id].mode), id);
  }
});

test('rerollSlot: once a day, same tier, a fresh mode, never a finished task', () => {
  const s = freshDay('2026-10-21');
  const r = rerollSlot(s, 1);
  assert.ok(r);
  assert.notEqual(r.picks[1], s.picks[1]);
  assert.equal(BY_ID[r.picks[1]].tier, 2);
  assert.equal(new Set(r.picks.map((id) => BY_ID[id].mode)).size, 3);
  assert.equal(rerollSlot(r, 0), null, 'second reroll refused');
  const done = { ...s, done: [s.picks[2]] };
  assert.equal(rerollSlot(done, 2), null, 'a finished task is kept');
});

test('applyEvent: counts, finishes once, ignores other modes', () => {
  const s = { ...freshDay('x'), picks: ['wb-words', 'sat-first', 'any-letters'] };
  let st = s;
  for (let i = 0; i < 9; i += 1) st = applyEvent(st, { type: 'word', mode: 'word-bomb', word: 'cat', len: 3 }).state;
  assert.equal(progressOf(st, 'wb-words'), 9);
  assert.equal(progressOf(st, 'any-letters'), 27);
  const r = applyEvent(st, { type: 'word', mode: 'wordBomb', word: 'dog', len: 3 });
  assert.deepEqual(r.ticks.find((t) => t.id === 'wb-words'), { id: 'wb-words', from: 9, to: 10, target: 10, done: true });
  assert.ok(r.state.done.includes('wb-words'));
  const again = applyEvent(r.state, { type: 'word', mode: 'word-bomb', word: 'eel', len: 3 });
  assert.equal(again.ticks.some((t) => t.id === 'wb-words'), false, 'a done task never ticks again');
  // a CHAIN word moves ANY tasks, not the WORD BOMB one
  const c = applyEvent(s, { type: 'word', mode: 'chain', word: 'lantern', len: 7 });
  assert.equal(progressOf(c.state, 'wb-words'), 0);
  assert.equal(progressOf(c.state, 'any-letters'), 7);
});

test('applyEvent: best-of-run, SAT stage, distinct modes, wins need rivals', () => {
  let s = { ...freshDay('x'), picks: ['ch-run10', 'sat-first', 'any-three'] };
  s = applyEvent(s, { type: 'run', mode: 'chain', n: 6 }).state;
  s = applyEvent(s, { type: 'run', mode: 'chain', n: 2 }).state; // a new, shorter chain never lowers it
  assert.equal(progressOf(s, 'ch-run10'), 6);
  s = applyEvent(s, { type: 'sat', stage: 1 }).state;
  assert.equal(progressOf(s, 'sat-first'), 0);
  s = applyEvent(s, { type: 'sat', stage: 0 }).state;
  assert.ok(s.done.includes('sat-first'));
  for (const m of ['chain', 'chain', 'fuse', 'sat-rush']) s = applyEvent(s, { type: 'word', mode: m, word: 'abc', len: 3 }).state;
  assert.ok(s.done.includes('any-three'));
  assert.equal(allDone(s), false);
  s = applyEvent(s, { type: 'run', mode: 'chain', n: 10 }).state;
  assert.equal(allDone(s), true);

  let w = { ...freshDay('x'), picks: ['wb-win'] };
  w = applyEvent(w, { type: 'game', mode: 'word-bomb', won: true, rivals: 0 }).state;
  assert.equal(progressOf(w, 'wb-win'), 0, 'a game alone is not a win');
  w = applyEvent(w, { type: 'game', mode: 'word-bomb', won: true, rivals: 2 }).state;
  assert.equal(progressOf(w, 'wb-win'), 1);
});

test('the word checks: rarity bands, Q/Z/X/J, double letters, all five vowels', () => {
  const one = (id, ev) => applyEvent({ ...freshDay('x'), picks: [id] }, { type: 'word', mode: 'chain', len: (ev.word || '').length, ...ev }).ticks.length;
  assert.equal(one('any-obscure', { word: 'sesquipedalian', band: 'OBSCURE' }), 1);
  assert.equal(one('any-obscure', { word: 'table', band: 'COMMON' }), 0);
  assert.equal(one('any-qzxj', { word: 'quiet' }), 1);
  assert.equal(one('any-qzxj', { word: 'table' }), 0);
  assert.equal(one('any-double', { word: 'balloon' }), 1);
  assert.equal(one('any-vowels', { word: 'education' }), 1);
  assert.equal(one('any-vowels', { word: 'audio' }), 0);
  assert.equal(modeOf('menu'), null);
});
