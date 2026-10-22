// cloudCodec.test.js — B2 (oct21 progression audit): a heavy word collection used to push the cloud blob past the
// server's 64 KB cap, after which every backup was silently refused. The cloud copy is now gzip-packed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { packBlob, unpackBlob, fitsCloud, PACK_PREFIX, CLOUD_BLOB_CAP, BACKUP_FAIL_KEY } from './cloudCodec.js';
import { backupNow, restoreIfAhead } from './cloudSave.js';
import { exportSave } from './saveBackup.js';

function withStorage(seed, fn) {
  const m = new Map(Object.entries(seed));
  const prev = globalThis.localStorage;
  globalThis.localStorage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  const done = () => { globalThis.localStorage = prev; };
  try {
    const r = fn(m);
    if (r && typeof r.then === 'function') return r.finally(done);
    done();
    return r;
  } catch (e) {
    done();
    throw e;
  }
}
const xp = (lv) => JSON.stringify({ lv, into: 0 });

// a realistic heavy collection: N distinct words in the detail map + E evicted, like collection.js stores them
function heavyCollection(n, e) {
  const w = {};
  let seed = 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const word = (i) => Array.from({ length: 5 + (i % 7) }, () => String.fromCharCode(97 + Math.floor(rnd() * 26))).join('') + i;
  for (let i = 0; i < n; i += 1) w[word(i)] = [i % 4, i % 5, 20300 + (i % 400), i];
  const ev = Array.from({ length: e }, (_, i) => word(n + i));
  return JSON.stringify({ v: 1, seq: n + e, w, ms: [100, 500, 1000], ev });
}

test('a heavy collection that overflowed the 64 KB cap now packs well under it', async () => {
  const code = withStorage({ 'taw.xp': xp(40), 'taw.s2.rebirths': '22', 'taw.collection': heavyCollection(2500, 500) }, () => exportSave());
  assert.ok(code.length > 65536, `fixture must reproduce the bug (plain ${code.length})`);
  const packed = await packBlob(code);
  assert.ok(packed.startsWith(PACK_PREFIX));
  assert.ok(fitsCloud(packed), `packed ${packed.length} should fit ${CLOUD_BLOB_CAP}`);
  assert.equal(await unpackBlob(packed), code, 'round-trips byte for byte');
});

test('plain blobs (old cloud copies, hand-typed save codes) pass through unpack untouched', async () => {
  const code = withStorage({ 'taw.xp': xp(3) }, () => exportSave());
  assert.equal(await unpackBlob(code), code);
  assert.equal(await unpackBlob(PACK_PREFIX + 'not-gzip!!'), null, 'a corrupt packed blob is unusable, never half-read');
});

test('backup sends the packed blob and a wiped browser restores it intact', async () => {
  const coll = heavyCollection(2500, 500);
  let sent = null;
  await withStorage({ 'taw.xp': xp(40), 'taw.rebirths': '9', 'taw.collection': coll }, async () => {
    const rpc = async (fn, body) => { sent = body.p_blob; return { saved: true }; };
    assert.equal(await backupNow({ rpc, secret: 's'.repeat(48), force: true }), true);
  });
  assert.ok(sent.startsWith(PACK_PREFIX) && sent.length <= CLOUD_BLOB_CAP);
  await withStorage({ 'taw.xp': xp(1) }, async (m) => {
    const rpc = async (fn) => (fn === 'lb_load' ? { id: 'p1', username: 'Zed', blob: sent, score: 1 } : null);
    const r = await restoreIfAhead({ rpc, secret: 's'.repeat(48) });
    assert.equal(r.restored, true);
    assert.equal(m.get('taw.collection'), coll);
    assert.equal(m.get('taw.rebirths'), '9');
  });
});

test('a blob still over the cap is NOT sent, and the reason is recorded instead of failing silently', async () => {
  // incompressible noise: packing can't save it
  let seed = 3;
  const noise = Array.from({ length: 1200000 }, () => String.fromCharCode(33 + ((seed = (seed * 16807) % 2147483647) % 90))).join('');
  await withStorage({ 'taw.xp': xp(5), 'taw.records': noise }, async (m) => {
    let calls = 0;
    const rpc = async () => { calls += 1; return { saved: true }; };
    assert.equal(await backupNow({ rpc, secret: 's'.repeat(48), force: true }), false);
    assert.equal(calls, 0, 'never sends a blob the server would refuse');
    const fail = JSON.parse(m.get(BACKUP_FAIL_KEY));
    assert.equal(fail.reason, 'too_big');
    assert.ok(fail.size > CLOUD_BLOB_CAP);
  });
});

test('a server refusal is recorded; the next good backup clears it', async () => {
  await withStorage({ 'taw.xp': xp(5) }, async (m) => {
    const bad = async () => { throw new Error('bad_blob'); };
    assert.equal(await backupNow({ rpc: bad, secret: 's'.repeat(48), force: true }), false);
    assert.equal(JSON.parse(m.get(BACKUP_FAIL_KEY)).reason, 'bad_blob');
    const ok = async () => ({ saved: true });
    assert.equal(await backupNow({ rpc: ok, secret: 's'.repeat(48), force: true }), true);
    assert.equal(m.has(BACKUP_FAIL_KEY), false);
  });
});
