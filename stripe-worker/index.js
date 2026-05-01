// =============================================================
// stripe-worker/index.js — Cloudflare Worker: Stripe payment backend
//
// Routes:
//   POST /api/checkout  — create a Stripe Checkout Session → return {url}
//   GET  /api/verify    — verify completed checkout, issue JWT → return session
//   GET  /api/me        — validate JWT, return current tier
//   POST /api/portal    — create Customer Portal session → return {url}
//   POST /api/webhooks  — handle Stripe webhook events (subscription lifecycle)
//
// Environment (set via `wrangler secret put` or wrangler.toml [vars]):
//   STRIPE_SECRET_KEY      — sk_live_... or sk_test_...  (secret)
//   STRIPE_WEBHOOK_SECRET  — whsec_...                   (secret)
//   JWT_SECRET             — random 32+ char string      (secret)
//   APP_URL                — https://your-pages-site     (var)
//
// KV namespace binding: SUBSCRIPTIONS
//   Stores: customer:{customerId} → { userId, tier, subscriptionId, status }
//   Stores: user:{userId}         → { customerId, tier }
// =============================================================

const CORS_HEADERS = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ---- Router -------------------------------------------------

export default {
    async fetch(request, env) {
        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: CORS_HEADERS });
        }

        const url      = new URL(request.url);
        const { pathname } = url;

        try {
            if (pathname === '/api/checkout' && request.method === 'POST') {
                return handleCheckout(request, env);
            }
            if (pathname === '/api/verify' && request.method === 'GET') {
                return handleVerify(url, env);
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
            return json({ error: 'Not found' }, 404);
        } catch (e) {
            console.error('[worker]', e);
            return json({ error: 'Internal server error' }, 500);
        }
    },
};

// ---- POST /api/checkout -------------------------------------
// Body: { priceId, tier, userId, successUrl, cancelUrl }
// Returns: { url } — Stripe-hosted checkout URL

async function handleCheckout(request, env) {
    const { priceId, tier, userId, successUrl, cancelUrl } = await request.json();

    if (!priceId || !successUrl || !cancelUrl) {
        return json({ error: 'Missing required fields' }, 400);
    }

    const params = new URLSearchParams({
        mode:                           'subscription',
        'line_items[0][price]':         priceId,
        'line_items[0][quantity]':      '1',
        success_url:                    successUrl,
        cancel_url:                     cancelUrl,
        'subscription_data[metadata][tier]':   tier || 'pro',
        'subscription_data[metadata][userId]': userId || '',
        'allow_promotion_codes':        'true',
    });

    // If we already know the Stripe customer for this userId, pre-fill it.
    if (userId) {
        const record = await kvGet(env.SUBSCRIPTIONS, `user:${userId}`);
        if (record?.customerId) {
            params.set('customer', record.customerId);
        }
    }

    const session = await stripePost(env, '/v1/checkout/sessions', params);
    return json({ url: session.url });
}

// ---- GET /api/verify?session_id=xxx -------------------------
// Verifies a completed Checkout Session and issues a JWT.
// Returns: { tier, userId, token, expiresAt }

async function handleVerify(url, env) {
    const sessionId = url.searchParams.get('session_id');
    if (!sessionId) return json({ error: 'Missing session_id' }, 400);

    const session = await stripeGet(
        env,
        `/v1/checkout/sessions/${sessionId}?expand[]=subscription&expand[]=customer`
    );

    if (session.payment_status !== 'paid' && session.status !== 'complete') {
        return json({ error: 'Payment not completed' }, 402);
    }

    const customerId = typeof session.customer === 'string'
        ? session.customer
        : session.customer?.id;

    const userId = session.metadata?.userId
        || session.subscription?.metadata?.userId
        || customerId;

    const tier = _tierFromSubscription(session.subscription);

    // Persist subscription record in KV.
    const subRecord = {
        userId,
        tier,
        subscriptionId: session.subscription?.id ?? null,
        status:         session.subscription?.status ?? 'active',
        customerId,
    };
    await kvPut(env.SUBSCRIPTIONS, `customer:${customerId}`, subRecord);
    await kvPut(env.SUBSCRIPTIONS, `user:${userId}`, { customerId, tier });

    // Issue a signed JWT (30-day expiry).
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
    const token     = await signJwt({ userId, tier, customerId }, expiresAt, env.JWT_SECRET);

    return json({ tier, userId, token, expiresAt });
}

// ---- GET /api/me --------------------------------------------
// Validates the Bearer JWT and returns the current tier.
// Returns 401 on invalid/expired token, 403 on subscription lapse.

async function handleMe(request, env) {
    const token = _extractBearer(request);
    if (!token) return json({ error: 'Unauthorized' }, 401);

    const payload = await verifyJwt(token, env.JWT_SECRET);
    if (!payload) return json({ error: 'Invalid or expired token' }, 401);

    // Re-check KV in case subscription status changed via webhook.
    const record = await kvGet(env.SUBSCRIPTIONS, `user:${payload.userId}`);
    const tier   = record?.tier ?? 'free';

    // If the stored tier no longer matches, the subscription may have lapsed.
    if (tier === 'free' && payload.tier !== 'free') {
        return json({ error: 'Subscription inactive' }, 403);
    }

    const expiresAt = payload.exp ? payload.exp * 1000 : null;
    return json({ tier, userId: payload.userId, expiresAt });
}

// ---- POST /api/portal ---------------------------------------
// Body: { returnUrl }
// Returns: { url } — Stripe Customer Portal URL

