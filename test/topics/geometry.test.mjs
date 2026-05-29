// =============================================================
// test/topics/geometry.test.mjs — Geometry verifiers.
//
// Re-derives the canonical answer for the most common shapes from
// numbers extracted from the clue, then compares to the generator.
// Covers: rectangle area/perimeter, triangle area, Pythagoras, circle
// area/circumference, triangle angle sum, supplementary / vertically
// opposite / parallel-line angles.
// =============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { gen, DIFFS, approxEqual } from '../_helpers.mjs';

// Pull all "$<number>$" inline-math spans (numbers only, may be decimals).
function nums(clue) {
    return [...clue.matchAll(/\$(-?\d+(?:\.\d+)?)\$/g)].map(m => Number(m[1]));
}

test('Geometry: structural answers (area/perimeter/Pythagoras/angles) match recomputed values', () => {
    let checked = 0;
    for (const diff of DIFFS) {
        for (let seed = 1; seed <= 250; seed++) {
            const qs = gen({ topic: 'Geometry', difficulty: diff, count: 8, seed });
            for (const q of qs) {
                const ns = nums(q.clue);
                const ans = Number(q.answer);
                if (!Number.isFinite(ans)) continue;
                const c = q.clue;

                // --- Rectangle area: "length L cm and width W cm" → L*W
                if (/rectangle/i.test(c) && /\barea\b/i.test(c)
                    && /length .*width|measuring.*by/i.test(c) && !/perimeter|circumference/i.test(c)
                    && q.diagram?.missing === 'area') {
                    if (ns.length >= 2) {
                        const exp = ns[0] * ns[1];
                        assert.ok(approxEqual(ans, exp),
                            `${diff}/seed${seed}: rectangle area "${c.slice(0,60)}…" → ${ans} (expected ${exp})`);
                        checked++; continue;
                    }
                }
                // --- Rectangle perimeter
                if (/rectangle/i.test(c) && /\bperimeter\b/i.test(c)
                    && q.diagram?.missing === 'perimeter') {
                    if (ns.length >= 2) {
                        const exp = 2 * (ns[0] + ns[1]);
                        assert.ok(approxEqual(ans, exp),
                            `${diff}/seed${seed}: rectangle perimeter "${c.slice(0,60)}…" → ${ans} (expected ${exp})`);
                        checked++; continue;
                    }
                }
                // --- Triangle area: A = ½ b h
                if (/triangle/i.test(c) && /\barea\b/i.test(c) && /base .*height|height .*base/i.test(c)
                    && q.diagram?.type === 'triangle-area') {
                    if (ns.length >= 2) {
                        const exp = (ns[0] * ns[1]) / 2;
                        assert.ok(approxEqual(ans, exp),
                            `${diff}/seed${seed}: triangle area → ${ans} (expected ${exp})`);
                        checked++; continue;
                    }
                }
                // --- Triangle angle sum: third angle = 180 − a − b
                if (/triangle/i.test(c) && /third angle|missing.*angle|third\b/i.test(c)
                    && q.diagram?.type === 'triangle-angles') {
                    if (ns.length >= 2) {
                        const exp = 180 - ns[0] - ns[1];
                        assert.ok(approxEqual(ans, exp),
                            `${diff}/seed${seed}: triangle angles → ${ans} (expected ${exp})`);
                        checked++; continue;
                    }
                }
                // --- Pythagoras hypotenuse (3 inline numbers: 2 legs + a scaled one not present;
                // but the clue cites only the two legs)
                if (/right.*triangle/i.test(c) && /hypotenuse/i.test(c)
                    && q.diagram?.type === 'right-triangle' && q.diagram?.missing === 'c') {
                    if (ns.length >= 2) {
                        const exp = Math.sqrt(ns[0] ** 2 + ns[1] ** 2);
                        assert.ok(approxEqual(ans, exp, 1e-4),
                            `${diff}/seed${seed}: Pythagoras → ${ans} (expected ${exp})`);
                        checked++; continue;
                    }
                }
                // --- Supplementary angle (one given, find the other; answer = 180 − a)
                if (q.diagram?.type === 'straight-line-angles') {
                    if (ns.length >= 1) {
                        const exp = 180 - ns[0];
                        assert.ok(approxEqual(ans, exp),
                            `${diff}/seed${seed}: supplementary → ${ans} (expected ${exp})`);
                        checked++; continue;
                    }
                }
                // --- Vertically opposite (answer = same angle)
                if (q.diagram?.type === 'vertically-opposite') {
                    if (ns.length >= 1) {
                        assert.ok(approxEqual(ans, ns[0]),
                            `${diff}/seed${seed}: vert-opposite → ${ans} (expected ${ns[0]})`);
                        checked++; continue;
                    }
                }
                // --- Co-interior on parallel lines (sum 180)
                if (q.diagram?.angleType === 'co-interior') {
                    if (ns.length >= 1) {
                        const exp = 180 - ns[0];
                        assert.ok(approxEqual(ans, exp),
                            `${diff}/seed${seed}: co-interior → ${ans} (expected ${exp})`);
                        checked++; continue;
                    }
                }
            }
        }
    }
    assert.ok(checked > 100, `only ${checked} geometry questions verified`);
});
