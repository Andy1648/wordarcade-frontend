// hardLimits.test.js — 039: words ≤ 4/s on the season-2 board write, ≤ 40 rebirths a day; JS mirrors match the SQL.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { WORDS_PER_SEC } from './finalRules.js';
import { RB_PER_DAY, decideRebirth } from './rebirthRules.js';
import { rebirthRefusalText } from './rebirthFlow.js';

const sql = readFileSync(join(process.cwd(), 'supabase', 'migrations', '039_hard_limits.sql'), 'utf8').replace(/\r\n/g, '\n');

test('039 SQL = the JS mirrors', () => {
  assert.equal(WORDS_PER_SEC, 4);
  assert.equal((sql.match(/4 \* secs/g) || []).length, 2);
  assert.ok(!sql.includes('20 * secs'));
  assert.ok(sql.includes(`RB_PER_DAY constant integer := ${RB_PER_DAY};`));
  assert.ok(sql.includes('WRITE-ONLY: Claude never runs migrations'));
});

test('the 41st rebirth in a day waits (testers skip); the refusal says hours', () => {
  const now = 10 * 24 * 3600 * 1000;
  const log = Array.from({ length: RB_PER_DAY }, (_, i) => ({ request_id: `00000000-0000-4000-8000-1${String(i).padStart(11, '0')}`, action: 'rebirth', result: { ok: true }, created_at: now - 2 * 3600 * 1000 - i * 60000 }));
  const row = { level: 5000, rebirths: 50, econ: 13 };
  const r = decideRebirth(row, { requestId: '00000000-0000-4000-8000-000000000001', season: 2 }, log, now);
  assert.equal(r.result.reason, 'wait');
  assert.ok(r.result.retry_in > 20 * 3600);
  assert.match(rebirthRefusalText(r.result), /^DAILY LIMIT — NEXT REBIRTH IN \d+H \d\dM$/);
  assert.equal(decideRebirth({ ...row, is_tester: true }, { requestId: '00000000-0000-4000-8000-000000000002', season: 2 }, log, now).result.ok, true);
});
