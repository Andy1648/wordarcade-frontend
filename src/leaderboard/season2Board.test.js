// season2Board.test.js — 022_season2_board.sql and its JS mirror (PROGRESSION v3, phase 3): the season-2 board write
// (decideSubmitS2), the econ-13 guard on lb_rebirth / lb_ascend (decideRebirth / decideAscend), the ★ → R → level
// board order, and the client's ascension flow (rebirthFlow.performAscend).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  decideSubmitS2, s2LevelRoom, S2_ECON, S2_LV_GATE_MULT, S2_LEVELS_PER_SEC, S2_LEVEL_BANK_SECS, S2_WORDS_PER_RB, S2_LV_MAX,
  S2_GATE_EXP_CAP, THROTTLE_MS,
} from './submitRules.js';
import { decideRebirth, decideAscend, makeRebirthServer, serverGate, SEASON2_ECON } from './rebirthRules.js';
import { makeRebirthFlow } from './rebirthFlow.js';

const T0 = Date.UTC(2026, 9, 5, 20, 0, 0);
const UUID = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const row = (o = {}) => ({ level: 1, rebirths: 0, lifetime_words: 0, lifetime_letters: 0, submitted_at: T0 - 60_000, econ: 13, ...o });
const sub = (o = {}) => ({ level: 1, rebirths: 0, words: 0, letters: 0, ...o });
const sql = () => readFileSync(join(process.cwd(), 'supabase', 'migrations', '022_season2_board.sql'), 'utf8').replace(/\r\n/g, '\n');

test('season-2 constants: econ 13; level room = 4 × ⌈100 × 2.5^R⌉ (capped at the int column)', () => {
  assert.equal(S2_ECON, 13);
  assert.equal(SEASON2_ECON, 13);
  assert.deepEqual([0, 1, 5, 9, 10].map(s2LevelRoom), [400, 1000, 39064, 1525880, 3814700]);
  assert.equal(s2LevelRoom(10), 4 * Math.ceil(100 * 2.5 ** 10)); // 022's v3 room (026 re-sizes it — finalRules.test.js)
  assert.equal(serverGate(10, 2), 195, 'season 2 is v4 now (029): 15 + 18·R');
  assert.equal(s2LevelRoom(500), S2_LV_MAX);
});

test('FIRST season-2 write (new name or a season-1 row switching): a baseline bounded by play', () => {
  const fresh = decideSubmitS2({ ...row(), submitted_at: null }, sub({ level: 50, rebirths: 0, words: 30 }), T0);
  assert.equal(fresh.action, 'first');
  assert.deepEqual([fresh.row.level, fresh.row.rebirths, fresh.row.econ, fresh.weekDelta], [50, 0, 13, 0]);
  // a forged R40 with 250 words → R2 (250 / 100), level ≤ 4 × gate(2)
  const forged = decideSubmitS2({ ...row(), submitted_at: null }, sub({ level: 9e8, rebirths: 40, words: 250 }), T0);
  assert.deepEqual([forged.row.rebirths, forged.row.level], [2, s2LevelRoom(2)]);
  // a season-1 row (econ 12, R30 LV60) switching: the season-2 numbers land (R0), econ 13
  const sw = decideSubmitS2(row({ econ: 12, rebirths: 30, level: 60, lifetime_words: 9000 }), sub({ level: 120, rebirths: 0, words: 9000 }), T0);
  assert.deepEqual([sw.action, sw.row.rebirths, sw.row.level, sw.row.econ], ['first', 0, 120, 13]);
  assert.equal('stars' in sw.row, false, 'a submit never writes stars');
});

test('a submit never raises rebirths (lb_rebirth only); the level is free up to 4 × the gate or 500/s', () => {
  const r = row({ level: 100, rebirths: 2, lifetime_words: 500, submitted_at: T0 - 10_000 });
  const up = decideSubmitS2(r, sub({ level: 2000, rebirths: 3, words: 520 }), T0);
  assert.equal(up.action, 'increase');
  assert.equal(up.row.rebirths, 2);
  assert.equal(up.row.level, 2000, 'R2 room = 4 × 625 = 2,500');
  // past the room: stored + 500 a second (10 s → 5,000)
  const fast = decideSubmitS2(r, sub({ level: 999999, rebirths: 2, words: 520 }), T0);
  assert.equal(fast.row.level, 100 + 10 * S2_LEVELS_PER_SEC);
  // banking stops at 20 min
  const late = decideSubmitS2({ ...r, submitted_at: T0 - 3600_000 }, sub({ level: 9e8, rebirths: 2, words: 520 }), T0);
  assert.equal(late.row.level, 100 + S2_LEVEL_BANK_SECS * S2_LEVELS_PER_SEC);
  // a 10 h FAST bot at R10 ~3.2M levels: inside the room (3.81M) — never clipped
  const fastBot = decideSubmitS2(row({ level: 3_100_000, rebirths: 10, lifetime_words: 15000, submitted_at: T0 - 30_000 }), sub({ level: 3_200_000, rebirths: 10, words: 15100 }), T0);
  assert.equal(fastBot.row.level, 3_200_000);
});

