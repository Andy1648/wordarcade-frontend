// The client half of the server-checked rebirth (rebirthFlow.js) against the JS model of the server (rebirthRules.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRebirthFlow, newRequestId, isNotDeployed, rebirthRefusalText, PENDING_REBIRTH_KEY } from './rebirthFlow.js';
import { makeRebirthServer, serverGate } from './rebirthRules.js';

const T0 = Date.UTC(2026, 9, 5, 18, 0, 0);

/** A fake client: local save { level, rebirths }, a storage map, and an RPC backed by the server model. */
function harness({ server = true, local = { level: 25, rebirths: 0 }, stored = null, deployed = true, net = null } = {}) {
  const store = new Map();
  const st = { ...local };
  const srv = makeRebirthServer(stored || { level: st.level, rebirths: st.rebirths });
  let now = T0;
  const calls = [];
  const h = {
    st, srv, store, calls,
    tick: (ms) => { now += ms; },
    flow: null,
    netFail: net, // fn(call#) → true to throw a network error
    lostResponse: false, // the server answers, the client never hears it
  };
  h.flow = makeRebirthFlow({
    serverEnabled: async () => server,
    pushStats: async () => { srv.db.row.level = st.level; return true; },
    call: async (fn, body) => {
      calls.push({ fn, ...body });
      if (!deployed) throw Object.assign(new Error('PGRST202'), { code: 'Could not find the function public.lb_rebirth' });
      if (h.netFail && h.netFail(calls.length)) throw Object.assign(new Error('http_502'), { code: 'http_502' });
      const req = { requestId: body.p_request_id, season: body.p_season };
      const res = fn === 'lb_rebirth' ? srv.rebirth(req, now) : srv.ascend(req, now);
      if (h.lostResponse) { h.lostResponse = false; throw Object.assign(new Error('Failed to fetch'), { code: 'Failed to fetch' }); }
      return res;
    },
    secret: () => 's'.repeat(48),
    storage: { get: (k) => (store.has(k) ? store.get(k) : null), set: (k, v) => store.set(k, v), remove: (k) => store.delete(k) },
    localRebirths: () => st.rebirths,
    localReady: () => st.level >= serverGate(st.rebirths, 0),
    applyLocal: (target) => {
      if (Number.isFinite(target)) st.rebirths = target - 1;
      st.rebirths += 1;
      st.level = 1;
      return { rc: st.rebirths, stars: 1 };
    },
  });
  return h;
}

