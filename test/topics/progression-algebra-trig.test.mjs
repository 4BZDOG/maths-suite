// =============================================================
// test/topics/progression-algebra-trig.test.mjs — Easy / Medium / Hard
// progression for Stage 5 algebra & equations and trigonometry.
//
// Every answer is RECOMPUTED independently from the clue (expansion at
// sample points, substitution back into the equations, coordinate
// construction of triangles, brute-force root finding for trig equations),
// across many seeds, for every difficulty.
// =============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { genStage5, DIFFS } from '../_helpers.mjs';

// ---------- helpers ------------------------------------------------
const spans = (clue) => [...String(clue).matchAll(/\$([^$]+)\$/g)].map(m => m[1]);
const rad = (d) => d * Math.PI / 180;
const deg = (r) => r * 180 / Math.PI;
const close = (a, b, tol) => Math.abs(a - b) <= tol;
function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); return b === 0 ? a : gcd(b, a % b); }

// Evaluate an ASCII algebraic string such as "2x^2 - 3x + 4" or "(2x+3)(y-4)".
function evalAlg(expr, vars = {}) {
    let e = String(expr).replace(/\s/g, '').replace(/\^/g, '**');
    e = e.replace(/(^|[(+\-*/])-(?=[xy\d(])/g, '$1(-1)*');
    e = e.replace(/(\d|[xy)])(?=[xy(])/g, '$1*');
    return new Function('x', 'y', `"use strict"; return (${e});`)(vars.x ?? 0, vars.y ?? 0);
}
// Evaluate TeX / plain exact values: \frac{a}{b}, \sqrt{n}, √n, 2√3, (1+√3)/2 …
function evalExact(str) {
    let e = String(str).trim().replace(/\\sqrt\{(\d+)\}/g, 'Math.sqrt($1)');
    for (let i = 0; i < 4; i++) e = e.replace(/\\d?frac\{([^{}]+)\}\{([^{}]+)\}/g, '(($1)/($2))');
    e = e.replace(/\s/g, '');
    e = e.replace(/(\d)√(\d+)/g, '$1*Math.sqrt($2)').replace(/√(\d+)/g, 'Math.sqrt($1)');
    e = e.replace(/(\d)Math/g, '$1*Math').replace(/\)Math/g, ')*Math');
    return new Function(`"use strict"; return (${e});`)();
}
// Evaluate a TeX trig expression such as "2\sin 30° + \tan 45°" or "\dfrac{\sin 45°}{\cos 30°}".
function evalTrigTex(tex) {
    let e = tex;
    for (let i = 0; i < 4; i++) e = e.replace(/\\d?frac\{([^{}]+)\}\{([^{}]+)\}/g, '(($1)/($2))');
    e = e.replace(/\\(sin|cos|tan)\^2\s*(\d+)°/g, (_, f, a) => `Math.pow(Math.${f}(${rad(+a)}),2)`);
    e = e.replace(/\\(sin|cos|tan)\s*(\d+)°/g, (_, f, a) => `Math.${f}(${rad(+a)})`);
    e = e.replace(/\\times/g, '*').replace(/(\d)\s*Math/g, '$1*Math');
    return new Function(`"use strict"; return (${e});`)();
}

function collect(topic, op, diffs, seeds, count = 6) {
    const out = [];
    for (const diff of diffs) {
        for (let seed = 1; seed <= seeds; seed++) {
            const qs = genStage5({ topic, difficulty: diff, count, seed, subOpsFilter: { [topic]: [op] } });
            for (const q of qs) out.push({ diff, seed, q });
        }
    }
    return out;
}
const tag = ({ diff, seed, q }) => `${diff}/seed${seed}: ${q.clue.replace(/\n/g, ' | ')} → ${q.answer}`;

// ---------- Algebra: factorise by grouping -------------------------
test('Algebra factorise-grouping: factors expand to the expression; difficulty progression', () => {
    const seen = { Easy: 0, Medium: 0, Hard: 0, hardRearr: 0, hardCubic: 0 };
    for (const item of collect('Algebra', 'factorise-grouping', DIFFS, 120)) {
        const { diff, q } = item;
        const expr = spans(q.clue)[0];
        for (const [x, y] of [[2, 3], [-1, 5], [4, -2], [0.5, 7]]) {
            assert.ok(close(evalAlg(expr, { x, y }), evalAlg(q.answer, { x, y }), 1e-9), tag(item));
        }
        assert.ok(!/\+ -|- -/.test(q.clue + q.answerDisplay), `sign wording: ${tag(item)}`);
        const isCubic = /x\^3/.test(expr);
        const m = q.answer.match(/^\((\d*)x([+-]\d+)\)\((\d*)y([+-]\d+)\)$/);
        if (!isCubic) {
            assert.ok(m, `bilinear grouping answer shape: ${tag(item)}`);
            const [a, mm, b, n] = [m[1] === '' ? 1 : +m[1], +m[2], m[3] === '' ? 1 : +m[3], +m[4]];
            // fully factorised: no common factor hiding inside a binomial
            assert.equal(gcd(a, mm), 1, tag(item));
            assert.equal(gcd(b, n), 1, tag(item));
        }
        if (diff === 'Easy') {
            assert.ok(/^\(x\+\d+\)\(y\+\d+\)$/.test(q.answer), `Easy is all positive: ${tag(item)}`);
            assert.ok(!/-/.test(expr), tag(item));
            assert.ok(/^Factorise by grouping/.test(q.clue), tag(item));
        }
        if (diff === 'Medium') {
            assert.ok(/-/.test(q.answer), `Medium needs a negative sign: ${tag(item)}`);
            assert.ok(/^Factorise by grouping/.test(q.clue), tag(item));
        }
        if (diff === 'Hard') {
            if (isCubic) seen.hardCubic++;
            else {
                assert.ok(/^Rearrange and factorise/.test(q.clue), tag(item));
                seen.hardRearr++;
            }
        }
        seen[diff]++;
    }
    for (const k of Object.keys(seen)) assert.ok(seen[k] > 20, `${k}: only ${seen[k]} verified`);
});

// ---------- Algebra: non-monic quadratics --------------------------
test('Algebra factorise-nonmonic: expands back; a = 2 (Easy), ≤ 4 (Medium), ≤ 6 with common factors (Hard)', () => {
    const seen = { Easy: 0, Medium: 0, Hard: 0, hardK: 0, neg: 0 };
    for (const item of collect('Algebra', 'factorise-nonmonic', DIFFS, 150)) {
        const { diff, q } = item;
        const expr = spans(q.clue)[0];
        for (const x of [-3, -1, 0, 2, 5, 0.5]) {
            assert.ok(close(evalAlg(expr, { x }), evalAlg(q.answer, { x }), 1e-9), tag(item));
        }
        const c2 = evalAlg(expr, { x: 1 }) + evalAlg(expr, { x: -1 }) - 2 * evalAlg(expr, { x: 0 });
        const a = c2 / 2;
        const b = (evalAlg(expr, { x: 1 }) - evalAlg(expr, { x: -1 })) / 2;
        const c = evalAlg(expr, { x: 0 });
        const content = gcd(gcd(a, b), c);
        const k = /^\d/.test(q.answer) ? +q.answer.match(/^\d+/)[0] : 1;
        assert.equal(content, k, `common factor mismatch: ${tag(item)}`);
        if (diff === 'Easy') {
            assert.equal(a, 2, tag(item));
            assert.ok(b > 0 && c > 0, `Easy is all positive: ${tag(item)}`);
            assert.equal(k, 1, tag(item));
        }
        if (diff === 'Medium') { assert.ok(a >= 2 && a <= 4 && k === 1, tag(item)); if (b < 0 || c < 0) seen.neg++; }
        if (diff === 'Hard') {
            assert.ok(a >= 2 && a <= 18, tag(item));
            if (k > 1) { seen.hardK++; assert.ok(/^Factorise fully/.test(q.clue), tag(item)); }
            else assert.ok(a <= 6, tag(item));
        }
        seen[diff]++;
    }
    assert.ok(seen.Easy > 20 && seen.Medium > 20 && seen.Hard > 20 && seen.hardK > 10 && seen.neg > 10, JSON.stringify(seen));
});

// ---------- Equations: completing the square -----------------------
test('Equations complete-square: every form is algebraically correct', () => {
    const seen = { easy: 0, mForm: 0, mSolve: 0, hForm: 0, hSurdA: 0, hSurdMonic: 0 };
    for (const item of collect('Equations', 'complete-square', DIFFS, 150)) {
        const { diff, q } = item;
        const sp = spans(q.clue)[0];
        if (/^Complete the square/.test(q.clue)) {
            assert.equal(diff, 'Easy', tag(item));
            const b = evalAlg(sp, { x: 1 }) - evalAlg(sp, { x: 0 }) - 1;
            assert.ok(b % 2 === 0, `even b: ${tag(item)}`);
            for (const x of [-2, 0, 3]) assert.ok(close(evalAlg(sp, { x }), evalAlg(q.answer, { x }), 1e-9), tag(item));
            seen.easy++;
        } else if (/^Write/.test(q.clue)) {
            const monic = /form \$\(x \+ p\)\^2 \+ q\$/.test(q.clue);
            for (const x of [-2, 0, 3, 1.5]) assert.ok(close(evalAlg(sp, { x }), evalAlg(q.answer, { x }), 1e-9), tag(item));
            if (monic) { assert.equal(diff, 'Medium', tag(item)); seen.mForm++; }
            else { assert.equal(diff, 'Hard', tag(item)); assert.ok(/^[2-4]\(x/.test(q.answer), tag(item)); seen.hForm++; }
        } else {
            const lhs = sp.split(' = ')[0];
            let roots;
            if (/^x=/.test(q.answer)) {
                roots = q.answer.slice(2).split(',').map(Number);
                assert.equal(diff, 'Medium', tag(item));
                assert.equal(roots.length, 2);
                seen.mSolve++;
            } else {
                const m = q.answer.match(/^\((-?\d+)±(\d+)√(\d+)\)\/(\d+)$/);
                const m2 = q.answer.match(/^(-?\d+)±(\d+)√(\d+)$/);
                if (m) { roots = [(+m[1] + m[2] * Math.sqrt(+m[3])) / +m[4], (+m[1] - m[2] * Math.sqrt(+m[3])) / +m[4]]; seen.hSurdA++; assert.ok(/^\d/.test(lhs) && +lhs.match(/^\d+/)[0] > 1, tag(item)); }
                else { assert.ok(m2, tag(item)); roots = [+m2[1] + m2[2] * Math.sqrt(+m2[3]), +m2[1] - m2[2] * Math.sqrt(+m2[3])]; seen.hSurdMonic++; }
                assert.equal(diff, 'Hard', tag(item));
            }
            for (const r of roots) assert.ok(close(evalAlg(lhs, { x: r }), 0, 1e-9), `root ${r}: ${tag(item)}`);
        }
    }
    for (const k of Object.keys(seen)) assert.ok(seen[k] > 15, `${k}: only ${seen[k]} verified`);
});

// ---------- Equations: quadratic formula ---------------------------
test('Equations quad-formula: roots, discriminant and rounding are right for every variant', () => {
    const seen = { easy: 0, surd: 0, dp: 0, disc: 0, rearr: 0, none: 0 };
    for (const item of collect('Equations', 'quad-formula', DIFFS, 150)) {
        const { diff, q } = item;
        const sp = spans(q.clue)[0];
        const [L, R = '0'] = sp.split(' = ');
        const f = (x) => evalAlg(L, { x }) - evalAlg(R, { x });
        const c = f(0), a = (f(1) + f(-1)) / 2 - c, b = (f(1) - f(-1)) / 2;
        const disc = b * b - 4 * a * c;
        if (/^-?\d+, (no|one|two) real solutions?$/.test(q.answer)) {
            const [d, words] = q.answer.split(', ');
            assert.equal(+d, disc, tag(item));
            assert.equal(words, disc < 0 ? 'no real solutions' : disc === 0 ? 'one real solution' : 'two real solutions', tag(item));
            assert.equal(diff, 'Hard');
            seen.disc++;
        } else if (q.answer === 'no real solutions') {
            assert.ok(disc < 0, tag(item)); assert.equal(diff, 'Hard'); seen.none++;
        } else if (/^x=/.test(q.answer)) {
            const got = q.answer.slice(2).split(',');
            const exp = [(-b - Math.sqrt(disc)) / (2 * a), (-b + Math.sqrt(disc)) / (2 * a)].sort((x, y) => x - y);
            assert.equal(got.length, 2, tag(item));
            if (/decimal places/.test(q.clue)) {
                got.forEach((g, i) => {
                    assert.ok(/^-?\d+\.\d{2}$/.test(g), `2 d.p. format: ${tag(item)}`);
                    assert.ok(close(+g, exp[i], 0.00501), `${g} vs ${exp[i]}: ${tag(item)}`);
                });
                assert.ok(!Number.isInteger(Math.sqrt(disc)), 'decimal answers need a non-square discriminant');
                if (/^Rearrange/.test(q.clue)) { assert.equal(diff, 'Hard'); assert.ok(/=/.test(sp) && !/= 0$/.test(sp), tag(item)); seen.rearr++; }
                else seen.dp++;
                if (diff === 'Medium') assert.ok(a >= 1 && a <= 3, tag(item));
            } else {
                assert.equal(diff, 'Easy', tag(item));
                assert.equal(a, 1, tag(item));
                got.forEach((g, i) => assert.ok(close(+g, exp[i], 1e-9) && Number.isInteger(+g), tag(item)));
                seen.easy++;
            }
        } else {
            const m = q.answer.match(/^\((-?\d+)±(\d+)√(\d+)\)\/(\d+)$/);
            assert.ok(m, tag(item));
            assert.equal(diff, 'Medium');
            for (const sgn of [1, -1]) {
                const r = (+m[1] + sgn * m[2] * Math.sqrt(+m[3])) / +m[4];
                assert.ok(close(a * r * r + b * r + c, 0, 1e-9), tag(item));
            }
            seen.surd++;
        }
    }
    for (const k of Object.keys(seen)) assert.ok(seen[k] > 15, `${k}: only ${seen[k]} verified`);
});

// ---------- Equations: simultaneous (line and curve) ---------------
function parseCurves(clue) {
    let parab = null, circle = null, line = null;
    for (const sp of spans(clue)) {
        let m;
        if ((m = sp.match(/^x\^2 \+ y\^2 = (\d+)$/))) circle = { R: +m[1] };
        else if ((m = sp.match(/^y = (x\^2.*)$/))) parab = { f: (x) => evalAlg(m[1], { x }) };
        else if ((m = sp.match(/^x = (-?\d+)$/))) line = { vertical: true, k: +m[1] };
        else if ((m = sp.match(/^y = (.+)$/))) {
            const g = (x) => evalAlg(m[1], { x });
            line = { vertical: false, m: g(1) - g(0), c: g(0), horizontal: !/x/.test(m[1]) };
        }
    }
    return { parab, circle, line };
}
test('Equations simultaneous-nonlinear: solutions satisfy both equations and none are missed', () => {
    const seen = { easyX: 0, easyCircle: 0, medPara: 0, medCircle: 0, tangent: 0, none: 0, dp: 0 };
    for (const item of collect('Equations', 'simultaneous-nonlinear', DIFFS, 200)) {
        const { diff, q } = item;
        const { parab, circle, line } = parseCurves(q.clue);
        assert.ok(line && (parab || circle), `parse: ${tag(item)}`);
        // independent expected intersection set
        let exp = [];
        if (parab && !line.vertical) {
            // x² + q' = m x + c  with q' = parab(0)
            const q0 = parab.f(0);
            const A = 1, B = -line.m, C = q0 - line.c;
            const d = B * B - 4 * A * C;
            const xs = d < 0 ? [] : d === 0 ? [-B / 2] : [(-B - Math.sqrt(d)) / 2, (-B + Math.sqrt(d)) / 2];
            exp = xs.map(x => [x, parab.f(x)]);
        } else if (circle) {
            const R2 = circle.R;
            if (line.vertical) {
                const t = R2 - line.k * line.k;
                exp = t < 0 ? [] : t === 0 ? [[line.k, 0]] : [[line.k, -Math.sqrt(t)], [line.k, Math.sqrt(t)]];
            } else if (line.horizontal) {
                const t = R2 - line.c * line.c;
                exp = t < 0 ? [] : t === 0 ? [[0, line.c]] : [[-Math.sqrt(t), line.c], [Math.sqrt(t), line.c]];
            } else {
                const A = 1 + line.m * line.m, B = 2 * line.m * line.c, C = line.c * line.c - R2;
                const d = B * B - 4 * A * C;
                const xs = d < 0 ? [] : d === 0 ? [-B / (2 * A)] : [(-B - Math.sqrt(d)) / (2 * A), (-B + Math.sqrt(d)) / (2 * A)];
                exp = xs.map(x => [x, line.m * x + line.c]);
            }
        }
        exp.sort((p, r) => p[0] - r[0] || p[1] - r[1]);

        if (/^x=/.test(q.answer)) {
            assert.equal(diff, 'Easy'); assert.ok(parab && !circle, tag(item));
            const xs = q.answer.slice(2).split(',').map(Number);
            assert.equal(xs.length, exp.length, tag(item));
            xs.forEach((x, i) => { assert.ok(close(x, exp[i][0], 1e-9) && x > 0, tag(item)); });
            seen.easyX++;
            continue;
        }
        if (q.answer === 'no real solutions') {
            assert.equal(exp.length, 0, tag(item)); assert.equal(diff, 'Hard'); seen.none++; continue;
        }
        const pts = [...q.answer.matchAll(/\((-?[\d.]+),(-?[\d.]+)\)/g)].map(m => [m[1], m[2]]);
        assert.equal(pts.length, exp.length, `point count: ${tag(item)}`);
        const dp = pts.some(p => p.some(v => v.includes('.')));
        pts.forEach((p, i) => {
            if (dp) {
                assert.ok(p.every(v => /^-?\d+\.\d{2}$/.test(v)), `2 d.p.: ${tag(item)}`);
                assert.ok(close(+p[0], exp[i][0], 0.00501) && close(+p[1], exp[i][1], 0.00501), `${p} vs ${exp[i]}: ${tag(item)}`);
            } else {
                assert.ok(close(+p[0], exp[i][0], 1e-9) && close(+p[1], exp[i][1], 1e-9), `${p} vs ${exp[i]}: ${tag(item)}`);
            }
        });
        if (exp.length === 1) { assert.equal(diff, 'Hard'); assert.ok(/exactly one point/.test(q.clue), tag(item)); seen.tangent++; }
        else if (dp) { assert.equal(diff, 'Hard'); seen.dp++; }
        else if (diff === 'Easy') { assert.ok(circle, tag(item)); seen.easyCircle++; }
        else { assert.equal(diff, 'Medium'); if (parab) seen.medPara++; else seen.medCircle++; }
    }
    for (const k of Object.keys(seen)) assert.ok(seen[k] > 10, `${k}: only ${seen[k]} verified`);
});

// ---------- Trigonometry: exact values -----------------------------
test('Trig exact-values: answers equal recomputed values; surds are rationalised', () => {
    const seen = { easy: 0, medium: 0, obtuse: 0, hardExpr: 0, quotient: 0, theta: 0 };
    for (const item of collect('Trigonometry', 'exact-values', DIFFS, 200)) {
        const { diff, q } = item;
        const ans = evalExact(q.answer);
        assert.ok(!/\/.*√/.test(q.answer), `denominator must be rational: ${tag(item)}`);
        assert.ok(!/(^|[^\d])1√/.test(q.answer), `coefficient 1 should be implicit: ${tag(item)}`);
        const th = q.clue.match(/If \$\\(sin|cos|tan)\\theta = (.+?)\$, find/);
        if (th) {
            const target = evalExact(th[2]);
            const ang = +q.answer;
            assert.ok(ang > 0 && ang < 90 && close(Math[th[1]](rad(ang)), target, 1e-9), tag(item));
            assert.equal(diff, 'Hard'); seen.theta++;
            continue;
        }
        const expr = (q.clue.match(/\$(.+?)\$/) || [])[1];
        const exp = evalTrigTex(expr);
        assert.ok(close(ans, exp, 1e-9), `${ans} vs ${exp}: ${tag(item)}`);
        const angles = [...expr.matchAll(/(\d+)°/g)].map(m => +m[1]);
        if (diff === 'Easy') {
            assert.equal(angles.length, 1, tag(item));
            assert.ok([30, 45, 60].includes(angles[0]), tag(item));
            seen.easy++;
        } else if (diff === 'Medium') {
            assert.equal(angles.length, 2, tag(item));
            assert.ok(angles.every(a => [30, 45, 60].includes(a)), tag(item));
            assert.ok(/[+-]/.test(expr), tag(item));
            seen.medium++;
        } else {
            if (angles.length === 1 && angles[0] > 90) seen.obtuse++;
            else if (/dfrac/.test(expr)) { assert.ok(/rationalised/.test(q.clue), tag(item)); seen.quotient++; }
            else seen.hardExpr++;
        }
    }
    for (const k of Object.keys(seen)) assert.ok(seen[k] > 15, `${k}: only ${seen[k]} verified`);
});

// ---------- Trigonometry: equations --------------------------------
test('Trig trig-equations: complete solution sets, correct ranges and progression', () => {
    const seen = { easy: 0, med180: 0, med360: 0, hardExact: 0, hardRearr: 0, hardDec: 0 };
    for (const item of collect('Trigonometry', 'trig-equations', DIFFS, 200)) {
        const { diff, q } = item;
        const sp = spans(q.clue)[0];
        const dm = q.clue.match(/0° \\le \\theta \\le (\d+)°/);
        const domain = +dm[1];
        const em = sp.match(/^(.*?)\\(sin|cos|tan)\\theta = (-?)(.+)$/);
        assert.ok(em, tag(item));
        const coef = em[1] === '' ? 1 : evalExact(em[1]);
        const target = (em[3] ? -1 : 1) * evalExact(em[4]) / coef;
        const fn = Math[em[2]];
        // brute-force every solution on a fine grid
        const roots = [];
        for (let t = 0; t < domain; t += 0.01) {
            const g0 = fn(rad(t)) - target, g1 = fn(rad(t + 0.01)) - target;
            if (em[2] === 'tan' && (Math.abs(g0) > 1e3 || Math.abs(g1) > 1e3)) continue;
            if (g0 === 0 || g0 * g1 < 0) roots.push(t + 0.005);
        }
        const got = q.answer.split(',').map(Number);
        const decimal = /^\d+(\.\d+)?$/.test(em[4]);
        assert.equal(got.length, roots.length, `solution count (${roots.map(r => r.toFixed(2))}): ${tag(item)}`);
        got.forEach((g, i) => {
            assert.ok(g >= 0 && g <= domain, `in range: ${tag(item)}`);
            assert.ok(close(g, roots[i], decimal ? 0.06 : 0.011), `${g} vs ${roots[i]}: ${tag(item)}`);
            assert.ok(close(fn(rad(g)), target, decimal ? (em[2] === 'tan' ? 0.25 : 0.012) : 1e-9), tag(item));
        });
        if (decimal) got.forEach(g => assert.ok(/^\d+(\.\d)?$/.test(String(g)), 'at most 1 d.p.'));
        if (diff === 'Easy') {
            assert.equal(domain, 90); assert.equal(got.length, 1); assert.ok(!em[3]); seen.easy++;
        } else if (diff === 'Medium') {
            assert.ok(domain === 180 || domain === 360, tag(item));
            if (domain === 180) { seen.med180++; if (em[2] === 'sin') assert.equal(got.length, 2, tag(item)); }
            else { assert.ok(!em[3] && got.length === 2, tag(item)); seen.med360++; }
        } else {
            assert.equal(domain, 360); assert.ok(em[3] === '-', `negative ratio: ${tag(item)}`);
            assert.equal(got.length, 2, tag(item));
            if (decimal) seen.hardDec++; else if (em[1] !== '') seen.hardRearr++; else seen.hardExact++;
        }
    }
    for (const k of Object.keys(seen)) assert.ok(seen[k] > 15, `${k}: only ${seen[k]} verified`);
});

// ---------- Trigonometry: sine / cosine rule and area --------------
// Rebuild each triangle by coordinates (independent of the formulas used by
// the generator) and check the stated answer, plus geometric validity.
function parseTriangle(clue) {
    const sides = {}, angles = {};
    for (const m of clue.matchAll(/\$([abc]) = (\d+(?:\.\d+)?)\$ cm/g)) sides[m[1]] = +m[2];
    for (const m of clue.matchAll(/\$(?:\\angle )?([ABC]) = (\d+(?:\.\d+)?)\$°/g)) angles[m[1]] = +m[2];
    return { sides, angles };
}
// Triangle from three sides by coordinates: C at origin, B on the x-axis.
function fromSSS(a, b, c) {
    const x = (a * a + b * b - c * c) / (2 * a), y2 = b * b - x * x;
    assert.ok(y2 > 0, `degenerate triangle ${a},${b},${c}`);
    const A = [x, Math.sqrt(y2)], B = [a, 0], C = [0, 0];
    const ang = (P, Q, R) => { // angle at P between PQ and PR
        const u = [Q[0] - P[0], Q[1] - P[1]], v = [R[0] - P[0], R[1] - P[1]];
        return deg(Math.abs(Math.atan2(u[0] * v[1] - u[1] * v[0], u[0] * v[0] + u[1] * v[1])));
    };
    return { A: ang(A, B, C), B: ang(B, A, C), C: ang(C, A, B), area: Math.abs(A[1] * a) / 2 };
}
// Triangle from two sides and the included angle (at C).
function fromSAS(a, b, Cdeg) {
    const B = [a, 0], A = [b * Math.cos(rad(Cdeg)), b * Math.sin(rad(Cdeg))];
    const c = Math.hypot(A[0] - B[0], A[1] - B[1]);
    return { c, ...fromSSS(a, b, c) };
}
const validTriangle = (s, tol = 1e-6) => s.a + s.b > s.c - tol && s.a + s.c > s.b - tol && s.b + s.c > s.a - tol;

test('Trig sine-rule: answers recomputed; triangles are valid; ambiguous case has two valid triangles', () => {
    const seen = { Easy: 0, Medium: 0, ambiguous: 0, third: 0 };
    for (const item of collect('Trigonometry', 'sine-rule', DIFFS, 200)) {
        const { diff, q } = item;
        const { sides, angles } = parseTriangle(q.clue);
        if (/two possible/.test(q.clue)) {
            const { a, b } = sides, A = angles.A;
            assert.equal(diff, 'Hard'); assert.ok(A < 90 && a < b && b * Math.sin(rad(A)) < a, 'ambiguous configuration');
            const got = q.answer.split(',').map(Number);
            assert.equal(got.length, 2);
            for (const B of got) {
                assert.ok(A + B < 180, `angles must sum below 180: ${tag(item)}`);
                // the side a opposite A and b opposite B must satisfy a/sinA = b/sinB (rounded B)
                assert.ok(close(a / Math.sin(rad(A)), b / Math.sin(rad(B)), 0.05 * b), tag(item));
            }
            assert.ok(close(got[0] + got[1], 180, 0.11), `supplementary: ${tag(item)}`);
            seen.ambiguous++;
        } else if (/find side/i.test(q.clue)) {
            const target = q.clue.match(/find side \$([abc])\$/i)[1];
            const have = Object.keys(angles);
            assert.equal(have.length, 2, tag(item));
            const third = 180 - angles[have[0]] - angles[have[1]];
            assert.ok(third >= 10, `third angle must be positive: ${tag(item)}`);
            const all = { ...angles }; for (const L of 'ABC') if (all[L] === undefined) all[L] = third;
            const known = Object.keys(sides)[0];
            const k = sides[known] / Math.sin(rad(all[known.toUpperCase()]));
            const sd = { a: k * Math.sin(rad(all.A)), b: k * Math.sin(rad(all.B)), c: k * Math.sin(rad(all.C)) };
            assert.ok(validTriangle(sd), tag(item));
            assert.ok(close(+q.answer, sd[target], 0.0501), `${q.answer} vs ${sd[target]}: ${tag(item)}`);
            // cross-check with an independent construction (coordinates from SSS)
            const geo = fromSSS(sd.a, sd.b, sd.c);
            assert.ok(close(geo.A, all.A, 1e-6) && close(geo.B, all.B, 1e-6), tag(item));
            if (diff === 'Easy') { assert.ok(!/\$C\$|\\angle C/.test(q.clue)); seen.Easy++; } else { assert.equal(diff, 'Hard'); seen.third++; }
        } else {
            const tm = q.clue.match(/find \$\\angle ([ABC])\$/);
            assert.ok(tm, tag(item)); assert.equal(diff, 'Medium');
            const { a, b } = sides, A = angles.A;
            assert.ok(b < a, 'the unknown angle lies opposite the shorter side, so it is unique');
            const B = deg(Math.asin(b * Math.sin(rad(A)) / a));
            assert.ok(close(+q.answer, B, 0.0501), `${q.answer} vs ${B}: ${tag(item)}`);
            assert.ok(A + B < 180, tag(item));
            const c = a * Math.sin(rad(180 - A - B)) / Math.sin(rad(A));
            assert.ok(validTriangle({ a, b, c }), tag(item));
            seen.Medium++;
        }
    }
    for (const k of Object.keys(seen)) assert.ok(seen[k] > 20, `${k}: only ${seen[k]} verified`);
});

test('Trig cosine-rule: side and angle answers recomputed by coordinate construction', () => {
    const seen = { Easy: 0, medSide: 0, medLargest: 0, hardAngle: 0, hardTwoStep: 0 };
    for (const item of collect('Trigonometry', 'cosine-rule', DIFFS, 200)) {
        const { diff, q } = item;
        const ans = Number(q.answer);
        const un = q.clue.match(/^A triangle has sides \$(\d+)\$ cm, \$(\d+)\$ cm and \$(\d+)\$ cm/);
        if (un) {
            const s = un.slice(1).map(Number).sort((p, r) => p - r);
            assert.ok(s[0] + s[1] > s[2], `triangle inequality: ${tag(item)}`);
            const g = fromSSS(s[2], s[1], s[0]);      // side a = longest, so the angle at A is the largest
            assert.ok(close(ans, Math.round(g.A), 1e-9), `${ans} vs ${g.A}: ${tag(item)}`);
            assert.equal(diff, 'Medium'); seen.medLargest++;
            continue;
        }
        const { sides, angles } = parseTriangle(q.clue);
        if (/find side \$c\$/.test(q.clue)) {
            const g = fromSAS(sides.a, sides.b, angles.C);
            assert.ok(close(ans, g.c, 0.0501), `${ans} vs ${g.c}: ${tag(item)}`);
            assert.ok(validTriangle({ a: sides.a, b: sides.b, c: g.c }), tag(item));
            if (diff === 'Easy') { assert.ok(angles.C < 90, 'Easy uses an acute included angle'); seen.Easy++; }
            else { assert.equal(diff, 'Medium'); if (angles.C > 90) seen.medSide++; }
        } else if (/by first finding side/.test(q.clue)) {
            const X = q.clue.match(/Find \$\\angle ([AB])\$/)[1];
            const g = fromSAS(sides.a, sides.b, angles.C);
            assert.ok(close(ans, g[X], 0.0501), `${ans} vs ${g[X]}: ${tag(item)}`);
            assert.ok(g[X] < 90 && (X === 'A') === (sides.a < sides.b), 'angle opposite the shorter side');
            assert.equal(diff, 'Hard'); seen.hardTwoStep++;
        } else {
            const X = q.clue.match(/find \$\\angle ([ABC])\$/)[1];
            const { a, b, c } = sides;
            assert.ok(validTriangle({ a, b, c }) && a + b > c && a + c > b && b + c > a, `triangle inequality: ${tag(item)}`);
            const g = fromSSS(a, b, c);
            assert.ok(close(ans, g[X], 0.0501), `${ans} vs ${g[X]}: ${tag(item)}`);
            assert.ok(close(g.A + g.B + g.C, 180, 1e-6), tag(item));
            assert.equal(diff, 'Hard'); seen.hardAngle++;
        }
    }
    for (const k of Object.keys(seen)) assert.ok(seen[k] > 15, `${k}: only ${seen[k]} verified`);
});

test('Trig area-rule: ½ab sin C recomputed; reverse and three-side variants are consistent', () => {
    const seen = { Easy: 0, Medium: 0, obtuse: 0, hardAngle: 0, hardSSS: 0 };
    for (const item of collect('Trigonometry', 'area-rule', DIFFS, 200)) {
        const { diff, q } = item;
        const ans = Number(q.answer);
        const { sides } = parseTriangle(q.clue);
        const inc = q.clue.match(/included angle of \$(\d+)\$°/);
        if (inc) {
            const [a, b] = q.clue.match(/sides \$(\d+)\$ cm and \$(\d+)\$ cm/).slice(1).map(Number);
            const C = +inc[1];
            const g = fromSAS(a, b, C);
            assert.ok(close(ans, g.area, 0.0501), `${ans} vs ${g.area}: ${tag(item)}`);
            if (diff === 'Easy') { assert.ok(C < 90, tag(item)); seen.Easy++; }
            else { seen.Medium += diff === 'Medium' ? 1 : 0; if (C > 90) seen.obtuse++; }
        } else if (/enclose an \*acute\* angle/.test(q.clue)) {
            const area = +q.clue.match(/area of \$([\d.]+)\$ cm²/)[1];
            const [a, b] = q.clue.match(/sides, \$(\d+)\$ cm and \$(\d+)\$ cm/).slice(1).map(Number);
            assert.ok(ans > 0 && ans < 90, tag(item));
            // the angle must reproduce the stated area
            assert.ok(close(0.5 * a * b * Math.sin(rad(ans)), area, 0.1), `${ans}: ${tag(item)}`);
            assert.equal(diff, 'Hard'); seen.hardAngle++;
        } else {
            const { a, b, c } = sides;
            assert.ok(a + b > c && a + c > b && b + c > a, `triangle inequality: ${tag(item)}`);
            // Heron's formula as the independent check
            const s = (a + b + c) / 2;
            const heron = Math.sqrt(s * (s - a) * (s - b) * (s - c));
            assert.ok(close(ans, heron, 0.0501), `${ans} vs Heron ${heron}: ${tag(item)}`);
            assert.equal(diff, 'Hard'); seen.hardSSS++;
        }
    }
    for (const k of Object.keys(seen)) assert.ok(seen[k] > 15, `${k}: only ${seen[k]} verified`);
});

// ---------- Cross-cutting guards -----------------------------------
test('Progression ops always produce questions with the full shape at every difficulty', () => {
    const OPS = [['Algebra', 'factorise-grouping'], ['Algebra', 'factorise-nonmonic'],
        ['Equations', 'complete-square'], ['Equations', 'quad-formula'], ['Equations', 'simultaneous-nonlinear'],
        ['Trigonometry', 'exact-values'], ['Trigonometry', 'trig-equations'], ['Trigonometry', 'sine-rule'],
        ['Trigonometry', 'cosine-rule'], ['Trigonometry', 'area-rule']];
    for (const [topic, op] of OPS) {
        for (const diff of DIFFS) {
            const qs = genStage5({ topic, difficulty: diff, count: 8, seed: 11, subOpsFilter: { [topic]: [op] } });
            assert.ok(qs.length >= 3, `${topic}/${op}/${diff}: only ${qs.length} questions`);
            for (const q of qs) {
                assert.ok(q.clue && q.answer !== undefined && q.answerDisplay, `${topic}/${op}/${diff}: missing field`);
                assert.equal(q.difficulty, diff);
                assert.ok(!/NaN|undefined|Infinity|\+ -|- -/.test(q.clue + q.answer + q.answerDisplay + (q.worked || '')), `${topic}/${op}/${diff}: bad text ${q.clue}`);
            }
        }
    }
});
