// =============================================================
// payments/config.js — Subscription tier definitions & feature flags
//
// HOW TO WIRE UP A REAL BACKEND:
//   1. Replace TIER_FREE / TIER_PRO with values fetched from your
//      auth endpoint (e.g. JWT claims, Stripe subscription status).
//   2. Call session.setSession({ tier, userId, token }) after login.
//   3. All feature-gate logic already reads from access.js — no
//      other files need changing.
// =============================================================

// ---- Tier identifiers ----------------------------------------
export const TIER = Object.freeze({
    FREE: 'free',
    PRO:  'pro',
});

// ---- Feature keys --------------------------------------------
// Add new feature keys here as the product grows.
export const FEATURE = Object.freeze({
    // PDF / Export
    BULK_EXPORT:        'bulk_export',       // export multiple copies at once
    UNLIMITED_EXPORTS:  'unlimited_exports', // no monthly export cap
    REMOVE_WATERMARK:   'remove_watermark',  // hide built-in branding watermark

    // Content
    ALL_TOPICS:         'all_topics',        // access to all topic categories
    AI_GENERATION:      'ai_generation',     // AI-assisted question generation
    CUSTOM_FONT:        'custom_font',       // upload custom PDF fonts

    // Config
    EXPORT_CONFIG:      'export_config',     // save/load JSON configuration
    IMPORT_CSV:         'import_csv',        // import word/clue lists via CSV

    // Layout
    TWO_PAGE_MODE:      'two_page_mode',     // 2 pages per difficulty (Pro; free=1 page)
});

// ---- Tier → feature map -------------------------------------
// List every feature each tier INCLUDES.
// When adding a new feature, decide here which tier unlocks it.
export const TIER_FEATURES = Object.freeze({
    [TIER.FREE]: new Set([
        FEATURE.EXPORT_CONFIG,
        FEATURE.IMPORT_CSV,
        // Bulk export limited to 1 copy (enforced in pdfExport.js)
        // AI generation disabled on free tier
        // All topics available on free (generous free tier)
        FEATURE.ALL_TOPICS,
    ]),
    [TIER.PRO]: new Set([
        FEATURE.EXPORT_CONFIG,
        FEATURE.IMPORT_CSV,
        FEATURE.BULK_EXPORT,
        FEATURE.UNLIMITED_EXPORTS,
        FEATURE.REMOVE_WATERMARK,
        FEATURE.ALL_TOPICS,
        FEATURE.AI_GENERATION,
        FEATURE.CUSTOM_FONT,
        FEATURE.TWO_PAGE_MODE,
    ]),
});

// ---- Free-tier usage limits ---------------------------------
// Hard limits enforced client-side; backend should also enforce.
export const FREE_LIMITS = Object.freeze({
    BULK_EXPORT_MAX: 500,    // max copies per bulk export on free tier (unlocked)
    MONTHLY_EXPORTS: 10,     // max PDF exports per month (future: tracked server-side)
});

// ---- Pricing display (for upgrade prompts) ------------------
export const PRICING = Object.freeze({
    [TIER.PRO]: {
        label:       'Pro',
        monthlyUSD:  9.99,
        yearlyUSD:   79.99,
        // Replace with your real Stripe payment link or checkout URL:
        checkoutUrl: null, // e.g. 'https://buy.stripe.com/your-link'
    },
});
