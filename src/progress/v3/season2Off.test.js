// season2Off.test.js — WITH THE SEASON2 FLAG OFF THE CONVERSION CHANGES NOTHING (Andy oct6: no reset). The flag is off
// by default (no ?season2, no VITE_SEASON2, SEASON2_LIVE false): the local conversion returns at once, the boot never
// asks the server (even when lb_caps says season2_convert), a season-1 save keeps every key byte for byte, no card
// mounts, and the storage layer is not patched.
import test from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
  key: (i) => [...mem.keys()][i] ?? null,
  get length() { return mem.size; },
};

const S = await import('../season.js');
const L = await import('./convertLocal.js');
const U = await import('./season2Update.js');

test('SEASON2 is OFF by default and the flip line is off', () => {
  assert.equal(S.SEASON2, false);
  assert.equal(S.SEASON2_LIVE, false);
  assert.equal(S.V3.boot, undefined, 'no boot is started (installUi.jsx loads only with the flag)');
});

test('flag OFF: no conversion, no server call, no card — the season-1 save is untouched', async () => {
  for (const [k, v] of Object.entries({ 'taw.econ': '12', 'taw.xp': '{"lv":300,"f":0.5,"rc":13,"v":10}', 'taw.rebirths': '13', 'taw.keytier': '6', 'taw.wins': '5000', 'taw.gems': '{"bal":900}', 'taw.lb.profile': '{"username":"x"}' })) mem.set(k, v);
  const before = Object.fromEntries(mem);
  assert.equal(L.convertLocal(), null);
  const shown = [];
  let capsAsked = 0;
  const ok = await U.bootSeason2Update({
    enabled: true,
    caps: async () => { capsAsked += 1; return { season2Convert: true }; },
    show: (p) => shown.push(p),
    reload: () => assert.fail('no reload'),
    rpc: async () => assert.fail('no server call'),
    secret: 'a'.repeat(48),
    hasProfile: true,
  });
  assert.equal(ok, true);
  assert.equal(capsAsked, 0);
  assert.deepEqual(Object.fromEntries(mem), before);
  assert.equal(shown.length, 0);
  // the live storage is unmapped: taw.xp is the season-1 key
  localStorage.setItem('taw.xp', 'y');
  assert.equal(mem.get('taw.xp'), 'y');
  assert.equal(mem.has('taw.s2.xp'), false);
});
