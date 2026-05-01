// =============================================================
// stripe-worker/index.js — Cloudflare Worker: Stripe payment backend
//
// Routes:
//   POST /api/checkout  — create a Stripe Checkout Session → return {url}
//   POST /api/verify    — verify completed checkout, issue JWT → return session
//   GET  /api/me        — validate JWT, return current tier
//   POST /api/portal    — create Customer Portal session → return {url}
//   POST /api/webhooks  — handle Stripe webhook events (subscription lifecycle)
//
// Environment bindings:
//   STRIPE_SECRET_KEY      — sk_live_... or sk_test_...           (wrangler secret)
//   STRIPE_WEBHOOK_SECRET  — whsec_...                            (wrangler secret)
//   JWT_SECRET             — random 32+ char string               (wrangler secret)
//   PRICE_PRO_MONTHLY      — price_1ABC... from Stripe dashboard   (wrangler secret)
//   PRICE_PRO_YEARLY       — price_1XYZ... from Stripe dashboard   (wrangler secret)
//   APP_URL                — https://your-pages-site (no slash)   (wrangler.toml [vars])
//   STRIPE_API_VERSION     — e.g. "2025-04-30"                    (wrangler.toml [vars])
//
// KV namespace binding: SUBSCRIPTIONS
//   customer:{customerId}  → { userId, tier, subscriptionId, status, customerId }
//   user:{userId}          → { customerId, tier }
//   verified:{sessionId}   → { processedAt } — idempotency guard for /api/verify
// =============================================================

// ---- CORS ---------------------------------------------------
// Only allow requests from the known APP_URL origin.
// Falls back to * in dev (when APP_URL is unset) to ease local testing.

function corsHeaders(env, request) {
    const origin    = request.headers.get('Origin') ?? '';
    const appOrigin = env.APP_URL ?? '';
    const allowed   = appOrigin
        ? (origin === appOrigin ? origin : appOrigin)
        : '*';
    return {
        'Access-Control-Allow-Origin':  allowed,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Vary': 'Origin',
    };
}

// ---- Router -------------------------------------------------

export default {
    async fetch(request, env) {
        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders(env, request) });
        }

        const url          = new URL(request.url);
        const { pathname } = url;

        try {
            if (pathname === '/api/checkout' && request.method === 'POST') {
                return handleCheckout(request, env);
            }
            if (pathname === '/api/verify' && request.method === 'POST') {
                return handleVerify(request, env);
            }
            if (pathname === '/api/me' && request.method === 'GET') {
                return handleMe(request, env);
            }
            if (pathname === '/api/portal' && request.method === 'POST') {
                return handlePortal(request, env);
            }
            if (pathname === '/api/webhooks' && request.method === 'POST') {
                return handleWebhook(request, env);
            }
            return json({ error: 'Not found' }, 404, env, request);
        } catch (e) {
            console.error('[worker]', e);
            return json({ error: 'Internal server error' }, 500, env, request);
        }
    },
};

// ---- POST /api/checkout -------------------------------------
// Body: { priceId, userId?, successUrl, cancelUrl }
// Returns: { url } — Stripe-hosted Checkout URL

