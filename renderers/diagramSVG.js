// renderers/diagramSVG.js
// Generates inline SVG strings for geometry question diagrams.
// Colors adapt to light/dark mode via currentColor where possible.

import { buildPrims, primsToSVG } from './diagramPrims.js';

/**
 * Inline SVG for a diagram. Every diagram type is built from the
 * renderer-neutral primitives in diagramPrims.js — the PDF export draws the
 * very same primitives, so preview and print cannot drift.
 */
export function renderDiagramSVG(diagram) {
    if (!diagram) return '';
    const pr = buildPrims(diagram);
    return pr ? primsToSVG(pr) : '';
}
