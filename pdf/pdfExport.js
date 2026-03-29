// =============================================================
// pdf/pdfExport.js — PDF export orchestrator (Maths Question Sets Edition)
// =============================================================
import { state, syncSettingsFromDOM } from '../core/state.js';
import { showToast } from '../ui/toast.js';
import { generateMathsQuestions } from '../generators/mathsQuestionGen.js';
import { loadJSPDF, loadFontForPDF, FONT_SELECT_MAP } from './pdfFonts.js';
import { buildCtx, drawHeader, drawExportIdFooter, makeExportId, latexToText, hasFraction, drawFractionClue } from './pdfHelpers.js';
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

function _triLines(doc, pts, style) {
    // Draw a closed triangle given 3 {x,y} vertices using jsPDF lines()
    const [A, B, C] = pts;
    doc.lines([[B.x - A.x, B.y - A.y], [C.x - B.x, C.y - B.y]], A.x, A.y, [1, 1], style, true);
}

function _rightAnglePDF(doc, vx, vy, sq) {
    // Small square right-angle marker at vertex (vx,vy); sq = side length mm
    doc.setDrawColor(..._GC);
    doc.lines([[sq, 0], [0, -sq], [-sq, 0]], vx, vy, [1, 1], 'S', true);
}

function _drawRectDiagramPDF(doc, { l, w: wv }, x0, y0, w, h, ps, font) {
    const aspect = l / wv;
    const maxW = w * 0.68, maxH = h * 0.68;
    let dw = aspect >= maxW / maxH ? maxW : maxH * aspect;
    let dh = aspect >= maxW / maxH ? maxW / aspect : maxH;
    dw = Math.max(10, Math.min(maxW, dw));
    dh = Math.max(7,  Math.min(maxH, dh));

    const rx = x0 + (w - dw) / 2;
    const ry = y0 + (h - dh) / 2 - 1;

    doc.setFillColor(..._GCF);
    doc.setDrawColor(..._GC);
    doc.setLineWidth(0.45 * ps);
    doc.rect(rx, ry, dw, dh, 'FD');

    // Length label (below, centred)
    doc.setFont(font, 'normal');
    doc.setFontSize(7.5 * ps);
    doc.setTextColor(..._LC);
    doc.text(String(l), rx + dw / 2, ry + dh + 3.2 * ps, { align: 'center' });

    // Width label (left side, rotated 90°)
    doc.text(String(wv), rx - 3.5 * ps, ry + dh / 2, { angle: 90, align: 'center' });

    // Missing "?" in centre
    doc.setFont(font, 'bold');
    doc.setFontSize(9 * ps);
    doc.setTextColor(..._MC);
    doc.text('?', rx + dw / 2, ry + dh / 2 + 1.5 * ps, { align: 'center' });
}

