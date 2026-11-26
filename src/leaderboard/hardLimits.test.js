// hardLimits.test.js — 039: words ≤ 4/s on the season-2 board write, ≤ 40 rebirths a day; JS mirrors match the SQL.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { WORDS_PER_SEC } from './finalRules.js';
import { RB_PER_DAY, decideRebirth } from './rebirthRules.js';
import { rebirthRefusalText } from './rebirthFlow.js';

const sql = readFileSync(join(process.cwd(), 'supabase', 'migrations', '039_hard_limits.sql'), 'utf8').replace(/\r\n/g, '\n');
const sql94 = readFileSync(join(process.cwd(), 'supabase', 'migrations', '094_rebirth_pace_20.sql'), 'utf8').replace(/\r\n/g, '\n');
const sql74 = readFileSync(join(process.cwd(), 'supabase', 'migrations', '074_rebirth_no_words.sql'), 'utf8').replace(/\r\n/g, '\n');

test('039 SQL = the JS mirrors', () => {
  assert.equal(WORDS_PER_SEC, 4);
  assert.equal((sql.match(/4 \* secs/g) || []).length, 2);
  assert.ok(!sql.includes('20 * secs'));
  assert.ok(sql.includes('RB_PER_DAY constant integer := 40;'), '039 as it was');
  assert.ok(sql94.includes(`RB_PER_DAY constant integer := ${RB_PER_DAY};`), 'the newest lb_rebirth (094) = the JS mirror');
  assert.ok(sql.includes('WRITE-ONLY: Claude never runs migrations'));
});

test('the 21st rebirth in a day waits (testers skip); the refusal says hours', () => {
  const now = 10 * 24 * 3600 * 1000;
  const log = Array.from({ length: RB_PER_DAY }, (_, i) => ({ request_id: `00000000-0000-4000-8000-1${String(i).padStart(11, '0')}`, action: 'rebirth', result: { ok: true }, created_at: now - 2 * 3600 * 1000 - i * 60000 }));
  const row = { level: 5000, rebirths: 50, econ: 13 };
  const r = decideRebirth(row, { requestId: '00000000-0000-4000-8000-000000000001', season: 2 }, log, now);
  assert.equal(r.result.reason, 'wait');
  assert.ok(r.result.retry_in > 20 * 3600);
  assert.match(rebirthRefusalText(r.result), /^DAILY LIMIT — NEXT REBIRTH IN \d+H \d\dM$/);
  assert.equal(decideRebirth({ ...row, is_tester: true }, { requestId: '00000000-0000-4000-8000-000000000002', season: 2 }, log, now).result.ok, true);
});

test('094 = 074 lb_rebirth with RB_PER_DAY 20 + catch-ups counted; it is the newest lb_rebirth', () => {
  const fn = (t) => { const a = t.indexOf('create or replace function public.lb_rebirth('); return t.slice(a, t.indexOf('end $$;', a)); };
  const b74 = fn(sql74);
  const b94 = fn(sql94);
  const start = b94.indexOf('    -- 094: rebirths a board write');
  const tail = "     where a.profile_id = pid and a.kind = 'rb_catchup' and a.created_at > now() - interval '24 hours';\n";
  assert.ok(start > 0 && b94.includes(tail));
  const strip = (b94.slice(0, start) + b94.slice(b94.indexOf(tail) + tail.length))
    .replace('RB_PER_DAY constant integer := 20;        -- 094 (Andy nov26): granted rebirths + board catch-ups in any rolling 24 h (039 had 40)',
             'RB_PER_DAY constant integer := 40;        -- 039: granted rebirths allowed in any rolling 24 h')
    .replace('-- 094: ≤ 20 a day incl. catch-ups (testers skip)', '-- 039: ≤ 40 a day (testers skip)');
  assert.equal(strip, b74, '094 changes only the day limit and adds the catch-up count');
  const dir = join(process.cwd(), 'supabase', 'migrations');
  const last = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
    .filter((f) => readFileSync(join(dir, f), 'utf8').includes('create or replace function public.lb_rebirth(')).pop();
  assert.equal(last, '094_rebirth_pace_20.sql');
  assert.ok(sql94.includes('WRITE-ONLY: Claude never runs migrations'));
});
