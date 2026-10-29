// 021_server_rebirth.sql's lb_rebirth / lb_ascend, modelled in rebirthRules.js (kept in sync with the SQL).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  decideRebirth, decideAscend, makeRebirthServer, serverGate,
  RATE_PER_SEC, RB_WINDOW_SECS, RB_PER_WINDOW, ASCEND_AT, LOG_KEEP_DAYS,
} from './rebirthRules.js';

const T0 = Date.UTC(2026, 9, 5, 18, 0, 0);
const SEC = 1000;
let n = 0;
const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;

test('the gate comes from the STORED row: season 0 = 25 × (R+1); season 2 v4 = 15 + 18·R (both: level ≥ it)', () => {
  assert.deepEqual([0, 1, 4, 9].map((r) => serverGate(r, 0)), [25, 50, 125, 250]);
  assert.deepEqual([0, 1, 4, 9].map((r) => serverGate(r, 2)), [15, 33, 87, 177]);
  assert.equal(serverGate(3, 1), null);
  for (let r = 0; r < 30; r++) {
    const lv = serverGate(r, 2);
    assert.equal(decideRebirth({ level: lv, rebirths: r, econ: 13 }, { requestId: id(), season: 2 }, [], T0).result.ok, true);
    assert.equal(decideRebirth({ level: lv - 1, rebirths: r, econ: 13 }, { requestId: id(), season: 2 }, [], T0).result.ok, false);
  }
});

test('season 2 (v4, 029): LV ≥ 15 + 18·R → ONE rebirth, level 1; refusal names the level needed', () => {
  const no = decideRebirth({ level: 14, rebirths: 0, econ: 13 }, { requestId: id(), season: 2 }, [], T0);
  assert.deepEqual(no.result, { ok: false, reason: 'gate', gate: 15, level: 14, rebirths: 0 });
  assert.equal(no.row.level, 14);
  const ok = decideRebirth({ level: 40, rebirths: 0, econ: 13 }, { requestId: id(), season: 2 }, [], T0);
  assert.deepEqual(ok.result, { ok: true, rebirths: 1, level: 1 });
  assert.deepEqual([ok.row.rebirths, ok.row.level], [1, 1]);
  const r4 = decideRebirth({ level: 87, rebirths: 4, econ: 13 }, { requestId: id(), season: 2 }, [], T0);
  assert.deepEqual([r4.result.ok, r4.row.rebirths, r4.row.level], [true, 5, 1]);
  // ≤ 12 granted an hour, idempotent by request id, one per call — the same as season 0
  const srv = makeRebirthServer({ level: 99999, rebirths: 0, econ: 13 });
  let granted = 0;
  for (let i = 0; i < 40; i++) {
    srv.db.row.level = 99999; // the player climbs back past the gate between calls
    if (srv.rebirth({ requestId: id(), season: 2 }, T0 + i * 1000).ok) granted += 1;
  }
  assert.equal(granted, RB_PER_WINDOW);
  const rid = id();
  srv.db.row.level = 99999;
  const a = srv.rebirth({ requestId: rid, season: 2 }, T0 + 4000e3);
  const b = srv.rebirth({ requestId: rid, season: 2 }, T0 + 4001e3);
  assert.equal(a.ok, true);
  assert.deepEqual(b, { ...a, replay: true });
  assert.equal(srv.db.row.rebirths, RB_PER_WINDOW + 1);
});

test('gate met → ONE rebirth, level 1; gate not met → refused with the numbers, nothing written', () => {
  const ok = decideRebirth({ level: 25, rebirths: 0 }, { requestId: id() }, [], T0);
  assert.deepEqual(ok.result, { ok: true, rebirths: 1, level: 1 });
  assert.deepEqual([ok.row.rebirths, ok.row.level], [1, 1]);
  assert.equal(ok.entry.action, 'rebirth');
  const no = decideRebirth({ level: 49, rebirths: 1 }, { requestId: id() }, [], T0);
  assert.deepEqual(no.result, { ok: false, reason: 'gate', gate: 50, level: 49, rebirths: 1 });
  assert.deepEqual([no.row.rebirths, no.row.level], [1, 49]);
  assert.ok(no.entry, 'a gate refusal is logged (its id replays the refusal)');
  // the request can't name its own level or count: only the stored row matters
  const forged = decideRebirth({ level: 1, rebirths: 0 }, { requestId: id(), level: 9999, rebirths: 99 }, [], T0);
  assert.equal(forged.result.reason, 'gate');
});

