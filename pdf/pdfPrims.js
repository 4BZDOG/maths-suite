// pdf/pdfPrims.js
// jsPDF adapter for the renderer-neutral diagram primitives in
// renderers/diagramPrims.js — draws exactly what the on-screen SVG shows.
import { buildPrims } from '../renderers/diagramPrims.js';

const RGB = {
    g: [16, 185, 129],
    m: [239, 68, 68],
    l: [80, 96, 116],
    f: [205, 210, 220],
};
const FILL = {
    tint:  [236, 240, 244],
    gtint: [209, 250, 229],
    mtint: [254, 226, 226],
    white: [255, 255, 255],
    g:     RGB.g,
    m:     RGB.m,
};
const PT_PER_MM = 2.835;

/**
 * Draw a primitive-based diagram into the box (x0,y0,w,h) in mm, scaled to fit
 * and centred. Returns false when the diagram type has no primitive builder.
 */
export function drawPrimDiagramPDF(doc, diagram, x0, y0, w, h, ps, font) {
    const prims = buildPrims(diagram);
    if (!prims) return false;
    const k = Math.min(w / prims.w, h / prims.h);
    const ox = x0 + (w - prims.w * k) / 2, oy = y0 + (h - prims.h * k) / 2;
    const X = (x) => ox + x * k, Y = (y) => oy + y * k;
    const lw = (sw) => Math.min(0.7, Math.max(0.2, sw * k * 1.5));
    const setStroke = (it) => {
        const col = RGB[it.stroke];
        if (!col) return false;
        // PDF has no stroke opacity here, so fade by blending towards white.
        const a = it.op != null ? it.op : (it.stroke === 'l' ? 0.6 : 1);
        doc.setDrawColor(...col.map(c => Math.round(255 - (255 - c) * a)));
        doc.setLineWidth(lw(it.sw ?? 1.5));
        doc.setLineDashPattern(it.dash ? [1.1, 0.9] : [], 0);
        return true;
    };
    const rel = (pts) => pts.slice(1).map((p, i) => [(p[0] - pts[i][0]) * k, (p[1] - pts[i][1]) * k]);

    for (const it of prims.items) {
        if (it.t === 'poly') {
            const fill = FILL[it.fill];
            const stroked = setStroke(it);
            if (fill) doc.setFillColor(...fill);
            const style = fill && stroked ? 'FD' : fill ? 'F' : stroked ? 'S' : null;
            if (style) doc.lines(rel(it.pts), X(it.pts[0][0]), Y(it.pts[0][1]), [1, 1], style, true);
        } else if (it.t === 'path') {
            if (!setStroke(it)) continue;
            doc.lines(rel(it.pts), X(it.pts[0][0]), Y(it.pts[0][1]), [1, 1], 'S', false);
        } else if (it.t === 'circle') {
            const fill = FILL[it.fill];
            const stroked = setStroke(it);
            if (fill) doc.setFillColor(...fill);
            const style = fill && stroked ? 'FD' : fill ? 'F' : stroked ? 'S' : null;
            if (style) doc.circle(X(it.cx), Y(it.cy), it.r * k, style);
        } else if (it.t === 'text') {
            doc.setLineDashPattern([], 0);
            doc.setFont(font, it.bold || it.color === 'm' ? 'bold' : 'normal');
            doc.setFontSize(Math.max(5.5, it.size * k * PT_PER_MM));
            const col = RGB[it.color] || RGB.l;
            const a = it.op != null ? it.op : 1;
            doc.setTextColor(...col.map(c => Math.round(255 - (255 - c) * a)));
            doc.text(it.p != null ? it.p : it.s, X(it.x), Y(it.y), { align: it.anchor === 'end' ? 'right' : it.anchor === 'start' ? 'left' : 'center' });
        }
    }
    doc.setLineDashPattern([], 0);
    return true;
}