async function handleCheckout(request, env) {
    const body = await request.json().catch(() => null);
    if (!body) return json({ error: 'Invalid JSON body' }, 400, env, request);

    const { priceId, userId, successUrl, cancelUrl } = body;

    if (!priceId || !successUrl || !cancelUrl) {
        return json({ error: 'Missing required fields: priceId, successUrl, cancelUrl' }, 400, env, request);
    }

    // Validate priceId against known prices — prevents clients from submitting
    // an arbitrary price ID for a different product or lower-cost plan.
    const knownPrices = new Set([env.PRICE_PRO_MONTHLY, env.PRICE_PRO_YEARLY].filter(Boolean));
    if (knownPrices.size > 0 && !knownPrices.has(priceId)) {
        return json({ error: 'Invalid price' }, 400, env, request);
    }

    // Validate that successUrl and cancelUrl belong to our known origin.
    if (!_isAllowedUrl(successUrl, env) || !_isAllowedUrl(cancelUrl, env)) {
        return json({ error: 'Invalid redirect URL' }, 400, env, request);
    }

    const params = new URLSearchParams({
        mode:                      'subscription',
        'line_items[0][price]':    priceId,
        'line_items[0][quantity]': '1',
        success_url:               successUrl,
        cancel_url:                cancelUrl,
        allow_promotion_codes:     'true',
    });

    // Write userId into subscription metadata so webhooks can link back to the user.
    if (userId) {
        params.set('subscription_data[metadata][userId]', userId);
    }

    // If we already have a Stripe customer for this userId, reuse it so the
    // customer doesn't need to re-enter their details.
    if (userId) {
        const userRecord = await kvGet(env.SUBSCRIPTIONS, `user:${userId}`);
        if (userRecord?.customerId) {
            params.set('customer', userRecord.customerId);
        }
    }

    // Idempotency key: tie the checkout session to this user + price + day so
    // network retries won't create duplicate sessions.
    const idempotencyBase = `checkout:${userId ?? 'anon'}:${priceId}:${Math.floor(Date.now() / 86400000)}`;
    const session = await stripePost(env, '/v1/checkout/sessions', params, idempotencyBase);

    return json({ url: session.url }, 200, env, request);
}

// ---- POST /api/verify ---------------------------------------
// Body: { sessionId } — Stripe Checkout Session ID
// Returns: { tier, userId, token, expiresAt }
//
// Uses POST (not GET) so the session_id is not exposed in server access logs.
// Idempotent: replaying the same sessionId returns the same JWT.

async function handleVerify(request, env) {
    const body = await request.json().catch(() => null);
    if (!body?.sessionId) return json({ error: 'Missing sessionId' }, 400, env, request);

    const { sessionId } = body;

    // Idempotency: if we've already issued a JWT for this session, return it.
    const existing = await kvGet(env.SUBSCRIPTIONS, `verified:${sessionId}`);
    if (existing?.token) {
        return json({
            tier:      existing.tier,
            userId:    existing.userId,
            token:     existing.token,
            expiresAt: existing.expiresAt,
        }, 200, env, request);
    }

    const session = await stripeGet(
        env,
        `/v1/checkout/sessions/${sessionId}?expand[]=subscription&expand[]=customer`
    );

    if (session.payment_status !== 'paid' && session.status !== 'complete') {
        return json({ error: 'Payment not completed' }, 402, env, request);
    }

    const customerId = typeof session.customer === 'string'
        ? session.customer
        : session.customer?.id;

    // Prefer userId from metadata; fall back to generating one from customerId
    // so we always have a stable, non-empty identifier.
    const userId = (session.metadata?.userId || session.subscription?.metadata?.userId)
        || `stripe:${customerId}`;

    const tier = _tierFromSubscription(session.subscription);
    if (tier === 'free') {
        // Subscription object is present but not active — don't grant pro access.
        return json({ error: 'Subscription not active' }, 402, env, request);
    }

    // Issue a signed JWT (30-day expiry).
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
    const token     = await signJwt({ userId, tier, customerId }, expiresAt, env.JWT_SECRET);

    // Persist subscription and idempotency records in parallel.
    const subRecord = {
        userId,
        tier,
        subscriptionId: session.subscription?.id ?? null,
        status:         session.subscription?.status ?? 'active',
        customerId,
    };
    await Promise.all([
        kvPut(env.SUBSCRIPTIONS, `customer:${customerId}`, subRecord),
        kvPut(env.SUBSCRIPTIONS, `user:${userId}`, { customerId, tier }),
        // Store the issued token so replay calls return the same JWT.
        kvPut(env.SUBSCRIPTIONS, `verified:${sessionId}`, { token, tier, userId, expiresAt, processedAt: Date.now() }),
    ]);

    return json({ tier, userId, token, expiresAt }, 200, env, request);
}

// ---- GET /api/me --------------------------------------------
// Validates the Bearer JWT and returns the current tier from KV.
// Returns 401 on invalid/expired token.
// If KV has no record (e.g. data loss), the JWT tier is returned rather
// than 403-ing a legitimately paying user.

