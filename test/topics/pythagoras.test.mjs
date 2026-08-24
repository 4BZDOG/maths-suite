// =============================================================
// test/topics/pythagoras.test.mjs — Pythagoras' Theorem verifiers.
//
// 'pythagoras' sub-op ("Find a side"): re-derives the answer from the diagram
// metadata (right-triangle sides or number-plane points) and confirms the
// Pythagorean relation holds and the stated answer matches a quantity
// derivable from the triangle (hypotenuse, shorter side, perimeter, area, or
// point-to-point distance).
// 'identify' sub-op: the theorem-equation answer and the hypotenuse-ID
// answer (whose diagram, unlike 'pythagoras', is a genuine right triangle —
// re-verified independently here too).
// 'triads' sub-op: re-parses the 3 side lengths straight from the clue text
// and independently recomputes whether they satisfy a²+b²=c², so a bug that
// flipped the generator's own Yes/No logic couldn't hide behind this test
// re-using the same (potentially wrong) computation.
// =============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { gen, DIFFS, approxEqual } from '../_helpers.mjs';

test("Pythagoras' Theorem 'Find a side': answers are consistent with the diagram", () => {
    let checked = 0;
    for (const diff of DIFFS) {
        for (let seed = 1; seed <= 250; seed++) {
            const qs = gen({
                topic: "Pythagoras' Theorem", difficulty: diff, count: 8, seed,
                subOpsFilter: { "Pythagoras' Theorem": ['pythagoras'] },
            });
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
    assert.ok(checked > 100, `only ${checked} 'Find a side' questions verified`);
});

test("Pythagoras' Theorem 'Identify & define': equation / hypotenuse-ID answers are correct", () => {
    let equationChecked = 0, hypotChecked = 0;
    for (const diff of DIFFS) {
        for (let seed = 1; seed <= 100; seed++) {
            const qs = gen({
                topic: "Pythagoras' Theorem", difficulty: diff, count: 8, seed,
                subOpsFilter: { "Pythagoras' Theorem": ['identify'] },
            });
            for (const q of qs) {
                if (/State Pythagoras' theorem/i.test(q.clue)) {
                    assert.equal(q.answer, 'a²+b²=c²', `${diff}/seed${seed}: "${q.clue}" → "${q.answer}"`);
                    assert.ok(q.answer.length <= 10, `${diff}/seed${seed}: answer "${q.answer}" exceeds the 10-char grid limit`);
                    equationChecked++;
                } else if (/which side is the hypotenuse/i.test(q.clue)) {
                    assert.equal(q.answer, 'hypotenuse', `${diff}/seed${seed}: "${q.clue}" → "${q.answer}"`);
                    assert.ok(q.answer.length <= 10, `${diff}/seed${seed}: answer "${q.answer}" exceeds the 10-char grid limit`);
                    const d = q.diagram;
                    assert.ok(d && d.type === 'right-triangle', `${diff}/seed${seed}: missing/wrong diagram for "${q.clue.slice(0, 60)}…"`);
                    // Unlike 'triads', this one must always be a genuine right triangle —
                    // showing a fake one while asking "which side is the hypotenuse?" would be incoherent.
                    assert.ok(approxEqual(d.c, Math.sqrt(d.a * d.a + d.b * d.b), 0.06),
                        `${diff}/seed${seed}: a²+b²≠c² for (${d.a},${d.b},${d.c})`);
                    hypotChecked++;
                } else {
                    assert.fail(`${diff}/seed${seed}: unrecognised 'identify' clue "${q.clue}"`);
                }
            }
        }
    }
    assert.ok(equationChecked > 20, `only ${equationChecked} equation questions verified`);
    assert.ok(hypotChecked > 20, `only ${hypotChecked} hypotenuse-ID questions verified`);
});

test("Pythagoras' Theorem 'Prove triads': Yes/No answers match independently-recomputed a²+b² vs c²", () => {
    let yesCount = 0, noCount = 0;
    for (const diff of DIFFS) {
        for (let seed = 1; seed <= 150; seed++) {
            const qs = gen({
                topic: "Pythagoras' Theorem", difficulty: diff, count: 8, seed,
                subOpsFilter: { "Pythagoras' Theorem": ['triads'] },
            });
            for (const q of qs) {
                assert.ok(!q.diagram, `${diff}/seed${seed}: 'triads' question unexpectedly carries a diagram — would visually give away the answer`);
                assert.ok(q.answer === 'Yes' || q.answer === 'No', `${diff}/seed${seed}: answer "${q.answer}" is not Yes/No`);

                // Independently re-parse the 3 side lengths straight from the clue
                // text (not from generator internals) and recompute a²+b²=c²
                // ourselves, so this test can't be fooled by a bug in the
                // generator's own isTriad computation.
                const m = q.clue.match(/\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)/);
                assert.ok(m, `${diff}/seed${seed}: couldn't parse side lengths from "${q.clue}"`);
                const [a, b, c] = m.slice(1, 4).map(Number);
                const expected = (a * a + b * b === c * c) ? 'Yes' : 'No';
                assert.equal(q.answer, expected, `${diff}/seed${seed}: (${a},${b},${c}) → "${q.answer}" (expected "${expected}")`);

                if (q.answer === 'Yes') yesCount++; else noCount++;
            }
        }
    }
    // Both outcomes must actually occur — a generator that always answers "Yes"
    // (or always "No") would pass a naive answer check but teach nothing.
    assert.ok(yesCount > 20, `only ${yesCount} "Yes" triad questions generated — perturbation may be broken`);
    assert.ok(noCount > 20, `only ${noCount} "No" triad questions generated — perturbation may be broken`);
});
