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

    const cols    = problemSetConfig?.cols || 2;
    const showTopic = problemSetConfig?.showTopic || false;
    const availW  = PAGE_WIDTH - MARGIN * 2;
    const colW    = (availW - (cols - 1) * 8) / cols;
    const rowH    = 18 * pScale;   // approx height per problem including answer line

    let cx = MARGIN;
    let cy = startY;
    let col = 0;

    doc.setFont(pdfFont, 'normal');
    doc.setFontSize(9 * pScale);

    psItems.forEach((item, i) => {
        // Check if we need a new page
        if (cy + rowH > PAGE_HEIGHT - MARGIN - 10) {
            drawExportIdFooter(ctx, exportId, pScale);
            doc.addPage();
            drawWatermark();
            cx = MARGIN;
            cy = MARGIN + 15 * scale;
            col = 0;
        }

        const itemX = col === 0 ? MARGIN : MARGIN + colW + 8;

        // Problem number
        doc.setFont(pdfFont, 'bold');
        doc.setFontSize(9 * pScale);
        doc.setTextColor(100, 116, 139);
        doc.text(`${i + 1}.`, itemX, cy);

        // Topic badge (small coloured dot)
        if (showTopic && item.topic) {
            const topicRgb = TOPIC_COLOURS[item.topic] || [100, 116, 139];
            doc.setFillColor(...topicRgb);
            doc.circle(itemX + 6, cy - 1.5, 1.2, 'F');
        }

        // Clue text (LaTeX converted to Unicode)
        const clueText = latexToText(item.clue || '');
        doc.setFont(pdfFont, 'normal');
        doc.setFontSize(9 * pScale);
        doc.setTextColor(15, 23, 42);
        const clueLines = doc.splitTextToSize(clueText, colW - 14);
        clueLines.forEach((line, li) => {
            doc.text(line, itemX + 10, cy + li * 4.5 * pScale);
        });

        const lineY = cy + clueLines.length * 4.5 * pScale + 2;

        // "Answer: ___" line
        doc.setFont(pdfFont, 'normal');
        doc.setFontSize(8 * pScale);
        doc.setTextColor(100, 116, 139);
        doc.text('Ans:', itemX + 10, lineY);
        doc.setDrawColor(100, 116, 139);
        doc.setLineWidth(0.3);
        doc.line(itemX + 20, lineY, itemX + colW - 4, lineY);

        const itemH = clueLines.length * 4.5 * pScale + 10;

        // Move to next column or next row
        if (cols === 2) {
            if (col === 0) {
                col = 1;
            } else {
                col = 0;
                cy += itemH;
            }
        } else {
            cy += itemH;
        }
    });

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
