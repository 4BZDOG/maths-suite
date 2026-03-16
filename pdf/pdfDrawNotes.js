// =============================================================
// pdf/pdfDrawNotes.js
// =============================================================
import { drawHeader } from './pdfHelpers.js';
import { drawWordSearch } from './pdfDrawWordSearch.js';
import { drawCrossword } from './pdfDrawCrossword.js';
import { drawScramble } from './pdfDrawScramble.js';

/**
 * Draw the notes/vocabulary page.
 *
 * @param {Object} ctx       - buildCtx() result
 * @param {Array}  notesList - puzzleData.notes
 * @param {number} startY    - Y after the header
 * @param {number} pScale
 */
export function drawNotes(ctx, notesList, startY, pScale) {
    const { doc, PAGE_WIDTH, PAGE_HEIGHT, MARGIN, scale, pdfFont, drawWatermark, notesConfig } = ctx;
    pScale = pScale || scale;
    let cy = startY;
    const availW = PAGE_WIDTH - MARGIN * 2;

    // Determine if this is a matching exercise
    const isMatching = notesList.length > 0 && notesList[0].matchLetter !== undefined;

    // Respect showTerm / showDef from settings
    const showTerm = notesConfig ? notesConfig.showTerm !== false : true;
    const showDef = notesConfig ? notesConfig.showDef !== false : true;

    // Column positions — proportional to the user's term-width setting, not scale-dependent
    const numColW = isMatching ? 22 : 10;   // mm reserved for the # / "1. ____" column
    const termFrac = (notesConfig?.termWidth || 20) / 100;
    const termColW = Math.max(28, (availW - numColW) * termFrac);
    const termX = MARGIN + numColW;
    const defX = termX + termColW;
    const defW = availW - numColW - termColW;

    // Header row
    doc.setFont(pdfFont, 'bold');
    doc.setFontSize(10 * pScale);
    doc.setTextColor(100, 116, 139);
    doc.text('#', MARGIN, cy);
    if (showTerm) doc.text('TERM', termX, cy);
    if (showDef) doc.text('DEFINITION', defX, cy);

    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.4);
    doc.line(MARGIN, cy + 2 * scale, PAGE_WIDTH - MARGIN, cy + 2 * scale);
    cy += 8 * pScale;

    doc.setTextColor(15, 23, 42);
    notesList.forEach((w, i) => {
        const numStr = isMatching ? `${i + 1}. ____` : `${i + 1}.`;
        const clueStr = isMatching
            ? `${w.matchLetter}. ${w.clue} (${w.clueTermLength ?? w.term.length})`
            : `${w.clue} (${w.term.length})`;

        doc.setFont(pdfFont, 'bold');
        const tLines = showTerm ? doc.splitTextToSize(w.term, termColW - 4) : [];
        doc.setFont(pdfFont, 'normal');
        const dLines = showDef ? doc.splitTextToSize(clueStr, defW) : [];
        const maxLines = Math.max(tLines.length, dLines.length, 1);

        if (cy + (maxLines * 4.5 * pScale) > PAGE_HEIGHT - MARGIN) {
            doc.addPage();
            drawWatermark();
            cy = MARGIN + 10 * scale;
        }

        doc.setFont(pdfFont, 'bold');
        doc.setTextColor(100, 116, 139);
        doc.text(numStr, MARGIN, cy);

        doc.setTextColor(15, 23, 42);
        if (showTerm) doc.text(tLines, termX, cy);

        doc.setFont(pdfFont, 'normal');
        if (showDef) doc.text(dLines, defX, cy);

        cy += (maxLines * 4.5 * pScale) + 2 * pScale;
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.15);
        doc.line(MARGIN, cy - 1.5 * pScale, PAGE_WIDTH - MARGIN, cy - 1.5 * pScale);
        cy += 2.5 * pScale;
    });
}

/**
 * Draw the master answer key page (four-quadrant layout).
 *
 * @param {Object} ctx           - buildCtx() result
 * @param {string} fullTitle
 * @param {string} subText
 * @param {Object} currentPuzzleData
 * @param {Object} selections    - { ws, cw, scr, notes }
 * @param {number} pScale
 */
export function drawMasterKeyPage(ctx, fullTitle, subText, currentPuzzleData, selections, pScale) {
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
    const isMatching = currentPuzzleData.notes?.length > 0 && currentPuzzleData.notes[0].matchLetter !== undefined;
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
        const layout = drawBoxTitle('WORD SEARCH', boxes[bIdx]);
        drawWordSearch(ctx, currentPuzzleData.ws, layout, null, false, true, pScale);
        bIdx++;
    }
    if (selections.cw && currentPuzzleData.cw) {
        const layout = drawBoxTitle('CROSSWORD', boxes[bIdx]);
        drawCrossword(ctx, currentPuzzleData.cw, layout, true, pScale);
        bIdx++;
    }
    if (selections.scr && currentPuzzleData.scr) {
        const layout = drawBoxTitle('WORD SCRAMBLE', boxes[bIdx]);
        const modLayout = { ...layout, y: layout.y + 5 * scale, h: layout.h - 5 * scale };
        drawScramble(ctx, currentPuzzleData.scr, modLayout, true, false, pScale);
        bIdx++;
    }
    if (selections.notes && isMatching && currentPuzzleData.notes) {
        const layout = drawBoxTitle('MATCHING KEY', boxes[bIdx]);
        const numCols = 3;
        const itemsPerCol = Math.ceil(currentPuzzleData.notes.length / numCols);
        const colW = layout.w / numCols;
        const rowH = Math.min(8 * scale, layout.h / itemsPerCol);
        doc.setFontSize(Math.max(8, rowH * 1.5 * pScale));

        let cx = layout.x, cy = layout.y + rowH;
        currentPuzzleData.notes.forEach((n, i) => {
            if (i > 0 && i % itemsPerCol === 0) { cx += colW; cy = layout.y + rowH; }
            doc.setTextColor(15, 23, 42);
            doc.text(`${i + 1}. `, cx + 2, cy);
            doc.setFont(pdfFont, 'bold');
            doc.setTextColor(220, 20, 60);
            doc.text(n.correctLetter, cx + 12 * scale, cy);
            doc.setFont(pdfFont, 'normal');
            cy += rowH;
        });
    }
}
