// =============================================================
// test/topics/equations.test.mjs — verifier for the "Equations"
// topic (granular linear-equation types + substitution).
// =============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { genStage5, DIFFS, checkStructure, approxEqual } from '../_helpers.mjs';
import { generateMathsQuestions } from '../../generators/mathsQuestionGen.js';

const TOPIC = 'Equations';
// Ops whose clue is a literal equation we can back-substitute into.
const SOLVE_OPS = ['one-step', 'two-step', 'both-sides', 'brackets', 'fractions'];

// Substitute the stated solution back into the equation embedded in the clue
// and return {L, R} — the numeric value of each side. Returns null if the clue
// has no single-equation span (e.g. worded substitution questions).
function evalEquation(clue, answerVal) {
    const spans = [...clue.matchAll(/\$([^$]+)\$/g)].map(m => m[1]);
    const eqn = spans.find(s => s.includes('='));
    if (!eqn) return null;
    // variable = first bare letter once LaTeX commands (\dfrac, \times, …) are gone
    const varLetter = (eqn.replace(/\\[a-z]+/g, ' ').match(/[a-z]/) || [])[0];
    if (!varLetter) return null;

    const toJs = (side) => {
        let s = side;
        s = s.replace(/\\d?frac\{([^}]*)\}\{([^}]*)\}/g, '(($1)/($2))');
        s = s.replace(/\\times/g, '*').replace(/\\div/g, '/');
        s = s.replace(new RegExp(varLetter, 'g'), `(${answerVal})`);
        s = s.replace(/(\d)\s*\(/g, '$1*('); // implicit multiplication: 3( → 3*(
        return s;
    };
    const [lhs, rhs] = eqn.split('=');
    try {
        const L = Function(`"use strict"; return (${toJs(lhs)});`)();
        const R = Function(`"use strict"; return (${toJs(rhs)});`)();
        return Number.isFinite(L) && Number.isFinite(R) ? { L, R } : null;
    } catch { return null; }
}

// ---- structural floor across both stages -----------------------
test('Equations: structurally valid at every difficulty', () => {
    for (const diff of DIFFS) {
        let total = 0;
        for (let seed = 1; seed <= 60; seed++) {
            const qs = genStage5({ topic: TOPIC, difficulty: diff, count: 8, seed });
            total += qs.length;
            for (const q of qs) checkStructure(q, `${TOPIC}/${diff}/seed${seed}`, assert);
        }
        assert.ok(total >= 60, `${diff}: only ${total} questions across 60 seeds`);
    }
});

// ---- the stated solution actually satisfies the equation -------
test('Equations: solve-type solutions satisfy the equation', () => {
    let checked = 0;
    for (const op of SOLVE_OPS) {
        for (const diff of DIFFS) {
            for (let seed = 1; seed <= 60; seed++) {
                const qs = genStage5({ topic: TOPIC, difficulty: diff, count: 6, seed,
                    subOpsFilter: { [TOPIC]: [op] } });
                for (const q of qs) {
                    const ev = evalEquation(q.clue, Number(q.answer));
                    if (!ev) continue;
                    assert.ok(approxEqual(ev.L, ev.R),
                        `${op}/${diff}/seed${seed}: "${q.clue}" with ${q.answer} → L=${ev.L}, R=${ev.R}`);
                    checked++;
                }
            }
        }
    }
    assert.ok(checked > 200, `only ${checked} solve equations back-checked`);
});

// ---- quadratic x² = a : ±root satisfies a·root² = c -------------
test('Equations quadratic-square: ± root satisfies the equation', () => {
    let checked = 0;
    for (const diff of DIFFS) {
        for (let seed = 1; seed <= 150; seed++) {
            const qs = generateMathsQuestions({
                subTopic: TOPIC, difficulty: diff, count: 8, seed, stage: 'Stage 4',
                subOpsFilter: { [TOPIC]: ['quadratic-square'] },
            });
            for (const q of qs) {
                const am = String(q.answer).match(/^±(\d+)$/);
                if (!am) continue;
                const root = +am[1];
                const em = q.clue.match(/\$(\d*)([a-z])\^2 = (\d+)\$/);
                assert.ok(em, `${diff}/seed${seed}: no x²=a span in "${q.clue}"`);
                const a = em[1] === '' ? 1 : +em[1];
                const c = +em[3];
                assert.equal(a * root * root, c,
                    `${diff}/seed${seed}: ${q.clue} answer ±${root}`);
                checked++;
            }
        }
    }
    assert.ok(checked > 30, `only ${checked} quadratic-square questions verified`);
});

