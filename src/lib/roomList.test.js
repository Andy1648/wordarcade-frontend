import test from 'node:test';
import assert from 'node:assert/strict';
import { groupRooms, sortRooms, rowAction, watchOf, startsInSec } from './roomList.js';

const lobby = (code, n, extra = {}) => ({ code, status: 'waiting', playerCount: n, maxPlayers: 8, gameType: 'word-bomb', ...extra });
const live = (code, n, extra = {}) => ({ code, status: 'playing', playerCount: n, maxPlayers: 8, gameType: 'word-bomb', canSpectate: true, watch: 'open', ...extra });

test('lobbies first (counting down soonest, then fullest), then live games (watchable first, then busiest)', () => {
  const rooms = [
    live('L1', 3, { watch: 'unsupported', canSpectate: false }),
    lobby('A', 2),
    live('L2', 2),
    lobby('B', 5),
    lobby('C', 1, { startsInMs: 9000 }),
    lobby('D', 1, { startsInMs: 3000 }),
    live('L3', 6),
    lobby('FULL', 8), // a full lobby is never listed
  ];
  assert.deepEqual(sortRooms(rooms).map((r) => r.code), ['D', 'C', 'B', 'A', 'L3', 'L2', 'L1']);
  const g = groupRooms(rooms);
  assert.deepEqual(g.lobbies.map((r) => r.code), ['D', 'C', 'B', 'A']);
  assert.deepEqual(g.live.map((r) => r.code), ['L3', 'L2', 'L1']);
  assert.deepEqual(sortRooms(null), []);
});

test('ties keep the server order', () => {
  assert.deepEqual(sortRooms([lobby('X', 2), lobby('Y', 2), lobby('Z', 2)]).map((r) => r.code), ['X', 'Y', 'Z']);
});

test('a live game that cannot take a watcher says why and is never a SPECTATE', () => {
  assert.deepEqual(rowAction(live('L', 2)), { status: 'PLAYING', verb: 'SPECTATE', kind: 'watch' });
  assert.equal(rowAction(live('L', 2, { watch: 'unsupported', canSpectate: false })).verb, 'NO SPECTATE');
  assert.equal(rowAction(live('L', 2, { watch: 'full', canSpectate: false })).verb, 'WATCH FULL');
  assert.equal(rowAction(live('L', 2, { watch: 'full' })).kind, 'none');
  // an older server: only canSpectate
  assert.equal(watchOf({ code: 'O', status: 'playing', canSpectate: false }), 'unsupported');
  assert.equal(watchOf({ code: 'O', status: 'playing' }), 'open');
  assert.equal(watchOf(lobby('A', 1)), null);
});

test('a lobby counting down says STARTS IN, ticking from when the list arrived', () => {
  const r = lobby('C', 2, { startsInMs: 9000 });
  assert.equal(rowAction(r, { receivedAt: 1000, now: 1000 }).status, 'STARTS IN 9s');
  assert.equal(rowAction(r, { receivedAt: 1000, now: 4500 }).status, 'STARTS IN 6s');
  assert.equal(rowAction(r, { receivedAt: 1000, now: 20000 }).status, 'STARTING');
  assert.equal(rowAction(lobby('A', 1)).status, 'IN LOBBY');
  assert.equal(startsInSec(lobby('A', 1), 0, 0), null);
});

test('a full lobby: left out by default, kept last (FULL, not pressable) on the JOIN ROOM list', () => {
  const rooms = [lobby('FULL', 8), lobby('A', 2), live('L', 3)];
  assert.deepEqual(groupRooms(rooms).lobbies.map((r) => r.code), ['A']);
  assert.deepEqual(groupRooms(rooms, { keepFull: true }).lobbies.map((r) => r.code), ['A', 'FULL']);
  assert.deepEqual(rowAction(lobby('FULL', 8)), { status: 'IN LOBBY', verb: 'FULL', kind: 'none' });
});
