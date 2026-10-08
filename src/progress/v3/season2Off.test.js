// season2Off.test.js — WITH THE SEASON2 FLAG OFF THE RESET CHANGES NOTHING (phase 4). The flag is off by default (no
// ?season2, no VITE_SEASON2, SEASON2_LIVE false): the boot check returns at once even when the server says the reset
// ran, a season-1 save keeps every key, no welcome mounts, and the storage layer is not patched.
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
const B = await import('./season2Boot.js');

test('SEASON2 is OFF by default and the flip line is off', () => {
  assert.equal(S.SEASON2, false);
  assert.equal(S.SEASON2_LIVE, true); // flipped Oct 8 — LIVE is for browsers; node stays season 1 unless ?season2=1
  assert.equal(S.V3.boot, undefined, 'no boot check is started (installUi.jsx loads only with the flag)');
});

test('flag OFF: the boot check touches nothing, even when lb_caps says season2_reset', async () => {
  for (const [k, v] of Object.entries({ 'taw.econ': '12', 'taw.xp': '{"level":300}', 'taw.rebirths': '7', 'taw.gems': '{"bal":900}', 'taw.lb.profile': '{"username":"x"}' })) mem.set(k, v);
  const before = Object.fromEntries(mem);
  const shown = [];
  let capsAsked = 0;
  const ok = await B.bootSeason2({
    enabled: true,
    caps: async () => { capsAsked += 1; return { season2Reset: true }; },
    show: (p) => shown.push(p),
    reload: () => assert.fail('no reload'),
    rpc: async () => assert.fail('no server call'),
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
