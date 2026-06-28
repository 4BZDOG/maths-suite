// =============================================================
// test/topics/stage5-path-topics.test.mjs — verifiers for the four
// Stage 5 Path topics added from the 2026 curriculum: Networks,
// Polynomials, Logarithms and Functions.
// =============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { genStage5, DIFFS, approxEqual, checkStructure } from '../_helpers.mjs';

const nums = (s) => [...String(s).matchAll(/-?\d+(?:\.\d+)?/g)].map(m => Number(m[0]));
// Evaluate a displayed polynomial/quadratic string (e.g. "2x^3 - 5x + 1") at x.
function evalAt(expr, x) {
    const e = String(expr).replace(/\s/g, '').replace(/\^/g, '**')
        .replace(/(\d)x/g, '$1*x').replace(/x/g, `(${x})`);
    return Function(`return (${e});`)();
}

const NEW = {
    'Networks': ['euler', 'degree-sum', 'euler-trail'],
    'Polynomials': ['degree', 'remainder', 'factor-theorem'],
    'Logarithms': ['evaluate', 'laws', 'solve'],
    'Functions': ['evaluate', 'domain-range', 'circle', 'hyperbola'],
};

test('Stage 5 Path topics: every sub-op is structurally valid and generates', () => {
    for (const [topic, ops] of Object.entries(NEW)) {
        for (const op of ops) {
            let count = 0;
            for (const diff of DIFFS) {
                for (let seed = 1; seed <= 40; seed++) {
                    const qs = genStage5({ topic, difficulty: diff, count: 6, seed,
                        subOpsFilter: { [topic]: [op] } });
                    for (const q of qs) { checkStructure(q, `${topic}/${op}/${diff}/seed${seed}`, assert); count++; }
                }
            }
            assert.ok(count > 30, `${topic}/${op}: only ${count} questions generated`);
        }
    }
});

test('Networks Euler: V + F − E = 2 holds for the recomputed answer', () => {
    let checked = 0;
    for (const diff of DIFFS) {
        for (let seed = 1; seed <= 120; seed++) {
            const qs = genStage5({ topic: 'Networks', difficulty: diff, count: 6, seed,
                subOpsFilter: { Networks: ['euler'] } });
            for (const q of qs) {
                const [x, y] = nums(q.clue);
                const a = Number(q.answer);
                let ok;
                if (/number of \*faces\*/.test(q.clue)) ok = a === 2 - x + y;        // x=V, y=E
                else if (/number of \*vertices\*/.test(q.clue)) ok = a === 2 - y + x; // x=E, y=F
                else ok = a === x + y - 2;                                            // edges: x=V, y=F
                assert.ok(ok, `${diff}/seed${seed}: ${q.clue} → ${q.answer}`);
                checked++;
            }
        }
    }
    assert.ok(checked > 30, `only ${checked} Euler questions verified`);
});

test('Networks degree/edges & Eulerian classification are correct', () => {
    let checked = 0;
    for (const diff of DIFFS) {
        for (let seed = 1; seed <= 120; seed++) {
            for (const op of ['degree-sum', 'euler-trail']) {
                const qs = genStage5({ topic: 'Networks', difficulty: diff, count: 4, seed,
                    subOpsFilter: { Networks: [op] } });
                for (const q of qs) {
                    if (op === 'degree-sum') {
                        if (/sum of the degrees/.test(q.clue)) {
                            const E = nums(q.clue)[0];
                            assert.equal(Number(q.answer), 2 * E, `${diff}/seed${seed}: ${q.clue}`);
                        } else {
                            const list = q.clue.match(/degrees \$([\d, ]+)\$/)[1].split(',').map(Number);
                            assert.equal(Number(q.answer), list.reduce((x, y) => x + y, 0) / 2, `${diff}/seed${seed}: ${q.clue}`);
                        }
                    } else {
                        const list = q.clue.match(/degree \$([\d, ]+)\$/)[1].split(',').map(Number);
                        const odd = list.filter(d => d % 2 === 1).length;
                        const exp = odd === 0 ? 'Eulerian circuit' : odd === 2 ? 'Eulerian trail' : 'neither';
                        assert.equal(q.answer, exp, `${diff}/seed${seed}: ${q.clue}`);
                    }
                    checked++;
                }
            }
        }
    }
    assert.ok(checked > 40, `only ${checked} network questions verified`);
});

