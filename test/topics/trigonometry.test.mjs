// =============================================================
// test/topics/trigonometry.test.mjs — Trigonometry verifiers.
//
// The generator is built on Pythagorean triples; "find-angle" and
// "find-side" answers can be recomputed from the cited sides/angles.
// =============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { gen, DIFFS, approxEqual } from '../_helpers.mjs';

function round1(x) { return Math.round(x * 10) / 10; }
function nums(clue) {
    return [...clue.matchAll(/\$(-?\d+(?:\.\d+)?)\$/g)].map(m => Number(m[1]));
}

test('Trig find-angle: tan/sin/cos answer matches recomputed θ from cited legs/hyp', () => {
    let checked = 0;
    for (const diff of DIFFS) {
        for (let seed = 1; seed <= 200; seed++) {
            const qs = gen({
                topic: 'Trigonometry', difficulty: diff, count: 8, seed,
                subOpsFilter: { Trigonometry: ['find-angle'] },
            });
            for (const q of qs) {
                if (!q.diagram || q.diagram.type !== 'right-triangle-trig') continue;
                const { opp, adj, hyp } = q.diagram;
                // The clue says either "opposite ... adjacent" — we always have the triple.
                const ans = Number(String(q.answer).replace('°', ''));
                if (!Number.isFinite(ans)) continue;
                // The generator picks one of tan/sin/cos at random; whichever produces θ
                // from the triple's correct ratio will match.
                const candidates = [
                    round1(Math.atan2(opp, adj) * 180 / Math.PI),
                    round1(Math.asin(opp / hyp) * 180 / Math.PI),
                    round1(Math.acos(adj / hyp) * 180 / Math.PI),
                ];
                assert.ok(candidates.some(c => approxEqual(c, ans, 0.05)),
                    `${diff}/seed${seed}: θ=${ans}° not in {${candidates.join(', ')}} for triple ${opp},${adj},${hyp}`);
                checked++;
            }
        }
    }
    assert.ok(checked > 30, `only ${checked} find-angle questions verified`);
});

test('Trig application: angle of elevation matches atan2(height, distance)', () => {
    let checked = 0;
    for (const diff of DIFFS) {
        for (let seed = 1; seed <= 250; seed++) {
            const qs = gen({
                topic: 'Trigonometry', difficulty: diff, count: 8, seed,
                subOpsFilter: { Trigonometry: ['applications'] },
            });
            for (const q of qs) {
                const ns = nums(q.clue);
                if (ns.length < 2) continue;
                const ans = Number(String(q.answer).replace('°', ''));
                if (!Number.isFinite(ans)) continue;
                // The clue uses "distance ... height" OR "base ... reaches" — both orderings
                // place the two values consistently. Try both atan2 orderings.
                const c1 = round1(Math.atan2(ns[1], ns[0]) * 180 / Math.PI);
                const c2 = round1(Math.atan2(ns[0], ns[1]) * 180 / Math.PI);
                assert.ok(approxEqual(c1, ans, 0.05) || approxEqual(c2, ans, 0.05),
                    `${diff}/seed${seed}: elevation ${ans}° not in {${c1},${c2}} for ${ns[0]},${ns[1]}`);
                checked++;
            }
        }
    }
    assert.ok(checked > 20, `only ${checked} application questions verified`);
});
