// =============================================================
// test/topics/surds.test.mjs — Stage 5 surds-simplify verifiers.
//
// Plain/coefficient simplifications are checked via the invariant
// (outer-coeff)²·radicand = (answer-coeff)²·(answer-radicand) with the answer
// radicand square-free; rationalisations are checked structurally.
// =============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { genStage5, DIFFS } from '../_helpers.mjs';

function squareFree(n) {
    for (let d = 2; d * d <= n; d++) if (n % (d * d) === 0) return false;
    return true;
}

test('Algebra (Stage 5) surds-simplify: simplifications & rationalisations are correct', () => {
    let checked = 0;
    for (const diff of DIFFS) {
        for (let seed = 1; seed <= 200; seed++) {
            const qs = genStage5({ topic: 'Algebra', difficulty: diff, count: 6, seed,
                subOpsFilter: { Algebra: ['surds-simplify'] } });
            for (const q of qs) {
                const c = q.clue, a = String(q.answer);
                // rationalise the denominator: a/√n → a√n / n
                let m = c.match(/\\dfrac\{(\d+)\}\{\\sqrt\{(\d+)\}\}/);
                if (m) {
                    const am = a.match(/^(\d+)√(\d+)\/(\d+)$/);
                    assert.ok(am, `${diff}/seed${seed}: bad rationalise answer "${a}"`);
                    assert.equal(Number(am[1]), Number(m[1]), `numerator coeff: "${c}" → ${a}`);
                    assert.equal(Number(am[2]), Number(m[2]), `surd: "${c}" → ${a}`);
                    assert.equal(Number(am[3]), Number(m[2]), `denominator: "${c}" → ${a}`);
                    checked++; continue;
                }
                // plain or coefficient simplify:  (c)√R → (ck)√n
                m = c.match(/(\d*)\\sqrt\{(\d+)\}/);
                if (m) {
                    const coeff = m[1] === '' ? 1 : Number(m[1]), R = Number(m[2]);
                    const am = a.match(/^(\d+)√(\d+)$/);
                    assert.ok(am, `${diff}/seed${seed}: bad simplify answer "${a}"`);
                    const C = Number(am[1]), N = Number(am[2]);
                    assert.equal(coeff * coeff * R, C * C * N, `value mismatch: "${c}" → ${a}`);
                    assert.ok(squareFree(N), `${diff}/seed${seed}: answer surd ${N} not fully simplified ("${c}" → ${a})`);
                    checked++; continue;
                }
            }
        }
    }
    assert.ok(checked > 250, `only ${checked} surds-simplify questions verified`);
});
