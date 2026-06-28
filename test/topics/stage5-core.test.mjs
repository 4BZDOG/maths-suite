// =============================================================
// test/topics/stage5-core.test.mjs — verifiers for the Stage 5
// Core/Path sub-ops added from the 2026 Stage 5 curriculum:
// Financial (wages/commission/term-payments), scientific notation &
// measurement error, fractional indices, algebraic fractions &
// factorising, completing the square / quadratic formula / line-curve
// simultaneous, parallel/perpendicular & general-form lines, cones,
// sine/cosine/area rules + exact values + trig equations + 3D trig,
// standard deviation & box plots, conditional/Venn/two-way probability.
// =============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { genStage5, DIFFS, approxEqual, checkStructure } from '../_helpers.mjs';

const nums = (s) => [...String(s).matchAll(/-?\d+(?:\.\d+)?/g)].map(m => Number(m[0]));
function gcd(a, b) { return b === 0 ? a : gcd(b, a % b); }
function fracEq(ans, n, d) {
    const g = gcd(n, d); const en = n / g, ed = d / g;
    if (/^\d+$/.test(String(ans))) return Number(ans) === en && ed === 1;
    const m = String(ans).match(/\\frac\{(\d+)\}\{(\d+)\}/);
    return m && Number(m[1]) === en && Number(m[2]) === ed;
}

// Generic structural floor for every new sub-op.
const NEW = {
    'Financial Maths': ['wages', 'commission', 'term-payments'],
    'Rounding': ['sci-notation', 'measurement-error'],
    'Indices': ['indices-fraction'],
    'Algebraic Indices': ['alg-fraction'],
    'Algebra': ['factorise-nonmonic', 'factorise-grouping', 'alg-fractions'],
    'Equations': ['complete-square', 'quad-formula', 'simultaneous-nonlinear'],
    'Linear Relationships': ['parallel-perp', 'general-form'],
    'Volume': ['cone'],
    'Trigonometry': ['sine-rule', 'cosine-rule', 'area-rule', 'exact-values', 'trig-equations', 'trig-3d'],
    'Statistics': ['std-dev', 'box-plot'],
    'Probability': ['conditional', 'venn', 'two-way'],
};

