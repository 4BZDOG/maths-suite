// Sub-operation table: structure, gating, group metadata and teaching-order snapshot.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SUB_OPS, activeSubOps, groupSubOps } from '../generators/subOps.js';
import { SUB_OPS as SUB_OPS_VIA_GEN, generateMathsQuestions, ALL_SUBTOPICS } from '../generators/mathsQuestionGen.js';
import { SUB_OPS as SUB_OPS_VIA_STATE } from '../core/state.js';

// Expected NESA teaching order per topic (Stage 4 → 5.1/5.2 → 5.3 Path last).
// Update deliberately when the sequence is revised; keys must never be renamed.
const EXPECTED_ORDER = {
    'Integers': ['add', 'subtract', 'multiply', 'divide', 'bodmas'],
    'Decimals': ['add-subtract', 'multiply-divide'],
    'Rounding': ['nearest', 'decimal-places', 'sig-figs', 'sci-notation', 'measurement-error'],
    'Fractions': ['simplify-convert', 'fraction-of', 'add-subtract', 'multiply-divide'],
    'Percentages': ['find-pct', 'increase-decrease', 'reverse-change'],
    'Algebra': ['word-expression', 'substitution', 'like-terms', 'indices-laws', 'expand-simplify', 'expand', 'factorise-hcf', 'factorise-bracket', 'factorise-grouping', 'factorise', 'factorise-nonmonic', 'alg-fractions', 'solve', 'quadratic-solve', 'simultaneous', 'surds-simplify', 'surds-operate'],
    'Geometry': ['angles', 'area-perimeter', 'circles', 'pythagoras', 'surface-area', 'composite-volume', 'similar-triangles'],
    'Statistics': ['mode-range', 'mean-median', 'stem-leaf', 'iqr', 'five-number-summary', 'box-plot', 'std-dev', 'bivariate'],
    'Financial Maths': ['markup-profit', 'gst', 'wages', 'commission', 'simple-interest', 'compound-interest', 'compound-period', 'depreciation', 'term-payments'],
    'Trigonometry': ['find-side', 'find-angle', 'applications', 'exact-values', 'sine-rule', 'cosine-rule', 'area-rule', 'bearings', 'trig-3d', 'obtuse-angles', 'trig-equations'],
    'Non-linear Relationships': ['parabola-features', 'identify-graph', 'parabola-sketch'],
    'Probability': ['theoretical', 'experimental', 'complementary', 'multi-event', 'venn', 'two-way', 'conditional'],
    'Ratios & Rates': ['simplify', 'equivalent', 'unit-ratio', 'divide-ratio', 'unit-rate', 'speed'],
    'Indices': ['divisibility', 'primes', 'hcf-lcm', 'indices-evaluate', 'indices-multiply', 'indices-divide', 'indices-power', 'indices-zero', 'indices-negative', 'indices-fraction'],
    'Algebraic Indices': ['alg-multiply', 'alg-divide', 'alg-power', 'alg-coefficients', 'alg-zero', 'alg-negative', 'alg-fraction'],
    'Equations': ['one-step', 'two-step', 'brackets', 'both-sides', 'fractions', 'substitution', 'inequalities', 'simultaneous', 'quadratic-square', 'complete-square', 'quad-formula', 'simultaneous-nonlinear'],
    'Linear Relationships': ['pattern-rule', 'plot-line', 'intercepts', 'gradient-two-points', 'midpoint', 'distance', 'equation-from-gp', 'general-form', 'parallel-perp'],
    'Properties of Geometrical Figures': ['angles', 'quad-properties', 'congruent-tests', 'similar-ratio'],
    'Variation & Rates of Change': ['direct-variation', 'inverse-variation'],
    'Length': ['unit-convert', 'perimeter', 'circumference'],
    'Area': ['area-perimeter', 'circles', 'surface-area'],
    'Volume': ['prism', 'capacity', 'cylinder', 'pyramid', 'cone', 'sphere'],
    'Time': ['convert', 'duration', 'zones'],
    "Pythagoras' Theorem": ['identify', 'hypotenuse', 'short-side', 'triads'],
    'Data Classification and Visualisation': ['data-type', 'tally', 'frequency-total', 'dot-plot-read', 'graph-choice'],
    'Networks': ['degree-sum', 'euler-trail', 'euler'],
    'Polynomials': ['degree', 'remainder', 'factor-theorem'],
    'Logarithms': ['evaluate', 'laws', 'solve'],
    'Functions': ['evaluate', 'domain-range', 'hyperbola', 'circle'],
};

