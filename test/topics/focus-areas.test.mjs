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
test('Indices: index-law answers match recomputed values', () => {
    let checked = 0;
    for (const diff of DIFFS) {
        for (let seed = 1; seed <= 150; seed++) {
            const qs = gen({ topic: 'Indices', difficulty: diff, count: 8, seed });
            for (const q of qs) {
                const ans = Number(q.answer);
                const c = q.clue;
                let m;

                // Evaluate: $b^{n}$  (single power, no × or ÷)
                m = c.match(/\$(\d+)\^\{(\d+)\}\$/) || c.match(/\$(\d+)\^(\d+)\$/);
                if (m && !/\\times|\\div|missing|\^0|square|cube|sqrt/i.test(c)
                    && !/Simplify|power of/i.test(c)) {
                    assert.equal(ans, Math.pow(+m[1], +m[2]),
                        `${diff}/seed${seed}: ${m[1]}^${m[2]} → ${ans}`);
                    checked++; continue;
                }
                // Square/cube of N
                m = c.match(/square.*\$(\d+)\$/i);
                if (m) { assert.equal(ans, (+m[1]) ** 2, `${diff}/seed${seed}: square ${m[1]}`); checked++; continue; }
                m = c.match(/cube.*\$(\d+)\$/i);
                if (m) { assert.equal(ans, (+m[1]) ** 3, `${diff}/seed${seed}: cube ${m[1]}`); checked++; continue; }
                // Square root
                m = c.match(/\\sqrt\{(\d+)\}/);
                if (m && !/\\sqrt\[/.test(c)) { assert.equal(ans, Math.sqrt(+m[1]), `${diff}/seed${seed}: √${m[1]}`); checked++; continue; }
                // Cube root
                m = c.match(/\\sqrt\[3\]\{(\d+)\}/);
                if (m) { assert.equal(ans, Math.round(Math.pow(+m[1], 1/3)), `${diff}/seed${seed}: ∛${m[1]}`); checked++; continue; }

                // Multi-base evaluate: $b1^{e1} × b2^{e2}$ (different bases)
                m = c.match(/\$(\d+)\^\{(\d+)\}\s*\\times\s*(\d+)\^\{(\d+)\}\$/);
                if (m && +m[1] !== +m[3]) {
                    assert.equal(ans, Math.pow(+m[1], +m[2]) * Math.pow(+m[3], +m[4]),
                        `${diff}/seed${seed}: ${m[1]}^${m[2]}×${m[3]}^${m[4]}`);
                    checked++; continue;
                }

                // Multiplication same base (2-term): $b^{m} × b^{n}$
                m = c.match(/\$(\d+)\^\{(\d+)\}\s*\\times\s*\1\^\{(\d+)\}\$/);
                if (m && !/\\div/.test(c) && !/missing/i.test(c)) {
                    if (/Simplify|power of/i.test(c)) {
                        assert.equal(q.answer, `${m[1]}^${+m[2] + +m[3]}`, `${diff}/seed${seed}: simplify multiply`);
                    } else {
                        assert.equal(ans, Math.pow(+m[1], +m[2] + +m[3]), `${diff}/seed${seed}: multiply`);
                    }
                    checked++; continue;
                }
                // Three-term multiply: $b^{m} × b^{n} × b^{p}$
                m = c.match(/\$(\d+)\^\{(\d+)\}\s*\\times\s*\1\^\{(\d+)\}\s*\\times\s*\1\^\{(\d+)\}\$/);
                if (m) {
                    assert.equal(ans, Math.pow(+m[1], +m[2] + +m[3] + +m[4]), `${diff}/seed${seed}: 3-term multiply`);
                    checked++; continue;
                }

                // Division same base: $b^{m} ÷ b^{n}$
                m = c.match(/\$(\d+)\^\{(\d+)\}\s*\\div\s*\1\^\{(\d+)\}\$/);
                if (m && !/\\times/.test(c) && !/missing/i.test(c)) {
                    if (/Simplify|power of/i.test(c)) {
                        assert.equal(q.answer, `${m[1]}^${+m[2] - +m[3]}`, `${diff}/seed${seed}: simplify divide`);
                    } else {
                        assert.equal(ans, Math.pow(+m[1], +m[2] - +m[3]), `${diff}/seed${seed}: divide`);
                    }
                    checked++; continue;
                }
                // Combined: $b^{m} × b^{n} ÷ b^{p}$
                m = c.match(/\$(\d+)\^\{(\d+)\}\s*\\times\s*\1\^\{(\d+)\}\s*\\div\s*\1\^\{(\d+)\}\$/);
                if (m) {
                    assert.equal(ans, Math.pow(+m[1], +m[2] + +m[3] - +m[4]), `${diff}/seed${seed}: multiply+divide`);
                    checked++; continue;
                }

                // Power of power: $(b^{m})^{n}$ (no trailing × )
                m = c.match(/\$\((\d+)\^\{(\d+)\}\)\^\{(\d+)\}\$/);
                if (m && !/\\times/.test(c) && !/missing/i.test(c)) {
                    if (/Simplify|power of/i.test(c)) {
                        assert.equal(q.answer, `${m[1]}^${+m[2] * +m[3]}`, `${diff}/seed${seed}: simplify power`);
                    } else {
                        assert.equal(ans, Math.pow(+m[1], +m[2] * +m[3]), `${diff}/seed${seed}: power-of-power`);
                    }
                    checked++; continue;
                }
                // Combined: (b^{m})^{n} × b^{p}
                m = c.match(/\$\((\d+)\^\{(\d+)\}\)\^\{(\d+)\}\s*\\times\s*\1\^\{(\d+)\}\$/);
                if (m) {
                    assert.equal(ans, Math.pow(+m[1], +m[2] * +m[3] + +m[4]), `${diff}/seed${seed}: power+multiply`);
                    checked++; continue;
                }

                // Find missing index (multiply): $b^{?} × b^{n} = b^{total}$
                m = c.match(/\$(\d+)\^\{\?\}\s*\\times\s*\1\^\{(\d+)\}\s*=\s*\1\^\{(\d+)\}\$/);
                if (m) {
                    assert.equal(ans, +m[3] - +m[2], `${diff}/seed${seed}: missing multiply index`);
                    checked++; continue;
                }
                // Find missing index (divide): $b^{m} ÷ b^{?} = b^{result}$
                m = c.match(/\$(\d+)\^\{(\d+)\}\s*\\div\s*\1\^\{\?\}\s*=\s*\1\^\{(\d+)\}\$/);
                if (m) {
                    assert.equal(ans, +m[2] - +m[3], `${diff}/seed${seed}: missing divide index`);
                    checked++; continue;
                }
                // Find missing index (power): $(b^{?})^{n} = b^{prod}$
                m = c.match(/\$\((\d+)\^\{\?\}\)\^\{(\d+)\}\s*=\s*\1\^\{(\d+)\}\$/);
                if (m) {
                    assert.equal(ans, +m[3] / +m[2], `${diff}/seed${seed}: missing power index`);
                    checked++; continue;
                }

                // Zero index (with expression): $b^0$ or $k × b^0$
                if (/\^0/.test(c)) {
                    checked++; continue;
                }
                // Negative index: $b^{-n}$
                m = c.match(/\$(\d+)\^\{-(\d+)\}\$/);
                if (m) {
                    const expected = `1/${Math.pow(+m[1], +m[2])}`;
                    assert.equal(String(q.answer), expected,
                        `${diff}/seed${seed}: ${m[1]}^{-${m[2]}} → ${q.answer}`);
                    checked++; continue;
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
                if (/perpendicular|parallel/i.test(q.clue)) continue;
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

// ---- Linear intercepts -----------------------------------------
test('Linear intercepts: y-intercept is the constant c from y = mx + c', () => {
    let checked = 0;
    for (let seed = 1; seed <= 200; seed++) {
        const qs = gen({
            topic: 'Linear Relationships', difficulty: 'Easy', count: 8, seed,
            subOpsFilter: { 'Linear Relationships': ['intercepts'] },
        });
        for (const q of qs) {
            if (!/y-intercept/i.test(q.clue)) continue;
            const m = q.clue.match(/\$y\s*=\s*([^$]+)\$/);
            if (!m) continue;
            const expr = m[1];
            // y-intercept is the constant: extract from "mx + c" or "mx - c"
            const cm = expr.match(/([+-]\s*\d+)$/);
            if (!cm) {
                // y = mx (no constant) → c = 0
                assert.equal(Number(q.answer), 0,
                    `seed${seed}: y-intercept of "${expr}" → ${q.answer} (expected 0)`);
                checked++; continue;
            }
            const c = Number(cm[1].replace(/\s/g, ''));
            assert.equal(Number(q.answer), c,
                `seed${seed}: y-intercept of "${expr}" → ${q.answer} (expected ${c})`);
            checked++;
        }
    }
    assert.ok(checked > 10, `only ${checked} y-intercept questions verified`);
});

test('Linear Hard midpoint: find-other-endpoint B = 2M − A', () => {
    let checked = 0;
    for (let seed = 1; seed <= 200; seed++) {
        const qs = gen({
            topic: 'Linear Relationships', difficulty: 'Hard', count: 8, seed,
            subOpsFilter: { 'Linear Relationships': ['midpoint'] },
        });
        for (const q of qs) {
            if (!/midpoint/i.test(q.clue) || !/find\s+\$?B\$?/i.test(q.clue)) continue;
            // Extract midpoint (first coord pair) and A (second coord pair)
            const mm = q.clue.match(/\$?\((-?\d+),\s*(-?\d+)\)\$?/g);
            if (!mm || mm.length < 2) continue;
            const mid = mm[0].match(/-?\d+/g).map(Number);
            const a = mm[1].match(/-?\d+/g).map(Number);
            const bx = 2 * mid[0] - a[0], by = 2 * mid[1] - a[1];
            assert.equal(q.answer, `(${bx},${by})`,
                `seed${seed}: endpoint → ${q.answer} (expected (${bx},${by}))`);
            checked++;
        }
    }
    assert.ok(checked > 5, `only ${checked} find-endpoint questions verified`);
});

// ---- Variation power law ----------------------------------------
test('Variation Hard: y ∝ x² — finds k from (x1,y1) then evaluates at x2', () => {
    let checked = 0;
    for (let seed = 1; seed <= 250; seed++) {
        const qs = gen({
            topic: 'Variation & Rates of Change', difficulty: 'Hard', count: 8, seed,
            subOpsFilter: { 'Variation & Rates of Change': ['direct-variation'] },
        });
        for (const q of qs) {
            if (!/x\^2|x\²/i.test(q.clue)) continue;
            const m = q.clue.match(/\$x\s*=\s*(\d+)\$,\s*\$y\s*=\s*(\d+)\$.*?\$x\s*=\s*(\d+)\$/i);
            if (!m) continue;
            const [, x1, y1, x2] = m.map(Number);
            const k = y1 / (x1 * x1);
            const expected = k * x2 * x2;
            assert.ok(approxEqual(Number(q.answer), expected),
                `seed${seed}: y∝x², (${x1},${y1}) at x=${x2} → ${q.answer} (expected ${expected})`);
            checked++;
        }
    }
    assert.ok(checked > 5, `only ${checked} power-law questions verified`);
});

// ---- Props of Figures: quad angle sum = 360 ----------------------
test('Props of Figures Hard: fourth angle = 360 − sum of other three', () => {
    let checked = 0;
    for (let seed = 1; seed <= 200; seed++) {
        const qs = gen({
            topic: 'Properties of Geometrical Figures', difficulty: 'Hard', count: 8, seed,
            subOpsFilter: { 'Properties of Geometrical Figures': ['quad-properties'] },
        });
        for (const q of qs) {
            if (!/fourth angle/i.test(q.clue)) continue;
            const angles = [...q.clue.matchAll(/\$(\d+)°\$/g)].map(m => +m[1]);
            if (angles.length < 3) continue;
            const expected = 360 - angles.reduce((a, b) => a + b, 0);
            assert.equal(Number(q.answer), expected,
                `seed${seed}: fourth angle → ${q.answer} (expected ${expected})`);
            checked++;
        }
    }
    assert.ok(checked > 10, `only ${checked} quad-angle questions verified`);
});
