# Maths Suite — Monetisation Strategy

_Last updated: 2026-06-11_

> Internal document — deliberately **not** deployed to the public site (the
> Pages workflow publishes an allowlist of runtime files only).
> Supersedes the 2026-03 Puzzle Suite strategy after the pivot to the NESA
> maths worksheet generator; the principles and AI-generation plans carry
> forward, the puzzle-type specifics do not.

---

## Current State

Maths Suite is a fully client-side, free tool: seeded question generation,
13+ NESA-aligned topics, PDF export. No server costs, no accounts, zero
revenue.

The monetisation **plumbing is already built and inert**:

- Tier / feature-gate system (`payments/config.js`, `payments/access.js`) —
  free / pro / admin tiers, 9 feature flags, named group presets (incl. a
  School License preset), admin override panel.
- Stripe scaffolding (`payments/stripe.js` + `stripe-worker/`) — checkout,
  verify-to-JWT, customer portal, webhook lifecycle, KV subscription store.
  Inactive until `STRIPE_CONFIG` is filled and the worker is deployed.
- AI generation is **not built yet** — `FEATURE.AI_GENERATION` is reserved
  for it (see "AI Question Generation" below). The legacy BYOK module from
  the puzzle product was removed; the managed-AI plan replaces it.

---

## Guiding Principles (carried forward)

1. **Free tier stays genuinely useful.** Core worksheet generation — all
   topics, all difficulties, PDF export, answer keys — stays free.
   Paywalling fundamentals alienates the teachers who are the audience.
2. **AI is the natural upgrade trigger.** It is the most novel feature,
   carries real per-use cost (tokens), and "paying for AI credits" is a
   model teachers already understand.
3. **Friction, not locks.** Paid tiers remove friction (bulk size, no
   watermark, two-page sets) rather than locking essential functionality.
   Corollary: client-side limits are acceptable as friction — the paid
   boundary that matters (subscription status) is verified server-side by
   the Stripe worker.
4. **Privacy-preserving by design.** Generation is local; managed AI must
   not store question content beyond request processing.

---

## Tiers (as wired in `payments/config.js` today)

### Free — *always free*
- All topics, all difficulties, all sub-operations (`ALL_TOPICS`)
- PDF export with answer key; save/load `.json` configs (`EXPORT_CONFIG`)
- Bulk export up to **50** unique sets (`FREE_LIMITS.BULK_EXPORT_MAX`)
- Built-in watermark on exports

### Pro — *$9.99/month or $79.99/year* (`PRICING`)
- **AI question generation** (when built — the anchor feature)
- Watermark removal (`REMOVE_WATERMARK`)
- Uncapped bulk export (`BULK_EXPORT` → no 50-set ceiling)
- Two pages per difficulty band (`TWO_PAGE_MODE`)
- Custom PDF fonts (`CUSTOM_FONT`)
- Unlimited monthly exports (`UNLIMITED_EXPORTS`)

### School License — *future; preset exists in `GROUPS.school`*
- Pro for all teachers in a department (no watermark removal — school
  branding stays); pooled AI quota; admin/usage visibility.
- Don't build until ≥ a handful of individual Pro conversions prove demand.

Pricing notes: USD pricing inherited from the previous strategy. **Open
question before launch:** AUD pricing/display for the NSW-teacher audience
(Stripe supports multi-currency prices; revisit when filling
`STRIPE_CONFIG.prices`).

---

## AI Question Generation — the Pro anchor (planned)

Design fresh against the maths generator's question shape
(`{topic, difficulty, clue, answer, answerDisplay, worked, diagram?}`) —
do not port the old BYOK module.

- **Managed only, no BYOK this time.** BYOK added friction without revenue
  and the audience (teachers) is exactly who BYOK loses.
- **Proxy via the existing Cloudflare Worker** (or a sibling worker):
  provider keys live in worker secrets; request content is forwarded and
  discarded, never logged.
- **Credit accounting in KV/D1** keyed by the JWT userId the Stripe flow
  already issues — the identity rail is in place; quota enforcement is
  server-side from day one.
- Use cases ranked by classroom value: word-problem variants of generated
  questions → topic-targeted question batches → worked-solution elaboration.
- UI: credits counter for Pro; free users see the feature with a 0-credit
  counter and an upgrade CTA — visible, not hidden (friction, not locks).

---

## Launch Checklist (technical)

Security/hardening status from the 2026-06 audit:

- [x] Webhook signature verification, constant-time compare, replay window
- [x] Checkout identity is server-issued (JWT-verified or minted `anon:` id;
      client-supplied userIds are ignored — impersonation vector closed)
- [x] Price-ID allowlist; redirect-URL origin validation; verify idempotency
- [x] CORS pinned to `APP_URL`
- [ ] Stripe account: create products/prices, fill `STRIPE_CONFIG`
      (publishable key, worker URL, price IDs)
- [ ] Deploy worker: KV namespace, secrets, webhook registration
      (`stripe-worker/README.md` walkthrough)
- [ ] End-to-end test-mode run: checkout → verify → portal → cancel →
      webhook downgrade
- [ ] Decide AUD vs USD pricing display
- [~] `MONTHLY_EXPORTS` stays client-side **by decision** (friction, not
      locks — exports run locally; server enforcement would buy nothing
      until exports depend on a server feature like AI)

## What to Build Next (effort-to-revenue order)

1. **Go-live config** (checklist above) — everything else is already coded.
2. **Upgrade UI surface** — pricing modal already exists; verify the
   post-checkout tier reflects in UI on first render (`handleCheckoutReturn`
   runs before state restore by design).
3. **Managed AI proxy + credits** — unlocks the Pro anchor feature.
4. **School tier** — only after individual Pro demand is proven.

---

## Reusing this in another project

The Stripe + Cloudflare Worker + tier/feature-gate plumbing is implemented
generically and intended to be lifted into similar projects. See:

- [`STRIPE_INTEGRATION.md`](./STRIPE_INTEGRATION.md) — architecture, file map, customisation checklist
- [`stripe-worker/README.md`](./stripe-worker/README.md) — concrete deploy walkthrough
