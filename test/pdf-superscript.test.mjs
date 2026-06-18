// =============================================================
// test/pdf-superscript.test.mjs — exponents must survive PDF export.
//
// The embedded fontsource "latin" TTF subset (pdf/pdfFonts.js → latin-*.ttf)
// only carries ¹²³ (Latin-1); the U+2070 block (⁰⁴⁵⁶⁷⁸⁹ⁿ) is absent, so an
// exponent like x⁶ or 5⁰ silently vanished in the PDF answer key. drawSup()
// renders every exponent as a smaller, RAISED ASCII glyph (always present in
// the subset) instead of trusting the superscript codepoints. These tests lock
// that in: no Unicode superscript glyph may reach doc.text(), and the exponent
// digit must be drawn smaller and above the baseline.
// =============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { drawSup, measureSup, hasSuperscript, latexToText } from '../pdf/pdfHelpers.js';
import { generateMathsQuestions } from '../generators/mathsQuestionGen.js';

// Minimal jsPDF stand-in: records every text() call with the active font size.
function mockDoc() {
    const calls = [];
    let size = 10;
    return {
        calls,
        setFontSize(s) { size = s; },
        getTextWidth(t) { return t.length * size * 0.5; },
        text(t, x, y) { calls.push({ t, x, y, size }); },
    };
}

const SUP_GLYPHS = /[⁰¹²³⁴⁵⁶⁷⁸⁹ⁿˣ⁺⁻]/;

test('hasSuperscript detects the U+2070 block and Latin-1 superscripts', () => {
    assert.ok(hasSuperscript('125x⁶'));
    assert.ok(hasSuperscript('5⁰'));
    assert.ok(hasSuperscript('a²'));
    assert.ok(!hasSuperscript('125x'));
    assert.ok(!hasSuperscript(''));
});

test('drawSup never emits a Unicode superscript glyph (would be a missing glyph in the subset)', () => {
    // Every exponent the indices generator can produce: 0 and 4-9 live in the
    // U+2070 block that the latin subset lacks.
    for (const exp of ['0', '4', '5', '6', '7', '8', '9', '11', 'n']) {
        const text = latexToText(`$x^{${exp}}$`);     // e.g. "x⁶"
        const doc = mockDoc();
        drawSup(doc, text, 0, 100, 10);
        for (const c of doc.calls) {
            assert.ok(!SUP_GLYPHS.test(c.t),
                `drawSup drew a superscript glyph "${c.t}" for exponent ${exp} — it will vanish in the PDF`);
        }
        // The bare exponent digits must still be present, just de-superscripted.
        const drawn = doc.calls.map(c => c.t).join('');
        assert.equal(drawn, `x${exp}`, `expected base+exponent "x${exp}", got "${drawn}"`);
    }
});

test('drawSup raises the exponent and shrinks it', () => {
    const doc = mockDoc();
    drawSup(doc, latexToText('$5^{0}$'), 0, 100, 10);   // "5⁰"
    const base = doc.calls.find(c => c.t === '5');
    const exp  = doc.calls.find(c => c.t === '0');
    assert.ok(base && exp, 'both base and exponent drawn');
    assert.equal(base.y, 100, 'base sits on the baseline');
    assert.ok(exp.y < base.y, 'exponent is raised above the baseline');
    assert.ok(exp.size < base.size, 'exponent is drawn smaller than the base');
});

test('measureSup matches the advance drawSup produces and counts the smaller exponent', () => {
    const doc = mockDoc();
    const text = latexToText('$2^{7}$');   // "2⁷"
    const endX = drawSup(doc, text, 0, 100, 10);
    assert.equal(measureSup(doc, text, 10), endX, 'measured width equals drawn advance');
    // "2" at size 10 + "7" at size 7 → 0.5*10 + 0.5*7 = 8.5 (narrower than 10).
    assert.ok(measureSup(doc, text, 10) < doc.getTextWidth('27'),
        'superscript run is measured at the reduced size');
});

