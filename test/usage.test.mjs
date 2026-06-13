// =============================================================
// test/usage.test.mjs — page-metering quota math
//
// Covers the pure helpers in payments/pageQuota.js that drive the monthly
// PDF page allowance. The localStorage wrapper (payments/usage.js) and the
// access-tier resolver are browser-only and exercised manually; the
// page-counting and quota arithmetic below are the parts worth pinning down.
// =============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { monthKey, estimateExportPages, quotaStatus } from '../payments/pageQuota.js';

test('monthKey is a stable UTC YYYY-MM bucket', () => {
    assert.equal(monthKey(new Date(Date.UTC(2026, 5, 13, 22, 26))), '2026-06');
    assert.equal(monthKey(new Date(Date.UTC(2026, 0, 1, 0, 0))), '2026-01');
    assert.equal(monthKey(new Date(Date.UTC(2026, 11, 31, 23, 59))), '2026-12');
});

test('estimateExportPages counts difficulty bands × pages-per-band', () => {
    // 3 bands, single page each, no key/formula → 3
    assert.equal(estimateExportPages({ opts: { easy: true, medium: true, hard: true }, pagesPerDiff: 1, count: 1 }), 3);
    // 3 bands × 2 pages = 6
    assert.equal(estimateExportPages({ opts: { easy: true, medium: true, hard: true }, pagesPerDiff: 2, count: 1 }), 6);
});

test('estimateExportPages adds key and formula-sheet pages once per copy', () => {
    const perCopy = estimateExportPages({
        opts: { easy: true, medium: true, hard: true, key: true },
        showFormulaSheet: true,
        pagesPerDiff: 1,
        count: 1,
    });
    assert.equal(perCopy, 3 + 1 + 1); // 3 bands + key + formula
});

test('estimateExportPages multiplies by bulk copy count', () => {
    assert.equal(estimateExportPages({ opts: { easy: true, medium: true, hard: true, key: true }, pagesPerDiff: 1, count: 10 }), 40);
});

test('estimateExportPages clamps degenerate inputs', () => {
    assert.equal(estimateExportPages({}), 0);                       // nothing selected
    assert.equal(estimateExportPages({ opts: { key: true }, count: 0 }), 1); // count floored to 1
    assert.equal(estimateExportPages({ opts: { easy: true }, pagesPerDiff: 0 }), 1); // per-band floored to 1
});

test('quotaStatus allows when within the monthly allowance', () => {
    const s = quotaStatus(10, 30, 5);
    assert.equal(s.allowed, true);
    assert.equal(s.remaining, 20);
    assert.equal(s.unlimited, false);
});

test('quotaStatus blocks when the request would exceed the quota', () => {
    const s = quotaStatus(28, 30, 5); // 28 + 5 = 33 > 30
    assert.equal(s.allowed, false);
    assert.equal(s.remaining, 2);
});

test('quotaStatus treats exact-fill as allowed', () => {
    assert.equal(quotaStatus(25, 30, 5).allowed, true); // 25 + 5 = 30
});

test('quotaStatus never reports negative remaining', () => {
    const s = quotaStatus(40, 30, 0); // already over (e.g. one big bulk run)
    assert.equal(s.remaining, 0);
    assert.equal(s.allowed, false);
});

test('quotaStatus with Infinity quota is always unlimited and allowed', () => {
    const s = quotaStatus(9999, Infinity, 500);
    assert.equal(s.unlimited, true);
    assert.equal(s.allowed, true);
    assert.equal(s.remaining, Infinity);
    assert.equal(s.quota, Infinity);
});
