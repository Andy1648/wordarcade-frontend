// tickerCheck.test.js — 038 pins: every tick kind is checked against the server's own rows.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const sql = readFileSync(join(process.cwd(), 'supabase', 'migrations', '038_ticker_check.sql'), 'utf8').replace(/\r\n/g, '\n');

test('038 checks roll (claimed server roll), lv, rb and rank; anyone may ask', () => {
  for (const s of ["if p_k = 'roll' then", "l.state = 'claimed'", "elsif p_k = 'lv' then", "elsif p_k = 'rb' then", "elsif p_k = 'rank' then",
    'grant execute on function public.lb_tick_ok(text, text, integer) to anon, authenticated;', 'WRITE-ONLY: Claude never runs migrations']) {
    assert.ok(sql.includes(s), `038 is missing: ${s}`);
  }
});

test('038: the server luck cap sits just above the most a legit save reaches (×9.2)', () => {
  assert.ok(sql.includes('LUCK_CAP constant double precision := 10;'));
});
