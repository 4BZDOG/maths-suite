// Worker unit tests — mocked KV/env and a stubbed global fetch (no network).
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import worker, { signJwt, verifyJwt, verifyWebhookSignature, monthKey, nextMonthStartIso }
    from '../stripe-worker/index.js';

const APP = 'https://app.example.test';

function mockKV() {
    const m = new Map();
    return {
        m,
        async get(k) { return m.has(k) ? m.get(k) : null; },
        async put(k, v) { m.set(k, v); },
    };
}

function mkEnv(over = {}) {
    return {
        JWT_SECRET: 'test-secret-not-real-0123456789abcdef',
        STRIPE_SECRET_KEY: 'sk_test_placeholder',
        STRIPE_WEBHOOK_SECRET: 'whsec_placeholder',
        PRICE_PRO_MONTHLY: 'price_m',
        PRICE_PRO_YEARLY: 'price_y',
        APP_URL: APP,
        SUBSCRIPTIONS: mockKV(),
        ...over,
    };
}

function call(env, method, path, { token, body, ip } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (ip) headers['CF-Connecting-IP'] = ip;
    return worker.fetch(new Request(`https://worker.test${path}`, {
        method, headers, body: body ? JSON.stringify(body) : undefined,
    }), env);
}

const realFetch = globalThis.fetch;
let stripeCalls;
beforeEach(() => {
    stripeCalls = [];
    globalThis.fetch = async (url, init) => {
        stripeCalls.push({ url: String(url), body: init?.body });
        return new Response(JSON.stringify({ url: 'https://checkout.stripe.test/s' }), { status: 200 });
    };
});
afterEach(() => { globalThis.fetch = realFetch; });

async function newIdentity(env, ip = '1.1.1.1') {
    const r = await call(env, 'POST', '/api/identity', { ip });
    assert.equal(r.status, 200);
    return r.json();
}

test('identity: issues a signed anonymous token and re-issues the same id', async () => {
    const env = mkEnv();
    const a = await newIdentity(env);
    assert.match(a.userId, /^anon:[0-9a-f-]{36}$/);
    assert.equal(a.tier, 'free');
    const payload = await verifyJwt(a.token, env.JWT_SECRET);
    assert.equal(payload.userId, a.userId);
    const again = await (await call(env, 'POST', '/api/identity', { token: a.token })).json();
    assert.equal(again.userId, a.userId);
});

test('identity: rate-limited per IP', async () => {
    const env = mkEnv({ IDENTITY_PER_IP_DAILY: '2' });
    await newIdentity(env, '9.9.9.9');
    await newIdentity(env, '9.9.9.9');
    const r = await call(env, 'POST', '/api/identity', { ip: '9.9.9.9' });
    assert.equal(r.status, 429);
    assert.equal((await call(env, 'POST', '/api/identity', { ip: '8.8.8.8' })).status, 200);
});

test('checkout: rejects unauthenticated and forged tokens', async () => {
    const env = mkEnv();
    const body = { priceId: 'price_m', successUrl: `${APP}/ok`, cancelUrl: `${APP}/no` };
    assert.equal((await call(env, 'POST', '/api/checkout', { body })).status, 401);
    const forged = await signJwt({ userId: 'anon:x', tier: 'free' }, Date.now() + 1e6, 'some-other-secret');
    assert.equal((await call(env, 'POST', '/api/checkout', { token: forged, body })).status, 401);
    assert.equal(stripeCalls.length, 0);
});

test('checkout: rejects a client userId that differs from the verified identity', async () => {
    const env = mkEnv();
    const id = await newIdentity(env);
    const body = { priceId: 'price_m', successUrl: `${APP}/ok`, cancelUrl: `${APP}/no`, userId: 'anon:someone-else' };
    const r = await call(env, 'POST', '/api/checkout', { token: id.token, body });
    assert.equal(r.status, 403);
    assert.equal(stripeCalls.length, 0);
});

test('checkout: binds Stripe metadata to the verified userId', async () => {
    const env = mkEnv();
    const id = await newIdentity(env);
    const body = { priceId: 'price_m', successUrl: `${APP}/ok`, cancelUrl: `${APP}/no`, userId: id.userId };
    const r = await call(env, 'POST', '/api/checkout', { token: id.token, body });
    assert.equal(r.status, 200);
    const sent = new URLSearchParams(stripeCalls[0].body);
    assert.equal(sent.get('metadata[userId]'), id.userId);
    assert.equal(sent.get('subscription_data[metadata][userId]'), id.userId);
    assert.equal(sent.get('client_reference_id'), id.userId);
});

test('checkout: still validates price and redirect origin', async () => {
    const env = mkEnv();
    const id = await newIdentity(env);
    const ok = { successUrl: `${APP}/ok`, cancelUrl: `${APP}/no` };
    assert.equal((await call(env, 'POST', '/api/checkout', { token: id.token, body: { ...ok, priceId: 'price_evil' } })).status, 400);
    assert.equal((await call(env, 'POST', '/api/checkout', {
        token: id.token, body: { priceId: 'price_m', successUrl: 'https://evil.test/', cancelUrl: `${APP}/no` },
    })).status, 400);
});

