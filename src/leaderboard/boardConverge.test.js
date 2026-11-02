// boardConverge.test.js — daan (oct27): "his leaderboard doesn't reflect his actual rebirths". The board row's rebirths
// could only move through lb_rebirth (+1), so any save AHEAD of its row stayed ahead forever: a new name claimed on an
// R26+ save was clamped to R2 (words / 100) and every later server rebirth moved row and save up together. Pinned here:
//   * 070 (finalRules.decideSubmitFinal { converge }): the row RISES to the save's count (≤ words / 10), never lowers;
//   * the client never makes the gap in the first place: a named player whose caps probe fails is refused OFFLINE (no
//     local rebirth), and an lb_rebirth that ANSWERS with a 4xx clears the pending id instead of blocking pushes forever;
//   * the SQL files: 070 / 071 / 072 say what they do, keep grants, and 072 only ever raises.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { decideSubmitFinal, F_RB_WORDS } from './finalRules.js';
import { makeRebirthFlow, isServerRefusal, PENDING_REBIRTH_KEY } from './rebirthFlow.js';

const T0 = Date.UTC(2026, 9, 27, 18, 0, 0);
const read = (...p) => readFileSync(join(process.cwd(), ...p), 'utf8').replace(/\r\n/g, '\n');

test('070: a NEW name on a real save lands on words / 10, not words / 100 (dan: R2 at LV 514)', () => {
  const first = { level: 1, rebirths: 0, lifetime_words: 0, lifetime_letters: 0, submitted_at: null, econ: null };
  const save = { level: 514, rebirths: 28, words: 250, letters: 1800 };
  assert.equal(decideSubmitFinal(first, save, T0).row.rebirths, 2, 'pre-070: the clamp that froze him');
  const d = decideSubmitFinal(first, save, T0, { converge: true });
  assert.equal(d.row.rebirths, 25);
  assert.equal(F_RB_WORDS, 10);
});

test('070: a row BEHIND its save converges on the next push — bounded by words / 10, flagged, never lowered', () => {
  const row = { level: 514, rebirths: 2, lifetime_words: 727, lifetime_letters: 5413, submitted_at: T0 - 60_000, econ: 13 };
  const save = { level: 520, rebirths: 29, words: 730, letters: 5420 };
  assert.equal(decideSubmitFinal(row, save, T0).row.rebirths, 2, 'pre-070: a submit never raised rebirths');
  const d = decideSubmitFinal(row, save, T0, { converge: true });
  assert.deepEqual([d.action, d.row.rebirths, d.raised], ['increase', 29, true]);
  assert.equal(d.row.level, 520, 'the level room grows with the converged R');
  // bounded by the words the row holds
  const thin = decideSubmitFinal({ ...row, lifetime_words: 100 }, { ...save, words: 120 }, T0, { converge: true });
  assert.equal(thin.row.rebirths, 12);
  // equal / lower: nothing raised; lower is still refused (054 / 057)
  assert.equal(decideSubmitFinal({ ...row, rebirths: 29, level: 1 }, save, T0, { converge: true }).raised, false);
  assert.equal(decideSubmitFinal({ ...row, rebirths: 30 }, save, T0, { converge: true }).action, 'refused');
});