// ---- worked solution terminates at the stated answer -----------
test('Equations: worked solution ends at the stated answer', () => {
    for (const diff of DIFFS) {
        for (let seed = 1; seed <= 50; seed++) {
            const qs = genStage5({ topic: TOPIC, difficulty: diff, count: 8, seed });
            for (const q of qs) {
                // Only the solve-type ops have a single numeric answer; skip
                // inequalities / simultaneous (non-numeric answers, no worked).
                if (!/^-?\d+$/.test(String(q.answer))) continue;
                assert.ok(q.worked, `${diff}/seed${seed}: missing worked solution`);
                const nums = q.worked.match(/-?\d+/g) || [];
                const last = Number(nums[nums.length - 1]);
                assert.equal(last, Number(q.answer),
                    `${diff}/seed${seed}: worked ends ${last}, answer ${q.answer} — ${q.worked}`);
            }
        }
    }
});

// ---- substitution questions resolve to integer solutions -------
test('Equations: substitution questions yield integer solutions', () => {
    let n = 0;
    for (const diff of DIFFS) {
        for (let seed = 1; seed <= 50; seed++) {
            const qs = genStage5({ topic: TOPIC, difficulty: diff, count: 6, seed,
                subOpsFilter: { [TOPIC]: ['substitution'] } });
            for (const q of qs) {
                assert.match(String(q.answer), /^\d+$/,
                    `${diff}/seed${seed}: ${q.clue} → ${q.answer}`);
                n++;
            }
        }
    }
    assert.ok(n > 100, `only ${n} substitution questions generated`);
});

// ---- Inequalities: recompute the solution boundary independently ----
test('Equations: linear-inequality solutions match recomputed boundaries', () => {
    let checked = 0;
    for (const diff of DIFFS) {
        for (let seed = 1; seed <= 200; seed++) {
            const qs = genStage5({ topic: TOPIC, difficulty: diff, count: 6, seed,
                subOpsFilter: { [TOPIC]: ['inequalities'] } });
            for (const q of qs) {
                const eqn = [...q.clue.matchAll(/\$([^$]+)\$/g)].map(m => m[1])
                    .find(s => /[<>]/.test(s));
                if (!eqn) continue;
                const a = String(q.answer), L = `${diff}/seed${seed}: "${eqn}" → ${a}`;
                let m;
                // compound:  lo < a·v + b < hi
                if ((m = eqn.match(/^(\d+) < (\d+)([a-z]) \+ (\d+) < (\d+)$/))) {
                    const [, lo, ac, v, b, hi] = m;
                    assert.equal(a, `${(lo - b) / ac}<${v}<${(hi - b) / ac}`, L);
                    checked++; continue;
                }
                // sign-flip:  −a·v + b </> c   →  v flips
                if ((m = eqn.match(/^-(\d+)([a-z]) \+ (\d+) ([<>]) (-?\d+)$/))) {
                    const [, ac, v, b, sign, c] = m;
                    const flip = sign === '<' ? '>' : '<';
                    assert.equal(a, `${v}${flip}${(b - c) / ac}`, L);
                    checked++; continue;
                }
                // subtraction:  a·v − b </> c
                if ((m = eqn.match(/^(\d+)([a-z]) - (\d+) ([<>]) (-?\d+)$/))) {
                    const [, ac, v, b, sign, c] = m;
                    assert.equal(a, `${v}${sign}${(Number(c) + Number(b)) / ac}`, L);
                    checked++; continue;
                }
                // addition:  a·v + b </> c
                if ((m = eqn.match(/^(\d+)([a-z]) \+ (\d+) ([<>]) (-?\d+)$/))) {
                    const [, ac, v, b, sign, c] = m;
                    assert.equal(a, `${v}${sign}${(c - b) / ac}`, L);
                    checked++; continue;
                }
            }
        }
    }
    assert.ok(checked > 150, `only ${checked} inequality questions verified`);
});

// ---- Stage gating: inequalities & simultaneous are Stage 5 only ----
test('Equations: inequalities & simultaneous are Stage 5 only', () => {
    for (let seed = 1; seed <= 40; seed++) {
        const qs = generateMathsQuestions({
            subTopic: TOPIC, difficulty: 'All', count: 10, seed, stage: 'Stage 4',
            subOpsFilter: { [TOPIC]: ['inequalities', 'simultaneous'] },
        });
        assert.equal(qs.length, 0,
            `Stage 4 produced inequalities/simultaneous at seed ${seed}`);
    }
});
