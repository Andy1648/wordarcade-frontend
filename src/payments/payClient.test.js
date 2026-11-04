// payClient.test.js — PAID GEMS, the browser half: each ledger row applies ONCE (a lost ack can't pay twice), a claw is
// floored at 0, the fly hears the net credit before the grant, and the checkout call never sends an amount.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
const SECRET = 'c'.repeat(48);
const { applyPaid, clawGems, startCheckout } = await import('./payClient.js');
const SESS = async () => ({ access: 'tok_good' }); // a signed-in Google session (085)
const { getGems, GEMS_KEY, GEM_REASONS } = await import('../progress/gemsCore.js');

function reset(bal) {
  store.clear();
  store.set('taw.lb.secret', SECRET);
  store.set(GEMS_KEY, JSON.stringify({ v: 1, bal, peak: 1, streak: 0, mig: 1 }));
}

test("'paid' is a gem reason (the ledger names it; never × the gem gear)", () => {
  assert.ok(GEM_REASONS.includes('paid'));
});

test('a credit applies once: re-sent rows (lost ack) are acked again but never paid twice', async () => {
  reset(10);
  const acks = [];
  const call = async (fn, body) => { acks.push([fn, body]); return 1; };
  let heard = 0;
  const r1 = await applyPaid([{ id: 7, delta: 300, reason: 'purchase' }], { call, onCredit: (n) => { heard = n; assert.equal(getGems(), 10, 'the fly hears it BEFORE the grant'); } });
  assert.equal(heard, 300);
  assert.equal(r1.credited, 300);
  assert.equal(getGems(), 310);
  const r2 = await applyPaid([{ id: 7, delta: 300, reason: 'purchase' }], { call });
  assert.equal(r2.credited, 0);
  assert.equal(getGems(), 310);
  assert.deepEqual(acks.map((a) => a[1].p_ids), [[7], [7]]);
  assert.equal(acks[0][1].p_secret, SECRET);
});

test('a claw takes gems off, floored at 0; grant + claw arriving together net out in id order', async () => {
  reset(100);
  const call = async () => 1;
  await applyPaid([{ id: 2, delta: -300, reason: 'refund' }], { call });
  assert.equal(getGems(), 0, 'never negative on the device');
  reset(5);
  let heard = null;
  await applyPaid([{ id: 4, delta: -800, reason: 'refund' }, { id: 3, delta: 800, reason: 'purchase' }], { call, onCredit: (n) => { heard = n; } });
  assert.equal(getGems(), 5);
  assert.equal(heard, null, 'nothing to fly when the net is 0');
  assert.equal(clawGems(0), 0);
});

test('checkout sends { pack, secret, access } only (085: the Google session) and leaves for Stripe; a foreign redirect host is refused', async () => {
  reset(0);
  globalThis.window = { location: { href: 'https://typeaword.com/', host: 'typeaword.com' } };
  const sent = [];
  let went = null;
  const ok = async (url, init) => { sent.push([url, JSON.parse(init.body)]); return new Response(JSON.stringify({ url: 'https://checkout.stripe.com/c/pay/cs_1' }), { status: 200 }); };
  assert.deepEqual(await startCheckout('pile', { fetchImpl: ok, go: (u) => { went = u; }, getSession: SESS }), { ok: true });
  assert.deepEqual(sent[0], ['/api/checkout', { pack: 'pile', secret: SECRET, access: 'tok_good' }]);
  assert.equal(went, 'https://checkout.stripe.com/c/pay/cs_1');
  went = null;
  const evil = async () => new Response(JSON.stringify({ url: 'https://evil.example/pay' }), { status: 200 });
  assert.equal((await startCheckout('pile', { fetchImpl: evil, go: (u) => { went = u; }, getSession: SESS })).ok, false);
  assert.equal(went, null);
  const cap = async () => new Response(JSON.stringify({ error: 'cap', spent_cents: 1999, cap_cents: 2000 }), { status: 409 });
  assert.deepEqual(await startCheckout('pouch', { fetchImpl: cap, go: () => {}, getSession: SESS }), { ok: false, reason: 'cap', spent_cents: 1999, cap_cents: 2000 });
  delete globalThis.window;
});

test('checkout without a Google session never calls the server: sign_in (085 — buying needs an account)', async () => {
  reset(0);
  globalThis.window = { location: { href: 'https://typeaword.com/', host: 'typeaword.com' } };
  let called = 0;
  const r = await startCheckout('pile', { fetchImpl: async () => { called += 1; return new Response('{}'); }, go: () => {}, getSession: async () => null });
  assert.deepEqual(r, { ok: false, reason: 'sign_in' });
  assert.equal(called, 0);
});
