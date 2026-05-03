# stripe-worker — Cloudflare Worker for Stripe billing

A small, stateless Cloudflare Worker that mediates between a static
front-end (e.g. GitHub Pages) and Stripe. It issues short-lived JWTs after
a verified Stripe Checkout, validates webhook signatures, and stores
subscription state in a single KV namespace.

This worker is intentionally portable. Drop the directory into another
project, change the names in `wrangler.toml`, and the same five endpoints
will work unchanged.

---

## Architecture

```
Browser  ─────────────────────►  Cloudflare Worker  ─────────►  Stripe
   │  /api/checkout (priceId)         (this code)              (Checkout / Portal)
   │  /api/verify   (sessionId) ────► verify session ─────► JWT (30 d)
   │  /api/me       (Bearer)         validate JWT
   │  /api/portal   (Bearer)    ────► create portal session
   │                                  ◄──── webhooks ─────  Stripe events
   ▼                                  KV: customer / user / verified
localStorage session
   { tier, userId, token, expiresAt, featureOverrides }
```

The browser never talks to Stripe directly except for the Checkout/Portal
redirects. The server is the only thing that holds Stripe secrets.

### Endpoints

| Method | Path             | Purpose                                          | Auth                    |
| ------ | ---------------- | ------------------------------------------------ | ----------------------- |
| POST   | `/api/checkout`  | Create a Stripe Checkout Session                 | None (priceId allowlist)|
| POST   | `/api/verify`    | Validate finished Checkout, issue JWT            | None (sessionId)        |
| GET    | `/api/me`        | Validate Bearer JWT, return current tier         | Bearer token            |
| POST   | `/api/portal`    | Create a Stripe Customer Portal session          | Bearer token            |
| POST   | `/api/webhooks`  | Receive Stripe webhook events                    | `Stripe-Signature`      |

### Webhook events handled

- `customer.subscription.updated` — sync tier on plan change
- `customer.subscription.deleted` — downgrade to free
- `invoice.payment_succeeded` — re-sync after renewal

Other events return 200 (Stripe convention) and are ignored.

### KV schema (binding `SUBSCRIPTIONS`)

| Key                       | Value                              | TTL      |
| ------------------------- | ---------------------------------- | -------- |
| `customer:{customerId}`   | `{ subscriptionId, tier, status }` | none     |
| `user:{userId}`           | `{ customerId, tier }`             | none     |
| `verified:{sessionId}`    | `1` (idempotency guard)            | 24 hours |

---

## Prerequisites

- A [Stripe](https://stripe.com) account (test mode is fine to start)
- A [Cloudflare](https://dash.cloudflare.com) account
- Node 18+ and `wrangler` CLI: `npm install -g wrangler`

---

## One-time Stripe setup

1. **Create products + prices** — Stripe Dashboard → Products. For each plan
   create one product with a recurring price (monthly and/or yearly). Copy
   the price IDs (`price_…`); they go into worker secrets later.
2. **Configure the Customer Portal** — Stripe Dashboard → Settings → Billing
   → Customer portal. Enable "Cancel subscriptions" and "Switch plans" for
   the products you just created.
3. **Register the webhook endpoint** — *after* the worker is deployed (see
   below), create a webhook in Stripe Dashboard → Developers → Webhooks
   pointing to `https://<your-worker>.workers.dev/api/webhooks`. Subscribe
   to:
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed` (received but currently a no-op; subscribe so
     Stripe stops complaining)

   Copy the signing secret (`whsec_…`).

---

## Cloudflare setup

1. **Create a KV namespace**

   ```sh
   cd stripe-worker
   npm install
   wrangler kv:namespace create SUBSCRIPTIONS
   ```

   Paste the returned ID into `wrangler.toml` under `[[kv_namespaces]]`.

2. **Set the public vars** in `wrangler.toml`:

   ```toml
   [vars]
   APP_URL            = "https://your-site.example.com"   # no trailing slash
   STRIPE_API_VERSION = "2025-04-30"
   ```

   `APP_URL` is used for CORS and validating return URLs.

3. **Set the secrets** (one command per secret):

   ```sh
   wrangler secret put STRIPE_SECRET_KEY      # sk_test_... or sk_live_...
   wrangler secret put STRIPE_WEBHOOK_SECRET  # whsec_... (from step 3 above; can set after first deploy)
   wrangler secret put JWT_SECRET             # 32+ random chars; openssl rand -hex 32
   wrangler secret put PRICE_PRO_MONTHLY      # price_1ABC...
   wrangler secret put PRICE_PRO_YEARLY       # price_1XYZ... (or empty)
   ```

4. **Deploy**

   ```sh
   wrangler deploy
   ```

   Wrangler prints the public URL. Register that URL with Stripe (step 3 of
   "One-time Stripe setup") and put it into the front-end at
   `payments/config.js → STRIPE_CONFIG.workerUrl`.

---

## Smoke test

```sh
# Should respond with 405 (POST-only) — proves routing works:
curl -i https://<worker>.workers.dev/api/checkout

# Use a Stripe test card: 4242 4242 4242 4242 / any future date / any CVC.
# After checkout, verify a session:
curl -X POST https://<worker>.workers.dev/api/verify \
  -H 'content-type: application/json' \
  -d '{"sessionId":"cs_test_..."}'
```

---

## Local testing

Run the worker locally and forward Stripe webhooks to it with the Stripe CLI:

```sh
# Terminal 1
wrangler dev

# Terminal 2
stripe listen --forward-to http://127.0.0.1:8787/api/webhooks
```

The CLI prints a `whsec_…` for the listener — set that as
`STRIPE_WEBHOOK_SECRET` for the local run only (`wrangler secret put` in dev,
or use `.dev.vars`).

---

## Troubleshooting

- **400 from `/api/webhooks`** — signature check failed. Confirm
  `STRIPE_WEBHOOK_SECRET` matches the endpoint you registered. The worker
  also rejects events older than 5 minutes; check your machine clock if
  using `stripe listen`.
- **`/api/me` returns 401** — JWT expired (30 day TTL) or `JWT_SECRET`
  changed since the token was issued. Have the front-end re-run the verify
  flow or sign out.
- **Checkout creates session but tier never updates** — Stripe webhook isn't
  reaching the worker. Check Stripe Dashboard → Webhooks → recent deliveries
  for 4xx/5xx responses.
- **CORS error from the browser** — `APP_URL` doesn't match the page
  origin. Update `wrangler.toml` and redeploy.

---

## Related front-end files

| File                     | Role                                                          |
| ------------------------ | ------------------------------------------------------------- |
| `payments/config.js`     | `STRIPE_CONFIG` (publishable key, worker URL, price IDs)      |
| `payments/stripe.js`     | Browser-side checkout + portal flow, `?stripe_session=` handler |
| `payments/session.js`    | localStorage token cache + `refreshFromServer()`              |
| `payments/access.js`     | Tier + per-feature gating used everywhere in the app          |

For a generic, project-agnostic walkthrough see
[`STRIPE_INTEGRATION.md`](../STRIPE_INTEGRATION.md) at the repo root.
