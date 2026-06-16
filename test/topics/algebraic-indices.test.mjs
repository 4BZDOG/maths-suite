// =============================================================
// test/topics/algebraic-indices.test.mjs — verifier for the
// "Algebraic Indices" topic (index laws with pronumeral bases).
// =============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { genStage5, DIFFS, checkStructure } from '../_helpers.mjs';
import { generateMathsQuestions } from '../../generators/mathsQuestionGen.js';

const TOPIC = 'Algebraic Indices';

// Collect every "^{e}" exponent appearing in a clue, in order.
function clueExps(clue) {
    return [...clue.matchAll(/\^\{(\d+)\}/g)].map(m => Number(m[1]));
}
// The exponent stamped onto the single-variable answer string "v^e".
function answerExp(answer) {
    const m = answer.match(/\^(\d+)/);
    return m ? Number(m[1]) : null;
}

// ---- structural floor across both stages -----------------------
test('Algebraic Indices: structurally valid at every difficulty', () => {
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

// ---- multiply law: exponents add (single-variable easy/medium) -
test('Algebraic Indices: multiply law adds exponents', () => {
    let checked = 0;
    for (const diff of ['Easy', 'Medium']) {
        for (let seed = 1; seed <= 80; seed++) {
            const qs = genStage5({ topic: TOPIC, difficulty: diff, count: 6, seed,
                subOpsFilter: { [TOPIC]: ['alg-multiply'] } });
            for (const q of qs) {
                const exps = clueExps(q.clue), ansExp = answerExp(q.answer);
                if (ansExp === null || exps.length < 2) continue;
                assert.equal(ansExp, exps.reduce((a, b) => a + b, 0),
                    `multiply/${diff}/seed${seed}: ${q.clue} → ${q.answer}`);
                checked++;
            }
        }
    }
    assert.ok(checked > 50, `only ${checked} multiply questions verified`);
});

// ---- divide law: exponents subtract (easy/medium) --------------
test('Algebraic Indices: divide law subtracts exponents', () => {
    let checked = 0;
    for (const diff of ['Easy', 'Medium']) {
        for (let seed = 1; seed <= 80; seed++) {
            const qs = genStage5({ topic: TOPIC, difficulty: diff, count: 6, seed,
                subOpsFilter: { [TOPIC]: ['alg-divide'] } });
            for (const q of qs) {
                const exps = clueExps(q.clue), ansExp = answerExp(q.answer);
                if (ansExp === null || exps.length !== 2) continue;
                assert.equal(ansExp, exps[0] - exps[1],
                    `divide/${diff}/seed${seed}: ${q.clue} → ${q.answer}`);
                checked++;
            }
        }
    }
    assert.ok(checked > 40, `only ${checked} divide questions verified`);
});

// ---- power of a power: exponents multiply (easy) ---------------
test('Algebraic Indices: power-of-a-power multiplies exponents', () => {
    let checked = 0;
    for (let seed = 1; seed <= 100; seed++) {
        const qs = genStage5({ topic: TOPIC, difficulty: 'Easy', count: 6, seed,
            subOpsFilter: { [TOPIC]: ['alg-power'] } });
        for (const q of qs) {
            const exps = clueExps(q.clue), ansExp = answerExp(q.answer);
            if (ansExp === null || exps.length !== 2) continue;
            assert.equal(ansExp, exps[0] * exps[1],
                `power/seed${seed}: ${q.clue} → ${q.answer}`);
            checked++;
        }
    }
    assert.ok(checked > 40, `only ${checked} power questions verified`);
});

// ---- zero index evaluates to 1 (easy) --------------------------
test('Algebraic Indices: zero index evaluates to 1', () => {
    let seen = 0;
    for (let seed = 1; seed <= 40; seed++) {
        const qs = genStage5({ topic: TOPIC, difficulty: 'Easy', count: 6, seed,
            subOpsFilter: { [TOPIC]: ['alg-zero'] } });
        for (const q of qs) {
            assert.equal(q.answer, '1', `zero/seed${seed}: ${q.clue} → ${q.answer}`);
            seen++;
        }
    }
    assert.ok(seen > 30, `only ${seen} zero-index questions generated (Stage 5 gating?)`);
});

// ---- negative index becomes a unit fraction (easy) -------------
test('Algebraic Indices: negative index becomes a unit fraction', () => {
    let checked = 0;
    for (let seed = 1; seed <= 60; seed++) {
        const qs = genStage5({ topic: TOPIC, difficulty: 'Easy', count: 6, seed,
            subOpsFilter: { [TOPIC]: ['alg-negative'] } });
        for (const q of qs) {
            assert.match(q.answer, /^1\/[a-z]\^\d+$/,
                `negative/seed${seed}: ${q.answer}`);
            checked++;
        }
    }
    assert.ok(checked > 30, `only ${checked} negative-index questions verified`);
});

// ---- Stage 4 gating: zero/negative index must NOT appear -------
test('Algebraic Indices: zero & negative indices are Stage 5 only', () => {
    for (let seed = 1; seed <= 40; seed++) {
        const qs = generateMathsQuestions({
            subTopic: TOPIC, difficulty: 'All', count: 10, seed, stage: 'Stage 4',
            subOpsFilter: { [TOPIC]: ['alg-zero', 'alg-negative'] },
        });
        assert.equal(qs.length, 0,
            `Stage 4 produced zero/negative-index questions at seed ${seed}`);
    }
});
