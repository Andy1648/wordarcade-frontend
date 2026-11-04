// payServer.test.js — PAID GEMS, the server half (api/_lib/pay.js) with a MOCKED Stripe and a FAKE database that
// models 082_paid_gems.sql's rules (one purchase per session id, the $20 monthly cap with reservations, pro-rata claws).
// Signature verification uses the real `stripe` package offline: generateTestHeaderString signs, constructEventAsync
// verifies — no network, no account.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import { handleCheckout, handleWebhook, verifyEvent, grantArgs, routeEvent, paymentsEnabled, serviceRpc } from '../../api/_lib/pay.js';
import { PACKS, MONTHLY_CAP_CENTS, packById } from './packs.js';

const WHSEC = 'whsec_test_secret_for_unit_tests';
const stripe = new Stripe('sk_test_unit_tests_only');
const ENV = { VITE_PAYMENTS_ON: '1', STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: WHSEC };
const SECRET = 'a'.repeat(48);
const PID = '11111111-2222-3333-4444-555555555555';

// ---- a fake 082 database ----------------------------------------------------------------------------------------------
function fakeDb({ profiles = { [SECRET]: PID }, flagged = new Set() } = {}) {
  const db = { reservations: new Map(), purchases: new Map(), ledger: [], flags: flagged, calls: [], seq: 0 };
  const monthCents = (pid) =>
    [...db.purchases.values()].filter((p) => p.profile_id === pid).reduce((s, p) => s + p.amount_cents, 0) +
    [...db.reservations.values()].filter((r) => r.profile_id === pid && r.state === 'open').reduce((s, r) => s + r.amount_cents, 0);
  db.rpc = async (fn, body) => {
    db.calls.push([fn, body]);
    if (fn === 'pay_reserve') {
      const pid = profiles[body.p_secret];
      if (!pid) return { ok: false, reason: 'no_profile' };
      if (db.flags.has(pid)) return { ok: false, reason: 'flagged' };
      const spent = monthCents(pid);
      if (spent + body.p_cents > MONTHLY_CAP_CENTS) return { ok: false, reason: 'cap', spent_cents: spent, cap_cents: MONTHLY_CAP_CENTS };
      const id = `res-${++db.seq}`;
      db.reservations.set(id, { profile_id: pid, amount_cents: body.p_cents, state: 'open' });
      return { ok: true, profile_id: pid, reservation: id, spent_cents: spent, cap_cents: MONTHLY_CAP_CENTS };
    }
    if (fn === 'pay_release') {
      const r = db.reservations.get(body.p_reservation);
      if (r && r.state === 'open') r.state = 'released';
      return { released: true };
    }
    if (fn === 'pay_grant') {
      if (db.purchases.has(body.p_session)) return { granted: false, duplicate: true };
      db.purchases.set(body.p_session, { profile_id: body.p_profile, gems: body.p_gems, amount_cents: body.p_cents, pi: body.p_payment_intent, clawed: 0 });
      db.ledger.push({ profile_id: body.p_profile, delta: body.p_gems });
      const r = db.reservations.get(body.p_reservation);
      if (r) r.state = 'paid';
      return { granted: true, duplicate: false, gems: body.p_gems };
    }
    if (fn === 'pay_claw') {
      const pur = [...db.purchases.values()].find((p) => p.pi === body.p_payment_intent);
      if (!pur) return { found: false };
      const target = body.p_reason === 'dispute' ? pur.gems : Math.min(pur.gems, Math.ceil((pur.gems * Math.min(body.p_refunded_cents, pur.amount_cents)) / pur.amount_cents));
      const owed = Math.max(0, target - pur.clawed);
      if (owed) db.ledger.push({ profile_id: pur.profile_id, delta: -owed });
      pur.clawed = Math.max(pur.clawed, target);
      if (body.p_reason === 'dispute') db.flags.add(pur.profile_id);
      return { found: true, clawed: owed };
    }
    throw new Error(`unknown rpc ${fn}`);
  };
  db.net = (pid = PID) => db.ledger.filter((l) => l.profile_id === pid).reduce((s, l) => s + l.delta, 0);
  return db;
}

