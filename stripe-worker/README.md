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
| POST   | `/api/identity`  | Issue (or re-issue) a signed anonymous-user token| None (rate-limited per IP)|
| POST   | `/api/checkout`  | Create a Stripe Checkout Session                 | Bearer token (userId taken from it; mismatch -> 403) |
| POST   | `/api/verify`    | Validate finished Checkout, issue JWT            | None (sessionId)        |
| GET    | `/api/me`        | Validate Bearer JWT, return current tier         | Bearer token            |
| POST   | `/api/portal`    | Create a Stripe Customer Portal session          | Bearer token            |
| POST   | `/api/export-count` | Count one PDF export; 429 over the free monthly cap | Bearer token         |
| GET    | `/api/export-count` | Read this month's count (no increment)        | Bearer token            |
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
| `exports:{userId}:{YYYY-MM}` | `{ count }` (free-tier exports) | ~40 days |
| `idrl:{sha256(ip)}:{YYYY-MM-DD}` | `{ count }` (identity rate limit) | 2 days |

### Identity and export limits

- **Identity.** The browser calls `POST /api/identity` once and stores the
  returned signed token (`userId: anon:<uuid>`, tier `free`, 1-year expiry).
  `/api/checkout` derives the user id from that verified token only; a
  client-supplied `userId` that differs is rejected with 403, and requests
  without a valid token get 401. After purchase `/api/verify` re-issues a
  token for the same `userId` with the paid tier.
- **Monthly exports.** `POST /api/export-count` increments a KV counter for
  the verified user and UTC month and returns
  `{ allowed, count, limit, remaining, resetsAt }`; over the cap it returns
  429. The cap is `FREE_MONTHLY_EXPORTS` (default 10; keep equal to
  `FREE_LIMITS.MONTHLY_EXPORTS` in `payments/config.js`). Pro/admin users are
  unlimited and not counted. KV has no atomic increment, so this is a soft
  cap, and anonymous ids are limited to `IDENTITY_PER_IP_DAILY` (default 30)
  new identities per IP per day to blunt id-minting. Optional vars go in
  `wrangler.toml [vars]`.
- The client (`payments/stripe.js` `recordExport()`) calls this best-effort:
  an unconfigured or unreachable worker never blocks an export; only an
  explicit 429 does.

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

## Unit tests

`npm test` (repo root) runs `test/stripe-worker.test.mjs`, which drives the
worker's `fetch` handler with a mocked KV namespace and a stubbed `fetch`
(no network, no real keys).

---

## Smoke test

```sh
# Should respond with 404 (GET not routed) — proves the worker is live:
curl -i https://<worker>.workers.dev/api/checkout

# Get an anonymous identity token (needed as Bearer for /api/checkout):
curl -X POST https://<worker>.workers.dev/api/identity

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