test('the "^(?)" missing-index fallback renders as a raised "?" — never a literal caret', () => {
    // "Find the missing index" clues produce $3^{?}$, which has no Unicode
    // superscript glyph and falls back to caret notation "3^(?)". It must still
    // draw as a raised "?" rather than the literal "^(?)".
    const text = latexToText('Find the missing index: $(3^{?})^{2} = 3^{4}$');
    assert.ok(hasSuperscript(text), 'caret fallback is treated as a superscript');
    const doc = mockDoc();
    drawSup(doc, text, 0, 100, 10);
    const drawn = doc.calls.map(c => c.t).join('');
    assert.ok(!drawn.includes('^('), `literal caret leaked into the PDF: "${drawn}"`);
    assert.ok(!/[()]/.test(doc.calls.find(c => c.t.includes('?'))?.t ?? '?'),
        'the "?" is drawn bare, without its caret parentheses');
    const q = doc.calls.find(c => c.t === '?');
    assert.ok(q && q.y < 100 && q.size < 10, 'the "?" is raised and smaller');
});

// The fontsource "latin" subset is also missing every non-Latin-1 math symbol
// (√ π θ ∠ ≈ ≤ ≥ ≠ ∞ → □) and the combining macron, so they vanished in the PDF
// too — an answer of 2√(3) printed as "2(3)". drawSup must remap them to ASCII.
const OUT_OF_SUBSET = /[√π≈≤≥≠∞θαβγ∠→□]/;

test('drawSup remaps out-of-subset math symbols to ASCII (none reach the page)', () => {
    const cases = [
        ['$2\\sqrt{3}$',          '2sqrt(3)'],   // was rendering as "2(3)" — wrong answer!
        ['$\\theta = 12.7$°',     'theta = 12.7°'],
        ['$\\pi \\approx 3.14$',  'pi ~ 3.14'],
        ['$\\angle A = 60$°',     'angle A = 60°'],
        ['$14 - \\square = 5$',   '14 - [ ] = 5'],
        ['7 $\\geq$ 5',           '7 >= 5'],
    ];
    for (const [input, expected] of cases) {
        const doc = mockDoc();
        const text = latexToText(input);
        drawSup(doc, text, 0, 100, 10);
        const drawn = doc.calls.map(c => c.t).join('');
        assert.equal(drawn, expected, `${input} → ${JSON.stringify(drawn)} (expected ${JSON.stringify(expected)})`);
        assert.ok(!OUT_OF_SUBSET.test(drawn), `out-of-subset glyph survived: ${drawn}`);
    }
});

test('no generated field leaves an out-of-subset glyph on the page after drawSup', () => {
    // The decisive guard: across every topic/difficulty/seed, whatever drawSup
    // actually paints must contain only glyphs the embedded font can render
    // (ASCII, Latin-1, or the raised ASCII it emits for superscripts).
    const TOPICS = [
        'Integers', 'Decimals', 'Rounding', 'Fractions', 'Percentages', 'Algebra',
        'Geometry', 'Statistics', 'Financial Maths', 'Probability', 'Ratios & Rates',
        'Trigonometry', 'Non-linear Relationships', 'Indices', 'Algebraic Indices',
    ];
    const offenders = new Set();
    for (const topic of TOPICS) {
        for (const diff of ['Easy', 'Medium', 'Hard']) {
            for (let seed = 1; seed <= 25; seed++) {
                let qs;
                try {
                    qs = generateMathsQuestions({
                        subTopic: topic, difficulty: diff, count: 8, seed,
                        stage: 'Stage 5', includePath: true,
                    });
                } catch { continue; }
                for (const q of qs) {
                    for (const field of ['clue', 'answerDisplay', 'worked', 'unit']) {
                        if (!q[field]) continue;
                        const doc = mockDoc();
                        drawSup(doc, latexToText(String(q[field])), 0, 100, 10);
                        const drawn = doc.calls.map(c => c.t).join('');
                        if (OUT_OF_SUBSET.test(drawn)) offenders.add(`${topic}/${field}: ${drawn.slice(0, 60)}`);
                    }
                }
            }
        }
    }
    assert.equal(offenders.size, 0,
        `glyphs that the PDF font subset cannot render reached the page:\n  ${[...offenders].slice(0, 8).join('\n  ')}`);
});

test('drawSup leaves plain (exponent-free) text untouched', () => {
    const doc = mockDoc();
    const endX = drawSup(doc, '125x', 0, 100, 10);
    assert.equal(doc.calls.length, 1);
    assert.deepEqual({ t: doc.calls[0].t, y: doc.calls[0].y }, { t: '125x', y: 100 });
    assert.equal(endX, doc.getTextWidth('125x'));
});
