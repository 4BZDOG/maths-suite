// =============================================================
// pdf/pdfDrawScramble.js — Expression Scramble PDF drawer
// (Updated: shows clue below scrambled token)
// =============================================================
import { latexToText } from './pdfHelpers.js';

/**
 * Draw an Expression Scramble puzzle onto the PDF.
 *
 * @param {Object}  ctx      - buildCtx() result
 * @param {Array}   scrData  - puzzleData.scr [{original, scrambled, clue, answerDisplay}]
 * @param {Object}  layout   - { x, y, w, h }
 * @param {boolean} isKey
 * @param {boolean} showHint - first-char hint
 * @param {number}  pScale
 */
export function drawScramble(ctx, scrData, layout, isKey, showHint, pScale) {
    if (!scrData || !scrData.length) return;
    const { doc, scale, pdfFont } = ctx;
    pScale = pScale || scale;

    if (isKey) {
        const numCols    = 2;
        const itemsPerCol = Math.ceil(scrData.length / numCols);
        const colW = layout.w / numCols;
        const rowH = Math.min(8 * scale, layout.h / itemsPerCol);

        doc.setFontSize(Math.min(rowH * 2.5, Math.max(8, rowH * 1.5) * pScale));
        let cx = layout.x, cy = layout.y + rowH;

        scrData.forEach((s, i) => {
            if (i > 0 && i % itemsPerCol === 0) { cx += colW; cy = layout.y + rowH; }
            const splitX = cx + colW * 0.45;
            const display = s.answerDisplay || s.original || '';

            doc.setFont('courier', 'bold');
            doc.setTextColor(15, 23, 42);
            doc.text(s.scrambled, cx + 5 * scale, cy, { align: 'left' });

            doc.setDrawColor(100, 116, 139);
            doc.setLineWidth(0.2);
            doc.line(splitX, cy + 1, cx + colW - 2, cy + 1);

            doc.setFont(pdfFont, 'bold');
            doc.setTextColor(220, 20, 60);
            doc.text(display, cx + colW - 2, cy, { align: 'right' });

            cy += rowH;
        });
    } else {
        let cy = layout.y + 10 * scale;
        let cx = layout.x;
        const colW = layout.w / 2;

        scrData.forEach(s => {
            if (cy > ctx.PAGE_HEIGHT - ctx.MARGIN - 10 * scale) { cy = layout.y + 10 * scale; cx += colW; }

            // Scrambled token (prominent, monospace)
            doc.setFont('courier', 'bold');
            doc.setFontSize(14 * pScale);
            doc.setTextColor(15, 23, 42);
            doc.text(s.scrambled, cx + 10 * scale, cy, { align: 'left' });

            // Answer line
            doc.setDrawColor(15, 23, 42);
            doc.setLineWidth(0.4);
            const lineStartX = cx + colW * 0.40;
            const lineEndX = showHint ? cx + colW - 20 * scale : cx + colW - 10 * scale;
            doc.line(lineStartX, cy + 2 * scale, lineEndX, cy + 2 * scale);

            if (showHint && s.original) {
                doc.setFont(pdfFont, 'normal');
                doc.setFontSize(10 * pScale);
                doc.setTextColor(100, 116, 139);
                doc.text(`(starts: ${s.original[0]})`, lineEndX + 3 * scale, cy, { align: 'left' });
            }

            // Clue text below (LaTeX→text converted), smaller font
            if (s.clue) {
                const clueText = latexToText(s.clue);
                doc.setFont(pdfFont, 'italic');
                doc.setFontSize(8 * pScale);
                doc.setTextColor(100, 116, 139);
                const lines = doc.splitTextToSize(clueText, colW - 14 * scale);
                lines.forEach((line, li) => {
                    doc.text(line, cx + 10 * scale, cy + 6 * pScale + li * 4 * pScale);
                });
                cy += 6 * pScale + lines.length * 4 * pScale + 4 * pScale;
            } else {
                cy += 12 * pScale;
            }
        });
    }
}
