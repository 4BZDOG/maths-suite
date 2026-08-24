// =============================================================
// test/pdf-fraction-clue.test.mjs — multi-line fraction clues must stack.
//
// Many generators (Equations, Algebra, Indices…) phrase a fraction-bearing
// clue as "verb\n$\dfrac{t}{9} = 12$" — a bold verb line, then the equation
// on its own line. The single-line fraction path in pdfExport.js
// (hasFraction(clue) && clueLines.length === 1) never matches this shape, so
// it fell through to the plain inline renderer and \dfrac{t}{9} flattened to
// the literal text "t/9" instead of a stacked numerator/bar/denominator —
// exactly the shape KaTeX renders correctly in the HTML preview, so the PDF
// silently diverged from what the student sees on screen.
//
// _drawClueInline now detects a fraction on an equation-only line and
// delegates that line to drawFractionClue (the same stacker the single-line
// path already used and this suite already trusts), so these tests only need
// to confirm the *routing* is correct, not re-prove the stacking math itself.
// =============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { _drawClueInline } from '../pdf/pdfExport.js';
import { generateMathsQuestions } from '../generators/mathsQuestionGen.js';

// Minimal jsPDF stand-in — same shape as test/pdf-superscript.test.mjs's
// mockDoc, extended with the line-drawing calls drawFractionClue needs for
// the fraction bar.
function mockDoc() {
    const calls = [];
    const lines = [];
    let size = 10;
    return {
        calls,
        lines,
        setFont() {},
        setFontSize(s) { size = s; },
        setTextColor() {},
        setDrawColor() {},
        setLineWidth() {},
        getTextWidth(t) { return t.length * size * 0.5; },
        getTextColor() { return '#0f172a'; },
        text(t, x, y) { calls.push({ t, x, y, size }); },
        line(x1, y1, x2, y2) { lines.push({ x1, y1, x2, y2 }); },
    };
}

test('_drawClueInline stacks a fraction on an equation-only line (the "verb\\n$...$" shape)', () => {
    const doc = mockDoc();
    _drawClueInline(doc, 'Solve:\n$\\dfrac{t}{9} = 12$', 15, 20, 180, 11, 'helvetica', [15, 23, 42], 6);

    const drawn = doc.calls.map(c => c.t);
    assert.ok(!drawn.some(t => t.includes('t/9')), `fraction flattened to inline text: ${JSON.stringify(drawn)}`);
    assert.ok(drawn.includes('t'), `numerator "t" not drawn as its own run: ${JSON.stringify(drawn)}`);
    assert.ok(drawn.includes('9'), `denominator "9" not drawn as its own run: ${JSON.stringify(drawn)}`);
    assert.ok(doc.lines.length >= 1, 'expected at least one line stroke for the fraction bar');

    // Numerator sits above the bar, denominator below — never on the same
    // baseline (that would mean it fell back to flattened inline text).
    const numCall = doc.calls.find(c => c.t === 't');
    const denCall = doc.calls.find(c => c.t === '9');
    assert.ok(numCall && denCall, 'both numerator and denominator were drawn');
    assert.ok(numCall.y < denCall.y, `numerator (y=${numCall.y}) should sit above denominator (y=${denCall.y})`);
});

test('_drawClueInline stacks multiple fractions on one equation line', () => {
    const doc = mockDoc();
    _drawClueInline(doc, 'Simplify:\n$\\frac{3x}{4} + \\frac{2x}{5}$', 15, 20, 180, 11, 'helvetica', [15, 23, 42], 6);
    const drawn = doc.calls.map(c => c.t);
    assert.ok(!drawn.some(t => /3x\/4|2x\/5/.test(t)), `a fraction flattened to inline text: ${JSON.stringify(drawn)}`);
    assert.ok(drawn.includes('3x') && drawn.includes('4'), 'first fraction (3x/4) drawn as separate runs');
    assert.ok(drawn.includes('2x') && drawn.includes('5'), 'second fraction (2x/5) drawn as separate runs');
    assert.equal(doc.lines.length, 2, 'expected 2 fraction bars, one per fraction');
});

test('_drawClueInline still stacks the fraction when other text follows it on the same line', () => {
    const doc = mockDoc();
    _drawClueInline(doc, 'Solve:\n$\\dfrac{t}{9} + 5 = 12$', 15, 20, 180, 11, 'helvetica', [15, 23, 42], 6);
    const drawn = doc.calls.map(c => c.t);
    assert.ok(!drawn.some(t => t.includes('t/9')), `fraction flattened to inline text: ${JSON.stringify(drawn)}`);
    assert.ok(drawn.includes('t') && drawn.includes('9'), 'fraction still stacked');
    assert.ok(drawn.some(t => t.includes('+ 5') || t.includes('5')), 'trailing "+ 5 = 12" still drawn');
});

test('_drawClueInline leaves non-fraction multi-line clues drawing exactly as before', () => {
    const doc = mockDoc();
    _drawClueInline(doc, 'Solve:\n$t + 9 = 12$', 15, 20, 180, 11, 'helvetica', [15, 23, 42], 6);
    assert.equal(doc.lines.length, 0, 'no fraction bar expected for a non-fraction equation');
    const drawn = doc.calls.map(c => c.t).join('');
    assert.ok(drawn.includes('9') && drawn.includes('12'), `equation still drawn: ${drawn}`);
});

test('every generated multi-line fraction clue (Equations, Algebra, Indices) stacks instead of flattening', () => {
    const TOPICS = ['Equations', 'Algebra', 'Indices', 'Algebraic Indices'];
    let checked = 0;
    const offenders = [];
    for (const topic of TOPICS) {
        for (const diff of ['Easy', 'Medium', 'Hard']) {
            for (let seed = 1; seed <= 40; seed++) {
                let qs;
                try {
                    qs = generateMathsQuestions({
                        subTopic: topic, difficulty: diff, count: 8, seed,
                        stage: 'Stage 5', includePath: true,
                    });
                } catch { continue; }
                for (const q of qs) {
                    const clue = q.clue || '';
                    // Only the "verb\n$...frac...$" shape this bug affected —
                    // the single-line case is covered by the existing
                    // isFraction + drawFractionClue path (untouched here).
                    if (!clue.includes('\n')) continue;
                    if (!/\\d?frac\{/.test(clue)) continue;

                    const doc = mockDoc();
                    _drawClueInline(doc, clue, 15, 20, 180, 11, 'helvetica', [15, 23, 42], 6);
                    const drawn = doc.calls.map(c => c.t).join('');
                    // A flattened fraction leaves a bare "<token>/<token>" with
                    // no space around the slash (the stacked path never emits
                    // a "/" character at all for a \frac region).
                    if (/\S\/\S/.test(drawn) || doc.lines.length === 0) {
                        offenders.push(`${topic}/${diff}: "${clue.replace(/\n/g, ' | ')}" → "${drawn}"`);
                    }
                    checked++;
                }
            }
        }
    }
    assert.ok(checked > 5, `only ${checked} multi-line fraction clues found across topics — test may not be exercising the bug`);
    assert.equal(offenders.length, 0,
        `fraction(s) flattened instead of stacked:\n  ${offenders.slice(0, 8).join('\n  ')}`);
});
