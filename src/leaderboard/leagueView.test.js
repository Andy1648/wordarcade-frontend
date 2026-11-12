import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leagueBand, leagueRows } from './leagueView.js';

test('leagueBand: the places, the next league and the places left, at every edge', () => {
  const legend = leagueBand(1);
  assert.equal(legend.league.key, 'legend');
  assert.equal(legend.next, null);
  assert.equal(legend.toNext, 0);
  assert.equal(legend.fill, 1);

  const c = leagueBand(10);
  assert.deepEqual([c.league.key, c.lo, c.hi, c.next.key, c.toNext], ['champion', 2, 10, 'legend', 9]);
  assert.equal(c.fill, 0, 'the last place in a league has climbed none of it');
  assert.equal(leagueBand(2).fill, 1, 'its first place has climbed all of it');
  assert.equal(leagueBand(2).toNext, 1);

  const t = leagueBand(11);
  assert.deepEqual([t.league.key, t.lo, t.hi, t.toNext], ['titan', 11, 50, 1]);
  assert.equal(leagueBand(1600).league.key, 'silver');
  assert.equal(leagueBand(801).next.key, 'gold');
});

test('leagueBand: BRONZE is open-ended, so the board size stands in for its floor', () => {
  const far = leagueBand(99999, 100000);
  assert.deepEqual([far.league.key, far.lo, far.hi, far.toNext], ['bronze', 1601, null, 98399]);
  assert.ok(far.fill >= 0 && far.fill < 0.01);
  assert.equal(leagueBand(1601, 2500).fill, 1);
  assert.equal(leagueBand(2500, 2500).fill, 0);
  assert.equal(leagueBand(2000).fill, 0, 'no total yet: an empty bar, never NaN');
  assert.equal(leagueBand(3000, 2500).fill, 0, 'a stale total smaller than your rank');
});

test('leagueBand: no rank, no league', () => {
  for (const r of [null, undefined, 0, -3, 'x']) assert.equal(leagueBand(r), null);
});

test('leagueRows: only your league, best first, you always in, nobody twice', () => {
  const row = (rank) => ({ id: `p${rank}`, rank });
  const me = row(12);
  const got = leagueRows([row(9), row(10), row(11), me, row(13), row(51)], me);
  assert.deepEqual(got.map((r) => r.rank), [11, 12, 13], 'CHAMPION above and MASTER below are cut');
  assert.deepEqual(leagueRows([], me).map((r) => r.rank), [12], 'a failed read still shows you');
  assert.deepEqual(leagueRows([row(1)], row(1)).map((r) => r.rank), [1], 'LEGEND is one seat');
  assert.deepEqual(leagueRows([row(1700), row(99999)], row(99999)).map((r) => r.rank), [1700, 99999], 'BRONZE has no floor');
  assert.deepEqual(leagueRows([row(1)], null), []);
});
