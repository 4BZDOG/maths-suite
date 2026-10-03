// =============================================================
// test/diagram-parity.test.mjs — SVG preview and PDF must not drift.
//
// Every diagram type is built once (renderers/diagramPrims.js) and drawn by
// both back-ends (renderers/diagramSVG.js, pdf/pdfPrims.js), so they must
// show the same labels, in the same order, with the same number of shapes.
// =============================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderDiagramSVG } from '../renderers/diagramSVG.js';
import { buildPrims, isPrimDiagram, preferredHeightMM } from '../renderers/diagramPrims.js';
import { drawPrimDiagramPDF } from '../pdf/pdfPrims.js';
import { SAMPLES } from '../tools/diagram-samples.mjs';
import { VALID_DIAGRAMS } from './_helpers.mjs';

const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const svgLabels = (svg) => [...svg.matchAll(/<text [^>]*>([^<]*)<\/text>/g)].map(m => decode(m[1]));
function recordingDoc() {
    const calls = [];
    const doc = new Proxy({}, { get: (_t, name) => (...args) => { calls.push([name, args]); } });
    return { doc, calls };
}

test('every diagram type is primitive-built and has a parity sample', () => {
    const covered = new Set(SAMPLES.map(([, d]) => d.type));
    for (const type of VALID_DIAGRAMS) assert.ok(covered.has(type), `no sample for diagram type "${type}"`);
    for (const [name, d] of SAMPLES) assert.ok(isPrimDiagram(d), `${name} is not a primitive diagram`);
    const pdfSrc = readFileSync(new URL('../pdf/pdfExport.js', import.meta.url), 'utf8');
    assert.ok(!/function _draw\w+Diagram\w*PDF|function _draw\w+PDF\(doc, \{/.test(pdfSrc), 'pdfExport.js still has a bespoke diagram drawer');
    const svgSrc = readFileSync(new URL('../renderers/diagramSVG.js', import.meta.url), 'utf8');
    assert.ok(!/<polygon|<polyline/.test(svgSrc), 'diagramSVG.js still hand-writes SVG shapes');
});

test('SVG and PDF show the same labels for every sample diagram', () => {
    for (const [name, d] of SAMPLES) {
        const texts = buildPrims(d).items.filter(i => i.t === 'text');
        const { doc, calls } = recordingDoc();
        drawPrimDiagramPDF(doc, d, 0, 0, 80, 50, 1, 'helvetica');
        // PDF uses the ASCII-safe alternative `p` where one exists.
        assert.deepEqual(calls.filter(c => c[0] === 'text').map(c => c[1][0]), texts.map(i => (i.p != null ? i.p : i.s)), `${name}: PDF labels`);
        assert.deepEqual(svgLabels(renderDiagramSVG(d)), texts.map(i => i.s), `${name}: SVG labels`);
    }
});

test('SVG and PDF draw the same shapes', () => {
    for (const [name, d] of SAMPLES) {
        const prims = buildPrims(d);
        const svg = renderDiagramSVG(d);
        const { doc, calls } = recordingDoc();
        drawPrimDiagramPDF(doc, d, 0, 0, 80, 50, 1, 'helvetica');
        const count = (t) => prims.items.filter(i => i.t === t).length;
        assert.equal((svg.match(/<polygon /g) || []).length, count('poly'), `${name}: SVG polygons`);
        assert.equal((svg.match(/<polyline /g) || []).length, count('path'), `${name}: SVG polylines`);
        assert.equal((svg.match(/<circle /g) || []).length, count('circle'), `${name}: SVG circles`);
        const invisible = (i) => (i.fill == null || i.fill === 'none') && (i.stroke === 'none');
        const wantPdf = prims.items.filter(i => i.t !== 'text' && !invisible(i) && !(i.t === 'path' && i.stroke === 'none')).length;
        assert.equal(calls.filter(c => c[0] === 'lines' || c[0] === 'circle').length, wantPdf, `${name}: PDF shapes`);
    }
});

test('number-plane PDF keeps the preview proportions and a legible scale', () => {
    for (const [name, d] of SAMPLES.filter(([, x]) => x.type === 'number-plane')) {
        const p = buildPrims(d);
        const wMM = 70, hMM = preferredHeightMM(d, wMM, 1, 30);
        const { doc, calls } = recordingDoc();
        drawPrimDiagramPDF(doc, d, 0, 0, wMM, hMM, 1, 'helvetica');
        const k = Math.min(wMM / p.w, hMM / p.h);
        assert.ok(k >= 0.22, `${name}: only ${k.toFixed(2)} mm per px — undersized`);
        const circles = calls.filter(c => c[0] === 'circle').map(c => c[1]);
        const pc = p.items.filter(i => i.t === 'circle');
        assert.equal(circles.length, pc.length);
        if (pc.length >= 2) {
            const rx = (circles[1][0] - circles[0][0]) / (pc[1].cx - pc[0].cx), ry = (circles[1][1] - circles[0][1]) / (pc[1].cy - pc[0].cy);
            if (Number.isFinite(rx) && Number.isFinite(ry)) assert.ok(Math.abs(rx - ry) < 1e-6, `${name}: x and y scale differ (${rx} vs ${ry})`);
        }
    }
});

test('number-plane point labels stay clear of the axis titles on tall, narrow and flat segments', () => {
    const cases = [[[0, 2], [3, 14]], [[-5, -4], [-2, -13]], [[-3, 0], [0, -12]], [[2, 12], [8, 12]], [[-2, 12], [10, 8]], [[5, 1], [9, 9]]];
    for (const pts of cases) {
        const p = buildPrims({ type: 'number-plane', pts, line: true });
        const dots = p.items.filter(i => i.t === 'circle' && i.fill === 'm');
        assert.equal(dots.length, 2, `${JSON.stringify(pts)}: two plotted points`);
        // The widened frame must be roughly square or wider than tall (≥ 0.9) so labels fit inside it.
        const frame = p.items.find(i => i.t === 'poly').pts;
        const w = Math.max(...frame.map(q => q[0])) - Math.min(...frame.map(q => q[0]));
        const h = Math.max(...frame.map(q => q[1])) - Math.min(...frame.map(q => q[1]));
        assert.ok(w / h >= 0.9, `${JSON.stringify(pts)}: window ${w.toFixed(0)}×${h.toFixed(0)} px is too narrow`);
    }
});
