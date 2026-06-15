// =============================================================
// pdf/pdfExport.js — PDF export orchestrator (Maths Question Sets Edition)
// =============================================================
import { state, syncSettingsFromDOM } from '../core/state.js';
import { showToast } from '../ui/toast.js';
import { generateMathsQuestions } from '../generators/mathsQuestionGen.js';
import { loadJSPDF, loadFontForPDF, FONT_SELECT_MAP } from './pdfFonts.js';
import { buildCtx, drawHeader, drawExportIdFooter, makeExportId, latexToText, hasFraction, drawFractionClue, drawText, setLatexAsciiFallback } from './pdfHelpers.js';
import { detectVerb, detectMidVerb, autoBoldVerb } from '../renderers/htmlUtils.js';
// PAYMENTS: import access helpers — replace session.js backend stub when server is ready
import { clampBulkExportCount, FREE_LIMITS } from '../payments/access.js';
import { getOutcomesForTopics, getTopicOutcomeCodes } from '../core/outcomes.js';
import { drawFormulaSheet } from './pdfDrawFormulas.js';

let isExporting = false;

// ─── PDF Diagram Drawing ──────────────────────────────────────────────────────
// Draws geometry diagrams using jsPDF primitives.
// Returns the height (mm) consumed so callers can advance their Y position.

const _GC  = [16, 185, 129];   // emerald green
const _GCF = [209, 250, 229];  // light green fill
const _LC  = [80, 96, 116];    // slate label
const _MC  = [239, 68, 68];    // red missing value
// Uniform geometry weights so every shape feels part of the same set.
const _STROKE_W   = 0.6;       // mm — primary shape outline
const _AUX_W      = 0.4;       // mm — dashed/auxiliary lines (height, radius)
const _LBL_OFFSET = 3;         // mm — clearance between labels and shape edges

function _triLines(doc, pts, style) {
    // Draw a closed triangle given 3 {x,y} vertices using jsPDF triangle()
    const [A, B, C] = pts;
    doc.triangle(A.x, A.y, B.x, B.y, C.x, C.y, style);
}

function _rightAnglePDF(doc, vx, vy, sq) {
    // Small L-shaped right-angle marker at vertex (vx,vy); sq = side length mm
    // Two doc.line() calls are reliable in all jsPDF versions
    doc.setDrawColor(..._GC);
    doc.line(vx + sq, vy, vx + sq, vy - sq);   // vertical right side
    doc.line(vx, vy - sq, vx + sq, vy - sq);   // horizontal top
}

function _drawRectDiagramPDF(doc, { l, w: wv, missing }, x0, y0, w, h, ps, font) {
    const aspect = l / wv;
    const maxW = w * 0.72, maxH = h * 0.60;
    let dw = aspect >= maxW / maxH ? maxW : maxH * aspect;
    let dh = aspect >= maxW / maxH ? maxW / aspect : maxH;
    dw = Math.max(12, Math.min(maxW, dw));
    dh = Math.max(8,  Math.min(maxH, dh));

    const rx = x0 + (w - dw) / 2;
    const ry = y0 + (h - dh) / 2 - 2 * ps;

    doc.setFillColor(..._GCF);
    doc.setDrawColor(..._GC);
    doc.setLineWidth(_STROKE_W);
    doc.rect(rx, ry, dw, dh, 'FD');

    // Length label (below, centred) — clear of bottom edge
    doc.setFont(font, 'normal');
    doc.setFontSize(8 * ps);
    doc.setTextColor(..._LC);
    doc.text(`l = ${l}`, rx + dw / 2, ry + dh + _LBL_OFFSET + 1.5 * ps, { align: 'center' });

    // Width label (left of the rectangle) — clear of left edge
    doc.text(`w = ${wv}`, rx - _LBL_OFFSET, ry + dh / 2 + 1.2 * ps, { align: 'right' });

    // Missing value label in centre
    const centreLabel = missing === 'area' ? 'A = ?' : 'P = ?';
    doc.setFont(font, 'bold');
    doc.setFontSize(9 * ps);
    doc.setTextColor(..._MC);
    doc.text(centreLabel, rx + dw / 2, ry + dh / 2 + 1.8 * ps, { align: 'center' });
}

function _drawRightTriDiagramPDF(doc, { a, b, c, missing }, x0, y0, w, h, ps, font) {
    const maxW = w * 0.65, maxH = h * 0.68;
    const sc  = Math.min(maxW / a, maxH / b);
    const aPx = Math.max(10, Math.min(maxW, a * sc));
    const bPx = Math.max(8,  Math.min(maxH, b * sc));

    const Ax = x0 + (w - aPx) / 2 - 2 * ps;
    const Ay = y0 + h - 5 * ps;
    const A = { x: Ax, y: Ay };
    const B = { x: Ax + aPx, y: Ay };
    const C = { x: Ax, y: Ay - bPx };

    doc.setFillColor(..._GCF);
    doc.setDrawColor(..._GC);
    doc.setLineWidth(_STROKE_W);
    _triLines(doc, [A, B, C], 'FD');

    const sq = 2.5 * ps;
    doc.setLineWidth(_AUX_W);
    _rightAnglePDF(doc, Ax, Ay, sq);

    const aLabel = missing === 'a' ? 'a = ?' : `a = ${a}`;
    const bLabel = missing === 'b' ? 'b = ?' : `b = ${b}`;
    const cLabel = missing === 'c' ? 'c = ?' : `c = ${c}`;

    // Leg a (below) — clear of bottom edge
    doc.setFont(font, missing === 'a' ? 'bold' : 'normal');
    doc.setFontSize(8 * ps);
    doc.setTextColor(...(missing === 'a' ? _MC : _LC));
    doc.text(aLabel, (Ax + Ax + aPx) / 2, Ay + _LBL_OFFSET + 1.5 * ps, { align: 'center' });

    // Leg b (left of the triangle) — clear of left edge
    doc.setFont(font, missing === 'b' ? 'bold' : 'normal');
    doc.setTextColor(...(missing === 'b' ? _MC : _LC));
    doc.text(bLabel, Ax - _LBL_OFFSET, (Ay + Ay - bPx) / 2 + 1.2 * ps, { align: 'right' });

    // Hypotenuse label at midpoint, offset outward (3 mm clearance)
    const dx = B.x - C.x, dy = B.y - C.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const nx = dy / len, ny = -dx / len;
    const hmx = (B.x + C.x) / 2 + nx * (_LBL_OFFSET + 2.5);
    const hmy = (B.y + C.y) / 2 + ny * (_LBL_OFFSET + 2.5) + 1.2 * ps;
    doc.setFont(font, missing === 'c' ? 'bold' : 'normal');
    doc.setFontSize(7.5 * ps);
    doc.setTextColor(...(missing === 'c' ? _MC : _LC));
    doc.text(cLabel, hmx, hmy, { align: 'center' });
}

function _drawTriAnglesDiagramPDF(doc, { a1, a2, a3, missing }, x0, y0, w, h, ps, font) {
    const triW = w * 0.72;
    const triH = h * 0.64;
    const cx = x0 + w / 2;
    const by = y0 + h - 5 * ps;

    const A = { x: cx - triW / 2, y: by };
    const B = { x: cx + triW / 2, y: by };
    const C = { x: cx, y: by - triH };

    doc.setFillColor(..._GCF);
    doc.setDrawColor(..._GC);
    doc.setLineWidth(_STROKE_W);
    _triLines(doc, [A, B, C], 'FD');

    const a3Label = missing === 'a3' ? '?' : `${a3}\u00B0`;

    doc.setFontSize(8 * ps);

    // Base-vertex angle labels \u2014 pulled in from the corners and lifted up
    // a touch so they sit clearly inside the triangle, not on its hypotenuses.
    doc.setFont(font, 'normal');
    doc.setTextColor(..._LC);
    doc.text(`${a1}\u00B0`, A.x + _LBL_OFFSET + 1.5 * ps, A.y - _LBL_OFFSET, { align: 'left' });
    doc.text(`${a2}\u00B0`, B.x - _LBL_OFFSET - 1.5 * ps, B.y - _LBL_OFFSET, { align: 'right' });

    // Apex-angle label \u2014 placed below the apex with full clearance
    doc.setFont(font, missing === 'a3' ? 'bold' : 'normal');
    doc.setTextColor(...(missing === 'a3' ? _MC : _LC));
    doc.text(a3Label, C.x, C.y + _LBL_OFFSET + 2.5 * ps, { align: 'center' });
}

function _drawTriAreaDiagramPDF(doc, { base, height }, x0, y0, w, h, ps, font) {
    const triW = w * 0.70;
    const ratio = height / base;
    const triH = Math.max(8, Math.min(h * 0.62, triW * ratio * 0.58));
    const cx = x0 + w / 2;
    const by = y0 + h - 5 * ps;

    const bl = { x: cx - triW / 2, y: by };
    const br = { x: cx + triW / 2, y: by };
    const ap = { x: cx, y: by - triH };

    doc.setFillColor(..._GCF);
    doc.setDrawColor(..._GC);
    doc.setLineWidth(_STROKE_W);
    _triLines(doc, [bl, br, ap], 'FD');

    // Dashed height line
    doc.setLineDashPattern([1.2, 1.2], 0);
    doc.setDrawColor(..._GC);
    doc.setLineWidth(_AUX_W);
    doc.line(ap.x, ap.y, ap.x, by);
    doc.setLineDashPattern([], 0);

    // Right-angle mark at height foot
    const sq = 2.2 * ps;
    doc.setLineWidth(_AUX_W);
    _rightAnglePDF(doc, ap.x, by, sq);

    doc.setFontSize(8 * ps);

    // Base label — clear of bottom edge
    doc.setFont(font, 'normal');
    doc.setTextColor(..._LC);
    doc.text(String(base), cx, by + _LBL_OFFSET + 1.5 * ps, { align: 'center' });

    // Height label (right of dashed line) — generous clearance from the line
    doc.text(`h = ${height}`, ap.x + _LBL_OFFSET, (ap.y + by) / 2, { align: 'left' });

    // Missing "?" for area (inside triangle, left of dashed line)
    doc.setFont(font, 'bold');
    doc.setTextColor(..._MC);
    doc.setFontSize(10 * ps);
    doc.text('?', cx - _LBL_OFFSET - 5 * ps, (ap.y + by) / 2 + 1.5 * ps, { align: 'center' });
}

function _drawCircleDiagramPDF(doc, { r, missing }, x0, y0, w, h, ps, font) {
    // Allocate left ~45% of width for the circle, right ~55% for the missing label
    const maxR = Math.min(w * 0.35, h * 0.45);
    const rPx  = Math.max(11, Math.min(maxR, r * 2.2 * ps));
    const cx   = x0 + w * 0.40;
    const cy   = y0 + h / 2 + 1 * ps;   // slightly below vertical centre to leave room above

    doc.setFillColor(..._GCF);
    doc.setDrawColor(..._GC);
    doc.setLineWidth(_STROKE_W);
    doc.circle(cx, cy, rPx, 'FD');

    // Dashed radius line (centre → right edge)
    doc.setLineDashPattern([1.2, 1.2], 0);
    doc.setDrawColor(..._GC);
    doc.setLineWidth(_AUX_W);
    doc.line(cx, cy, cx + rPx, cy);
    doc.setLineDashPattern([], 0);

    // Centre dot
    doc.setFillColor(..._GC);
    doc.circle(cx, cy, 0.8, 'F');

    // "r = X" label — above the radius line, clear of the circle edge
    doc.setFontSize(8 * ps);
    doc.setFont(font, 'normal');
    doc.setTextColor(..._LC);
    doc.text(`r = ${r}`, cx + rPx / 2, cy - rPx - _LBL_OFFSET, { align: 'center' });

    // Missing label — to the right of the circle with consistent clearance
    const missText = missing === 'area' ? 'A = ?' : 'C = ?';
    const labelX   = cx + rPx + _LBL_OFFSET + 2 * ps;
    doc.setFont(font, 'bold');
    doc.setFontSize(9.5 * ps);
    doc.setTextColor(..._MC);
    doc.text(missText, labelX, cy + 1.5 * ps, { align: 'left' });

    // Formula hint below the missing label (parity with the on-screen SVG)
    const hintText = missing === 'area' ? 'A = πr²' : 'C = 2πr';
    doc.setFont(font, 'normal');
    doc.setFontSize(6.5 * ps);
    doc.setTextColor(150, 160, 175);
    doc.text(hintText, labelX, cy + 1.5 * ps + 4.5 * ps, { align: 'left' });
}

