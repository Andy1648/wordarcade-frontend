// api/stripe-webhook.js — Stripe -> us. Verifies the signature over the RAW body (STRIPE_WEBHOOK_SECRET), then:
//   checkout.session.completed / async_payment_succeeded -> pay_grant (once per session id)
//   checkout.session.expired -> pay_release (frees the monthly-cap reservation)
//   charge.refunded / charge.dispute.created -> pay_claw (the gems come back off; a dispute also flags the account)
// Not behind the flag: refunds and disputes must still claw after payments are switched off. Logic: api/_lib/pay.js.
import Stripe from 'stripe';
import { handleWebhook, serviceRpc } from './_lib/pay.js';

let stripe = null;
export async function POST(request) {
  // the client is only used to verify signatures here (no API call), but it still needs a key to construct
  if (!stripe && process.env.STRIPE_SECRET_KEY) stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  return handleWebhook(request, { stripe, rpc: serviceRpc() });
}
