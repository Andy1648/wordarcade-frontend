// stickyRooms.test.js — the JOIN ROOM list keeps its rows still across auto-refreshes (fix/join-room-steady).
import test from 'node:test';
import assert from 'node:assert/strict';
import { groupRooms } from './roomList.js';
import { stickyGroups, GROUP_HOLD_MS } from './stickyRooms.js';

const lobby = (code, playerCount = 1, extra = {}) => ({ code, gameType: 'word-bomb', playerCount, maxPlayers: 8, status: 'waiting', ...extra });
const done = (code, playerCount = 4) => ({ code, gameType: 'word-bomb', playerCount, maxPlayers: 8, status: 'finished' });
const live = (code, playerCount = 4) => ({ code, gameType: 'word-bomb', playerCount, maxPlayers: 8, status: 'playing', watch: 'open' });
const codes = (out) => [out.lobbies.map((r) => r.code), out.live.map((r) => r.code)];
const step = (prev, rooms, now) => stickyGroups(prev && prev.state, groupRooms(rooms, { keepFull: true }), now);

test('the first list is groupRooms order, untouched', () => {
  const rooms = [lobby('A', 1), lobby('B', 5), live('L1', 2), live('L2', 6)];
  const out = step(null, rooms, 0);
  const g = groupRooms(rooms, { keepFull: true });
  assert.deepEqual(codes(out), [g.lobbies.map((r) => r.code), g.live.map((r) => r.code)]);
  assert.deepEqual(codes(out), [['B', 'A'], ['L2', 'L1']]);
});

test('count drift never reorders rows already on screen', () => {
  let s = step(null, [lobby('A', 5), lobby('B', 3), lobby('C', 1)], 0);
  assert.deepEqual(codes(s)[0], ['A', 'B', 'C']);
  // C is now the fullest: groupRooms alone would put it first
  s = step(s, [lobby('A', 2), lobby('B', 3), lobby('C', 7)], 5000);
  assert.deepEqual(codes(s)[0], ['A', 'B', 'C']);
  assert.equal(s.lobbies[2].playerCount, 7, 'rows carry the fresh data');
});

test('a new room joins the end of its group; a vanished room leaves without moving the rest', () => {
  let s = step(null, [lobby('A', 2), lobby('B', 1), live('L1')], 0);
  s = step(s, [lobby('N', 8 - 1), lobby('A', 2), lobby('B', 1), live('L1'), live('L2', 7)], 5000);
  assert.deepEqual(codes(s), [['A', 'B', 'N'], ['L1', 'L2']]);
  s = step(s, [lobby('B', 1), lobby('N', 7), live('L2', 7), live('L1')], 10000);
  assert.deepEqual(codes(s), [['B', 'N'], ['L1', 'L2']]);
});

test('a one-refresh status flicker never moves a row between groups', () => {
  let s = step(null, [lobby('A'), live('X'), live('Y')], 0);
  s = step(s, [lobby('A'), lobby('X'), live('Y')], 5000); // X flickers to waiting
  assert.deepEqual(codes(s), [['A'], ['X', 'Y']], 'held in its old group');
  assert.equal(s.live[0].status, 'waiting', 'the row shows its current status in place');
  s = step(s, [lobby('A'), live('X'), live('Y')], 10000); // and back
  assert.deepEqual(codes(s), [['A'], ['X', 'Y']]);
  assert.deepEqual(s.state.pending, {});
  // the flicker's clock restarts: a fresh flip later still waits the full hold
  s = step(s, [lobby('A'), lobby('X'), live('Y')], 15000);
  assert.deepEqual(codes(s), [['A'], ['X', 'Y']]);
});

test('a status change that holds for the hold time moves the row to the end of its new group', () => {
  let s = step(null, [lobby('A'), lobby('B'), live('Y')], 0);
  s = step(s, [lobby('A'), live('B'), live('Y')], 5000);
  assert.deepEqual(codes(s), [['A', 'B'], ['Y']]);
  s = step(s, [lobby('A'), live('B'), live('Y')], 5000 + GROUP_HOLD_MS - 1);
  assert.deepEqual(codes(s), [['A', 'B'], ['Y']]);
  s = step(s, [lobby('A'), live('B'), live('Y')], 5000 + GROUP_HOLD_MS);
  assert.deepEqual(codes(s), [['A'], ['Y', 'B']]);
});

test('empty and garbage in, empty out', () => {
  let s = step(null, [], 0);
  assert.deepEqual(codes(s), [[], []]);
  s = step(s, null, 1);
  assert.deepEqual(codes(s), [[], []]);
});

test("a 'finished' room never changes group, however long it stays finished", () => {
  let s = step(null, [lobby('A'), live('X'), live('Y')], 0);
  for (let t = 5000; t <= 40000; t += 5000) {
    s = step(s, [lobby('A'), done('X'), live('Y')], t);
    assert.deepEqual(codes(s), [['A'], ['X', 'Y']], `t=${t}`);
  }
  assert.equal(s.live[0].status, 'finished');
  s = step(s, [lobby('A'), live('X'), live('Y')], 45000); // rematch started: still in place
  assert.deepEqual(codes(s), [['A'], ['X', 'Y']]);
  // a lobby that shows as finished stays a lobby too
  s = step(s, [done('A'), live('X'), live('Y')], 50000);
  assert.deepEqual(codes(s), [['A'], ['X', 'Y']]);
});

test("a brand-new 'finished' room joins the lobbies; unknown statuses behave like lobbies", () => {
  let s = step(null, [lobby('A'), live('X')], 0);
  s = step(s, [lobby('A'), live('X'), done('F'), { ...lobby('U'), status: 'rematch' }], 5000);
  assert.deepEqual(codes(s), [['A', 'F', 'U'], ['X']]);
});

test("rowAction: 'finished' reads GAME OVER / JOIN; unknown statuses read as a lobby", async () => {
  const { rowAction } = await import('./roomList.js');
  assert.deepEqual(rowAction(done('F')), { status: 'GAME OVER', verb: 'JOIN', kind: 'join' });
  assert.deepEqual(rowAction({ ...lobby('U'), status: 'rematch' }), { status: 'IN LOBBY', verb: 'JOIN', kind: 'join' });
  assert.equal(rowAction(done('G', 8)).verb, 'FULL', 'a full finished room is still not joinable');
});
