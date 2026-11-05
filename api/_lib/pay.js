// api/_lib/pay.js — the server half of PAID GEMS (Stripe Checkout + webhook). The `_lib` folder is not a route
// (Vercel skips `_`-prefixed paths under api/); api/checkout.js and api/stripe-webhook.js are thin wrappers around
// the two handlers here. Everything is INJECTED (stripe, the Supabase RPC caller, env, clock), so the unit tests
// (src/payments/payServer.test.js) drive the real logic with a mocked Stripe and a fake database.
//
// TRUST: the client sends { pack, secret, access } and nothing else (access = its SIGN IN WITH GOOGLE session; 085 — a
// purchase needs a Google account linked to the secret's board row, checked here against /auth/v1/user and in SQL). The price comes from src/payments/packs.js; the board
// profile comes from the secret (082 pay_reserve, service role). Gems are granted ONLY by the signature-verified
// webhook, once per checkout session (082 pay_grant: purchases.stripe_session_id is the primary key).
import { packById, PAY_CURRENCY } from '../../src/payments/packs.js';

const SECRET_RE = /^[0-9a-f]{32,128}$/;
// Stripe's minimum expires_at is 30 min out. The 082 reservation lives 35 min, so it always outlives its session.
export const SESSION_MINUTES = 30;

/** Payments are switched on for the server only with the flag AND a Stripe key (the flag alone does nothing). */
export function paymentsEnabled(env = process.env) {
  return env.VITE_PAYMENTS_ON === '1' && !!env.STRIPE_SECRET_KEY;
}

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

/** SIGN IN WITH GOOGLE (085): the Supabase Auth user behind an access token -> { id } | null (expired / forged / signed
 *  out). Asked of Supabase itself, never decoded locally, so a token is only as good as Supabase says it is. */
export function verifyAuthUser(env = process.env, fetchImpl = globalThis.fetch) {
  const raw = env.SUPABASE_URL || env.VITE_SUPABASE_URL || '';
  // the ANON key only (086 review LOW 4): this call needs nothing more, and a service key never rides beside a user token
  const key = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || '';
  const base = raw.replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
  return async (access) => {
    if (!base || !key || typeof access !== 'string' || access.length < 20 || access.length > 4096) return null;
    const r = await fetchImpl(`${base}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${access}` } });
    if (!r.ok) return null;
    const u = await r.json().catch(() => null);
    if (!u || typeof u.id !== 'string') return null;
    // 086: a real Google sign-in only — an email / anonymous Supabase session can't buy
    const provider = (u.app_metadata && u.app_metadata.provider) || '';
    return { id: u.id, google: provider === 'google' && u.is_anonymous !== true };
  };
}

/** A service-role PostgREST RPC caller: (fn, body) -> parsed JSON; throws on a non-2xx (the webhook then 500s and
 *  Stripe retries). Works with the legacy service_role JWT and the new sb_secret_ keys (apikey header). */
export function serviceRpc(env = process.env, fetchImpl = globalThis.fetch) {
  const raw = env.SUPABASE_URL || env.VITE_SUPABASE_URL || '';
  const key = env.SUPABASE_SERVICE_ROLE_KEY || '';
  const base = raw.replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
  if (!base || !key) return null;
  return async (fn, body) => {
    const headers = { apikey: key, 'Content-Type': 'application/json' };
    if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`; // a legacy JWT key; sb_secret_ keys ride on apikey alone
    const r = await fetchImpl(`${base}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(body) });
    const text = await r.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!r.ok) {
      const err = new Error(`rpc ${fn} ${r.status}: ${(data && data.message) || text}`);
      err.status = r.status;
      throw err;
    }
    return data;
  };
}

/** The site origin the Stripe pages return to: the deployment's own origin (never a client-supplied URL), or
 *  PUBLIC_SITE_URL when set (production: https://typeaword.com). */
export function siteOrigin(request, env = process.env) {
  if (env.PUBLIC_SITE_URL) return env.PUBLIC_SITE_URL.replace(/\/+$/, '');
  return new URL(request.url).origin;
}

// ------------------------------------------------------------------------------------------------- POST /api/checkout
/**
 * Body { pack, secret } -> { url } (the Stripe Checkout page) | { error }.
 *   404 off · 400 bad_pack / bad_secret / bad_body · 401 sign_in · 403 no_profile / not_linked / flagged · 409 cap ·
 *   502 stripe/db/auth trouble
 */