async function handleMe(request, env) {
    const token = _extractBearer(request);
    if (!token) return json({ error: 'Unauthorized' }, 401, env, request);

    const payload = await verifyJwt(token, env.JWT_SECRET);
    if (!payload) return json({ error: 'Invalid or expired token' }, 401, env, request);

    // KV is the source of truth for current subscription status (updated by webhooks).
    // If KV has no record, trust the JWT rather than punishing the user for KV absence.
    const record  = await kvGet(env.SUBSCRIPTIONS, `user:${payload.userId}`);
    const tier    = record?.tier ?? payload.tier;

    const expiresAt = payload.exp ? payload.exp * 1000 : null;
    return json({ tier, userId: payload.userId, expiresAt }, 200, env, request);
}

// ---- POST /api/portal ---------------------------------------
// Body: { returnUrl? }
// Returns: { url } — Stripe Customer Portal URL

async function handlePortal(request, env) {
    const token = _extractBearer(request);
    if (!token) return json({ error: 'Unauthorized' }, 401, env, request);

    const payload = await verifyJwt(token, env.JWT_SECRET);
    if (!payload) return json({ error: 'Invalid or expired token' }, 401, env, request);

    const { returnUrl } = await request.json().catch(() => ({}));

    // Validate returnUrl belongs to our app.
    const safeReturn = (returnUrl && _isAllowedUrl(returnUrl, env))
        ? returnUrl
        : (env.APP_URL || '');

    const params = new URLSearchParams({
        customer:   payload.customerId,
        return_url: safeReturn,
    });

    const portalSession = await stripePost(env, '/v1/billing_portal/sessions', params);
    return json({ url: portalSession.url }, 200, env, request);
}

// ---- POST /api/webhooks -------------------------------------
// Verifies the Stripe-Signature header before processing any event.
// Returns 200 immediately for unhandled event types (Stripe expects 200).

