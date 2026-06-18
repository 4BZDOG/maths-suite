// =============================================================
// test/topics/algebra-new.test.mjs — verifiers for the 2024 Algebra
// sub-ops: like terms, expand & simplify, factorise (HCF / common
// bracket) and writing expressions from words.
//
// Strategy: an expression and its answer must be ALGEBRAICALLY EQUAL.
// We substitute distinct integer values for every variable into both
// the clue expression and the stated answer and confirm they evaluate
// to the same number — independent of how the generator built them.
// =============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { genStage5, approxEqual } from '../_helpers.mjs';

// Distinct, non-trivial values per variable so x·y ≠ x+y etc.
const VAL = { x: 2, y: 3, a: 5, b: 7, m: 11, n: 13, p: 17, k: 19, t: 23 };

// Evaluate a (LaTeX-ish) algebraic expression with the given variable values.
function evalExpr(src) {
    let e = src.replace(/\$/g, '').trim();
    // \frac{p}{q} → ((p)/(q))
    e = e.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '(($1)/($2))');
    e = e.replace(/\\[a-zA-Z]+|[{}]/g, '');     // drop any other commands/braces
    e = e.replace(/\s+/g, '');
    // Substitute each variable letter with its value in parentheses.
    e = e.replace(/[a-zA-Z]/g, ch => {
        assert.ok(ch in VAL, `unmapped variable "${ch}" in "${src}"`);
        return `(${VAL[ch]})`;
    });
    // Insert implicit multiplication: )( , digit( , )digit
    e = e.replace(/\)\(/g, ')*(').replace(/(\d)\(/g, '$1*(').replace(/\)(\d)/g, ')*$1');
    // Powers: (base)^exp → Math.pow(base, exp)  (avoids JS's `-x**2` restriction)
    e = e.replace(/\(([^()]+)\)\^(\d+)/g, 'Math.pow($1,$2)');
    return Function(`"use strict"; return (${e});`)();
}

// Pull the math expression out of a "Verb:\n$EXPR$" clue.
function clueExpr(clue) {
    const m = clue.match(/\$([^$]+)\$/);
    return m ? m[1] : null;
}

function checkEquivalent(op, { stage = 'Stage 5' } = {}) {
    let checked = 0;
    for (const difficulty of ['Easy', 'Medium', 'Hard']) {
        for (let seed = 1; seed <= 120; seed++) {
            const qs = genStage5({
                topic: 'Algebra', difficulty, count: 6, seed,
                subOpsFilter: { Algebra: [op] },
            });
            for (const q of qs) {
                const lhs = clueExpr(q.clue);
                const rhs = (q.answerDisplay || '').match(/\$([^$]+)\$/)?.[1];
                if (!lhs || !rhs) continue;
                const a = evalExpr(lhs), b = evalExpr(rhs);
                assert.ok(approxEqual(a, b),
                    `${op}/${difficulty}/seed${seed}: "${lhs}" (=${a}) ≠ answer "${rhs}" (=${b})`);
                checked++;
            }
        }
    }
    assert.ok(checked > 40, `${op}: only ${checked} questions verified`);
}

test('Algebra like-terms: simplified answer equals the original sum', () => checkEquivalent('like-terms'));
test('Algebra expand-simplify: expansion equals the bracketed clue', () => checkEquivalent('expand-simplify'));
test('Algebra factorise-hcf: factorised answer multiplies back to the clue', () => checkEquivalent('factorise-hcf'));
test('Algebra factorise-bracket: factorised answer multiplies back to the clue', () => checkEquivalent('factorise-bracket'));