function _drawParallelogramDiagramPDF(doc, { base, height, missing }, x0, y0, w, h, ps, font) {
    const maxW = w * 0.72, maxH = h * 0.58;
    const dw = Math.max(14, Math.min(maxW, base * 2.2 * ps));
    const dh = Math.max(8,  Math.min(maxH, height * 2.2 * ps));
    const skew = dw * 0.22;  // horizontal offset at top

    const bx = x0 + (w - dw) / 2;
    const by = y0 + (h - dh) / 2 - 2 * ps;

    // Parallelogram vertices: BL, BR, TR, TL
    const BL = { x: bx,          y: by + dh };
    const BR = { x: bx + dw,     y: by + dh };
    const _TR = { x: bx + dw - skew, y: by };
    const TL = { x: bx - skew,   y: by };

    doc.setFillColor(..._GCF);
    doc.setDrawColor(..._GC);
    doc.setLineWidth(_STROKE_W);
    doc.lines([[dw, 0], [-skew, -dh], [-dw, 0]], BL.x, BL.y, [1, 1], 'FD');

    // Dashed height line from BL to TL (vertical)
    const hFootX = BL.x + skew;
    doc.setLineDashPattern([1.2, 1.2], 0);
    doc.setDrawColor(..._GC);
    doc.setLineWidth(_AUX_W);
    doc.line(hFootX, BL.y, hFootX, TL.y);  // BL.y (bottom) → TL.y (top)
    doc.setLineDashPattern([], 0);

    doc.setFontSize(8 * ps);
    doc.setFont(font, 'normal');
    doc.setTextColor(..._LC);
    // Base label below
    doc.text(`b = ${base}`, (BL.x + BR.x) / 2, BL.y + _LBL_OFFSET + 1.5 * ps, { align: 'center' });
    // Height label right of dashed line, vertically centred
    doc.text(`h = ${height}`, hFootX + _LBL_OFFSET, (BL.y + TL.y) / 2, { align: 'left' });

    const centreLabel = missing === 'area' ? 'A = ?' : 'P = ?';
    doc.setFont(font, 'bold');
    doc.setFontSize(9 * ps);
    doc.setTextColor(..._MC);
    doc.text(centreLabel, x0 + w / 2, by + dh / 2 + 1.8 * ps, { align: 'center' });
}

function _drawTrapeziumDiagramPDF(doc, { a, b, height, missing }, x0, y0, w, h, ps, font) {
    const maxW = w * 0.75, maxH = h * 0.58;
    const scale = Math.min(maxW / Math.max(a, b), maxH / height, 2.5 * ps);
    const dw = Math.max(a, b) * scale;
    const dh = Math.max(10, Math.min(maxH, height * scale));

    const bx = x0 + (w - dw) / 2;
    const by = y0 + (h - dh) / 2 - 2 * ps;

    const aW = a * scale, bW = b * scale;
    const offsetLeft = (dw - aW) / 2;

    // Trapezium vertices: BL, BR, TR, TL
    const BL = { x: bx,              y: by + dh };
    const BR = { x: bx + bW,         y: by + dh };
    const TR = { x: bx + offsetLeft + aW, y: by };
    const TL = { x: bx + offsetLeft,      y: by };

    doc.setFillColor(..._GCF);
    doc.setDrawColor(..._GC);
    doc.setLineWidth(_STROKE_W);
    // Draw trapezium as a filled, closed path
    doc.lines([
        [bW, 0],                      // BL → BR
        [(aW - bW) / 2, -dh],         // BR → TR
        [-aW, 0],                     // TR → TL (auto-closes to BL)
    ], BL.x, BL.y, [1, 1], 'FD');

    // Dashed height line
    const _hx = BL.x + (bW - aW) / 2 + aW / 2;  // roughly midpoint
    const hFootY = BL.y;
    const hTopY  = TL.y;
    doc.setLineDashPattern([1.2, 1.2], 0);
    doc.setDrawColor(..._GC);
    doc.setLineWidth(_AUX_W);
    doc.line((TL.x + TR.x) / 2, hTopY, (TL.x + TR.x) / 2, hFootY);
    doc.setLineDashPattern([], 0);

    doc.setFontSize(8 * ps);
    doc.setFont(font, 'normal');
    doc.setTextColor(..._LC);
    // Top label (a)
    doc.text(`a = ${a}`, (TL.x + TR.x) / 2, TL.y - _LBL_OFFSET, { align: 'center' });
    // Bottom label (b)
    doc.text(`b = ${b}`, (BL.x + BR.x) / 2, BL.y + _LBL_OFFSET + 1.5 * ps, { align: 'center' });
    // Height label
    doc.text(`h = ${height}`, (TL.x + TR.x) / 2 + _LBL_OFFSET, (hTopY + hFootY) / 2, { align: 'left' });

    const centreLabel = missing === 'area' ? 'A = ?' : 'P = ?';
    doc.setFont(font, 'bold');
    doc.setFontSize(9 * ps);
    doc.setTextColor(..._MC);
    doc.text(centreLabel, x0 + w / 2, by + dh / 2 + 1.8 * ps, { align: 'center' });
}

// Approximate an arc as a chain of short line segments — PDF coords are
// y-down so we negate sin for the "upward" direction the SVG version uses.
function _arcSegments(doc, vx, vy, r, startDeg, endDeg, steps = 24) {
    const a0 = startDeg * Math.PI / 180;
    const a1 = endDeg * Math.PI / 180;
    let prevX = vx + r * Math.cos(a0);
    let prevY = vy - r * Math.sin(a0);
    for (let i = 1; i <= steps; i++) {
        const t = a0 + (a1 - a0) * (i / steps);
        const nx = vx + r * Math.cos(t);
        const ny = vy - r * Math.sin(t);
        doc.line(prevX, prevY, nx, ny);
        prevX = nx; prevY = ny;
    }
}

// Angle of vector (vx,vy) → (px,py) measured CCW from +x (math convention,
// SVG/PDF y-down).
function _angleOf(vx, vy, px, py) {
    const ang = Math.atan2(-(py - vy), px - vx) * 180 / Math.PI;
    return (ang + 360) % 360;
}

// Draw the smaller arc from ray (vx,vy)→(p1) to ray (vx,vy)→(p2)
function _drawAngleArcPDF(doc, vx, vy, p1x, p1y, p2x, p2y, r) {
    const ang1 = _angleOf(vx, vy, p1x, p1y);
    const ang2 = _angleOf(vx, vy, p2x, p2y);
    let delta = ang2 - ang1;
    if (delta > 180)  delta -= 360;
    if (delta < -180) delta += 360;
    _arcSegments(doc, vx, vy, r, ang1, ang1 + delta);
}

function _drawStraightLineAnglesPDF(doc, { a }, x0, y0, w, h, ps, font) {
    // Layout: horizontal line + ray from pivot at angle (180−a)°
    const lineY = y0 + h * 0.58;
    const lx    = x0 + w * 0.08;
    const rx    = x0 + w * 0.92;
    const px    = x0 + w * 0.48;
    const r     = Math.min(w, h) * 0.18;
    const rayLen = Math.min(w * 0.30, h * 0.42);
    const rayAngleDeg = 180 - a;
    const rayRad = rayAngleDeg * Math.PI / 180;
    const rayX = px + rayLen * Math.cos(rayRad);
    const rayY = lineY - rayLen * Math.sin(rayRad);

    doc.setDrawColor(..._GC);
    doc.setLineWidth(_STROKE_W);
    doc.line(lx, lineY, rx, lineY);
    doc.setLineWidth(_AUX_W);
    doc.setDrawColor(..._LC);
    doc.line(px, lineY, rayX, rayY);

    doc.setDrawColor(..._GC);
    doc.setLineWidth(_AUX_W);
    _drawAngleArcPDF(doc, px, lineY, lx, lineY, rayX, rayY, r);
    _drawAngleArcPDF(doc, px, lineY, rayX, rayY, rx, lineY, r);

    doc.setFontSize(8 * ps);
    doc.setFont(font, 'normal');
    doc.setTextColor(..._LC);
    const midA1 = (180 - a / 2) * Math.PI / 180;
    doc.text(`${a}°`, px + (r + 4) * Math.cos(midA1), lineY - (r + 4) * Math.sin(midA1), { align: 'center' });

    doc.setFont(font, 'bold');
    doc.setTextColor(..._MC);
    const midA2 = ((180 - a) / 2) * Math.PI / 180;
    doc.text('?', px + (r + 4) * Math.cos(midA2), lineY - (r + 4) * Math.sin(midA2), { align: 'center' });
}

function _drawVerticallyOppositePDF(doc, { a }, x0, y0, w, h, ps, font) {
    const cx = x0 + w / 2;
    const cy = y0 + h * 0.52;
    const r  = Math.min(w, h) * 0.16;
    const len = Math.min(w * 0.42, h * 0.42);

    const angRad = a * Math.PI / 180;
    const p1x = cx + len, p1y = cy;
    const p2x = cx - len, p2y = cy;
    const p3x = cx + len * Math.cos(angRad), p3y = cy - len * Math.sin(angRad);
    const p4x = cx - len * Math.cos(angRad), p4y = cy + len * Math.sin(angRad);

    doc.setDrawColor(..._GC);
    doc.setLineWidth(_STROKE_W);
    doc.line(p2x, p2y, p1x, p1y);
    doc.line(p4x, p4y, p3x, p3y);

    doc.setLineWidth(_AUX_W);
    _drawAngleArcPDF(doc, cx, cy, p1x, p1y, p3x, p3y, r);
    _drawAngleArcPDF(doc, cx, cy, p2x, p2y, p4x, p4y, r);

    doc.setFontSize(8 * ps);
    doc.setFont(font, 'normal');
    doc.setTextColor(..._LC);
    const midA = (a / 2) * Math.PI / 180;
    doc.text(`${a}°`, cx + (r + 4) * Math.cos(midA), cy - (r + 4) * Math.sin(midA), { align: 'center' });

    doc.setFont(font, 'bold');
    doc.setTextColor(..._MC);
    doc.text('?', cx - (r + 4) * Math.cos(midA), cy + (r + 4) * Math.sin(midA), { align: 'center' });
}