// ---- a mocked Stripe Checkout -----------------------------------------------------------------------------------------
function mockStripe({ fail = false } = {}) {
  const created = [];
  return {
    created,
    webhooks: stripe.webhooks,
    checkout: {
      sessions: {
        create: async (params, opts) => {
          if (fail) throw new Error('stripe down');
          created.push({ params, opts });
          return { id: `cs_test_${created.length}`, url: `https://checkout.stripe.com/c/pay/cs_test_${created.length}` };
        },
      },
    },
  };
}
const checkoutReq = (body) => new Request('https://typeaword.com/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const signedReq = (event, secret = WHSEC) => {
  const payload = JSON.stringify(event);
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
  return new Request('https://typeaword.com/api/stripe-webhook', { method: 'POST', headers: { 'stripe-signature': header }, body: payload });
};
const completed = (over = {}, meta = {}) => ({
  id: 'evt_1',
  type: 'checkout.session.completed',
  data: {
    object: {
      id: 'cs_test_1', object: 'checkout.session', mode: 'payment', payment_status: 'paid', amount_total: 199, currency: 'usd',
      payment_intent: 'pi_1', metadata: { taw: '1', profile_id: PID, pack: 'pouch', gems: '600', reservation: 'res-1', ...meta }, ...over,
    },
  },
});

// ======================================================================================================== THE PACK TABLE
test('pack table: 4 packs, $1.99 → $19.99, ascending, whole cents, gems rise with price, each fits under the cap', () => {
  assert.equal(PACKS.length, 4);
  assert.equal(PACKS[0].cents, 199);
  assert.equal(PACKS[PACKS.length - 1].cents, 1999);
  for (let i = 0; i < PACKS.length; i += 1) {
    const p = PACKS[i];
    assert.ok(Number.isInteger(p.cents) && p.cents > 0 && p.cents <= MONTHLY_CAP_CENTS, p.id);
    assert.ok(Number.isInteger(p.gems) && p.gems > 0, p.id);
    assert.match(p.art, /^\/(wheel|shop)\/.+\.webp$/);
    if (i) {
      assert.ok(p.cents > PACKS[i - 1].cents && p.gems > PACKS[i - 1].gems);
      assert.ok(p.gems / p.cents >= PACKS[i - 1].gems / PACKS[i - 1].cents, 'a bigger pack is never worse value');
    }
  }
  assert.equal(new Set(PACKS.map((p) => p.id)).size, PACKS.length);
  assert.ok(Object.isFrozen(PACKS) && Object.isFrozen(PACKS[0]), 'the table is immutable at runtime');
  assert.equal(packById('nope'), null);
  assert.equal(packById({ id: 'pouch' }), null);
});

test('the $20 cap is mirrored in 082 and the art the packs use is on disk', async () => {
  const fs = await import('node:fs');
  for (const f of ['claude/082_paid_gems.sql', 'supabase/migrations/082_paid_gems.sql']) {
    const sql = fs.readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');
    assert.match(sql, new RegExp(`select ${MONTHLY_CAP_CENTS} \\$\\$; -- CAP_CENTS`), f);
    assert.match(sql, /stripe_session_id text primary key/, `${f}: the idempotency key`);
    for (const fn of ['pay_reserve', 'pay_release', 'pay_grant', 'pay_claw']) {
      assert.match(sql, new RegExp(`grant execute on function public\\.${fn}\\([^)]*\\) to service_role;`), `${f}: ${fn} → service role`);
      assert.doesNotMatch(sql, new RegExp(`grant execute on function public\\.${fn}\\([^)]*\\) to [^;]*anon`), `${f}: ${fn} never anon`);
    }
  }
  for (const p of PACKS) assert.ok(fs.existsSync(new URL(`../../public${p.art}`, import.meta.url)), p.art);
});

