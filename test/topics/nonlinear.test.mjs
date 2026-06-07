// =============================================================
// test/topics/nonlinear.test.mjs — Non-linear Relationships.
//
// "Identify graph" answers should match the canonical classification
// for each equation form (parabola, exponential, hyperbola).
// Parabola features: vertex/axis-of-symmetry from y = (x-h)² + k.
// =============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { gen } from '../_helpers.mjs';

function classify(eq) {
    if (/xy\s*=/.test(eq)) return 'hyperbola';
    if (/\^x|\^\{-x\}|\^\{?-x/.test(eq)) return 'exponential';
    if (/x\^3/.test(eq)) return 'cubic';
    if (/\\sqrt/.test(eq)) return 'square root';
    if (/x\^2|\(x[^)]*\)\^2/.test(eq)) return 'parabola';
    return null;
}

test('Non-linear identify-graph: classification matches the equation form', () => {
    let checked = 0;
    for (let seed = 1; seed <= 250; seed++) {
        const qs = gen({
            topic: 'Non-linear Relationships', difficulty: 'Easy', count: 8, seed,
            subOpsFilter: { 'Non-linear Relationships': ['identify-graph'] },
        });
        for (const q of qs) {
            if (!/Identify the type|type of curve|Name the graph|Classify the relationship/i.test(q.clue)) continue;
            const m = q.clue.match(/\$([^$]+)\$/);
            if (!m) continue;
            const expected = classify(m[1]);
            if (expected === null) continue;
            assert.equal(q.answer, expected,
                `seed${seed}: ${m[1]} → "${q.answer}" (expected "${expected}")`);
            checked++;
        }
    }
    assert.ok(checked > 10, `only ${checked} identify-graph questions verified`);
});

test('Parabola features: vertex of y = (x − h)² + k is (h, k)', () => {
    let checked = 0;
    for (let seed = 1; seed <= 200; seed++) {
        const qs = gen({
            topic: 'Non-linear Relationships', difficulty: 'Easy', count: 8, seed,
            subOpsFilter: { 'Non-linear Relationships': ['parabola-features'] },
        });
        for (const q of qs) {
            if (!/vertex|turning point/i.test(q.clue)) continue;
            // Match y = (x - h)² + k or (x + |h|)² - |k|, etc.
            const m = q.clue.match(/y\s*=\s*\(x\s*([+-])\s*(\d+)\)\^?2\s*(?:([+-])\s*(\d+))?/);
            if (!m) continue;
            const sgnH = m[1] === '-' ? +1 : -1;     // (x - h) → h positive
            const h = sgnH * Number(m[2]);
            const k = m[3] ? (m[3] === '-' ? -1 : +1) * Number(m[4]) : 0;
            const expected = `(${h},${k})`;
            assert.equal(q.answer, expected,
                `seed${seed}: ${q.clue.slice(0, 60)} → "${q.answer}" (expected "${expected}")`);
            checked++;
        }
    }
    assert.ok(checked > 10, `only ${checked} vertex questions verified`);
});
