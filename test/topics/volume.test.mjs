// =============================================================
// test/topics/volume.test.mjs — Volume & capacity verifiers.
//
// Re-derives the answer from the dimensions in the clue for each template
// family (rectangular / triangular / composite / inverse prisms, cylinders
// in-π and numeric, and capacity conversions) and compares to the generator.
// =============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { gen, DIFFS, approxEqual, checkStructure } from '../_helpers.mjs';

// All integers (no sign) appearing in the clue, in order. Exponents (the "3"
// in "cm^3", "2" in "r^2") are stripped first so they don't leak in as values.
function ints(c) { return [...c.replace(/\^\d/g, '').matchAll(/(\d+)/g)].map(m => Number(m[1])); }

test('Volume: every question is structurally valid', () => {
    for (const diff of DIFFS) {
        let total = 0;
        for (let seed = 1; seed <= 40; seed++) {
            const qs = gen({ topic: 'Volume', difficulty: diff, count: 6, seed });
            total += qs.length;
            for (const q of qs) checkStructure(q, `Volume/${diff}/seed${seed}`, assert);
        }
        assert.ok(total >= 30, `Volume/${diff}: only ${total} questions`);
    }
});

test('Volume: recomputed answers match the generator', () => {
    let checked = 0;
    for (const diff of DIFFS) {
        for (let seed = 1; seed <= 250; seed++) {
            const qs = gen({ topic: 'Volume', difficulty: diff, count: 8, seed });
            for (const q of qs) {
                const c = q.clue;
                const ns = ints(c);
                const ans = Number(q.answer);
                const label = `${diff}/seed${seed}: "${c.slice(0, 70)}…" → ${q.answer}`;

                // --- rectangular prism (Easy): "L cm × W cm × H cm"
                if (/rectangular prism \$\d+\\text\{ cm\} \\times/.test(c)) {
                    const [l, w, h] = ns;
                    assert.ok(approxEqual(ans, l * w * h), `${label} (expected ${l * w * h})`);
                    checked++; continue;
                }
                // --- triangular prism: base / height / length
                if (/triangular prism/.test(c)) {
                    const [b, ht, L] = ns;
                    assert.ok(approxEqual(ans, b * ht / 2 * L), `${label} (expected ${b * ht / 2 * L})`);
                    checked++; continue;
                }
                // --- composite two-block solid
                if (/two rectangular blocks/.test(c)) {
                    const [w1, l1, , h1, l2, , h2] = ns;
                    const exp = l1 * w1 * h1 + l2 * w1 * h2;
                    assert.ok(approxEqual(ans, exp), `${label} (expected ${exp})`);
                    checked++; continue;
                }
                // --- prism inverse: missing height from volume
                if (/rectangular prism has volume/.test(c)) {
                    const [V, l, w] = ns;
                    assert.ok(approxEqual(l * w * ans, V), `${label}: ${l}×${w}×${ans} ≠ ${V}`);
                    checked++; continue;
                }
                // --- cylinder inverse: height from V in terms of π
                if (/cylinder has volume \$\d+\\pi/.test(c)) {
                    const [V, r] = ns;
                    assert.ok(approxEqual(r * r * ans, V), `${label}: ${r}²×${ans} ≠ ${V}`);
                    checked++; continue;
                }
                // --- cylinder numeric (π ≈ 3.14)
                if (/cylinder/.test(c) && /3\.14/.test(c)) {
                    const [r, h] = ns;   // "3" and "14" filtered below
                    void r; void h;
                    const [rr, hh] = ints(c.replace('3.14', ''));
                    const exp = Math.round(rr * rr * hh * 3.14 * 10) / 10;
                    assert.ok(approxEqual(ans, exp), `${label} (expected ${exp})`);
                    checked++; continue;
                }
                // --- cylinder leave-in-π: answer "<coeff>π"
                if (/cylinder/.test(c) && /\\pi/.test(c) && /π$/.test(String(q.answer))) {
                    const coeff = Number(String(q.answer).replace('π', ''));
                    const [r, h] = ns;
                    assert.ok(approxEqual(coeff, r * r * h), `${label}: ${r}²×${h} ≠ ${coeff}π`);
                    checked++; continue;
                }
                // --- capacity: cm³ → mL (1:1)
                if (/millilitres/.test(c) && /\\text\{ cm\}\^3/.test(c) && /What is this/.test(c)) {
                    assert.ok(approxEqual(ans, ns[0]), `${label} (expected ${ns[0]})`);
                    checked++; continue;
                }
                // --- capacity: L → mL
                if (/Convert \$\d+\\text\{ L\} to millilitres/.test(c)) {
                    assert.ok(approxEqual(ans, ns[0] * 1000), `${label} (expected ${ns[0] * 1000})`);
                    checked++; continue;
                }
                // --- capacity: cm³ → L
                if (/tank has a volume of \$\d+\\text\{ cm\}\^3.*litres/.test(c)) {
                    assert.ok(approxEqual(ans, ns[0] / 1000), `${label} (expected ${ns[0] / 1000})`);
                    checked++; continue;
                }
                // --- capacity: fish tank → litres (nearest)
                if (/fish tank/.test(c)) {
                    const [l, w, h] = ns;
                    const exp = Math.round(l * w * h / 1000) || 1;
                    assert.ok(approxEqual(ans, exp), `${label} (expected ${exp})`);
                    checked++; continue;
                }
            }
        }
    }
    assert.ok(checked > 200, `only ${checked} Volume questions verified`);
});
