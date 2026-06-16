// =============================================================
// test/topics/nesa-focus-areas.test.mjs — verifiers for the
// Measurement & Space and Statistics focus-area topics added to
// mirror the NESA Mathematics K–10 (2022) structure.
// =============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { gen, genStage5, DIFFS, checkStructure } from '../_helpers.mjs';
import { generateMathsQuestions } from '../../generators/mathsQuestionGen.js';

// integers that appear as "<n>\text{ cm}" in a clue, in order
function cmNums(clue) {
    return [...clue.matchAll(/(\d+)\\text\{ cm\}/g)].map(m => Number(m[1]));
}

// ---- structural sweep over every new topic --------------------
const NEW_S4 = ['Length', 'Area', 'Volume', 'Time', "Pythagoras' Theorem",
                'Data Classification and Visualisation'];
test('NESA focus areas: structurally valid at every difficulty', () => {
    for (const topic of NEW_S4) {
        for (const diff of DIFFS) {
            let total = 0;
            for (let seed = 1; seed <= 40; seed++) {
                const qs = gen({ topic, difficulty: diff, count: 6, seed });
                total += qs.length;
                for (const q of qs) checkStructure(q, `${topic}/${diff}/seed${seed}`, assert);
            }
            assert.ok(total >= 30, `${topic}/${diff}: only ${total} questions over 40 seeds`);
        }
    }
});

// ---- Length: perimeter of a rectangle = 2(w + h) --------------
test('Length: rectangle perimeter matches 2(w + h)', () => {
    let checked = 0;
    for (let seed = 1; seed <= 80; seed++) {
        const qs = gen({ topic: 'Length', difficulty: 'Easy', count: 6, seed,
            subOpsFilter: { Length: ['perimeter'] } });
        for (const q of qs) {
            if (!/perimeter of a rectangle/.test(q.clue)) continue;
            const [w, h] = cmNums(q.clue);
            assert.equal(Number(q.answer), 2 * (w + h), `${q.clue} → ${q.answer}`);
            checked++;
        }
    }
    assert.ok(checked > 20, `only ${checked} rectangle-perimeter questions`);
});

// ---- Volume: rectangular prism = l × w × h --------------------
test('Volume: rectangular prism volume matches l × w × h', () => {
    let checked = 0;
    for (let seed = 1; seed <= 80; seed++) {
        const qs = gen({ topic: 'Volume', difficulty: 'Easy', count: 6, seed,
            subOpsFilter: { Volume: ['prism'] } });
        for (const q of qs) {
            if (!/rectangular prism/.test(q.clue)) continue;
            const [l, w, h] = cmNums(q.clue);
            assert.equal(Number(q.answer), l * w * h, `${q.clue} → ${q.answer}`);
            checked++;
        }
    }
    assert.ok(checked > 20, `only ${checked} prism questions`);
});

// ---- Pythagoras: triple-based questions satisfy a² + b² = c² --
test("Pythagoras' Theorem: sides satisfy a² + b² = c²", () => {
    let checked = 0;
    for (const diff of ['Easy', 'Medium']) {
        for (let seed = 1; seed <= 80; seed++) {
            const qs = gen({ topic: "Pythagoras' Theorem", difficulty: diff, count: 6, seed });
            for (const q of qs) {
                const nums = cmNums(q.clue), ans = Number(q.answer);
                let a, b, c;
                if (/Find the hypotenuse/.test(q.clue)) { [a, b] = nums; c = ans; }
                else { [c, a] = nums; b = ans; }
                assert.equal(a * a + b * b, c * c, `${q.clue} → ${q.answer}`);
                checked++;
            }
        }
    }
    assert.ok(checked > 100, `only ${checked} Pythagoras questions verified`);
});

// ---- Time: 12-hour pm converts to +12 in 24-hour time ---------
test('Time: pm conversion adds 12 hours', () => {
    let checked = 0;
    for (let seed = 1; seed <= 80; seed++) {
        const qs = gen({ topic: 'Time', difficulty: 'Easy', count: 6, seed,
            subOpsFilter: { Time: ['convert'] } });
        for (const q of qs) {
            const m = q.clue.match(/\$(\d+)\{:\}(\d+)\\text\{ (am|pm)\}\$/);
            if (!m) continue;
            const h = Number(m[1]), min = m[2], pm = m[3] === 'pm';
            const expH = String(pm ? h + 12 : h).padStart(2, '0');
            assert.equal(q.answer, `${expH}:${min}`, `${q.clue} → ${q.answer}`);
            checked++;
        }
    }
    assert.ok(checked > 20, `only ${checked} time-conversion questions`);
});

// ---- Data viz: frequency-table total equals the sum -----------
test('Data Classification and Visualisation: frequency total is the sum', () => {
    let checked = 0;
    for (const diff of DIFFS) {
        for (let seed = 1; seed <= 50; seed++) {
            const qs = gen({ topic: 'Data Classification and Visualisation', difficulty: diff,
                count: 6, seed, subOpsFilter: { 'Data Classification and Visualisation': ['frequency-total'] } });
            for (const q of qs) {
                const m = q.clue.match(/frequencies of \$([\d, ]+)\$/);
                if (!m) continue;
                const sum = m[1].split(',').reduce((a, b) => a + Number(b), 0);
                assert.equal(Number(q.answer), sum, `${q.clue} → ${q.answer}`);
                checked++;
            }
        }
    }
    assert.ok(checked > 50, `only ${checked} frequency-total questions`);
});

// ---- Stage gating ---------------------------------------------
test('NESA focus areas: 3-D solids & surface area are Stage 5 only', () => {
    for (let seed = 1; seed <= 40; seed++) {
        const vol = generateMathsQuestions({ subTopic: 'Volume', difficulty: 'All', count: 10,
            seed, stage: 'Stage 4', subOpsFilter: { Volume: ['pyramid', 'sphere'] } });
        assert.equal(vol.length, 0, `Stage 4 produced pyramid/sphere at seed ${seed}`);
        const area = generateMathsQuestions({ subTopic: 'Area', difficulty: 'All', count: 10,
            seed, stage: 'Stage 4', subOpsFilter: { Area: ['surface-area'] } });
        assert.equal(area.length, 0, `Stage 4 produced surface area at seed ${seed}`);
    }
});

// ---- Stage 5 volume (pyramids & spheres) actually generates ----
test('Volume: Stage 5 pyramids & spheres generate valid questions', () => {
    let total = 0;
    for (const op of ['pyramid', 'sphere']) {
        for (let seed = 1; seed <= 30; seed++) {
            const qs = genStage5({ topic: 'Volume', difficulty: 'Hard', count: 6, seed,
                subOpsFilter: { Volume: [op] } });
            for (const q of qs) checkStructure(q, `Volume/${op}/seed${seed}`, assert);
            total += qs.length;
        }
    }
    assert.ok(total >= 60, `only ${total} Stage 5 pyramid/sphere questions`);
});
