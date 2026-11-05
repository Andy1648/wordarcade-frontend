// api/checkout.js — POST { pack, secret } -> { url }: a Stripe Checkout Session for one GEM PACK (paid gems, 082).
// OFF unless VITE_PAYMENTS_ON=1 and STRIPE_SECRET_KEY are both set (a 404 otherwise). The logic is api/_lib/pay.js.
// Setup: claude/payments-setup.md.
import Stripe from 'stripe';
import { handleCheckout, paymentsEnabled, serviceRpc } from './_lib/pay.js';

let stripe = null;
export async function POST(request) {
  if (paymentsEnabled() && !stripe) stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  return handleCheckout(request, { stripe, rpc: serviceRpc() });
}
