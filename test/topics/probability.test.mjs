// =============================================================
// test/topics/probability.test.mjs — Probability verifiers.
//
// Theoretical: count favourable / total → matches simplified fraction.
// Complementary: P(not A) = 1 − P(A), i.e. (d − n)/d.
// =============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { gen, DIFFS } from '../_helpers.mjs';

function gcd(a, b) { return b === 0 ? a : gcd(b, a % b); }
function simplified(n, d) {
    const g = gcd(n, d);
    return [n / g, d / g];
}
function parseFracAnswer(s) {
    // Either "n/d" or "$\frac{n}{d}$" or plain integer
    if (/^\d+$/.test(String(s))) return [Number(s), 1];
    const m = String(s).match(/\\frac\{(\d+)\}\{(\d+)\}/);
    if (m) return [Number(m[1]), Number(m[2])];
    return null;
}

test('Probability theoretical (bag of marbles): answer = favourable/total simplified', () => {
    let checked = 0;
    for (const diff of DIFFS) {
        for (let seed = 1; seed <= 200; seed++) {
            const qs = gen({
                topic: 'Probability', difficulty: diff, count: 8, seed,
                subOpsFilter: { Probability: ['theoretical'] },
            });
            for (const q of qs) {
                // "A bag contains $f$ <colour> and $o$ <colour> marbles. Find P(<colour>)."
                const m = q.clue.match(/\$(\d+)\$\s+(\w+).*?\$(\d+)\$\s+\w+\s+marbles.*?P\((\w+)\)/i);
                if (!m) continue;
                const fav = +m[1], colour = m[2], other = +m[3], target = m[4];
                if (colour.toLowerCase() !== target.toLowerCase()) continue;
                const total = fav + other;
                const [en, ed] = simplified(fav, total);
                const parsed = parseFracAnswer(q.answer);
                assert.ok(parsed, `unparseable probability answer "${q.answer}"`);
                const [an, ad] = parsed;
                assert.equal(`${an}/${ad}`, `${en}/${ed}`,
                    `${diff}/seed${seed}: P(${colour}) ${fav}/${total} → answer ${an}/${ad} (expected ${en}/${ed})`);
                checked++;
            }
        }
    }
    assert.ok(checked > 10, `only ${checked} theoretical-probability questions verified`);
});

test('Probability complementary: P(not E) = 1 − P(E)', () => {
    let checked = 0;
    for (const diff of DIFFS) {
        for (let seed = 1; seed <= 200; seed++) {
            const qs = gen({
                topic: 'Probability', difficulty: diff, count: 8, seed,
                subOpsFilter: { Probability: ['complementary'] },
            });
            for (const q of qs) {
                const m = q.clue.match(/\\frac\{(\d+)\}\{(\d+)\}/);
                if (!m) continue;
                const n = +m[1], d = +m[2];
                const [en, ed] = simplified(d - n, d);
                const parsed = parseFracAnswer(q.answer);
                assert.ok(parsed, `unparseable complementary answer "${q.answer}"`);
                const [an, ad] = parsed;
                assert.equal(`${an}/${ad}`, `${en}/${ed}`,
                    `${diff}/seed${seed}: complement of ${n}/${d} → ${an}/${ad} (expected ${en}/${ed})`);
                checked++;
            }
        }
    }
    assert.ok(checked > 30, `only ${checked} complementary-probability questions verified`);
});
