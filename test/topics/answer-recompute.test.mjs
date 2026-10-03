// =============================================================
// test/topics/answer-recompute.test.mjs — independent answer recomputation.
//
// Parses the numbers and the operation out of each generated clue, recomputes
// the result with exact integer arithmetic (fractions) or scaled arithmetic
// (percentages), and compares to the generator's answer — not just structure.
//
//  - Fractions Hard multiply-divide (and Medium multiply, same sub-op key)
//  - Percentages increase-decrease (Easy / Medium / Hard)
//
// Rounding significant figures is already recomputed in rounding.test.mjs.
// =============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { gen } from '../_helpers.mjs';

const SEEDS = 300;

// ---------------- Fractions ----------------------------------
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };

// Parse "$\frac{n}{d}$", "$a\frac{n}{d}$" (mixed) or "$n$" into [num, den].
function parseFractionAnswer(ans) {
    const mixed = ans.match(/\$(\d+)\\frac\{(\d+)\}\{(\d+)\}\$/);
    if (mixed) { const [w, n, d] = mixed.slice(1).map(Number); return [w * d + n, d]; }
    const frac = ans.match(/\$\\frac\{(\d+)\}\{(\d+)\}\$/);
    if (frac) return [Number(frac[1]), Number(frac[2])];
    const whole = ans.match(/^\$?(\d+)\$?$/);
    if (whole) return [Number(whole[1]), 1];
    return null;
}

const DIV_WORDS = /\\div|÷|\bDivide\b|\bquotient\b|\bdivided\b|How many pieces|How many .* fit|cut into/i;
const MUL_WORDS = /\bMultiply\b|\\times|\bproduct\b|\bof them\b|\bWhat fraction\b|\barea\b|\bof the\b/i;

test('Fractions multiply-divide: recomputed result matches (Medium + Hard)', () => {
    let checked = 0, unambiguous = 0;
    for (const diff of ['Medium', 'Hard']) {
        for (let seed = 1; seed <= SEEDS; seed++) {
            const qs = gen({ topic: 'Fractions', difficulty: diff, count: 8, seed,
                subOpsFilter: { Fractions: ['multiply-divide'] } });
            for (const q of qs) {
                const fr = [...q.clue.matchAll(/\\frac\{(\d+)\}\{(\d+)\}/g)].map(m => [Number(m[1]), Number(m[2])]);
                if (fr.length !== 2) continue;
                const [[a, b], [c, d]] = fr;
                const ans = parseFractionAnswer(q.answer);
                const label = `${diff}/seed${seed}: "${q.clue}" → ${q.answer}`;
                assert.ok(ans, `unparseable answer — ${label}`);
                const [an, ad] = ans;

                const mulN = a * c, mulD = b * d;      // (a/b)(c/d)
                const divN = a * d, divD = b * c;      // (a/b) / (c/d)
                // "How many c/d L servings can be poured from a/b L?" puts the divisor first.
                const reversed = /servings can be poured from/.test(q.clue);
                const isMul = an * mulD === mulN * ad;
                const isDiv = reversed ? an * divN === divD * ad : an * divD === divN * ad;
                assert.ok(isMul || isDiv, `answer is neither the product nor the quotient — ${label}`);

                const saysDiv = DIV_WORDS.test(q.clue), saysMul = MUL_WORDS.test(q.clue) && !saysDiv;
                if (saysDiv !== saysMul) {
                    unambiguous++;
                    if (saysDiv) assert.ok(isDiv, `clue says divide but answer is not the quotient — ${label}`);
                    else         assert.ok(isMul, `clue says multiply but answer is not the product — ${label}`);
                }
                // Simplest form.
                assert.equal(gcd(an, ad), 1, `answer not in simplest form — ${label}`);
                // The worked solution must end at the same value.
                const lastFrac = [...q.worked.matchAll(/\\frac\{(\d+)\}\{(\d+)\}/g)].pop();
                assert.ok(lastFrac, `worked has no fraction — ${label}`);
                assert.equal(Number(lastFrac[1]) * ad, an * Number(lastFrac[2]), `worked ends elsewhere — ${label}`);
                checked++;
            }
        }
    }
    assert.ok(checked > 500, `only ${checked} fraction multiply/divide questions verified`);
    assert.ok(unambiguous > checked * 0.8, `operation inferable for only ${unambiguous}/${checked} questions`);
});

