// =============================================================
// pdf/pdfDrawProblemSet.js — Problem Set page PDF drawer
// Replaces pdfDrawNotes.js for the maths edition.
// =============================================================
import { drawHeader, drawExportIdFooter, latexToText } from './pdfHelpers.js';
import { drawWordSearch } from './pdfDrawWordSearch.js';
import { drawCrossword } from './pdfDrawCrossword.js';
import { drawScramble } from './pdfDrawScramble.js';

const TOPIC_COLOURS = {
    'Number':     [59, 130, 246],
    'Algebra':    [139, 92, 246],
    'Geometry':   [16, 185, 129],
    'Statistics': [245, 158, 11],
    'Financial Maths': [239, 68, 68],
};

/**
 * Draw the Problem Set page — a numbered list of maths problems
 * with blank answer lines.
 *
 * @param {Object} ctx       - buildCtx() result
 * @param {Array}  psItems   - puzzleData.ps (filtered clue bank items)
 * @param {number} startY    - Y after the header
 * @param {number} pScale
 * @param {string} exportId  - unique export identifier
 */
export function drawProblemSet(ctx, psItems, startY, pScale, exportId) {
    if (!psItems || !psItems.length) return;
    const { doc, PAGE_WIDTH, PAGE_HEIGHT, MARGIN, scale, pdfFont, drawWatermark, problemSetConfig } = ctx;
    pScale = pScale || scale;

    const cols      = problemSetConfig?.cols || 2;
    const showTopic = problemSetConfig?.showTopic || false;
    const availW    = PAGE_WIDTH - MARGIN * 2;
    const colW      = (availW - (cols - 1) * 8) / cols;
    const colX      = Array.from({ length: cols }, (_, c) => MARGIN + c * (colW + 8));
    const pageBottom = PAGE_HEIGHT - MARGIN - 10;
    const newPageY   = MARGIN + 15 * scale;

    let colY = colX.map(() => startY);

    const drawItem = (item, i) => {
        // Pre-measure so we can pick the shortest column AND check page bounds
        const clueText  = latexToText(item.clue || '');
        doc.setFont(pdfFont, 'normal');
        doc.setFontSize(9 * pScale);
        const clueLines = doc.splitTextToSize(clueText, colW - 14);
        const itemH     = clueLines.length * 4.5 * pScale + 10;

        // Place into the column with the smallest current y (balanced fill).
        let c = 0;
        for (let k = 1; k < cols; k++) if (colY[k] < colY[c]) c = k;

        // If even the shortest column would overflow the page, start a new page.
        if (colY[c] + itemH > pageBottom) {
            drawExportIdFooter(ctx, exportId, pScale);
            doc.addPage();
            drawWatermark();
            colY = colX.map(() => newPageY);
            c = 0;
        }

        const itemX = colX[c];
        const cy    = colY[c];

        doc.setFont(pdfFont, 'bold');
        doc.setFontSize(9 * pScale);
        doc.setTextColor(100, 116, 139);
        doc.text(`${i + 1}.`, itemX, cy);

        if (showTopic && item.topic) {
            const topicRgb = TOPIC_COLOURS[item.topic] || [100, 116, 139];
            doc.setFillColor(...topicRgb);
            doc.circle(itemX + 6, cy - 1.5, 1.2, 'F');
        }

        doc.setFont(pdfFont, 'normal');
        doc.setFontSize(9 * pScale);
        doc.setTextColor(15, 23, 42);
        clueLines.forEach((line, li) => {
            doc.text(line, itemX + 10, cy + li * 4.5 * pScale);
        });

        const lineY = cy + clueLines.length * 4.5 * pScale + 2;

        doc.setFont(pdfFont, 'normal');
        doc.setFontSize(8 * pScale);
        doc.setTextColor(100, 116, 139);
        doc.text('Ans:', itemX + 10, lineY);
        doc.setDrawColor(100, 116, 139);
        doc.setLineWidth(0.3);
        doc.line(itemX + 20, lineY, itemX + colW - 4, lineY);

        colY[c] += itemH;
    };

    psItems.forEach(drawItem);

    drawExportIdFooter(ctx, exportId, pScale);
}

