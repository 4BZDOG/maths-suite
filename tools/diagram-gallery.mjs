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
    ['rhombus (area)',            { type: 'rhombus', d1: 10, d2: 6, missing: 'area' }],
    ['kite (area)',               { type: 'kite', d1: 8, d2: 12, missing: 'area' }],
    ['sector (area)',             { type: 'sector', r: 6, theta: 120, missing: 'area' }],
    ['sector (arc)',              { type: 'sector', r: 5, theta: 270, missing: 'arc' }],
    ['coord-circle (2,-1,r3)',    { type: 'coord-circle', h: 2, k: -1, r: 3 }],
    ['semicircle (a=4)',          { type: 'semicircle', a: 4 }],
    ['hyperbola (a2,h1,k-2)',     { type: 'hyperbola', a: 2, h: 1, k: -2 }],
    ['solid: prism (V)',          { type: 'solid', kind: 'prism', dims: { l: 8, w: 5, h: 4 }, find: 'V' }],
    ['solid: prism (SA)',         { type: 'solid', kind: 'prism', dims: { l: 12, w: 3, h: 9 }, find: 'SA' }],
    ['solid: prism (find h)',     { type: 'solid', kind: 'prism', dims: { l: 6, w: 5, h: 4 }, find: 'h', given: 'V = 120 cm³' }],
    ['solid: tri-prism (V)',      { type: 'solid', kind: 'tri-prism', dims: { b: 6, ht: 4, L: 10 }, find: 'V' }],
    ['solid: cylinder (V)',       { type: 'solid', kind: 'cylinder', dims: { r: 5, h: 12 }, find: 'V' }],
    ['solid: cylinder (SA)',      { type: 'solid', kind: 'cylinder', dims: { r: 3, h: 8 }, find: 'SA' }],
    ['solid: cone (V)',           { type: 'solid', kind: 'cone', dims: { r: 6, h: 9 }, find: 'V' }],
    ['solid: sphere (V)',         { type: 'solid', kind: 'sphere', dims: { r: 6 }, find: 'V' }],
    ['solid: pyramid (V)',        { type: 'solid', kind: 'pyramid', dims: { s: 6, h: 9 }, find: 'V' }],
    ['table: frequency',          { type: 'table', head: ['Colour', 'Frequency'], rows: [['Red', 7], ['Blue', 12], ['Green', 4], ['Yellow', { q: true }]] }],
    ['table: tally',              { type: 'table', head: ['Pet', 'Tally', 'Frequency'], rows: [['Dog', { tally: 7 }, 7], ['Cat', { tally: 12 }, { q: true }], ['Fish', { tally: 3 }, 3]] }],
    ['table: two-way',            { type: 'table', head: ['', 'Tennis', 'No tennis', 'Total'], rows: [['Boys', 13, 15, 28], ['Girls', 16, 8, 24], ['Total', { q: true }, 23, 52]] }],
    ['venn (2 sets)',             { type: 'venn', labels: ['Coffee', 'Cricket'], total: 100, sets: { a: 45, b: 34 }, regions: { a: '?', ab: 20, b: '?', out: '?' } }],
    ['venn (full)',               { type: 'venn', labels: ['French', 'Art'], total: 60, regions: { a: 14, ab: 9, b: 21, out: 16 } }],
    ['spinner (colours)',         { type: 'spinner', sectors: [{ label: '', color: 'red' }, { label: '', color: 'blue' }, { label: '', color: 'green' }, { label: '', color: 'yellow' }, { label: '', color: 'red' }, { label: '', color: 'blue' }] }],
    ['spinner (numbers)',         { type: 'spinner', sectors: [1, 2, 3, 4, 5, 6, 7, 8].map(n => ({ label: n })) }],
    ['tree (without replacement)', { type: 'tree', first: [{ l: 'R', p: '3/5' }, { l: 'B', p: '2/5' }], second: [[{ l: 'R', p: '2/4' }, { l: 'B', p: '2/4' }], [{ l: 'R', p: '3/4' }, { l: 'B', p: '1/4' }]] }],
    ['stem-and-leaf',             { type: 'stem-leaf', rows: [{ stem: 2, leaves: [1, 7, 8] }, { stem: 3, leaves: [1, 4, 8, 9] }, { stem: 4, leaves: [8, 9, 9] }], key: '2 | 1 = 21' }],
    ['box plot',                  { type: 'box-plot', min: 12, q1: 20, med: 26, q3: 34, max: 47 }],
    ['box plot (outlier)',        { type: 'box-plot', min: 12, q1: 20, med: 26, q3: 34, max: 47, outliers: [71] }],
    ['dot plot',                  { type: 'dot-plot', counts: { 1: 2, 2: 5, 3: 3, 4: 1, 5: 4 }, lo: 0, hi: 6, title: 'Pets per student' }],
    ['scatter + best fit',        { type: 'scatter', pts: [[1, 3], [2, 5], [3, 6], [4, 9], [5, 11], [6, 12]], line: { m: 2, c: 1 }, xTitle: 'Hours studied', yTitle: 'Score' }],
    ['scene: elevation',          { type: 'scene', kind: 'elevation', height: 36, dist: 48, angle: 36.9, missing: 'angle' }],
    ['scene: depression',         { type: 'scene', kind: 'depression', height: 40, dist: 60, angle: 33.7, missing: 'angle' }],
    ['scene: drone',              { type: 'scene', kind: 'drone', height: 30, dist: 40, missing: 'angle' }],
    ['scene: ladder (find h)',    { type: 'scene', kind: 'ladder', height: 8, dist: 3, angle: 70, missing: 'height' }],
    ['scene: wire',               { type: 'scene', kind: 'wire', height: 36, dist: 48, missing: 'angle' }],
    ['scene: ramp (find d)',      { type: 'scene', kind: 'ramp', height: 2, dist: 12, angle: 9.5, missing: 'dist' }],
    ['bearing: single leg (E)',   { type: 'bearing', legs: [{ bearing: 60, dist: 80 }], names: ['Port', 'Ship'], ask: 'east' }],
    ['bearing: single leg (N)',   { type: 'bearing', legs: [{ bearing: 215, dist: 120 }], names: ['Start', 'End'], ask: 'north' }],
    ['bearing: two legs',         { type: 'bearing', legs: [{ bearing: 40, dist: 50 }, { bearing: 130, dist: 70 }], closing: true }],
    ['bearing: back bearing',     { type: 'bearing', legs: [{ bearing: 70 }], names: ['A', 'B'], back: true }],
    ['cuboid diagonal',           { type: 'cuboid-diag', l: 8, w: 6, h: 5 }],
    ['line graph: two lines',     { type: 'line-graph', xMin: -6, xMax: 6, yMin: -6, yMax: 8, lines: [{ m: 2, c: -1 }, { m: -1, c: 5, color: 'm' }], points: [[2, 3, '?']] }],
    ['line graph: read gradient', { type: 'line-graph', xMin: -5, xMax: 8, yMin: -5, yMax: 9, lines: [{ m: 1.5, c: -2 }], points: [[0, -2, 'coords'], [4, 4, 'coords']] }],
    ['similar triangles',         { type: 'similar', small: ['6 cm', '8 cm', ''], big: ['15 cm', '? cm', ''] }],
    ['congruent: SSS',            { type: 'congruent', test: 'SSS' }],
    ['congruent: SAS',            { type: 'congruent', test: 'SAS' }],
    ['congruent: AAS',            { type: 'congruent', test: 'AAS' }],
    ['congruent: RHS',            { type: 'congruent', test: 'RHS' }],
    ['quadrilateral angles',      { type: 'quad-angles', angles: [85, 96, 72, '?'] }],
    ['clocks (duration)',         { type: 'clock', faces: [{ h: 2, m: 35, label: 'Start' }, { h: 4, m: 10, label: 'Finish' }] }],
    ['fraction bar',              { type: 'fraction', kind: 'bar', parts: 8, shaded: 6 }],
    ['fraction pie',              { type: 'fraction', kind: 'pie', parts: 6, shaded: 4 }],
    ['hundred grid',              { type: 'fraction', kind: 'grid', shaded: 37 }],
    ['network (3,3,2,2)',         { type: 'network', degrees: [3, 3, 2, 2], edges: [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3]] }],
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
