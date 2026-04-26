// =============================================================
// payments/access.js — Feature-gate API
//
// Resolution order for hasFeature():
//   1. session.featureOverrides[key]  — set by the admin access panel
//   2. TIER_FEATURES[session.tier]    — tier default
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
import { getSession, setSession, clearSession, setAdminSession } from './session.js';

export { TIER, FEATURE, FREE_LIMITS, PRICING };

// ---- Core access functions ----------------------------------

/** Returns the current subscription tier string (e.g. 'free' | 'pro' | 'admin'). */
export function getCurrentTier() {
    return getSession().tier || TIER.FREE;
}

/**
 * Returns true if the current session includes the given feature key.
 * Checks featureOverrides first (set via the access panel), then falls
 * back to the tier's default feature set.
 */
export function hasFeature(featureKey) {
    const session = getSession();
    const overrides = session.featureOverrides;
    if (overrides != null && Object.prototype.hasOwnProperty.call(overrides, featureKey)) {
        return !!overrides[featureKey];
    }
    const tier = session.tier || TIER.FREE;
    return TIER_FEATURES[tier]?.has(featureKey) ?? false;
}

// ---- Feature override management ----------------------------

/**
 * Persist a full feature-override map for the current session.
 * Each key is a FEATURE.* value; each value is a boolean.
 * Pass null to clear all overrides (reverts to tier defaults).
 * @param {Object|null} overrides
 */
export function setFeatureOverrides(overrides) {
    setSession({ featureOverrides: overrides ?? null });
}

/** Remove all feature overrides — reverts every feature to its tier default. */
export function clearFeatureOverrides() {
    setSession({ featureOverrides: null });
}

/**
 * Returns a map of every feature key → { enabled: boolean, source: 'override'|'tier' }
 * so the access panel can display both the effective value and where it came from.
 * @returns {Object}
 */
export function getEffectiveFeatureMap() {
    const session = getSession();
    const overrides = session.featureOverrides || {};
    const tier = session.tier || TIER.FREE;
    const result = {};
    Object.values(FEATURE).forEach(key => {
        if (Object.prototype.hasOwnProperty.call(overrides, key)) {
            result[key] = { enabled: !!overrides[key], source: 'override' };
        } else {
            result[key] = { enabled: !!(TIER_FEATURES[tier]?.has(key)), source: 'tier' };
        }
    });
    return result;
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

// ---- Admin helpers -----------------------------------------

/** Returns true when the current session is the admin tier. */
export function isAdmin() {
    return getCurrentTier() === TIER.ADMIN;
}

/**
 * Activate admin mode — sets the local session to the admin tier so all
 * features are unlocked with no limits.  Persists across page reloads
 * until disableAdminMode() or clearSession() is called.
 */
export function enableAdminMode() {
    setAdminSession();
}

/** Revert to the free tier by removing the stored session. */
export function disableAdminMode() {
    clearSession();
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