// ============================================================================================================ CHECKOUT
test('checkout: off (no flag / no key) is a 404 and never touches Stripe or the db', async () => {
  for (const env of [{}, { VITE_PAYMENTS_ON: '1' }, { STRIPE_SECRET_KEY: 'sk_test_x' }, { VITE_PAYMENTS_ON: '0', STRIPE_SECRET_KEY: 'sk_test_x' }]) {
    const db = fakeDb();
    const s = mockStripe();
    const r = await handleCheckout(checkoutReq({ pack: 'pouch', secret: SECRET }), { stripe: s, rpc: db.rpc, env });
    assert.equal(r.status, 404);
    assert.equal(paymentsEnabled(env), false);
    assert.equal(s.created.length + db.calls.length, 0);
  }
});

test('checkout: the PRICE comes from the pack table — a client amount / gems is ignored; the profile id rides in metadata', async () => {
  const db = fakeDb();
  const s = mockStripe();
  const r = await handleCheckout(checkoutReq({ pack: 'chest', secret: SECRET, amount: 1, cents: 1, gems: 999999, price: 1 }), { stripe: s, rpc: db.rpc, env: ENV, now: () => 1_700_000_000_000 });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).url, 'https://checkout.stripe.com/c/pay/cs_test_1');
  const { params, opts } = s.created[0];
  const chest = packById('chest');
  assert.equal(params.line_items.length, 1);
  assert.equal(params.line_items[0].price_data.unit_amount, chest.cents);
  assert.equal(params.line_items[0].price_data.currency, 'usd');
  assert.equal(params.mode, 'payment');
  assert.equal(params.client_reference_id, PID);
  assert.deepEqual(params.metadata, { taw: '1', profile_id: PID, pack: 'chest', gems: String(chest.gems), reservation: 'res-1' });
  assert.deepEqual(params.payment_intent_data.metadata, params.metadata, 'refund / dispute events can tell the charge is ours');
  assert.equal(params.customer_email, undefined, 'we never pass (or ask the player for) an email — Stripe collects the payer\'s');
  assert.equal(params.success_url, 'https://typeaword.com/?paid=1');
  assert.equal(params.cancel_url, 'https://typeaword.com/?paid=0');
  assert.equal(params.expires_at, 1_700_000_000 + 30 * 60);
  assert.equal(params.allow_promotion_codes, undefined);
  assert.equal(opts.idempotencyKey, 'taw-checkout-res-1');
  assert.deepEqual(db.calls[0], ['pay_reserve', { p_secret: SECRET, p_pack: 'chest', p_cents: chest.cents }]);
});

test('checkout: unknown pack / bad secret / bad body are 400s before the db', async () => {
  const db = fakeDb();
  const s = mockStripe();
  const cases = [[{ pack: 'free', secret: SECRET }, 'bad_pack'], [{ pack: '__proto__', secret: SECRET }, 'bad_pack'], [{ pack: 'pouch', secret: 'short' }, 'bad_secret'], [{ pack: 'pouch' }, 'bad_secret']];
  for (const [body, err] of cases) {
    const r = await handleCheckout(checkoutReq(body), { stripe: s, rpc: db.rpc, env: ENV });
    assert.equal(r.status, 400);
    assert.equal((await r.json()).error, err);
  }
  const raw = new Request('https://typeaword.com/api/checkout', { method: 'POST', body: '{not json' });
  assert.equal((await handleCheckout(raw, { stripe: s, rpc: db.rpc, env: ENV })).status, 400);
  assert.equal(db.calls.length + s.created.length, 0);
});

test('checkout: THE CAP — $20 a month, open checkouts count, a refused buy never reaches Stripe', async () => {
  const db = fakeDb();
  const s = mockStripe();
  const buy = (pack) => handleCheckout(checkoutReq({ pack, secret: SECRET }), { stripe: s, rpc: db.rpc, env: ENV });
  assert.equal((await buy('chest')).status, 200); // $9.99 open
  assert.equal((await buy('pile')).status, 200); //  $4.99 open → $14.98
  const over = await buy('chest'); //                 +$9.99 = $24.97 > $20
  assert.equal(over.status, 409);
  assert.deepEqual(await over.json(), { error: 'cap', spent_cents: 1498, cap_cents: 2000 });
  assert.equal(s.created.length, 2, 'the refused buy never reached Stripe');
});

