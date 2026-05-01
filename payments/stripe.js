// =============================================================
// payments/stripe.js — Client-side Stripe integration hooks
//
// Architecture overview:
//   Browser → Cloudflare Worker → Stripe API
//
//   1. initiateCheckout()    POST /api/checkout → get Stripe-hosted URL → redirect
//   2. handleCheckoutReturn() detects ?stripe_session= on return, calls GET /api/verify
//   3. openCustomerPortal()  POST /api/portal   → get portal URL → redirect
//   4. refreshSession()      GET  /api/me        → re-validate stored token
//
// The worker URL and Stripe keys live in payments/config.js (STRIPE_CONFIG).
// Secrets (STRIPE_SECRET_KEY, JWT_SECRET) are stored in Cloudflare Worker secrets only.
// =============================================================

import { STRIPE_CONFIG, TIER } from './config.js';
import { getSession, setSession } from './session.js';

const RETURN_PARAM = 'stripe_session';

// ---- Public API ---------------------------------------------

/**
 * Redirect the user to Stripe Checkout for the given tier and billing interval.
 * Creates a Checkout Session via the Cloudflare Worker and redirects immediately.
 *
 * @param {'pro'} tier
 * @param {'monthly'|'yearly'} [interval='monthly']
 */
export async function initiateCheckout(tier = TIER.PRO, interval = 'monthly') {
    if (!STRIPE_CONFIG.workerUrl) {
        console.warn('[Stripe] workerUrl not configured — cannot initiate checkout.');
        throw new Error('Payment system not yet configured.');
    }

    const priceId = interval === 'yearly'
        ? STRIPE_CONFIG.prices.proYearly
        : STRIPE_CONFIG.prices.proMonthly;

    const successUrl =
        `${window.location.origin}${window.location.pathname}` +
        `?${RETURN_PARAM}={CHECKOUT_SESSION_ID}`;

    const body = {
        priceId,
        tier,
        userId:     getSession().userId ?? null,
        successUrl,
        cancelUrl:  window.location.href,
    };

    const resp = await fetch(`${STRIPE_CONFIG.workerUrl}/api/checkout`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
    });

    if (!resp.ok) {
        const err = await resp.text().catch(() => resp.statusText);
        throw new Error(`Checkout failed: ${err}`);
    }

    const { url } = await resp.json();
    window.location.href = url;
}

/**
 * Call once on page load. Detects a returning Stripe Checkout session
 * (?stripe_session=xxx), verifies it with the worker, and sets the
 * local session to the correct tier.
 *
 * @returns {Promise<boolean>} true if a successful checkout was processed
 */
export async function handleCheckoutReturn() {
    const params    = new URLSearchParams(window.location.search);
    const sessionId = params.get(RETURN_PARAM);
    if (!sessionId || !STRIPE_CONFIG.workerUrl) return false;

    // Strip the param from the URL immediately so a reload doesn't re-trigger.
    const cleanUrl = window.location.pathname + window.location.hash;
    window.history.replaceState({}, '', cleanUrl);

    try {
        const resp = await fetch(
            `${STRIPE_CONFIG.workerUrl}/api/verify?session_id=${encodeURIComponent(sessionId)}`
        );
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
 * Redirect the user to their Stripe Customer Portal so they can manage
 * billing, update payment methods, or cancel.
 * Requires a valid session token (i.e. user must have previously checked out).
 */
export async function openCustomerPortal() {
    if (!STRIPE_CONFIG.workerUrl) {
        console.warn('[Stripe] workerUrl not configured.');
        return;
    }
    const { token } = getSession();
    if (!token) {
        console.warn('[Stripe] No auth token — user is not logged in.');
        return;
    }

    const resp = await fetch(`${STRIPE_CONFIG.workerUrl}/api/portal`, {
        method:  'POST',
        headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ returnUrl: window.location.href }),
    });

    if (!resp.ok) {
        const err = await resp.text().catch(() => resp.statusText);
        throw new Error(`Portal session failed: ${err}`);
    }

    const { url } = await resp.json();
    window.location.href = url;
}

/**
 * Re-validate the stored auth token against the worker and refresh the
 * local session if the subscription status has changed (e.g. renewal,
 * cancellation, plan change).
 *
 * Call at app startup after pruneExpiredSession().
 * Safe to call even when workerUrl is not yet configured (no-op).
 *
 * @returns {Promise<void>}
 */
export async function refreshSession() {
    const { token } = getSession();
    if (!token || !STRIPE_CONFIG.workerUrl) return;

    try {
        const resp = await fetch(`${STRIPE_CONFIG.workerUrl}/api/me`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!resp.ok) {
            // 401 / 403 → token invalid or subscription lapsed → revert to free
            if (resp.status === 401 || resp.status === 403) {
                setSession({ tier: 'free', token: null, expiresAt: null });
            }
            return;
        }
        const data = await resp.json();
        if (data.tier) {
            setSession({
                tier:      data.tier,
                userId:    data.userId   ?? getSession().userId,
                expiresAt: data.expiresAt ?? null,
            });
        }
    } catch (e) {
        // Network failure — keep existing session, don't downgrade.
        console.warn('[Stripe] refreshSession failed (network?):', e.message);
    }
}

/** Returns true if the Stripe integration has been configured (keys filled in). */
export function isStripeConfigured() {
    return !!(STRIPE_CONFIG.workerUrl && STRIPE_CONFIG.prices.proMonthly);
}
