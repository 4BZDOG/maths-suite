# Maths Suite — Monetisation Strategy

_Last updated: 2026-06-13_

> **History:** an earlier version of this document described the predecessor
> vocabulary-puzzle product (word search / crossword / scramble, BYOK AI). The
> product has since pivoted to the NESA maths worksheet generator. This revision
> rewrites the strategy around the maths product and the **page-based metering**
> model now implemented in `payments/`. It is internal and is not deployed to
> the public site.

---

## Current State

Maths Suite is a client-side NESA maths worksheet generator. The payments stack
(Stripe via the Cloudflare Worker in `stripe-worker/`, JWT sessions, tier +
feature flags, admin access panel) is built but **not yet live** — `STRIPE_CONFIG`
is empty and no live key is configured. Revenue is currently zero and every
feature is reachable in admin mode for testing.

The natural unit of value — and of cost, once AI generation lands — is the
**PDF page**. A teacher running a 50-copy differentiated set is getting far more
out of the tool than someone printing a single warm-up. Metering by page (not by
export click) prices that fairly and gives a clean, legible free tier.

---

## Guiding Principles

1. **Free tier stays genuinely useful.** Core generation, preview, and a real
   monthly page allowance stay free. Paywalling fundamentals alienates the
   teachers who are the core audience.
2. **Meter the page, not the click.** One export of 200 pages and 200 exports of
   one page cost the same to serve and deliver the same value — count pages.
3. **Friction, not locks.** Hitting the free allowance shows an upgrade prompt,
   never a broken tool. When metering can't run (storage blocked, server down),
   the export proceeds — we never lock a user out over missing local state.
4. **Server is the source of truth; client mirrors it.** Tier and quota numbers
   live in config that the worker can re-serve, so pricing/gating can change
   without a frontend release.

---

## Page-Based Metering (implemented)

The monetisation primitive is a **monthly PDF page allowance** per tier.

| Piece | Location |
|-------|----------|
| Per-tier monthly page quotas (source of truth) | `payments/config.js` → `TIER_PAGE_QUOTAS` |
| Tier-aware quota resolver | `payments/access.js` → `getMonthlyPageQuota()` |
| Pure page estimator + quota math (unit-tested) | `payments/pageQuota.js` |
| Monthly usage tracker (localStorage) | `payments/usage.js` |
| Pre-export gate + actual-page recording | `pdf/pdfExport.js` |
| In-app usage meter | `main.js` → `renderExportPreview()` (Export Preview panel) |
| Tests | `test/usage.test.mjs` |

**How it works**

- Each export estimates its page count up front (`estimateExportPages` mirrors
  the Export Preview accounting: difficulty bands × pages-per-band + answer key +
  formula sheet, × bulk copies).
- If the estimate would push the month over the free allowance, the export is
  blocked with an upgrade toast. Unlimited tiers always pass.
- After a successful export the **exact** count (`doc.getNumberOfPages()`) is
  recorded against the month; usage rolls over automatically each calendar month.
- The Export Preview shows a used / quota meter (green → amber at 80% → red when
  over) and an inline upgrade link.

**Current quotas — PLACEHOLDERS, tune freely (`payments/config.js`):**

| Tier | Monthly pages |
|------|---------------|
| Free | 30 |
| Pro | Unlimited |
| Admin | Unlimited |

> The free number is a deliberate placeholder. Pick the real value from observed
> usage once there is traffic — high enough that a casual teacher rarely hits it,
> low enough that a power user converting end-of-unit sets does.

---

## Proposed Tiers

### Free — *always free*
- All 13 topics, all difficulty bands, full live preview
- **30 PDF pages / month** (placeholder)
- Bulk export up to `FREE_LIMITS.BULK_EXPORT_MAX` copies
- Single page per difficulty band (1-page mode)
- Save/load `.json` config, CSV import
- Branding watermark on exported pages

### Pro — *~$9.99/month or $79.99/year* (`PRICING` in config)
Targets individual teachers and tutors:
- **Unlimited PDF pages**
- **Two-page mode** — 2 pages per difficulty band (`FEATURE.TWO_PAGE_MODE`)
- **Remove watermark** (`FEATURE.REMOVE_WATERMARK`)
- **Custom PDF fonts** (`FEATURE.CUSTOM_FONT`)
- Unlimited bulk export (`FEATURE.BULK_EXPORT` / `UNLIMITED_EXPORTS`)
- AI question generation when it ships (`FEATURE.AI_GENERATION`)

### School — *future, per-institution*
- Everything in Pro, pooled across teachers
- Admin dashboard (usage per teacher) — needs the server-side usage store below
- Custom branding defaults

---

## What to Build Next (server-side hardening)

The client-side meter is the right shape but is client-enforced only — fine
pre-launch, insufficient once money is on the line. Before going live:

1. **`/api/usage` on the worker** — GET returns the month's page total, POST
   records a delta. Key by `userId` (licensed) or an opaque client id
   (anonymous). Read quotas from a server copy of `TIER_PAGE_QUOTAS`; the server
   response wins, `payments/usage.js` becomes the offline fallback.
2. **Enforce server-side** so the meter can't be reset by clearing localStorage.
   Record usage even when over quota, so overage is visible (and billable later).
3. **Bind `/api/checkout` userId to a server-issued identity** rather than
   trusting client input (already noted in CLAUDE.md roadmap).
4. **Admin usage view** — month totals, per-tier breakdown, top consumers. This
   is what unlocks the School tier's per-teacher visibility.

Items 1–2 close the only real hole in the current model.

---

## Pricing Rationale

- $9.99/month sits just below the "think twice" line for an educator spending
  personal money; $79.99/year (≈ $6.67/mo) rewards annual commits and cuts churn.
- Page metering means COGS scales with actual generation, so the free allowance
  is a knob you can turn directly against observed conversion.
- A School tier priced per institution undercuts buying N individual Pro seats,
  making it easy for a department head to justify.

---

## Reusing this in another project

The Stripe + Cloudflare Worker + tier/feature-gate plumbing is generic and
intended to be lifted into similar projects. See:

- [`STRIPE_INTEGRATION.md`](./STRIPE_INTEGRATION.md) — architecture, file map, customisation checklist
- [`stripe-worker/README.md`](./stripe-worker/README.md) — concrete deploy walkthrough

The page-metering layer (`payments/pageQuota.js` + `payments/usage.js`) is
similarly self-contained: swap `estimateExportPages` for the host product's unit
of value and the rest carries over.