function _drawRightTriDiagramPDF(doc, { a, b, c, missing }, x0, y0, w, h, ps, font) {
    const maxW = w * 0.62, maxH = h * 0.74;
    const sc  = Math.min(maxW / a, maxH / b);
    const aPx = Math.max(9, Math.min(maxW, a * sc));
    const bPx = Math.max(7, Math.min(maxH, b * sc));

    const Ax = x0 + (w - aPx) / 2 - 3;
    const Ay = y0 + h - 4.5 * ps;
    const A = { x: Ax, y: Ay };
    const B = { x: Ax + aPx, y: Ay };
    const C = { x: Ax, y: Ay - bPx };

    doc.setFillColor(..._GCF);
    doc.setDrawColor(..._GC);
    doc.setLineWidth(0.45 * ps);
    _triLines(doc, [A, B, C], 'FD');

    const sq = 2.2 * ps;
    doc.setLineWidth(0.35 * ps);
    _rightAnglePDF(doc, Ax, Ay, sq);

    const aLabel = missing === 'a' ? '?' : String(a);
    const bLabel = missing === 'b' ? '?' : String(b);
    const cLabel = missing === 'c' ? 'c = ?' : `c = ${c}`;

    // Leg a
    doc.setFont(font, missing === 'a' ? 'bold' : 'normal');
    doc.setFontSize(7.5 * ps);
    doc.setTextColor(...(missing === 'a' ? _MC : _LC));
    doc.text(aLabel, (Ax + Ax + aPx) / 2, Ay + 3.2 * ps, { align: 'center' });

    // Leg b (rotated)
    doc.setFont(font, missing === 'b' ? 'bold' : 'normal');
    doc.setTextColor(...(missing === 'b' ? _MC : _LC));
    doc.text(bLabel, Ax - 3.5 * ps, (Ay + Ay - bPx) / 2, { angle: 90, align: 'center' });

    // Hypotenuse (midpoint + small offset outward)
    const hmx = (B.x + C.x) / 2 + 3.5 * ps;
    const hmy = (B.y + C.y) / 2;
    doc.setFont(font, missing === 'c' ? 'bold' : 'normal');
    doc.setFontSize(7 * ps);
    doc.setTextColor(...(missing === 'c' ? _MC : _LC));
    doc.text(cLabel, hmx, hmy, { align: 'left' });
}

function _drawTriAnglesDiagramPDF(doc, { a1, a2, a3, missing }, x0, y0, w, h, ps, font) {
    const triW = w * 0.7;
    const triH = h * 0.62;
    const cx = x0 + w / 2;
    const by = y0 + h - 4 * ps;

    const A = { x: cx - triW / 2, y: by };
    const B = { x: cx + triW / 2, y: by };
    const C = { x: cx, y: by - triH };

    doc.setFillColor(..._GCF);
    doc.setDrawColor(..._GC);
    doc.setLineWidth(0.45 * ps);
    _triLines(doc, [A, B, C], 'FD');

    const a3Label = missing === 'a3' ? '?' : `${a3}\u00B0`;

    doc.setFontSize(7.5 * ps);

    doc.setFont(font, 'normal');
    doc.setTextColor(..._LC);
    doc.text(`${a1}\u00B0`, A.x + 2, A.y + 3 * ps, { align: 'left' });
    doc.text(`${a2}\u00B0`, B.x - 2, B.y + 3 * ps, { align: 'right' });

    doc.setFont(font, missing === 'a3' ? 'bold' : 'normal');
    doc.setTextColor(...(missing === 'a3' ? _MC : _LC));
    doc.text(a3Label, C.x, C.y - 2.5 * ps, { align: 'center' });
}

function _drawTriAreaDiagramPDF(doc, { base, height }, x0, y0, w, h, ps, font) {
    const triW = w * 0.7;
    const ratio = height / base;
    const triH = Math.max(7, Math.min(h * 0.64, triW * ratio * 0.58));
    const cx = x0 + w / 2;
    const by = y0 + h - 4.5 * ps;

    const bl = { x: cx - triW / 2, y: by };
    const br = { x: cx + triW / 2, y: by };
    const ap = { x: cx, y: by - triH };

    doc.setFillColor(..._GCF);
    doc.setDrawColor(..._GC);
    doc.setLineWidth(0.45 * ps);
    _triLines(doc, [bl, br, ap], 'FD');

    // Dashed height line
    doc.setLineDashPattern([1.2, 1.2], 0);
    doc.setDrawColor(..._GC);
    doc.setLineWidth(0.3 * ps);
    doc.line(ap.x, ap.y, ap.x, by);
    doc.setLineDashPattern([], 0);

    // Right-angle mark at height foot
    const sq = 1.8 * ps;
    doc.setLineWidth(0.3 * ps);
    _rightAnglePDF(doc, ap.x, by, sq);

    doc.setFontSize(7.5 * ps);

    // Base label
    doc.setFont(font, 'normal');
    doc.setTextColor(..._LC);
    doc.text(String(base), cx, by + 3.2 * ps, { align: 'center' });

    // Height label
    doc.text(`h=${height}`, ap.x + 2.5 * ps, (ap.y + by) / 2, { align: 'left' });

    // Missing "?" for area
    doc.setFont(font, 'bold');
    doc.setTextColor(..._MC);
    doc.setFontSize(8.5 * ps);
    doc.text('?', cx - 7 * ps, (ap.y + by) / 2 + 1, { align: 'center' });
}