function _drawParallelTransversalPDF(doc, { a, angleType }, x0, y0, w, h, ps, font) {
    // Two horizontal parallel lines + transversal sloping up-right
    const xL = x0 + w * 0.08;
    const xR = x0 + w * 0.92;
    const y1 = y0 + h * 0.25;
    const y2 = y0 + h * 0.78;

    // Transversal endpoints chosen so it visibly extends beyond both lines
    const txBot = { x: x0 + w * 0.30, y: y0 + h * 0.96 };
    const txTop = { x: x0 + w * 0.78, y: y0 + h * 0.06 };

    // Intersections: parametric t where y = y1 / y2
    const t1 = (y1 - txBot.y) / (txTop.y - txBot.y);
    const t2 = (y2 - txBot.y) / (txTop.y - txBot.y);
    const P1 = { x: txBot.x + t1 * (txTop.x - txBot.x), y: y1 };
    const P2 = { x: txBot.x + t2 * (txTop.x - txBot.x), y: y2 };

    doc.setDrawColor(..._GC);
    doc.setLineWidth(_STROKE_W);
    doc.line(xL, y1, xR, y1);
    doc.line(xL, y2, xR, y2);
    doc.setLineWidth(_AUX_W);
    doc.setDrawColor(..._LC);
    doc.line(txBot.x, txBot.y, txTop.x, txTop.y);

    const r = Math.min(w, h) * 0.12;
    doc.setLineWidth(_AUX_W);
    doc.setDrawColor(..._GC);

    // Per-type arc placement matches the SVG version
    let v1A, v1B, v2A, v2B;
    let lbl1Off, lbl2Off; // {dx, dy} for label placement relative to vertex
    if (angleType === 'co-interior') {
        v1A = { x: xR, y: y1 };    v1B = txBot;
        v2A = txTop;               v2B = { x: xR, y: y2 };
        lbl1Off = { dx: r + 3, dy: r * 0.6 };
        lbl2Off = { dx: r + 3, dy: -r * 0.6 };
    } else if (angleType === 'corresponding') {
        v1A = { x: xR, y: y1 };    v1B = txTop;
        v2A = { x: xR, y: y2 };    v2B = txTop;
        lbl1Off = { dx: r + 3, dy: -r * 0.6 };
        lbl2Off = { dx: r + 3, dy: -r * 0.6 };
    } else {
        // alternate
        v1A = { x: xL, y: y1 };    v1B = txBot;
        v2A = { x: xR, y: y2 };    v2B = txTop;
        lbl1Off = { dx: -r - 3, dy: r * 0.6 };
        lbl2Off = { dx: r + 3, dy: -r * 0.6 };
    }
    _drawAngleArcPDF(doc, P1.x, P1.y, v1A.x, v1A.y, v1B.x, v1B.y, r);
    _drawAngleArcPDF(doc, P2.x, P2.y, v2A.x, v2A.y, v2B.x, v2B.y, r);

    doc.setFontSize(7.5 * ps);
    doc.setFont(font, 'normal');
    doc.setTextColor(..._LC);
    doc.text(`${a}°`, P1.x + lbl1Off.dx, P1.y + lbl1Off.dy, { align: lbl1Off.dx < 0 ? 'right' : 'left' });

    doc.setFont(font, 'bold');
    doc.setTextColor(..._MC);
    doc.text('?', P2.x + lbl2Off.dx, P2.y + lbl2Off.dy, { align: lbl2Off.dx < 0 ? 'right' : 'left' });
}

function _drawRightTriangleTrigPDF(doc, { opp, adj, hyp, angle, missing }, x0, y0, w, h, ps, font) {
    // Fixed 4:3 proportions — same visual shape regardless of actual values
    const adjMm = Math.min(w * 0.56, h * 0.70);
    const oppMm = adjMm * (78 / 106);
    const Ax = x0 + w * 0.12, Ay = y0 + h * 0.85;
    const Bx = Ax + adjMm,    By = Ay;
    const Cx = Ax,            Cy = Ay - oppMm;

    doc.setFillColor(..._GCF);
    doc.setDrawColor(..._GC);
    doc.setLineWidth(_STROKE_W);
    _triLines(doc, [{ x: Ax, y: Ay }, { x: Bx, y: By }, { x: Cx, y: Cy }], 'FD');

    const sq = 2.2 * ps;
    doc.setLineWidth(_AUX_W);
    _rightAnglePDF(doc, Ax, Ay, sq);

    // Theta arc at B (between legs BA and BC)
    const arcR = Math.min(adjMm, oppMm) * 0.22;
    doc.setDrawColor(..._GC);
    doc.setLineWidth(_AUX_W);
    _drawAngleArcPDF(doc, Bx, By, Ax, Ay, Cx, Cy, arcR);

    doc.setFontSize(7.5 * ps);
    const isMissing = (key) => missing === key;
    const lbl = (key, val, suffix = '') => isMissing(key) ? '?' : `${val}${suffix}`;

    // adj label below baseline
    doc.setFont(font, isMissing('adj') ? 'bold' : 'normal');
    doc.setTextColor(...(isMissing('adj') ? _MC : _LC));
    doc.text(`adj = ${lbl('adj', adj)}`, (Ax + Bx) / 2, Ay + _LBL_OFFSET + 1.5 * ps, { align: 'center' });

    // opp label left of vertical leg
    doc.setFont(font, isMissing('opp') ? 'bold' : 'normal');
    doc.setTextColor(...(isMissing('opp') ? _MC : _LC));
    doc.text(`opp = ${lbl('opp', opp)}`, Ax - _LBL_OFFSET, (Ay + Cy) / 2 + 1.2 * ps, { align: 'right' });

    // hyp label along the hypotenuse (outward normal)
    const hdx = Bx - Cx, hdy = By - Cy, hlen = Math.hypot(hdx, hdy);
    const hnx = hdy / hlen, hny = -hdx / hlen;
    const hmx = (Bx + Cx) / 2 + hnx * (_LBL_OFFSET + 2);
    const hmy = (By + Cy) / 2 + hny * (_LBL_OFFSET + 2) + 1.2 * ps;
    doc.setFont(font, isMissing('hyp') ? 'bold' : 'normal');
    doc.setTextColor(...(isMissing('hyp') ? _MC : _LC));
    doc.text(`hyp = ${lbl('hyp', hyp)}`, hmx, hmy, { align: 'center' });

    // θ label inside the arc at B
    doc.setFontSize(7 * ps);
    doc.setFont(font, isMissing('angle') ? 'bold' : 'normal');
    doc.setTextColor(...(isMissing('angle') ? _MC : _LC));
    doc.text(`${font === 'helvetica' ? 'theta' : 'θ'}=${lbl('angle', angle, '°')}`, Bx - arcR - 7 * ps, By - arcR * 0.5, { align: 'right' });
}

// "Nice" tick step (1, 2, 5, ×10ⁿ) for ~`target` ticks across span.
function _niceStepPDF(span, target = 5) {
    const raw = Math.max(span, 1e-6) / target;
    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
    for (const c of [1, 2, 5, 10]) if (c * pow >= raw) return c * pow;
    return 10 * pow;
}

