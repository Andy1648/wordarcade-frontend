// testers.test.js — 032_testers_and_flags.sql: the tester "op code" is a server column (never a code in the bundle),
// testers skip 029's caps, everyone else is FLAGGED (never banned), and lb_submit3 keeps 022's season-1 branch.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(process.cwd(), 'supabase', 'migrations');
const sql = readFileSync(join(DIR, '032_testers_and_flags.sql'), 'utf8').replace(/\r\n/g, '\n');
const has = (text) => assert.ok(sql.includes(text), `032 is missing: ${text}`);

test('the newest lb_submit3 (054, the 032 body without a flag for a refused lower write) keeps the season-1 branch, 029 write + testers', () => {
  const files = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
  const last = files.filter((f) => readFileSync(join(DIR, f), 'utf8').includes('create or replace function public.lb_submit3(')).pop();
  assert.equal(last, '054_no_lower_board_writes.sql');
  const newest = readFileSync(join(DIR, last), 'utf8').replace(/\r\n/g, '\n');
  for (const text of [
    "if p_econ is distinct from 12 then raise exception 'old_client'; end if;",
    'perform private.lb_board_write_rr(',
    'perform private.lb_board_write_s2(p_secret,',
    'if old.is_tester then',
    "perform private.cheat_flag(pid, 'rejected', sent);",
    "perform private.cheat_flag(pid, 'clamped', sent);",
    'grant execute on function public.lb_submit3(text, integer, integer, bigint, bigint, numeric, integer) to anon, authenticated;',
  ]) assert.ok(newest.includes(text), `${last} is missing: ${text}`);
});

test('032 testers: server column, millie seeded, cap-free write is private', () => {
  has('add column if not exists is_tester boolean not null default false');
  has("where lower(username) = lower('millie')");
  has('if old.is_tester then');
  has('revoke all on function private.lb_board_write_tester(uuid, integer, integer, bigint, bigint, numeric) from anon, authenticated;');
});

test('032 flags, never bans: private log + review view, nothing deleted or hidden', () => {
  has('revoke all on private.cheat_flags from anon, authenticated;');
  has('revoke all on private.cheat_review from anon, authenticated;');
  has('where not p.is_tester');
  assert.doesNotMatch(sql, /delete from public\.profiles|is_banned|banned/i);
  has('WRITE-ONLY: Claude never runs migrations');
});
