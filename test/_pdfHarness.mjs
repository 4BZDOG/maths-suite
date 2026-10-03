// =============================================================
// test/_pdfHarness.mjs — run the real PDF export pipeline DOM-free under Node
// with jsPDF (devDependency, same 2.5.1 build the browser loads from the CDN).
//
// Questions come from a frozen fixture (test/fixtures/pdf-golden-questions.json,
// built by tools/make-pdf-fixtures.mjs) so layout goldens are independent of
// generator wording changes.
// =============================================================
import { readFileSync } from 'node:fs';
import { jsPDF } from 'jspdf';
import { state } from '../core/state.js';
import { createExportDoc, drawExportSync } from '../pdf/pdfExport.js';

const FIXTURES = JSON.parse(readFileSync(new URL('./fixtures/pdf-golden-questions.json', import.meta.url), 'utf8'));
const PRISTINE_SETTINGS = structuredClone(state.settings);

export const FIXTURE_KEYS = Object.keys(FIXTURES);

/**
 * scenario: { fixture, count, paperSize, cols, questionsPerSet, blankPageMode,
 *             opts, pageOrder, showFormulaSheet, scale, showTopic, chips,
 *             outcomesHeader, showDiagrams, sets (override fixture group), settings }
 * Returns { total, pages: [{ q, last, text }], doc } where q is the number of
 * numbered question labels ("12.") drawn on that PDF page and last the highest.
 */
export function runExport(sc = {}) {
    const fx = FIXTURES[sc.fixture || 'core'];
    state.selectedTopics = Object.fromEntries(fx.topics.map(t => [t, true]));
    state.selectedSubOps = {};
    state.stage = fx.stage;
    state.includePath = false;
    state.questionsPerSet = sc.questionsPerSet || 1;
    state.generatedSets = { easy: [], medium: [], hard: [] };
    state.settings = Object.assign(structuredClone(PRISTINE_SETTINGS), {
        paperSize: sc.paperSize || 'a4',
        cols: sc.cols || 2,
        blankPageMode: sc.blankPageMode || 'off',
        showFormulaSheet: !!sc.showFormulaSheet,
        globalFontScale: sc.scale || 1,
        showTopic: !!sc.showTopic,
        psShowOutcomeChips: !!sc.chips,
        psShowOutcomesHeader: !!sc.outcomesHeader,
        showDiagrams: sc.showDiagrams !== false,
        opts: sc.opts || { easy: true, medium: true, hard: true, key: true },
        pageOrder: sc.pageOrder || ['easy', 'medium', 'hard', 'key'],
        showExportId: true,
        ...(sc.settings || {}),
    });

    const doc = createExportDoc(jsPDF, state.settings);
    const pageInfo = {};
    const origText = doc.text.bind(doc);
    doc.text = (t, ...rest) => {
        const n = doc.internal.getCurrentPageInfo().pageNumber;
        const rec = (pageInfo[n] ||= { q: 0, last: 0, text: [] });
        const s = Array.isArray(t) ? t.join(' ') : String(t);
        const m = /^(\d+)\.$/.exec(s);
        if (m) { rec.q++; rec.last = Math.max(rec.last, +m[1]); }
        rec.text.push(s);
        return origText(t, ...rest);
    };

    const count = sc.count || 1;
    const exportBase = sc.seed ?? 1;
    const groups = fx.groups;
    drawExportSync(doc, {
        count, exportBase,
        makeSets: (_cfg, seed) => sc.sets || groups[Math.round((seed - exportBase) / 1_000_000) % groups.length],
    });
    const total = doc.getNumberOfPages();
    const pages = [];
    for (let i = 1; i <= total; i++) pages.push(pageInfo[i] || { q: 0, last: 0, text: [] });
    return { total, pages, doc };
}
