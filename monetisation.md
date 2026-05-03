# Puzzle Suite — Monetisation Strategy

_Last updated: 2026-03-15_

---

## Current State

Puzzle Suite is a fully client-side, free tool with no server costs and no user accounts.
Revenue is currently zero. All features — including AI word generation — are available without restriction.

The AI feature uses a **Bring Your Own Key (BYOK)** model: users supply an API key from Google, Groq, OpenAI, Anthropic, or OpenRouter. This is zero-cost to us but creates friction (obtaining, managing, and paying for API keys is a barrier for non-technical users, especially teachers).

---

## Guiding Principles

1. **Free tier stays genuinely useful.** The core puzzle generation (notes, word search, crossword, scramble, PDF export) should remain free. Paywalling fundamentals alienates educators who are the core audience.
2. **AI is the natural upgrade trigger.** It's the most novel feature, requires real cost (tokens), and users understand paying for "AI credits."
3. **Friction, not locks.** Paid tiers reduce friction (no setup, more generous limits) rather than locking out essential functionality.
4. **Privacy-preserving by design.** The BYOK architecture already signals that we take privacy seriously. Managed AI must uphold this — no storing puzzle content beyond request processing.

---

## Proposed Tiers

### Free — *always free*
Everything currently available:
- All 5 puzzle types + PDF export
- Up to 30 words per set
- Bulk export up to 3 unique sets
- AI word generation via **BYOK** (user manages their own API key)
- Local save/load (.json config files)
- All fonts, paper sizes, watermark

### Pro — *~$5/month or $45/year*
Targets individual teachers and tutors who want AI without the hassle:
- **Managed AI credits** — ~500 AI generations/month (≈ 10,000 words), no API key needed
- **Choice of AI quality tier** — Fast (Gemini Flash / Llama 3.1) or Premium (GPT-4o / Claude Sonnet)
- Bulk export up to **25 unique sets** (vs. 3 on Free)
- Up to **50 words** per set (vs. 30)
- **Cloud save** — puzzles sync across devices, shareable links
- Priority support

### School — *~$49/month per school (unlimited teachers)*
Targets department heads and school IT purchasers:
- Everything in Pro
- **2,500 AI generations/month** pooled across all teachers
- **Admin dashboard** — usage per teacher, billing in one place
- **Custom branding** — school logo as watermark default, custom title templates
- **Roster import** — CSV upload to auto-generate differentiated sets per student name
- LMS export helpers (Google Classroom, Canvas-ready PDF naming)
- Dedicated support SLA

---

## AI Feature — Monetisation Detail

### Why BYOK is the right free-tier model
- Zero cost to us; advanced users (those comfortable with API keys) get full power free
- Positions us as trustworthy: "your key, your data"
- Five provider choices (Gemini, Groq, OpenAI, Anthropic, OpenRouter) including free-tier providers, so even BYOK users can use AI at no cost to themselves

### Managed AI (Pro/School) implementation approach
- Proxy server (Cloudflare Worker or Vercel Edge Function) holds our provider API keys
- Strips and discards request content after forwarding — no logging of puzzle topics or words
- Credit accounting: deduct 1 credit per generation request (regardless of word count), reset monthly
- Provider mix: route to cheapest capable model by default; Premium toggle routes to GPT-4o or Claude Sonnet and costs 2 credits per generation

### Positioning in the UI
- AI modal shows a **"Use My Key"** tab and a **"Use Puzzle Suite AI"** tab side-by-side
- "Use Puzzle Suite AI" tab shows remaining monthly credits for logged-in Pro users
- Free users on the managed tab see a credit counter of 0 with a clear "Upgrade to Pro" CTA — not a hard error
- BYOK tab remains fully functional for all users regardless of tier

---

## Additional Revenue Vectors

### One-time purchases (no subscription needed)
| Item | Price | Notes |
|------|-------|-------|
| Extra AI credit pack (250 generations) | $3 | Top-up for Pro users who need more in a month |
| Lifetime Pro for individuals | $99 | Appeals to teachers who distrust subscriptions; ~2-year payback |

### Marketplace (future, post-PMF)
- Teachers upload and sell curated word sets (topic + clues) — e.g. "AP Biology Unit 3," "SAT Vocab 500"
- Platform takes 30%; seller keeps 70%
- Low marginal cost to us; generates organic word-of-mouth from seller-teachers

### Affiliate / partnership
- Each BYOK provider link is already present in the UI (`aistudio.google.com`, `console.groq.com`, etc.)
- Apply to affiliate/referral programs where offered (OpenRouter has one)
- Low effort, low yield, but non-zero

---

## Growth Model

```
Free (BYOK AI)  →  hits generation limit or API key friction
        ↓
    Pro ($5/mo) — individual teacher, frictionless AI
        ↓
    School ($49/mo) — department buys in, admin wants visibility
        ↓
    Marketplace — power users monetise their own content
```

Key conversion bets:
- The BYOK flow creates friction that Pro directly resolves → natural upgrade moment
- Bulk export cap (3 on Free vs. 25 on Pro) catches teachers generating end-of-unit sets
- Cloud save catches the "I made this on my laptop, now I'm at school" moment

---

## What to Build First

Ranked by effort-to-revenue ratio:

1. **Auth layer** (accounts, sessions) — prerequisite for everything else; use a managed provider (Clerk, Supabase Auth) to ship fast
2. **Managed AI proxy** (Cloudflare Worker + credit accounting in D1/KV) — directly unlocks Pro tier
3. **Stripe integration** — subscription billing, Pro/School plans, top-up packs
4. **Usage dashboard in UI** — credit counter, upgrade prompts, account page
5. **Cloud save** (Supabase or R2 + signed URLs) — Pro differentiator, high retention value
6. **School admin dashboard** — unlocks the higher-value School tier

Items 1–4 alone fully enable the Free → Pro conversion funnel.

---

## Pricing Rationale

- $5/month is below the "think twice" threshold for individual educators spending personal money
- $45/year (= $3.75/mo effective) incentivises annual commits and reduces churn
- $49/month/school is well below what a single teacher subscription would cost at scale (most schools have 5–50 teachers), making the per-teacher cost $1–10/month — easy to justify to a department head
- Managed AI cost at scale: ~500 generations × avg 0.5¢/generation = ~$2.50 COGS per Pro user per month, leaving comfortable margin at $5

---

## Reusing this in another project

The Stripe + Cloudflare Worker + tier/feature-gate plumbing is implemented
generically and intended to be lifted into similar projects. See:

- [`STRIPE_INTEGRATION.md`](./STRIPE_INTEGRATION.md) — architecture, file map, customisation checklist
- [`stripe-worker/README.md`](./stripe-worker/README.md) — concrete deploy walkthrough