test('IDEMPOTENT: the same request id again returns the stored answer (replay) and changes nothing', () => {
  const srv = makeRebirthServer({ level: 300, rebirths: 2 });
  const rid = id();
  const a = srv.rebirth({ requestId: rid }, T0);
  assert.deepEqual(a, { ok: true, rebirths: 3, level: 1 });
  srv.db.row.level = 9999; // even if the row could rebirth again…
  const b = srv.rebirth({ requestId: rid }, T0 + 60 * SEC);
  assert.deepEqual(b, { ok: true, rebirths: 3, level: 1, replay: true });
  assert.equal(srv.db.row.rebirths, 3, '…the replay changed nothing');
  assert.equal(srv.db.log.length, 1, 'a replay is not logged again');
  // an id is bound to its action
  assert.equal(srv.ascend({ requestId: rid, season: 2 }, T0 + 61 * SEC).reason, 'bad_request');
  // a malformed id is refused, not logged
  assert.equal(srv.rebirth({ requestId: 'nope' }, T0 + 62 * SEC).reason, 'bad_request');
  assert.equal(srv.db.log.length, 1);
});

test('a DOUBLE request (double click: same id twice, or two ids at once) → exactly one rebirth', () => {
  const same = makeRebirthServer({ level: 25, rebirths: 0 });
  const rid = id();
  same.rebirth({ requestId: rid }, T0);
  same.rebirth({ requestId: rid }, T0);
  assert.equal(same.db.row.rebirths, 1);
  const two = makeRebirthServer({ level: 25, rebirths: 0 });
  const r1 = two.rebirth({ requestId: id() }, T0);
  const r2 = two.rebirth({ requestId: id() }, T0 + 10);
  assert.equal(r1.ok, true);
  assert.deepEqual([r2.ok, r2.reason], [false, 'gate'], 'the second sees the stored LV1 and refuses');
  assert.equal(two.db.row.rebirths, 1);
});

test(`RATE: ≤ ${RATE_PER_SEC} logged calls a second per profile; a rate refusal is not logged`, () => {
  const srv = makeRebirthServer({ level: 1, rebirths: 0 });
  const out = [0, 1, 2, 3].map(() => srv.rebirth({ requestId: id() }, T0 + 100));
  assert.deepEqual(out.map((r) => r.reason), ['gate', 'gate', 'rate', 'rate']);
  assert.equal(srv.db.log.length, 2);
  assert.equal(srv.rebirth({ requestId: id() }, T0 + 1101).reason, 'gate', 'a second later the window has moved on');
});

test(`PACE (020 carried over): ≤ ${RB_PER_WINDOW} granted rebirths in any rolling ${RB_WINDOW_SECS / 60} min`, () => {
  // a forged-level row (the submit lets level sit at gate + 50) asks every 10 s: 12 grants, then "wait"
  const srv = makeRebirthServer({ level: 1, rebirths: 0 });
  let t = T0;
  let granted = 0;
  let last;
  for (let i = 0; i < 40; i++) {
    srv.db.row.level = serverGate(srv.db.row.rebirths, 0) + 50;
    last = srv.rebirth({ requestId: id() }, (t += 10 * SEC));
    if (last.ok) granted += 1;
  }
  assert.equal(granted, RB_PER_WINDOW);
  assert.equal(last.reason, 'wait');
  assert.ok(last.retry_in > 0 && last.retry_in <= RB_WINDOW_SECS);
  // once the first grant ages out, one more is allowed
  const first = srv.db.log.find((e) => e.result.ok).created_at;
  srv.db.row.level = 9999;
  assert.equal(srv.rebirth({ requestId: id() }, first + RB_WINDOW_SECS * SEC + 1).ok, true);
});

test('PACE: a tester (033, profiles.is_tester) skips it — the gate still applies', () => {
  const srv = makeRebirthServer({ level: 1, rebirths: 0, is_tester: true });
  let t = T0;
  let granted = 0;
  for (let i = 0; i < 40; i++) {
    srv.db.row.level = serverGate(srv.db.row.rebirths, 0) + 50;
    if (srv.rebirth({ requestId: id() }, (t += 10 * SEC)).ok) granted += 1;
  }
  assert.equal(granted, 40);
  srv.db.row.level = 1;
  assert.equal(srv.rebirth({ requestId: id() }, (t += 10 * SEC)).reason, 'gate');
});

test('033 is the newest lb_rebirth: 029 body + the tester guard on PACE only', () => {
  const dir = join(process.cwd(), 'supabase', 'migrations');
  const s = readFileSync(join(dir, '033_tester_rebirth_pace.sql'), 'utf8').replace(/\r\n/g, '\n');
  assert.ok(s.includes('if granted >= RB_PER_WINDOW and not coalesce(old.is_tester, false) then'));
  assert.ok(s.includes(`RB_PER_WINDOW constant integer := ${RB_PER_WINDOW};`));
  assert.ok(s.includes('grant execute on function public.lb_rebirth(text, uuid, smallint) to anon, authenticated;'));
  assert.ok(s.includes('WRITE-ONLY: Claude never runs migrations'));
});

