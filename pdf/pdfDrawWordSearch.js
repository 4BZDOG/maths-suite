// =============================================================
// pdf/pdfDrawWordSearch.js — Number Search PDF drawer
// (Updated: clue items instead of word strings)
// =============================================================
import { latexToText } from './pdfHelpers.js';

/**
 * Draw a Number Search puzzle page (grid + clue list) onto the PDF.
 *
 * @param {Object}  ctx       - buildCtx() result
 * @param {Object}  wsData    - puzzleData.ws
 * @param {Object}  layout    - { x, y, w, h } in mm
 * @param {Array}   _unused   - kept for API compat (was wordsList)
 * @param {boolean} isKey
 * @param {number}  pScale    - per-page font scale multiplier
 */
export function drawWordSearch(ctx, wsData, layout, _unused, isKey, pScale) {
    if (!wsData) return;
    const { doc, PAGE_HEIGHT, MARGIN, scale, mmToPt, pdfFont, drawWatermark } = ctx;
    pScale = pScale || scale;

    const maxCellSize = isKey ? 6 : 9;
    const cSize = Math.min(layout.w / wsData.size, layout.h / wsData.size, maxCellSize);
    const gridW = cSize * wsData.size;

    const ox = layout.x + (layout.w - gridW) / 2;
    const oy = isKey ? layout.y + (layout.h - gridW) / 2 : layout.y;

    doc.setLineWidth(0.3);
    const fontSizePt = mmToPt(cSize) * 0.60;
    const showInternalGrid = ctx.wsInternalGrid || false;

    for (let y = 0; y < wsData.size; y++) {
        for (let x = 0; x < wsData.size; x++) {
            const cx = ox + x * cSize, cy = oy + y * cSize;

            if (!isKey && showInternalGrid) {
                doc.setDrawColor(200);
                doc.rect(cx, cy, cSize, cSize, 'S');
            }

            doc.setFont('courier', 'bold');
            doc.setFontSize(fontSizePt);

            if (isKey) {
                doc.setDrawColor(0);
                doc.rect(cx, cy, cSize, cSize, 'S');
                if (wsData.solution && wsData.solution.has(`${x},${y}`)) {
                    doc.setTextColor(15, 23, 42);
                } else {
                    doc.setTextColor(200);
                    doc.setFont('courier', 'normal');
                }
            } else {
                doc.setTextColor(15, 23, 42);
            }

            doc.text(wsData.grid[y][x], cx + cSize / 2, cy + cSize / 2, { align: 'center', baseline: 'middle' });
        }
    }

    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.5);
    doc.rect(ox, oy, gridW, gridW, 'S');

    if (!isKey) {
        const bankY = oy + gridW + 10 * scale;
        doc.setFont(pdfFont, 'normal');
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(9 * pScale);

        // wsData.placed is now an array of clue items {answer, clue, ...}
        const placed = wsData.placed || [];
        const numCols = 2;
        const colWidth = gridW / numCols;
        const itemsPerCol = Math.ceil(placed.length / numCols);
        let cx = ox, cy = bankY;
        const sq = 2.5 * scale;

        placed.forEach((item, i) => {
            if (i > 0 && i % itemsPerCol === 0) { cx += colWidth; cy = bankY; }

            // Convert LaTeX clue to plain text for PDF
            const clue = typeof item === 'object' ? (item.clue || '') : '';
            const ans  = typeof item === 'object' ? (item.answer || item.token || item) : item;
            const displayText = clue
                ? `${i + 1}. ${latexToText(clue)} (${String(ans).length})`
                : `${i + 1}. ${ans}`;

            const lines = doc.splitTextToSize(displayText, colWidth - 8 * scale);

            if (cy + (lines.length * 4 * pScale) > PAGE_HEIGHT - MARGIN) {
                doc.addPage();
                drawWatermark();
                cy = MARGIN + 10 * scale;
            }

            doc.setDrawColor(100);
            doc.setLineWidth(0.3);
            doc.rect(cx, cy - sq + 0.5 * scale, sq, sq, 'S');
            lines.forEach((line, idx) => {
                doc.text(line, cx + 5 * scale, cy);
                if (idx < lines.length - 1) cy += 4 * pScale;
            });
            cy += 6 * pScale;
        });
    }
}
