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

// ---- worked solution terminates at the stated answer -----------
test('Equations: worked solution ends at the stated answer', () => {
    for (const diff of DIFFS) {
        for (let seed = 1; seed <= 50; seed++) {
            const qs = genStage5({ topic: TOPIC, difficulty: diff, count: 8, seed });
            for (const q of qs) {
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

// ---- Stage 4 gating: fraction equations are Stage 5 only -------
test('Equations: fraction equations are Stage 5 only', () => {
    for (let seed = 1; seed <= 40; seed++) {
        const qs = generateMathsQuestions({
            subTopic: TOPIC, difficulty: 'All', count: 10, seed, stage: 'Stage 4',
            subOpsFilter: { [TOPIC]: ['fractions'] },
        });
        assert.equal(qs.length, 0,
            `Stage 4 produced fraction equations at seed ${seed}`);
    }
});
