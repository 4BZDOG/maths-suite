// =============================================================
// test/_helpers.mjs — shared utilities for the generator test suite.
// =============================================================
import { generateMathsQuestions } from '../generators/mathsQuestionGen.js';

export const DIFFS = ['Easy', 'Medium', 'Hard'];

export const STAGE4_TOPICS = [
    'Integers', 'Decimals', 'Rounding', 'Fractions', 'Percentages',
    'Algebra', 'Geometry', 'Statistics', 'Financial Maths',
    'Probability', 'Ratios & Rates',
    // 2022-syllabus focus areas
    'Indices', 'Algebraic Indices', 'Equations', 'Linear Relationships',
    // NESA Measurement & Space + Statistics focus areas
    'Length', 'Area', 'Volume', 'Time', "Pythagoras' Theorem",
    'Data Classification and Visualisation',
];
export const STAGE5_TOPICS = [
    'Trigonometry', 'Non-linear Relationships',
    // 2022-syllabus focus areas (Stage 5 only)
    'Properties of Geometrical Figures', 'Variation & Rates of Change',
];

export const VALID_DIAGRAMS = new Set([
    'rectangle', 'right-triangle', 'triangle-angles', 'triangle-area', 'circle',
    'right-triangle-trig', 'parabola', 'parallelogram', 'trapezium',
    'parallel-transversal', 'straight-line-angles', 'vertically-opposite',
    'number-plane', 'general-triangle', 'composite-prism',
    'rhombus', 'kite', 'sector',
]);

// Generate with the right stage / includePath for the given topic.
// Stage 5 topics need stage='Stage 5'; sub-ops marked pathway:'path' need
// includePath=true. Pass includePath=true universally to give the widest
// coverage in tests.
export function gen({ topic, difficulty, count = 8, seed, subOpsFilter = null }) {
    const stage = STAGE5_TOPICS.includes(topic) ? 'Stage 5' : 'Stage 4';
    return generateMathsQuestions({
        subTopic: topic, difficulty, count, seed, subOpsFilter,
        stage, includePath: true,
    });
}

// Generate at the higher stage so Stage-5 sub-ops on shared topics
// (Algebra/Geometry/Financial/Statistics) also fire.
export function genStage5({ topic, difficulty, count = 8, seed, subOpsFilter = null }) {
    return generateMathsQuestions({
        subTopic: topic, difficulty, count, seed, subOpsFilter,
        stage: 'Stage 5', includePath: true,
    });
}

export function approxEqual(a, b, tol = 1e-6) {
    if (a === b) return true;
    return Math.abs(a - b) < tol || Math.abs(a - b) < Math.abs(b) * 1e-9;
}

// ---- Independent arithmetic evaluator (shared) --------------
export function evalPlainExpr(raw) {
    let e = raw.trim();
    if (/\\frac|\\sqrt|%|\\%|[a-df-zA-DF-Z]|=|square|\\le|\\ge|\\approx/.test(e)) return null;
    e = e.replace(/\\times/g, '*').replace(/\\div/g, '/').replace(/×/g, '*').replace(/÷/g, '/');
    e = e.replace(/(\d+(?:\.\d+)?)\s*\^\s*\{?2\}?/g, '($1*$1)');
    e = e.replace(/−/g, '-');
    if (!/^[0-9+\-*/().\s]+$/.test(e)) return null;
    if (!/[\d)]\s*[-+*/]/.test(e)) return null;
    try {
        const v = Function(`"use strict"; return (${e});`)();
        return Number.isFinite(v) ? v : null;
    } catch { return null; }
}

export function evalNumericClue(clue) {
    const spans = [...clue.matchAll(/\$([^$]+)\$/g)].map(m => m[1]);
    if (spans.length !== 1) return null;
    return evalPlainExpr(spans[0]);
}

// ---- Structural invariants (shared) -------------------------
export function checkStructure(q, label, assert) {
    assert.ok(q.clue && q.clue.length > 0, `${label}: empty clue`);
    assert.ok(q.answer != null && String(q.answer).length > 0, `${label}: empty answer`);
    const ansStr = String(q.answer);
    assert.ok(!['NaN', 'Infinity', '-Infinity', 'null', 'undefined'].includes(ansStr),
        `${label}: bad answer "${ansStr}" for clue "${q.clue}"`);
    const disp = String(q.answerDisplay || q.answer);
    assert.ok(disp.length <= 60, `${label}: answerDisplay too long: "${disp}"`);
    if (q.diagram) {
        assert.ok(VALID_DIAGRAMS.has(q.diagram.type),
            `${label}: unknown diagram type "${q.diagram.type}"`);
    }
}

// Parse the FIRST integer-list inline math span like "$3, 5, 7, 8$" → [3,5,7,8].
// Returns null if no such span exists.
export function parseDataList(clue) {
    const spans = [...clue.matchAll(/\$([^$]+)\$/g)].map(m => m[1]);
    for (const s of spans) {
        if (!/^[\d,\s.?-]+$/.test(s)) continue;
        if (!/,/.test(s)) continue;
        const items = s.split(',').map(t => t.trim()).filter(Boolean);
        if (items.length < 2) continue;
        if (items.some(t => t === '?')) continue;            // skip "find the missing value" lists
        const nums = items.map(Number);
        if (nums.every(Number.isFinite)) return nums;
    }
    return null;
}