test('Fractions multiply-divide: Medium multiplies, Hard divides (reciprocal in working)', () => {
    for (let seed = 1; seed <= 60; seed++) {
        for (const q of gen({ topic: 'Fractions', difficulty: 'Medium', count: 8, seed,
            subOpsFilter: { Fractions: ['multiply-divide'] } })) {
            assert.doesNotMatch(q.worked, /\\times \\frac/, `Medium should not divide: ${q.clue}`);
        }
        for (const q of gen({ topic: 'Fractions', difficulty: 'Hard', count: 8, seed,
            subOpsFilter: { Fractions: ['multiply-divide'] } })) {
            assert.match(q.worked, /\\times \\frac/, `Hard should divide via reciprocal: ${q.clue}`);
        }
    }
});

// ---------------- Percentages --------------------------------
const INC = /increas|mark(?:ed)? up|\brise|\brais|\bgrow|\bgain/i;
const DEC = /decreas|reduc|discount|\bdrop|\bfall|\bcut\b|\blower/i;

// Round to 6 dp to absorb binary float noise in the comparison only.
const r6 = x => Math.round(x * 1e6) / 1e6;

function firstAmount(clue) {
    // "$40$", "$\$40$", "$1200$" — a number inside $…$ with no % sign.
    const m = clue.match(/\$\\?\$?(\d+(?:\.\d+)?)\$/);
    return m ? Number(m[1]) : null;
}

// Pull every (direction, percent) in order of appearance.
function changesIn(clue) {
    const out = [];
    const re = /(increas\w*|decreas\w*|reduc\w*|rais\w*|rise\w*|rises|discount\w*|mark\w*\s+up|marked\s+up)[^$%]*?\$(\d+(?:\.\d+)?)\\%\$/gi;
    for (const m of clue.matchAll(re)) {
        const word = m[1];
        out.push({ dir: DEC.test(word) ? -1 : INC.test(word) ? 1 : 0, pct: Number(m[2]) });
    }
    return out;
}

test('Percentages increase-decrease: recomputed result matches (all difficulties)', () => {
    let checked = 0;
    const kinds = { single: 0, sequential: 0, nested: 0 };
    for (const diff of ['Easy', 'Medium', 'Hard']) {
        for (let seed = 1; seed <= SEEDS; seed++) {
            const qs = gen({ topic: 'Percentages', difficulty: diff, count: 8, seed,
                subOpsFilter: { Percentages: ['increase-decrease'] } });
            for (const q of qs) {
                const label = `${diff}/seed${seed}: "${q.clue}" → ${q.answer} (${q.worked})`;
                const nested = q.clue.match(/(\d+(?:\.\d+)?)\\%\$ of \$(\d+(?:\.\d+)?)\\%\$ of \$(\d+(?:\.\d+)?)\$/);
                let expected;
                if (nested) {
                    expected = Number(nested[3]) * Number(nested[1]) / 100 * Number(nested[2]) / 100;
                    kinds.nested++;
                } else {
                    const start = firstAmount(q.clue);
                    const ch = changesIn(q.clue);
                    if (start === null || ch.length === 0 || ch.some(c => c.dir === 0)) continue;
                    expected = ch.reduce((v, c) => v * (100 + c.dir * c.pct) / 100, start);
                    kinds[ch.length > 1 ? 'sequential' : 'single']++;
                }
                assert.ok(Math.abs(Number(q.answer) - expected) < 1e-6,
                    `wrong answer (expected ${r6(expected)}) — ${label}`);
                // Display value (what is printed on the key) must agree too.
                const disp = Number(String(q.answerDisplay).replace(/[$,]/g, ''));
                assert.ok(Math.abs(disp - expected) < 1e-6, `wrong display (expected ${r6(expected)}) — ${label}`);
                checked++;
            }
        }
    }
    assert.ok(checked > 800, `only ${checked} percentage change questions verified`);
    assert.ok(kinds.single > 0 && kinds.sequential > 0 && kinds.nested > 0, JSON.stringify(kinds));
});

// KNOWN GENERATOR BUG (reported, not fixed here — generators/ is out of scope):
//   gen({topic:'Percentages', difficulty:'Medium', count:8, seed:S,
//        subOpsFilter:{Percentages:['increase-decrease']}}) can yield
//   clue "Increase $100$ by $10\%$", answer "110.00000000000001",
//   worked "$100 \times 1.1 = 110.00000000000001$" — an unrounded float
//   product (100 * 1.1) is printed to students. Un-skip once the generator
//   rounds the product (e.g. toFixed/Math.round to 2 dp).
test.skip('Percentages increase-decrease Medium: answer text has no float artefacts', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
        for (const q of gen({ topic: 'Percentages', difficulty: 'Medium', count: 8, seed,
            subOpsFilter: { Percentages: ['increase-decrease'] } })) {
            assert.doesNotMatch(`${q.answer} ${q.answerDisplay} ${q.worked}`, /\d\.\d{6,}/,
                `float artefact in: ${q.clue} → ${q.answer}`);
        }
    }
});
