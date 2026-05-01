// =============================================================
// payments/stripe.js — Client-side Stripe integration hooks
//
// Architecture:
//   Browser → Cloudflare Worker (/api/*) → Stripe API
//
//   initiateCheckout()    POST /api/checkout → Stripe-hosted Checkout URL → redirect
//   handleCheckoutReturn() reads ?stripe_session=, POSTs to /api/verify, sets session
//   openCustomerPortal()  POST /api/portal   → portal URL → redirect
//   refreshSession()      GET  /api/me        → re-validate token on app startup
//
// STRIPE_CONFIG lives in payments/config.js.
// Stripe secret keys are stored only in Cloudflare Worker secrets (never here).
// =============================================================

import { STRIPE_CONFIG, TIER } from './config.js';
import { getSession, setSession } from './session.js';

const RETURN_PARAM = 'stripe_session';

// ---- Public API ---------------------------------------------

/**
 * Redirect the user to Stripe Checkout for the given tier and billing interval.
 *
 * @param {'pro'} [tier]
 * @param {'monthly'|'yearly'} [interval='monthly']
 * @throws {Error} if the worker URL is not configured or the request fails
 */
export async function initiateCheckout(tier = TIER.PRO, interval = 'monthly') {
    if (!STRIPE_CONFIG.workerUrl) {
        throw new Error('Payment system not yet configured.');
    }

    const priceId = interval === 'yearly'
        ? STRIPE_CONFIG.prices.proYearly
        : STRIPE_CONFIG.prices.proMonthly;

    if (!priceId) {
        throw new Error(`No price ID configured for interval: ${interval}`);
    }

    // successUrl uses Stripe's template literal — the worker substitutes the
    // real session_id before redirecting the browser.
    const base       = `${window.location.origin}${window.location.pathname}`;
    const successUrl = `${base}?${RETURN_PARAM}={CHECKOUT_SESSION_ID}`;
    // cancelUrl: strip any existing query params so the user returns cleanly.
    const cancelUrl  = base;

    const session = getSession();
    const resp = await fetch(`${STRIPE_CONFIG.workerUrl}/api/checkout`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
            priceId,
            tier,
            userId:     session.userId ?? null,
            successUrl,
            cancelUrl,
        }),
    });

    if (!resp.ok) {
        const err = await resp.text().catch(() => resp.statusText);
        throw new Error(`Checkout request failed (${resp.status}): ${err}`);
    }

    const { url } = await resp.json();
    window.location.href = url;
}

/**
 * Call once on page load — before restoring saved state — so the UI reflects
 * the newly-purchased tier on the very first render.
 *
 * Detects a returning Stripe session (?stripe_session=xxx), verifies it with
 * the worker via POST (keeping the session ID out of server access logs), then
 * stores the resulting JWT in localStorage.
 *
 * @returns {Promise<boolean>} true if a successful checkout was processed
 */
export async function handleCheckoutReturn() {
    const params    = new URLSearchParams(window.location.search);
    const sessionId = params.get(RETURN_PARAM);
    if (!sessionId || !STRIPE_CONFIG.workerUrl) return false;

    // Remove the param immediately so a hard-refresh doesn't re-trigger verify.
    window.history.replaceState({}, '', window.location.pathname + window.location.hash);

    try {
        const resp = await fetch(`${STRIPE_CONFIG.workerUrl}/api/verify`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ sessionId }),
        });

        if (!resp.ok) {
            console.warn('[Stripe] Session verification returned', resp.status);
            return false;
        }

        const data = await resp.json();
        if (data.tier && data.token) {
            setSession({
                tier:      data.tier,
                userId:    data.userId   ?? null,
                token:     data.token,
                expiresAt: data.expiresAt ?? null,
            });
            return true;
        }
    } catch (e) {
        console.error('[Stripe] handleCheckoutReturn error:', e);
    }
    return false;
}

/**
 * Redirect the user to the Stripe Customer Portal to manage billing,
 * update payment methods, or cancel their subscription.
 * The user must have a valid session token (set after a successful checkout).
 *
 * @throws {Error} if the portal request fails
 */
export async function openCustomerPortal() {
    if (!STRIPE_CONFIG.workerUrl) {
        throw new Error('Payment system not yet configured.');
    }
    const { token } = getSession();
    if (!token) {
        throw new Error('No active session — complete a checkout first.');
    }

    const resp = await fetch(`${STRIPE_CONFIG.workerUrl}/api/portal`, {
        method:  'POST',
        headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
            returnUrl: `${window.location.origin}${window.location.pathname}`,
        }),
    });

    if (!resp.ok) {
        const err = await resp.text().catch(() => resp.statusText);
        throw new Error(`Portal request failed (${resp.status}): ${err}`);
    }

    const { url } = await resp.json();
    window.location.href = url;
}

/**
 * Re-validate the stored JWT against the worker on app startup.
 * Updates the local session if the subscription has renewed, been upgraded,
 * or cancelled since the token was issued.
 *
 * Safe to call when workerUrl is not yet configured — it's a no-op.
 * On network failure the existing session is kept; never downgrade silently.
 */
export async function refreshSession() {
    const session = getSession();
    if (!session.token || !STRIPE_CONFIG.workerUrl) return;

    try {
        const resp = await fetch(`${STRIPE_CONFIG.workerUrl}/api/me`, {
            headers: { Authorization: `Bearer ${session.token}` },
        });

        if (!resp.ok) {
            if (resp.status === 401) {
                // Token is invalid or expired — revert to free.
                setSession({ tier: 'free', token: null, expiresAt: null });
            }
            // 403 or other errors: leave session unchanged (subscription may
            // still be within a grace period handled server-side).
            return;
        }

        const data = await resp.json();
        if (data.tier) {
            setSession({
                tier:      data.tier,
                userId:    data.userId ?? session.userId,
                expiresAt: data.expiresAt ?? null,
            });
        }
    } catch {
        // Network failure — keep existing session, don't downgrade.
        console.warn('[Stripe] refreshSession: network error, keeping existing session.');
    }
}

/**
 * Returns true when both the worker URL and at least one price ID are set.
 * Used by UI code to decide whether to show the Stripe checkout flow vs a
 * static "coming soon" message.
 */
export function isStripeConfigured() {
    return !!(STRIPE_CONFIG.workerUrl && STRIPE_CONFIG.prices.proMonthly);
}