function _drawCircleDiagramPDF(doc, { r, missing }, x0, y0, w, h, ps, font) {
    const maxR = Math.min(w * 0.22, h * 0.42);
    const rPx  = Math.max(4, Math.min(maxR, r * 1.3 * ps));
    const cx   = x0 + w * 0.36;
    const cy   = y0 + h / 2;

    doc.setFillColor(..._GCF);
    doc.setDrawColor(..._GC);
    doc.setLineWidth(0.45 * ps);
    doc.circle(cx, cy, rPx, 'FD');

    // Dashed radius
    doc.setLineDashPattern([1.2, 1.2], 0);
    doc.setDrawColor(..._GC);
    doc.setLineWidth(0.3 * ps);
    doc.line(cx, cy, cx + rPx, cy);
    doc.setLineDashPattern([], 0);

    // Centre dot
    doc.setFillColor(..._GC);
    doc.circle(cx, cy, 0.7, 'F');

    doc.setFontSize(7 * ps);
    doc.setFont(font, 'normal');
    doc.setTextColor(..._LC);
    doc.text(`r = ${r}`, cx + rPx / 2, cy - 2 * ps, { align: 'center' });

    const missText = missing === 'area' ? 'A = ?' : 'C = ?';
    doc.setFont(font, 'bold');
    doc.setFontSize(8.5 * ps);
    doc.setTextColor(..._MC);
    doc.text(missText, cx + rPx + 4.5 * ps, cy + 1.5 * ps, { align: 'left' });
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

const DIFF_RGB = { Easy: [16, 185, 129], Medium: [245, 158, 11], Hard: [239, 68, 68] };

/**
 * Generate a fresh set of questions for one export copy.
 */
function createQuestionSets(cfg, seed) {
    const topics = Object.keys(state.selectedTopics).filter(t => state.selectedTopics[t]);
    if (topics.length === 0) return null;
    const n = state.questionsPerSet || 10;
    const subOpsFilter = Object.keys(state.selectedSubOps).length > 0 ? state.selectedSubOps : null;
    return {
        easy:   generateMathsQuestions({ subTopics: topics, subOpsFilter, difficulty: 'Easy',   count: n, seed }),
        medium: generateMathsQuestions({ subTopics: topics, subOpsFilter, difficulty: 'Medium', count: n, seed: seed + 1 }),
        hard:   generateMathsQuestions({ subTopics: topics, subOpsFilter, difficulty: 'Hard',   count: n, seed: seed + 2 }),
    };
}

/**
 * Draw a question page (Easy / Medium / Hard) in PDF.
 * Returns the number of questions that did NOT fit (overflow count).
 */
function drawQuestionPage(ctx, questions, startY, pScale, exportId, diffLabel) {
    if (!questions || !questions.length) return 0;
    const { doc, PAGE_WIDTH, PAGE_HEIGHT, MARGIN, scale, pdfFont, drawWatermark } = ctx;
    pScale = pScale || scale;

    const cfg = state.settings;
    const cols             = cfg.cols || 2;
    const showTopic        = cfg.showTopic || false;
    const showOutcomeChips = cfg.psShowOutcomeChips || false;
    const capOnePage       = cfg.psCapOnePage || false;
    const showDiagrams     = cfg.showDiagrams !== false;   // default true
    const stage            = DEFAULT_STAGE;
    const DIAG_H           = 22 * pScale;  // allocated height (mm) per diagram
    const availW           = PAGE_WIDTH - MARGIN * 2;
    const colW             = (availW - (cols - 1) * 8) / cols;
    const chipFontPt       = 5.5 * pScale;
    const workingLineSpacing = 8 * pScale;
    const answerLineSpacing  = 8 * pScale;
    const itemGap            = 6 * pScale;

    let cy          = startY, col = 0;
    let rowMaxH     = 0;
    let overflowCount = 0;
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
            + (hasDiagram ? DIAG_H + 2 * pScale : 0)
            + (workingCount > 0 ? 5 + workingCount * workingLineSpacing : 0)
            + answerLineSpacing + 12 * pScale
            + metaH + itemGap;

        // Overflow check — only fires at row start for 2-column layout
        const isNewRow = cols === 2 ? col === 0 : true;
        if (isNewRow && cy + itemH > PAGE_HEIGHT - MARGIN - 10) {
            if (capOnePage) {
                overflowCount = questions.length - i;
                break;
            }
            // Draw divider for this page before flipping to next
            if (cols === 2) _drawColumnDivider(doc, MARGIN, colW, pageStartY, cy);
            drawExportIdFooter(ctx, exportId, pScale);
            doc.addPage();
            drawWatermark();
            pageStartY = MARGIN + 15 * scale;
            cy         = pageStartY;
            col        = 0;
            rowMaxH    = 0;
        }

        const itemX = col === 0 ? MARGIN : MARGIN + colW + 8;
        let drawY = cy;

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
            doc.setFont(pdfFont, 'normal');
            doc.setFontSize(9 * pScale);
            doc.setTextColor(15, 23, 42);
            clueLines.forEach((line, li) => {
                doc.text(line, clueX, drawY + li * 4.5 * pScale);
            });
            clueEndY = drawY + clueBlockH;
        }

        let nextY = clueEndY + 5;

        // ── Geometry diagram ─────────────────────────────────────────
        if (hasDiagram) {
            _drawDiagramInPDF(doc, item.diagram, itemX + 9, nextY, colW - 13, DIAG_H, pScale, pdfFont);
            nextY += DIAG_H + 2 * pScale;
        }

        // ── Working lines ────────────────────────────────────────────
        if (workingCount > 0) {
            doc.setFont(pdfFont, 'normal');
            doc.setFontSize(6.5 * pScale);
            doc.setTextColor(160, 170, 185);
            doc.text('Working:', clueX, nextY);
            nextY += 2;
            for (let wl = 0; wl < workingCount; wl++) {
                nextY += workingLineSpacing;
                doc.setDrawColor(200, 210, 225);
                doc.setLineWidth(0.25);
                doc.setLineDashPattern([0.6, 1.4], 0);
                doc.line(clueX, nextY, itemX + colW - 4, nextY);
                doc.setLineDashPattern([], 0);
            }
            nextY += 5;
        }

        // ── Answer line ──────────────────────────────────────────────
        const lineY = nextY + answerLineSpacing;
        doc.setFont(pdfFont, 'normal');
        doc.setFontSize(8 * pScale);
        doc.setTextColor(100, 116, 139);
        doc.text('Answer:', clueX, lineY);
        doc.setDrawColor(150, 160, 180);
        doc.setLineWidth(0.4);
        doc.setLineDashPattern([0.8, 1.2], 0);
        doc.line(clueX + 19, lineY, itemX + colW - 4, lineY);
        doc.setLineDashPattern([], 0);
        nextY = lineY;

        // ── Meta row: topic pill + outcome chips, centered in column ──
        if (hasMeta) {
            nextY += 4 * pScale;
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
                        doc.setFont(pdfFont, 'bold');
                        doc.setFontSize(chipFontPt);
                        doc.setFillColor(239, 238, 255);
                        doc.roundedRect(px, pillTop, p.w, chipH, 1, 1, 'F');
                        doc.setDrawColor(99, 102, 241);
                        doc.setLineWidth(0.2);
                        doc.roundedRect(px, pillTop, p.w, chipH, 1, 1, 'S');
                        doc.setTextColor(99, 102, 241);
                        doc.text(p.text, px + 2, nextY);
                    }
                    px += p.w + gap;
                }
                nextY += chipH + 1;
            }
            nextY -= 1;  // remove trailing inter-row gap
        }

        const actualItemH = nextY - cy + itemGap;
        rowMaxH = Math.max(rowMaxH, actualItemH);

        if (cols === 2) {
            if (col === 0) {
                col = 1;
            } else {
                col = 0;
                cy += rowMaxH;
                rowMaxH = 0;
            }
        } else {
            cy += actualItemH;
        }
    }

    // Flush last partial row
    if (cols === 2 && col === 1) cy += rowMaxH;

    // Draw column divider for this (final) page
    if (cols === 2) _drawColumnDivider(doc, MARGIN, colW, pageStartY, cy);

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
        { label: 'EASY',   rgb: DIFF_RGB.Easy,   questions: sets.easy   || [] },
        { label: 'MEDIUM', rgb: DIFF_RGB.Medium,  questions: sets.medium || [] },
        { label: 'HARD',   rgb: DIFF_RGB.Hard,    questions: sets.hard   || [] },
    ].filter(s => s.questions.length > 0);

    if (sections.length === 0) { drawExportIdFooter(ctx, exportId, pScale); return; }

    const colW = (availW - (sections.length - 1) * 6) / sections.length;

    sections.forEach((sec, si) => {
        const cx = MARGIN + si * (colW + 6);

        // Section title
        doc.setFont(pdfFont, 'bold');
        doc.setFontSize(9 * pScale);
        doc.setTextColor(...sec.rgb);
        doc.text(sec.label, cx, cy);
        doc.setDrawColor(...sec.rgb);
        doc.setLineWidth(0.4);
        doc.line(cx, cy + 2 * scale, cx + colW, cy + 2 * scale);

        let ky = cy + 8 * pScale;

        sec.questions.forEach((q, i) => {
            if (ky + 7 * pScale > PAGE_HEIGHT - MARGIN) return;

            const clueText = latexToText(q.clue || '');
            const ansText  = String(q.answerDisplay || q.answer || '');

            doc.setFont(pdfFont, 'normal');
            doc.setFontSize(7 * pScale);
            doc.setTextColor(100, 116, 139);
            const maxClue = Math.floor(colW / (2.2 * pScale));
            const clueShort = clueText.length > maxClue ? clueText.slice(0, maxClue - 2) + '…' : clueText;
            doc.text(`${i + 1}. ${clueShort}`, cx, ky);

            doc.setFont(pdfFont, 'bold');
            doc.setFontSize(8 * pScale);
            doc.setTextColor(...sec.rgb);
            doc.text(ansText, cx + colW, ky, { align: 'right' });

            doc.setDrawColor(220, 220, 220);
            doc.setLineWidth(0.1);
            doc.line(cx, ky + 1.5 * scale, cx + colW, ky + 1.5 * scale);

            ky += 6 * pScale;
        });
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
    if (exportBtn) exportBtn.disabled = true;

    const cfg = state.settings;
    const pageOrder   = cfg.pageOrder || ['easy', 'medium', 'hard', 'key'];
    const selections  = cfg.opts;
    const selectedPages = pageOrder.filter(p => selections[p]);

    if (selectedPages.length === 0) {
        showToast('Select at least one page.', 'error');
        isExporting = false;
        if (exportBtn) exportBtn.disabled = false;
        return;
    }

    const L = document.getElementById('loading-overlay');
    const T = document.getElementById('loading-text');
    const B = document.getElementById('loading-progress');

    const title    = cfg.title || 'Maths Quiz';
    const sub      = cfg.sub   || '';
    // PAYMENTS: clamp bulk count to tier limit (free = 1, pro = up to 50)
    const count    = (() => {
        const el = document.getElementById('bulkCount');
        const requested = el ? Math.min(50, Math.max(1, parseInt(el.value, 10) || 1)) : 1;
        const clamped = clampBulkExportCount(requested);
        if (clamped < requested) showToast(`Bulk export limited to ${FREE_LIMITS.BULK_EXPORT_MAX} on the free plan.`, 'warning');
        return clamped;
    })();
    const filename = (() => { const el = document.getElementById('exportFilename'); return el ? el.value : 'MathsQuiz'; })()
        .replace(/[^a-z0-9-_]/gi, '_');

    if (L) { L.style.display = 'flex'; L.style.opacity = '1'; }
    if (T) T.innerText = 'Starting Export...';

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

            // Track how many questions actually rendered per difficulty (for cap-to-1-page)
            const visibleCounts = { easy: null, medium: null, hard: null };

            for (const pType of selectedPages) {
                await new Promise(r => setTimeout(r, 0));

                if (pType === 'easy') {
                    addPage();
                    const ps = getPScale('easy');
                    const sy = drawHeader(ctx, title, sub, 'EASY — SOLVE EACH PROBLEM AND WRITE YOUR ANSWER.', false, setIndicator, ps, exportId, [16, 185, 129]);
                    const overflow = drawQuestionPage(ctx, sets.easy, sy, ps, exportId, 'Easy');
                    visibleCounts.easy = (sets.easy || []).length - overflow;

                } else if (pType === 'medium') {
                    addPage();
                    const ps = getPScale('medium');
                    const sy = drawHeader(ctx, title, sub, 'MEDIUM — SOLVE EACH PROBLEM AND WRITE YOUR ANSWER.', false, setIndicator, ps, exportId, [245, 158, 11]);
                    const overflow = drawQuestionPage(ctx, sets.medium, sy, ps, exportId, 'Medium');
                    visibleCounts.medium = (sets.medium || []).length - overflow;

                } else if (pType === 'hard') {
                    addPage();
                    const ps = getPScale('hard');
                    const sy = drawHeader(ctx, title, sub, 'HARD — SOLVE EACH PROBLEM AND WRITE YOUR ANSWER.', false, setIndicator, ps, exportId, [239, 68, 68]);
                    const overflow = drawQuestionPage(ctx, sets.hard, sy, ps, exportId, 'Hard');
                    visibleCounts.hard = (sets.hard || []).length - overflow;

                } else if (pType === 'key') {
                    addPage();
                    const ps = getPScale('key');
                    const sy = drawHeader(ctx, title, sub, 'ANSWER KEY', true, setIndicator, ps, exportId);
                    // Trim answer key to only questions that were rendered on question pages
                    const keySets = cfg.psCapOnePage ? {
                        easy:   (sets.easy   || []).slice(0, visibleCounts.easy   ?? (sets.easy   || []).length),
                        medium: (sets.medium || []).slice(0, visibleCounts.medium ?? (sets.medium || []).length),
                        hard:   (sets.hard   || []).slice(0, visibleCounts.hard   ?? (sets.hard   || []).length),
                    } : sets;
                    drawKeyPage(ctx, keySets, sy, ps, exportId);
                }
            }
        }

        if (T) T.innerText = 'Saving PDF...';
        if (B) B.style.width = '100%';
        await new Promise(r => setTimeout(r, 100));

        doc.save(filename + '.pdf');
        showToast('PDF exported successfully!');

    } catch (e) {
        console.error(e);
        showToast('PDF export failed. Check internet connection for required libraries.', 'error');
    } finally {
        isExporting = false;
        if (exportBtn) exportBtn.disabled = false;
        if (L) { L.style.opacity = '0'; setTimeout(() => L.style.display = 'none', 300); }
    }
}
