# PAID GEMS — switch-on checklist (for Andy + the parent/guardian)

The code is merged-ready and **OFF**. Nothing charges anyone until every step below is done and the flag is flipped.
Claude did **not** create any account and never will — every account step is the guardian's.

What it does: the shop gets a **GEMS** shelf (4 packs, $1.99 / $4.99 / $9.99 / $19.99). A tap → a confirm step → Stripe
Checkout (Stripe collects the **payer's** email + card — we never ask the player for an email) → back to the menu, where
the bought gems fly into the gem pill. Bought gems are ordinary gems: rolls, boosts, sealed rolls, at the **same server
odds** as earned gems (082 adds net paid gems to the server's roll budget).

Pieces: `api/checkout.js`, `api/stripe-webhook.js` (logic in `api/_lib/pay.js`), `src/payments/` (pack table, flag,
client), `src/components/PaidGemsShelf.jsx`, SQL `claude/082_paid_gems.sql` (= `supabase/migrations/082_paid_gems.sql`).

---

## 1. The guardian creates the Stripe account (Andy cannot own it under 18)

1. Go to <https://dashboard.stripe.com/register> and sign up **in the guardian's own name** (Stripe's rule: an under-18
   needs a legal guardian as the account owner before any charge or payout). They will need their legal name, date of
   birth, address, the last 4 of their SSN (US), and a bank account for payouts.
2. Business details: individual / sole proprietor; product description e.g. *"Virtual gems for TYPE A WORD, a free browser
   word game (typeaword.com)"*; website `https://typeaword.com`.
3. **Settings → Public details**: set a **support email** (it is printed on every receipt — the shelf tells players to
   "reply to the Stripe receipt" for refunds) and the statement descriptor (e.g. `TYPEAWORD GEMS`).
4. **Settings → Emails**: turn on *Successful payments* receipts (that is the refund channel) and *Refunds*.
5. Note: Stripe lists in-game currency as a restricted business unless you operate the game — say so plainly in the
   description. If Stripe asks, the answer is: we run the game, gems never leave it, no cash-out.

## 1b. SIGN IN WITH GOOGLE (required to buy; optional to play) — do this BEFORE step 2

Buying gems needs a Google account linked to the player's board name (085): the purchase is tied to that account on the
server, and the same account restores the progress on any new device. Playing never needs it.

1. **Google Cloud Console** (console.cloud.google.com) → create a project (e.g. "Type A Word") →
   **APIs & Services → OAuth consent screen**: External, app name **Type A Word**, support email, logo optional,
   scopes: the default `openid`, `email`, `profile` only. Publish the app (Testing mode only lets listed test users in).
2. **APIs & Services → Credentials → Create credentials → OAuth client ID** → type **Web application**:
   * Authorized JavaScript origins: `https://typeaword.com`
   * Authorized redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback` (Supabase shows the exact one
     on the Google provider page). Copy the **Client ID** and **Client secret**.
3. **Supabase → Authentication → Sign In / Providers → Google**: turn it ON, paste the Client ID + Client secret, save.
   **Turn OFF the other ways in** (security review nov4): Authentication → Sign In / Providers → **Email**: disable it
   (or at least "Allow new users to sign up" off), and **Allow anonymous sign-ins: OFF**. An email or anonymous
   session would be an `authenticated` user too; 086 + the checkout refuse anything that isn't Google, but there is no
   reason to let one exist. PKCE needs no setting — the game sends the challenge itself.
4. **Supabase → Authentication → URL Configuration**:
   * Site URL: `https://typeaword.com`
   * Redirect URLs (add EXACTLY these, nothing broader): `https://typeaword.com/**`, `http://localhost:5173/**`,
     `http://localhost:4173/**`, and — only if you want to sign in on previews — THIS project's preview pattern
     `https://wordarcade-frontend-*-beenchilling.vercel.app/**`.
   * **NEVER `https://*.vercel.app/**`** (security review nov4, HIGH 1): anyone can deploy `something.vercel.app`; with
     that on the list, a sign-in link crafted to land there hands that site the player's Google session, and with it
     their board row. The `-beenchilling` suffix is our Vercel team's own, so nobody else can mint a preview under it.
5. Run **085_google_signin.sql** after 082 / 084, then **086_pay_auth_hardening.sql** (the security review's server
   fixes: Google-only, unlink revokes devices, cap + dispute flag per Google account, refunds by share), then
   `notify pgrst, 'reload schema';`
6. Check: Settings → SAVE CODE → **SIGN IN WITH GOOGLE** → pick an account → back on the menu a stamp says
   "SIGNED IN · SAVED TO YOUR GOOGLE ACCOUNT". On a second browser, sign in with the same account → it asks
   "LOAD YOUR PROGRESS?" (or loads straight away on a fresh browser) and comes back as the same name and level.

7. **LAST — switch it on:** Vercel → Settings → Environment Variables → add `VITE_GOOGLE_ON` = `1` (Production +
   Preview), then redeploy. Until then the game shows no sign-in button anywhere and ignores a sign-in landing, so it can
   ship dark before steps 1–5 are done. (Turn this on BEFORE `VITE_PAYMENTS_ON`: buying needs a signed-in account.)

What is stored: only the Supabase auth user id and which board name it is linked to (`private.auth_links`). The email
Google returns stays inside Supabase Auth; the game shows it only to the signed-in player, in their own Settings, on
their own device. No new env var is needed — the checkout function checks the session with the existing
`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (set them for **Production + Preview** if they aren't already).

## 2. Run the SQL (Supabase SQL editor)

Run `claude/082_paid_gems.sql` once, after every earlier migration, THEN `claude/085_google_signin.sql` and `claude/086_pay_auth_hardening.sql` (section 1b — buying needs
it: until 085 runs, every checkout is refused). Each ends with `notify pgrst, 'reload schema';` (run it once more after 085).
It creates the purchases table (one row per Stripe checkout session — the idempotency key), the paid-gems ledger,
reservations (the monthly cap), flags (disputed accounts), the service-role-only `pay_reserve / pay_release / pay_grant /
pay_claw`, the player's `pay_gems_pending / pay_gems_ack`, and re-declares `private.gem_budget` (036, unchanged) **+ net
paid gems**. Until it runs, the shelf shows "$20.00 LEFT" and checkout fails with `db` (harmless).

## 3. Vercel environment variables (Project → Settings → Environment Variables)

Set for **Preview** first (test mode), then **Production** (live mode) at switch-on time:

| Variable | Value | Where it comes from |
|---|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_…` (Preview) / `sk_live_…` (Production) | Stripe → Developers → API keys. **Never** commit it, never prefix it with `VITE_`. A restricted key works too: Checkout Sessions *write*, everything else none. |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` | Step 4 (one per endpoint — test and live have different secrets) |
| `SUPABASE_SERVICE_ROLE_KEY` | the service role key (`eyJ…`) or a new secret key (`sb_secret_…`) | Supabase → Project Settings → API keys. Server-only — never `VITE_`. |
| `SUPABASE_URL` | optional — falls back to the existing `VITE_SUPABASE_URL` | |
| `PUBLIC_SITE_URL` | `https://typeaword.com` (Production only) | optional; without it Stripe returns to the deployment's own origin |
| `VITE_REFUND_EMAIL` | optional, e.g. the guardian's support email | printed on the shelf's refund line next to "reply to the Stripe receipt" |
| `VITE_PAYMENTS_ON` | `1` — **LAST**, see step 6 | turns on the shelf (build-time) **and** the checkout endpoint |

`VITE_` variables are baked in at build time — after changing one, **redeploy**.

## 4. The webhook endpoint (Stripe → Developers → Webhooks → Add endpoint)

- URL: `https://typeaword.com/api/stripe-webhook` (for preview testing: the preview deployment's URL +
  `/api/stripe-webhook` — Vercel Deployment Protection must allow it, or test with the Stripe CLI, below).
- Events — exactly these five:
  `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`,
  `charge.refunded`, `charge.dispute.created`.
- Copy the endpoint's **Signing secret** (`whsec_…`) into `STRIPE_WEBHOOK_SECRET`.
- Sanity check: `curl -X POST https://<host>/api/stripe-webhook -d '{}'` must answer **400 `bad_signature`**
  (503 `not_configured` = the secret is missing).

## 5. Products / Prices — nothing to create

The checkout uses inline `price_data` from `src/payments/packs.js`: the **server's** table sets every amount, and no
Stripe Product/Price needs to be kept in sync. Changing a price = editing that file + a deploy (and the webhook checks
the charged amount against the same table, so a mismatch never grants gems). Adaptive Pricing (local currencies) is fine:
the webhook reads the USD source amount.

## 6. Test in TEST mode, then flip the flag

1. Preview env: `sk_test_…`, the test `whsec_…`, service key, `VITE_PAYMENTS_ON=1`. Redeploy the preview.
2. On the preview: pick a board name (the gems land on the board profile), tap the **+** beside the gem count, buy the $1.99 pouch.
   Test card `4242 4242 4242 4242`, any future date, any CVC, any ZIP, any email.
   Also try: `4000 0025 0000 3155` (3-D Secure), `4000 0000 0000 9995` (declined → no gems).
3. Back on the menu: 600 gems fly into the pill within a few seconds. In Supabase: one row in
   `private.pay_purchases`, one `+300` row in `private.pay_gem_ledger` with `delivered_at` set.
4. Stripe → Payments → the payment → **Refund**: the next menu load takes the gems back (never below 0 on the device).
5. Cap: buy until $20 this month — the next pack is greyed out and the server answers 409 `cap`.
6. Disputes: test card `4000 0000 0000 0259` creates a dispute → gems clawed, account flagged (no more purchases).
7. Optional, no public URL needed: `stripe listen --forward-to localhost:3000/api/stripe-webhook` with `vercel dev`.
8. When all of that works: Production env gets the **live** keys + live `whsec_…`, then `VITE_PAYMENTS_ON=1`, then
   redeploy production. To switch off: remove `VITE_PAYMENTS_ON` and redeploy (the webhook keeps working, so refunds
   and disputes still claw).

## Decisions baked in (change only on purpose)

- **Clawback floors at 0 on the device; the debt stays on the server.** A refund/dispute takes the gems off the balance,
  never below 0. Gems already spent are recovered through the server's roll budget (`gem_budget` counts NET paid gems), so
  server rolls / sealed tickets stay refused until the player has earned that much again. A partial refund claws
  `ceil(gems × refunded / paid)`; claws never repeat.
- **$20 per board profile per calendar month (New York time)**, enforced in `pay_reserve` under a per-profile lock.
  Refunded purchases still count toward the month, and an open checkout reserves its amount for 35 minutes.
- **One grant per Stripe checkout session** (`pay_purchases.stripe_session_id` primary key); retries are safe.
- **Disputed accounts are flagged** (no more checkouts). Unflag by deleting the row in `private.pay_flags`.
- **No countdowns, sales or "limited" offers.** The shelf prints the dollar price on every pack, "ASK A PARENT FIRST",
  what is left of the month's $20, ODDS (the same table the roll uses), and the refund line.
- Refund policy (recommended by the brief): refund any minor's purchase on request, no questions; refund anything
  within 14 days. Refund in the Stripe dashboard — the webhook does the rest.
- A **RESET ACCOUNT** wipes local gems (bought ones too); the purchase records stay on the server.

## ART REQUEST (open)

The packs wear existing art for now: `/wheel/prize-gems-s.webp` (POUCH), `/wheel/prize-gems-m.webp` (PILE),
`/wheel/prize-gems-l.webp` (CHEST), `/shop/chest-v2.webp` (HOARD), and the tab uses the small pile. Wanted: four painted
**gem piles** growing in size (a handful → a heap → an open chest → an overflowing vault), the cyan gem of the GEMS
pill, same ink weight as the wheel prizes, 512×512 transparent webp, ONE pile per image (ChatGPT). New filenames
only (art is immutable-cached): e.g. `public/shop/pay-pouch-v1.webp` … then `node scripts/art-manifest.mjs`.

## Money reality (from the brief)

Expect ~0.2–1% of monthly players to pay once, ~$5 → for 5,000 monthly players roughly $50–250/month gross. Stripe takes
2.9% + 30¢ per charge (the 30¢ is 15% of a $1.99 pouch). The guardian is responsible for taxes on the income (Stripe
issues a 1099-K above the reporting threshold). Not legal advice — see the brief's COPPA / FTC (Genshin) / EU notes:
paid gems buying random rolls is what regulators call a paid loot box; it is legal in the US with odds shown, but
illegal in Belgium.