/**
 * Draw the master answer key page (three-quadrant layout for maths edition).
 */
export function drawMasterKeyPage(ctx, fullTitle, subText, currentPuzzleData, selections, pScale, exportId) {
    const { doc, PAGE_WIDTH, PAGE_HEIGHT, MARGIN, scale, pdfFont, drawWatermark } = ctx;
    pScale = pScale || scale;

    doc.setFont(pdfFont, 'bold');
    doc.setFontSize(28 * pScale);
    doc.setTextColor(15, 23, 42);
    doc.text(fullTitle.toUpperCase(), MARGIN, MARGIN + 10 * pScale);

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(11 * pScale);
    doc.setTextColor(100, 116, 139);
    doc.text(subText, MARGIN, MARGIN + 18 * pScale);

    doc.setFont(pdfFont, 'bold');
    doc.setFontSize(12 * pScale);
    doc.setTextColor(220, 20, 60);
    doc.text('TEACHER ANSWER KEY', PAGE_WIDTH - MARGIN, MARGIN + 10 * pScale, { align: 'right' });

    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.4);
    doc.line(MARGIN, MARGIN + 25 * scale, PAGE_WIDTH - MARGIN, MARGIN + 25 * scale);

    const startY = MARGIN + 35 * scale;
    const availW = PAGE_WIDTH - 2 * MARGIN, availH = PAGE_HEIGHT - startY - MARGIN;
    const qW = (availW - 10) / 2, qH = (availH - 10) / 2;

    const boxes = [
        { x: MARGIN, y: startY, w: qW, h: qH },
        { x: MARGIN + qW + 10, y: startY, w: qW, h: qH },
        { x: MARGIN, y: startY + qH + 10, w: qW, h: qH },
        { x: MARGIN + qW + 10, y: startY + qH + 10, w: qW, h: qH },
    ];

    const drawBoxTitle = (title, box) => {
        doc.setLineDashPattern([2, 2], 0);
        doc.setDrawColor(200);
        doc.setLineWidth(0.15);
        doc.roundedRect(box.x, box.y, box.w, box.h, 4, 4, 'S');
        doc.setLineDashPattern([], 0);

        doc.setFont(pdfFont, 'bold');
        doc.setFontSize(10 * pScale);
        doc.setTextColor(99, 102, 241);
        doc.text(title, box.x + 5 * scale, box.y + 8 * pScale);

        doc.setDrawColor(99, 102, 241);
        doc.setLineWidth(0.15);
        doc.line(box.x + 5 * scale, box.y + 11 * scale, box.x + box.w - 5 * scale, box.y + 11 * scale);

        return { x: box.x + 5 * scale, y: box.y + 15 * scale, w: box.w - 10 * scale, h: box.h - (15 * scale + 5) };
    };

    let bIdx = 0;
    if (selections.ws && currentPuzzleData.ws) {
        const layout = drawBoxTitle('NUMBER SEARCH', boxes[bIdx]);
        drawWordSearch(ctx, currentPuzzleData.ws, layout, null, true, pScale);
        bIdx++;
    }
    if (selections.cw && currentPuzzleData.cw) {
        const layout = drawBoxTitle('MATHS CROSSWORD', boxes[bIdx]);
        drawCrossword(ctx, currentPuzzleData.cw, layout, true, pScale);
        bIdx++;
    }
    if (selections.scr && currentPuzzleData.scr) {
        const layout = drawBoxTitle('EXPRESSION SCRAMBLE', boxes[bIdx]);
        const modLayout = { ...layout, y: layout.y + 5 * scale, h: layout.h - 5 * scale };
        drawScramble(ctx, currentPuzzleData.scr, modLayout, true, false, pScale);
        bIdx++;
    }

    drawExportIdFooter(ctx, exportId, pScale);
}
