// =============================================================
// test/topics/pythagoras.test.mjs — Pythagoras' Theorem verifiers.
//
// 'hypotenuse' sub-op ("Finding the Hypotenuse"): the Easy tier includes a
// context-free "square, add, root" warm-up (no diagram) alongside the
// triangle-context questions — checked separately below. Every other
// question re-derives the answer from the diagram metadata (right-triangle
// sides or number-plane points) and confirms a²+b²=c² holds and the stated
// answer is c (or, for the Hard perimeter composite, a+b+c).
// 'short-side' sub-op ("Finding a short side"): same diagram re-derivation,
// but the answer is always the missing leg b (or, for the Hard area
// composite, a×b/2).
// 'identify' sub-op: the theorem-equation answer and the hypotenuse-ID
// answer (whose diagram is a genuine right triangle — re-verified here too).
// 'triads' sub-op: re-parses the 3 side lengths straight from the clue text
// and independently recomputes whether they satisfy a²+b²=c², so a bug that
// flipped the generator's own Yes/No logic couldn't hide behind this test
// re-using the same (potentially wrong) computation.
// =============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { gen, DIFFS, approxEqual } from '../_helpers.mjs';

test("Pythagoras' Theorem 'Finding the Hypotenuse': answers are consistent", () => {
    let diagramChecked = 0, exactWarmupChecked = 0, roundedWarmupChecked = 0;
    for (const diff of DIFFS) {
        for (let seed = 1; seed <= 250; seed++) {
            const qs = gen({
                topic: "Pythagoras' Theorem", difficulty: diff, count: 8, seed,
                subOpsFilter: { "Pythagoras' Theorem": ['hypotenuse'] },
            });
            for (const q of qs) {
                const ans = Number(q.answer);
                assert.ok(Number.isFinite(ans), `${diff}/seed${seed}: non-numeric answer "${q.answer}"`);
                const d = q.diagram;

                if (!d) {
                    // Context-free "square, add, root" warm-up (Easy only). Two
                    // phrasings: "√{a^2 + b^2}" or "Square $a$ and $b$, add...".
                    const m = q.clue.match(/\\sqrt\{(\d+)\^2 \+ (\d+)\^2\}/)
                           || q.clue.match(/Square \$(\d+)\$ and \$(\d+)\$/);
                    assert.ok(m, `${diff}/seed${seed}: couldn't parse a,b from warm-up clue "${q.clue}"`);
                    const [x, y] = m.slice(1, 3).map(Number);
                    const root = Math.sqrt(x * x + y * y);
                    if (/decimal place/i.test(q.clue)) {
                        assert.ok(!Number.isInteger(root), `${diff}/seed${seed}: rounded warm-up (${x},${y}) has an exact integer root — should have used the exact phrasing`);
                        assert.ok(approxEqual(ans, Math.round(root * 10) / 10, 1e-9),
                            `${diff}/seed${seed}: √(${x}²+${y}²)≈${root} rounds to ${Math.round(root * 10) / 10}, not ${ans}`);
                        roundedWarmupChecked++;
                    } else {
                        assert.ok(Number.isInteger(root), `${diff}/seed${seed}: exact warm-up (${x},${y}) has a non-integer root ${root}`);
                        assert.equal(ans, root, `${diff}/seed${seed}: √(${x}²+${y}²)=${root} ≠ ${ans}`);
                        exactWarmupChecked++;
                    }
                    continue;
                }

                if (d.type === 'right-triangle') {
                    const { a, b, c } = d;
                    // c may be rounded to 1 dp on the Hard irrational case → allow tolerance.
                    assert.ok(approxEqual(c, Math.sqrt(a * a + b * b), 0.06),
                        `${diff}/seed${seed}: a²+b²≠c² for (${a},${b},${c})`);
                    const candidates = [c, a + b + c];
                    assert.ok(candidates.some(v => approxEqual(ans, v, 0.06)),
                        `${diff}/seed${seed}: answer ${ans} not derivable from (${a},${b},${c}) — "${q.clue.slice(0, 60)}…"`);
                    diagramChecked++;
                } else if (d.type === 'number-plane') {
                    const [[x1, y1], [x2, y2]] = d.pts;
                    const dist = Math.hypot(x2 - x1, y2 - y1);
                    assert.ok(approxEqual(ans, dist, 0.06),
                        `${diff}/seed${seed}: distance ${ans} ≠ ${dist} for ${JSON.stringify(d.pts)}`);
                    diagramChecked++;
                } else {
                    assert.fail(`${diff}/seed${seed}: unexpected diagram type "${d.type}"`);
                }
            }
        }
    }
    assert.ok(diagramChecked > 100, `only ${diagramChecked} triangle/coordinate hypotenuse questions verified`);
    assert.ok(exactWarmupChecked > 10, `only ${exactWarmupChecked} exact warm-up questions verified`);
    assert.ok(roundedWarmupChecked > 10, `only ${roundedWarmupChecked} rounded warm-up questions verified`);
});

test("Pythagoras' Theorem 'Finding a short side': answers are consistent with the diagram", () => {
    let checked = 0;
    for (const diff of DIFFS) {
        for (let seed = 1; seed <= 250; seed++) {
            const qs = gen({
                topic: "Pythagoras' Theorem", difficulty: diff, count: 8, seed,
                subOpsFilter: { "Pythagoras' Theorem": ['short-side'] },
            });
            for (const q of qs) {
                const ans = Number(q.answer);
                assert.ok(Number.isFinite(ans), `${diff}/seed${seed}: non-numeric answer "${q.answer}"`);
                const d = q.diagram;
                assert.ok(d && d.type === 'right-triangle', `${diff}/seed${seed}: missing/wrong diagram for "${q.clue.slice(0, 60)}…"`);

                const { a, b, c } = d;
                assert.ok(approxEqual(c, Math.sqrt(a * a + b * b), 0.06),
                    `${diff}/seed${seed}: a²+b²≠c² for (${a},${b},${c})`);
                const candidates = [b, a * b / 2];
                assert.ok(candidates.some(v => approxEqual(ans, v, 0.06)),
                    `${diff}/seed${seed}: answer ${ans} not derivable from (${a},${b},${c}) — "${q.clue.slice(0, 60)}…"`);
                checked++;
            }
        }
    }
    assert.ok(checked > 100, `only ${checked} 'Finding a short side' questions verified`);
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
