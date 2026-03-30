// =============================================================
// payments/access.js — Feature-gate API
//
// Usage:
//   import { hasFeature, getCurrentTier, requireFeature } from '../payments/access.js';
//
//   if (!hasFeature(FEATURE.BULK_EXPORT)) {
//       showToast('Bulk export is a Pro feature.', 'warning');
//       return;
//   }
// =============================================================
import { TIER, FEATURE, TIER_FEATURES, FREE_LIMITS, PRICING } from './config.js';
import { getSession } from './session.js';

export { TIER, FEATURE, FREE_LIMITS, PRICING };

// ---- Core access functions ----------------------------------

/** Returns the current subscription tier string (e.g. 'free' | 'pro'). */
export function getCurrentTier() {
    return getSession().tier || TIER.FREE;
}

/** Returns true if the current tier includes the given feature key. */
export function hasFeature(featureKey) {
    const tier = getCurrentTier();
    return TIER_FEATURES[tier]?.has(featureKey) ?? false;
}

/**
 * Checks feature access and shows an upgrade toast if not available.
 * Returns true if access is granted, false otherwise.
 *
 * @param {string}   featureKey  - One of FEATURE.*
 * @param {Function} showToastFn - The showToast(msg, type) function from ui/toast.js
 * @param {string}   [customMsg] - Override the default upgrade message
 * @returns {boolean}
 */
export function requireFeature(featureKey, showToastFn, customMsg) {
    if (hasFeature(featureKey)) return true;
    const msg = customMsg || _upgradeMessage(featureKey);
    if (typeof showToastFn === 'function') showToastFn(msg, 'warning');
    return false;
}

/**
 * Returns the effective bulk export limit for the current tier.
 * Pro users get unlimited (returns Infinity); free users get FREE_LIMITS.BULK_EXPORT_MAX.
 */
export function getBulkExportLimit() {
    return hasFeature(FEATURE.BULK_EXPORT) ? Infinity : FREE_LIMITS.BULK_EXPORT_MAX;
}

/**
 * Clamps a requested bulk-export count to the tier limit.
 * @param {number} requested
 * @returns {number}
 */
export function clampBulkExportCount(requested) {
    const limit = getBulkExportLimit();
    return Math.min(requested, limit);
}

// ---- Upgrade prompt helpers ---------------------------------

/** Returns the Stripe checkout URL for a tier (null if not configured). */
export function getCheckoutUrl(tier = TIER.PRO) {
    return PRICING[tier]?.checkoutUrl ?? null;
}

// ---- Internal -----------------------------------------------

function _upgradeMessage(featureKey) {
    const map = {
        [FEATURE.BULK_EXPORT]:       'Bulk export requires a Pro subscription.',
        [FEATURE.UNLIMITED_EXPORTS]: 'Unlimited exports require a Pro subscription.',
        [FEATURE.REMOVE_WATERMARK]:  'Removing the watermark requires a Pro subscription.',
        [FEATURE.AI_GENERATION]:     'AI question generation requires a Pro subscription.',
        [FEATURE.CUSTOM_FONT]:       'Custom fonts require a Pro subscription.',
        [FEATURE.TWO_PAGE_MODE]:     'Two-page difficulty sets require a Pro subscription.',
    };
    return map[featureKey] || 'This feature requires a Pro subscription.';
}
