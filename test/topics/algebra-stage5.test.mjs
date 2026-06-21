// =============================================================
// test/topics/algebra-stage5.test.mjs — Stage 5 Algebra verifiers.
//
// `expand` answers are verified by evaluating both the factored clue and the
// expanded answer polynomial at several x-values and asserting equality —
// robust to every product form (binomial, perfect square, difference of
// squares, two-coefficient).
// =============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { genStage5, DIFFS, approxEqual } from '../_helpers.mjs';

function toJs(e) {
    const s = e.replace(/\s+/g, '')
        .replace(/\)\(/g, ')*(')      // (..)(..) → (..)*(..)
        .replace(/²/g, '**2')
        .replace(/\^/g, '**')
        .replace(/(\d)x/g, '$1*x');   // 2x → 2*x
    if (!/^[0-9x+\-*/().]+$/.test(s)) throw new Error(`unsafe expr: ${e}`);
    return s;
}
function evalAt(e, x) { return Function('x', `"use strict"; return (${toJs(e)});`)(x); }

test('Algebra (Stage 5) expand: factored clue equals expanded answer', () => {
    let checked = 0;
    for (const diff of DIFFS) {
        for (let seed = 1; seed <= 200; seed++) {
            const qs = genStage5({ topic: 'Algebra', difficulty: diff, count: 6, seed,
                subOpsFilter: { Algebra: ['expand'] } });
            for (const q of qs) {
                const m = q.clue.match(/\$([^$]+)\$/);
                if (!m) continue;
                const clue = m[1], ans = q.answer;
                for (const x of [-2, -1, 2, 3, 5]) {
                    assert.ok(approxEqual(evalAt(clue, x), evalAt(ans, x)),
                        `${diff}/seed${seed}: ${clue} ≠ ${ans} at x=${x}`);
                }
                checked++;
            }
        }
    }
    assert.ok(checked > 150, `only ${checked} expand questions verified`);
});