test('1,000 calls → at most the number of times the gate was legitimately met', () => {
  // a spammer replays, double-fires and hammers; an honest climb meets the gate 3 times over the session
  const srv = makeRebirthServer({ level: 1, rebirths: 0 });
  const ids = [];
  let t = T0;
  let met = 0;
  for (let i = 0; i < 1000; i++) {
    t += 300; // ~3.3 calls a second
    if (i % 250 === 100) {
      srv.db.row.level = serverGate(srv.db.row.rebirths, 0); // the honest climb reaches the gate
      met += 1;
    }
    const replay = i % 3 === 0 && ids.length;
    const rid = replay ? ids[i % ids.length] : id();
    if (!replay) ids.push(rid);
    const before = srv.db.row.rebirths;
    const r = srv.rebirth({ requestId: rid }, t);
    if (srv.db.row.rebirths > before) assert.ok(r.ok && !r.replay, 'only a fresh, granted request moves the row');
  }
  assert.equal(srv.db.row.rebirths, met);
  assert.ok(srv.db.row.rebirths <= met);
});

test('ASCEND is HIDDEN in FINAL v2 (027): season 0 → season; season 2 → off (logged, idempotent) at any R', () => {
  assert.equal(decideAscend({ level: 5, rebirths: 12 }, { requestId: id(), season: 0 }, [], T0).result.reason, 'season');
  for (const rebirths of [0, 9, 10, 40]) {
    const out = decideAscend({ level: 5, rebirths, stars: 0 }, { requestId: id(), season: 2 }, [], T0);
    assert.deepEqual(out.result, { ok: false, reason: 'off' });
    assert.equal(out.row.rebirths, rebirths);
    assert.ok(out.entry, 'an off refusal is logged (its id replays it)');
  }
  const srv = makeRebirthServer({ level: 77, rebirths: 25, stars: 3 });
  const rid = id();
  assert.deepEqual(srv.ascend({ requestId: rid, season: 2 }, T0), { ok: false, reason: 'off' });
  assert.deepEqual(srv.ascend({ requestId: rid, season: 2 }, T0 + 5 * SEC), { ok: false, reason: 'off', replay: true });
  assert.deepEqual([srv.db.row.stars, srv.db.row.rebirths, srv.db.row.level], [3, 25, 77]);
  // rebirth itself refuses an unknown season
  assert.equal(decideRebirth({ level: 999, rebirths: 0 }, { requestId: id(), season: 7 }, [], T0).result.reason, 'season');
});

