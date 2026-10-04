import test from 'node:test';
import assert from 'node:assert/strict';
import { progressScoreFromKeys, shouldRestore, formatRecoveryCode, parseRecoveryCode, restoreIfAhead, backupNow, wipeProgressKeys, econRpcArg, ECON_RPC_VERSION } from './cloudSave.js';
import { exportSave } from './saveBackup.js';

function withStorage(seed, fn) {
  const m = new Map(Object.entries(seed));
  const prev = globalThis.localStorage;
  globalThis.localStorage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  try { return fn(m); } finally { globalThis.localStorage = prev; }
}
const xp = (lv) => JSON.stringify({ lv, into: 0 });

test('progress score orders rebirths > level > letters', () => {
  const s = (rb, lv, l) => progressScoreFromKeys({ 'taw.rebirths': String(rb), 'taw.xp': xp(lv), 'taw.letters': String(l) });
  assert.ok(s(1, 1, 0) > s(0, 9999, 9e8));
  assert.ok(s(0, 50, 0) > s(0, 49, 9e8));
  assert.ok(s(0, 50, 10) > s(0, 50, 9));
});

test('a restore NEVER lowers progress: only a strictly-ahead cloud save is restored', () => {
  const cloud = withStorage({ 'taw.xp': xp(120), 'taw.rebirths': '4', 'taw.letters': '5000', 'taw.wins': '777' }, () => exportSave());
  // a wiped browser at LV 1 → restore
  withStorage({ 'taw.xp': xp(1) }, (m) => assert.equal(shouldRestore(cloud, { getItem: (k) => m.get(k) ?? null }).restore, true));
  // a browser AHEAD of the cloud (played offline since) → keep local
  withStorage({ 'taw.xp': xp(130), 'taw.rebirths': '4' }, (m) => assert.equal(shouldRestore(cloud, { getItem: (k) => m.get(k) ?? null }).restore, false));
  // equal → keep local
  withStorage({ 'taw.xp': xp(120), 'taw.rebirths': '4', 'taw.letters': '5000' }, (m) => assert.equal(shouldRestore(cloud, { getItem: (k) => m.get(k) ?? null }).restore, false));
  assert.equal(shouldRestore('garbage').restore, false);
});

test('restoreIfAhead imports the cloud save into a wiped browser', async () => {
  const cloud = withStorage({ 'taw.xp': xp(88), 'taw.rebirths': '2', 'taw.wins': '4242' }, () => exportSave());
  const m = new Map([['taw.xp', xp(1)]]);
  const prev = globalThis.localStorage;
  globalThis.localStorage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  try {
    const rpc = async (fn) => (fn === 'lb_load' ? { id: 'p1', username: 'Zed', blob: cloud, score: 1 } : null);
    const r = await restoreIfAhead({ rpc, secret: 'a'.repeat(48) });
    assert.equal(r.restored, true);
    assert.equal(JSON.parse(m.get('taw.xp')).lv, 88);
    assert.equal(m.get('taw.wins'), '4242');
    assert.equal(r.username, 'Zed');
  } finally {
    globalThis.localStorage = prev;
  }
});

test('backup sends the export + score, throttled', async () => {
  const m = new Map([['taw.xp', xp(10)]]);
  const prev = globalThis.localStorage;
  globalThis.localStorage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  try {
    const calls = [];
    const rpc = async (fn, body) => { calls.push({ fn, body }); return { saved: true }; };
    assert.equal(await backupNow({ rpc, secret: 's'.repeat(48) }), true);
    assert.equal(await backupNow({ rpc, secret: 's'.repeat(48) }), false, 'throttled');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].fn, 'lb_save');
    assert.ok(calls[0].body.p_blob.length > 10);
  } finally {
    globalThis.localStorage = prev;
  }
});

// Rebirth Rush (018_rebirth_rush.sql): econ: true = the client's own version (12); a number = the p_econ the server takes.
test('RR: econ caps route the backup to lb_save2 and the restore to lb_load2, with p_econ = 12', async () => {
  const cloud = withStorage({ 'taw.xp': xp(70), 'taw.rebirths': '1' }, () => exportSave());
  await withStorage({ 'taw.xp': xp(2) }, async (m) => {
    const calls = [];
    const rpc = async (fn, body) => {
      calls.push({ fn, body });
      return fn === 'lb_load2' ? { id: 'p1', username: 'Zed', blob: cloud, score: 1 } : { saved: true };
    };
    assert.equal(await backupNow({ rpc, secret: 's'.repeat(48), econ: true }), true);
    const r = await restoreIfAhead({ rpc, secret: 's'.repeat(48), econ: true });
    assert.equal(r.restored, true);
    assert.deepEqual(calls.map((c) => c.fn), ['lb_save2', 'lb_load2']);
    assert.equal(calls[0].body.p_econ, 12);
    assert.equal(calls[1].body.p_econ, 12);
    assert.equal(m.has('taw.econ'), false, 'the blob had no stamp → the local one is removed so the migration re-runs');
  });
});