function _drawParabolaPDF(doc, { h: ph, k, a }, x0, y0, w, h, ps, font) {
    a = a || 1;
    // Plot rectangle inside the cell (leave room for edge labels).
    const pL = x0 + 6, pR = x0 + w - 1, pT = y0 + 1.5, pB = y0 + h - 4;
    const aAbs = Math.abs(a);

    // Auto-frame the vertex (same logic as the on-screen SVG) so the curve is
    // always fully drawn regardless of how far (h, k) sits from the origin.
    const V = 7;
    const xHalf = Math.min(6, Math.sqrt(V / aAbs));
    const arm = aAbs * xHalf * xHalf;
    const padX = xHalf * 0.14;
    const xMin = ph - xHalf - padX, xMax = ph + xHalf + padX;
    const padY = arm * 0.14 + 0.6;
    const yMin = a > 0 ? k - padY : k - arm - padY;
    const yMax = a > 0 ? k + arm + padY : k + padY;

    const mapX = x => pL + ((x - xMin) / (xMax - xMin)) * (pR - pL);
    const mapY = y => pB - ((y - yMin) / (yMax - yMin)) * (pB - pT);

    // Frame
    doc.setDrawColor(205, 210, 220);
    doc.setLineWidth(0.2);
    doc.rect(pL, pT, pR - pL, pB - pT, 'S');

    // Gridlines + numeric labels on the bottom (x) and left (y) edges
    doc.setFontSize(5 * ps);
    doc.setFont(font, 'normal');
    const xStep = _niceStepPDF(xMax - xMin), yStep = _niceStepPDF(yMax - yMin);
    for (let xv = Math.ceil(xMin / xStep) * xStep; xv <= xMax; xv += xStep) {
        const gx = mapX(xv);
        if (gx < pL + 1.5 || gx > pR - 0.5) continue;
        doc.setDrawColor(225, 228, 235); doc.setLineWidth(0.12);
        doc.line(gx, pT, gx, pB);
        doc.setTextColor(120, 128, 140);
        doc.text(String(Math.round(xv)), gx, pB + 3, { align: 'center' });
    }
    for (let yv = Math.ceil(yMin / yStep) * yStep; yv <= yMax; yv += yStep) {
        const gy = mapY(yv);
        if (gy < pT + 1 || gy > pB - 0.5) continue;
        doc.setDrawColor(225, 228, 235); doc.setLineWidth(0.12);
        doc.line(pL, gy, pR, gy);
        doc.setTextColor(120, 128, 140);
        doc.text(String(Math.round(yv)), pL - 1, gy + 0.8, { align: 'right' });
    }

    // Axes (emphasised) where the origin falls inside the window
    doc.setDrawColor(120, 128, 140); doc.setLineWidth(0.3);
    if (xMin < 0 && xMax > 0) { const ax0 = mapX(0); doc.line(ax0, pT, ax0, pB); }
    if (yMin < 0 && yMax > 0) { const ay0 = mapY(0); doc.line(pL, ay0, pR, ay0); }

    // Axis titles
    doc.setFontSize(6 * ps);
    doc.setFont(font, font === 'helvetica' ? 'italic' : 'normal');
    doc.setTextColor(110, 116, 128);
    doc.text('x', pR - 0.8, pB - 0.8, { align: 'right' });
    doc.text('y', pL + 1, pT + 2.6, { align: 'left' });

    // Curve
    const nPts = 56;
    const pts = [];
    for (let i = 0; i <= nPts; i++) {
        const xc = xMin + (xMax - xMin) * (i / nPts);
        const yc = a * (xc - ph) * (xc - ph) + k;
        if (yc < yMin || yc > yMax) continue;
        pts.push({ x: mapX(xc), y: mapY(yc) });
    }
    if (pts.length > 1) {
        doc.setDrawColor(..._GC);
        doc.setLineWidth(0.7);
        for (let i = 0; i < pts.length - 1; i++)
            doc.line(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
    }

    // Vertex dot + label
    const vx = mapX(ph), vy = mapY(k);
    doc.setFillColor(..._MC);
    doc.circle(vx, vy, 1.1, 'F');
    doc.setFontSize(6 * ps);
    doc.setFont(font, 'bold');
    doc.setTextColor(..._MC);
    const labelLeft = vx > pR - 14;
    doc.text(`(${ph}, ${k})`, labelLeft ? vx - 2 : vx + 2, a > 0 ? vy + 3.2 : vy - 1.6,
        { align: labelLeft ? 'right' : 'left' });
}

function _drawNumberPlanePDF(doc, { pts, line, mid }, x0, y0, w, h, ps, font) {
    const padBox = 5;
    const pL0 = x0 + padBox + 2, pR0 = x0 + w - padBox;
    const pT0 = y0 + padBox - 2, pB0 = y0 + h - padBox;
    const availW = pR0 - pL0, availH = pB0 - pT0;

    let xMin = Math.min(...pts.map(p => p[0])), xMax = Math.max(...pts.map(p => p[0]));
    let yMin = Math.min(...pts.map(p => p[1])), yMax = Math.max(...pts.map(p => p[1]));
    const padX = Math.max(1, (xMax - xMin) * 0.18), padY = Math.max(1, (yMax - yMin) * 0.18);
    xMin -= padX; xMax += padX; yMin -= padY; yMax += padY;

    const unit = Math.min(availW / (xMax - xMin), availH / (yMax - yMin));
    const drawW = (xMax - xMin) * unit, drawH = (yMax - yMin) * unit;
    const plL = pL0 + (availW - drawW) / 2, plT = pT0 + (availH - drawH) / 2;
    const plR = plL + drawW, plB = plT + drawH;
    const mapX = x => plL + (x - xMin) * unit;
    const mapY = y => plB - (y - yMin) * unit;

    // Frame
    doc.setDrawColor(205, 210, 220); doc.setLineWidth(0.2);
    doc.rect(plL, plT, drawW, drawH, 'S');

    // Gridlines + edge labels
    doc.setFontSize(5 * ps); doc.setFont(font, 'normal');
    // Whole-number tick step — coordinates are integers (a fractional step would
    // round two gridlines to the same integer label).
    const xStep = Math.max(1, Math.round(_niceStepPDF(xMax - xMin)));
    const yStep = Math.max(1, Math.round(_niceStepPDF(yMax - yMin)));
    for (let xv = Math.ceil(xMin / xStep) * xStep; xv <= xMax; xv += xStep) {
        const gx = mapX(xv);
        if (gx < plL + 1.5 || gx > plR - 0.5) continue;
        doc.setDrawColor(228, 231, 238); doc.setLineWidth(0.12);
        doc.line(gx, plT, gx, plB);
        if (Math.round(xv) !== 0) { doc.setTextColor(120, 128, 140); doc.text(String(Math.round(xv)), gx, plB + 3, { align: 'center' }); }
    }
    for (let yv = Math.ceil(yMin / yStep) * yStep; yv <= yMax; yv += yStep) {
        const gy = mapY(yv);
        if (gy < plT + 1 || gy > plB - 0.5) continue;
        doc.setDrawColor(228, 231, 238); doc.setLineWidth(0.12);
        doc.line(plL, gy, plR, gy);
        if (Math.round(yv) !== 0) { doc.setTextColor(120, 128, 140); doc.text(String(Math.round(yv)), plL - 1, gy + 0.8, { align: 'right' }); }
    }

    // Axes where the origin is in-window
    doc.setDrawColor(120, 128, 140); doc.setLineWidth(0.3);
    if (xMin < 0 && xMax > 0) { const ax = mapX(0); doc.line(ax, plT, ax, plB); }
    if (yMin < 0 && yMax > 0) { const ay = mapY(0); doc.line(plL, ay, plR, ay); }

    // Segment
    if (line && pts.length >= 2) {
        doc.setDrawColor(..._GC); doc.setLineWidth(0.7);
        doc.line(mapX(pts[0][0]), mapY(pts[0][1]), mapX(pts[1][0]), mapY(pts[1][1]));
    }
    // Midpoint marker
    if (mid && pts.length >= 2) {
        doc.setDrawColor(..._GC); doc.setFillColor(255, 255, 255); doc.setLineWidth(0.4);
        doc.circle(mapX((pts[0][0] + pts[1][0]) / 2), mapY((pts[0][1] + pts[1][1]) / 2), 1.1, 'FD');
    }

    // Points + coordinate labels
    doc.setFontSize(6 * ps); doc.setFont(font, 'bold');
    for (const [px, py] of pts) {
        const dx = mapX(px), dy = mapY(py);
        doc.setFillColor(..._MC); doc.circle(dx, dy, 1.1, 'F');
        doc.setTextColor(..._MC);
        const right = dx < plR - 12;
        doc.text(`(${px}, ${py})`, right ? dx + 1.6 : dx - 1.6, dy > plT + 5 ? dy - 1.4 : dy + 3,
            { align: right ? 'left' : 'right' });
    }
}

/**
 * Draw a geometry diagram into a bounding box.
 * @param {jsPDF} doc
 * @param {Object} diagram  - item.diagram
 * @param {number} x0       - left edge (mm)
 * @param {number} y0       - top edge (mm)
 * @param {number} w        - available width (mm)
 * @param {number} h        - allocated height (mm)
 * @param {number} ps       - pScale
 * @param {string} font     - pdf font name
 */
function _drawDiagramInPDF(doc, diagram, x0, y0, w, h, ps, font) {
    if (!diagram) return;
    // Reset dash + line state before drawing. Rounded joins/caps mirror the
    // on-screen SVG diagrams so the two render as one consistent set.
    doc.setLineDashPattern([], 0);
    if (doc.setLineJoin) doc.setLineJoin('round');
    if (doc.setLineCap)  doc.setLineCap('round');
    switch (diagram.type) {
        case 'rectangle':            _drawRectDiagramPDF(doc, diagram, x0, y0, w, h, ps, font); break;
        case 'right-triangle':       _drawRightTriDiagramPDF(doc, diagram, x0, y0, w, h, ps, font); break;
        case 'triangle-angles':      _drawTriAnglesDiagramPDF(doc, diagram, x0, y0, w, h, ps, font); break;
        case 'triangle-area':        _drawTriAreaDiagramPDF(doc, diagram, x0, y0, w, h, ps, font); break;
        case 'circle':               _drawCircleDiagramPDF(doc, diagram, x0, y0, w, h, ps, font); break;
        case 'parallelogram':        _drawParallelogramDiagramPDF(doc, diagram, x0, y0, w, h, ps, font); break;
        case 'trapezium':            _drawTrapeziumDiagramPDF(doc, diagram, x0, y0, w, h, ps, font); break;
        case 'straight-line-angles':  _drawStraightLineAnglesPDF(doc, diagram, x0, y0, w, h, ps, font); break;
        case 'vertically-opposite':   _drawVerticallyOppositePDF(doc, diagram, x0, y0, w, h, ps, font); break;
        case 'parallel-transversal':  _drawParallelTransversalPDF(doc, diagram, x0, y0, w, h, ps, font); break;
        case 'right-triangle-trig':   _drawRightTriangleTrigPDF(doc, diagram, x0, y0, w, h, ps, font); break;
        case 'parabola':              _drawParabolaPDF(doc, diagram, x0, y0, w, h, ps, font); break;
        case 'number-plane':          _drawNumberPlanePDF(doc, diagram, x0, y0, w, h, ps, font); break;
    }
    // Restore defaults
    doc.setLineDashPattern([], 0);
    if (doc.setLineJoin) doc.setLineJoin('miter');
    if (doc.setLineCap)  doc.setLineCap('butt');
    doc.setTextColor(15, 23, 42);
    doc.setDrawColor(100, 116, 139);
    doc.setFillColor(255, 255, 255);
}

const TOPIC_COLOURS_RGB = {
    'Number': [59, 130, 246], 'Algebra': [139, 92, 246], 'Geometry': [16, 185, 129],
    'Statistics': [245, 158, 11], 'Financial Maths': [239, 68, 68],
    'Trigonometry': [6, 182, 212], 'Probability': [168, 85, 247],
    'Ratios & Rates': [14, 165, 233],
    'Integers': [59, 130, 246], 'Decimals': [59, 130, 246], 'Rounding': [59, 130, 246],
    'Fractions': [59, 130, 246], 'Percentages': [59, 130, 246],
};

// Diff icons (Unicode) — emoji go via canvas fallback in drawText().
// Ordered to match the project's seedling/bolt/fire convention.
const DIFF_ICONS = { Easy: '🌱', Medium: '⚡', Hard: '🔥' };

/**
 * Draw a "Label: ___ / N = ___ %" score row.
 * Right-anchored: the % glyph ends exactly at `rightX`. The block grows leftward.
 *
 * @param {object} doc        jsPDF
 * @param {number} rightX     Right edge (where % ends)
 * @param {number} y          Baseline Y
 * @param {string} label      Label text (e.g. "Score:" or "TOTAL:")
 * @param {number} count      Total marks (the N in "/ N")
 * @param {object} opts       { fontPt, blankW, gap, color, lineColor, pdfFont }
 * @returns {number}          Left X of the drawn block
 */
function _drawScoreLine(doc, rightX, y, label, count, opts) {
    const { fontPt, blankW, gap, color, lineColor, pdfFont } = opts;
    doc.setFont(pdfFont, 'bold'); doc.setFontSize(fontPt); doc.setTextColor(...color);

    const pctStr = '%';
    const sepStr = `/ ${count}  =`;

    // Walk right→left, drawing each piece anchored to its right edge.
    let x = rightX;
    doc.text(pctStr, x, y, { align: 'right' });
    x -= doc.getTextWidth(pctStr) + gap;

    doc.setDrawColor(...lineColor); doc.setLineWidth(0.3); doc.setLineDashPattern([0.5, 1], 0);
    doc.line(x - blankW, y, x, y);
    doc.setLineDashPattern([], 0);
    x -= blankW + gap;

    doc.setFont(pdfFont, 'bold'); doc.setFontSize(fontPt); doc.setTextColor(...color);
    doc.text(sepStr, x, y, { align: 'right' });
    x -= doc.getTextWidth(sepStr) + gap;

    doc.setDrawColor(...lineColor); doc.setLineWidth(0.3); doc.setLineDashPattern([0.5, 1], 0);
    doc.line(x - blankW, y, x, y);
    doc.setLineDashPattern([], 0);
    x -= blankW + gap;

    doc.setFont(pdfFont, 'bold'); doc.setFontSize(fontPt); doc.setTextColor(...color);
    doc.text(label, x, y, { align: 'right' });
    return x - doc.getTextWidth(label);
}

/**
 * Draw a single answer-key clue with the same bold/italic emphasis the
 * problem-set body uses (auto-bold verb, **bold**, *italic*). Wraps within
 * `maxW`, capped at `maxLines` lines (last line ellipsised if there's more).
 * Returns the number of lines actually drawn.
 */
function _drawKeyClueRich(doc, prefix, clue, x, y, {
    maxW, lineH, fontSizePt, pdfFont, color, maxLines = 3,
}) {
    // Auto-bold the leading verb if not already marked (matches HTML key).
    let rawClue = clue || '';
    if (!rawClue.startsWith('**')) {
        const verb = detectVerb(rawClue);
        if (verb) rawClue = `**${verb}**${rawClue.slice(verb.length)}`;
    }
    // Strip newlines — the key cell is one block; show the stem only.
    rawClue = rawClue.replace(/\n+/g, ' ');

    // Convert LaTeX→unicode while preserving emphasis markers.
    const withLatex = latexToText(
        rawClue.replace(/\*\*([^*]+)\*\*/g, '\x01$1\x01')
               .replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1\x02$2\x02')
    )
    .replace(/\x01([^\x01]*)\x01/g, '**$1**')
    .replace(/\x02([^\x02]*)\x02/g, '*$1*');

    const segs = _parseEmphasisSegments(withLatex);
    let curX = x, curY = y, line = 0;

    // Draw the leading "N. " prefix in normal style first.
    doc.setFont(pdfFont, 'normal');
    doc.setFontSize(fontSizePt);
    doc.setTextColor(...color);
    doc.text(prefix, curX, curY);
    curX += doc.getTextWidth(prefix);

    const advanceLine = () => {
        line++;
        if (line >= maxLines) return false;
        curY += lineH;
        curX = x;
        return true;
    };

    for (const seg of segs) {
        const isBold   = !!seg.bold;
        const isItalic = !!seg.italic;
        const useNativeItalic = isItalic && pdfFont === 'helvetica';
        const style = isBold ? 'bold' : (useNativeItalic ? 'italic' : 'normal');
        const drawColor = (isItalic && !useNativeItalic) ? [13, 148, 136] : color;
        doc.setFont(pdfFont, style);
        doc.setTextColor(...drawColor);

        const tokens = seg.t.match(/\S+|\s+/g) || [];
        for (const token of tokens) {
            const tw = doc.getTextWidth(token);
            if (token.trim() === '') { curX += tw; continue; }
            if (curX + tw > x + maxW + 0.5 && curX > x) {
                if (!advanceLine()) {
                    // Out of lines — ellipsise on the previous line and stop.
                    doc.setFont(pdfFont, 'normal');
                    doc.setTextColor(...color);
                    doc.text('…', curX, curY);
                    return line + 1;
                }
                doc.setFont(pdfFont, style);
                doc.setTextColor(...drawColor);
            }
            doc.text(token, curX, curY);
            curX += tw;
        }
    }
    return line + 1;
}

/**
 * Parse a clue string (AFTER LaTeX→text conversion but with emphasis markers
 * still present) into an array of {t, bold, italic} segments.
 */
function _parseEmphasisSegments(text) {
    const segs = [];
    // Match ** bold ** and * italic * markers
    const re = /(\*\*([^*]+)\*\*|\*([^*\s][^*]*?)\*)(?!\*)/g;
    let lastIdx = 0, m;
    while ((m = re.exec(text)) !== null) {
        if (m.index > lastIdx) segs.push({ t: text.slice(lastIdx, m.index), bold: false, italic: false });
        if (m[0].startsWith('**')) segs.push({ t: m[2], bold: true,  italic: false });
        else                        segs.push({ t: m[3], bold: false, italic: true  });
        lastIdx = m.index + m[0].length;
    }
    if (lastIdx < text.length) segs.push({ t: text.slice(lastIdx), bold: false, italic: false });
    return segs;
}

/**
 * Convert every $...$ math region in a clue to unicode and wrap it in atomic
 * sentinels (open…close) so the inline renderer can keep each expression on a
 * single line instead of breaking it between operators. Bold/italic emphasis
 * markers are left intact (they live in the prose and may even surround a math
 * region, e.g. the auto-bolded verb "Find $x$:"). Escaped \$ are preserved as
 * literal dollar signs.
 */
function _convertMathAtomic(clue, open, close) {
    const safe = (clue || '').replace(/\\\$/g, '\x00');
    return safe
        .replace(/\$([^$]+)\$/g, (_, inner) =>
            open + latexToText('$' + inner.split('\x00').join('\\$') + '$') + close)
        .split('\x00').join('$');
}

/**
 * Draw clue text inline, switching font weight for **bold** and *italic* markers.
 * LaTeX is converted to unicode before rendering.
 * Returns the Y baseline of the last drawn line.
 *
 * @param {object} doc    jsPDF instance
 * @param {string} clue   Raw clue string (with LaTeX and emphasis markers)
 * @param {number} x      Left edge of text column (mm)
 * @param {number} y      Baseline Y for first line (mm)
 * @param {number} maxW   Maximum line width (mm)
 * @param {number} fontSizePt
 * @param {string} pdfFont
 * @param {number[]} color  [r, g, b]
 * @param {number} lineH  Line height (mm)
 * @returns {number}  Final baseline Y after last drawn character
 */
function _drawClueInline(doc, clue, x, y, maxW, fontSizePt, pdfFont, color, lineH) {
    // Multi-line clues (stem\nequation[\nequation2]) — draw stem, then each
    // equation line indented on its own line with a full lineH gap.
    const nlIdx = (clue || '').indexOf('\n');
    if (nlIdx !== -1) {
        const stem = clue.slice(0, nlIdx).trim();
        const eqs  = clue.slice(nlIdx + 1).split('\n');
        let curY = _drawClueInline(doc, stem, x, y, maxW, fontSizePt, pdfFont, color, lineH);
        for (const eq of eqs) {
            curY = _drawClueInline(doc, eq.trim(), x + 2, curY + lineH, maxW - 2, fontSizePt, pdfFont, color, lineH);
        }
        return curY;
    }

    // Auto-bold verb prefixes (Calculate:, Find, etc.) to match HTML treatment.
    // Uses the same two-stage detector as renderers/htmlUtils.js → detectVerb.
    let rawClue = clue;
    if (!rawClue.startsWith('**')) {
        const verb = detectVerb(rawClue);
        if (verb) {
            rawClue = `**${verb}**${rawClue.slice(verb.length)}`;
        } else {
            // Try mid-sentence imperative ("A rectangle has...Determine its area.")
            const mid = detectMidVerb(rawClue);
            if (mid) {
                rawClue = rawClue.slice(0, mid.index)
                        + `**${mid.verb}**`
                        + rawClue.slice(mid.index + mid.verb.length);
            }
        }
    }

    // Convert $...$ math to unicode and mark each expression as an ATOMIC unit
    // (between \x03…\x04), keeping the **bold**/*italic* markers. Emphasis is
    // then parsed on the prepared string; a segment may interleave breakable
    // prose with atomic math runs.
    const ATOM_O = '\x03', ATOM_C = '\x04';
    const prepared = _convertMathAtomic(rawClue, ATOM_O, ATOM_C);
    const segs = _parseEmphasisSegments(prepared);
    let curX = x, curY = y;

    // Bold uses font weight (works on every font we ship). Italic: helvetica
    // supports it natively; the custom fonts (Inter/Roboto/Lora/Comic) only ship
    // normal+bold TTFs, so we substitute a teal accent colour so emphasis stays
    // visible. Re-applied after every Y advance.
    const applyStyle = (seg) => {
        const useNativeItalic = seg.italic && pdfFont === 'helvetica';
        doc.setFont(pdfFont, seg.bold ? 'bold' : (useNativeItalic ? 'italic' : 'normal'));
        doc.setFontSize(fontSizePt);
        doc.setTextColor(...((seg.italic && !useNativeItalic) ? [13, 148, 136] : color));
    };
    // Last-resort break for a token wider than the whole column (e.g. a lone
    // math expression too wide to fit) — split it character-by-character.
    const charBreak = (token, seg) => {
        let buf = '';
        for (const ch of token) {
            const next = buf + ch;
            if (curX + doc.getTextWidth(next) > x + maxW + 0.5 && buf) {
                doc.text(buf, curX, curY);
                curY += lineH; curX = x; applyStyle(seg);
                buf = ch;
            } else { buf = next; }
        }
        if (buf) { doc.text(buf, curX, curY); curX += doc.getTextWidth(buf); }
    };
    // Atomic run: keep the whole math expression on one line — wrap it as a unit
    // to the next line if it doesn't fit, and only char-break if it alone is
    // wider than the column. This stops expressions splitting between operators.
    const drawUnit = (text, seg) => {
        const w = doc.getTextWidth(text);
        if (w > maxW + 0.5) { charBreak(text, seg); return; }
        if (curX + w > x + maxW + 0.5 && curX > x) { curY += lineH; curX = x; applyStyle(seg); }
        doc.text(text, curX, curY);
        curX += w;
    };
    // Prose run: wrap on word boundaries.
    const drawWrapped = (text, seg) => {
        const tokens = text.match(/\S+|\s+/g) || [];
        for (const token of tokens) {
            const tw = doc.getTextWidth(token);
            if (token.trim() === '') { curX += tw; continue; }
            if (curX + tw > x + maxW + 0.5 && curX > x) { curY += lineH; curX = x; applyStyle(seg); }
            if (tw > maxW + 0.5) { charBreak(token, seg); continue; }
            doc.text(token, curX, curY);
            curX += tw;
        }
    };

    for (const seg of segs) {
        applyStyle(seg);
        // A segment may interleave prose with atomic math runs (\x03…\x04).
        const parts = seg.t.split(/(\x03[^\x04]*\x04)/);
        for (const part of parts) {
            if (!part) continue;
            if (part.charCodeAt(0) === 3) drawUnit(part.slice(1, -1), seg);
            else                          drawWrapped(part, seg);
        }
    }
    return curY;
}

const DIFF_RGB = { Easy: [16, 185, 129], Medium: [245, 158, 11], Hard: [239, 68, 68] };

/**
 * Generate a fresh set of questions for one export copy.
 */
function createQuestionSets(cfg, seed) {
    const topics = Object.keys(state.selectedTopics).filter(t => state.selectedTopics[t]);
    if (topics.length === 0) return null;
    const n = 30; // always generate enough to fill the selected page count
    const subOpsFilter = Object.keys(state.selectedSubOps).length > 0 ? state.selectedSubOps : null;
    const showFormulas = state.settings.showFormulas;
    const stage        = state.stage ?? 'Stage 4';
    const includePath  = state.includePath ?? false;
    return {
        easy:   generateMathsQuestions({ subTopics: topics, subOpsFilter, difficulty: 'Easy',   count: n, seed,         showFormulas, stage, includePath }),
        medium: generateMathsQuestions({ subTopics: topics, subOpsFilter, difficulty: 'Medium', count: n, seed: seed+1, showFormulas, stage, includePath }),
        hard:   generateMathsQuestions({ subTopics: topics, subOpsFilter, difficulty: 'Hard',   count: n, seed: seed+2, showFormulas, stage, includePath }),
    };
}

/**
 * Draw a question page (Easy / Medium / Hard) in PDF.
 * Returns the number of questions that did NOT fit (overflow count).
 */
function drawQuestionPage(ctx, questions, startY, pScale, exportId, startNum = 1) {
    if (!questions || !questions.length) return 0;
    const { doc, PAGE_WIDTH, PAGE_HEIGHT, MARGIN, scale, pdfFont, drawWatermark } = ctx;
    pScale = pScale || scale;

    const cfg = state.settings;
    const cols               = cfg.cols || 2;
    const showTopic          = cfg.showTopic || false;
    const showOutcomeChips   = cfg.psShowOutcomeChips || false;
    const showOutcomesHeader = cfg.psShowOutcomesHeader || false;
    const capPages           = cfg.psCapPages || 0;
    const showDiagrams       = cfg.showDiagrams !== false;   // default true
    const stage              = state.stage ?? 'Stage 4';
    const DIAG_H             = 30 * pScale;  // allocated height (mm) per diagram
    const availW             = PAGE_WIDTH - MARGIN * 2;
    const colW               = (availW - (cols - 1) * 8) / cols;
    const chipFontPt         = 5.5 * pScale;
    // 5 mm working-line pitch matches standard graph paper so algebra
    // students can keep equals-signs aligned across rows.
    const workingLineSpacing = 5;
    const answerLineSpacing  = 9 * pScale;
    const itemGap            = 6 * pScale;
    // Padding between major item sections (12pt ≈ 4.2mm) — gives the
    // question, working area and answer track distinct visual zones.
    const SECTION_PAD        = 4.2 * pScale;

    let cy          = startY, col = 0;
    // Per-column Y trackers for shortest-column placement (2-column mode).
    // Items are dropped into whichever column is currently shorter, which
    // balances height when one column has a tall item (e.g. a diagram).
    let colY = [startY, startY];

    // Optional outcomes header strip
    if (showOutcomesHeader) {
        const activeTopics = Object.keys(state.selectedTopics).filter(t => state.selectedTopics[t]);
        const outcomes = getOutcomesForTopics(activeTopics, stage);
        if (outcomes.length > 0) {
            const hdr_y = cy;
            const hdr_h = 6 * pScale;
            const hdr_pad = 2 * pScale;
            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.3);
            doc.roundedRect(MARGIN, hdr_y, availW, hdr_h, 1.5, 1.5, 'FD');
            // Label
            doc.setFont(pdfFont, 'bold');
            doc.setFontSize(5.5 * pScale);
            doc.setTextColor(148, 163, 184);
            doc.text('OUTCOMES', MARGIN + hdr_pad, hdr_y + hdr_h / 2 + 1.8 * pScale);
            // Outcome code pills
            let px = MARGIN + hdr_pad + doc.getTextWidth('OUTCOMES') + 3 * pScale;
            outcomes.forEach(o => {
                const pillColor = o.appliesAll ? [99, 102, 241] : [16, 185, 129];
                doc.setFont(pdfFont, 'bold');
                doc.setFontSize(5.5 * pScale);
                const codeW = doc.getTextWidth(o.code) + 3 * pScale;
                if (px + codeW > MARGIN + availW - hdr_pad) return;
                doc.setFillColor(...pillColor.map(c => Math.round(c * 0.15 + 255 * 0.85)));
                doc.setDrawColor(...pillColor.map(c => Math.round(c * 0.3 + 255 * 0.7)));
                doc.roundedRect(px, hdr_y + 1.2 * pScale, codeW, hdr_h - 2.4 * pScale, 1, 1, 'FD');
                doc.setTextColor(...pillColor);
                doc.text(o.code, px + 1.5 * pScale, hdr_y + hdr_h / 2 + 1.8 * pScale);
                px += codeW + 2 * pScale;
            });
            cy += hdr_h + 3 * pScale;
            colY = [cy, cy];   // header consumed space; reset both column trackers
        }
    }
    let _rowMaxH     = 0;
    let overflowCount = 0;
    let pagesUsed   = 1;
    let pageStartY  = startY;   // Y where content begins on the current PDF page

    doc.setFont(pdfFont, 'normal');
    doc.setFontSize(9 * pScale);

    for (let i = 0; i < questions.length; i++) {
        const item = questions[i];

        // Pre-calculate item height to decide whether it fits.
        // Fraction clues need 3 line-heights (numerator + bar + denominator),
        // but ONLY when the clue is short enough to sit on one line.
        // Long narrative clues that happen to contain \frac (e.g. probability
        // questions) must be word-wrapped normally to avoid column overflow.
        // Reset clue font before splitTextToSize — prior iterations change doc
        // font state, which would cause width calculation to use wrong metrics.
        doc.setFont(pdfFont, 'normal');
        doc.setFontSize(9 * pScale);
        const clueText   = latexToText(item.clue || '');
        const clueLines  = doc.splitTextToSize(clueText, colW - 14);
        const isFraction = hasFraction(item.clue) && clueLines.length === 1;
        const clueBlockH = isFraction
            ? 3 * 4.5 * pScale
            : clueLines.length * 4.5 * pScale;

        const workingCount = item.difficulty === 'Hard' ? 3 : item.difficulty === 'Medium' ? 2 : 1;
        // Use item.notes (specific sub-topic key) for outcome lookup — item.topic is broad category
        const itemCodes = showOutcomeChips && item.notes ? getTopicOutcomeCodes(item.notes, stage) : [];
        // Estimate height for the combined meta row (topic pill + outcome chips on one centered line)
        const hasMeta = (showTopic && item.topic) || itemCodes.length > 0;
        let metaH = 0;
        if (hasMeta) {
            const chipH  = 3.5 * pScale;
            const maxMetaW = colW - 4;
            let lineW = 0, metaRows = 1;
            if (showTopic && item.topic) {
                doc.setFont(pdfFont, 'normal');
                doc.setFontSize(6 * pScale);
                lineW += doc.getTextWidth(item.topic.toUpperCase()) + 6;
            }
            if (itemCodes.length > 0) {
                doc.setFont(pdfFont, 'bold');
                doc.setFontSize(chipFontPt);
                itemCodes.forEach(code => {
                    const cw = doc.getTextWidth(code) + 6;
                    if (lineW + cw > maxMetaW && lineW > 0) { metaRows++; lineW = cw; }
                    else lineW += cw;
                });
            }
            metaH = 4 * pScale + metaRows * (chipH + 1);
        }
        const hasDiagram = showDiagrams && !!item.diagram;
        const itemH = clueBlockH
            + (hasDiagram ? DIAG_H + SECTION_PAD : 0)
            + (workingCount > 0 ? SECTION_PAD + workingCount * workingLineSpacing + SECTION_PAD : 0)
            + answerLineSpacing + SECTION_PAD + 6 * pScale
            + metaH + itemGap;

        // COLUMN-MAJOR fill (newspaper style): stack items down the current
        // column until one won't fit, then move to the next column; when the
        // last column on the page is full, break to a new page. This keeps the
        // question numbers continuous down a column and then down the next —
        // unlike shortest-column balancing, which interleaves 1,3,5 / 2,4,6.
        const pageBottom = PAGE_HEIGHT - MARGIN - 10;
        const breakToNewPage = () => {
            pagesUsed++;
            if (cols === 2) {
                _drawColumnDivider(doc, MARGIN, colW, pageStartY, Math.max(colY[0], colY[1]));
            }
            drawExportIdFooter(ctx, exportId, pScale);
            doc.addPage();
            drawWatermark();
            pageStartY = MARGIN + 15 * scale;
            cy         = pageStartY;
            colY       = [pageStartY, pageStartY];
            col        = 0;
        };

        if (cols === 2) {
            if (colY[col] + itemH > pageBottom) {
                if (col === 0) {
                    // Left column full → continue at the top of the right column.
                    col = 1;
                } else {
                    // Both columns full → next page (subject to the page cap).
                    if (capPages > 0 && pagesUsed >= capPages) {
                        overflowCount = questions.length - i;
                        break;
                    }
                    breakToNewPage();
                }
            }
        } else if (cy + itemH > pageBottom) {
            if (capPages > 0 && pagesUsed >= capPages) {
                overflowCount = questions.length - i;
                break;
            }
            breakToNewPage();
        }

        const itemX = col === 0 ? MARGIN : MARGIN + colW + 8;
        let drawY = cols === 2 ? colY[col] : cy;

        // ── Question number (inline with clue) ───────────────────────
        doc.setFont(pdfFont, 'bold');
        doc.setFontSize(9 * pScale);
        doc.setTextColor(100, 116, 139);
        doc.text(`${startNum + i}.`, itemX, drawY);

        // ── Clue text ────────────────────────────────────────────────
        // isFraction is true only when the clue fits on a single line AND
        // contains \frac — so long narrative fraction clues (e.g. probability
        // complementary questions) use the inline renderer which wraps text
        // and handles *emphasis* markers correctly.
        let clueEndY;
        const clueX = itemX + 9;
        if (isFraction) {
            // Auto-bold the leading verb so fraction clues emphasise it the same
            // way the inline renderer does (drawFractionClue honours ** markers).
            const r = drawFractionClue(doc, autoBoldVerb(item.clue || ''), clueX, drawY, {
                fontSizePt: 9 * pScale, pdfFont, color: [15, 23, 42],
            });
            clueEndY = drawY + r.belowBaseline + 1;
        } else {
            // Inline renderer: switches to bold/italic for **word** / *word* markers
            const lastLineY = _drawClueInline(doc, item.clue || '', clueX, drawY,
                colW - 14, 9 * pScale, pdfFont, [15, 23, 42], 4.5 * pScale);
            clueEndY = lastLineY + 1.5 * pScale;  // small cap-height clearance
        }

        let nextY = clueEndY + SECTION_PAD;

        // ── Geometry diagram ─────────────────────────────────────────
        if (hasDiagram) {
            _drawDiagramInPDF(doc, item.diagram, itemX + 9, nextY, colW - 13, DIAG_H, pScale, pdfFont);
            nextY += DIAG_H + SECTION_PAD;
        }

        // ── Working area: 5 mm grid pitch for algebra alignment ─────
        if (workingCount > 0) {
            doc.setFont(pdfFont, 'normal');
            doc.setFontSize(6.5 * pScale);
            doc.setTextColor(160, 170, 185);
            doc.text('Working', clueX, nextY);
            nextY += SECTION_PAD;
            for (let wl = 0; wl < workingCount; wl++) {
                nextY += workingLineSpacing;
                doc.setDrawColor(215, 222, 235);
                doc.setLineWidth(0.2);
                doc.setLineDashPattern([0.5, 1.5], 0);
                doc.line(clueX, nextY, itemX + colW - 4, nextY);
                doc.setLineDashPattern([], 0);
            }
            nextY += SECTION_PAD;
        }

        // ── Answer line: right-aligned marking track ─────────────────
        const lineY = nextY + answerLineSpacing;
        doc.setFont(pdfFont, 'normal');
        doc.setFontSize(8 * pScale);
        doc.setTextColor(100, 116, 139);
        // item.unit is only populated for Easy measurement questions in
        // the generator; printing it as a hint after the answer line tells
        // students whether to write cm² / m / ° / etc.
        const unitText  = item.unit ? ` ${latexToText(item.unit)}` : '';
        const unitW     = unitText ? doc.getTextWidth(unitText) + 1 : 0;
        // Right edge of the line is the column edge; label sits to the
        // left of a fixed-length track so teachers can scan answers in a
        // consistent vertical "rail" down the page.
        const rightEdge   = itemX + colW - 4 - unitW;
        const trackLength = Math.min(46 * pScale, colW - 26 - unitW);
        const trackStart  = rightEdge - trackLength;
        doc.text('Answer:', trackStart - 2, lineY, { align: 'right' });
        doc.setDrawColor(150, 160, 180);
        doc.setLineWidth(0.4);
        doc.setLineDashPattern([0.8, 1.2], 0);
        doc.line(trackStart, lineY, rightEdge, lineY);
        doc.setLineDashPattern([], 0);
        if (unitText) {
            doc.setFont(pdfFont, 'bold');
            doc.setFontSize(8 * pScale);
            doc.setTextColor(100, 116, 139);
            doc.text(unitText.trim(), rightEdge + 1.5, lineY);
        }
        nextY = lineY + SECTION_PAD;

        // ── Meta row: topic pill + outcome chips, centered in column ──
        // Muted styling — these chips are administrative metadata and
        // should not compete with the question text.
        if (hasMeta) {
            nextY += 2 * pScale;
            const chipH = 3.5 * pScale;
            const gap   = 2;
            // Build ordered pill list: topic first, then outcome chips
            const pills = [];
            if (showTopic && item.topic) {
                const topicRgb = TOPIC_COLOURS_RGB[item.topic] || [100, 116, 139];
                doc.setFont(pdfFont, 'normal');
                doc.setFontSize(6 * pScale);
                const tw = doc.getTextWidth(item.topic.toUpperCase()) + 4;
                pills.push({ text: item.topic.toUpperCase(), w: tw, rgb: topicRgb, style: 'topic' });
            }
            if (itemCodes.length > 0) {
                doc.setFont(pdfFont, 'bold');
                doc.setFontSize(chipFontPt);
                itemCodes.forEach(code => {
                    pills.push({ text: code, w: doc.getTextWidth(code) + 4, style: 'chip' });
                });
            }
            // Wrap pills into rows, then center each row in the column
            const colCenterX = itemX + colW / 2;
            const maxRowW    = colW - 4;
            const pillRows = [];
            let curRow = [], curRowW = 0;
            for (const p of pills) {
                const needed = curRowW > 0 ? gap + p.w : p.w;
                if (curRowW > 0 && curRowW + gap + p.w > maxRowW) {
                    pillRows.push(curRow);
                    curRow  = [p];
                    curRowW = p.w;
                } else {
                    curRow.push(p);
                    curRowW += needed;
                }
            }
            if (curRow.length > 0) pillRows.push(curRow);
            // Draw each row centered
            for (const r of pillRows) {
                const totalW = r.reduce((s, p) => s + p.w, 0) + gap * (r.length - 1);
                let px = colCenterX - totalW / 2;
                for (const p of r) {
                    const pillTop = nextY - 2.5 * pScale;
                    if (p.style === 'topic') {
                        doc.setFont(pdfFont, 'normal');
                        doc.setFontSize(6 * pScale);
                        doc.setFillColor(
                            Math.round(255 * 0.88 + p.rgb[0] * 0.12),
                            Math.round(255 * 0.88 + p.rgb[1] * 0.12),
                            Math.round(255 * 0.88 + p.rgb[2] * 0.12)
                        );
                        doc.roundedRect(px, pillTop, p.w, chipH, 1, 1, 'F');
                        doc.setDrawColor(...p.rgb);
                        doc.setLineWidth(0.2);
                        doc.roundedRect(px, pillTop, p.w, chipH, 1, 1, 'S');
                        doc.setTextColor(...p.rgb);
                        doc.text(p.text, px + 2, nextY);
                    } else {
                        // Outcome code chip — neutral slate so it reads as
                        // metadata, not a coloured callout.
                        doc.setFont(pdfFont, 'normal');
                        doc.setFontSize(chipFontPt);
                        doc.setFillColor(243, 245, 250);
                        doc.roundedRect(px, pillTop, p.w, chipH, 1, 1, 'F');
                        doc.setDrawColor(210, 218, 230);
                        doc.setLineWidth(0.15);
                        doc.roundedRect(px, pillTop, p.w, chipH, 1, 1, 'S');
                        doc.setTextColor(120, 130, 150);
                        doc.text(p.text, px + 2, nextY);
                    }
                    px += p.w + gap;
                }
                nextY += chipH + 1;
            }
            nextY -= 1;  // remove trailing inter-row gap
        }

        const actualItemH = nextY - drawY + itemGap;

        if (cols === 2) {
            colY[col] += actualItemH;
            // Track the deepest column for divider/page-break geometry.
            cy = Math.max(colY[0], colY[1]);
        } else {
            cy += actualItemH;
        }
    }

    // Final page: draw the divider down to the deepest column extent.
    if (cols === 2) {
        const dividerEnd = Math.max(colY[0], colY[1]);
        _drawColumnDivider(doc, MARGIN, colW, pageStartY, dividerEnd);
    }

    // Score footer — right-aligned "Score: ___ / N = ___ %"
    const placedCount = questions.length - overflowCount;
    _drawScoreLine(doc, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - MARGIN - 3 * pScale,
        'Score:', placedCount, {
            fontPt:    7.5 * pScale,
            blankW:    18 * pScale,
            gap:        3 * pScale,
            color:     [120, 130, 150],
            lineColor: [150, 160, 180],
            pdfFont,
        });

    drawExportIdFooter(ctx, exportId, pScale);
    return overflowCount;
}

