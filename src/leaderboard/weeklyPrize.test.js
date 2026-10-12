// weeklyPrize.test.js — 034_weekly_top10_gems.sql and its JS mirror: the WEEKLY TOP 10 prize table, the snapshot that
// keeps a finished week, the once-per-week payout, and the claim that banks the gems.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { WEEK_PRIZES, weekPrize } from './weekPrizes.js';
import { queuePrizes } from './weeklyPrize.js';
import { listClaims, claim, claimPolicy } from '../progress/claims.js';
import { getGems } from '../progress/gemsCore.js';

const sql = readFileSync(join(process.cwd(), 'supabase', 'migrations', '034_weekly_top10_gems.sql'), 'utf8').replace(/\r\n/g, '\n');
const has = (s) => assert.ok(sql.includes(s), `034 is missing: ${s}`);

function withStorage(fn) {
  const m = new Map();
  const prev = globalThis.localStorage;
  globalThis.localStorage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  try { return fn(m); } finally { globalThis.localStorage = prev; }
}

test('the prize table scales up with the place and matches 034 exactly', () => {
  assert.equal(WEEK_PRIZES.length, 10);
  for (let i = 1; i < WEEK_PRIZES.length; i++) assert.ok(WEEK_PRIZES[i - 1] > WEEK_PRIZES[i], `#${i} pays more than #${i + 1}`);
  has(`WEEK_PRIZES constant integer[] := array[${WEEK_PRIZES.join(', ')}];`);
  assert.equal(weekPrize(1), 1000);
  assert.equal(weekPrize(10), 150);
  assert.equal(weekPrize(11), 0);
  assert.equal(weekPrize(0), 0);
});

test('034 keeps the week being left (snapshot before the baseline moves) and pays once per player per week', () => {
  // the snapshot is written BEFORE the baseline is re-stamped, in the week-rollover branch
  const snap = sql.indexOf('insert into private.s2_week_final');
  const restamp = sql.indexOf("new.s2_week_stars0 := coalesce(old.stars, 0);");
  assert.ok(snap > 0 && restamp > snap, 'snapshot first, then the new baseline');
  has('create trigger lb_s2_week_stamp before update on public.profiles');
  has('primary key (wk, profile_id)');
  has('continue when exists (select 1 from private.s2_week_prizes where wk = w and profile_id = pid);');
  has("FIRST_WEEK constant date := date '2026-10-12';");
  // the same order as the THIS WEEK board (024)
  has('order by week_stars desc, week_rebirths desc, week_levels desc, week_words desc, created_at asc');
  has('revoke all on private.s2_week_prizes from anon, authenticated;');
  has('grant execute on function public.lb_week_prize(text) to anon, authenticated;');
  has('WRITE-ONLY: Claude never runs migrations');
});

test('a prize lands in the INBOX once per week and claiming it banks exactly its gems', () => {
  withStorage(() => {
    assert.equal(claimPolicy('weekprize', 'week:2026-10-12'), 'inbox');
    const before = getGems();
    const p = [{ week: '2026-10-12', rank: 3, gems: 600 }];
    assert.equal(queuePrizes(p), 1);
    assert.equal(queuePrizes(p), 0, 'the same week never queues twice');
    assert.equal(getGems(), before, 'queued, not paid');
    const [c] = listClaims();
    assert.equal(c.label, 'WEEKLY TOP 10 — #3 · 600 GEMS');
    claim(c.id);
    assert.equal(getGems(), before + 600);
    assert.equal(queuePrizes([{ week: 'x', rank: 0, gems: 5 }, null, { week: 'y', rank: 2 }]), 0, 'malformed rows are ignored');
  });
});
