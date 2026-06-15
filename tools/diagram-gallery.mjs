// tools/diagram-gallery.mjs
// Dev-only visual QA harness for the geometry diagrams. Renders every
// diagram type (across its variants) into a single HTML page on light and
// dark backgrounds so the SVG output can be eyeballed in a browser.
//
//   node tools/diagram-gallery.mjs        # writes tools/diagram-gallery.html
//
// Not part of the build or deploy — purely a reviewing aid.

import { renderDiagramSVG } from '../renderers/diagramSVG.js';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SAMPLES = [
    ['rectangle (area)',          { type: 'rectangle', l: 12, w: 5, missing: 'area' }],
    ['rectangle (perimeter)',     { type: 'rectangle', l: 8, w: 3, missing: 'perimeter' }],
    ['parallelogram (area)',      { type: 'parallelogram', base: 9, height: 4, missing: 'area' }],
    ['trapezium (area)',          { type: 'trapezium', a: 5, b: 11, height: 6, missing: 'area' }],
    ['right-triangle (find c)',   { type: 'right-triangle', a: 6, b: 8, c: 10, missing: 'c' }],
    ['right-triangle (find b)',   { type: 'right-triangle', a: 5, b: 12, c: 13, missing: 'b' }],
    ['triangle-angles',           { type: 'triangle-angles', a1: 55, a2: 65, a3: 60, missing: 'a3' }],
    ['triangle-area',             { type: 'triangle-area', base: 10, height: 6 }],
    ['circle (area)',             { type: 'circle', r: 7, missing: 'area' }],
    ['circle (circumference)',    { type: 'circle', r: 5, missing: 'circumference' }],
    ['right-triangle-trig (opp)', { type: 'right-triangle-trig', opp: 6, adj: 8, hyp: 10, angle: 37, missing: 'opp' }],
    ['right-triangle-trig (ang)', { type: 'right-triangle-trig', opp: 6, adj: 8, hyp: 10, angle: 37, missing: 'angle' }],
    ['parabola (h=1, k=-2)',      { type: 'parabola', h: 1, k: -2, a: 1 }],
    ['parabola (h=6, k=8)',       { type: 'parabola', h: 6, k: 8, a: 1 }],
    ['parabola (h=-5, k=8, a<0)', { type: 'parabola', h: -5, k: 8, a: -3 }],
    ['parabola (h=4, k=-8, a=2)', { type: 'parabola', h: 4, k: -8, a: 2 }],
    ['parallel (co-interior)',    { type: 'parallel-transversal', a: 110, angleType: 'co-interior' }],
    ['parallel (corresponding)',  { type: 'parallel-transversal', a: 70, angleType: 'corresponding' }],
    ['parallel (alternate)',      { type: 'parallel-transversal', a: 65, angleType: 'alternate' }],
    ['straight-line-angles',      { type: 'straight-line-angles', a: 130 }],
    ['vertically-opposite',       { type: 'vertically-opposite', a: 50 }],
    ['number-plane (gradient)',   { type: 'number-plane', pts: [[1, 2], [4, 8]], line: true }],
    ['number-plane (midpoint)',   { type: 'number-plane', pts: [[-6, -4], [4, 8]], line: true, mid: true }],
    ['number-plane (distance)',   { type: 'number-plane', pts: [[-3, -2], [4, 22]], line: true }],
    ['number-plane (axes triangle)', { type: 'number-plane', pts: [[4, 0], [0, 8]], line: true, tri: true }],
];

const card = (label, diagram) => `
    <figure class="cell">
        <div class="diagram">${renderDiagramSVG(diagram)}</div>
        <figcaption>${label}</figcaption>
    </figure>`;

const grid = SAMPLES.map(([l, d]) => card(l, d)).join('');

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Diagram gallery</title>
<style>
  body { font-family: Inter, system-ui, sans-serif; margin: 0; padding: 24px;
         background: #f8fafc; color: #0f172a; }
  h1 { font-size: 18px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 16px; margin-bottom: 40px; }
  .cell { margin: 0; background: var(--bg-panel, #fff); border: 1px solid #e2e8f0;
          border-radius: 10px; padding: 12px; text-align: center; }
  .diagram { display: flex; justify-content: center; align-items: center; min-height: 120px; }
  .geo-diagram-svg { max-width: min(100%, 190px); height: auto; display: block; }
  .geo-diagram-svg polygon, .geo-diagram-svg rect, .geo-diagram-svg path,
  .geo-diagram-svg polyline, .geo-diagram-svg line { stroke-linejoin: round; stroke-linecap: round; }
  .geo-diagram-svg text { paint-order: stroke; stroke: var(--bg-panel, #fff);
          stroke-width: 2.4px; stroke-linejoin: round; }
  figcaption { margin-top: 8px; font-size: 12px; color: #64748b; }
  section.dark { --bg-panel: #1e293b; background: #0f172a; color: #f1f5f9;
          padding: 24px; border-radius: 12px; }
  section.dark .cell { border-color: #334155; color: #f1f5f9; }
  section.dark figcaption { color: #94a3b8; }
</style></head>
<body>
  <h1>Geometry diagrams — light</h1>
  <div class="grid">${grid}</div>
  <section class="dark">
    <h1>Geometry diagrams — dark</h1>
    <div class="grid">${grid}</div>
  </section>
</body></html>`;

const out = join(__dirname, 'diagram-gallery.html');
writeFileSync(out, html);
console.log('Wrote', out, `(${SAMPLES.length} diagrams ×2 themes)`);