test('checkout: the cap arithmetic exactly — 1498 + 499 fits (1997), then even the $1.99 pouch does not', async () => {
  const db = fakeDb();
  const s = mockStripe();
  const buy = (pack) => handleCheckout(checkoutReq({ pack, secret: SECRET }), { stripe: s, rpc: db.rpc, env: ENV });
  assert.equal((await buy('chest')).status, 200);
  assert.equal((await buy('pile')).status, 200);
  assert.equal((await buy('pile')).status, 200); // 1997
  assert.equal((await buy('pouch')).status, 409); // 2196
  assert.equal(s.created.length, 3);
  // the $19.99 hoard alone fills a month
  const db2 = fakeDb();
  const buy2 = (pack) => handleCheckout(checkoutReq({ pack, secret: SECRET }), { stripe: s, rpc: db2.rpc, env: ENV });
  assert.equal((await buy2('hoard')).status, 200);
  assert.equal((await buy2('pouch')).status, 409);
});

test('checkout: a released / failed checkout frees its share of the cap; no profile and flagged accounts are 403s', async () => {
  const db = fakeDb();
  const r = await handleCheckout(checkoutReq({ pack: 'hoard', secret: SECRET }), { stripe: mockStripe({ fail: true }), rpc: db.rpc, env: ENV });
  assert.equal(r.status, 502);
  assert.deepEqual(db.calls.map((c) => c[0]), ['pay_reserve', 'pay_release']);
  assert.equal((await handleCheckout(checkoutReq({ pack: 'hoard', secret: SECRET }), { stripe: mockStripe(), rpc: db.rpc, env: ENV })).status, 200);

  const nobody = await handleCheckout(checkoutReq({ pack: 'pouch', secret: 'b'.repeat(40) }), { stripe: mockStripe(), rpc: fakeDb().rpc, env: ENV });
  assert.equal(nobody.status, 403);
  assert.equal((await nobody.json()).error, 'no_profile');
  const flagged = await handleCheckout(checkoutReq({ pack: 'pouch', secret: SECRET }), { stripe: mockStripe(), rpc: fakeDb({ flagged: new Set([PID]) }).rpc, env: ENV });
  assert.equal(flagged.status, 403);
  assert.equal((await flagged.json()).error, 'flagged');
});

// ======================================================================================================= THE SIGNATURE
test('signature: a correctly signed raw body verifies; a tampered body, a wrong secret, a missing or stale header do not', async () => {
  const payload = JSON.stringify(completed());
  const good = stripe.webhooks.generateTestHeaderString({ payload, secret: WHSEC });
  assert.equal((await verifyEvent(stripe, payload, good, WHSEC)).type, 'checkout.session.completed');
  assert.equal(await verifyEvent(stripe, payload.replace('"pouch"', '"hoard"'), good, WHSEC), null, 'tampered body');
  assert.equal(await verifyEvent(stripe, payload, stripe.webhooks.generateTestHeaderString({ payload, secret: 'whsec_other' }), WHSEC), null, 'wrong secret');
  assert.equal(await verifyEvent(stripe, payload, '', WHSEC), null, 'no header');
  assert.equal(await verifyEvent(stripe, payload, good, ''), null, 'no secret configured');
  const stale = stripe.webhooks.generateTestHeaderString({ payload, secret: WHSEC, timestamp: Math.floor(Date.now() / 1000) - 3600 });
  assert.equal(await verifyEvent(stripe, payload, stale, WHSEC), null, 'replayed an hour later');
  // re-serialising the body breaks the signature: the handler must verify the RAW bytes
  const reser = JSON.stringify(JSON.parse(payload), null, 2);
  assert.equal(await verifyEvent(stripe, reser, good, WHSEC), null);
});