test('021 SQL mirrors rebirthRules.js: order, constants, idempotency, grants, the no-raise board write', () => {
  // CRLF -> LF: a Windows checkout (core.autocrlf + .gitattributes text=auto) gets CRLF while the blob and CI are LF.
  // The SQL and rebirthRules.js agree; only the line-end anchor (`stars\n` below) read the checkout's endings.
  const sql = readFileSync(join(process.cwd(), 'supabase', 'migrations', '021_server_rebirth.sql'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(sql, /KEEP IN SYNC WITH src\/leaderboard\/rebirthRules\.js/);
  assert.match(sql, /create table if not exists public\.rebirth_requests/);
  assert.match(sql, /primary key \(profile_id, request_id\)/);
  assert.match(sql, /alter table public\.rebirth_requests enable row level security;/);
  assert.match(sql, /revoke all on table public\.rebirth_requests from anon, authenticated;/);
  assert.doesNotMatch(sql, /grant [a-z, ]+ on (table )?public\.rebirth_requests/i);
  assert.match(sql, new RegExp(`RATE_PER_SEC constant integer := ${RATE_PER_SEC};`));
  assert.match(sql, new RegExp(`RB_WINDOW_SECS constant integer := ${RB_WINDOW_SECS};`));
  assert.match(sql, new RegExp(`RB_PER_WINDOW constant integer := ${RB_PER_WINDOW};`));
  assert.match(sql, new RegExp(`ASCEND_AT constant integer := ${ASCEND_AT};`));
  assert.match(sql, new RegExp(`LOG_KEEP_DAYS constant integer := ${LOG_KEEP_DAYS};`));
  assert.match(sql, /when p_season = 0 then 25 \* \(old\.rebirths::numeric \+ 1\)/);
  assert.match(sql, /when p_season = 2 then ceil\(100 \* power\(2\.5::numeric, old\.rebirths::numeric\)\)/);
  assert.match(sql, /for update/);
  assert.match(sql, /return \(prev\.result \|\| jsonb_build_object\('replay', true\)\)::json;/);
  assert.match(sql, /created_at > now\(\) - interval '1 second'/);
  assert.match(sql, /set rebirths = old\.rebirths \+ 1, level = 1, updated_at = now\(\)/);
  assert.match(sql, /set stars = st, rebirths = 0, level = 1/);
  assert.match(sql, /st := coalesce\(old\.stars, 0\) \+ old\.rebirths - \(ASCEND_AT - 1\);/);
  assert.match(sql, /p_season is distinct from 2/);
  // the check ORDER inside lb_rebirth: replay → rate → season/gate → pace → grant
  const body = sql.slice(sql.indexOf('create or replace function public.lb_rebirth'), sql.indexOf('create or replace function public.lb_ascend'));
  const at = (re) => body.search(re);
  const order = [/-- REPLAY/, /-- RATE/, /'reason', 'season'/, /'reason', 'gate'/, /-- PACE/, /-- ONE rebirth/].map(at);
  assert.ok(order.every((x) => x > 0), 'every step present');
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'in the documented order');
  // rb_clock is not touched by lb_rebirth
  assert.doesNotMatch(body, /rb_clock\s*=/);
  // grants like 018: execute to anon/authenticated, revoked from public
  for (const fn of ['lb_rebirth', 'lb_ascend']) {
    assert.match(sql, new RegExp(`revoke all on function public\\.${fn}\\(text, uuid, smallint\\) from public;`));
    assert.match(sql, new RegExp(`grant execute on function public\\.${fn}\\(text, uuid, smallint\\) to anon, authenticated;`));
  }
  assert.match(sql, /'rebirth_rpc', true/);
  // the board write: no raise past stored + conversion, no tokens; 020's first-submit guard and 019's cap carried
  assert.match(sql, /rb := least\(rb::bigint, old\.rebirths::bigint \+ conv\)::integer;/);
  assert.doesNotMatch(sql, /tokens/);
  assert.match(sql, /rb := least\(rb::bigint, play_cap \+ FIRST_CONV_ALLOW\)::integer;/);
  assert.match(sql, /lv_cap := greatest\(25 \* \(rb::bigint \+ 1\) \+ LV_HEADROOM, base_lv \+ max_rise\);/);
  assert.match(sql, /revoke all on function private\.lb_board_write_rr\(text, integer, integer, bigint, bigint, numeric, smallint\) from anon, authenticated;/);
  // the board order is unchanged; stars rides along
  assert.match(sql, /order by rebirths desc, level desc, lifetime_words desc, created_at asc/);
  assert.match(sql, /wins_per_word, econ, stars\n/);
  assert.match(sql, /add column if not exists stars integer not null default 0/);
});

test('074 NO WORDS: a season-2 rebirth needs only the level gate (037 had 10 game words, 035 had 25)', () => {
  const row = { level: 15, rebirths: 0, econ: 13, lifetime_words: 0 };
  let r = decideRebirth(row, { requestId: id(), season: 2 }, [], T0);
  assert.equal(r.result.ok, true, 'zero game words is enough');
  const after = { ...r.row, level: 33, lifetime_words: 0 };
  assert.equal(decideRebirth(after, { requestId: id(), season: 2 }, [], T0).result.ok, true, 'and again right after');
  // season 0 is unchanged; the gate still comes first
  assert.equal(decideRebirth({ level: 25, rebirths: 0, lifetime_words: 0 }, { requestId: id(), season: 0 }, [], T0).result.ok, true);
  assert.equal(decideRebirth({ ...row, level: 14 }, { requestId: id(), season: 2 }, [], T0).result.reason, 'gate');
});

test('074 is the newest lb_rebirth = 042 with WORDS_PER_RB 0 (nothing else changes)', () => {
  const dir = join(process.cwd(), 'supabase', 'migrations');
  const read = (f) => readFileSync(join(dir, f), 'utf8').replace(/\r\n/g, '\n');
  const fn = (t) => { const a = t.indexOf('create or replace function public.lb_rebirth('); return t.slice(a, t.indexOf('end $$;', a)); };
  const b42 = fn(read('042_reconcile_anticheat.sql'));
  const b74 = fn(read('074_rebirth_no_words.sql'));
  assert.equal(b74.replace(/WORDS_PER_RB constant integer := 0;.*\n/, ''), b42.replace(/WORDS_PER_RB constant integer := 10;.*\n/, ''), '074 changes only the constant');
  const last = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort().filter((f) => read(f).includes('create or replace function public.lb_rebirth(')).pop();
  assert.equal(last, '074_rebirth_no_words.sql');
});

test('037 is the newest lb_rebirth = 035 with WORDS_PER_RB 10; gear_check flags but never hides; nothing reverts', () => {
  const dir = join(process.cwd(), 'supabase', 'migrations');
  const body = (f) => { const t = readFileSync(join(dir, f), 'utf8').replace(/\r\n/g, '\n'); const a = t.indexOf('create or replace function public.lb_rebirth('); return t.slice(a, t.indexOf('end $$;', a)); };
  const b35 = body('035_rebirth_words_and_tester_code.sql');
  const b37 = body('037_softer_anticheat.sql');
  assert.ok(b37.includes('WORDS_PER_RB constant integer := 10;'));
  assert.equal(b37.replace(/WORDS_PER_RB constant integer := 10;.*\n/, ''), b35.replace(/WORDS_PER_RB constant integer := 25;.*\n/, ''), '037 changes only the constant');
  const last = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort().filter((f) => readFileSync(join(dir, f), 'utf8').includes('create or replace function public.lb_rebirth(')).pop();
  const s = readFileSync(join(dir, '037_softer_anticheat.sql'), 'utf8');
  const gc = s.slice(s.indexOf('create or replace function private.gear_check('), s.indexOf('end $$;', s.indexOf('create or replace function private.gear_check(')));
  assert.equal(gc.split('return null;').length - 1, 1, 'the only null is a null input — a gear is never hidden');
  assert.ok(gc.trimEnd().endsWith('return p_mark;'), 'an unknown gear is still shown');
  assert.ok(gc.includes("values (p_pid, p_mark, false) on conflict do nothing;"));
  assert.ok(s.includes('update private.gear_refused set revert = false where revert;'));
  assert.ok(s.includes('WRITE-ONLY: Claude never runs migrations'));
});

test('042 reconciles 037 + 039: the newest lb_rebirth is 039 with WORDS_PER_RB 10; the newest gear_check is 037_softer', () => {
  const dir = join(process.cwd(), 'supabase', 'migrations');
  const read = (f) => readFileSync(join(dir, f), 'utf8').replace(/\r\n/g, '\n');
  const fn = (t, name) => { const a = t.indexOf(`create or replace function ${name}(`); return t.slice(a, t.indexOf('end $$;', a)); };
  const b39 = fn(read('039_hard_limits.sql'), 'public.lb_rebirth');
  const b42 = fn(read('042_reconcile_anticheat.sql'), 'public.lb_rebirth');
  assert.ok(b42.includes('WORDS_PER_RB constant integer := 10;') && b42.includes('RB_PER_DAY constant integer := 40;'));
  assert.equal(b42.replace('WORDS_PER_RB constant integer := 10;', ''), b39.replace('WORDS_PER_RB constant integer := 25;', ''), '042 changes only the words constant');
  assert.equal(fn(read('042_reconcile_anticheat.sql'), 'private.gear_check'), fn(read('037_softer_anticheat.sql'), 'private.gear_check'), 'never hide');
  const lastGear = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort().filter((f) => read(f).includes('create or replace function private.gear_check(')).pop();
  assert.equal(lastGear, '042_reconcile_anticheat.sql');
  assert.ok(read('042_reconcile_anticheat.sql').includes('update private.gear_refused set revert = false where revert;'));
});

test('035 is the newest lb_rebirth (033 + the words gate) and adds the tester op code to lb_redeem', () => {
  const dir = join(process.cwd(), 'supabase', 'migrations');
  const s = readFileSync(join(dir, '035_rebirth_words_and_tester_code.sql'), 'utf8').replace(/\r\n/g, '\n');
  assert.ok(s.includes('WORDS_PER_RB constant integer := 25;'));
  assert.ok(s.includes("elsif p_season = 2 and since < WORDS_PER_RB and not coalesce(old.is_tester, false) then"));
  assert.ok(s.includes('rb_words0 = coalesce(old.lifetime_words, 0)'));
  assert.ok(s.includes('if granted >= RB_PER_WINDOW and not coalesce(old.is_tester, false) then'), 'keeps 033');
  assert.ok(s.includes("check (kind in ('wins', 'boost', 'gems', 'overdrive', 'tester'))"));
  assert.ok(s.includes("if r.kind = 'tester' and pid is null then return json_build_object('error', 'need_name'); end if;"));
  assert.ok(s.includes('update public.profiles set is_tester = true where id = pid;'));
  assert.ok(s.includes('WRITE-ONLY: Claude never runs migrations'));
});
