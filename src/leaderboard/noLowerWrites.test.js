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
  for (const s of [{ rebirths: 3, level: 900 }, { level: 59 }]) {
    assert.equal(isLowerWrite(row(), sub(s)), true, JSON.stringify(s));
    assert.equal(decideSubmitFinal(row(), sub(s), T0).action, 'refused');
  }
  // 057: fewer words / letters are MERGED (the row keeps its higher count), never a refusal of the whole write
  for (const s of [{ words: 899 }, { letters: 4999 }]) {
    assert.equal(isLowerWrite(row(), sub(s)), false, JSON.stringify(s));
    const d = decideSubmitFinal(row(), sub({ ...s, level: 61 }), T0);
    assert.deepEqual([d.action, d.row.level, d.row.lifetime_words, d.row.lifetime_letters, d.weekDelta], ['increase', 61, 900, 5000, 0]);
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

// B3 (oct21 audit): the rebirth DEADLOCK. A server rebirth leaves the row at R+1 LV 1; a device restored from an older
// copy (behind on words) used to have every push refused, so the row's level stayed 1 and lb_rebirth's gate was never met.
test('057: a device behind on words can still raise the row level after a rebirth (no deadlock)', () => {
  const afterRebirth = row({ rebirths: 5, level: 1, lifetime_words: 2000, lifetime_letters: 9000 });
  const d = decideSubmitFinal(afterRebirth, sub({ rebirths: 5, level: 40, words: 1500, letters: 7000 }), T0);
  assert.equal(d.action, 'increase');
  assert.equal(d.row.level, 40, 'the level lands, so the rebirth gate can be met');
  assert.equal(d.row.lifetime_words, 2000, 'the row never loses words');
  assert.equal(d.row.lifetime_letters, 9000);
});

const sql057 = readFileSync(join(process.cwd(), 'supabase', 'migrations', '057_board_merge_counters.sql'), 'utf8').replace(/\r\n/g, '\n');
test('057 SQL: only rebirths / same-R level down are refused; words + letters merge; grants kept', () => {
  assert.match(sql057, /is_reset := rb < old\.rebirths or \(lv < old\.level and rb = old\.rebirths\);/);
  assert.match(sql057, /w := greatest\(w, coalesce\(old\.lifetime_words, 0\)\);/);
  assert.match(sql057, /l := greatest\(l, coalesce\(old\.lifetime_letters, 0\)\);/);
  assert.match(sql057, /rb := least\(rb, old\.rebirths::bigint\);/, 'a submit still never raises rebirths');
  assert.match(sql057, /revoke all on function private\.lb_board_write_s2\(text, integer, integer, bigint, bigint, numeric\) from anon, authenticated;/);
  assert.match(sql057, /notify pgrst, 'reload schema';\s*$/);
});
