// =============================================================
// test/generator.test.mjs — correctness harness for the maths
// question generator. Run with:  node --test
//
// Two layers of checking:
//   1. Structural invariants on EVERY generated question (finite answer,
//      non-empty clue, answerDisplay length, valid diagram type, etc.).
//   2. An INDEPENDENT arithmetic evaluator that re-derives the answer for
//      any clue whose inline math is a plain numeric expression
//      (integers/decimals with + - × ÷, parentheses, squares). This is the
//      high-volume arithmetic where a variety change could silently break
//      an answer key. Word-problem / fraction clues are skipped by the
//      evaluator but still pass through the structural checks.
// =============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMathsQuestions, SUB_OPS, ALL_SUBTOPICS } from '../generators/mathsQuestionGen.js';

const CORE = ['Integers', 'Decimals', 'Rounding', 'Fractions', 'Percentages'];
const DIFFS = ['Easy', 'Medium', 'Hard'];
const VALID_DIAGRAMS = new Set([
    'rectangle', 'right-triangle', 'triangle-angles', 'triangle-area', 'circle',
    'right-triangle-trig', 'parabola', 'parallelogram', 'trapezium',
    'parallel-transversal', 'straight-line-angles', 'vertically-opposite',
]);

// ---- Independent arithmetic evaluator -----------------------
// Evaluates a single LaTeX-ish expression to a Number, or null if it isn't a
// plain numeric expression we model exactly (fractions, words, %, etc.).
function evalPlainExpr(raw) {
    let e = raw.trim();

    // Reject anything we don't model exactly.
    if (/\\frac|\\sqrt|%|\\%|[a-df-zA-DF-Z]|=|square|\\le|\\ge|\\approx/.test(e)) return null;

    // Normalise operators.
    e = e.replace(/\\times/g, '*').replace(/\\div/g, '/').replace(/×/g, '*').replace(/÷/g, '/');
    // Superscript square: 12^2 / 12^{2}
    e = e.replace(/(\d+(?:\.\d+)?)\s*\^\s*\{?2\}?/g, '($1*$1)');
    // Unicode minus → ASCII.
    e = e.replace(/−/g, '-');

    // Whitelist: digits, operators, parens, dots, spaces only.
    if (!/^[0-9+\-*/().\s]+$/.test(e)) return null;

    // Require an ACTUAL binary operator (a digit/")" followed by an operator).
    // This skips lone numbers like "72.4" or "460718", which in context are
    // rounding / conversion / sig-fig tasks — not arithmetic to be evaluated.
    if (!/[\d)]\s*[-+*/]/.test(e)) return null;

    try {
        // eslint-disable-next-line no-new-func
        const v = Function(`"use strict"; return (${e});`)();
        return Number.isFinite(v) ? v : null;
    } catch {
        return null;
    }
}

// Returns a Number if the clue's inline math is a single plain numeric
// expression, or null otherwise.
function evalNumericClue(clue) {
    const spans = [...clue.matchAll(/\$([^$]+)\$/g)].map(m => m[1]);
    if (spans.length !== 1) return null;            // skip multi-span / word problems
    return evalPlainExpr(spans[0]);
}

// Worked solutions often end "... = <answer>$" (optionally "EXPR = <answer>").
// Returns { rhs, expr } where rhs is the stated result and expr is the
// arithmetic immediately left of the final '=' (after any '\approx'), or null.
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

function approxEqual(a, b) {
    return Math.abs(a - b) < 1e-6 || Math.abs(a - b) < Math.abs(b) * 1e-9;
}

// ---- Structural invariants ----------------------------------
function checkStructure(q, label) {
    assert.ok(q.clue && q.clue.length > 0, `${label}: empty clue`);
    assert.ok(q.answer != null && String(q.answer).length > 0, `${label}: empty answer`);
    const ansStr = String(q.answer);
    assert.ok(!['NaN', 'Infinity', '-Infinity'].includes(ansStr), `${label}: bad answer "${ansStr}" for clue "${q.clue}"`);
    const disp = String(q.answerDisplay || q.answer);
    assert.ok(disp.length <= 60, `${label}: answerDisplay too long: "${disp}"`);
    if (q.diagram) {
        assert.ok(VALID_DIAGRAMS.has(q.diagram.type), `${label}: unknown diagram type "${q.diagram.type}"`);
    }
}