export async function handleCheckout(request, { stripe, rpc, env = process.env, now = Date.now, authUser = verifyAuthUser(env) } = {}) {
  if (!paymentsEnabled(env) || !stripe || !rpc) return json(404, { error: 'off' });
  let body;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: 'bad_body' });
  }
  const pack = packById(body && body.pack);
  if (!pack) return json(400, { error: 'bad_pack' });
  const secret = body && typeof body.secret === 'string' ? body.secret.toLowerCase() : '';
  if (!SECRET_RE.test(secret)) return json(400, { error: 'bad_secret' });
  // 085: REQUIRED TO BUY — a live Google session, its user linked to this board row (pay_reserve checks the link)
  const access = body && typeof body.access === 'string' ? body.access : '';
  if (!access) return json(401, { error: 'sign_in' });
  let user = null;
  try { user = await authUser(access); } catch { return json(502, { error: 'auth' }); }
  if (!user || !user.id) return json(401, { error: 'sign_in' });
  if (!user.google) return json(403, { error: 'google_only' });

  // THE CAP + the profile, in one locked step (082 pay_reserve): this month's purchases + open checkouts + this one
  let res;
  try {
    res = await rpc('pay_reserve', { p_secret: secret, p_pack: pack.id, p_cents: pack.cents, p_auth_uid: user.id });
  } catch {
    return json(502, { error: 'db' });
  }
  if (!res || !res.ok) {
    const reason = (res && res.reason) || 'db';
    const status = reason === 'cap' ? 409 : reason === 'sign_in' ? 401 : reason === 'no_profile' || reason === 'flagged' || reason === 'not_linked' ? 403 : 502;
    return json(status, { error: reason, spent_cents: res && res.spent_cents, cap_cents: res && res.cap_cents });
  }

  const origin = siteOrigin(request, env);
  const meta = { taw: '1', profile_id: String(res.profile_id), pack: pack.id, gems: String(pack.gems), reservation: String(res.reservation) };
  // The amount rides INLINE (price_data) from the pack table: no Stripe Products/Prices to keep in sync, and nothing
  // the client says can change it.
  const lineItem = { price_data: { currency: PAY_CURRENCY, unit_amount: pack.cents, product_data: { name: `${pack.gems} gems — ${pack.name.toLowerCase()} (TYPE A WORD)` } }, quantity: 1 };
  try {
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        // No payment_method_types: Stripe's API refuses it on Checkout now (methods are set in the Dashboard). Keep delayed
        // methods OFF there: they would settle after the 35-min reservation.
        line_items: [lineItem],
        // Stripe Checkout always asks the PAYER for their email (the parent's); we never ask the player for one
        client_reference_id: String(res.profile_id),
        metadata: meta,
        payment_intent_data: { metadata: meta, description: `TYPE A WORD — ${pack.gems} gems` },
        submit_type: 'pay',
        expires_at: Math.floor(now() / 1000) + SESSION_MINUTES * 60,
        success_url: `${origin}/?paid=1`,
        cancel_url: `${origin}/?paid=0`,
      },
      { idempotencyKey: `taw-checkout-${res.reservation}` },
    );
    return json(200, { url: session.url });
  } catch {
    try { await rpc('pay_release', { p_reservation: res.reservation }); } catch { /* it expires on its own */ }
    return json(502, { error: 'stripe' });
  }
}

// ------------------------------------------------------------------------------------------ POST /api/stripe-webhook
/** Verify Stripe's signature over the RAW body. -> the event, or null (a bad / missing / stale signature). */
export async function verifyEvent(stripe, rawBody, signature, secret) {
  if (!stripe || !secret || !signature || typeof rawBody !== 'string') return null;
  try {
    return await stripe.webhooks.constructEventAsync(rawBody, signature, secret);
  } catch {
    return null;
  }
}

