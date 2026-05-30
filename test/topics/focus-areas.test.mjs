// =============================================================
// test/topics/focus-areas.test.mjs — verifiers for the four
// 2022-syllabus focus areas added to the generator (Indices,
// Linear Relationships, Properties of Geometrical Figures,
// Variation & Rates of Change).
// =============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { gen, DIFFS, approxEqual } from '../_helpers.mjs';

// ---- Indices --------------------------------------------------
test('Indices: a^m × a^n / a^m ÷ a^n / (a^m)^n give the right power', () => {
    let checked = 0;
    for (const diff of DIFFS) {
        for (let seed = 1; seed <= 150; seed++) {
            const qs = gen({ topic: 'Indices', difficulty: diff, count: 8, seed });
            for (const q of qs) {
                const ans = Number(q.answer);
                // Multiplication: $b^m \times b^n$
                let m = q.clue.match(/\$(\d+)\^(\d+) \\times \1\^(\d+)\$/);
                if (m) {
                    assert.equal(ans, Math.pow(+m[1], +m[2] + +m[3]),
                        `${diff}/seed${seed}: ${m[1]}^${m[2]} × ${m[1]}^${m[3]} → ${ans}`);
                    checked++; continue;
                }
                // Division: $b^m \div b^n$
                m = q.clue.match(/\$(\d+)\^(\d+) \\div \1\^(\d+)\$/);
                if (m) {
                    assert.equal(ans, Math.pow(+m[1], +m[2] - +m[3]),
                        `${diff}/seed${seed}: ${m[1]}^${m[2]} ÷ ${m[1]}^${m[3]} → ${ans}`);
                    checked++; continue;
                }
                // Power of power: $(b^m)^n$
                m = q.clue.match(/\$\((\d+)\^(\d+)\)\^(\d+)\$/);
                if (m) {
                    assert.equal(ans, Math.pow(+m[1], +m[2] * +m[3]),
                        `${diff}/seed${seed}: (${m[1]}^${m[2]})^${m[3]} → ${ans}`);
                    checked++; continue;
                }
                // Zero index: always 1
                if (/\^0\$/.test(q.clue)) {
                    assert.equal(ans, 1, `${diff}/seed${seed}: zero index → ${ans}`);
                    checked++; continue;
                }
                // Negative index: $b^{-n}$ → answer string is "1/denom" with denom = b^n
                m = q.clue.match(/\$(\d+)\^\{-(\d+)\}\$/);
                if (m) {
                    const expected = `1/${Math.pow(+m[1], +m[2])}`;
                    assert.equal(String(q.answer), expected,
                        `${diff}/seed${seed}: ${m[1]}^{-${m[2]}} → ${q.answer}`);
                    checked++;
                }
            }
        }
    }
    assert.ok(checked > 50, `only ${checked} index questions verified`);
});

// ---- Linear Relationships -------------------------------------
test('Linear: gradient from two points = (y2 - y1) / (x2 - x1)', () => {
    let checked = 0;
    for (const diff of DIFFS) {
        for (let seed = 1; seed <= 150; seed++) {
            const qs = gen({
                topic: 'Linear Relationships', difficulty: diff, count: 8, seed,
                subOpsFilter: { 'Linear Relationships': ['gradient-two-points'] },
            });
            for (const q of qs) {
                const m = q.clue.match(/\$\((-?\d+),\s*(-?\d+)\)\$\s+and\s+\$\((-?\d+),\s*(-?\d+)\)\$/);
                if (!m) continue;
                const [, x1, y1, x2, y2] = m.map(Number);
                if (x2 === x1) continue;
                const expected = (y2 - y1) / (x2 - x1);
                assert.ok(approxEqual(Number(q.answer), expected),
                    `${diff}/seed${seed}: gradient(${x1},${y1})→(${x2},${y2}) → ${q.answer} (expected ${expected})`);
                checked++;
            }
        }
    }
    assert.ok(checked > 30, `only ${checked} gradient questions verified`);
});