test('export-count: requires auth', async () => {
    const env = mkEnv();
    assert.equal((await call(env, 'POST', '/api/export-count')).status, 401);
});

test('export-count: increments then returns 429 at the free monthly cap', async () => {
    const env = mkEnv({ FREE_MONTHLY_EXPORTS: '3' });
    const id = await newIdentity(env);
    for (let i = 1; i <= 3; i++) {
        const r = await call(env, 'POST', '/api/export-count', { token: id.token });
        assert.equal(r.status, 200);
        const j = await r.json();
        assert.equal(j.count, i); assert.equal(j.limit, 3); assert.equal(j.allowed, true);
        assert.equal(j.remaining, 3 - i);
    }
    const blocked = await call(env, 'POST', '/api/export-count', { token: id.token });
    assert.equal(blocked.status, 429);
    const j = await blocked.json();
    assert.equal(j.allowed, false); assert.equal(j.count, 3);
    assert.equal(j.resetsAt, nextMonthStartIso());
    // GET peeks without counting.
    const peek = await (await call(env, 'GET', '/api/export-count', { token: id.token })).json();
    assert.equal(peek.count, 3); assert.equal(peek.allowed, false);
});

test('export-count: counters are per user and per month key', async () => {
    const env = mkEnv({ FREE_MONTHLY_EXPORTS: '1' });
    const a = await newIdentity(env, '2.2.2.2');
    const b = await newIdentity(env, '3.3.3.3');
    assert.equal((await call(env, 'POST', '/api/export-count', { token: a.token })).status, 200);
    assert.equal((await call(env, 'POST', '/api/export-count', { token: a.token })).status, 429);
    assert.equal((await call(env, 'POST', '/api/export-count', { token: b.token })).status, 200);
    assert.ok(env.SUBSCRIPTIONS.m.has(`exports:${a.userId}:${monthKey()}`));
    assert.equal(monthKey(new Date('2026-02-28T23:59:59Z')), '2026-02');
    assert.equal(nextMonthStartIso(new Date('2026-12-15T00:00:00Z')), '2027-01-01T00:00:00.000Z');
});

test('export-count: pro tier (from KV) is unlimited and not counted', async () => {
    const env = mkEnv({ FREE_MONTHLY_EXPORTS: '1' });
    const id = await newIdentity(env);
    env.SUBSCRIPTIONS.m.set(`user:${id.userId}`, JSON.stringify({ customerId: 'cus_1', tier: 'pro' }));
    for (let i = 0; i < 3; i++) {
        const r = await call(env, 'POST', '/api/export-count', { token: id.token });
        assert.equal(r.status, 200);
        const j = await r.json();
        assert.equal(j.limit, null); assert.equal(j.allowed, true);
    }
    assert.ok(![...env.SUBSCRIPTIONS.m.keys()].some(k => k.startsWith('exports:')));
});

test('fails closed when JWT_SECRET is unset', async () => {
    const env = mkEnv({ JWT_SECRET: undefined });
    assert.equal((await call(env, 'POST', '/api/identity')).status, 500);
});

// ---- Webhook signature (constant-time compare retained) -----
async function sign(payload, secret, t) {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${payload}`));
    return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

test('webhook signature: accepts valid, rejects tampered / stale / wrong secret', async () => {
    const payload = JSON.stringify({ type: 'invoice.payment_failed', data: { object: {} } });
    const t = Math.floor(Date.now() / 1000);
    const good = await sign(payload, 'whsec_placeholder', t);
    assert.deepEqual((await verifyWebhookSignature(payload, `t=${t},v1=${good}`, 'whsec_placeholder')).type, 'invoice.payment_failed');
    assert.equal(await verifyWebhookSignature(payload + ' ', `t=${t},v1=${good}`, 'whsec_placeholder'), null);
    assert.equal(await verifyWebhookSignature(payload, `t=${t},v1=${good}`, 'whsec_other'), null);
    assert.equal(await verifyWebhookSignature(payload, `t=${t},v1=${good.slice(0, -1)}0`, 'whsec_placeholder'), null);
    const old = t - 3600;
    assert.equal(await verifyWebhookSignature(payload, `t=${old},v1=${await sign(payload, 'whsec_placeholder', old)}`, 'whsec_placeholder'), null);
});

test('webhook route: bad signature -> 400, good signature -> 200', async () => {
    const env = mkEnv();
    const payload = JSON.stringify({ type: 'invoice.payment_failed', data: { object: {} } });
    const t = Math.floor(Date.now() / 1000);
    const bad = await worker.fetch(new Request('https://worker.test/api/webhooks', {
        method: 'POST', headers: { 'stripe-signature': `t=${t},v1=deadbeef` }, body: payload }), env);
    assert.equal(bad.status, 400);
    const ok = await worker.fetch(new Request('https://worker.test/api/webhooks', {
        method: 'POST', headers: { 'stripe-signature': `t=${t},v1=${await sign(payload, env.STRIPE_WEBHOOK_SECRET, t)}` }, body: payload }), env);
    assert.equal(ok.status, 200);
});