/** A completed session -> the grant arguments, or null when it is not ours / not paid / does not match the pack table. */
export function grantArgs(session) {
  if (!session || session.mode !== 'payment' || session.payment_status !== 'paid') return null;
  const m = session.metadata || {};
  const pack = packById(m.pack);
  if (!pack || m.taw !== '1' || !m.profile_id) return null;
  // the amount actually charged must be the pack's (a tampered or mis-configured Price never buys more gems)
  // (Adaptive Pricing shows the payer a local currency; the session then keeps the source amount in currency_conversion)
  const cc = session.currency_conversion;
  const total = cc && Number.isFinite(cc.amount_total) ? cc.amount_total : session.amount_total;
  const cur = String((cc && cc.source_currency) || session.currency || '').toLowerCase();
  if (total !== pack.cents || cur !== PAY_CURRENCY) return null;
  return {
    p_session: session.id,
    p_reservation: m.reservation || null,
    p_profile: m.profile_id,
    p_pack: pack.id,
    p_gems: pack.gems,
    p_cents: pack.cents,
    p_currency: PAY_CURRENCY,
    p_payment_intent: typeof session.payment_intent === 'string' ? session.payment_intent : (session.payment_intent && session.payment_intent.id) || null,
  };
}

const piOf = (x) => (typeof x === 'string' ? x : (x && x.id) || null);

/**
 * The event router (after verification). -> { status, body }. A database failure is a 500, so Stripe retries the
 * event (every RPC here is idempotent: a retry never grants or claws twice).
 */
export async function routeEvent(event, rpc) {
  const o = (event && event.data && event.data.object) || {};
  switch (event && event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      const args = grantArgs(o);
      if (!args) {
        // an unpaid (async) completion waits for async_payment_succeeded; anything not ours is acknowledged and ignored
        return { status: 200, body: { ignored: o.payment_status !== 'paid' ? 'unpaid' : 'not_ours' } };
      }
      const r = await rpc('pay_grant', args);
      return { status: 200, body: { granted: !!(r && r.granted), duplicate: !!(r && r.duplicate) } };
    }
    case 'checkout.session.expired': {
      const m = o.metadata || {};
      if (m.taw === '1' && m.reservation) await rpc('pay_release', { p_reservation: m.reservation });
      return { status: 200, body: { released: true } };
    }
    case 'charge.refunded': {
      const pi = piOf(o.payment_intent);
      if (!pi) return { status: 200, body: { ignored: 'no_payment_intent' } };
      // 086 (Adaptive Pricing): amount / amount_refunded are in the PAYER's currency — send the refunded SHARE (that
      // currency cancels out); pay_claw2 scales it onto the purchase's USD amount. A fully refunded charge is 1.
      const amt = Number(o.amount) || 0;
      const ratio = o.refunded === true ? 1 : amt > 0 ? Math.min(1, Math.max(0, (Number(o.amount_refunded) || 0) / amt)) : 0;
      const r = await rpc('pay_claw2', { p_payment_intent: pi, p_ratio: ratio, p_reason: 'refund' });
      return notFoundOr(r, o);
    }
    case 'charge.dispute.created': {
      const pi = piOf(o.payment_intent);
      if (!pi) return { status: 200, body: { ignored: 'no_payment_intent' } };
      const r = await rpc('pay_claw2', { p_payment_intent: pi, p_ratio: null, p_reason: 'dispute' }); // 086: also flags the Google account
      return notFoundOr(r, o);
    }
    default:
      return { status: 200, body: { ignored: (event && event.type) || 'unknown' } };
  }
}
// A claw for a payment we have no purchase for: if it is ours (metadata taw=1) the grant has not landed yet, so 500 and
// let Stripe retry; anything else on the account is acknowledged.
function notFoundOr(r, o) {
  if (r && r.found === false) {
    const ours = o.metadata && o.metadata.taw === '1';
    return ours ? { status: 500, body: { error: 'purchase_not_found_yet' } } : { status: 200, body: { ignored: 'not_ours' } };
  }
  return { status: 200, body: { clawed: (r && r.clawed) || 0 } };
}

export async function handleWebhook(request, { stripe, rpc, env = process.env } = {}) {
  const secret = env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return json(503, { error: 'not_configured' });
  const raw = await request.text(); // the RAW body: the signature is over these exact bytes (never re-serialise)
  const event = await verifyEvent(stripe, raw, request.headers.get('stripe-signature'), secret);
  if (!event) return json(400, { error: 'bad_signature' });
  if (!rpc) return json(500, { error: 'db_not_configured' }); // Stripe retries until SUPABASE_SERVICE_ROLE_KEY is set
  try {
    const out = await routeEvent(event, rpc);
    return json(out.status, out.body);
  } catch {
    return json(500, { error: 'db' });
  }
}
