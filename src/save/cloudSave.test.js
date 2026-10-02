import test from 'node:test';
import assert from 'node:assert/strict';
import { progressScoreFromKeys, shouldRestore, formatRecoveryCode, parseRecoveryCode, restoreIfAhead, backupNow } from './cloudSave.js';
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

test('recovery code round-trips the secret', () => {
  const secret = '0123456789abcdef0123456789abcdef0123456789abcdef';
  const code = formatRecoveryCode(secret);
  assert.match(code, /^[0-9A-F]{4}(-[0-9A-F]{4}){11}$/);
  assert.equal(parseRecoveryCode(code), secret);
  assert.equal(parseRecoveryCode(' ' + code.toLowerCase() + ' '), secret);
  assert.equal(parseRecoveryCode('nope'), null);
});
