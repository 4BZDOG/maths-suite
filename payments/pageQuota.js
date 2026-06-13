// =============================================================
// payments/pageQuota.js — Pure page-metering helpers (no DOM, no storage)
//
// The monetisation primitive for the maths suite is the PDF *page*: a free
// user gets a monthly page allowance, paid tiers get an unlimited one. These
// helpers are deliberately side-effect-free so they can be unit-tested under
// `node --test` (see test/usage.test.mjs). The localStorage wrapper lives in
// payments/usage.js; the server-side enforcement counterpart is documented in
// monetisation.md.
// =============================================================

/**
 * Calendar-month bucket key in UTC, e.g. '2026-06'. Usage resets when this
 * value rolls over. UTC keeps the boundary stable regardless of the user's
 * timezone (and matches what a server would compute).
 * @param {Date} [date]
 * @returns {string}
 */
export function monthKey(date = new Date()) {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
}

/**
 * Estimate how many PDF pages an export will produce, BEFORE generating it.
 * Mirrors the page accounting in pdf/pdfExport.js / renderExportPreview():
 *   per copy = (selected difficulty bands × pages-per-band)
 *            + answer key (1 page, capped)
 *            + formula sheet (1 page)
 * The actual page count recorded after export uses doc.getNumberOfPages(),
 * so this is only used for the pre-export quota gate.
 *
 * @param {Object}  opts
 * @param {Object}  [opts.opts]            - page-enable map { easy, medium, hard, key }
 * @param {boolean} [opts.showFormulaSheet]
 * @param {number}  [opts.pagesPerDiff]    - 1 or 2 (state.questionsPerSet)
 * @param {number}  [opts.count]           - bulk copy count
 * @returns {number}
 */
export function estimateExportPages({ opts = {}, showFormulaSheet = false, pagesPerDiff = 1, count = 1 } = {}) {
    const bands     = ['easy', 'medium', 'hard'].filter(d => opts[d]).length;
    const perDiff   = Math.max(1, Number(pagesPerDiff) || 1);
    const perCopy   = bands * perDiff
                    + (opts.key ? 1 : 0)
                    + (showFormulaSheet ? 1 : 0);
    return Math.max(0, perCopy) * Math.max(1, Number(count) || 1);
}

/**
 * Resolve a usage snapshot against a quota and a requested page count.
 * A quota of Infinity (paid tiers) always allows the export.
 *
 * @param {number} used      - pages already consumed this month
 * @param {number} quota     - monthly page allowance (Infinity = unlimited)
 * @param {number} requested - pages this export would add
 * @returns {{used:number, quota:number, remaining:number, requested:number, allowed:boolean, unlimited:boolean}}
 */
export function quotaStatus(used, quota, requested = 0) {
    const u   = Math.max(0, Math.floor(Number(used) || 0));
    const req = Math.max(0, Math.floor(Number(requested) || 0));
    const unlimited = quota === Infinity || quota == null;
    const remaining = unlimited ? Infinity : Math.max(0, quota - u);
    const allowed   = unlimited ? true : (u + req) <= quota;
    return { used: u, quota: unlimited ? Infinity : quota, remaining, requested: req, allowed, unlimited };
}