test('RR: the client sends what the server takes — 018 → 12, only 016/017 → 10, neither → the old RPCs', async () => {
  assert.equal(ECON_RPC_VERSION, 12);
  assert.equal(econRpcArg(12), 12);
  assert.equal(econRpcArg(13), 12, 'never more than the client speaks');
  assert.equal(econRpcArg(11), 10, 'no server reports 11 (v11 018 never ran) — falls back like any 016-era value');
  assert.equal(econRpcArg(10), 10, 'before Andy runs 018: 016 accepts 10 only');
  assert.equal(econRpcArg(undefined), 0);
  assert.equal(econRpcArg(null), 0);
  const calls = [];
  const rpc = async (fn, body) => {
    calls.push({ fn, body });
    return { saved: true };
  };
  await withStorage({ 'taw.xp': xp(2) }, async () => {
    await backupNow({ rpc, secret: 's'.repeat(48), force: true, econ: 10 });
    await backupNow({ rpc, secret: 's'.repeat(48), force: true, econ: 0 });
  });
  assert.deepEqual(calls.map((c) => [c.fn, c.body.p_econ]), [['lb_save2', 10], ['lb_save', undefined]]);
});

test('recovery code round-trips the secret', () => {
  const secret = '0123456789abcdef0123456789abcdef0123456789abcdef';
  const code = formatRecoveryCode(secret);
  assert.match(code, /^[0-9A-F]{4}(-[0-9A-F]{4}){11}$/);
  assert.equal(parseRecoveryCode(code), secret);
  assert.equal(parseRecoveryCode(' ' + code.toLowerCase() + ' '), secret);
  assert.equal(parseRecoveryCode('nope'), null);
});

// ---- 012_admin_reset ------------------------------------------------------------------------------
test('wipeProgressKeys removes every taw.* key except the kept claim + secret, and nothing else', () => {
  const m = new Map(Object.entries({ 'taw.xp': xp(40), 'taw.wins': '99', 'taw.rebirths': '3', 'taw.lb.secret': 'abc', 'taw.lb.profile': '{"id":"p"}', other: 'x' }));
  const store = { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, removeItem: (k) => m.delete(k) };
  assert.equal(wipeProgressKeys(store, ['taw.lb.secret', 'taw.lb.profile']), 3);
  assert.deepEqual([...m.keys()].sort(), ['other', 'taw.lb.profile', 'taw.lb.secret']);
});

test('a dev reset flag outranks a restore: nothing is imported, resetAll is reported', async () => {
  const cloud = withStorage({ 'taw.xp': xp(90) }, () => exportSave());
  await withStorage({ 'taw.xp': xp(2) }, async (m) => {
    const rpc = async () => ({ id: 'p', username: 'N', blob: cloud, score: '1', reset_all: true });
    const r = await restoreIfAhead({ rpc, secret: 's' });
    assert.equal(r.resetAll, true);
    assert.equal(r.restored, false);
    assert.equal(JSON.parse(m.get('taw.xp')).lv, 2, 'the cloud save was NOT imported');
  });
});

test('check-only (restore: false) never imports even when the cloud is ahead', async () => {
  const cloud = withStorage({ 'taw.xp': xp(90) }, () => exportSave());
  await withStorage({ 'taw.xp': xp(2) }, async (m) => {
    const rpc = async () => ({ id: 'p', username: 'N', blob: cloud, score: '1', reset_all: false });
    const r = await restoreIfAhead({ rpc, secret: 's', restore: false });
    assert.equal(r.restored, false);
    assert.equal(JSON.parse(m.get('taw.xp')).lv, 2);
  });
});

// RR review 6: an UNCONVERTED (pre-Rebirth Rush, taw.econ < 12) cloud blob is scored as the save it becomes once
// the restore reloads and rebirthRushConvert runs — never its raw level against a converted local save.
test('shouldRestore scores an unconverted blob AS CONVERTED (rebirthRushConvert on its level + rebirths)', () => {
  const v10 = (lv, rc) => JSON.stringify({ lv, f: 0, rc, v: 10 });
  // LV300 R0 (econ 10) converts to R16 — ahead of a converted local R10 at LV5, though its raw R0 is not
  const cloudOld = withStorage({ 'taw.xp': v10(300, 0), 'taw.xpv10': v10(300, 0), 'taw.econ': '10' }, () => exportSave());
  withStorage({ 'taw.xp': JSON.stringify({ lv: 5, f: 0, rc: 10, v: 10 }), 'taw.rebirths': '10', 'taw.econ': '12' }, (m) => {
    const r = shouldRestore(cloudOld, { getItem: (k) => m.get(k) ?? null });
    assert.equal(r.restore, true, 'the old blob is 16 rebirths once converted');
  });
  // the same raw level stamped 12 (already converted rules) is NOT converted again: R0 LV300 < R10
  const cloudNew = withStorage({ 'taw.xp': v10(300, 0), 'taw.xpv10': v10(300, 0), 'taw.econ': '12' }, () => exportSave());
  withStorage({ 'taw.xp': JSON.stringify({ lv: 5, f: 0, rc: 10, v: 10 }), 'taw.rebirths': '10', 'taw.econ': '12' }, (m) => {
    assert.equal(shouldRestore(cloudNew, { getItem: (k) => m.get(k) ?? null }).restore, false);
  });
  // the leaderboard / backup score itself is unchanged (no option → raw)
  assert.equal(
    progressScoreFromKeys({ 'taw.xp': v10(300, 0), 'taw.econ': '10' }),
    progressScoreFromKeys({ 'taw.xp': v10(300, 0), 'taw.econ': '12' }),
  );
});
