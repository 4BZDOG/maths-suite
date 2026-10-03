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

import { SAMPLES } from './diagram-samples.mjs';

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
