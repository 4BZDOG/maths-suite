// =============================================================
// test/pdf-layout.test.mjs — PDF layout regression harness
//
// Drives drawQuestionPage() (the layout engine, ~370 lines, previously the
// largest untested function) under Node jsPDF with fixed seeds and asserts
// golden page counts + overflow. A change to item measurement, column
// placement, or page-break logic shifts these numbers and fails the test.
//
// Fidelity notes:
// - devDependency jspdf is pinned to 2.5.1 — the exact version the browser
//   lazy-loads (pdf/pdfFonts.js) — so text metrics match production.
// - Fixtures avoid emoji so the canvas fallback (DOM-only) is never hit;
//   wmImg is null so drawWatermark is a no-op.
// - cfg comes from core/state.js `state` (drawQuestionPage reads it
//   directly), so each case sets state.settings explicitly.
// =============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { jsPDF } from 'jspdf';
import { state } from '../core/state.js';
import { buildCtx } from '../pdf/pdfHelpers.js';
import { drawQuestionPage } from '../pdf/pdfExport.js';
import { generateMathsQuestions } from '../generators/mathsQuestionGen.js';

const PAPER = {
    a4:     { PAGE_WIDTH: 210,   PAGE_HEIGHT: 297 },
    letter: { PAGE_WIDTH: 215.9, PAGE_HEIGHT: 279.4 },
};
const MARGIN = 12;
const SEED   = 424242;

const TOPICS = ['Integers', 'Fractions', 'Percentages', 'Geometry', 'Statistics'];

function questionsFor(difficulty, count) {
    return generateMathsQuestions({
        subTopics: TOPICS, difficulty, count, seed: SEED,
        stage: 'Stage 4', includePath: false,
    });
}

function runLayout({ paper = 'a4', cols = 2, capPages = 0, showDiagrams = true,
                     chips = false, header = false, showTopic = false,
                     difficulty = 'Medium', count = 30 }) {
    // drawQuestionPage reads cfg from state.settings / state at call time.
    Object.assign(state.settings, {
        cols, showTopic, showDiagrams,
        psShowOutcomeChips: chips, psShowOutcomesHeader: header,
        psCapPages: capPages,
    });
    state.stage = 'Stage 4';

    const dims = { ...PAPER[paper], MARGIN };
    const doc  = new jsPDF({ orientation: 'portrait', unit: 'mm', format: paper });
    const ctx  = buildCtx(doc, 'helvetica', null, 1, dims, { wmOpacity: 0.15 });
    const questions = questionsFor(difficulty, count);
    assert.equal(questions.length, count, 'fixture under-generated');

    const overflow = drawQuestionPage(ctx, questions, MARGIN + 15, 1, 'TEST-0000');
    return { pages: doc.getNumberOfPages(), overflow, placed: count - overflow };
}

// ---- Golden values --------------------------------------------------------
// Pinned from jspdf 2.5.1 metrics at seed 424242. If a deliberate layout
// change shifts them, re-pin AFTER eyeballing an exported PDF — these
// numbers are the only automated guard on pagination behaviour.

test('golden: 30 Medium questions, 2 cols, A4, diagrams on', () => {
    const r = runLayout({});
    assert.deepEqual(r, { pages: 4, overflow: 0, placed: 30 });
});

test('golden: single-column layout uses more pages', () => {
    const r = runLayout({ cols: 1 });
    assert.deepEqual(r, { pages: 7, overflow: 0, placed: 30 });
});

test('golden: 1-page cap overflows the remainder', () => {
    const r = runLayout({ capPages: 1 });
    assert.equal(r.pages, 1, 'cap must hold page count at 1');
    assert.deepEqual(r, { pages: 1, overflow: 22, placed: 8 });
});

test('golden: 2-page cap places more than 1-page cap', () => {
    const one = runLayout({ capPages: 1 });
    const two = runLayout({ capPages: 2 });
    assert.equal(two.pages, 2);
    assert.ok(two.placed > one.placed, 'second page must add questions');
    assert.deepEqual(two, { pages: 2, overflow: 12, placed: 18 });
});

test('golden: meta chips + outcomes header consume space', () => {
    const bare = runLayout({ capPages: 1 });
    const meta = runLayout({ chips: true, header: true, showTopic: true, capPages: 1 });
    assert.ok(meta.placed < bare.placed, 'meta rows must reduce per-page fit');
    assert.deepEqual(meta, { pages: 1, overflow: 24, placed: 6 });
});

test('golden: US Letter (shorter page) at 1-page cap', () => {
    const r = runLayout({ paper: 'letter', capPages: 1 });
    assert.deepEqual(r, { pages: 1, overflow: 22, placed: 8 });
});

test('golden: Hard band (extra working line) never fits more than Medium', () => {
    const med  = runLayout({ capPages: 1, difficulty: 'Medium' });
    const hard = runLayout({ capPages: 1, difficulty: 'Hard' });
    // At this seed the extra 5 mm line doesn't cross a fit threshold, so the
    // counts are equal — the invariant is ≤, the exact value is the golden.
    assert.ok(hard.placed <= med.placed,
        `Hard (${hard.placed}) must not fit more than Medium (${med.placed})`);
    assert.deepEqual(hard, { pages: 1, overflow: 22, placed: 8 });
});

// ---- Invariants (seed-independent) ----------------------------------------

test('invariant: uncapped layout never overflows and never throws', () => {
    for (const seed of [7, 1234, 99999]) {
        for (const difficulty of ['Easy', 'Medium', 'Hard']) {
            const questions = generateMathsQuestions({
                subTopics: TOPICS, difficulty, count: 30, seed,
                stage: 'Stage 4', includePath: false,
            });
            Object.assign(state.settings, {
                cols: 2, showTopic: true, showDiagrams: true,
                psShowOutcomeChips: true, psShowOutcomesHeader: true,
                psCapPages: 0,
            });
            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const ctx = buildCtx(doc, 'helvetica', null, 1, { ...PAPER.a4, MARGIN }, { wmOpacity: 0.15 });
            const overflow = drawQuestionPage(ctx, questions, MARGIN + 15, 1, 'TEST-0000');
            assert.equal(overflow, 0, `seed ${seed} ${difficulty}: uncapped overflow`);
            assert.ok(doc.getNumberOfPages() >= 1 && doc.getNumberOfPages() <= 10,
                `seed ${seed} ${difficulty}: implausible page count ${doc.getNumberOfPages()}`);
        }
    }
});