// Gating as it stood before the reorder: Stage-5-only keys and Path keys per topic.
const EXPECTED_GATING = {
    'Rounding': { s5: ['sci-notation', 'measurement-error'], path: [] },
    'Algebra': { s5: ['expand', 'factorise', 'factorise-bracket', 'factorise-nonmonic', 'factorise-grouping', 'alg-fractions', 'quadratic-solve', 'indices-laws', 'simultaneous', 'surds-simplify', 'surds-operate'], path: ['simultaneous', 'surds-simplify', 'surds-operate'] },
    'Geometry': { s5: ['composite-volume', 'similar-triangles'], path: [] },
    'Statistics': { s5: ['five-number-summary', 'std-dev', 'box-plot', 'bivariate'], path: [] },
    'Financial Maths': { s5: ['depreciation', 'compound-period', 'wages', 'commission', 'term-payments'], path: [] },
    'Trigonometry': { s5: ['applications', 'sine-rule', 'cosine-rule', 'area-rule', 'exact-values', 'trig-equations', 'trig-3d', 'obtuse-angles', 'bearings'], path: ['trig-equations', 'trig-3d', 'obtuse-angles', 'bearings'] },
    'Non-linear Relationships': { s5: ['parabola-features', 'parabola-sketch', 'identify-graph'], path: ['parabola-sketch', 'identify-graph'] },
    'Probability': { s5: ['conditional', 'venn', 'two-way'], path: [] },
    'Indices': { s5: ['indices-zero', 'indices-negative', 'indices-fraction'], path: [] },
    'Algebraic Indices': { s5: ['alg-zero', 'alg-negative', 'alg-fraction'], path: [] },
    'Equations': { s5: ['inequalities', 'simultaneous', 'complete-square', 'quad-formula', 'simultaneous-nonlinear'], path: [] },
    'Linear Relationships': { s5: ['distance', 'equation-from-gp', 'parallel-perp', 'general-form'], path: [] },
    'Properties of Geometrical Figures': { s5: ['congruent-tests', 'similar-ratio', 'quad-properties'], path: [] },
    'Variation & Rates of Change': { s5: ['direct-variation', 'inverse-variation'], path: [] },
    'Area': { s5: ['surface-area'], path: [] },
    'Volume': { s5: ['pyramid', 'cone', 'sphere'], path: [] },
    'Networks': { s5: ['euler', 'degree-sum', 'euler-trail'], path: ['euler', 'degree-sum', 'euler-trail'] },
    'Polynomials': { s5: ['degree', 'remainder', 'factor-theorem'], path: ['degree', 'remainder', 'factor-theorem'] },
    'Logarithms': { s5: ['evaluate', 'laws', 'solve'], path: ['evaluate', 'laws', 'solve'] },
    'Functions': { s5: ['evaluate', 'domain-range', 'circle', 'hyperbola'], path: ['evaluate', 'domain-range', 'circle', 'hyperbola'] },
};

const sorted = (a) => [...a].sort();

test('SUB_OPS is re-exported unchanged through the generator and core/state', () => {
    assert.equal(SUB_OPS_VIA_GEN, SUB_OPS);
    assert.equal(SUB_OPS_VIA_STATE, SUB_OPS);
});

test('every topic with sub-ops has a generator and vice versa', () => {
    assert.deepEqual(sorted(Object.keys(SUB_OPS)), sorted(ALL_SUBTOPICS));
});

test('order matches the expected teaching-sequence snapshot, topic by topic', () => {
    assert.deepEqual(sorted(Object.keys(SUB_OPS)), sorted(Object.keys(EXPECTED_ORDER)));
    for (const [topic, keys] of Object.entries(EXPECTED_ORDER)) {
        assert.deepEqual(SUB_OPS[topic].map(o => o.key), keys, `order of ${topic}`);
    }
});

test('no duplicate keys or labels within a topic; entries are well-formed', () => {
    for (const [topic, ops] of Object.entries(SUB_OPS)) {
        const keys = ops.map(o => o.key), labels = ops.map(o => o.label);
        assert.equal(new Set(keys).size, keys.length, `duplicate key in ${topic}`);
        assert.equal(new Set(labels).size, labels.length, `duplicate label in ${topic}`);
        for (const o of ops) {
            assert.ok(o.key && typeof o.key === 'string', `${topic}: key`);
            assert.ok(o.label && typeof o.label === 'string', `${topic}/${o.key}: label`);
            assert.ok(o.pathway === undefined || o.pathway === 'path', `${topic}/${o.key}: pathway`);
            assert.ok(o.stages === undefined || (Array.isArray(o.stages) && o.stages.every(s => s === 'Stage 4' || s === 'Stage 5')), `${topic}/${o.key}: stages`);
            assert.ok(o.group === undefined || (typeof o.group === 'string' && o.group.trim() === o.group && o.group), `${topic}/${o.key}: group`);
        }
    }
});

