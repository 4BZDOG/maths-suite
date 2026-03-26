// =============================================================
// payments/session.js — Auth/subscription session stub
//
// Currently: stores tier in localStorage so the access module
// can read it without a server.
//
// HOW TO REPLACE WITH A REAL BACKEND:
//   After a successful Stripe checkout + your backend webhook:
//     1. Issue a signed JWT containing { userId, tier, expiresAt }.
//     2. Store it with: session.setSession({ tier, token, expiresAt })
//     3. Expose a GET /api/me endpoint that re-validates the token and
//        returns the current tier (handles subscription lapses, etc.).
//     4. Call session.refreshFromServer() on page load to stay in sync.
//   Everything downstream (access.js, feature gates) reads via
//   session.getSession() and requires no further changes.
// =============================================================

const SESSION_KEY = 'puzzleSuiteSession_v1';

/**
 * @typedef {Object} Session
 * @property {string}      tier        - One of TIER.FREE | TIER.PRO
 * @property {string|null} userId      - Opaque user id from backend (null = anonymous)
 * @property {string|null} token       - Auth token (null until backend wired)
 * @property {number|null} expiresAt   - Unix timestamp ms (null = no expiry)
 */

/** @returns {Session} */
export function getSession() {
    try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (raw) {
            const s = JSON.parse(raw);
            // Expired sessions silently downgrade to free tier.
            // Clearing storage is left to pruneExpiredSession() to avoid getter side-effects.
            if (s.expiresAt && Date.now() > s.expiresAt) {
                return _defaultSession();
            }
            return s;
        }
    } catch (_) { /* corrupt storage — fall through */ }
    return _defaultSession();
}

/**
 * Persist a session (called after login / subscription verification).
 * @param {Partial<Session>} data
 */
export function setSession(data) {
    const current = getSession();
    const next = { ...current, ...data };
    localStorage.setItem(SESSION_KEY, JSON.stringify(next));
}

/** Remove session (called on logout). */
export function clearSession() {
    localStorage.removeItem(SESSION_KEY);
}

/**
 * Remove a stored session that has expired.
 * Call this explicitly at app startup rather than inside getSession() to avoid side-effects.
 */
export function pruneExpiredSession() {
    const s = getSession();
    if (s === _defaultSession() || (s.expiresAt && Date.now() > s.expiresAt)) {
        clearSession();
    }
}

/**
 * Placeholder for a real server round-trip.
 * Replace the body with a fetch to your /api/me endpoint.
 * @returns {Promise<Session>}
 */
export async function refreshFromServer() {
    // TODO: replace with real API call, e.g.:
    // const resp = await fetch('/api/me', { headers: { Authorization: `Bearer ${getSession().token}` } });
    // if (resp.ok) { const data = await resp.json(); setSession(data); }
    return getSession();
}

function _defaultSession() {
    return { tier: 'free', userId: null, token: null, expiresAt: null };
}
