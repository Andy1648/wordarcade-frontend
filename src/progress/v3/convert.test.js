// convert.test.js — THE SEASON 2 CONVERSION RULE (v3/convert.js; Andy oct6: no reset) on every REAL board row, its SQL
// half (025_season2_convert.sql = claude/run-season2-convert.sql), the 022 switch branch that keeps a converted row's
// progress, and the cancelled reset staying gone.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  RATES, ASCEND_AT, convertSave, convertRow, keptRebirths, starsFromRebirths, powerFromKey, powerPrice,
  POWER_COST_BASE, POWER_COST_STEP,
} from './convert.js';
import * as ECON from './econ.js';

const root = process.cwd();
const read = (...p) => readFileSync(join(root, ...p), 'utf8').replace(/\r\n/g, '\n');
const board = JSON.parse(read('claude', 'econ-oct2', 'board-snapshot-oct6.json'));

test('the rates the CI sim picked (claude/econ-oct2 --board HARD RULE) and the v3 constants they lean on', () => {
  assert.deepEqual({ ...RATES }, { STARS_PER_EXCESS: 10, POWER_PER_KEY: 1.5, POWER_CAP_BASE: 1, POWER_CAP_PER_R: 1 });
  assert.ok(Object.isFrozen(RATES));
  assert.equal(ASCEND_AT, ECON.ASCEND_AT);
  assert.equal(POWER_COST_BASE, ECON.POWER_COST_BASE);
  assert.equal(POWER_COST_STEP, ECON.POWER_COST_STEP);
  for (let p = 0; p <= 40; p += 1) assert.equal(powerPrice(p), ECON.powerCost(p), `powerPrice(${p})`);
});

test('rebirths: kept up to R10; ★: 1 per 10 rebirths above R10 (floor)', () => {
  assert.deepEqual([0, 1, 9, 10, 11, 13, 19, 20, 29, 30, 100, 1000].map((r) => keptRebirths(r)), [0, 1, 9, 10, 10, 10, 10, 10, 10, 10, 10, 10]);
  assert.deepEqual([0, 9, 10, 11, 13, 19, 20, 22, 29, 30, 100, 1000].map((r) => starsFromRebirths(r)), [0, 0, 0, 0, 0, 0, 1, 1, 1, 2, 9, 99]);
  // the ★ never out-rank a v3 player who made the same rebirths, ascending at every R10 (★ floor(N/10), R N mod 10)
  for (let n = 0; n <= 500; n += 1) {
    const st = starsFromRebirths(n);
    const r = keptRebirths(n);
    const mStars = Math.floor(n / 10);
    assert.ok(st < mStars || (st === mStars && r <= n % 10), `R${n} → R${r} ★${st} vs median ★${mStars} R${n % 10}`);
  }
  // junk in → 0
  assert.equal(starsFromRebirths(-5), 0);
  assert.equal(keptRebirths('x'), 0);
});

test('POWER: floor(KEY × 1.5), at most 1 + R (the kept rebirths)', () => {
  assert.equal(powerFromKey(0, 0), 0);
  assert.equal(powerFromKey(1, 0), 1); // floor(1.5) = 1, cap 1
  assert.equal(powerFromKey(3, 0), 1); // floor(4.5) = 4 → cap 1
  assert.equal(powerFromKey(6, 10), 9); // the e2e save: R13 KEY 6 → R10 → floor(9) = 9 ≤ 11
  assert.equal(powerFromKey(94, 10), 11); // R100's ~T94 → the R10 cap
  assert.equal(powerFromKey(9, 9), 10); // Xavi: floor(13.5) = 13 → cap 10
  assert.equal(powerFromKey(4, 3), 4); // floor(6) = 6 → cap 4
  assert.equal(powerFromKey(5, 99), 7, 'the cap reads the KEPT rebirths (≤ 10)');
});

test('convertSave: level / lifetime wins / gems kept as-is; the wallet kept up to the next POWER price', () => {
  const c = convertSave({ level: 558, frac: 0.25, rebirths: 29, keyTier: 28, wins: 1e30, winsLifetime: 4.2e31, gems: 1234 });
  assert.deepEqual([c.level, c.frac, c.rebirths, c.stars, c.power, c.gems, c.winsLifetime], [558, 0.25, 10, 1, 11, 1234, 4.2e31]);
  assert.equal(c.wins, powerPrice(11));
  assert.equal(c.winsCapped, 1e30 - powerPrice(11));
  assert.deepEqual(c.from, { rebirths: 29, keyTier: 28, wins: 1e30, stars: 0 });
  // a small wallet is kept exactly
  const small = convertSave({ level: 40, rebirths: 13, keyTier: 6, wins: 5000, gems: 900 });
  assert.deepEqual([small.level, small.rebirths, small.stars, small.power, small.wins, small.gems, small.winsCapped], [40, 10, 0, 9, 5000, 900, 0]);
  // ★ already held are kept and added to
  assert.equal(convertSave({ rebirths: 30, stars: 2 }).stars, 4);
  // an empty save converts to the fresh one
  assert.deepEqual([convertSave().level, convertSave().rebirths, convertSave().stars, convertSave().power, convertSave().wins], [1, 0, 0, 0, 0]);
});

