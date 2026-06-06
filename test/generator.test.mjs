// =============================================================
// test/generator.test.mjs — core correctness harness for the maths
// question generator. Run with:  npm test  (or:  node --test)
//
// This file covers the five core Number topics in depth. Per-topic
// verifiers for the other eight topics live in test/topics/*.test.mjs.
// Shared utilities are in test/_helpers.mjs.
// =============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    gen, DIFFS, STAGE4_TOPICS, STAGE5_TOPICS,
    approxEqual, evalPlainExpr, evalNumericClue, checkStructure,
} from './_helpers.mjs';

const CORE = ['Integers', 'Decimals', 'Rounding', 'Fractions', 'Percentages'];

// ---- Per-core-topic deep arithmetic check -------------------
for (const topic of CORE) {
    for (const diff of DIFFS) {
        test(`${topic} / ${diff}: structure + arithmetic over many seeds`, () => {
            let checkedArith = 0;
            for (let seed = 1; seed <= 200; seed++) {
                const qs = gen({ topic, difficulty: diff, count: 8, seed });
                for (const q of qs) {
                    const label = `${topic}/${diff}/seed${seed}`;
                    checkStructure(q, label, assert);
                    const expected = evalNumericClue(q.clue);
                    if (expected !== null) {
                        const got = Number(q.answer);
                        assert.ok(
                            !Number.isNaN(got) && approxEqual(got, expected),
                            `${label}: clue "${q.clue}" → generator answer ${q.answer}, independent eval ${expected}`
                        );
                        checkedArith++;
                    }
                }
            }
            if (topic === 'Integers' || topic === 'Decimals') {
                assert.ok(checkedArith > 50, `${topic}/${diff}: only ${checkedArith} arithmetic clues auto-checked`);
            }
        });
    }
}

// ---- All-topics structural sweep ----------------------------
// Every topic at every difficulty must:
//  - generate at least one question per seed
//  - pass all structural invariants
// This is the floor that catches "regressed a generator to null".
const ALL_TOPICS = [...STAGE4_TOPICS, ...STAGE5_TOPICS];
test('every topic produces structurally valid questions at every difficulty', () => {
    for (const topic of ALL_TOPICS) {
        for (const diff of DIFFS) {
            let total = 0;
            for (let seed = 1; seed <= 30; seed++) {
                const qs = gen({ topic, difficulty: diff, count: 6, seed });
                total += qs.length;
                for (const q of qs) checkStructure(q, `${topic}/${diff}/seed${seed}`, assert);
            }
            assert.ok(total >= 30,
                `${topic}/${diff}: produced only ${total} questions across 30 seeds (expected ≥ 30)`);
        }
    }
});

// ---- worked-solution self-consistency -----------------------
function parseWorked(worked) {
    if (!worked) return null;
    const inner = worked.replace(/^\$|\$$/g, '');
    const eq = inner.lastIndexOf('=');
    if (eq === -1) return null;
    const rhsRaw = inner.slice(eq + 1).trim();
    const rhs = Number(rhsRaw.replace(/[^0-9.\-]/g, ''));
    if (!Number.isFinite(rhs)) return null;
    let left = inner.slice(0, eq);
    const approx = left.lastIndexOf('\\approx');
    if (approx !== -1) left = left.slice(approx + '\\approx'.length);
    const colon = left.lastIndexOf(':');
    if (colon !== -1) left = left.slice(colon + 1);
    return { rhs, expr: left };
}

test('worked solutions are self-consistent (stated result matches answer & arithmetic)', () => {
    let checked = 0;
    for (const topic of CORE) {
        for (const diff of DIFFS) {
            for (let seed = 1; seed <= 120; seed++) {
                const qs = gen({ topic, difficulty: diff, count: 8, seed });
                for (const q of qs) {
                    const w = parseWorked(q.worked);
                    if (!w) continue;
                    const ans = Number(q.answer);
                    if (!Number.isFinite(ans)) continue;
                    assert.ok(approxEqual(w.rhs, ans),
                        `${topic}/${diff}/seed${seed}: worked result ${w.rhs} ≠ answer ${ans} | "${q.worked}"`);
                    const lhs = evalPlainExpr(w.expr);
                    if (lhs !== null) {
                        assert.ok(approxEqual(lhs, w.rhs),
                            `${topic}/${diff}/seed${seed}: worked LHS ${lhs} ≠ RHS ${w.rhs} | "${q.worked}"`);
                        checked++;
                    }
                }
            }
        }
    }
    assert.ok(checked > 20, `worked-consistency only exercised ${checked} expressions`);
});

