// =============================================================
// test/topics/pythagoras.test.mjs — Pythagoras' Theorem verifiers.
//
// Re-derives the answer from the diagram metadata (right-triangle sides or
// number-plane points) and confirms the Pythagorean relation holds and the
// stated answer matches a quantity derivable from the triangle (hypotenuse,
// shorter side, perimeter, area, or point-to-point distance).
// =============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { gen, DIFFS, approxEqual } from '../_helpers.mjs';

test("Pythagoras' Theorem: answers are consistent with the diagram", () => {
    let checked = 0;
    for (const diff of DIFFS) {
        for (let seed = 1; seed <= 250; seed++) {
            const qs = gen({ topic: "Pythagoras' Theorem", difficulty: diff, count: 8, seed });
            for (const q of qs) {
                const ans = Number(q.answer);
                assert.ok(Number.isFinite(ans), `${diff}/seed${seed}: non-numeric answer "${q.answer}"`);
                const d = q.diagram;
                assert.ok(d, `${diff}/seed${seed}: missing diagram for "${q.clue.slice(0, 60)}…"`);

                if (d.type === 'right-triangle') {
                    const { a, b, c } = d;
                    // Pythagorean relation (c may be rounded to 1 dp on the Hard
                    // irrational case → allow a small tolerance).
                    assert.ok(approxEqual(c, Math.sqrt(a * a + b * b), 0.06),
                        `${diff}/seed${seed}: a²+b²≠c² for (${a},${b},${c})`);
                    const candidates = [a, b, c, a + b + c, a * b / 2];
                    assert.ok(candidates.some(v => approxEqual(ans, v, 0.06)),
                        `${diff}/seed${seed}: answer ${ans} not derivable from (${a},${b},${c}) — "${q.clue.slice(0, 60)}…"`);
                    checked++;
                } else if (d.type === 'number-plane') {
                    const [[x1, y1], [x2, y2]] = d.pts;
                    const dist = Math.hypot(x2 - x1, y2 - y1);
                    assert.ok(approxEqual(ans, dist, 0.06),
                        `${diff}/seed${seed}: distance ${ans} ≠ ${dist} for ${JSON.stringify(d.pts)}`);
                    checked++;
                } else {
                    assert.fail(`${diff}/seed${seed}: unexpected diagram type "${d.type}"`);
                }
            }
        }
    }
    assert.ok(checked > 100, `only ${checked} Pythagoras questions verified`);
});