test('Algebra factorise-hcf: the bracket has no remaining common factor (HCF was complete)', () => {
    // Answer looks like "h(...)" or "hx(...)". The numbers inside the bracket
    // must be coprime, otherwise the stated factor was not the *highest* CF.
    const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
    let checked = 0;
    for (const difficulty of ['Easy', 'Medium', 'Hard']) {
        for (let seed = 1; seed <= 150; seed++) {
            for (const q of genStage5({ topic: 'Algebra', difficulty, count: 6, seed, subOpsFilter: { Algebra: ['factorise-hcf'] } })) {
                const inside = (q.answerDisplay || '').match(/\(([^()]+)\)/)?.[1];
                if (!inside) continue;
                // Coefficient of each term — a bare variable term (e.g. "x") is 1.
                const coeffs = inside.split(/\s*[+-]\s*/).filter(Boolean)
                    .map(tok => { const m = tok.match(/^(\d+)/); return m ? Number(m[1]) : 1; });
                const g = coeffs.reduce((acc, x) => gcd(acc, x), 0);
                assert.ok(g === 1 || coeffs.length < 2,
                    `factorise-hcf/${difficulty}/seed${seed}: bracket "${inside}" still shares factor ${g}`);
                checked++;
            }
        }
    }
    assert.ok(checked > 40, `only ${checked} HCF answers checked`);
});

test('Algebra word-expression: phrasing maps to the correct expression', () => {
    // Each entry: a regex anchored to the WHOLE phrase, and the expected answer
    // built from its capture groups. Anchoring stops "product of M and V" from
    // matching inside "N less than the product of M and V".
    const strip = s => (s || '').replace(/\$/g, '').replace(/\s+/g, '');
    const RULES = [
        [/^The sum of \$(\w)\$ and \$(\d+)\$$/,                              (g) => `${g[1]}+${g[2]}`],
        [/^\$(\d+)\$ more than \$(\w)\$$/,                                   (g) => `${g[2]}+${g[1]}`],
        [/^\$(\w)\$ increased by \$(\d+)\$$/,                                (g) => `${g[1]}+${g[2]}`],
        [/^\$(\d+)\$ less than \$(\w)\$$/,                                   (g) => `${g[2]}-${g[1]}`],
        [/^\$(\w)\$ decreased by \$(\d+)\$$/,                                (g) => `${g[1]}-${g[2]}`],
        [/^The product of \$(\d+)\$ and \$(\w)\$$/,                          (g) => `${g[1]}${g[2]}`],
        [/^Twice the number \$(\w)\$$/,                                      (g) => `2${g[1]}`],
        [/^\$(\d+)\$ more than \$(\d+)\$ times \$(\w)\$$/,                   (g) => `${g[2]}${g[3]}+${g[1]}`],
        [/^\$(\d+)\$ less than the product of \$(\d+)\$ and \$(\w)\$$/,      (g) => `${g[2]}${g[3]}-${g[1]}`],
        [/^\$(\d+)\$ times \$(\w)\$, then subtract \$(\d+)\$$/,             (g) => `${g[1]}${g[2]}-${g[3]}`],
        [/^The product of \$(\d+)\$ and \$(\w)\$, increased by \$(\d+)\$$/, (g) => `${g[1]}${g[2]}+${g[3]}`],
        [/^The product of \$(\d+)\$ and the sum of \$(\w)\$ and \$(\d+)\$$/, (g) => `${g[1]}(${g[2]}+${g[3]})`],
        [/^\$(\d+)\$ times the difference of \$(\w)\$ and \$(\d+)\$$/,       (g) => `${g[1]}(${g[2]}-${g[3]})`],
    ];
    let checked = 0;
    for (const difficulty of ['Easy', 'Medium', 'Hard']) {
        for (let seed = 1; seed <= 200; seed++) {
            for (const q of genStage5({ topic: 'Algebra', difficulty, count: 6, seed, subOpsFilter: { Algebra: ['word-expression'] } })) {
                // Phrase = text after "for:" up to the final full stop.
                const phrase = q.clue.replace(/\s+/g, ' ').replace(/^.*?for:\s*/, '').replace(/\.\s*$/, '');
                const ans = strip(q.answerDisplay);
                for (const [re, expect] of RULES) {
                    const g = phrase.match(re);
                    if (!g) continue;
                    assert.equal(ans, expect(g), `"${phrase}" → ${ans} (expected ${expect(g)})`);
                    checked++;
                    break;
                }
            }
        }
    }
    assert.ok(checked > 60, `only ${checked} word-expression phrasings checked`);
});
