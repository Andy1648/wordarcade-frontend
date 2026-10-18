// serverRolls.test.js — 036_server_rolls.sql and its client: the server's pool is the game's pool (every id, tier and
// 1-in-x), its constants are the game's, and a roll given the server's pick lands on it exactly.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROLL_MARKS, SHINY_CHANCE, DUPE_GEMS, freshState } from '../progress/markRollsCore.js';
import { roll, BONUS_ROLL_EVERY, PITY } from '../progress/markRolls.js';
import { ROLL_PRICE } from '../progress/v3/econ.js';

const sql = readFileSync(join(process.cwd(), 'supabase', 'migrations', '036_server_rolls.sql'), 'utf8').replace(/\r\n/g, '\n');
const has = (s) => assert.ok(sql.includes(s), `036 is missing: ${s}`);
// 055_more_legendaries.sql re-seeds the pool (Andy oct18: 5 new gears, same tier odds; 048 / 044 before it): the LATEST pool must be the game's pool
const pool = readFileSync(join(process.cwd(), 'supabase', 'migrations', '055_more_legendaries.sql'), 'utf8').replace(/\r\n/g, '\n');

test('the server pool IS the game pool: every gear, its tier, its 1-in-x, in order (055 re-seeds 036)', () => {
  ROLL_MARKS.forEach((m, i) => assert.ok(pool.includes(`('${m.id}', '${m.tier}', ${m.x}, ${i + 1})`), `055 is missing ${m.id}`));
  const rows = pool.match(/\('mk-[a-z0-9-]+', '[a-z]+', [\d.]+, \d+\)/g) || [];
  assert.equal(rows.length, ROLL_MARKS.length, 'no extra gear on the server');
});

test('the server constants are the game constants (price, shiny, bonus roll, pity, dupe gems)', () => {
  has(`ROLL_PRICE constant integer := ${ROLL_PRICE};`);
  has(`SHINY constant double precision := ${SHINY_CHANCE};`);
  has(`BONUS_EVERY constant integer := ${BONUS_ROLL_EVERY};`);
  has(`EPIC_PITY constant integer := ${PITY.epic.hard}; LEG_PITY constant integer := ${PITY.legendary.hard};`);
  for (const [t, g] of Object.entries(DUPE_GEMS)) has(`when '${t}' then ${g}`);
  has('LUCK_CAP constant double precision := 15;');
  has('WRITE-ONLY: Claude never runs migrations');
});

test('the showcase only keeps server-known gears; the audit grandfathers only old, plausible ones', () => {
  has('g1 := private.gear_check(pid, g1);');
  has("ROLL_CUTOFF constant timestamptz := timestamptz '2026-10-13 00:00:00+00';");
  has('if created < ROLL_CUTOFF and private.gear_plausible(p_pid, p_mark) then');
  has("check (reason in ('rejected', 'clamped', 'gear'))");
});

test('a roll handed the server pick lands on it exactly (mark + shiny), whatever the rng says', () => {
  const origin = ROLL_MARKS.find((m) => m.tier === 'secret');
  const out = roll(() => 0.999, freshState(), { pickId: origin.id, shiny: true });
  assert.equal(out.result.markId, origin.id);
  assert.equal(out.result.shiny, true);
  assert.equal(out.state.marks[origin.id].n, 1);
  assert.equal(out.state.sinceLegendary, 0, 'pity counters move with the landed tier');
  const plain = roll(() => 0.5, freshState(), { pickId: ROLL_MARKS[0].id, shiny: false });
  assert.equal(plain.result.markId, ROLL_MARKS[0].id);
  assert.equal(plain.result.shiny, false);
});

test('037: a showcased gear is never grandfathered after the audit; late grandfathers are undone; the double roll is checked', () => {
  const s37 = readFileSync(join(process.cwd(), 'supabase', 'migrations', '037_gear_grandfather_fix.sql'), 'utf8').replace(/\r\n/g, '\n');
  const check = s37.slice(s37.indexOf('create or replace function private.gear_check'), s37.indexOf('-- ---- 3.'));
  assert.ok(!check.includes("'grandfather'"), 'gear_check must not grandfather any more');
  assert.ok(check.includes('values (p_pid, p_mark, false)'), 'a refusal hides, never reverts');
  assert.ok(s37.includes("delete from private.gear_owned where source = 'grandfather' and first_at > audit_at + interval '5 seconds';"));
  assert.ok(s37.includes("if p.created_at >= ROLL_CUTOFF then\n        n := 1;"));
});
