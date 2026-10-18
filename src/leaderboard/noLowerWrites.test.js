// noLowerWrites.test.js — 054 (Andy oct17 second-device reset): the season-2 board write refuses a LOWER write, the
// JS mirror (finalRules.decideSubmitFinal) agrees, a refused lower write is not flagged as a cheat, and a reset zeroes ★.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { decideSubmitFinal, isLowerWrite } from './finalRules.js';

const sql = readFileSync(join(process.cwd(), 'supabase', 'migrations', '054_no_lower_board_writes.sql'), 'utf8').replace(/\r\n/g, '\n');
const T0 = Date.UTC(2026, 9, 17, 20, 0, 0);
const row = (o = {}) => ({ level: 60, rebirths: 4, lifetime_words: 900, lifetime_letters: 5000, submitted_at: T0 - 60_000, econ: 13, ...o });
const sub = (o = {}) => ({ level: 60, rebirths: 4, words: 900, letters: 5000, ...o });

test('a fresh second device (LV 1 R0) cannot overwrite the account row', () => {
  const d = decideSubmitFinal(row(), sub({ level: 1, rebirths: 0, words: 0, letters: 0 }), T0);
  assert.equal(d.action, 'refused');
  assert.equal(d.row, undefined);
});

test('every lower shape is refused; equal or higher still lands', () => {
  for (const s of [{ rebirths: 3, level: 900 }, { level: 59 }, { words: 899 }, { letters: 4999 }]) {
    assert.equal(isLowerWrite(row(), sub(s)), true, JSON.stringify(s));
    assert.equal(decideSubmitFinal(row(), sub(s), T0).action, 'refused');
  }
  const up = decideSubmitFinal(row(), sub({ level: 62, words: 910, letters: 5040 }), T0);
  assert.deepEqual([up.action, up.row.level, up.weekDelta], ['increase', 62, 10]);
  // after a server rebirth the stored row is R+1 LV 1: the client's climb is not "lower"
  assert.equal(decideSubmitFinal(row({ rebirths: 5, level: 1 }), sub({ rebirths: 5, level: 3, words: 905, letters: 5020 }), T0).action, 'increase');
});

test('054 SQL: refuses instead of resetting, keeps 039 limits, no cheat flag for a lower write, reset zeroes stars', () => {
  assert.match(sql, /if is_reset then return; end if;/);
  assert.doesNotMatch(sql, /base_lv/, 'the old reset branch is gone');
  assert.match(sql, /if w - old\.lifetime_words > 4 \* secs then return; end if;/);
  assert.match(sql, /if l - old\.lifetime_letters > 150 \* secs then return; end if;/);
  assert.match(sql, /a LOWER write \(a second device behind the row\) is refused too — that is not a cheat, so no flag/);
  assert.match(sql, /set level = 1, rebirths = 0, stars = 0, lifetime_words = 0/);
  assert.match(sql, /WRITE-ONLY: Claude never runs migrations/);
  assert.match(sql, /notify pgrst, 'reload schema';\s*$/);
  // every function the file replaces keeps its grants
  assert.match(sql, /revoke all on function private\.lb_board_write_s2\(text, integer, integer, bigint, bigint, numeric\) from anon, authenticated;/);
  assert.match(sql, /grant execute on function public\.lb_submit3\(text, integer, integer, bigint, bigint, numeric, integer\) to anon, authenticated;/);
  assert.match(sql, /grant execute on function public\.lb_reset_ack\(text, text, numeric\) to anon, authenticated;/);
});