test('EVERY REAL BOARD ROW (oct6 snapshot): rebirths ≤ 10, the excess → ★, level and words untouched', () => {
  assert.equal(board.length, 26);
  const want = {
    imbetterthanandy: [10, 9], john_does_a_bum: [10, 1], who_is_number_3: [10, 1], Daan: [10, 1], snapplemelon: [10, 0],
    超人: [10, 0], maSON_im_cRYAN: [10, 0], Tangie: [10, 0], Xavi: [9, 0], elol: [7, 0], NoBuffCookies: [7, 0], Joseph: [6, 0],
  };
  for (const row of board) {
    const c = convertRow(row);
    assert.ok(c.rebirths <= 10 && c.rebirths === Math.min(row.rebirths, 10), row.username);
    assert.equal(c.stars, Math.floor(Math.max(0, row.rebirths - 10) / 10), row.username);
    if (want[row.username]) assert.deepEqual([c.rebirths, c.stars], want[row.username], row.username);
    if (row.rebirths <= 10) assert.deepEqual(c, { rebirths: row.rebirths, stars: 0 }, `${row.username} is untouched`);
    const s = convertSave({ level: row.level, rebirths: row.rebirths, keyTier: row.rebirths, wins: 0, gems: 0 });
    assert.equal(s.level, row.level, `${row.username} keeps LV${row.level}`);
    assert.deepEqual([s.rebirths, s.stars], [c.rebirths, c.stars], 'the client and server halves agree');
  }
});

test('025 SQL = claude/run-season2-convert.sql, mirrors convert.js, and touches ONLY rebirths + stars', () => {
  const sql = read('supabase', 'migrations', '025_season2_convert.sql');
  assert.equal(read('claude', 'run-season2-convert.sql'), sql, 'the run file is the migration, byte for byte');
  assert.match(sql, new RegExp(`C_ASCEND_AT constant integer := ${ASCEND_AT};`));
  assert.match(sql, new RegExp(`C_STARS_PER_EXCESS constant integer := ${RATES.STARS_PER_EXCESS};`));
  assert.match(sql, /least\(greatest\(coalesce\(rebirths, 0\), 0\), C_ASCEND_AT\)/);
  assert.match(sql, /greatest\(coalesce\(stars, 0\), 0\) \+ greatest\(coalesce\(rebirths, 0\) - C_ASCEND_AT, 0\) \/ C_STARS_PER_EXCESS/);
  // one-shot + guard + snapshot first + season-1 rows only
  assert.match(sql, /if exists \(select 1 from private\.season2_convert_run\) then/);
  assert.match(sql, /insert into private\.season2_convert_run/);
  assert.ok(sql.indexOf('insert into private.season2_convert (') < sql.indexOf('update public.profiles p'), 'snapshot before the update');
  assert.match(sql, /where econ is distinct from 13/);
  assert.match(sql, /lock table public\.profiles in share row exclusive mode/);
  // every write to public.profiles sets exactly rebirths + stars
  const sets = [...sql.matchAll(/update public\.profiles[\s\S]*?\n\s+set ([^\n]+)/g)].map((m) => m[1].trim());
  assert.ok(sets.length >= 2);
  for (const s of sets) assert.equal(s, 'rebirths = c.rebirths_after, stars = c.stars_after');
  const code = sql.replace(/--[^\n]*/g, ''); // the statements, without the comments
  for (const bad of [/delete from public\.profiles/i, /truncate/i, /drop table/i, /level\s*=/, /lifetime_words\s*=/, /econ\s*=\s*13,/, /gems/i, /season2_grants/, /updated_at\s*=/]) {
    assert.doesNotMatch(code, bad, `025 must not ${bad}`);
  }
  // the surface: caps, the card's numbers, the seen flag (anon may call them; the tables are private)
  for (const fn of ['lb_season2_conv(text)', 'lb_season2_seen(text)']) {
    assert.ok(sql.includes(`grant execute on function public.${fn} to anon, authenticated;`), fn);
  }
  assert.match(sql, /'season2_convert', exists \(select 1 from private\.season2_convert_run\)/);
  assert.match(sql, /revoke all on table private\.season2_convert from anon, authenticated;/);
  // run order: needs 022 + 024
  assert.match(sql, /025 needs 022_season2_board\.sql and 024_season2_weekly\.sql/);
});

test('the rollback restores rebirths + stars from the snapshot, only on rows 025 left as it wrote them', () => {
  const rb = read('claude', 'rollback-season2-convert.sql');
  assert.match(rb, /set rebirths = c\.rebirths_before, stars = c\.stars_before/);
  assert.match(rb, /p\.rebirths is not distinct from c\.rebirths_after and p\.stars is not distinct from c\.stars_after/);
  assert.match(rb, /delete from private\.season2_convert_run;/);
  assert.doesNotMatch(rb, /delete from public\.profiles/i);
});

test('022 keeps a converted season-1 row: its first season-2 write takes the stored rebirths, not words / 100', () => {
  const s = read('supabase', 'migrations', '022_season2_board.sql');
  assert.match(s, /if old\.submitted_at is null then\n\s+-- FIRST season-2 write of a NEW name/);
  assert.match(s, /elsif old\.econ is distinct from S2_ECON then/);
});

test('THE RESET IS GONE: no 023, no run-season2.sql / rollback, no wipe or gift code', () => {
  for (const f of [
    ['supabase', 'migrations', '023_season2_reset.sql'], ['claude', 'run-season2.sql'], ['claude', 'rollback-season2.sql'],
    ['src', 'progress', 'v3', 'season2Boot.js'], ['src', 'leaderboard', 'season2Rules.js'], ['src', 'components', 'Season2Welcome.jsx'],
  ]) assert.equal(existsSync(join(root, ...f)), false, f.join('/'));
  const client = [read('src', 'progress', 'v3', 'convertLocal.js'), read('src', 'progress', 'v3', 'season2Update.js'), read('src', 'progress', 'v3', 'install.js')].join('\n');
  assert.doesNotMatch(client, /wipeProgressKeys|removeItem\(|\.clear\(\)|grantGems|lb_season2_claim/);
});
