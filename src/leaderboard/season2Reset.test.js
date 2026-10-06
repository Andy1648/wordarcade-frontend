// season2Reset.test.js — 023_season2_reset.sql (THE SEASON 2 RESET, PROGRESSION v3 phase 4) and its JS mirror
// (season2Rules.js): the grant formula round5(300 + 40 × old rebirths), the one-shot claim, the welcome's rolls line,
// and the SQL text pinned to the same constants. claude/run-season2.sql must be the SAME SQL as the migration.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  season2Gems, roundTo5, rollsLine, decideSeason2Claim, peekSeason2Grant, GRANT_BASE, GRANT_PER_REBIRTH, GRANT_ROUND,
  SEASON2_ECON, ROLL_PRICE, EPIC_GUARANTEE_ROLLS, INT_MAX,
} from './season2Rules.js';
import { ROLL_PRICE as V3_ROLL_PRICE } from '../progress/v3/econ.js';

const read = (...p) => readFileSync(join(process.cwd(), ...p), 'utf8').replace(/\r\n/g, '\n');
const sql = () => read('supabase', 'migrations', '023_season2_reset.sql');
const T0 = Date.UTC(2026, 9, 6, 12, 0, 0);
const UUID = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

test('the grant: R0 → 300, R1 → 340, R100 → 4,300 (round5(300 + 40 × old rebirths))', () => {
  assert.equal(season2Gems(0), 300);
  assert.equal(season2Gems(1), 340);
  assert.equal(season2Gems(100), 4300);
  assert.deepEqual([2, 5, 10, 37].map(season2Gems), [380, 500, 700, 1780]);
  // bad / negative / fractional input reads as whole non-negative rebirths
  assert.equal(season2Gems(-4), 300);
  assert.equal(season2Gems(null), 300);
  assert.equal(season2Gems('7'), 580);
  assert.equal(season2Gems(2.9), 380);
  // int-clamped like the column
  assert.equal(season2Gems(1e12), INT_MAX);
});

test('round5: the NEAREST multiple of 5, half up', () => {
  assert.deepEqual([0, 1, 2, 2.5, 3, 7, 7.49, 7.5, 12, 13, 302, 303, 4300].map(roundTo5), [0, 0, 0, 5, 5, 5, 5, 10, 10, 15, 300, 305, 4300]);
  for (let r = 0; r <= 500; r += 1) assert.equal(season2Gems(r) % 5, 0, `R${r} is a multiple of 5`);
});

test('the welcome rolls line: gems ÷ 75, "EPIC+ GUARANTEED" from 50 rolls', () => {
  assert.equal(ROLL_PRICE, V3_ROLL_PRICE, 'the v3 roll price');
  assert.equal(rollsLine(300), '4 ROLLS');
  assert.equal(rollsLine(75), '1 ROLL');
  assert.equal(rollsLine(4300), '57 ROLLS · EPIC+ GUARANTEED');
  assert.equal(rollsLine(50 * 75 - 1), '49 ROLLS');
  assert.equal(rollsLine(EPIC_GUARANTEE_ROLLS * 75), '50 ROLLS · EPIC+ GUARANTEED');
});

test('claim twice → once: the first claim pays, any later claim is "claimed" (gems echoed, nothing granted)', () => {
  let g = { gems: 340, rebirths: 1, claimed_at: null, claim_request: null };
  const a = decideSeason2Claim(g, UUID(1), T0);
  assert.deepEqual(a.result, { ok: true, gems: 340, rebirths: 1 });
  g = a.grant;
  assert.equal(g.claimed_at, T0);
  const b = decideSeason2Claim(g, UUID(2), T0 + 1000);
  assert.deepEqual(b.result, { ok: false, reason: 'claimed', gems: 340 });
  assert.equal(b.grant, g, 'a refused claim changes nothing');
  // the SAME request again (its answer was lost) replays — it is the same claim, never a second grant
  const c = decideSeason2Claim(g, UUID(1), T0 + 2000);
  assert.deepEqual(c.result, { ok: true, gems: 340, rebirths: 1, replay: true });
  assert.equal(c.grant.claimed_at, T0);
  // no id / no grant row
  assert.equal(decideSeason2Claim(g, null).result.reason, 'bad_request');
  assert.deepEqual(decideSeason2Claim(null, UUID(3)).result, { ok: false, reason: 'no_grant', gems: 0 });
  assert.deepEqual(peekSeason2Grant(g), { found: true, gems: 340, rebirths: 1, claimed: true });
  assert.deepEqual(peekSeason2Grant(null), { found: false, gems: 0, rebirths: 0, claimed: false });
});