test('throttle, rate checks and RESET as 017 / 021', () => {
  assert.equal(decideSubmitS2(row({ submitted_at: T0 - 1000 }), sub(), T0).action, 'throttled');
  const r = row({ level: 50, rebirths: 1, lifetime_words: 500, lifetime_letters: 3000, submitted_at: T0 - 10_000 });
  assert.equal(decideSubmitS2(r, sub({ level: 60, rebirths: 1, words: 500 + 201, letters: 3000 }), T0).action, 'rejected');
  assert.equal(decideSubmitS2(r, sub({ level: 60, rebirths: 1, words: 500, letters: 3000 + 1501 }), T0).action, 'rejected');
  const reset = decideSubmitS2(r, sub({ level: 1, rebirths: 0, words: 500, letters: 3000 }), T0);
  assert.deepEqual([reset.action, reset.row.rebirths, reset.row.level], ['reset', 0, 1]);
  assert.equal(THROTTLE_MS, 5000);
});

test('econ-13 guard: a season-2 rebirth / ascension needs a season-2 row', () => {
  const s1 = { level: 900, rebirths: 12, stars: 0, econ: 12 };
  assert.equal(decideRebirth(s1, { requestId: UUID(1), season: 2 }, [], T0).result.reason, 'season');
  assert.equal(decideAscend(s1, { requestId: UUID(2), season: 2 }, [], T0).result.reason, 'season');
  const s2 = { ...s1, econ: 13 };
  assert.equal(decideAscend(s2, { requestId: UUID(3), season: 2 }, [], T0).result.reason, 'off'); // FINAL v2 (027): ascension hidden
  assert.equal(decideRebirth({ ...s2, level: 100, rebirths: 0 }, { requestId: UUID(4), season: 2 }, [], T0).result.ok, true);
  // 021 callers that carry no econ are unchanged; season 0 never needs it
  assert.equal(decideRebirth({ level: 100, rebirths: 0 }, { requestId: UUID(5), season: 2 }, [], T0).result.ok, true);
  assert.equal(decideRebirth({ level: 25, rebirths: 0, econ: 12 }, { requestId: UUID(6), season: 0 }, [], T0).result.ok, true);
});

