# Stripe Integration — Reusable Pattern

A practical recipe for adding tiered subscriptions to a static front-end
(GitHub Pages, Netlify, Cloudflare Pages, etc.) using a tiny Cloudflare
Worker as the only server. Lifted from `maths-suite` and written so it
can be transplanted into a similar project with minimal edits.

> If you only need to deploy *this* project's worker, see
> [`stripe-worker/README.md`](./stripe-worker/README.md). This document is
> the generic version: what to copy, what to change, and why.

---

## Architecture in one picture

```
┌──────────────────────┐    POST /api/checkout    ┌────────────────────────┐
│  Static front-end    │ ───────────────────────► │  Cloudflare Worker     │
│  (GitHub Pages)      │ ◄─── Checkout URL ─────  │  (stripe-worker/)      │
│                      │                          │                        │
│  payments/config.js  │    POST /api/verify      │   verify session       │
│  payments/stripe.js  │ ───────────────────────► │   issue 30-day JWT     │
│  payments/session.js │ ◄────── JWT ─────────── │                        │
│  payments/access.js  │                          │   KV: customer/user/   │
│                      │    GET  /api/me          │       verified         │
│  localStorage:       │ ───────────────────────► │                        │
│   { tier, token,     │    POST /api/portal      │                        │
│     userId, expires, │ ───────────────────────► │                        │
│     overrides }      │                          │                        │
└──────────────────────┘                          │   POST /api/webhooks   │
                                                  │   ◄── Stripe events    │
                                                  └────────────────────────┘
```

Three load-bearing ideas:

1. **The browser never holds a Stripe secret.** All sensitive calls go
   through the worker; the browser only knows a *publishable* key.
2. **Tier state lives in two places** — KV on the server (source of truth
   for billing), localStorage on the client (cache, refreshed via
   `/api/me`). Always re-validate on app start.
3. **Feature gating is a pure client function** of `(tier, overrides)`. A
   single `hasFeature(key)` call gates anything from a button click to a
   rendered DOM element. Overrides let an admin role toggle features
   per-session without changing any code.

---

## What to copy into a new project

| Source path                  | Action                                                   |
| ---------------------------- | -------------------------------------------------------- |
| `stripe-worker/`             | Copy whole dir; rename in `wrangler.toml`                |
| `payments/config.js`         | Copy; rename tiers/features and update `STRIPE_CONFIG`   |
| `payments/access.js`         | Copy as-is (no project-specific logic)                   |
| `payments/session.js`        | Copy; change the `STORAGE_KEY` constant                  |
| `payments/stripe.js`         | Copy; the `workerUrl` is read from `config.js`           |
| `ui/accessPanel.js`          | Optional — admin override panel (modal UI)               |

Then call `payments/stripe.js#handleCheckoutReturn()` early in your app
boot (before restoring saved state) so a `?stripe_session=…` query param
is consumed cleanly.

---

## Customisation checklist

When porting, change these and only these:

- [ ] **Tier names** — `payments/config.js` → `TIER`, `TIER_FEATURES`, `GROUPS`
- [ ] **Feature keys** — `payments/config.js` → `FEATURE` enum
- [ ] **Free-tier limits** — `payments/config.js` → `FREE_LIMITS`
- [ ] **localStorage key** — `payments/session.js` → `STORAGE_KEY`
- [ ] **Stripe config** — `payments/config.js` → `STRIPE_CONFIG.publishableKey`,
      `workerUrl`, `prices.*`
- [ ] **Worker name** — `stripe-worker/wrangler.toml` → `name`
- [ ] **APP_URL** — `stripe-worker/wrangler.toml` → `[vars] APP_URL`
- [ ] **Worker secrets** — `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
      `JWT_SECRET`, `PRICE_PRO_MONTHLY`, `PRICE_PRO_YEARLY`
- [ ] **Webhook endpoint** registered in Stripe Dashboard

Everything else (gating helpers, JWT issuance, signature verification,
KV schema) is project-agnostic.

---

## Feature-gate usage examples

```js
import { hasFeature, requireFeature, getBulkExportLimit } from './payments/access.js';
import { FEATURE } from './payments/config.js';
import { showToast } from './ui/toast.js';

// Cheap boolean check inside a render path:
if (hasFeature(FEATURE.AI_GENERATION)) {
    renderAiButton();
}

// Guard at the start of an action handler — toast on failure:
function onExportClick() {
    if (!requireFeature(FEATURE.BULK_EXPORT, showToast)) return;
    runBulkExport();
}

// Limits are functions, not constants — they respect overrides:
const max = getBulkExportLimit();   // Infinity for Pro, 50 (or whatever) for Free
```

Server-side, *never* trust a tier reported by the client. Re-derive it from
the KV record keyed by the user/customer ID inside the JWT.

---

## Security notes

- **Webhook signatures** — HMAC-SHA-256 over `${timestamp}.${rawBody}` using
  `STRIPE_WEBHOOK_SECRET`. Reject events with `|now − timestamp| > 5 min`
  to prevent replay.
- **JWTs** — short-ish (30 d) with `JWT_SECRET` rotation possible by
  invalidating tokens (next `/api/me` returns 401, client re-verifies).
- **Idempotency** — `verified:{sessionId}` KV entry with 24 h TTL prevents
  a double-issued JWT if the user reloads `?stripe_session=…`.
- **Cleared sessions** — strip `?stripe_session=` from the URL on first
  load (`history.replaceState`) so a hard refresh doesn't replay.
- **No PII in logs** — webhook handler logs event types, never bodies.

---

## What this pattern is *not* good for

- **Per-seat licensing or org membership.** The current schema assumes one
  Stripe customer per user. Add a `team:{teamId}` KV key and join logic if
  you need shared billing.
- **Heavy server-side rendering.** A Worker is fine for billing routes but
  not for serving large payloads or running long jobs.
- **Provider lock-in concerns.** Stripe IDs leak into config and KV. If you
  expect to swap to Paddle/Lemon Squeezy, abstract behind a `provider/`
  module before the codebase grows.

---

## Pointers

- Project-specific deployment guide: [`stripe-worker/README.md`](./stripe-worker/README.md)
- Tier strategy and pricing rationale: [`monetisation.md`](./monetisation.md)
- Implementation source: `payments/`, `stripe-worker/index.js`