function _drawColumnDivider(doc, MARGIN, colW, fromY, toY) {
    doc.setDrawColor(200, 205, 220);
    doc.setLineWidth(0.6);
    doc.setLineDashPattern([], 0);
    doc.line(MARGIN + colW + 4, fromY, MARGIN + colW + 4, toY);
}


/**
 * Draw the answer key page showing all 3 difficulty sets.
 */
function drawKeyPage(ctx, sets, startY, pScale, exportId, startNums = {}) {
    const { doc, PAGE_WIDTH, PAGE_HEIGHT, MARGIN, scale, pdfFont } = ctx;
    pScale = pScale || scale;

    const cfg              = state.settings;
    const showOutcomesHdr  = cfg.psShowOutcomesHeader  || false;
    const stage            = state.stage ?? 'Stage 4';
    const availW           = PAGE_WIDTH - MARGIN * 2;

    let cy = startY;

    // ── Outcomes summary header (only on key page) ────────────
    if (showOutcomesHdr) {
        const activeTopics = Object.keys(state.selectedTopics).filter(t => state.selectedTopics[t]);
        const outcomes = getOutcomesForTopics(activeTopics, stage);
        if (outcomes.length > 0) {
            const headerPad  = 2.5 * pScale;
            const lineH      = 4.2 * pScale;
            const titleH     = 5 * pScale;
            const descFontPt = 6 * pScale;

            // Pass 1: pre-compute per-row data so we can size the border rect correctly
            doc.setFont(pdfFont, 'bold');
            doc.setFontSize(descFontPt);
            const rows = outcomes.map(o => {
                const codeW    = doc.getTextWidth(o.code) + 4;
                const descText = `${o.contentLabel} — ${o.statement}`;
                const descW    = availW - headerPad * 2 - codeW - 3;
                doc.setFont(pdfFont, 'normal');
                doc.setFontSize(descFontPt);
                const lines = doc.splitTextToSize(descText, descW);
                doc.setFont(pdfFont, 'bold');
                doc.setFontSize(descFontPt);
                return { o, codeW, descText, descW, lines };
            });
            const totalH = titleH + rows.reduce((s, r) => s + r.lines.length * lineH, 0) + headerPad * 2;

            doc.setDrawColor(99, 102, 241);
            doc.setLineWidth(0.3);
            doc.roundedRect(MARGIN, cy, availW, totalH, 2, 2, 'S');

            doc.setFont(pdfFont, 'bold');
            doc.setFontSize(6.5 * pScale);
            doc.setTextColor(99, 102, 241);
            doc.text(`NESA ${stage} Outcomes`, MARGIN + headerPad, cy + headerPad + 3.5 * pScale);

            // Pass 2: draw each row
            let oy = cy + headerPad + titleH;
            rows.forEach(({ o, codeW, lines }) => {
                const isWM      = o.appliesAll;
                const pillColor = isWM ? [22, 163, 74] : [99, 102, 241];

                doc.setFont(pdfFont, 'bold');
                doc.setFontSize(descFontPt);
                doc.setFillColor(isWM ? 240 : 239, isWM ? 253 : 238, isWM ? 244 : 255);
                doc.roundedRect(MARGIN + headerPad, oy - 2.8 * pScale, codeW, 3.5 * pScale, 1, 1, 'F');
                doc.setTextColor(...pillColor);
                doc.text(o.code, MARGIN + headerPad + 1.5, oy);

                const descX = MARGIN + headerPad + codeW + 3;
                doc.setFont(pdfFont, 'normal');
                doc.setFontSize(descFontPt);
                doc.setTextColor(80, 90, 110);
                lines.forEach((line, li) => doc.text(line, descX, oy + li * lineH));

                oy += lines.length * lineH;
            });

            cy += totalH + 5 * pScale;
        }
    }

    const sections = [
        { key: 'Easy',   rgb: DIFF_RGB.Easy,   questions: sets.easy   || [] },
        { key: 'Medium', rgb: DIFF_RGB.Medium,  questions: sets.medium || [] },
        { key: 'Hard',   rgb: DIFF_RGB.Hard,    questions: sets.hard   || [] },
    ].filter(s => s.questions.length > 0);

    if (sections.length === 0) { drawExportIdFooter(ctx, exportId, pScale); return; }

    const colW = (availW - (sections.length - 1) * 6) / sections.length;

    sections.forEach((sec, si) => {
        const cx = MARGIN + si * (colW + 6);

        // Section title — use drawText() so emoji renders via canvas fallback
        const icon  = DIFF_ICONS[sec.key] || '';
        const label = `${icon} ${sec.key.toUpperCase()}`;
        drawText(doc, label, cx, cy, {
            fontSizePt: 9 * pScale, bold: true, color: sec.rgb, pdfFont,
        });
        doc.setDrawColor(...sec.rgb);
        doc.setLineWidth(0.4);
        doc.line(cx, cy + 2 * scale, cx + colW, cy + 2 * scale);

        let ky = cy + 8 * pScale;

        const showWorkedPDF = cfg.keyShowWorked || false;
        // Reserve a fixed right-hand strip for the answer so all answers
        // align in a vertical "marking rail" and clue text wraps cleanly
        // to the left of it instead of being truncated with an ellipsis.
        const ansStripW = Math.max(18 * pScale, colW * 0.32);
        const clueW     = colW - ansStripW - 3;
        const lineH     = 3.4 * pScale;
        // First question number for this section — keeps the key's numbering
        // continuous across difficulties, matching the worksheet pages.
        const secStart  = startNums[sec.key] || 1;

        sec.questions.forEach((q, i) => {
            if (ky + 6 * pScale > PAGE_HEIGHT - MARGIN - 12 * pScale) return;

            // Plain text for width measurement / shown-line count (the rich
            // drawer below does its own wrapping but we still need a count
            // for the answer-row vertical layout below).
            const clueText = latexToText(q.clue || '');
            const ansText  = latexToText(String(q.answerDisplay || q.answer || ''));

            doc.setFont(pdfFont, 'normal');
            doc.setFontSize(7 * pScale);
            doc.setTextColor(100, 116, 139);
            const qNum = secStart + i;
            const clueLines = doc.splitTextToSize(`${qNum}. ${clueText}`, clueW);
            // Cap at 3 wrapped lines so a freak long clue can't blow up a key page.
            const shownCount = Math.min(clueLines.length, 3);

            // Bold verb + *italic* emphasis + **bold** — matches the HTML answer key
            // and the PDF problem-set body.
            _drawKeyClueRich(doc, `${qNum}. `, q.clue || '', cx, ky, {
                maxW: clueW, lineH, fontSizePt: 7 * pScale, pdfFont,
                color: [100, 116, 139], maxLines: 3,
            });
            const shown = { length: shownCount };

            doc.setFont(pdfFont, 'bold');
            doc.setFontSize(8 * pScale);
            doc.setTextColor(...sec.rgb);
            doc.text(ansText, cx + colW, ky, { align: 'right' });

            let blockH = Math.max(shown.length * lineH, 5 * pScale);

            // Worked solution — shown when "Show worked" is toggled on.
            // Normal weight (not italic): the custom fonts ship only normal+bold,
            // so italic would fall back inconsistently — distinction comes from
            // the slate colour and indent instead.
            if (showWorkedPDF && q.worked) {
                const workedText = latexToText(q.worked);
                doc.setFont(pdfFont, 'normal');
                doc.setFontSize(6.5 * pScale);
                doc.setTextColor(71, 85, 105);          // slate-600 — legible
                const workedLines = doc.splitTextToSize(workedText, colW - 4).slice(0, 2);
                workedLines.forEach((line, li) => doc.text(line, cx + 2, ky + blockH + li * 3.3 * pScale));
                blockH += workedLines.length * 3.3 * pScale + 1;
            }

            doc.setDrawColor(220, 220, 220);
            doc.setLineWidth(0.1);
            doc.line(cx, ky + blockH - 0.5, cx + colW, ky + blockH - 0.5);

            ky += blockH + 1.4 * pScale;
        });

        // Per-section score sits directly under the last question in this
        // column so each "/ N" reads as the marker for the column above it.
        // Clamp so it can't collide with the centered TOTAL row at the very
        // bottom of the page.
        const secTotal     = sec.questions.length;
        const scoreFontPt  = 7   * pScale;
        const scoreBlankW  = 14  * pScale;
        const maxScoreY    = PAGE_HEIGHT - MARGIN - 9 * pScale;
        const sectionRowY  = Math.min(ky + 3 * pScale, maxScoreY);
        doc.setDrawColor(...sec.rgb); doc.setLineWidth(0.3); doc.setLineDashPattern([0.5, 1], 0);
        doc.line(cx, sectionRowY, cx + scoreBlankW, sectionRowY);
        doc.setLineDashPattern([], 0);
        doc.setFont(pdfFont, 'bold'); doc.setFontSize(scoreFontPt); doc.setTextColor(...sec.rgb);
        doc.text(`/ ${secTotal}`, cx + scoreBlankW + 2, sectionRowY);
    });

    // Overall total: "TOTAL: ___ / N = ___ %", right-aligned to the page edge
    const totalQ = sections.reduce((s, sec) => s + sec.questions.length, 0);
    _drawScoreLine(doc, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - MARGIN - 3 * pScale,
        'TOTAL:', totalQ, {
            fontPt:    8 * pScale,
            blankW:   18 * pScale,
            gap:       3 * pScale,
            color:     [80, 90, 110],
            lineColor: [120, 130, 150],
            pdfFont,
        });

    drawExportIdFooter(ctx, exportId, pScale);
}