test('stage and Path gating is intact', () => {
    for (const topic of Object.keys(SUB_OPS)) {
        const ops = SUB_OPS[topic];
        const exp = EXPECTED_GATING[topic] || { s5: [], path: [] };
        assert.deepEqual(sorted(ops.filter(o => o.stages).map(o => o.key)), sorted(exp.s5), `${topic} Stage 5-only keys`);
        assert.deepEqual(sorted(ops.filter(o => o.pathway === 'path').map(o => o.key)), sorted(exp.path), `${topic} Path keys`);
        for (const o of ops.filter(o => o.pathway === 'path')) assert.deepEqual(o.stages, ['Stage 5'], `${topic}/${o.key}: Path implies Stage 5`);
    }
});

test('Stage 5 core ops precede Path ops, and Stage 4 ops precede Stage 5-only ops (within each tier)', () => {
    for (const [topic, ops] of Object.entries(SUB_OPS)) {
        const firstPath = ops.findIndex(o => o.pathway === 'path');
        if (firstPath >= 0) {
            assert.ok(ops.slice(firstPath).every(o => o.pathway === 'path'), `${topic}: Path ops must be last`);
        }
    }
});

test('group metadata: contiguous, no group split across the list, no single run reused', () => {
    for (const [topic, ops] of Object.entries(SUB_OPS)) {
        const seen = new Set();
        for (const run of groupSubOps(ops)) {
            if (!run.group) continue;
            assert.ok(!seen.has(run.group), `${topic}: group "${run.group}" is not contiguous`);
            seen.add(run.group);
        }
        // Either every op is grouped or none is (no half-headed panels).
        const grouped = ops.filter(o => o.group).length;
        assert.ok(grouped === 0 || grouped === ops.length, `${topic}: mix of grouped and ungrouped ops`);
    }
});

test('groupSubOps / activeSubOps helpers', () => {
    const runs = groupSubOps([{ key: 'a', group: 'X' }, { key: 'b', group: 'X' }, { key: 'c' }, { key: 'd', group: 'Y' }]);
    assert.deepEqual(runs.map(r => [r.group, r.ops.map(o => o.key)]), [['X', ['a', 'b']], [null, ['c']], ['Y', ['d']]]);
    assert.deepEqual(groupSubOps([]), []);
    const s4 = activeSubOps('Trigonometry', 'Stage 4', false).map(o => o.key);
    assert.deepEqual(s4, ['find-side', 'find-angle']);
    const s5 = activeSubOps('Trigonometry', 'Stage 5', false).map(o => o.key);
    assert.ok(s5.includes('sine-rule') && !s5.includes('bearings'));
    assert.ok(activeSubOps('Trigonometry', 'Stage 5', true).some(o => o.key === 'bearings'));
    assert.deepEqual(activeSubOps('Nope', 'Stage 5', true), []);
});

test('every sub-op key is served by its topic generator (stage/Path aware)', () => {
    for (const [topic, ops] of Object.entries(SUB_OPS)) {
        for (const op of ops) {
            const stage = op.stages ? op.stages[0] : 'Stage 4';
            const includePath = op.pathway === 'path';
            let n = 0;
            for (const seed of [1, 2, 3]) {
                n += generateMathsQuestions({
                    subTopics: [topic], count: 8, seed, stage, includePath,
                    subOpsFilter: { [topic]: [op.key] },
                }).length;
            }
            assert.ok(n > 0, `${topic}/${op.key} produced no questions`);
        }
    }
});

test('selection order does not change which questions a fixed seed yields (non-Algebra topics)', () => {
    // The generator's pick for most topics is independent of the order of the
    // allowed-key list; Algebra builds its pool from it (documented in subOps.js).
    for (const topic of ['Statistics', 'Financial Maths', 'Trigonometry', 'Probability']) {
        const keys = activeSubOps(topic, 'Stage 5', true).map(o => o.key);
        const run = (list) => generateMathsQuestions({ subTopics: [topic], count: 10, seed: 11, stage: 'Stage 5', includePath: true, subOpsFilter: { [topic]: list } }).map(q => q.clue);
        assert.deepEqual(run(keys), run([...keys].reverse()), topic);
    }
});