async function handleWebhook(request, env) {
    const body      = await request.text();
    const signature = request.headers.get('stripe-signature') ?? '';

    const event = await verifyWebhookSignature(body, signature, env.STRIPE_WEBHOOK_SECRET);
    if (!event) {
        // Return 400 so Stripe knows the signature failed (it will retry).
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
            status:  400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    switch (event.type) {
        case 'customer.subscription.updated':
            await _upsertSubscription(env, event.data.object);
            break;

        case 'customer.subscription.deleted': {
            const sub        = event.data.object;
            const customerId = sub.customer;
            const record     = await kvGet(env.SUBSCRIPTIONS, `customer:${customerId}`);
            if (record) {
                await Promise.all([
                    kvPut(env.SUBSCRIPTIONS, `customer:${customerId}`, {
                        ...record, tier: 'free', status: 'canceled',
                    }),
                    record.userId
                        ? kvPut(env.SUBSCRIPTIONS, `user:${record.userId}`, { customerId, tier: 'free' })
                        : Promise.resolve(),
                ]);
            }
            break;
        }

        case 'invoice.payment_succeeded': {
            // Renewal — re-sync subscription status from Stripe in case the plan changed.
            const invoice = event.data.object;
            if (invoice.subscription) {
                const sub = await stripeGet(env, `/v1/subscriptions/${invoice.subscription}`);
                await _upsertSubscription(env, sub);
            }
            break;
        }

        // invoice.payment_failed: leave tier active.
        // Stripe retries several times before firing subscription.deleted.
        // checkout.session.completed: handled by /api/verify (client-initiated).
        default:
            break;
    }

    // Always return 200 with no CORS headers — Stripe sends webhooks server-to-server.
    return new Response(JSON.stringify({ received: true }), {
        status:  200,
        headers: { 'Content-Type': 'application/json' },
    });
}

// ---- Stripe API helpers -------------------------------------

const STRIPE_API     = 'https://api.stripe.com';

function _stripeHeaders(env, extra = {}) {
    return {
        Authorization:   `Bearer ${env.STRIPE_SECRET_KEY}`,
        'Stripe-Version': env.STRIPE_API_VERSION || '2025-04-30',
        ...extra,
    };
}

async function stripeGet(env, path) {
    const resp = await fetch(`${STRIPE_API}${path}`, {
        headers: _stripeHeaders(env),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(`Stripe ${resp.status}: ${data.error?.message ?? path}`);
    return data;
}

async function stripePost(env, path, params, idempotencyKey = '') {
    const headers = _stripeHeaders(env, {
        'Content-Type': 'application/x-www-form-urlencoded',
    });
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

    const resp = await fetch(`${STRIPE_API}${path}`, {
        method:  'POST',
        headers,
        body:    params.toString(),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(`Stripe ${resp.status}: ${data.error?.message ?? path}`);
    return data;
}

// ---- Webhook signature verification -------------------------
// Implements the Stripe-Signature header check using Web Crypto (no SDK needed).

async function verifyWebhookSignature(payload, header, secret) {
    if (!secret) return null;

    // Parse "t=timestamp,v1=hex_sig" — split on first '=' only per segment.
    const parts = {};
    for (const segment of header.split(',')) {
        const eq  = segment.indexOf('=');
        if (eq === -1) continue;
        parts[segment.slice(0, eq).trim()] = segment.slice(eq + 1);
    }

    const timestamp = parts['t'];
    const expected  = parts['v1'];
    if (!timestamp || !expected) return null;

    // Reject events older than 5 minutes (replay-attack guard).
    if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return null;

    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const sigBuf  = await crypto.subtle.sign(
        'HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`)
    );
    const computed = Array.from(new Uint8Array(sigBuf))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    if (computed !== expected) return null;

    try { return JSON.parse(payload); } catch { return null; }
}

// ---- JWT helpers (HMAC-SHA-256) -----------------------------

async function signJwt(payload, expiresAt, secret) {
    const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const claims = b64url(JSON.stringify({
        ...payload,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(expiresAt / 1000),
    }));
    const data   = `${header}.${claims}`;
    const key    = await _hmacKey(secret);
    const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
    return `${data}.${b64url(new Uint8Array(sigBuf))}`;
}

async function verifyJwt(token, secret) {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, claims, sig] = parts;
    const key   = await _hmacKey(secret);
    const valid = await crypto.subtle.verify(
        'HMAC', key,
        b64urlDecode(sig),
        new TextEncoder().encode(`${header}.${claims}`)
    );
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(claims)));
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    return payload;
}

async function _hmacKey(secret) {
    return crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign', 'verify']
    );
}

// Safe base64url encoding — avoids spread-operator stack overflow on large buffers.
function b64url(data) {
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    let binary  = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str) {
    const padded = str.replace(/-/g, '+').replace(/_/g, '/')
        .padEnd(str.length + (4 - str.length % 4) % 4, '=');
    return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}

// ---- KV helpers ---------------------------------------------

async function kvGet(kv, key) {
    if (!kv) return null;
    const raw = await kv.get(key);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
}

async function kvPut(kv, key, value) {
    if (!kv) return;
    await kv.put(key, JSON.stringify(value));
}

// ---- Misc helpers -------------------------------------------

function json(data, status = 200, env, request) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            ...corsHeaders(env, request),
            'Content-Type': 'application/json',
        },
    });
}

function _extractBearer(request) {
    const auth = request.headers.get('Authorization') ?? '';
    return auth.startsWith('Bearer ') ? auth.slice(7) : null;
}

// Returns 'pro' only for confirmed active/trialing subscriptions.
// Returns 'free' for any other status (past_due, canceled, null, etc.).
function _tierFromSubscription(sub) {
    if (!sub) return 'free';
    return (sub.status === 'active' || sub.status === 'trialing') ? 'pro' : 'free';
}

// Returns true if the URL's origin matches our known APP_URL.
// If APP_URL is unset (local dev), all URLs are allowed.
function _isAllowedUrl(url, env) {
    if (!env.APP_URL) return true;
    try {
        return new URL(url).origin === new URL(env.APP_URL).origin;
    } catch {
        return false;
    }
}

async function _upsertSubscription(env, sub) {
    const customerId = sub.customer;
    const tier       = _tierFromSubscription(sub);
    const record     = (await kvGet(env.SUBSCRIPTIONS, `customer:${customerId}`)) ?? {};
    const updated    = { ...record, tier, subscriptionId: sub.id, status: sub.status, customerId };
    await Promise.all([
        kvPut(env.SUBSCRIPTIONS, `customer:${customerId}`, updated),
        record.userId
            ? kvPut(env.SUBSCRIPTIONS, `user:${record.userId}`, { customerId, tier })
            : Promise.resolve(),
    ]);
}