test('newRequestId is a v4 uuid; isNotDeployed reads PGRST202 / 404', () => {
  for (let i = 0; i < 20; i++) assert.match(newRequestId(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(isNotDeployed({ code: 'PGRST202' }), true);
  assert.equal(isNotDeployed({ code: 'http_404' }), true);
  assert.equal(isNotDeployed({ code: 'http_502' }), false);
});

test('SERVER: ok → applied locally on the SERVER count, pending id cleared', async () => {
  const h = harness();
  const r = await h.flow.performRebirth();
  assert.deepEqual([r.ok, r.mode, r.rc], [true, 'server', 1]);
  assert.deepEqual([h.st.rebirths, h.st.level, h.srv.db.row.rebirths], [1, 1, 1]);
  assert.equal(h.store.has(PENDING_REBIRTH_KEY), false);
  // local AHEAD of the board (an old local-only rebirth): local lands on the server's count, not local + 1
  const a = harness({ local: { level: 200, rebirths: 7 }, stored: { level: 200, rebirths: 4 } });
  const ra = await a.flow.performRebirth();
  assert.deepEqual([ra.ok, ra.rc, a.st.rebirths], [true, 5, 5]);
});

test('SINGLE-FLIGHT: a double click while pending does nothing extra → one request, one rebirth', async () => {
  const h = harness();
  const [a, b] = await Promise.all([h.flow.performRebirth(), h.flow.performRebirth()]);
  assert.equal(a.ok, true);
  assert.deepEqual([b.ok, b.reason], [false, 'pending']);
  assert.equal(h.calls.length, 1);
  assert.equal(h.st.rebirths, 1);
  assert.equal(h.srv.db.row.rebirths, 1);
});

test('GATE: refused with the server numbers, nothing applied', async () => {
  const h = harness({ local: { level: 20, rebirths: 0 } });
  const r = await h.flow.performRebirth();
  assert.deepEqual([r.ok, r.reason, r.gate, r.level], [false, 'gate', 25, 20]);
  assert.deepEqual([h.st.rebirths, h.st.level], [0, 20]);
  assert.equal(rebirthRefusalText(r), 'LV 20 / 25 — NOT THERE YET');
  assert.equal(rebirthRefusalText({ ok: false, reason: 'gate', gate: 1500, level: 1200 }), 'LV 1,200 / 1,500 — NOT THERE YET');
  assert.equal(rebirthRefusalText({ ok: false, reason: 'wait', retry_in: 200 }), 'NEXT REBIRTH IN 3:20');
  assert.equal(rebirthRefusalText({ ok: false, reason: 'pending' }), null);
});

test('NETWORK ERROR: nothing applied, the button can retry, and the retry re-sends the SAME request id', async () => {
  const h = harness();
  h.netFail = (n) => n === 1;
  const r = await h.flow.performRebirth();
  assert.deepEqual([r.ok, r.reason], [false, 'offline']);
  assert.deepEqual([h.st.rebirths, h.srv.db.row.rebirths], [0, 0]);
  const again = await h.flow.performRebirth();
  assert.equal(again.ok, true);
  assert.equal(h.calls[0].p_request_id, h.calls[1].p_request_id, 'same id');
  assert.equal(h.st.rebirths, 1);
});

test('LOST RESPONSE (server did it, client never heard): the retry replays → applied ONCE, never twice', async () => {
  const h = harness();
  h.lostResponse = true;
  const r = await h.flow.performRebirth();
  assert.equal(r.reason, 'offline');
  assert.deepEqual([h.st.rebirths, h.srv.db.row.rebirths], [0, 1], 'the server did it');
  // a reload: the pending id is in storage; the next submit settles it first
  assert.equal(h.flow.hasPending(), true);
  assert.equal(await h.flow.settlePending(), true);
  assert.deepEqual([h.st.rebirths, h.srv.db.row.rebirths], [1, 1]);
  assert.equal(h.calls[0].p_request_id, h.calls[1].p_request_id);
  // settling again / clicking again does not mint a second one (the stored level is now 1)
  assert.equal(await h.flow.settlePending(), true);
  const r2 = await h.flow.performRebirth();
  assert.equal(r2.reason, 'gate');
  assert.deepEqual([h.st.rebirths, h.srv.db.row.rebirths], [1, 1]);
});

test('a REPLAYED refusal (an old try) is re-asked once with a fresh id — the player is asking NOW', async () => {
  const h = harness({ local: { level: 10, rebirths: 0 } });
  h.lostResponse = true;
  await h.flow.performRebirth(); // logged as 'gate' server-side; the client kept the id
  h.st.level = 30; // climbs past the gate
  h.tick(5000);
  const r = await h.flow.performRebirth();
  assert.equal(r.ok, true);
  assert.notEqual(h.calls[1].p_request_id, h.calls[2].p_request_id);
});

test('LOCAL fallback: no board profile / not deployed (PGRST202) → today\'s local rebirth, gated locally', async () => {
  const off = harness({ server: false });
  const a = await off.flow.performRebirth();
  assert.deepEqual([a.ok, a.mode, off.st.rebirths], [true, 'local', 1]);
  assert.equal(off.calls.length, 0, 'no RPC without a profile');
  const nd = harness({ deployed: false });
  const b = await nd.flow.performRebirth();
  assert.deepEqual([b.ok, b.mode, nd.st.rebirths], [true, 'local', 1]);
  assert.equal(nd.store.has(PENDING_REBIRTH_KEY), false);
  const below = harness({ server: false, local: { level: 3, rebirths: 0 } });
  const c = await below.flow.performRebirth();
  assert.deepEqual([c.ok, c.reason, below.st.rebirths], [false, 'gate', 0]);
});

test('SPAM: 1,000 clicks + replays of every id ever sent → rebirths only when the gate was met', async () => {
  const h = harness({ local: { level: 1, rebirths: 0 } });
  let met = 0;
  for (let i = 0; i < 1000; i++) {
    h.tick(97);
    if (i % 200 === 50) { h.st.level = serverGate(h.st.rebirths, 0); met += 1; }
    await Promise.all([h.flow.performRebirth(), h.flow.performRebirth()]);
  }
  // raw replays of every id the client ever sent, straight at the server
  const before = h.srv.db.row.rebirths;
  for (const c of h.calls) h.srv.rebirth({ requestId: c.p_request_id }, T0 + 1e9);
  assert.equal(h.srv.db.row.rebirths, before, 'replays change nothing');
  assert.equal(h.srv.db.row.rebirths, met);
  assert.equal(h.st.rebirths, met);
});