test('webhook: an unsigned / badly signed request is a 400 and grants nothing', async () => {
  const db = fakeDb();
  const unsigned = new Request('https://typeaword.com/api/stripe-webhook', { method: 'POST', body: JSON.stringify(completed()) });
  assert.equal((await handleWebhook(unsigned, { stripe, rpc: db.rpc, env: ENV })).status, 400);
  assert.equal((await handleWebhook(signedReq(completed(), 'whsec_attacker'), { stripe, rpc: db.rpc, env: ENV })).status, 400);
  assert.equal(db.calls.length, 0);
  assert.equal((await handleWebhook(signedReq(completed()), { stripe, rpc: db.rpc, env: {} })).status, 503, 'no webhook secret: refuse');
});

// ========================================================================================================= IDEMPOTENCY
test('webhook: a completed session grants the pack table\'s gems ONCE — a redelivery or a duplicate event grants nothing', async () => {
  const db = fakeDb();
  const r1 = await handleWebhook(signedReq(completed()), { stripe, rpc: db.rpc, env: ENV });
  assert.equal(r1.status, 200);
  assert.deepEqual(await r1.json(), { granted: true, duplicate: false });
  for (let i = 0; i < 3; i += 1) {
    const again = await handleWebhook(signedReq({ ...completed(), id: `evt_retry_${i}` }), { stripe, rpc: db.rpc, env: ENV });
    assert.deepEqual(await again.json(), { granted: false, duplicate: true });
  }
  // async_payment_succeeded for the same session is the same purchase
  const late = await handleWebhook(signedReq({ ...completed(), type: 'checkout.session.async_payment_succeeded' }), { stripe, rpc: db.rpc, env: ENV });
  assert.deepEqual(await late.json(), { granted: false, duplicate: true });
  assert.equal(db.net(), 600);
  assert.equal(db.purchases.size, 1);
  const grant = db.calls.find((c) => c[0] === 'pay_grant')[1];
  assert.deepEqual(grant, { p_session: 'cs_test_1', p_reservation: 'res-1', p_profile: PID, p_pack: 'pouch', p_gems: 600, p_cents: 199, p_currency: 'usd', p_payment_intent: 'pi_1' });
});

test('webhook: gems come from the pack table, never the metadata; a mismatched amount / unpaid / foreign session grants nothing', () => {
  assert.equal(grantArgs(completed({}, { gems: '999999' }).data.object).p_gems, 600);
  assert.equal(grantArgs(completed({ amount_total: 1 }).data.object), null, 'paid less than the pack');
  assert.equal(grantArgs(completed({ currency: 'eur' }).data.object), null);
  assert.equal(grantArgs(completed({ payment_status: 'unpaid' }).data.object), null);
  assert.equal(grantArgs(completed({ mode: 'subscription' }).data.object), null);
  assert.equal(grantArgs(completed({}, { taw: undefined }).data.object), null, 'not one of ours');
  assert.equal(grantArgs(completed({}, { pack: 'hoard' }).data.object), null, 'metadata pack ≠ amount');
  // Adaptive Pricing: the payer saw EUR, the source amount is still the pack's USD price
  const ap = grantArgs(completed({ currency: 'eur', amount_total: 185, currency_conversion: { amount_total: 199, source_currency: 'usd', fx_rate: '0.93' } }).data.object);
  assert.equal(ap && ap.p_gems, 600);
});

test('webhook: a db failure is a 500 (Stripe retries); the retry still grants exactly once', async () => {
  const db = fakeDb();
  let down = true;
  const flaky = async (fn, body) => { if (down) throw new Error('db down'); return db.rpc(fn, body); };
  assert.equal((await handleWebhook(signedReq(completed()), { stripe, rpc: flaky, env: ENV })).status, 500);
  down = false;
  assert.equal((await handleWebhook(signedReq(completed()), { stripe, rpc: flaky, env: ENV })).status, 200);
  assert.equal((await handleWebhook(signedReq(completed()), { stripe, rpc: flaky, env: ENV })).status, 200);
  assert.equal(db.net(), 600);
});

