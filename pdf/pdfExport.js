// =============================================================
// pdf/pdfExport.js — PDF export orchestrator (Maths Question Sets Edition)
// =============================================================
import { state, syncSettingsFromDOM } from '../core/state.js';
import { showToast } from '../ui/toast.js';
import { generateMathsQuestions } from '../generators/mathsQuestionGen.js';
import { loadJSPDF, loadFontForPDF, FONT_SELECT_MAP } from './pdfFonts.js';
import { buildCtx, drawHeader, drawExportIdFooter, makeExportId, latexToText, hasFraction, drawFractionClue, drawText } from './pdfHelpers.js';
// PAYMENTS: import access helpers — replace session.js backend stub when server is ready
import { clampBulkExportCount, FREE_LIMITS } from '../payments/access.js';
import { getOutcomesForTopics, getTopicOutcomeCodes, DEFAULT_STAGE } from '../core/outcomes.js';

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

function _drawRectDiagramPDF(doc, { l, w: wv }, x0, y0, w, h, ps, font) {
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
    doc.text(String(l), rx + dw / 2, ry + dh + _LBL_OFFSET + 1.5 * ps, { align: 'center' });

    // Width label (left of the rectangle) — clear of left edge
    doc.text(String(wv), rx - _LBL_OFFSET, ry + dh / 2 + 1.2 * ps, { align: 'right' });

    // Missing "?" in centre
    doc.setFont(font, 'bold');
    doc.setFontSize(10 * ps);
    doc.setTextColor(..._MC);
    doc.text('?', rx + dw / 2, ry + dh / 2 + 1.8 * ps, { align: 'center' });
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

    const aLabel = missing === 'a' ? '?' : String(a);
    const bLabel = missing === 'b' ? '?' : String(b);
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
    doc.setFont(font, 'bold');
    doc.setFontSize(9.5 * ps);
    doc.setTextColor(..._MC);
    doc.text(missText, cx + rPx + _LBL_OFFSET + 2 * ps, cy + 1.5 * ps, { align: 'left' });
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
    // Reset dash + line state before drawing
    doc.setLineDashPattern([], 0);
    switch (diagram.type) {
        case 'rectangle':       _drawRectDiagramPDF(doc, diagram, x0, y0, w, h, ps, font); break;
        case 'right-triangle':  _drawRightTriDiagramPDF(doc, diagram, x0, y0, w, h, ps, font); break;
        case 'triangle-angles': _drawTriAnglesDiagramPDF(doc, diagram, x0, y0, w, h, ps, font); break;
        case 'triangle-area':   _drawTriAreaDiagramPDF(doc, diagram, x0, y0, w, h, ps, font); break;
        case 'circle':          _drawCircleDiagramPDF(doc, diagram, x0, y0, w, h, ps, font); break;
    }
    // Restore defaults
    doc.setLineDashPattern([], 0);
    doc.setTextColor(15, 23, 42);
    doc.setDrawColor(100, 116, 139);
    doc.setFillColor(255, 255, 255);
}

const TOPIC_COLOURS_RGB = {
    'Number': [59, 130, 246], 'Algebra': [139, 92, 246], 'Geometry': [16, 185, 129],
    'Statistics': [245, 158, 11], 'Financial Maths': [239, 68, 68],
    'Integers': [59, 130, 246], 'Decimals': [59, 130, 246], 'Rounding': [59, 130, 246],
    'Fractions': [59, 130, 246], 'Percentages': [59, 130, 246],
};