test('Stage 5 new sub-ops: every one is structurally valid and generates', () => {
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

// ---- Indices: fractional index evaluates correctly --------------
test('Indices fractional: a^(m/n) matches the recomputed integer/reciprocal', () => {
    let checked = 0;
    for (const diff of DIFFS) {
        for (let seed = 1; seed <= 120; seed++) {
            const qs = genStage5({ topic: 'Indices', difficulty: diff, count: 6, seed,
                subOpsFilter: { Indices: ['indices-fraction'] } });
            for (const q of qs) {
                const m = q.clue.match(/\$(\d+)\^\{(-?)\\frac\{(\d+)\}\{(\d+)\}\}\$/);
                if (!m) continue;
                const [base, neg, num, den] = [+m[1], m[2] === '-', +m[3], +m[4]];
                const val = Math.round(Math.pow(base, num / den));
                if (neg) assert.equal(q.answer, `1/${val}`, `${diff}/seed${seed}: ${q.clue}`);
                else assert.equal(Number(q.answer), val, `${diff}/seed${seed}: ${q.clue}`);
                checked++;
            }
        }
    }
    assert.ok(checked > 20, `only ${checked} fractional-index questions verified`);
});

// ---- Algebra: non-monic factors expand back to the trinomial ----
test('Algebra factorise-nonmonic: factors expand to the given trinomial', () => {
    let checked = 0;
    for (const diff of ['Medium', 'Hard']) {
        for (let seed = 1; seed <= 150; seed++) {
            const qs = genStage5({ topic: 'Algebra', difficulty: diff, count: 6, seed,
                subOpsFilter: { Algebra: ['factorise-nonmonic'] } });
            for (const q of qs) {
                const tm = q.clue.match(/\$(\d+)x\^2\s*([+-])\s*(\d+)x\s*([+-])\s*(\d+)\$/);
                const fm = q.answer.match(/^\((\d*)x([+-]\d+)\)\((\d*)x([+-]\d+)\)$/);
                if (!tm || !fm) continue;
                const a = +tm[1], b = (tm[2] === '-' ? -1 : 1) * +tm[3], c = (tm[4] === '-' ? -1 : 1) * +tm[5];
                const p = fm[1] === '' ? 1 : +fm[1], q1 = +fm[2], r = fm[3] === '' ? 1 : +fm[3], s = +fm[4];
                assert.equal(p * r, a, `${diff}/seed${seed}: leading ${q.clue} → ${q.answer}`);
                assert.equal(p * s + q1 * r, b, `${diff}/seed${seed}: middle ${q.clue} → ${q.answer}`);
                assert.equal(q1 * s, c, `${diff}/seed${seed}: constant ${q.clue} → ${q.answer}`);
                checked++;
            }
        }
    }
    assert.ok(checked > 20, `only ${checked} non-monic factorisations verified`);
});

// ---- Equations: completing the square roots satisfy x²+bx+c=0 ---
test('Equations complete-square: stated roots satisfy the equation', () => {
    let checked = 0;
    for (const diff of DIFFS) {
        for (let seed = 1; seed <= 120; seed++) {
            const qs = genStage5({ topic: 'Equations', difficulty: diff, count: 6, seed,
                subOpsFilter: { Equations: ['complete-square'] } });
            for (const q of qs) {
                const em = q.clue.match(/x\^2 \+ (\d+)x ([+-]) (\d+) = 0/);
                const am = q.answer.match(/^(-?\d+)±(\d+)√(\d+)$/);
                if (!em || !am) continue;
                const b = +em[1], c = (em[2] === '-' ? -1 : 1) * +em[3];
                const h = +am[1], k = +am[2], rad = +am[3];
                for (const root of [h + k * Math.sqrt(rad), h - k * Math.sqrt(rad)]) {
                    assert.ok(approxEqual(root * root + b * root + c, 0, 1e-6),
                        `${diff}/seed${seed}: root ${root} fails ${q.clue}`);
                }
                checked++;
            }
        }
    }
    assert.ok(checked > 20, `only ${checked} complete-square questions verified`);
});

// ---- Equations: quadratic-formula roots satisfy ax²+bx+c=0 ------
test('Equations quad-formula: stated roots satisfy the equation', () => {
    let checked = 0;
    for (const diff of DIFFS) {
        for (let seed = 1; seed <= 120; seed++) {
            const qs = genStage5({ topic: 'Equations', difficulty: diff, count: 6, seed,
                subOpsFilter: { Equations: ['quad-formula'] } });
            for (const q of qs) {
                const em = q.clue.match(/\$(\d*)x\^2 ?([+-] \d+x)? ([+-] \d+) = 0\$/);
                const am = q.answer.match(/^\((-?\d+)±(\d+)√(\d+)\)\/(\d+)$/);
                if (!em || !am) continue;
                const a = em[1] === '' ? 1 : +em[1];
                const b = em[2] ? Number(em[2].replace(/\s/g, '').replace('x', '')) : 0;
                const c = Number(em[3].replace(/\s/g, ''));
                const [nb, k, rad, den] = [+am[1], +am[2], +am[3], +am[4]];
                for (const root of [(nb + k * Math.sqrt(rad)) / den, (nb - k * Math.sqrt(rad)) / den]) {
                    assert.ok(approxEqual(a * root * root + b * root + c, 0, 1e-6),
                        `${diff}/seed${seed}: root ${root} fails ${q.clue} (a=${a},b=${b},c=${c})`);
                }
                checked++;
            }
        }
    }
    assert.ok(checked > 20, `only ${checked} quad-formula questions verified`);
});

// ---- Equations: line-curve simultaneous x-values satisfy y=x² ----
test('Equations simultaneous-nonlinear: x-values lie on both curves', () => {
    let checked = 0;
    for (const diff of DIFFS) {
        for (let seed = 1; seed <= 120; seed++) {
            const qs = genStage5({ topic: 'Equations', difficulty: diff, count: 6, seed,
                subOpsFilter: { Equations: ['simultaneous-nonlinear'] } });
            for (const q of qs) {
                const am = q.answer.match(/^x=(-?\d+),(-?\d+)$/);
                const line = q.clue.split('\n').find(l => /\$y = /.test(l) && !/x\^2/.test(l));
                if (!am || !line) continue;
                const expr = line.match(/\$y = ([^$]+)\$/)[1].replace(/\s/g, '');
                const xm = expr.match(/(-?\d*)x/);
                const m = !xm ? 0 : (xm[1] === '' ? 1 : xm[1] === '-' ? -1 : +xm[1]);
                const cm = expr.replace(/(-?\d*)x/, '').match(/(-?\d+)/);
                const c = cm ? +cm[1] : 0;
                for (const x of [+am[1], +am[2]]) {
                    assert.ok(approxEqual(x * x, m * x + c, 1e-9),
                        `${diff}/seed${seed}: x=${x} fails y=x² vs line (m=${m},c=${c}) | ${line}`);
                }
                checked++;
            }
        }
    }
    assert.ok(checked > 20, `only ${checked} simultaneous-nonlinear questions verified`);
});

// ---- Volume: cone coefficient = ⅓ r² h --------------------------
test('Volume cone: π-coefficient equals ⅓ r² h', () => {
    let checked = 0;
    for (const diff of DIFFS) {
        for (let seed = 1; seed <= 80; seed++) {
            const qs = genStage5({ topic: 'Volume', difficulty: diff, count: 6, seed,
                subOpsFilter: { Volume: ['cone'] } });
            for (const q of qs) {
                const m = q.clue.match(/radius \$(\d+)\\text\{ cm\}\$ and perpendicular height \$(\d+)/);
                if (!m) continue;
                const [r, h] = [+m[1], +m[2]];
                assert.equal(q.answer, `${(r * r * h) / 3}π`, `${diff}/seed${seed}: ${q.clue}`);
                checked++;
            }
        }
    }
    assert.ok(checked > 20, `only ${checked} cone questions verified`);
});

// ---- Trig: sine/cosine/area rules recompute within tolerance ----
test('Trig sine/cosine/area rules: answers match recomputation', () => {
    let sChecked = 0, aChecked = 0;
    for (const diff of DIFFS) {
        for (let seed = 1; seed <= 120; seed++) {
            for (const op of ['sine-rule', 'cosine-rule', 'area-rule']) {
                const qs = genStage5({ topic: 'Trigonometry', difficulty: diff, count: 4, seed,
                    subOpsFilter: { Trigonometry: [op] } });
                for (const q of qs) {
                    const ans = Number(q.answer);
                    const [p, q2, r] = nums(q.clue);   // first three numbers in the clue
                    if (op === 'area-rule') {
                        assert.ok(approxEqual(ans, Math.round(0.5 * p * q2 * Math.sin(r * Math.PI / 180) * 10) / 10, 0.05),
                            `area ${diff}/seed${seed}: ${q.clue} → ${q.answer}`);
                        aChecked++;
                    } else if (op === 'cosine-rule' && /side \$c\$/.test(q.clue)) {
                        const c = Math.sqrt(p * p + q2 * q2 - 2 * p * q2 * Math.cos(r * Math.PI / 180));
                        assert.ok(approxEqual(ans, Math.round(c * 10) / 10, 0.05),
                            `cos ${diff}/seed${seed}: ${q.clue} → ${q.answer}`);
                        sChecked++;
                    } else if (op === 'cosine-rule') {
                        // largest angle opposite the longest side r
                        const Z = Math.round(Math.acos((p * p + q2 * q2 - r * r) / (2 * p * q2)) * 180 / Math.PI);
                        assert.ok(approxEqual(ans, Z, 1.5),
                            `cos-angle ${diff}/seed${seed}: ${q.clue} → ${q.answer}`);
                        sChecked++;
                    } else if (op === 'sine-rule') {
                        const b = p * Math.sin(r * Math.PI / 180) / Math.sin(q2 * Math.PI / 180);
                        assert.ok(approxEqual(ans, Math.round(b * 10) / 10, 0.05),
                            `sin ${diff}/seed${seed}: ${q.clue} → ${q.answer}`);
                        sChecked++;
                    }
                }
            }
        }
    }
    assert.ok(sChecked > 20 && aChecked > 20, `sine/cosine ${sChecked}, area ${aChecked} verified`);
});

// ---- Trig: trig-equations solutions lie in range & solve ---------
test('Trig trig-equations: each solution satisfies the equation in [0,360]', () => {
    const VAL = { '\\frac{1}{2}': 0.5, '\\frac{\\sqrt{3}}{2}': Math.sqrt(3) / 2,
        '\\frac{\\sqrt{2}}{2}': Math.sqrt(2) / 2, '1': 1, '\\sqrt{3}': Math.sqrt(3) };
    const fn = { sin: Math.sin, cos: Math.cos, tan: Math.tan };
    let checked = 0;
    for (let seed = 1; seed <= 150; seed++) {
        const qs = genStage5({ topic: 'Trigonometry', difficulty: 'Medium', count: 4, seed,
            subOpsFilter: { Trigonometry: ['trig-equations'] } });
        for (const q of qs) {
            const m = q.clue.match(/\\(sin|cos|tan)\\theta = ([^$]+)\$/);
            if (!m) continue;
            const f = m[1], target = VAL[m[2].trim()];
            if (target === undefined) continue;
            for (const ang of q.answer.split(',').map(Number)) {
                assert.ok(ang >= 0 && ang <= 360, `seed${seed}: ${ang} out of range`);
                assert.ok(approxEqual(fn[f](ang * Math.PI / 180), target, 1e-6),
                    `seed${seed}: ${f}(${ang})≠${m[2]}`);
            }
            checked++;
        }
    }
    assert.ok(checked > 20, `only ${checked} trig-equation questions verified`);
});

// ---- Trig: 3D body-diagonal angle = atan(h / √(l²+w²)) ----------
test('Trig 3D: body-diagonal angle matches recomputation', () => {
    let checked = 0;
    for (let seed = 1; seed <= 150; seed++) {
        const qs = genStage5({ topic: 'Trigonometry', difficulty: 'Hard', count: 4, seed,
            subOpsFilter: { Trigonometry: ['trig-3d'] } });
        for (const q of qs) {
            const m = q.clue.match(/\$(\d+)\\text\{ cm\} \\times (\d+)\\text\{ cm\} \\times (\d+)/);
            if (!m) continue;
            const [l, w, h] = [+m[1], +m[2], +m[3]];
            const exp = Math.round(Math.atan2(h, Math.sqrt(l * l + w * w)) * 180 / Math.PI);
            assert.equal(Number(q.answer), exp, `seed${seed}: ${q.clue} → ${q.answer}`);
            checked++;
        }
    }
    assert.ok(checked > 20, `only ${checked} 3D-trig questions verified`);
});

// ---- Statistics: population standard deviation ------------------
test('Statistics std-dev: matches recomputed population σ', () => {
    let checked = 0;
    for (const diff of DIFFS) {
        for (let seed = 1; seed <= 120; seed++) {
            const qs = genStage5({ topic: 'Statistics', difficulty: diff, count: 4, seed,
                subOpsFilter: { Statistics: ['std-dev'] } });
            for (const q of qs) {
                const m = q.clue.match(/\$([\d, ]+)\$/);
                if (!m) continue;
                const data = m[1].split(',').map(Number);
                const mean = data.reduce((a, b) => a + b, 0) / data.length;
                const sd = Math.sqrt(data.reduce((s, x) => s + (x - mean) ** 2, 0) / data.length);
                assert.ok(approxEqual(Number(q.answer), Math.round(sd * 100) / 100, 0.011),
                    `${diff}/seed${seed}: ${q.clue} → ${q.answer} (expected ${sd})`);
                checked++;
            }
        }
    }
    assert.ok(checked > 20, `only ${checked} std-dev questions verified`);
});

// ---- Statistics: box-plot outlier rule -------------------------
test('Statistics box-plot: outlier/fence answers use 1.5×IQR', () => {
    let checked = 0;
    for (let seed = 1; seed <= 200; seed++) {
        const qs = genStage5({ topic: 'Statistics', difficulty: 'Hard', count: 4, seed,
            subOpsFilter: { Statistics: ['box-plot'] } });
        for (const q of qs) {
            const m = q.clue.match(/Q_1 = (\d+)\$ and \$Q_3 = (\d+)/);
            if (!m) continue;
            const q1 = +m[1], q3 = +m[2], iqr = q3 - q1;
            if (/an \*outlier\*/.test(q.clue)) {
                const v = nums(q.clue.match(/is \$(-?\d+)\$ an/)[1])[0];
                const isOut = v < q1 - 1.5 * iqr || v > q3 + 1.5 * iqr;
                assert.equal(q.answer, isOut ? 'Yes' : 'No', `seed${seed}: ${q.clue}`);
            } else if (/upper/.test(q.clue)) {
                assert.equal(Number(q.answer), q3 + 1.5 * iqr, `seed${seed}: ${q.clue}`);
            } else {
                assert.equal(Number(q.answer), q1 - 1.5 * iqr, `seed${seed}: ${q.clue}`);
            }
            checked++;
        }
    }
    assert.ok(checked > 20, `only ${checked} box-plot questions verified`);
});

// ---- Probability: conditional / Venn / two-way fractions --------
test('Probability conditional: P(A|B) = both / n(B)', () => {
    let checked = 0;
    for (let seed = 1; seed <= 250; seed++) {
        const qs = genStage5({ topic: 'Probability', difficulty: 'Medium', count: 4, seed,
            subOpsFilter: { Probability: ['conditional'] } });
        for (const q of qs) {
            const m = q.clue.match(/group of \$(\d+)\$ students, \$(\d+)\$ study \w+, \$(\d+)\$ study \w+, and \$(\d+)\$ study both/);
            if (!m) continue;
            const nB = +m[3], both = +m[4];
            assert.ok(fracEq(q.answer, both, nB), `seed${seed}: ${q.clue} → ${q.answer}`);
            checked++;
        }
    }
    assert.ok(checked > 20, `only ${checked} conditional questions verified`);
});

test('Probability two-way: P(cell) = cell / total', () => {
    let checked = 0;
    for (let seed = 1; seed <= 250; seed++) {
        const qs = genStage5({ topic: 'Probability', difficulty: 'Medium', count: 4, seed,
            subOpsFilter: { Probability: ['two-way'] } });
        for (const q of qs) {
            const m = q.clue.match(/(\d+) boys and (\d+) girls play tennis, while (\d+) boys and (\d+) girls do not/);
            if (!m) continue;
            const [bt, gt, bn, gn] = [+m[1], +m[2], +m[3], +m[4]];
            const total = bt + gt + bn + gn;
            let cell;
            if (/boy who plays tennis/.test(q.clue)) cell = bt;
            else if (/girl who plays tennis/.test(q.clue)) cell = gt;
            else if (/boy who does not/.test(q.clue)) cell = bn;
            else cell = bt + gt;
            assert.ok(fracEq(q.answer, cell, total), `seed${seed}: ${q.clue} → ${q.answer}`);
            checked++;
        }
    }
    assert.ok(checked > 20, `only ${checked} two-way questions verified`);
});