// ============================================================================================================== CLAWS
test('refund / dispute: claw the gems back pro rata, never twice; a dispute takes them all and flags the account', async () => {
  const db = fakeDb();
  await routeEvent(completed(), db.rpc);
  assert.equal(db.net(), 600);
  const refund = (amount_refunded) => ({ type: 'charge.refunded', data: { object: { id: 'ch_1', payment_intent: 'pi_1', amount: 199, amount_refunded, metadata: { taw: '1' } } } });
  await routeEvent(refund(100), db.rpc); // ~half → ceil(600 × 100/199) = 302
  assert.equal(db.net(), 600 - 302);
  await routeEvent(refund(100), db.rpc); // the same event again: nothing new owed
  assert.equal(db.net(), 600 - 302);
  await routeEvent(refund(199), db.rpc); // the rest
  assert.equal(db.net(), 0);
  await routeEvent(refund(199), db.rpc);
  assert.equal(db.net(), 0, 'never below what was granted');
  // dispute on a second purchase
  await routeEvent({ type: 'checkout.session.completed', data: { object: { ...completed().data.object, id: 'cs_test_2', payment_intent: 'pi_2' } } }, db.rpc);
  const out = await routeEvent({ type: 'charge.dispute.created', data: { object: { id: 'dp_1', charge: 'ch_2', payment_intent: 'pi_2', amount: 199 } } }, db.rpc);
  assert.deepEqual(out, { status: 200, body: { clawed: 600 } });
  assert.equal(db.net(), 0);
  assert.ok(db.flags.has(PID));
  // and the flagged account can't check out again
  const again = await handleCheckout(checkoutReq({ pack: 'pouch', secret: SECRET }), { stripe: mockStripe(), rpc: db.rpc, env: ENV });
  assert.equal(again.status, 403);
});

test('refund for a purchase not recorded yet: ours → 500 (retry until the grant lands); not ours → acknowledged', async () => {
  const db = fakeDb();
  const ev = (metadata) => ({ type: 'charge.refunded', data: { object: { payment_intent: 'pi_9', amount: 199, amount_refunded: 199, metadata } } });
  assert.equal((await routeEvent(ev({ taw: '1' }), db.rpc)).status, 500);
  assert.equal((await routeEvent(ev({}), db.rpc)).status, 200);
  assert.equal((await routeEvent({ type: 'customer.created', data: { object: {} } }, db.rpc)).status, 200);
});

test('an expired checkout releases its reservation', async () => {
  const db = fakeDb();
  await handleCheckout(checkoutReq({ pack: 'hoard', secret: SECRET }), { stripe: mockStripe(), rpc: db.rpc, env: ENV });
  await routeEvent({ type: 'checkout.session.expired', data: { object: { id: 'cs_x', metadata: { taw: '1', reservation: 'res-1' } } } }, db.rpc);
  assert.equal(db.reservations.get('res-1').state, 'released');
  assert.equal((await handleCheckout(checkoutReq({ pack: 'pouch', secret: SECRET }), { stripe: mockStripe(), rpc: db.rpc, env: ENV })).status, 200);
});

test('serviceRpc: the service key rides on apikey (+ Bearer for a legacy JWT key); missing env → null', async () => {
  assert.equal(serviceRpc({}), null);
  assert.equal(serviceRpc({ SUPABASE_URL: 'https://x.supabase.co' }), null);
  const seen = [];
  const fake = async (url, init) => { seen.push([url, init]); return new Response('{"ok":true}', { status: 200 }); };
  await serviceRpc({ VITE_SUPABASE_URL: 'https://x.supabase.co/rest/v1/', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_abc' }, fake)('pay_grant', { a: 1 });
  assert.equal(seen[0][0], 'https://x.supabase.co/rest/v1/rpc/pay_grant');
  assert.equal(seen[0][1].headers.apikey, 'sb_secret_abc');
  assert.equal(seen[0][1].headers.Authorization, undefined);
  await serviceRpc({ SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOi.x.y' }, fake)('pay_claw', {});
  assert.equal(seen[1][1].headers.Authorization, 'Bearer eyJhbGciOi.x.y');
  const failing = async () => new Response('{"message":"permission denied"}', { status: 401 });
  await assert.rejects(serviceRpc({ SUPABASE_URL: 'https://x', SUPABASE_SERVICE_ROLE_KEY: 'k' }, failing)('pay_grant', {}), /401/);
});
