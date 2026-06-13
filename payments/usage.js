// =============================================================
// payments/usage.js — Monthly PDF page-usage meter (client-side)
//
// Tracks how many PDF pages the current browser/session has generated this
// calendar month and compares it against the tier quota from access.js. This
// is the client-side mirror of what a server would enforce — it is deliberately
// non-blocking when storage is unavailable (matching the session.js philosophy:
// never lock a user out because local state is missing or corrupt).
//
// HOW TO BACK THIS WITH THE SERVER (future):
//   1. Add GET/POST /api/usage to stripe-worker/index.js, keyed by month +
//      userId (licensed) or an opaque client id (anonymous), reading quotas
//      from a server copy of TIER_PAGE_QUOTAS.
//   2. recordPages() POSTs the delta; getUsageStatus() reads the server total.
//   3. The server response always wins; this localStorage value becomes the
//      offline fallback. No callers below need to change.
// =============================================================
import { monthKey, quotaStatus } from './pageQuota.js';
import { getMonthlyPageQuota } from './access.js';

const USAGE_KEY = 'puzzleSuiteUsage_v1';

/** @returns {{month:string, pages:number}} the raw stored record (current month only). */
function readUsage() {
    try {
        const raw = localStorage.getItem(USAGE_KEY);
        if (raw) {
            const u = JSON.parse(raw);
            // Roll over: a record from a previous month counts as zero used.
            if (u && u.month === monthKey() && Number.isFinite(u.pages)) {
                return { month: u.month, pages: Math.max(0, u.pages) };
            }
        }
    } catch (_) { /* corrupt/unavailable storage — fall through to a fresh record */ }
    return { month: monthKey(), pages: 0 };
}

function writeUsage(record) {
    try {
        localStorage.setItem(USAGE_KEY, JSON.stringify(record));
    } catch (_) { /* storage full or blocked — metering is best-effort, never throws */ }
}

/** Pages already generated in the current month (0 after a rollover). */
export function getPagesUsed() {
    return readUsage().pages;
}

/**
 * Record that `pages` PDF pages were generated. Called after a successful
 * export with the exact page count (doc.getNumberOfPages()).
 * @param {number} pages
 * @returns {number} new monthly total
 */
export function recordPages(pages) {
    const add = Math.max(0, Math.floor(Number(pages) || 0));
    if (add === 0) return getPagesUsed();
    const current = readUsage();
    const next = { month: monthKey(), pages: current.pages + add };
    writeUsage(next);
    return next.pages;
}

/**
 * Full usage snapshot for the current tier, optionally testing a prospective
 * export of `requested` pages.
 * @param {number} [requested]
 * @returns {{month:string, used:number, quota:number, remaining:number, requested:number, allowed:boolean, unlimited:boolean}}
 */
export function getUsageStatus(requested = 0) {
    const used  = getPagesUsed();
    const quota = getMonthlyPageQuota();
    return { month: monthKey(), ...quotaStatus(used, quota, requested) };
}
