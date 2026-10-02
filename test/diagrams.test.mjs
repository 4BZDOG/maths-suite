// =============================================================
// test/diagrams.test.mjs — every diagram the generators emit must render
// cleanly (SVG + PDF adapter) and primitive-based diagrams must stay in-frame.
// =============================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateMathsQuestions, ALL_SUBTOPICS } from '../generators/mathsQuestionGen.js';
import { renderDiagramSVG } from '../renderers/diagramSVG.js';
import { buildPrims, isPrimDiagram } from '../renderers/diagramPrims.js';
import { drawPrimDiagramPDF } from '../pdf/pdfPrims.js';

// Collect every distinct diagram across topics/difficulties/seeds.
function collect() {
    const found = [];
    for (const stage of ['Stage 4', 'Stage 5']) {
        for (const subTopic of ALL_SUBTOPICS) {
            for (const difficulty of ['Easy', 'Medium', 'Hard']) {
                for (const seed of [1, 2, 3, 4, 5, 6]) {
                    let qs;
                    try {
                        qs = generateMathsQuestions({ subTopic, difficulty, count: 12, seed, stage, includePath: true });
                    } catch { continue; }
                    for (const q of qs) if (q.diagram) found.push({ topic: subTopic, q });
                }
            }
        }
    }
    return found;
}
const ALL = collect();

test('generators emit a healthy number of diagrams', () => {
    assert.ok(ALL.length > 200, `only ${ALL.length} diagrams found`);
});

test('every emitted diagram renders a well-formed SVG with no NaN/undefined', () => {
    for (const { topic, q } of ALL) {
        const svg = renderDiagramSVG(q.diagram);
        assert.ok(svg.startsWith('<svg'), `${topic}/${q.diagram.type}: no svg`);
        assert.ok(!/NaN|undefined|Infinity|null/.test(svg), `${topic}/${q.diagram.type}: bad value in SVG ${JSON.stringify(q.diagram)}`);
    }
});

test('primitive diagrams keep every shape and label inside the canvas', () => {
    let checked = 0;
    for (const { q } of ALL) {
        if (!isPrimDiagram(q.diagram)) continue;
        const p = buildPrims(q.diagram);
        assert.ok(p, `no prims for ${JSON.stringify(q.diagram)}`);
        assert.ok(p.w <= 340 && p.h <= 200 && p.w >= 60 && p.h >= 40, `${q.diagram.type}/${q.diagram.kind}: canvas ${p.w}x${p.h} out of range`);
        const inX = (x) => x >= -0.5 && x <= p.w + 0.5, inY = (y) => y >= -0.5 && y <= p.h + 0.5;
        for (const it of p.items) {
            const pts = it.pts || (it.t === 'circle' ? [[it.cx - it.r, it.cy - it.r], [it.cx + it.r, it.cy + it.r]] : []);
            for (const [x, y] of pts) assert.ok(inX(x) && inY(y), `${q.diagram.type}/${q.diagram.kind}: point (${x},${y}) off-canvas`);
            if (it.t === 'text') {
                const wTxt = it.s.length * it.size * 0.55;
                const x0 = it.anchor === 'end' ? it.x - wTxt : it.anchor === 'start' ? it.x : it.x - wTxt / 2;
                assert.ok(x0 >= -0.5 && x0 + wTxt <= p.w + 0.5, `${q.diagram.kind}: label "${it.s}" clipped (x ${x0.toFixed(0)}..${(x0 + wTxt).toFixed(0)} of ${p.w})`);
                assert.ok(inY(it.y) && it.y - it.size >= -0.5, `${q.diagram.kind}: label "${it.s}" vertically clipped`);
            }
        }
        checked++;
    }
    assert.ok(checked > 20, `only ${checked} primitive diagrams checked`);
});

test('PDF adapter draws every primitive diagram without throwing, in ASCII-safe text', () => {
    const calls = [];
    const doc = new Proxy({}, { get: (_t, name) => (...args) => { calls.push([name, args]); } });
    for (const { q } of ALL) {
        if (!isPrimDiagram(q.diagram)) continue;
        calls.length = 0;
        assert.equal(drawPrimDiagramPDF(doc, q.diagram, 10, 10, 80, 30, 1, 'helvetica'), true);
        for (const [name, args] of calls) {
            for (const a of args) if (typeof a === 'number') assert.ok(Number.isFinite(a), `${name} got ${a}`);
            if (name === 'text') assert.ok(!/[πθ≈√⅓⁴⁄₃]/.test(args[0]), `PDF text not WinAnsi-safe: ${args[0]}`);
        }
    }
});
