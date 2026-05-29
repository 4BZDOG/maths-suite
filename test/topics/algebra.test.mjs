// =============================================================
// test/topics/algebra.test.mjs — Algebra verifiers.
//
// For solve questions, substitute the stated answer back into the
// equation extracted from the clue and confirm both sides agree.
// For substitution questions, recompute the evaluated expression
// from the clue and confirm the answer matches.
// =============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { gen, DIFFS, evalPlainExpr, approxEqual } from '../_helpers.mjs';

// Replace any single-letter variable with its substituted value.
// Handles implicit coefficients like "3x" → "3*x" before substitution.
function substituteVar(expr, varName, value) {
    return expr
        .replace(/\\dfrac/g, '\\frac')
        // \frac{var}{n} → (value)/n
        .replace(new RegExp(`\\\\frac\\{${varName}\\}\\{(\\d+)\\}`, 'g'), `(${value})/$1`)
        // coefficient before var: "3x" → "3*(value)"
        .replace(new RegExp(`(\\d)${varName}`, 'g'), `$1*(${value})`)
        // bare var
        .replace(new RegExp(`\\b${varName}\\b`, 'g'), `(${value})`);
}

test('Algebra solve: substituting the stated answer satisfies the equation', () => {
    let checked = 0;
    for (const diff of DIFFS) {
        for (let seed = 1; seed <= 200; seed++) {
            const qs = gen({ topic: 'Algebra', difficulty: diff, count: 8, seed });
            for (const q of qs) {
                // Only the "solve" family: answerDisplay is "$v = n$" and the clue
                // contains a `var op number = number` form (no \frac on var^2 etc).
                const adm = /\$(\w+)\s*=\s*(-?\d+(?:\.\d+)?)\$/.exec(q.answerDisplay || '');
                if (!adm) continue;
                const [, v, valStr] = adm;
                const value = Number(valStr);
                // Find the clue's equation: must contain '=' and the variable.
                const eqm = q.clue.match(/\$([^$]*=[^$]*)\$/);
                if (!eqm) continue;
                const raw = eqm[1];
                if (!new RegExp(`\\b${v}\\b|\\d${v}\\b|\\\\frac\\{${v}\\}`).test(raw)) continue;
                const [lhs, rhs] = raw.split('=');
                const L = evalPlainExpr(substituteVar(lhs, v, value));
                const R = evalPlainExpr(substituteVar(rhs, v, value));
                if (L === null || R === null) continue;     // skip shapes we don't model
                assert.ok(approxEqual(L, R),
                    `${diff}/seed${seed}: ${v}=${value} fails "${raw}" (LHS ${L} vs RHS ${R})`);
                checked++;
            }
        }
    }
    assert.ok(checked > 30, `only ${checked} solve equations exercised`);
});

test('Algebra substitution: re-evaluating the expression matches the answer', () => {
    let checked = 0;
    for (const diff of DIFFS) {
        for (let seed = 1; seed <= 250; seed++) {
            const qs = gen({
                topic: 'Algebra', difficulty: diff, count: 8, seed,
                subOpsFilter: { Algebra: ['substitution'] },
            });
            for (const q of qs) {
                // Clue contains "F = <expr>" and a separate "<var> = n" assignment.
                // Look for two equations.
                const eqs = [...q.clue.matchAll(/\$([^$]+=[^$]+)\$/g)].map(m => m[1]);
                if (eqs.length < 1) continue;
                // Find any "<var> = number" assignment in either inline math or text.
                const assigns = {};
                const assignRe = /(\b[A-Za-z]\b)\s*=\s*(-?\d+(?:\.\d+)?)/g;
                let am;
                while ((am = assignRe.exec(q.clue)) !== null) {
                    assigns[am[1]] = Number(am[2]);
                }
                // Find an "F = <expr in vars>" equation where F is one of the assigns or a single capital.
                let target = null, exprRhs = null;
                for (const e of eqs) {
                    const [lhs, rhs] = e.split('=');
                    const lhsClean = lhs.trim();
                    if (/^[A-Za-z]$/.test(lhsClean)) {
                        target = lhsClean;
                        exprRhs = rhs;
                        break;
                    }
                }
                if (!target || !exprRhs) continue;
                // Substitute every assigned variable in exprRhs.
                let sub = exprRhs;
                for (const [v, n] of Object.entries(assigns)) {
                    if (v === target) continue;
                    sub = substituteVar(sub, v, n);
                }
                const computed = evalPlainExpr(sub);
                if (computed === null) continue;
                assert.ok(approxEqual(computed, Number(q.answer)),
                    `${diff}/seed${seed}: "${q.clue}" → computed ${computed}, answer ${q.answer}`);
                checked++;
            }
        }
    }
    assert.ok(checked > 20, `only ${checked} substitution questions exercised`);
});
