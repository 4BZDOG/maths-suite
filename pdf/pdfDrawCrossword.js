// =============================================================
// pdf/pdfDrawCrossword.js — Maths Crossword PDF drawer
// (Updated: uses item.clue with LaTeX→Unicode conversion)
// =============================================================
import { latexToText } from './pdfHelpers.js';

/**
 * Draw a Maths Crossword puzzle (grid + clues) onto the PDF.
 *
 * @param {Object}  ctx     - buildCtx() result
 * @param {Object}  cwData  - puzzleData.cw
 * @param {Object}  layout  - { x, y, w, h } in mm
 * @param {boolean} isKey
 * @param {number}  pScale
 */
export function drawCrossword(ctx, cwData, layout, isKey, pScale) {
    if (!cwData || !cwData.placed.length) return;
    const { doc, PAGE_HEIGHT, PAGE_WIDTH, MARGIN, scale, mmToPt, pdfFont, drawWatermark } = ctx;
    pScale = pScale || scale;

    const maxCellSize = isKey ? 6 : 9;
    const cSize = Math.min(layout.w / cwData.cols, layout.h / cwData.rows, maxCellSize);
    const gridW = cSize * cwData.cols, gridH = cSize * cwData.rows;

    const ox = layout.x + (layout.w - gridW) / 2;
    const oy = isKey ? layout.y + (layout.h - gridH) / 2 : layout.y;

    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.4);

    const numFontSizePt  = Math.max(7.5, mmToPt(cSize) * 0.42);
    const charFontSizePt = mmToPt(cSize) * 0.65;

    for (let y = 0; y < cwData.rows; y++) {
        for (let x = 0; x < cwData.cols; x++) {
            const cell = cwData.grid[y][x];
            if (cell) {
                const cx = ox + x * cSize, cy = oy + y * cSize;
                doc.setFillColor(255, 255, 255);
                doc.rect(cx, cy, cSize, cSize, 'FD');

                if (cell.num && !isKey) {
                    doc.setFont(pdfFont, 'normal');
                    doc.setFontSize(numFontSizePt);
                    doc.setTextColor(15, 23, 42);
                    doc.text(cell.num.toString(), cx + cSize * 0.08, cy + cSize * 0.08, { baseline: 'top' });
                }
                if (isKey) {
                    doc.setFont(pdfFont, 'bold');
                    doc.setFontSize(charFontSizePt);
                    doc.setTextColor(220, 20, 60);
                    doc.text(cell.char, cx + cSize / 2, cy + cSize / 2 + cSize * 0.05, { align: 'center', baseline: 'middle' });
                }
            }
        }
    }

    if (!isKey) {
        const cluesY = oy + gridH + 10 * scale;
        const ac = cwData.placed.filter(w => w.dir === 'across').sort((a, b) => a.num - b.num);
        const dn = cwData.placed.filter(w => w.dir === 'down').sort((a, b) => a.num - b.num);
        const colW = layout.w / 2;
        const availH = PAGE_HEIGHT - MARGIN - cluesY;

        // Build display text for a clue item: use item.clue (math expression) with LaTeX→text
        const clueText = (w) => {
            const rawClue = w.clue || w.word || '';
            return `${w.num}. ${latexToText(rawClue)} (${w.word.length})`;
        };

        const calcColH = (list, fontPt) => {
            const lineH = fontPt * 4 / 9;
            const spacingH = fontPt * 1.5 / 9;
            const titleH = 5 * pScale;
            let h = titleH;
            doc.setFontSize(fontPt);
            list.forEach(w => {
                const lines = doc.splitTextToSize(clueText(w), colW - 10 * scale);
                h += lines.length * lineH + spacingH;
            });
            return h;
        };

        let fontPt = 9 * pScale;
        const MIN_PT = 5;
        if (availH > 0) {
            while (fontPt > MIN_PT) {
                if (Math.max(calcColH(ac, fontPt), calcColH(dn, fontPt)) <= availH) break;
                fontPt = Math.max(MIN_PT, fontPt - 0.25);
            }
        }

        const drawCol = (title, list, colX) => {
            if (!list.length) return;
            let y = cluesY;
            doc.setFont(pdfFont, 'bold');
            doc.setFontSize(10 * pScale);
            doc.setTextColor(15, 23, 42);
            doc.text(title, colX, y);
            doc.setDrawColor(100, 116, 139);
            doc.setLineWidth(0.15);
            doc.line(colX, y + 1.5 * scale, colX + colW - 4 * scale, y + 1.5 * scale);
            y += 5 * pScale;

            const lineH = fontPt * 4 / 9;
            const spacingH = fontPt * 1.5 / 9;
            doc.setFont(pdfFont, 'normal');
            doc.setFontSize(fontPt);
            doc.setTextColor(15, 23, 42);
            list.forEach(w => {
                const lines = doc.splitTextToSize(clueText(w), colW - 10 * scale);
                lines.forEach(line => { doc.text(line, colX, y); y += lineH; });
                y += spacingH;
            });
        };

        drawCol('ACROSS', ac, layout.x);
        drawCol('DOWN', dn, layout.x + colW);
    }
}
