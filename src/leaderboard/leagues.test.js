import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEAGUES, leagueOf, leagueMove, nextLeague } from './leagues.js';

test('leagueOf: the cutoffs, edges included', () => {
  const at = (r) => (leagueOf(r) || {}).key;
  assert.equal(at(1), 'legend');
  assert.equal(at(2), 'champion');
  assert.equal(at(10), 'champion');
  assert.equal(at(11), 'titan');
  assert.equal(at(50), 'titan');
  assert.equal(at(100), 'master');
  assert.equal(at(101), 'crystal');
  assert.equal(at(300), 'crystal');
  assert.equal(at(800), 'gold');
  assert.equal(at(1600), 'silver');
  assert.equal(at(1601), 'bronze');
  assert.equal(at(99999), 'bronze');
  assert.equal(leagueOf(0), null);
  assert.equal(leagueOf(null), null);
  assert.equal(leagueOf('x'), null);
});

test('leagues are ordered best first with rising cutoffs', () => {
  for (let i = 1; i < LEAGUES.length; i++) assert.ok(LEAGUES[i].top > LEAGUES[i - 1].top);
});

test('leagueMove: a promotion, a demotion, the same league, a first look', () => {
  assert.deepEqual(leagueMove(120, 95), { dir: 'up', league: LEAGUES[3] });
  assert.deepEqual(leagueMove(95, 120), { dir: 'down', league: LEAGUES[4] });
  assert.equal(leagueMove(150, 120), null);
  assert.equal(leagueMove(null, 5), null);
});

test('nextLeague: places to climb into the band above', () => {
  assert.deepEqual(nextLeague(120), { league: LEAGUES[3], places: 20 });
  assert.deepEqual(nextLeague(2), { league: LEAGUES[0], places: 1 });
  assert.equal(nextLeague(1), null);
  assert.equal(nextLeague(0), null);
});

test('promotion shards: every set is a painted shard set; bronze + silver promote quietly', async () => {
  const { LEAGUE_SHARDS, LEAGUE_COLOR } = await import('./leagues.js');
  const { SHARD_SETS } = await import('../fx/shards/shardPlan.js');
  for (const [k, set] of Object.entries(LEAGUE_SHARDS)) {
    assert.ok(LEAGUES.some((l) => l.key === k), `${k} is a league`);
    assert.ok(SHARD_SETS.includes(set), `${k}: ${set} is a shard set`);
  }
  assert.equal(LEAGUE_SHARDS.bronze, undefined);
  assert.equal(LEAGUE_SHARDS.silver, undefined);
  for (const l of LEAGUES) assert.match(LEAGUE_COLOR[l.key], /^#[0-9A-F]{6}$/i);
});