// Diff icons (Unicode) — emoji go via canvas fallback in drawText().
// Ordered to match the project's seedling/bolt/fire convention.
const DIFF_ICONS = { Easy: '🌱', Medium: '⚡', Hard: '🔥' };

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
    // Convert LaTeX regions to unicode first, keeping emphasis markers
    const withLatex = latexToText(
        clue.replace(/\*\*([^*]+)\*\*/g, '\x01$1\x01')  // protect ** with control chars
            .replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1\x02$2\x02')  // protect * with control chars
    )
    .replace(/\x01([^\x01]*)\x01/g, '**$1**')   // restore bold markers
    .replace(/\x02([^\x02]*)\x02/g, '*$1*');    // restore italic markers

    const segs = _parseEmphasisSegments(withLatex);
    let curX = x, curY = y;

    for (const seg of segs) {
        // Italic only works natively for Helvetica; custom fonts only have normal/bold
        const style = seg.bold ? 'bold'
            : (seg.italic && pdfFont === 'helvetica' ? 'italic' : 'normal');
        doc.setFont(pdfFont, style);
        doc.setFontSize(fontSizePt);
        doc.setTextColor(...color);

        // Split segment into tokens (words + spaces) to support mid-segment wrapping
        const tokens = seg.t.match(/\S+|\s+/g) || [];
        for (const token of tokens) {
            const tw = doc.getTextWidth(token);
            if (token.trim() === '') {
                curX += tw;
                continue;
            }
            if (curX + tw > x + maxW + 0.5 && curX > x) {
                curY += lineH;
                curX  = x;
                doc.setFont(pdfFont, style);  // re-apply after Y advance
            }
            doc.text(token, curX, curY);
            curX += tw;
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
    return {
        easy:   generateMathsQuestions({ subTopics: topics, subOpsFilter, difficulty: 'Easy',   count: n, seed,         showFormulas }),
        medium: generateMathsQuestions({ subTopics: topics, subOpsFilter, difficulty: 'Medium', count: n, seed: seed+1, showFormulas }),
        hard:   generateMathsQuestions({ subTopics: topics, subOpsFilter, difficulty: 'Hard',   count: n, seed: seed+2, showFormulas }),
    };
}

/**
 * Draw a question page (Easy / Medium / Hard) in PDF.
 * Returns the number of questions that did NOT fit (overflow count).
 */
function drawQuestionPage(ctx, questions, startY, pScale, exportId) {
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
    const stage              = DEFAULT_STAGE;
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
    let rowMaxH     = 0;
    let overflowCount = 0;
    let pagesUsed   = 1;
    let pageStartY  = startY;   // Y where content begins on the current PDF page

    doc.setFont(pdfFont, 'normal');
    doc.setFontSize(9 * pScale);

    for (let i = 0; i < questions.length; i++) {
        const item = questions[i];

        // Pre-calculate item height to decide whether it fits.
        // Fraction clues need 3 line-heights (numerator + bar + denominator).
        // Reset clue font before splitTextToSize — prior iterations change doc font state,
        // which would cause the width calculation to use wrong glyph metrics.
        doc.setFont(pdfFont, 'normal');
        doc.setFontSize(9 * pScale);
        const clueText   = latexToText(item.clue || '');
        const isFraction = hasFraction(item.clue);
        const clueLines  = isFraction
            ? [clueText]
            : doc.splitTextToSize(clueText, colW - 14);
        const clueBlockH = isFraction
            ? 3 * 4.5 * pScale
            : clueLines.length * 4.5 * pScale;

        const workingCount = item.difficulty === 'Hard' ? 2 : item.difficulty === 'Medium' ? 1 : 0;
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

        // Choose shortest column (2-col), then check whether even that
        // column can fit the item before deciding to break to a new page.
        if (cols === 2) {
            col = colY[0] <= colY[1] ? 0 : 1;
        }
        const wouldOverflow = cols === 2
            ? (Math.min(colY[0], colY[1]) + itemH > PAGE_HEIGHT - MARGIN - 10)
            : (cy + itemH > PAGE_HEIGHT - MARGIN - 10);

        if (wouldOverflow) {
            if (capPages > 0 && pagesUsed >= capPages) {
                overflowCount = questions.length - i;
                break;
            }
            pagesUsed++;
            // Draw divider for this page before flipping to next.
            // Use the deepest column as the divider's bottom so the rule
            // matches the visible content extent on this page.
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
            rowMaxH    = 0;
        }

        const itemX = col === 0 ? MARGIN : MARGIN + colW + 8;
        let drawY = cols === 2 ? colY[col] : cy;

        // ── Question number (inline with clue) ───────────────────────
        doc.setFont(pdfFont, 'bold');
        doc.setFontSize(9 * pScale);
        doc.setTextColor(100, 116, 139);
        doc.text(`${i + 1}.`, itemX, drawY);

        // ── Clue text ────────────────────────────────────────────────
        let clueEndY;
        const clueX = itemX + 9;
        if (hasFraction(item.clue)) {
            const r = drawFractionClue(doc, item.clue || '', clueX, drawY, {
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
        // Right edge of the line is the column edge; label sits to the
        // left of a fixed-length track so teachers can scan answers in a
        // consistent vertical "rail" down the page.
        const rightEdge   = itemX + colW - 4;
        const trackLength = Math.min(46 * pScale, colW - 26);
        const trackStart  = rightEdge - trackLength;
        doc.text('Answer:', trackStart - 2, lineY, { align: 'right' });
        doc.setDrawColor(150, 160, 180);
        doc.setLineWidth(0.4);
        doc.setLineDashPattern([0.8, 1.2], 0);
        doc.line(trackStart, lineY, rightEdge, lineY);
        doc.setLineDashPattern([], 0);
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

    // Score footer — students fill in mark and percentage
    const placedCount = questions.length - overflowCount;
    const scoreY = PAGE_HEIGHT - MARGIN - 3 * pScale;
    doc.setFont(pdfFont, 'bold');
    doc.setFontSize(7.5 * pScale);
    doc.setTextColor(120, 130, 150);
    const scoreLabel = `Score:`;
    const scoreSep   = `/ ${placedCount}  =`;
    const scorePct   = `%`;
    const blankW     = 18 * pScale;
    const scoreGap   =  3 * pScale;

    // Right-aligned block: "Score: ___ / N = ___ %"
    let sx = PAGE_WIDTH - MARGIN;
    doc.text(scorePct, sx, scoreY); sx -= doc.getTextWidth(scorePct) + scoreGap;
    // Blank for percentage
    doc.setDrawColor(150, 160, 180); doc.setLineWidth(0.3); doc.setLineDashPattern([0.5,1],0);
    doc.line(sx - blankW, scoreY, sx, scoreY); sx -= blankW + scoreGap;
    doc.setLineDashPattern([], 0);
    doc.setFont(pdfFont, 'bold'); doc.setFontSize(7.5 * pScale); doc.setTextColor(120, 130, 150);
    doc.text(scoreSep, sx, scoreY, { align: 'right' }); sx -= doc.getTextWidth(scoreSep) + scoreGap;
    // Blank for score
    doc.setDrawColor(150, 160, 180); doc.setLineWidth(0.3); doc.setLineDashPattern([0.5,1],0);
    doc.line(sx - blankW, scoreY, sx, scoreY); sx -= blankW + scoreGap;
    doc.setLineDashPattern([], 0);
    doc.text(scoreLabel, sx, scoreY, { align: 'right' });

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
function drawKeyPage(ctx, sets, startY, pScale, exportId) {
    const { doc, PAGE_WIDTH, PAGE_HEIGHT, MARGIN, scale, pdfFont } = ctx;
    pScale = pScale || scale;

    const cfg              = state.settings;
    const showOutcomesHdr  = cfg.psShowOutcomesHeader  || false;
    const stage            = DEFAULT_STAGE;
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

        // Reserve a fixed right-hand strip for the answer so all answers
        // align in a vertical "marking rail" and clue text wraps cleanly
        // to the left of it instead of being truncated with an ellipsis.
        const ansStripW = Math.max(18 * pScale, colW * 0.32);
        const clueW     = colW - ansStripW - 3;
        const lineH     = 3.4 * pScale;

        sec.questions.forEach((q, i) => {
            if (ky + 6 * pScale > PAGE_HEIGHT - MARGIN - 12 * pScale) return;

            const clueText = latexToText(q.clue || '');
            const ansText  = String(q.answerDisplay || q.answer || '');

            doc.setFont(pdfFont, 'normal');
            doc.setFontSize(7 * pScale);
            doc.setTextColor(100, 116, 139);
            const clueLines = doc.splitTextToSize(`${i + 1}. ${clueText}`, clueW);
            // Cap at 3 wrapped lines so a freak long clue can't blow up
            // a key page; the rest is still summarised, not silently cut.
            const shown = clueLines.slice(0, 3);
            if (clueLines.length > shown.length) {
                shown[shown.length - 1] = shown[shown.length - 1].replace(/.{0,2}$/, '…');
            }
            shown.forEach((line, li) => doc.text(line, cx, ky + li * lineH));

            doc.setFont(pdfFont, 'bold');
            doc.setFontSize(8 * pScale);
            doc.setTextColor(...sec.rgb);
            doc.text(ansText, cx + colW, ky, { align: 'right' });

            const blockH = Math.max(shown.length * lineH, 5 * pScale);
            doc.setDrawColor(220, 220, 220);
            doc.setLineWidth(0.1);
            doc.line(cx, ky + blockH - 0.5, cx + colW, ky + blockH - 0.5);

            ky += blockH + 1.4 * pScale;
        });

        // Per-section score footer: ___ / N
        const secTotal = sec.questions.length;
        const scoreStr = `/ ${secTotal}`;
        const scoreFontPt = 7.5 * pScale;
        const scoreBlankW = 16 * pScale;
        const scoreBottom = PAGE_HEIGHT - MARGIN - 3 * pScale;
        doc.setDrawColor(...sec.rgb); doc.setLineWidth(0.3); doc.setLineDashPattern([0.5, 1], 0);
        doc.line(cx, scoreBottom, cx + scoreBlankW, scoreBottom);
        doc.setLineDashPattern([], 0);
        doc.setFont(pdfFont, 'bold'); doc.setFontSize(scoreFontPt); doc.setTextColor(...sec.rgb);
        doc.text(scoreStr, cx + scoreBlankW + 2, scoreBottom);
    });

    // Overall total: ___ / N_total = ___% — centered below all columns
    const totalQ    = sections.reduce((s, sec) => s + sec.questions.length, 0);
    const totalY    = PAGE_HEIGHT - MARGIN - 3 * pScale;
    const totalFontPt = 7.5 * pScale;
    const totalBlankW = 18 * pScale;
    const totalX    = PAGE_WIDTH / 2;

    doc.setFont(pdfFont, 'bold'); doc.setFontSize(totalFontPt); doc.setTextColor(80, 90, 110);
    const totalLabel = `TOTAL:`;
    const totalSep   = `/ ${totalQ}  =`;
    const totalPct   = `%`;
    let tx = totalX - (doc.getTextWidth(totalLabel) + totalBlankW + 4 + doc.getTextWidth(totalSep) + totalBlankW + 4 + doc.getTextWidth(totalPct)) / 2;
    doc.text(totalLabel, tx, totalY); tx += doc.getTextWidth(totalLabel) + 4;
    doc.setDrawColor(150, 160, 180); doc.setLineWidth(0.3); doc.setLineDashPattern([0.5, 1], 0);
    doc.line(tx, totalY, tx + totalBlankW, totalY); tx += totalBlankW + 4;
    doc.setLineDashPattern([], 0);
    doc.setFont(pdfFont, 'bold'); doc.setFontSize(totalFontPt); doc.setTextColor(80, 90, 110);
    doc.text(totalSep, tx, totalY); tx += doc.getTextWidth(totalSep) + 4;
    doc.setDrawColor(150, 160, 180); doc.setLineWidth(0.3); doc.setLineDashPattern([0.5, 1], 0);
    doc.line(tx, totalY, tx + totalBlankW, totalY); tx += totalBlankW + 4;
    doc.setLineDashPattern([], 0);
    doc.setFont(pdfFont, 'bold'); doc.setFontSize(totalFontPt); doc.setTextColor(80, 90, 110);
    doc.text(totalPct, tx, totalY);

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
        }
        ctx = buildCtx(doc, pdfFont, wmImg, scale, { PAGE_WIDTH, PAGE_HEIGHT, MARGIN }, cfg);

        // Derive cap from pages-per-difficulty selector (state.questionsPerSet is 1 or 2)
        cfg.psCapPages = state.questionsPerSet || 1;

        let isFirstPage = true;

        for (let i = 0; i < count; i++) {
            if (T) T.innerText = `Generating Set ${i + 1}/${count}`;
            if (B) B.style.width = Math.round((i / count) * 100) + '%';
            await new Promise(r => setTimeout(r, 10));

            cfg.exportCount = (cfg.exportCount || 0) + 1;
            const seed = Date.now() + cfg.exportCount * 1_000_000;
            const exportId = makeExportId(seed);
            const sets = createQuestionSets(cfg, seed);
            if (!sets) continue;

            const setIndicator = count > 1 ? `SET ${i + 1}` : '';

            const addPage = () => {
                if (!isFirstPage) doc.addPage();
                isFirstPage = false;
                ctx.drawWatermark();
            };

            // Track visible question counts per difficulty.
            // Pages not in selectedPages default to 0 so their answers are excluded from the key.
            const visibleCounts = {
                easy:   selectedPages.includes('easy')   ? null : 0,
                medium: selectedPages.includes('medium') ? null : 0,
                hard:   selectedPages.includes('hard')   ? null : 0,
            };

            for (const pType of selectedPages) {
                await new Promise(r => setTimeout(r, 0));

                if (pType === 'easy') {
                    addPage();
                    const ps = getPScale('easy');
                    const sy = drawHeader(ctx, title, sub, '🌱 EASY — SOLVE EACH PROBLEM AND WRITE YOUR ANSWER.', false, setIndicator, ps, exportId, [16, 185, 129]);
                    const overflow = drawQuestionPage(ctx, sets.easy, sy, ps, exportId);
                    visibleCounts.easy = (sets.easy || []).length - overflow;

                } else if (pType === 'medium') {
                    addPage();
                    const ps = getPScale('medium');
                    const sy = drawHeader(ctx, title, sub, '⚡ MEDIUM — SOLVE EACH PROBLEM AND WRITE YOUR ANSWER.', false, setIndicator, ps, exportId, [245, 158, 11]);
                    const overflow = drawQuestionPage(ctx, sets.medium, sy, ps, exportId);
                    visibleCounts.medium = (sets.medium || []).length - overflow;

                } else if (pType === 'hard') {
                    addPage();
                    const ps = getPScale('hard');
                    const sy = drawHeader(ctx, title, sub, '🔥 HARD — SOLVE EACH PROBLEM AND WRITE YOUR ANSWER.', false, setIndicator, ps, exportId, [239, 68, 68]);
                    const overflow = drawQuestionPage(ctx, sets.hard, sy, ps, exportId);
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
                    drawKeyPage(ctx, keySets, sy, ps, exportId);
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