export async function exportPDF() {
    if (isExporting) return;

    syncSettingsFromDOM();

    const activeTopics = Object.keys(state.selectedTopics).filter(t => state.selectedTopics[t]);
    if (activeTopics.length === 0) {
        showToast('Select at least one topic to export.', 'error');
        return;
    }

    isExporting = true;
    const exportBtn = document.getElementById('export-btn-main');
    const exportBtnOrigHTML = exportBtn ? exportBtn.innerHTML : '';
    if (exportBtn) {
        exportBtn.disabled = true;
        exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating…';
    }

    const cfg = state.settings;
    const pageOrder   = cfg.pageOrder || ['easy', 'medium', 'hard', 'key'];
    const selections  = cfg.opts;
    const selectedPages = pageOrder.filter(p => selections[p]);

    if (selectedPages.length === 0) {
        showToast('Select at least one page.', 'error');
        isExporting = false;
        if (exportBtn) { exportBtn.disabled = false; exportBtn.innerHTML = exportBtnOrigHTML; }
        return;
    }

    const diffInPDF = ['easy', 'medium', 'hard'].filter(p => selectedPages.includes(p));
    if (diffInPDF.length < 3) {
        const skipped = ['Easy', 'Medium', 'Hard'].filter((_, i) => !diffInPDF.includes(['easy', 'medium', 'hard'][i]));
        showToast(`PDF will only include ${diffInPDF.map(d => d[0].toUpperCase() + d.slice(1)).join(' + ')} difficulty. Uncheck fix: Page Order → tick ${skipped.join(', ')}.`, 'warning');
    }

    const L = document.getElementById('loading-overlay');
    const T = document.getElementById('loading-text');
    const B = document.getElementById('loading-progress');

    const title    = cfg.title || 'Maths Quiz';
    const sub      = cfg.sub   || '';
    // Clamp the requested bulk count to the universal hard ceiling and tier limit.
    const count    = (() => {
        const el = document.getElementById('bulkCount');
        const raw = el ? Math.max(1, parseInt(el.value, 10) || 1) : 1;
        const ceiling = Math.min(raw, FREE_LIMITS.BULK_EXPORT_MAX);
        const clamped = clampBulkExportCount(ceiling);
        if (clamped < raw) {
            const msg = clamped < ceiling
                ? `Bulk export limited to ${clamped} on the free plan.`
                : `Bulk export capped at ${FREE_LIMITS.BULK_EXPORT_MAX} copies.`;
            showToast(msg, 'warning');
        }
        return clamped;
    })();
    const filename = (() => { const el = document.getElementById('exportFilename'); return el ? el.value : 'MathsQuiz'; })()
        .replace(/[^a-z0-9-_]/gi, '_');

    if (L) { L.style.display = 'flex'; L.style.opacity = '1'; }
    if (T) T.innerText = 'Starting Export...';
    if (B) B.style.width = '0%';

    try {
        if (T) T.innerText = 'Loading PDF Engine...';
        const jspdfModule = await loadJSPDF();
        const { jsPDF } = jspdfModule;

        const paperSize = cfg.paperSize || 'a4';
        const isLetter  = paperSize === 'letter';
        const PAGE_WIDTH  = isLetter ? 215.9 : 210;
        const PAGE_HEIGHT = isLetter ? 279.4 : 297;
        const doc = new jsPDF({ unit: 'mm', format: paperSize, orientation: 'portrait' });
        const MARGIN = 15;

        const scale = parseFloat(cfg.globalFontScale) || 1;
        const getPScale = (key) => {
            const val = cfg.scales?.[key];
            return scale * (val !== undefined ? parseFloat(val) || 1 : 1);
        };

        let pdfFont = 'helvetica';

        let wmImg = null;
        if (state.watermarkSrc) {
            wmImg = await new Promise(res => {
                const img = new Image();
                const timeout = setTimeout(() => res(null), 8000);
                img.onload  = () => { clearTimeout(timeout); res(img); };
                img.onerror = () => { clearTimeout(timeout); res(null); };
                img.src = state.watermarkSrc;
            });
        }

        let ctx = buildCtx(doc, pdfFont, wmImg, scale, { PAGE_WIDTH, PAGE_HEIGHT, MARGIN }, cfg);

        const fontSelectVal = cfg.font || "'Inter', sans-serif";
        const fontName = FONT_SELECT_MAP[fontSelectVal];
        if (fontName) {
            if (T) T.innerText = 'Loading fonts...';
            try {
                const ok = await loadFontForPDF(doc, fontName, 400);
                if (ok) { await loadFontForPDF(doc, fontName, 700); pdfFont = fontName; }
            } catch (e) { console.warn('Unexpected font load error:', e); }
            if (pdfFont === 'helvetica') {
                showToast(`Couldn't load the "${fontName}" font — exporting with the standard PDF font instead.`, 'warning');
            }
        }
        ctx = buildCtx(doc, pdfFont, wmImg, scale, { PAGE_WIDTH, PAGE_HEIGHT, MARGIN }, cfg);

        // If we fell back to the standard (helvetica) font — e.g. the font CDN
        // was blocked — switch latexToText to ASCII-safe output so π, √ and
        // superscripts don't render as mojibake.
        setLatexAsciiFallback(pdfFont === 'helvetica');

        // Derive cap from pages-per-difficulty selector (state.questionsPerSet is 1 or 2)
        cfg.psCapPages = state.questionsPerSet || 1;

        let isFirstPage = true;
        // Capture the base seed once so all alternate sets are consistent
        // offsets of it, even if the loop yields to the event loop between iterations.
        const exportBase = cfg.previewSeed ?? Date.now();
        const pv = state.generatedSets;
        const havePreview = pv && (pv.easy?.length || pv.medium?.length || pv.hard?.length);

        for (let i = 0; i < count; i++) {
            if (T) T.innerText = `Generating Set ${i + 1}/${count}`;
            if (B) B.style.width = Math.round((i / count) * 100) + '%';
            await new Promise(r => setTimeout(r, 10));

            cfg.exportCount = (cfg.exportCount || 0) + 1;
            // Set #1 reuses the on-screen preview questions exactly (incl. rerolls
            // and locked slots); alternates are reproducible offsets of its seed.
            let sets, seed;
            if (i === 0 && havePreview) {
                sets = pv;
                seed = exportBase;
            } else {
                seed = exportBase + i * 1_000_000;
                sets = createQuestionSets(cfg, seed);
            }
            const exportId = makeExportId(seed);
            if (!sets) continue;

            const setIndicator = count > 1 ? `SET ${i + 1}` : '';

            const addPage = () => {
                if (!isFirstPage) doc.addPage();
                isFirstPage = false;
                ctx.drawWatermark();
            };

            // Optional formula reference sheet — one page per set, prepended before question pages
            if (cfg.showFormulaSheet) {
                addPage();
                const ps = getPScale('easy');
                drawFormulaSheet(ctx, activeTopics, ps);
            }

            // Track visible question counts per difficulty.
            // Pages not in selectedPages default to 0 so their answers are excluded from the key.
            const visibleCounts = {
                easy:   selectedPages.includes('easy')   ? null : 0,
                medium: selectedPages.includes('medium') ? null : 0,
                hard:   selectedPages.includes('hard')   ? null : 0,
            };

            // Continuous numbering across difficulties (Easy 1.., Medium n+1..,
            // Hard ..). Computed canonically (easy→medium→hard) from visible
            // counts; falls back to full length for a difficulty not yet drawn
            // (only matters under a non-default page order). The answer key
            // uses the same helper so its numbers match the worksheet.
            const startNumFor = (diff) => {
                const cnt = (k) => visibleCounts[k] ?? (sets[k] || []).length;
                if (diff === 'easy')   return 1;
                if (diff === 'medium') return 1 + cnt('easy');
                return 1 + cnt('easy') + cnt('medium');   // hard
            };

            for (const pType of selectedPages) {
                await new Promise(r => setTimeout(r, 0));

                if (pType === 'easy') {
                    addPage();
                    const ps = getPScale('easy');
                    const sy = drawHeader(ctx, title, sub, '🌱 EASY — SOLVE EACH PROBLEM AND WRITE YOUR ANSWER.', false, setIndicator, ps, exportId, [16, 185, 129]);
                    const overflow = drawQuestionPage(ctx, sets.easy, sy, ps, exportId, startNumFor('easy'));
                    visibleCounts.easy = (sets.easy || []).length - overflow;

                } else if (pType === 'medium') {
                    addPage();
                    const ps = getPScale('medium');
                    const sy = drawHeader(ctx, title, sub, '⚡ MEDIUM — SOLVE EACH PROBLEM AND WRITE YOUR ANSWER.', false, setIndicator, ps, exportId, [245, 158, 11]);
                    const overflow = drawQuestionPage(ctx, sets.medium, sy, ps, exportId, startNumFor('medium'));
                    visibleCounts.medium = (sets.medium || []).length - overflow;

                } else if (pType === 'hard') {
                    addPage();
                    const ps = getPScale('hard');
                    const sy = drawHeader(ctx, title, sub, '🔥 HARD — SOLVE EACH PROBLEM AND WRITE YOUR ANSWER.', false, setIndicator, ps, exportId, [239, 68, 68]);
                    const overflow = drawQuestionPage(ctx, sets.hard, sy, ps, exportId, startNumFor('hard'));
                    visibleCounts.hard = (sets.hard || []).length - overflow;

                } else if (pType === 'key') {
                    addPage();
                    const ps = getPScale('key');
                    const sy = drawHeader(ctx, title, sub, 'ANSWER KEY', true, setIndicator, ps, exportId);
                    // Always trim answer key to only questions that were rendered on question pages
                    const keySets = {
                        easy:   (sets.easy   || []).slice(0, visibleCounts.easy   ?? (sets.easy   || []).length),
                        medium: (sets.medium || []).slice(0, visibleCounts.medium ?? (sets.medium || []).length),
                        hard:   (sets.hard   || []).slice(0, visibleCounts.hard   ?? (sets.hard   || []).length),
                    };
                    const keyStartNums = {
                        Easy:   startNumFor('easy'),
                        Medium: startNumFor('medium'),
                        Hard:   startNumFor('hard'),
                    };
                    drawKeyPage(ctx, keySets, sy, ps, exportId, keyStartNums);
                }
            }
        }

        if (T) T.innerText = 'Saving PDF...';
        if (B) B.style.width = '100%';
        await new Promise(r => setTimeout(r, 100));

        doc.save(filename + '.pdf');

        const pagesPerDiff = state.questionsPerSet || 1;
        const diffPagesPerCopy = ['easy', 'medium', 'hard'].filter(t => selectedPages.includes(t)).length * pagesPerDiff;
        const keyPagesPerCopy = selectedPages.includes('key') ? 1 : 0;
        const totalPages = count * (diffPagesPerCopy + keyPagesPerCopy);
        const copyMsg = count === 1 ? '1 copy' : `${count} copies`;
        const pageMsg = totalPages === 1 ? '1 page' : `${totalPages} pages`;
        showToast(`Exported ${copyMsg} · ${pageMsg}`, 'success');

    } catch (e) {
        console.error(e);
        const detail = (e && e.message) ? `: ${e.message}` : '';
        showToast(`PDF export failed${detail}`, 'error');
    } finally {
        isExporting = false;
        if (exportBtn) {
            exportBtn.disabled = false;
            exportBtn.innerHTML = exportBtnOrigHTML;
        }
        if (L) { L.style.opacity = '0'; setTimeout(() => L.style.display = 'none', 300); }
    }
}