test('Polynomials remainder/factor: answer matches P(k) of the shown polynomial', () => {
    let checked = 0;
    for (const diff of DIFFS) {
        for (let seed = 1; seed <= 150; seed++) {
            for (const op of ['remainder', 'factor-theorem', 'degree']) {
                const qs = genStage5({ topic: 'Polynomials', difficulty: diff, count: 4, seed,
                    subOpsFilter: { Polynomials: [op] } });
                for (const q of qs) {
                    const pm = q.clue.match(/P\(x\) = ([^$]+)\$/);
                    if (op === 'degree') {
                        if (/state the \*degree\*/.test(q.clue)) assert.equal(Number(q.answer), 3, `${q.clue}`);
                        checked++; continue;
                    }
                    if (!pm) continue;
                    const km = q.clue.match(/\(x ([+-]) (\d+)\)/);
                    const k = (km[1] === '-' ? 1 : -1) * Number(km[2]);
                    const Pk = evalAt(pm[1], k);
                    if (op === 'remainder') {
                        assert.equal(Number(q.answer), Pk, `${diff}/seed${seed}: ${q.clue} → ${q.answer} (P(${k})=${Pk})`);
                    } else {
                        assert.equal(q.answer, Pk === 0 ? 'Yes' : 'No', `${diff}/seed${seed}: ${q.clue} (P(${k})=${Pk})`);
                    }
                    checked++;
                }
            }
        }
    }
    assert.ok(checked > 60, `only ${checked} polynomial questions verified`);
});

test('Logarithms: evaluate / solve answers are correct', () => {
    let checked = 0;
    for (const diff of DIFFS) {
        for (let seed = 1; seed <= 150; seed++) {
            for (const op of ['evaluate', 'solve']) {
                const qs = genStage5({ topic: 'Logarithms', difficulty: diff, count: 4, seed,
                    subOpsFilter: { Logarithms: [op] } });
                for (const q of qs) {
                    let m;
                    if (op === 'evaluate' && (m = q.clue.match(/\\log_\{(\d+)\}\((\d+)\)\.\$?/)) && !/\+|\\frac/.test(q.clue)) {
                        const [base, arg] = [+m[1], +m[2]];
                        assert.ok(approxEqual(Number(q.answer), Math.round(Math.log(arg) / Math.log(base))),
                            `eval ${diff}/seed${seed}: ${q.clue} → ${q.answer}`);
                        checked++;
                    } else if (op === 'solve' && (m = q.clue.match(/\$(\d+)\^x = (\d+)\$/))) {
                        assert.ok(approxEqual(Number(q.answer), Math.log(+m[2]) / Math.log(+m[1])),
                            `solve-exp ${diff}/seed${seed}: ${q.clue} → ${q.answer}`);
                        checked++;
                    } else if (op === 'solve' && (m = q.clue.match(/\\log_\{(\d+)\}\(x\) = (\d+)\$/))) {
                        assert.equal(Number(q.answer), (+m[1]) ** (+m[2]), `solve-log ${diff}/seed${seed}: ${q.clue}`);
                        checked++;
                    }
                }
            }
        }
    }
    assert.ok(checked > 40, `only ${checked} logarithm questions verified`);
});

test('Functions: f(k) evaluation and circle centre/radius are correct', () => {
    let checked = 0;
    for (const diff of DIFFS) {
        for (let seed = 1; seed <= 150; seed++) {
            for (const op of ['evaluate', 'circle']) {
                const qs = genStage5({ topic: 'Functions', difficulty: diff, count: 4, seed,
                    subOpsFilter: { Functions: [op] } });
                for (const q of qs) {
                    if (op === 'evaluate') {
                        const fm = q.clue.match(/f\(x\) = ([^$]+)\$, evaluate \$f\((-?\d+)\)/);
                        if (!fm) continue;
                        assert.equal(Number(q.answer), evalAt(fm[1], Number(fm[2])),
                            `eval ${diff}/seed${seed}: ${q.clue} → ${q.answer}`);
                        checked++;
                    } else {
                        const em = q.clue.match(/x\^2 \+ y\^2 ([+-]) (\d+)x ([+-]) (\d+)y ([+-]) (\d+) = 0/);
                        if (!em) continue;
                        const D = (em[1] === '-' ? -1 : 1) * +em[2];
                        const E = (em[3] === '-' ? -1 : 1) * +em[4];
                        const F = (em[5] === '-' ? -1 : 1) * +em[6];
                        const h = -D / 2, k = -E / 2, r = Math.sqrt(h * h + k * k - F);
                        if (/\*centre\*/.test(q.clue)) {
                            assert.equal(q.answer, `(${h},${k})`, `centre ${diff}/seed${seed}: ${q.clue}`);
                        } else {
                            assert.ok(approxEqual(Number(q.answer), r), `radius ${diff}/seed${seed}: ${q.clue} → ${q.answer} (r=${r})`);
                        }
                        checked++;
                    }
                }
            }
        }
    }
    assert.ok(checked > 40, `only ${checked} function questions verified`);
});
