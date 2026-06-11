// =============================================================
// test/topics/number-recompute.test.mjs — closes the three
// answer-recomputation gaps from the 2026-06 audit: these sub-ops were
// previously structure-tested only.
//   1. Rounding → significant figures
//   2. Fractions → Hard multiply-divide (fraction division)
//   3. Percentages → increase-decrease (single, successive, cascading)
// Each test independently recomputes the answer from the clue text.
// =============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { gen, approxEqual } from '../_helpers.mjs';

const SEEDS = Array.from({ length: 60 }, (_, i) => 9000 + i * 17);

function mathSpans(clue) {
    // '\$' is an escaped (currency) dollar inside math — neutralise it first so
    // it isn't mistaken for a span delimiter, e.g. "$\$10$" → span '§10'.
    const cleaned = clue.replaceAll('\\$', '§');
    return [...cleaned.matchAll(/\$([^$]+)\$/g)].map(m => m[1]);
}

// "$\$400$" → 400, "$25\%$" → skip, "$320$" → 320
function plainNumbers(clue) {
    return mathSpans(clue)
        .map(s => /^§?([\d.]+)$/.exec(s))
        .filter(Boolean)
        .map(m => Number(m[1]));
}

function percentages(clue) {
    return mathSpans(clue)
        .map(s => /^([\d.]+)\\%$/.exec(s))
        .filter(Boolean)
        .map(m => Number(m[1]));
}

// ---- 1. Rounding: significant figures ------------------------

test('Rounding sig-figs: answer matches independent recomputation', () => {
    let checked = 0;
    for (const seed of SEEDS) {
        for (const difficulty of ['Medium', 'Hard']) {
            const qs = gen({
                topic: 'Rounding', difficulty, count: 6, seed,
                subOpsFilter: { 'Rounding': ['sig-figs'] },
            });
            for (const q of qs) {
                const sf = /(\d+)\s*(?:significant\s+figure|s\.f\.)/.exec(q.clue);
                const nums = plainNumbers(q.clue);
                assert.ok(sf && nums.length >= 1, `unparseable sig-fig clue: "${q.clue}"`);
                const k = Number(sf[1]);
                const n = nums[0];
                const factor = Math.pow(10, Math.floor(Math.log10(n)) - (k - 1));
                const expected = Math.round(n / factor) * factor;
                assert.ok(approxEqual(Number(q.answer), expected),
                    `sig-figs: "${q.clue}" → got ${q.answer}, expected ${expected}`);
                checked++;
            }
        }
    }
    assert.ok(checked >= 100, `too few sig-fig questions checked (${checked})`);
});

// ---- 2. Fractions: Hard multiply-divide (division) ------------

function parseFracAnswer(ans) {
    const f = /^\$?\\frac\{(\d+)\}\{(\d+)\}\$?$/.exec(String(ans).trim());
    if (f) return Number(f[1]) / Number(f[2]);
    const n = Number(ans);
    return Number.isFinite(n) ? n : null;
}

test('Fractions Hard multiply-divide: quotient matches (n1/d1) ÷ (n2/d2)', () => {
    let checked = 0;
    for (const seed of SEEDS) {
        const qs = gen({
            topic: 'Fractions', difficulty: 'Hard', count: 6, seed,
            subOpsFilter: { 'Fractions': ['multiply-divide'] },
        });
        for (const q of qs) {
            const fracs = [...q.clue.matchAll(/\\frac\{(\d+)\}\{(\d+)\}/g)]
                .map(m => Number(m[1]) / Number(m[2]));
            assert.ok(fracs.length >= 2, `expected two fractions in clue: "${q.clue}"`);
            // Word problem "How many X-sized servings can be poured from Y?"
            // names the divisor first; every other phrasing is dividend-first.
            const expected = /poured from/.test(q.clue)
                ? fracs[1] / fracs[0]
                : fracs[0] / fracs[1];
            const got = parseFracAnswer(q.answer);
            assert.ok(got !== null, `unparseable answer "${q.answer}" for "${q.clue}"`);
            assert.ok(approxEqual(got, expected, 1e-9),
                `division: "${q.clue}" → got ${q.answer} (${got}), expected ${expected}`);
            checked++;
        }
    }
    assert.ok(checked >= 100, `too few division questions checked (${checked})`);
});

// ---- 3. Percentages: increase-decrease ------------------------

test('Percentages increase-decrease: recomputed across all variants', () => {
    let checked = 0;
    for (const seed of SEEDS) {
        for (const difficulty of ['Easy', 'Medium', 'Hard']) {
            const qs = gen({
                topic: 'Percentages', difficulty, count: 6, seed,
                subOpsFilter: { 'Percentages': ['increase-decrease'] },
            });
            for (const q of qs) {
                const pcts = percentages(q.clue);
                const nums = plainNumbers(q.clue);
                const got = Number(q.answer);
                let expected;

                if (pcts.length >= 2 && /\\%\$ of /.test(q.clue)) {
                    // Hard type 4: "Find $p2\%$ of $p1\%$ of $whole$" — commutative
                    assert.equal(nums.length, 1, `cascading: "${q.clue}"`);
                    expected = pcts.reduce((acc, p) => acc * p / 100, nums[0]);
                } else if (pcts.length === 2) {
                    // Hard type 3: successive change with per-step direction
                    const dirs = q.clue.match(/increased|decreased/g);
                    assert.ok(dirs?.length === 2 && nums.length === 1,
                        `successive: "${q.clue}"`);
                    expected = nums[0];
                    dirs.forEach((d, i) => {
                        expected *= d === 'increased' ? 1 + pcts[i] / 100 : 1 - pcts[i] / 100;
                    });
                } else {
                    // Easy/Medium single increase or decrease
                    assert.ok(pcts.length === 1 && nums.length === 1,
                        `single change: "${q.clue}"`);
                    const down = /decreas|reduc|discount|fall/i.test(q.clue);
                    expected = nums[0] * (down ? 1 - pcts[0] / 100 : 1 + pcts[0] / 100);
                }

                assert.ok(approxEqual(got, expected, 1e-6),
                    `${difficulty}: "${q.clue}" → got ${q.answer}, expected ${expected}`);
                checked++;
            }
        }
    }
    assert.ok(checked >= 150, `too few increase-decrease questions checked (${checked})`);
});
