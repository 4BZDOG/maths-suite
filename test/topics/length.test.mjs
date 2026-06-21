// =============================================================
// test/topics/length.test.mjs — Length verifiers.
//
// Recomputes perimeter (rectangle / polygon / parallelogram / triangle /
// composite L-shape / area-given), circumference (leave-in-π & numeric) and
// unit conversions (single & mixed) from the numbers in the clue.
// =============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { gen, DIFFS, approxEqual, checkStructure } from '../_helpers.mjs';

// integers in the clue, exponents (e.g. "cm^2") stripped first
const ints = (c) => [...c.replace(/\^\d/g, '').matchAll(/(\d+)/g)].map(m => Number(m[1]));

test('Length: every question is structurally valid', () => {
    for (const diff of DIFFS) {
        let total = 0;
        for (let seed = 1; seed <= 40; seed++) {
            const qs = gen({ topic: 'Length', difficulty: diff, count: 6, seed });
            total += qs.length;
            for (const q of qs) checkStructure(q, `Length/${diff}/seed${seed}`, assert);
        }
        assert.ok(total >= 30, `Length/${diff}: only ${total} questions`);
    }
});

test('Length: recomputed answers match the generator', () => {
    let checked = 0;
    const POLY = { triangle: 3, pentagon: 5, hexagon: 6, octagon: 8 };
    for (const diff of DIFFS) {
        for (let seed = 1; seed <= 250; seed++) {
            const qs = gen({ topic: 'Length', difficulty: diff, count: 8, seed });
            for (const q of qs) {
                const c = q.clue;
                const ns = ints(c);
                const a = Number(q.answer);
                const L = `${diff}/seed${seed}: "${c.slice(0, 70)}…" → ${q.answer}`;

                if (/perimeter of a rectangle/.test(c)) {
                    assert.ok(approxEqual(a, 2 * (ns[0] + ns[1])), L); checked++; continue;
                }
                let m = c.match(/A regular (\w+) has sides of \$(\d+)/);
                if (m) { assert.ok(approxEqual(a, POLY[m[1]] * Number(m[2])), L); checked++; continue; }
                if (/parallelogram has side lengths/.test(c)) {
                    assert.ok(approxEqual(a, 2 * (ns[0] + ns[1])), L); checked++; continue;
                }
                if (/triangle has sides/.test(c)) {
                    assert.ok(approxEqual(a, ns[0] + ns[1] + ns[2]), L); checked++; continue;
                }
                if (/L-shaped garden has sides/.test(c)) {
                    assert.ok(approxEqual(a, ns.reduce((x, y) => x + y, 0)), L); checked++; continue;
                }
                if (/rectangle has area \$\d+.*and width.*Find its perimeter/.test(c)) {
                    const [A, w] = ns;
                    assert.ok(approxEqual(a, 2 * (A / w + w)), L); checked++; continue;
                }
                if (/rectangle has perimeter \$\d+.*Find its length/.test(c)) {
                    const [P, w] = ns;
                    assert.ok(approxEqual(a, P / 2 - w), L); checked++; continue;
                }
                if (/circumference of a circle/.test(c) && /3\.14/.test(c)) {
                    const d = ints(c.replace('3.14', ''))[0];
                    assert.ok(approxEqual(a, Math.round(3.14 * d * 10) / 10), L); checked++; continue;
                }
                if (/circumference of a circle/.test(c) && /π$/.test(String(q.answer))) {
                    // leave-in-π: coeff = diameter (= 2r if radius given)
                    const coeff = Number(String(q.answer).replace('π', ''));
                    const d = /diameter/.test(c) ? ns[0] : 2 * ns[0];
                    assert.ok(approxEqual(coeff, d), L); checked++; continue;
                }
                if (/arc length .*semicircle/.test(c)) {
                    const coeff = Number(String(q.answer).replace('π', ''));
                    assert.ok(approxEqual(coeff, ns[0]), L); checked++; continue;   // πr → coeff = r
                }
                if (/circle has circumference \$\d+\\pi.*Find its radius/.test(c)) {
                    assert.ok(approxEqual(a, ns[0] / 2), L); checked++; continue;
                }
                // mixed-unit conversion "a big b small → small"
                m = c.match(/Convert \$(\d+)\\text\{ (\w+)\}\\ (\d+)\\text\{ (\w+)\}\$ to (\w+)/);
                if (m) {
                    const factor = { 'cm-mm': 10, 'm-cm': 100, 'km-m': 1000 }[`${m[2]}-${m[4]}`];
                    assert.ok(approxEqual(a, Number(m[1]) * factor + Number(m[3])), L); checked++; continue;
                }
                // single conversion (mirrors the generator's big↔small pairs)
                m = c.match(/Convert \$(\d+)\\text\{ (\w+)\}\$ to (\w+)/);
                if (m) {
                    const PAIRS = [['cm', 'mm', 10], ['m', 'cm', 100], ['km', 'm', 1000], ['m', 'mm', 1000]];
                    const val = Number(m[1]), from = m[2], to = m[3];
                    const big2small = PAIRS.find(([b, s]) => b === from && s === to);
                    const small2big = PAIRS.find(([b, s]) => b === to && s === from);
                    if (big2small) { assert.ok(approxEqual(a, val * big2small[2]), L); checked++; continue; }
                    if (small2big) { assert.ok(approxEqual(a, val / small2big[2]), L); checked++; continue; }
                }
            }
        }
    }
    assert.ok(checked > 300, `only ${checked} Length questions verified`);
});
