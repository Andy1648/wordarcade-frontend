import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEAGUES, LEAGUE_ART, leagueOf, leagueMove, nextLeague } from './leagues.js';
import { leagueRange, rangeLabel } from './leagueRange.js';
import { LEAGUE_PLATE } from './leaguePlate.js';

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public');

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

test('every league ships its badge and knows where its name-plate tab is', () => {
  for (const l of LEAGUES) {
    assert.ok(existsSync(join(PUBLIC, LEAGUE_ART[l.key])), l.key);
    const p = LEAGUE_PLATE[l.key];
    assert.ok(p && p.x > 0.35 && p.x < 0.65 && p.y > 0.7 && p.y < 0.95 && p.w > 0.2 && p.w < 0.5, l.key); // the tab: bottom-centre
  }
});

test('ranges: read off the cutoffs, written one way, covering every rank once', () => {
  assert.deepEqual(leagueRange(LEAGUES[0]), { lo: 1, hi: 1 });
  assert.deepEqual(leagueRange(LEAGUES[2]), { lo: 11, hi: 50 });
  assert.deepEqual(leagueRange(LEAGUES[LEAGUES.length - 1]), { lo: 1601, hi: null });
  assert.equal(rangeLabel(LEAGUES[0]), 'RANK 1');
  assert.equal(rangeLabel(LEAGUES[1]), 'RANKS 2–10');
  assert.equal(rangeLabel(LEAGUES[4]), 'RANKS 101–300');
  assert.equal(rangeLabel(LEAGUES[7]), 'RANKS 1,601+');
  for (let i = 1; i < LEAGUES.length; i++) assert.equal(leagueRange(LEAGUES[i]).lo, LEAGUES[i - 1].top + 1);
  for (const r of [1, 2, 10, 11, 50, 51, 100, 101, 300, 301, 800, 801, 1600, 1601, 9999]) {
    const { lo, hi } = leagueRange(leagueOf(r));
    assert.ok(r >= lo && (hi == null || r <= hi), String(r));
  }
});