test('022 SQL mirrors decideSubmitS2 + the econ-13 guard; board ★ → R → level; lb_caps season2', () => {
  const s = sql();
  assert.match(s, /KEEP IN SYNC WITH src\/leaderboard\/submitRules\.js \(decideSubmitS2\)/);
  assert.match(s, new RegExp(`S2_ECON constant smallint := ${S2_ECON};`));
  assert.match(s, new RegExp(`S2_LV_GATE_MULT constant integer := ${S2_LV_GATE_MULT};`));
  assert.match(s, new RegExp(`S2_LEVELS_PER_SEC constant integer := ${S2_LEVELS_PER_SEC};`));
  assert.match(s, new RegExp(`S2_LEVEL_BANK_SECS constant integer := ${S2_LEVEL_BANK_SECS};`));
  assert.match(s, new RegExp(`S2_WORDS_PER_RB constant integer := ${S2_WORDS_PER_RB};`));
  assert.match(s, new RegExp(`S2_LV_MAX constant bigint := ${S2_LV_MAX};`));
  assert.match(s, new RegExp(`S2_GATE_EXP_CAP constant integer := ${S2_GATE_EXP_CAP};`));
  assert.match(s, /if old\.submitted_at is null or old\.econ is distinct from S2_ECON then/);
  assert.match(s, /rb := least\(rb, floor\(w \/ S2_WORDS_PER_RB\)::bigint\);/);
  assert.match(s, /rb := least\(rb, old\.rebirths::bigint\); -- a submit never raises rebirths/);
  assert.match(s, /S2_LV_GATE_MULT \* ceil\(100 \* power\(2\.5::numeric, least\(rb, S2_GATE_EXP_CAP\)::numeric\)\)::bigint/);
  assert.match(s, /floor\(least\(secs, S2_LEVEL_BANK_SECS\) \* S2_LEVELS_PER_SEC\)::bigint/);
  assert.match(s, /interval '5 seconds'/);
  assert.match(s, /20 \* secs/);
  assert.match(s, /150 \* secs/);
  // the season-2 write never touches stars
  const write = s.slice(s.indexOf('create or replace function private.lb_board_write_s2'), s.indexOf('create or replace function public.lb_submit3'));
  assert.doesNotMatch(write, /stars\s*=/);
  assert.match(write, /econ = S2_ECON/);
  // lb_submit3 routes 13 → s2, keeps 12 → rr, and refuses a season-1 client on a season-2 row
  const submit = s.slice(s.indexOf('create or replace function public.lb_submit3'), s.indexOf('create or replace function public.lb_rebirth'));
  assert.match(submit, /if p_econ = 13 then\n\s+perform private\.lb_board_write_s2/);
  assert.match(submit, /if p_econ is distinct from 12 then raise exception 'old_client'; end if;/);
  assert.match(submit, /if cur = 13 then raise exception 'old_client'; end if;/);
  assert.match(submit, /perform private\.lb_board_write_rr\(/);
  // lb_rebirth / lb_ascend: 021's bodies + the econ-13 guard, same grants
  assert.match(s, /when p_season = 2 and old\.econ = S2_ECON then ceil\(100 \* power\(2\.5::numeric, old\.rebirths::numeric\)\)/);
  assert.match(s, /if p_season is distinct from 2 or old\.econ is distinct from S2_ECON then/);
  assert.match(s, /st := coalesce\(old\.stars, 0\) \+ old\.rebirths - \(ASCEND_AT - 1\);/);
  for (const fn of ['lb_rebirth', 'lb_ascend']) {
    assert.match(s, new RegExp(`revoke all on function public\\.${fn}\\(text, uuid, smallint\\) from public;`));
    assert.match(s, new RegExp(`grant execute on function public\\.${fn}\\(text, uuid, smallint\\) to anon, authenticated;`));
  }
  assert.match(s, /revoke all on function private\.lb_board_write_s2\(text, integer, integer, bigint, bigint, numeric\) from anon, authenticated;/);
  // the board: ★ → R → level, season-2 rows only; public.leaderboard untouched
  assert.match(s, /order by stars desc, rebirths desc, level desc, lifetime_words desc, created_at asc/);
  assert.match(s, /where econ = 13;/);
  assert.doesNotMatch(s, /create view public\.leaderboard with/);
  assert.match(s, /'rebirth_rpc', true, 'season2', true, 'econ2', 13/);
  assert.match(s, /'econ', 12/);
});

test('performAscend: the server refuses (ascension hidden, 027) → nothing applied; single flight; local fallback is the injected gate', async () => {
  const store = new Map();
  const st = { level: 1, rebirths: 10, stars: 0 };
  const srv = makeRebirthServer({ level: 1, rebirths: 10, stars: 0, econ: 13 });
  let k = 0;
  const mk = (server) => makeRebirthFlow({
    serverEnabled: async () => server,
    pushStats: async () => true,
    call: async (fn, body) => (fn === 'lb_ascend' ? srv.ascend({ requestId: body.p_request_id, season: body.p_season }, T0 + k * 2000) : srv.rebirth({ requestId: body.p_request_id, season: body.p_season }, T0)),
    secret: () => 's'.repeat(48),
    storage: { get: (x) => (store.has(x) ? store.get(x) : null), set: (x, v) => store.set(x, v), remove: (x) => store.delete(x) },
    localRebirths: () => st.rebirths,
    localReady: () => false,
    applyLocal: () => ({ rc: st.rebirths, stars: 0 }),
    newId: () => UUID(++k),
    season: () => 2,
    localAscendReady: () => st.rebirths >= 10,
    applyAscend: (target) => {
      const before = st.stars;
      st.stars = Number.isFinite(target) ? target : st.stars + st.rebirths - 9;
      st.rebirths = 0;
      return { ok: true, stars: st.stars, added: st.stars - before };
    },
  });
  const f = mk(true);
  const [a, b] = await Promise.all([f.performAscend(), f.performAscend()]);
  assert.deepEqual([a.ok, a.reason], [false, 'off']);
  assert.deepEqual([b.ok, b.reason], [false, 'pending'], 'single flight');
  assert.deepEqual([st.stars, st.rebirths, srv.db.row.stars, srv.db.row.rebirths], [0, 10, 0, 10], 'a refusal applies nothing');
  // local mode (no profile / 022 not live)
  st.rebirths = 12;
  const loc = await mk(false).performAscend();
  assert.deepEqual([loc.ok, loc.mode, loc.added], [true, 'local', 3]);
});

test('serverRebirth.js keeps ASCEND_AT as a literal equal to v3/econ.js (an import would drag ~19 KB eager)', async () => {
  const src = readFileSync(join(process.cwd(), 'src', 'leaderboard', 'serverRebirth.js'), 'utf8');
  const m = src.match(/const ASCEND_AT = (\d+);/);
  const { ASCEND_AT } = await import('../progress/v3/econ.js');
  assert.ok(m, 'literal present');
  assert.equal(Number(m[1]), ASCEND_AT);
  assert.doesNotMatch(src, /from '\.\.\/progress\/v3\//);
});