// ---- missing-number / inverse questions ---------------------
test('missing-number (inverse) questions: substituting the answer satisfies the equation', () => {
    const evalSide = s => {
        const e = s.replace(/\\square/g, '#SQ#').trim();
        if (!/^[0-9+\-*/().\s#SQ]+$/.test(e)) return null;
        try { return Function(`"use strict"; return (${e.replace(/#SQ#/g, '')});`)(); }
        catch { return null; }
    };
    let checked = 0;
    for (const diff of DIFFS) {
        for (let seed = 1; seed <= 150; seed++) {
            const qs = gen({ topic: 'Integers', difficulty: diff, count: 8, seed });
            for (const q of qs) {
                if (!/\\square/.test(q.clue)) continue;
                const m = q.clue.match(/\$([^$]*\\square[^$]*)\$/);
                assert.ok(m, `missing-number clue without parseable math: "${q.clue}"`);
                const [lhs, rhs] = m[1].split('=');
                assert.ok(lhs && rhs, `equation missing '=': "${m[1]}"`);
                const sub = s => s.replace(/\\square/g, `(${q.answer})`);
                const L = evalSide(sub(lhs)), R = evalSide(sub(rhs));
                assert.ok(L !== null && R !== null && approxEqual(L, R),
                    `${diff}/seed${seed}: answer ${q.answer} fails "${m[1]}" (LHS ${L} vs RHS ${R})`);
                checked++;
            }
        }
    }
    assert.ok(checked > 20, `only ${checked} missing-number questions exercised`);
});

// ---- fraction ↔ decimal / percentage conversions ------------
test('fraction→percentage and fraction→decimal conversions are correct', () => {
    let checked = 0;
    for (const diff of DIFFS) {
        for (let seed = 1; seed <= 200; seed++) {
            const qs = gen({
                topic: 'Fractions', difficulty: diff, count: 8, seed,
                subOpsFilter: { Fractions: ['simplify-convert'] },
            });
            for (const q of qs) {
                const fm = q.clue.match(/\\frac\{(\d+)\}\{(\d+)\}/);
                if (!fm) continue;
                const num = +fm[1], den = +fm[2];
                if (/percentage/.test(q.clue)) {
                    assert.ok(approxEqual(Number(q.answer), (num / den) * 100),
                        `${diff}/seed${seed}: ${num}/${den} → ${q.answer}% (expected ${(num / den) * 100}%)`);
                    checked++;
                } else if (/decimal/.test(q.clue)) {
                    const rounded = /round|d\.p\.|decimal place/.test(q.clue);
                    const expected = rounded ? Math.round((num / den) * 1e4) / 1e4 : num / den;
                    assert.ok(approxEqual(Number(q.answer), expected),
                        `${diff}/seed${seed}: ${num}/${den} → ${q.answer} (expected ${expected})`);
                    checked++;
                }
            }
        }
    }
    assert.ok(checked > 30, `only ${checked} conversion questions exercised`);
});

// ---- "a out of b" percentage --------------------------------
test('"a out of b" percentage questions are correct', () => {
    let checked = 0;
    for (let seed = 1; seed <= 200; seed++) {
        const qs = gen({
            topic: 'Percentages', difficulty: 'Easy', count: 8, seed,
            subOpsFilter: { Percentages: ['find-pct'] },
        });
        for (const q of qs) {
            const m = q.clue.match(/\$(\d+)\$\s*(?:out of|of)\s*\$(\d+)\$/);
            if (!m) continue;
            const a = +m[1], b = +m[2];
            assert.ok(approxEqual(Number(q.answer), (a / b) * 100),
                `seed${seed}: ${a} out of ${b} → ${q.answer}% (expected ${(a / b) * 100}%)`);
            checked++;
        }
    }
    assert.ok(checked > 10, `only ${checked} "a out of b" questions exercised`);
});

// ---- sub-op filter respected --------------------------------
test('sub-op filter is respected (single sub-op produces only that op family)', () => {
    for (let seed = 1; seed <= 50; seed++) {
        const qs = gen({
            topic: 'Integers', difficulty: 'Medium', count: 6, seed,
            subOpsFilter: { Integers: ['add'] },
        });
        for (const q of qs) {
            assert.ok(!/\\times|\\div|×|÷/.test(q.clue), `add-only filter leaked: "${q.clue}"`);
        }
    }
});

// ---- variety floor ------------------------------------------
// Threshold is per-topic because some topics (Non-linear, Probability) have
// few sub-ops by design — so the achievable shape count is lower.
const VARIETY_FLOOR = {
    Integers: 8, Decimals: 8, Rounding: 8, Fractions: 8, Percentages: 8,
    Algebra: 8, Geometry: 8, Statistics: 8, 'Financial Maths': 7,
    Probability: 6, 'Ratios & Rates': 8,
    Trigonometry: 12, 'Non-linear Relationships': 8,
    // Starter topics added in the 2022-syllabus alignment pass — lower
    // floors initially because each ships with a small handful of sub-ops.
    // Raise as content is fleshed out.
    'Indices': 8, 'Linear Relationships': 7,
    'Properties of Geometrical Figures': 5, 'Variation & Rates of Change': 4,
};

test('variety: a single-topic page yields a healthy spread of distinct clues', () => {
    for (const topic of [...STAGE4_TOPICS, ...STAGE5_TOPICS]) {
        const qs = gen({ topic, difficulty: 'All', count: 24, seed: 7 });
        const uniqueClues = new Set(qs.map(q => q.clue)).size;
        assert.equal(uniqueClues, qs.length, `${topic}: duplicate clues on a single-topic page`);
        const shapes = new Set(qs.map(q => q.clue.replace(/\d+(\.\d+)?/g, '#').replace(/\\square/g, '□')));
        const floor = VARIETY_FLOOR[topic] ?? 6;
        assert.ok(shapes.size >= floor,
            `${topic}: only ${shapes.size} distinct question shapes across 24 questions (want ≥ ${floor})`);
    }
});