async function handlePortal(request, env) {
    const token = _extractBearer(request);
    if (!token) return json({ error: 'Unauthorized' }, 401);

    const payload = await verifyJwt(token, env.JWT_SECRET);
    if (!payload) return json({ error: 'Invalid or expired token' }, 401);

    const { returnUrl } = await request.json().catch(() => ({}));

    const params = new URLSearchParams({
        customer:   payload.customerId,
        return_url: returnUrl || env.APP_URL || '',
    });

    const portalSession = await stripePost(env, '/v1/billing_portal/sessions', params);
    return json({ url: portalSession.url });
}

// ---- POST /api/webhooks -------------------------------------
// Handles Stripe webhook events. Verifies signature before processing.

async function handleWebhook(request, env) {
    const body      = await request.text();
    const signature = request.headers.get('stripe-signature') ?? '';

    const event = await verifyWebhookSignature(body, signature, env.STRIPE_WEBHOOK_SECRET);
    if (!event) return json({ error: 'Invalid signature' }, 400);

    switch (event.type) {
        case 'checkout.session.completed': {
            // Handled by /api/verify — no additional action needed here.
            break;
        }

        case 'customer.subscription.updated': {
            const sub = event.data.object;
            await _upsertSubscription(env, sub);
            break;
        }

        case 'customer.subscription.deleted': {
            // Subscription cancelled or payment failed beyond grace period.
            const sub = event.data.object;
            const customerId = sub.customer;
            const record = await kvGet(env.SUBSCRIPTIONS, `customer:${customerId}`);
            if (record) {
                await kvPut(env.SUBSCRIPTIONS, `customer:${customerId}`, { ...record, tier: 'free', status: 'canceled' });
                if (record.userId) {
                    await kvPut(env.SUBSCRIPTIONS, `user:${record.userId}`, { customerId, tier: 'free' });
                }
            }
            break;
        }

        case 'invoice.payment_failed': {
            // Optional: implement a grace-period approach here if desired.
            // For now we leave the tier active — subscription.deleted fires after all retries.
            break;
        }

        case 'invoice.payment_succeeded': {
            // Subscription renewal — ensure tier record is up to date.
            const invoice = event.data.object;
            if (invoice.subscription) {
                const sub = await stripeGet(
                    env,
                    `/v1/subscriptions/${invoice.subscription}?expand[]=items.data.price`
                );
                await _upsertSubscription(env, sub);
            }
            break;
        }
    }

    return json({ received: true });
}

// ---- Stripe helpers -----------------------------------------

const STRIPE_API = 'https://api.stripe.com';

async function stripeGet(env, path) {
    const resp = await fetch(`${STRIPE_API}${path}`, {
        headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(`Stripe error: ${data.error?.message ?? resp.status}`);
    return data;
}

async function stripePost(env, path, params) {
    const resp = await fetch(`${STRIPE_API}${path}`, {
        method:  'POST',
        headers: {
            Authorization:  `Bearer ${env.STRIPE_SECRET_KEY}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(`Stripe error: ${data.error?.message ?? resp.status}`);
    return data;
}

// Verify a Stripe webhook signature using the Web Crypto API (no stripe-js needed).
async function verifyWebhookSignature(payload, header, secret) {
    // header format: t=timestamp,v1=signature,...
    const parts = Object.fromEntries(
        header.split(',').map(p => p.split('=').map((v, i) => i === 0 ? v.trim() : v))
    );
    const timestamp = parts['t'];
    const expected  = parts['v1'];
    if (!timestamp || !expected) return null;

    const signedPayload = `${timestamp}.${payload}`;
    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
    const computed = Array.from(new Uint8Array(sig))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    if (computed !== expected) return null;

    // Reject events older than 5 minutes to guard against replay attacks.
    if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return null;

    try { return JSON.parse(payload); } catch { return null; }
}

// ---- JWT helpers (HMAC-SHA-256) -----------------------------

async function signJwt(payload, expiresAt, secret) {
    const header  = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const claims  = b64url(JSON.stringify({ ...payload, exp: Math.floor(expiresAt / 1000), iat: Math.floor(Date.now() / 1000) }));
    const data    = `${header}.${claims}`;
    const key     = await _hmacKey(secret);
    const sigBuf  = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
    const sig     = b64url(new Uint8Array(sigBuf));
    return `${data}.${sig}`;
}

async function verifyJwt(token, secret) {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, claims, sig] = parts;
    const key    = await _hmacKey(secret);
    const valid  = await crypto.subtle.verify(
        'HMAC',
        key,
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

function b64url(data) {
    const bytes = typeof data === 'string'
        ? new TextEncoder().encode(data)
        : data;
    return btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str) {
    const padded = str.replace(/-/g, '+').replace(/_/g, '/').padEnd(
        str.length + (4 - str.length % 4) % 4, '='
    );
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

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
}

function _extractBearer(request) {
    const auth = request.headers.get('Authorization') ?? '';
    return auth.startsWith('Bearer ') ? auth.slice(7) : null;
}

function _tierFromSubscription(sub) {
    if (!sub) return 'pro'; // assume pro if subscription object is missing
    if (sub.status === 'active' || sub.status === 'trialing') return 'pro';
    return 'free';
}

async function _upsertSubscription(env, sub) {
    const customerId = sub.customer;
    const tier       = _tierFromSubscription(sub);
    const record     = (await kvGet(env.SUBSCRIPTIONS, `customer:${customerId}`)) ?? {};
    const updated    = { ...record, tier, subscriptionId: sub.id, status: sub.status, customerId };
    await kvPut(env.SUBSCRIPTIONS, `customer:${customerId}`, updated);
    if (record.userId) {
        await kvPut(env.SUBSCRIPTIONS, `user:${record.userId}`, { customerId, tier });
    }
}