test('070 SQL: converge rule, the catchup flag, unchanged lower-write refusal, grants', () => {
  const s = read('supabase', 'migrations', '070_board_converge.sql');
  assert.match(s, /F_RB_WORDS constant integer := 10;/);
  assert.match(s, /rb := least\(rb, floor\(w \/ F_RB_WORDS\)::bigint\);/, 'first write: words / 10');
  assert.match(s, /if rb > old\.rebirths then\n\s+rb := least\(rb, greatest\(old\.rebirths::bigint, floor\(w \/ F_RB_WORDS\)::bigint\)\);/);
  assert.doesNotMatch(s, /rb := least\(rb, old\.rebirths::bigint\);/, 'the "never raises" clamp is gone');
  assert.match(s, /is_reset := rb < old\.rebirths or \(lv < old\.level and rb = old\.rebirths\);/);
  assert.match(s, /if is_reset then return; end if;/);
  assert.match(s, /update public\.profiles set rb_words0 = w where id = pid;/);
  assert.match(s, /private\.cheat_flag\(pid, 'catchup'/);
  assert.match(s, /check \(reason in \('rejected', 'clamped', 'gear', 'catchup'\)\)/);
  assert.match(s, /revoke all on function private\.lb_board_write_s2\(text, integer, integer, bigint, bigint, numeric\) from anon, authenticated;/);
  assert.match(s, /WRITE-ONLY: Claude never runs migrations/);
  assert.match(s, /notify pgrst, 'reload schema';\s*$/);
});

test('071 SQL: short codes — alphabet, caps, one code per account, security definer + grants, tables locked', () => {
  const s = read('supabase', 'migrations', '071_short_save_codes.sql');
  assert.match(s, /code ~ '\^\[23456789ABCDEFGHJKMNPQRSTUVWXYZ\]\{10\}\$'/);
  assert.match(s, /profile_id uuid not null unique references public\.profiles \(id\) on delete cascade/);
  assert.match(s, /blob text not null check \(length\(blob\) <= 1048576\)/);
  assert.match(s, /left\(p_blob, 5\) <> 'TAW2\.'/, 'only a checksummed TAW2 code is stored');
  assert.match(s, /NEW_PER_HOUR constant integer := 600;/);
  assert.match(s, /MISSES_PER_MIN constant integer := 60;/);
  for (const fn of ['lb_save_code_put(text, text)', 'lb_save_code_get(text)']) {
    assert.ok(s.includes(`grant execute on function public.${fn} to anon, authenticated;`), fn);
  }
  assert.equal((s.match(/security definer/g) || []).length, 2);
  assert.match(s, /revoke all on private\.save_codes from anon, authenticated;/);
  assert.match(s, /revoke all on private\.save_code_misses from anon, authenticated;/);
});

test('072 restore: only raises (greatest), touches two named ids, verify SELECT, no delete / lower', () => {
  const s = read('claude', '072_restore_daan.sql');
  const live = s.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
  for (const col of ['rebirths', 'lifetime_words', 'lifetime_letters', 'stars']) assert.match(live, new RegExp(`${col}\\s+= greatest\\(`), col);
  assert.match(live, /d\.id = 'e29427f6-0302-4523-8c34-409abdec70f9' and d\.username = 'dan'/);
  assert.match(live, /o\.id = 'fe57cdaf-1526-4d26-a665-9e41ec2fb8e2' and o\.username = 'Daan'/);
  assert.doesNotMatch(live, /\bdelete\b|\bdrop\b|\btruncate\b/i);
  assert.doesNotMatch(live, /username\s*=\s*'Daan_old'/, 'the rename stays commented out (Andy\'s call)');
  assert.match(live, /^select id, username, level, rebirths/m);
});

/** A rebirth flow whose server can be made to fail in each way. */
function flow({ enabled = async () => true, call } = {}) {
  const store = new Map();
  const st = { rebirths: 26, level: 600 };
  const f = makeRebirthFlow({
    serverEnabled: enabled,
    pushStats: async () => true,
    call,
    secret: () => 's'.repeat(48),
    storage: { get: (k) => (store.has(k) ? store.get(k) : null), set: (k, v) => store.set(k, v), remove: (k) => store.delete(k) },
    localRebirths: () => st.rebirths,
    localReady: () => true,
    applyLocal: (t) => { st.rebirths = Number.isFinite(t) ? t : st.rebirths + 1; st.level = 1; return { rc: st.rebirths, stars: 0 }; },
  });
  return { f, st, store };
}

test('a NAMED player whose caps probe fails is refused OFFLINE — never a local rebirth the server never sees', async () => {
  for (const enabled of [async () => 'offline', async () => { throw new Error('Failed to fetch'); }]) {
    const h = flow({ enabled, call: async () => assert.fail('no RPC') });
    const r = await h.f.performRebirth();
    assert.deepEqual([r.ok, r.reason], [false, 'offline']);
    assert.equal(h.st.rebirths, 26, 'nothing applied');
  }
  // no name at all (serverEnabled false) still rebirths locally — there is no row to diverge from
  const local = flow({ enabled: async () => false, call: async () => assert.fail('no RPC') });
  assert.equal((await local.f.performRebirth()).mode, 'local');
});

test('an lb_rebirth that ANSWERS 4xx clears the pending id (pushes resume); a 5xx / 429 / network error keeps it', async () => {
  const err = (status, code) => Object.assign(new Error(code), { code, status });
  assert.equal(isServerRefusal(err(400, 'no_profile')), true);
  for (const e of [err(503, 'http_503'), err(429, 'http_429'), err(408, 'http_408'), err(404, 'http_404'), new Error('Failed to fetch')]) {
    assert.equal(isServerRefusal(e), false, e.message);
  }
  const h = flow({ call: async () => { throw err(400, 'no_profile'); } });
  h.store.set(PENDING_REBIRTH_KEY, JSON.stringify({ id: 'old-id', from: 26 }));
  assert.equal(await h.f.settlePending(), true, 'settled: the next board push goes through');
  assert.equal(h.store.has(PENDING_REBIRTH_KEY), false);
  const r = await h.f.performRebirth();
  assert.deepEqual([r.ok, r.reason], [false, 'error']);
  const net = flow({ call: async () => { throw err(503, 'http_503'); } });
  net.store.set(PENDING_REBIRTH_KEY, JSON.stringify({ id: 'old-id', from: 26 }));
  assert.equal(await net.f.settlePending(), false, 'still unanswered: retry with the same id');
  assert.equal(net.store.has(PENDING_REBIRTH_KEY), true);
});