test('Linear: midpoint = ((x1+x2)/2, (y1+y2)/2)', () => {
    let checked = 0;
    for (let seed = 1; seed <= 200; seed++) {
        const qs = gen({
            topic: 'Linear Relationships', difficulty: 'Easy', count: 8, seed,
            subOpsFilter: { 'Linear Relationships': ['midpoint'] },
        });
        for (const q of qs) {
            const m = q.clue.match(/\$\((-?\d+),\s*(-?\d+)\)\$\s+to\s+\$\((-?\d+),\s*(-?\d+)\)\$/);
            if (!m) continue;
            const [, x1, y1, x2, y2] = m.map(Number);
            const expected = `(${(x1 + x2) / 2},${(y1 + y2) / 2})`;
            assert.equal(q.answer, expected,
                `seed${seed}: midpoint(${x1},${y1})↔(${x2},${y2}) → ${q.answer}`);
            checked++;
        }
    }
    assert.ok(checked > 10, `only ${checked} midpoint questions verified`);
});

test('Linear: plot y=mx+c — substituting x into the stated equation gives the answer', () => {
    let checked = 0;
    for (let seed = 1; seed <= 100; seed++) {
        const qs = gen({
            topic: 'Linear Relationships', difficulty: 'Easy', count: 8, seed,
            subOpsFilter: { 'Linear Relationships': ['plot-line'] },
        });
        for (const q of qs) {
            // "Find $y$ when $x = N$ for $y = <expr>$."
            const m = q.clue.match(/\$x\s*=\s*(-?\d+)\$\s+for\s+\$y\s*=\s*([^$]+)\$/);
            if (!m) continue;
            const x = Number(m[1]);
            // Convert "3x - 5" → "3*(x) - 5" then evaluate by substitution.
            const expr = m[2]
                .replace(/(-?\d+)x/g, '($1*X)')
                .replace(/\bx\b/g, '(X)')
                .replace(/X/g, `(${x})`);
            if (!/^[\d+\-*/() .]+$/.test(expr)) continue;
            const expected = Function(`"use strict"; return (${expr});`)();
            assert.ok(approxEqual(Number(q.answer), expected),
                `seed${seed}: y when x=${x} for "${m[2]}" → ${q.answer} (expected ${expected})`);
            checked++;
        }
    }
    assert.ok(checked > 10, `only ${checked} plot-line questions verified`);
});

// ---- Variation -------------------------------------------------
test('Variation: direct y = kx — finds k from (x1,y1) then evaluates at x2', () => {
    let checked = 0;
    for (let seed = 1; seed <= 150; seed++) {
        const qs = gen({
            topic: 'Variation & Rates of Change', difficulty: 'Medium', count: 8, seed,
            subOpsFilter: { 'Variation & Rates of Change': ['direct-variation'] },
        });
        for (const q of qs) {
            const m = q.clue.match(/\$x\s*=\s*(\d+)\$,\s*\$y\s*=\s*(\d+)\$.*?\$x\s*=\s*(\d+)\$/i);
            if (!m) continue;
            const [, x1, y1, x2] = m.map(Number);
            const k = y1 / x1;
            const expected = k * x2;
            assert.ok(approxEqual(Number(q.answer), expected),
                `seed${seed}: y∝x, (${x1},${y1}) at x=${x2} → ${q.answer} (expected ${expected})`);
            checked++;
        }
    }
    assert.ok(checked > 20, `only ${checked} direct-variation questions verified`);
});

test('Variation: inverse y = k/x — finds k = x1·y1 then evaluates at x2', () => {
    let checked = 0;
    for (let seed = 1; seed <= 150; seed++) {
        const qs = gen({
            topic: 'Variation & Rates of Change', difficulty: 'Medium', count: 8, seed,
            subOpsFilter: { 'Variation & Rates of Change': ['inverse-variation'] },
        });
        for (const q of qs) {
            const m = q.clue.match(/\$x\s*=\s*(\d+)\$,\s*\$y\s*=\s*(\d+)\$.*?\$x\s*=\s*(\d+)\$/i);
            if (!m) continue;
            const [, x1, y1, x2] = m.map(Number);
            const k = x1 * y1;
            const expected = k / x2;
            assert.ok(approxEqual(Number(q.answer), expected),
                `seed${seed}: y∝1/x, (${x1},${y1}) at x=${x2} → ${q.answer} (expected ${expected})`);
            checked++;
        }
    }
    assert.ok(checked > 20, `only ${checked} inverse-variation questions verified`);
});
