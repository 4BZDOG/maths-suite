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
    FREE:  'free',
    PRO:   'pro',
    ADMIN: 'admin', // internal/testing — all features, no limits
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
        // Bulk export capped at FREE_LIMITS.BULK_EXPORT_MAX (enforced in pdfExport.js)
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
    // Admin has every feature — used for internal testing only.
    [TIER.ADMIN]: new Set(Object.values(FEATURE)),
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

// ---- Feature metadata (labels + categories for UI rendering) -----
export const FEATURE_CATEGORIES = Object.freeze(['PDF / Export', 'Content', 'Config', 'Layout']);

export const FEATURE_META = Object.freeze({
    [FEATURE.BULK_EXPORT]:       { label: 'Bulk Export',       desc: 'Export multiple unique copies in one go',   category: 'PDF / Export' },
    [FEATURE.UNLIMITED_EXPORTS]: { label: 'Unlimited Exports', desc: 'No monthly PDF export cap',                 category: 'PDF / Export' },
    [FEATURE.REMOVE_WATERMARK]:  { label: 'Remove Watermark',  desc: 'Hide branding watermark on exported PDFs',  category: 'PDF / Export' },
    [FEATURE.ALL_TOPICS]:        { label: 'All Topics',        desc: 'Access all 9 maths topic categories',       category: 'Content'      },
    [FEATURE.AI_GENERATION]:     { label: 'AI Generation',     desc: 'AI-assisted question and word generation',  category: 'Content'      },
    [FEATURE.CUSTOM_FONT]:       { label: 'Custom Font',       desc: 'Choose custom fonts for PDF exports',       category: 'Content'      },
    [FEATURE.EXPORT_CONFIG]:     { label: 'Export Config',     desc: 'Save and load JSON configuration files',    category: 'Config'       },
    [FEATURE.IMPORT_CSV]:        { label: 'Import CSV',        desc: 'Import word / clue lists via CSV',          category: 'Config'       },
    [FEATURE.TWO_PAGE_MODE]:     { label: 'Two-Page Mode',     desc: '2 pages per difficulty band per set',       category: 'Layout'       },
});

// ---- Named groups (predefined feature bundles) ---------------
// Groups let admins quickly apply and test different access configurations.
// Each entry defines a named bundle; the access panel uses these as presets.
// Add new groups here — they appear automatically in the panel UI.
//
// free / pro / admin reference the TIER_FEATURES Sets directly so they
// stay in sync automatically when tier definitions change.
export const GROUPS = Object.freeze({
    free: {
        label: 'Free',
        description: 'Standard free-tier experience',
        features: TIER_FEATURES[TIER.FREE],
    },
    teacher_trial: {
        label: 'Teacher Trial',
        description: 'Free features plus AI generation and custom fonts',
        features: new Set([
            FEATURE.EXPORT_CONFIG,
            FEATURE.IMPORT_CSV,
            FEATURE.ALL_TOPICS,
            FEATURE.AI_GENERATION,
            FEATURE.CUSTOM_FONT,
        ]),
    },
    school: {
        label: 'School License',
        description: 'Full Pro access for educational institutions (no watermark removal)',
        features: new Set([
            FEATURE.EXPORT_CONFIG,
            FEATURE.IMPORT_CSV,
            FEATURE.BULK_EXPORT,
            FEATURE.UNLIMITED_EXPORTS,
            FEATURE.ALL_TOPICS,
            FEATURE.AI_GENERATION,
            FEATURE.CUSTOM_FONT,
            FEATURE.TWO_PAGE_MODE,
        ]),
    },
    pro: {
        label: 'Pro',
        description: 'Standard Pro subscription',
        features: TIER_FEATURES[TIER.PRO],
    },
    admin: {
        label: 'Admin (All)',
        description: 'Every feature enabled — internal testing only',
        features: TIER_FEATURES[TIER.ADMIN],
    },
});