// ---- Tests --------------------------------------------------
for (const topic of CORE) {
    for (const diff of DIFFS) {
        test(`${topic} / ${diff}: structure + arithmetic over many seeds`, () => {
            let checkedArith = 0;
            for (let seed = 1; seed <= 200; seed++) {
                const qs = generateMathsQuestions({ subTopic: topic, difficulty: diff, count: 8, seed });
                for (const q of qs) {
                    const label = `${topic}/${diff}/seed${seed}`;
                    checkStructure(q, label);
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
            // Make sure the evaluator actually exercised the arithmetic paths
            // for the arithmetic-heavy topics (guards against the regex silently
            // matching nothing after a refactor).
            if (topic === 'Integers' || topic === 'Decimals') {
                assert.ok(checkedArith > 50, `${topic}/${diff}: only ${checkedArith} arithmetic clues auto-checked`);
            }
        });
    }
}

test('worked solutions are self-consistent (stated result matches answer & arithmetic)', () => {
    let checked = 0;
    for (const topic of CORE) {
        for (const diff of DIFFS) {
            for (let seed = 1; seed <= 120; seed++) {
                const qs = generateMathsQuestions({ subTopic: topic, difficulty: diff, count: 8, seed });
                for (const q of qs) {
                    const w = parseWorked(q.worked);
                    if (!w) continue;
                    const ans = Number(q.answer);
                    if (!Number.isFinite(ans)) continue;       // fraction-string answers etc.
                    // Stated worked result must equal the answer.
                    assert.ok(approxEqual(w.rhs, ans),
                        `${topic}/${diff}/seed${seed}: worked result ${w.rhs} ≠ answer ${ans} | "${q.worked}"`);
                    // And the arithmetic left of '=' must equal that result.
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

test('missing-number (inverse) questions: substituting the answer satisfies the equation', () => {
    // Minimal numeric eval that also accepts a lone number (one side of the
    // equation is just the result, e.g. "12").
    const evalSide = s => {
        const e = s.replace(/\\square/g, '#SQ#').trim();
        if (!/^[0-9+\-*/().\s#SQ]+$/.test(e)) return null;
        try { return Function(`"use strict"; return (${e.replace(/#SQ#/g, '')});`)(); }
        catch { return null; }
    };
    let checked = 0;
    for (const diff of DIFFS) {
        for (let seed = 1; seed <= 150; seed++) {
            const qs = generateMathsQuestions({ subTopic: 'Integers', difficulty: diff, count: 8, seed });
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

test('fraction→percentage and fraction→decimal conversions are correct', () => {
    let checked = 0;
    for (const diff of DIFFS) {
        for (let seed = 1; seed <= 200; seed++) {
            const qs = generateMathsQuestions({
                subTopic: 'Fractions', difficulty: diff, count: 8, seed,
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
                    assert.ok(approxEqual(Number(q.answer), num / den),
                        `${diff}/seed${seed}: ${num}/${den} → ${q.answer} (expected ${num / den})`);
                    checked++;
                }
            }
        }
    }
    assert.ok(checked > 30, `only ${checked} conversion questions exercised`);
});

test('"a out of b" percentage questions are correct', () => {
    let checked = 0;
    for (let seed = 1; seed <= 200; seed++) {
        const qs = generateMathsQuestions({
            subTopic: 'Percentages', difficulty: 'Easy', count: 8, seed,
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

test('sub-op filter is respected (single sub-op produces only that op family)', () => {
    // Integers with only "add" selected must never yield a subtraction/×/÷ clue.
    for (let seed = 1; seed <= 50; seed++) {
        const qs = generateMathsQuestions({
            subTopic: 'Integers', difficulty: 'Medium', count: 6, seed,
            subOpsFilter: { Integers: ['add'] },
        });
        for (const q of qs) {
            const v = evalNumericClue(q.clue);
            // If it's a plain numeric clue we can sanity check it doesn't contain × or ÷.
            assert.ok(!/\\times|\\div|×|÷/.test(q.clue), `add-only filter leaked: "${q.clue}"`);
        }
    }
});

test('every core topic produces at least some questions at each difficulty', () => {
    for (const topic of CORE) {
        for (const diff of DIFFS) {
            const qs = generateMathsQuestions({ subTopic: topic, difficulty: diff, count: 10, seed: 42 });
            assert.ok(qs.length > 0, `${topic}/${diff} produced nothing`);
        }
    }
});

test('variety: a single-topic page yields a healthy spread of distinct clues', () => {
    // The main reason to improve variety: a teacher who selects ONE topic should
    // not get a page of near-identical questions. Require a minimum unique ratio.
    for (const topic of CORE) {
        const qs = generateMathsQuestions({ subTopic: topic, difficulty: 'All', count: 24, seed: 7 });
        const uniqueClues = new Set(qs.map(q => q.clue)).size;
        assert.equal(uniqueClues, qs.length, `${topic}: duplicate clues on a single-topic page`);
        // Distinct "shapes" ≈ distinct clue templates. Approximate by stripping numbers.
        const shapes = new Set(qs.map(q => q.clue.replace(/\d+(\.\d+)?/g, '#').replace(/\\square/g, '□')));
        assert.ok(shapes.size >= 8, `${topic}: only ${shapes.size} distinct question shapes across 24 questions (want ≥ 8)`);
    }
});