test('the SQL mirrors the constants (023)', () => {
  const s = sql();
  assert.match(s, new RegExp(`GRANT_BASE constant integer := ${GRANT_BASE};`));
  assert.match(s, new RegExp(`GRANT_PER_REBIRTH constant integer := ${GRANT_PER_REBIRTH};`));
  assert.match(s, new RegExp(`GRANT_ROUND constant integer := ${GRANT_ROUND};`));
  assert.match(s, /\(GRANT_ROUND \* round\(raw::numeric \/ GRANT_ROUND\)\)/, 'round5 = 5 × round(x / 5)');
  assert.match(s, new RegExp(`least\\(${INT_MAX},`));
  assert.match(s, new RegExp(`econ = ${SEASON2_ECON}, updated_at = now\\(\\)`));
  // the claim: replay → claimed → claim, as decideSeason2Claim
  const claim = s.slice(s.indexOf('create or replace function public.lb_season2_claim'));
  const iReplay = claim.indexOf("'replay', true");
  const iClaimed = claim.indexOf("'reason', 'claimed'");
  const iSet = claim.indexOf('set claimed_at = now()');
  assert.ok(iReplay > 0 && iReplay < iClaimed && iClaimed < iSet, 'replay → claimed → claim');
  assert.match(claim, /'reason', 'no_grant'/);
  assert.match(s, /revoke all on function public\.lb_season2_claim\(text, uuid\) from public;/);
  assert.match(s, /grant execute on function public\.lb_season2_claim\(text, uuid\) to anon, authenticated;/);
});

test('the SQL: one-shot guard, snapshot before reset, every column, lb_caps keeps 022 keys + season2_reset', () => {
  const s = sql();
  const body = s.slice(s.indexOf('-- ---- THE RESET'), s.indexOf('-- ---- lb_season2_grant'));
  assert.match(body, /select ran_at into ran from public\.season2_reset where id = 1;\n {2}if found then/);
  const iSnap = body.indexOf('insert into public.season1_snapshot');
  const iGrant = body.indexOf('insert into public.season2_grants');
  const iReset = body.indexOf('update public.profiles');
  const iMark = body.indexOf('insert into public.season2_reset');
  assert.ok(iSnap > 0 && iSnap < iGrant && iGrant < iReset && iReset < iMark, 'snapshot → grants → reset → marker');
  for (const col of ['level = 1', 'rebirths = 0', 'stars = 0', 'lifetime_words = 0', 'lifetime_letters = 0', 'wins_per_word = 0',
    'week_words = 0', 'week_key = null', 'rb_clock = null', 'submitted_at = null', 'reset_all = false', 'econ = 13']) {
    assert.ok(body.includes(col), `the reset writes ${col}`);
  }
  assert.ok(!/username\s*=/.test(body.slice(iReset, iMark)), 'never the username');
  assert.match(body, /delete from public\.rebirth_requests;/);
  assert.match(body, /delete from private\.cloud_saves;/);
  assert.ok(body.indexOf('insert into private.season1_cloud_saves') < body.indexOf('delete from private.cloud_saves'));
  // lb_caps: every key 022 had, + season2_reset
  const caps = s.slice(s.indexOf('create or replace function public.lb_caps()'));
  for (const k of ["'letters', true", "'cjk', true", "'cloud', true", "'weekly', true", "'board_econ', true", "'econ', 12",
    "'rebirth_rpc', true", "'season2', true", "'econ2', 13", "'season2_reset', exists (select 1 from public.season2_reset)"]) {
    assert.ok(caps.includes(k), `lb_caps keeps ${k}`);
  }
  const prev = read('supabase', 'migrations', '022_season2_board.sql');
  const prevCaps = prev.slice(prev.indexOf('create or replace function public.lb_caps()')).match(/'([a-z0-9_]+)'/g);
  for (const k of prevCaps) assert.ok(caps.includes(k), `022 key ${k} kept`);
});

test('claude/run-season2.sql is the same SQL as 023; the rollback restores from the snapshot', () => {
  assert.equal(read('claude', 'run-season2.sql'), sql());
  const rb = read('claude', 'rollback-season2.sql');
  assert.match(rb, /from public\.season1_snapshot s/);
  assert.match(rb, /from private\.season1_cloud_saves/);
  assert.match(rb, /delete from public\.season2_reset;/);
});
