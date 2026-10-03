// =============================================================
// test/pdf-golden.test.mjs — golden page counts for the PDF layout engine.
//
// Runs the real export pipeline (pdf/pdfExport.js: drawExportSet ->
// drawHeader -> drawQuestionPage / drawKeyPage / formula sheet / duplex
// padding) DOM-free under Node jsPDF, on a frozen question fixture, and
// asserts the total page count plus how many numbered questions land on each
// PDF page. The goldens were recorded from the behaviour *before*
// drawQuestionPage() was decomposed into helpers; any layout change that moves a
// question to another page (or adds/drops a page) fails here.
//
// If you change layout on purpose: run `node --test test/pdf-golden.test.mjs`,
// inspect the diff, and update GOLDEN below. If you change the fixture, rerun
// `node tools/make-pdf-fixtures.mjs` first.
// `q[i]` is the count of numbered question labels on PDF page i + 1 (0 for
// the answer key, formula sheet and blank duplex pages).
// =============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { runExport } from './_pdfHarness.mjs';
import { SCENARIOS } from './_pdfScenarios.mjs';

const GOLDEN = {
    "core a4 2col default": { total: 4, q: [9, 8, 8, 0] },
    "core a4 1col": { total: 4, q: [4, 4, 4, 0] },
    "core letter 2col": { total: 4, q: [7, 8, 6, 0] },
    "core letter 1col": { total: 4, q: [3, 4, 3, 0] },
    "core 2 pages per band": { total: 7, q: [9, 10, 8, 10, 8, 8, 2] },
    "core 2 pages per band 1col": { total: 7, q: [4, 5, 4, 5, 4, 4, 0] },
    "core second seed group": { total: 8, q: [9, 8, 8, 0, 10, 8, 8, 0] },
    "core large font 1.3": { total: 4, q: [6, 6, 6, 0] },
    "core small font 0.8": { total: 7, q: [11, 13, 10, 13, 10, 10, 5] },
    "core no key": { total: 3, q: [9, 8, 8] },
    "core easy+key only": { total: 2, q: [9, 0] },
    "core key first order": { total: 4, q: [2, 8, 8, 9] },
    "core formula sheet": { total: 5, q: [0, 9, 8, 8, 0] },
    "core topic pills + chips": { total: 4, q: [7, 8, 6, 0] },
    "core outcomes header": { total: 7, q: [7, 9, 7, 9, 6, 8, 1] },
    "geom diagrams 2col": { total: 4, q: [5, 5, 5, 0] },
    "geom diagrams 1col": { total: 4, q: [3, 2, 2, 0] },
    "geom diagrams hidden": { total: 4, q: [10, 8, 6, 0] },
    "geom 2 pages letter": { total: 7, q: [5, 6, 5, 4, 5, 4, 0] },
    "geom formula sheet + key": { total: 8, q: [0, 5, 6, 5, 4, 5, 5, 0] },
    "stats dense 2col": { total: 4, q: [7, 5, 5, 2] },
    "stats 2 pages 1col": { total: 7, q: [4, 4, 3, 4, 2, 4, 2] },
    "stage5 2col": { total: 4, q: [6, 6, 6, 4] },
    "stage5 2 pages font 1.15": { total: 7, q: [4, 5, 5, 4, 4, 5, 5] },
    "duplex off 3 copies (5 pages)": { total: 12, q: [9, 8, 8, 0, 10, 8, 8, 0, 9, 8, 8, 0] },
    "duplex odd, even set (4 pages)": { total: 12, q: [9, 8, 8, 0, 10, 8, 8, 0, 9, 8, 8, 0] },
    "duplex odd, odd set (3 pages)": { total: 11, q: [9, 8, 0, 0, 10, 8, 0, 0, 9, 8, 0] },
    "duplex always 3 copies": { total: 14, q: [9, 8, 8, 0, 0, 10, 8, 8, 0, 0, 9, 8, 8, 0] },
    "duplex always single copy": { total: 4, q: [9, 8, 8, 0] },
    "duplex odd with formula sheet": { total: 11, q: [0, 9, 8, 8, 0, 0, 0, 10, 8, 8, 0] },
    "duplex always 2pp letter geom": { total: 15, q: [5, 6, 5, 4, 5, 4, 0, 0, 5, 6, 5, 4, 5, 4, 0] },
};

for (const [name, sc] of Object.entries(SCENARIOS)) {
    test(`pdf golden: ${name}`, () => {
        const want = GOLDEN[name];
        assert.ok(want, `no golden recorded for "${name}"`);
        const r = runExport(sc);
        assert.equal(r.total, want.total, `page count (per-page questions: ${JSON.stringify(r.pages.map(p => p.q))})`);
        assert.deepEqual(r.pages.map(p => p.q), want.q);
    });
}

test('pdf golden: every scenario has a golden and vice versa', () => {
    assert.deepEqual(Object.keys(GOLDEN).sort(), Object.keys(SCENARIOS).sort());
});

test('pdf golden: question numbering is continuous across bands and pages', () => {
    const r = runExport({ fixture: 'core', questionsPerSet: 2 });
    // Last page is the answer key; everything before it is band pages. A clue that is
    // itself a bare number ("18.") can look like a label, so match 1, 2, 3... as a subsequence.
    let want = 1;
    r.pages.slice(0, -1).forEach(p => p.text.forEach(t => { if (t === `${want}.`) want++; }));
    assert.equal(want - 1, 52, 'labels 1..52 appear in order across the six band pages');
});

test('pdf golden: duplex padding never follows the final set', () => {
    const r = runExport({ fixture: 'core', count: 2, blankPageMode: 'always' });
    assert.equal(r.total, 9);                       // 4 + blank + 4
    assert.equal(r.pages[4].text.some(t => /intentionally left blank/.test(t)), true);
    assert.equal(r.pages[8].text.some(t => /intentionally left blank/.test(t)), false);
});

test('pdf golden: papers differ (letter packs fewer questions than A4 at the same scale)', () => {
    const a4 = runExport({ fixture: 'core' }), lt = runExport({ fixture: 'core', paperSize: 'letter' });
    assert.ok(a4.pages[0].q >= lt.pages[0].q);
});
