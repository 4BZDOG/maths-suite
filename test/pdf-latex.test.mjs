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
