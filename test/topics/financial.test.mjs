// =============================================================
// test/topics/financial.test.mjs — Financial Maths verifiers.
//
// Re-derive simple/compound interest, GST, markup, discount answers
// from numbers extracted from the clue. Each shape uses a targeted
// regex so percentage / dollar / count values are not confused.
// =============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { gen, DIFFS, approxEqual } from '../_helpers.mjs';

const RE_DOLLAR = /\$\\\$(\d+(?:\.\d+)?)\$/g;     // matches "$\$123$" → 123
const RE_PCT    = /\$(\d+(?:\.\d+)?)\\%\$/g;       // matches "$10\%$" → 10

function dollars(c) { return [...c.matchAll(RE_DOLLAR)].map(m => Number(m[1])); }
function pcts(c)    { return [...c.matchAll(RE_PCT)].map(m => Number(m[1])); }

test('Financial: SI, GST, markup, discount, compound answers match recomputed values', () => {
    let checked = 0;
    for (const diff of DIFFS) {
        for (let seed = 1; seed <= 250; seed++) {
            const qs = gen({ topic: 'Financial Maths', difficulty: diff, count: 8, seed });
            for (const q of qs) {
                const c = q.clue;
                const ans = Number(q.answer);
                if (!Number.isFinite(ans)) continue;
                const D = dollars(c), P = pcts(c);

                // --- Simple interest: I = Prn  (P=$, r=%, t=years)
                if (/simple interest/i.test(c) && D.length >= 1 && P.length >= 1) {
                    const tm = c.match(/for \$(\d+)\$ year/);
                    if (tm) {
                        const Pr = D[0], r = P[0], t = +tm[1];
                        const exp = Pr * r / 100 * t;
                        assert.ok(approxEqual(ans, exp),
                            `${diff}/seed${seed}: SI "${c.slice(0,70)}…" → ${ans} (expected ${exp})`);
                        checked++; continue;
                    }
                }
                // --- Pre-GST: pre = total / 1.1.  Discriminator: the question asks
                // for the pre-GST / *before* GST price explicitly. Check this FIRST
                // because the "before GST" setup also appears in GST-add clues.
                if (/GST/i.test(c) && /pre-GST|\*before\*/i.test(c) && D.length >= 1) {
                    const exp = Math.round(D[0] / 1.1 * 100) / 100;
                    assert.ok(approxEqual(ans, exp),
                        `${diff}/seed${seed}: pre-GST "${c.slice(0,70)}…" → ${ans} (expected ${exp})`);
                    checked++; continue;
                }
                // --- GST add: total = price * 1.1
                if (/GST/i.test(c) && /add|including|inclusive price|after.*GST|total price including/i.test(c)
                    && D.length >= 1) {
                    const exp = Math.round(D[0] * 1.1 * 100) / 100;
                    assert.ok(approxEqual(ans, exp),
                        `${diff}/seed${seed}: GST add "${c.slice(0,70)}…" → ${ans} (expected ${exp})`);
                    checked++; continue;
                }
                // --- Markup → sell: sell = cost * (1 + pct/100)
                if (/mark-?up|profit margin/i.test(c) && /selling price|sell/i.test(c)
                    && !/percentage profit|profit %|profit percentage/i.test(c)
                    && D.length >= 1 && P.length >= 1) {
                    const cost = D[0], pct = P[0];
                    const exp = cost * (1 + pct / 100);
                    assert.ok(approxEqual(ans, exp),
                        `${diff}/seed${seed}: markup "${c.slice(0,70)}…" → ${ans} (expected ${exp})`);
                    checked++; continue;
                }
                // --- Discount → sale price: sale = orig * (1 − pct/100)
                if (/discount|on sale|reduced/i.test(c) && /sale price|sale at/i.test(c)
                    && D.length >= 1 && P.length >= 1) {
                    const orig = D[0], pct = P[0];
                    const exp = orig * (1 - pct / 100);
                    assert.ok(approxEqual(ans, exp),
                        `${diff}/seed${seed}: discount "${c.slice(0,70)}…" → ${ans} (expected ${exp})`);
                    checked++; continue;
                }
                // --- Compound interest amount: A = P(1+r/100)^n
                if (/compound/i.test(c) && /total amount|final value/i.test(c)
                    && D.length >= 1 && P.length >= 1) {
                    const tm = c.match(/for \$(\d+)\$ year/);
                    if (tm) {
                        const Pr = D[0], r = P[0], t = +tm[1];
                        const exp = Math.round(Pr * Math.pow(1 + r / 100, t) * 100) / 100;
                        assert.ok(approxEqual(ans, exp),
                            `${diff}/seed${seed}: compound "${c.slice(0,70)}…" → ${ans} (expected ${exp})`);
                        checked++; continue;
                    }
                }
            }
        }
    }
    assert.ok(checked > 80, `only ${checked} financial questions verified`);
});
