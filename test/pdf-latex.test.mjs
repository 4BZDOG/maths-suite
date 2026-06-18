// =============================================================
// test/pdf-latex.test.mjs — verify PDF text rendering matches HTML.
//
// 1.  Every LaTeX command used by the generator must have an explicit
//     mapping in pdf/pdfHelpers.js _parseLatex. The catch-all
//     /\\[a-zA-Z]+/g → '' silently deletes anything missing — leaving
//     unanswerable questions in print (see the \square regression).
// 2.  Markdown emphasis markers (* and **) must NOT leak into the final
//     PDF text (the inline drawer consumes them; the latexToText helper
//     strips them).
// =============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMathsQuestions } from '../generators/mathsQuestionGen.js';
import { latexToText } from '../pdf/pdfHelpers.js';

const ALL_TOPICS = [
    'Integers', 'Decimals', 'Rounding', 'Fractions', 'Percentages',
    'Algebra', 'Geometry', 'Statistics', 'Financial Maths',
    'Probability', 'Ratios & Rates', 'Trigonometry', 'Non-linear Relationships',
];
const STAGE5_TOPICS = new Set(['Trigonometry', 'Non-linear Relationships']);

function gen(topic, difficulty, seed) {
    return generateMathsQuestions({
        subTopic: topic, difficulty, count: 8, seed,
        stage: STAGE5_TOPICS.has(topic) ? 'Stage 5' : 'Stage 4',
        includePath: true,
    });
}

test('latexToText: no LaTeX command survives the parser for any generated clue', () => {
    // Scan every topic × difficulty across many seeds. If any \command
    // makes it through latexToText, the catch-all strip is hiding it (the
    // word vanishes in the PDF) — flag it loudly.
    const stripped = new Map();   // command → sample clue
    for (const topic of ALL_TOPICS) {
        for (const diff of ['Easy', 'Medium', 'Hard']) {
            for (let seed = 1; seed <= 80; seed++) {
                const qs = gen(topic, diff, seed);
                for (const q of qs) {
                    for (const field of ['clue', 'worked', 'answer', 'answerDisplay']) {
                        const v = q[field];
                        if (!v) continue;
                        const out = latexToText(String(v));
                        const leftover = out.match(/\\[a-zA-Z]+/g);
                        if (leftover) {
                            for (const cmd of leftover) {
                                if (!stripped.has(cmd)) stripped.set(cmd, `${topic}/${diff}: ${v}`);
                            }
                        }
                    }
                }
            }
        }
    }
    assert.equal(stripped.size, 0,
        `LaTeX commands survived latexToText (would print as raw "\\foo"):\n` +
        [...stripped].map(([cmd, ex]) => `  ${cmd}  e.g. ${ex.slice(0, 100)}`).join('\n'));
});

test('latexToText: known commands map to the expected unicode', () => {
    const cases = [
        // From the regression — every form of \square
        ['$\\square + 7 = 12$',        '□ + 7 = 12'],
        ['$9 - \\square = 4$',         '9 - □ = 4'],
        // Greek + angle (Trig)
        ['$\\theta = 22.6°$',          'θ = 22.6°'],
        // Source "\angle A" has a space delimiting the command name; that space
        // is preserved (and the result reads more naturally that way).
        ['$\\angle A = 60°$',          '∠ A = 60°'],
        // Statistics formula hint
        ['Use $\\overline{x} = \\text{sum} \\div n$.',
                                       'Use x̄ = sum ÷ n.'],
        // Pre-existing mappings — guard against future regressions
        ['$2 \\times 3$',              '2 × 3'],
        ['$6 \\div 2$',                '6 ÷ 2'],
        ['$\\frac{3}{4}$',             '3/4'],
        // \frac / \dfrac whose numerator or denominator carries an exponent
        // (nested braces) must still keep the division bar — a naive [^}]+
        // capture fails to match and silently drops it ("d⁸d⁵").
        ['$\\dfrac{d^{8}}{d^{5}}$',    'd⁸/d⁵'],
        ['$\\frac{p^{9}}{p^{5}}$',     'p⁹/p⁵'],
        ['$\\dfrac{15d^{6}}{3d^{2}}$', '15d⁶/3d²'],
        ['$\\sqrt{16}$',               '√(16)'],
        ['$\\pi r^2$',                 'π r²'],
        ['$x \\approx 3$',             'x ≈ 3'],
    ];
    for (const [input, expected] of cases) {
        const actual = latexToText(input);
        assert.equal(actual, expected,
            `latexToText(${JSON.stringify(input)}) → ${JSON.stringify(actual)} (expected ${JSON.stringify(expected)})`);
    }
});

test('latexToText: a \\frac/\\dfrac never collapses to juxtaposed terms (division bar survives)', () => {
    // Regression: \dfrac{d^{8}}{d^{5}} printed "d⁸d⁵" — the bar vanished, so the
    // question read as a product, not a quotient. Across every generated field,
    // any clue/worked containing a fraction command must keep a "/" after
    // conversion (the inline stand-in for the bar).
    // Force Stage 5 + Path so the gated \dfrac forms (divide / negative index)
    // are actually generated for the indices topics.
    const gen5 = (topic, diff, seed) => generateMathsQuestions({
        subTopic: topic, difficulty: diff, count: 8, seed,
        stage: 'Stage 5', includePath: true,
    });
    const offenders = [];
    for (const topic of ALL_TOPICS.concat(['Indices', 'Algebraic Indices'])) {
        for (const diff of ['Easy', 'Medium', 'Hard']) {
            for (let seed = 1; seed <= 60; seed++) {
                let qs;
                try { qs = gen5(topic, diff, seed); } catch { continue; }
                for (const q of qs) {
                    for (const field of ['clue', 'answerDisplay', 'worked']) {
                        const v = q[field];
                        if (!v || !/\\d?frac\{/.test(String(v))) continue;
                        const out = latexToText(String(v));
                        if (!out.includes('/')) offenders.push(`${topic}/${diff} ${field}: ${v} → ${out}`);
                    }
                }
            }
        }
    }
    assert.equal(offenders.length, 0,
        `fraction bar dropped during conversion:\n  ${offenders.slice(0, 8).join('\n  ')}`);
});

test('latexToText: markdown emphasis markers are stripped (not leaked as raw asterisks)', () => {
    const cases = [
        ['Find the **sum** of 3 and 4',         'Find the sum of 3 and 4'],
        ['Convert $\\frac{19}{8}$ to a *mixed number*.',
                                                'Convert 19/8 to a mixed number.'],
        ['**Calculate** the *sale price*.',     'Calculate the sale price.'],
    ];
    for (const [input, expected] of cases) {
        const actual = latexToText(input);
        assert.equal(actual, expected,
            `${JSON.stringify(input)} → ${JSON.stringify(actual)} (expected ${JSON.stringify(expected)})`);
        assert.ok(!/\*/.test(actual), `emphasis markers leaked: ${actual}`);
    }
});
