// rankMove.test.js — H2a: the board's ▲N must survive the menu's real path. The menu's rank check
// moves lastRank to the new rank AND the trophy tap clears the news flag before the board loads, so
// the board reads the pending rankFrom on its own — never through the news flag.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyRankCheck, rankMoveSinceSeen, setRankNews, hasRankNews, getLastRank, setLastRank, clearRankFrom,
  getRankFrom, checkRankUp, markBoardSeen, getBoardSeenEpoch,
} from './client.js';

beforeEach(() => {
  const m = new Map();
  globalThis.localStorage = {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
});

test('menu check → trophy tap (news cleared) → board load still sees #12 → #9', () => {
  setLastRank(12);
  assert.deepEqual(applyRankCheck(9), { from: 12, to: 9 });
  assert.equal(getLastRank(), 9, 'the menu check already moved the baseline');
  setRankNews(false); // handleLeaderboard: opening the board is reading the news
  assert.deepEqual(rankMoveSinceSeen(9), { from: 12, to: 9 });
  // the board consumes it
  clearRankFrom();
  setLastRank(9);
  assert.equal(rankMoveSinceSeen(9), null, 'the next open does not replay ▲3');
});

test('two unseen rises read as one bigger one (the oldest rank wins)', () => {
  setLastRank(20);
  applyRankCheck(15);
  applyRankCheck(9);
  assert.equal(getRankFrom(), 20);
  assert.deepEqual(rankMoveSinceSeen(9), { from: 20, to: 9 });
});

test('no menu check at all: the board measures from lastRank', () => {
  setLastRank(12);
  assert.deepEqual(rankMoveSinceSeen(9), { from: 12, to: 9 });
  assert.equal(rankMoveSinceSeen(12), null);
  assert.equal(rankMoveSinceSeen(14), null, 'a drop is never a move');
});

test('a rank check that began before the board opened does not write when it lands', async () => {
  setLastRank(12);
  const epoch = getBoardSeenEpoch();
  markBoardSeen(); // the board opened while the check was in flight
  // (LEADERBOARD_ENABLED is off under node, so the fetch is null; the epoch guard is what we pin here)
  assert.equal(await checkRankUp(epoch), null);
  assert.equal(hasRankNews(), false);
  assert.equal(getRankFrom(), null);
  assert.notEqual(epoch, getBoardSeenEpoch());
});
