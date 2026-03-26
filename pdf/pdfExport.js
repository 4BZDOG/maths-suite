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

let isExporting = false;

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
    const cols       = cfg.cols || 2;
    const showTopic  = cfg.showTopic || false;
    const capOnePage = cfg.psCapOnePage || false;
    const availW     = PAGE_WIDTH - MARGIN * 2;
    const colW       = (availW - (cols - 1) * 8) / cols;
    // Generous line spacing: working lines ~8mm, answer line ~8mm
    const workingLineSpacing = 8 * pScale;
    const answerLineSpacing  = 8 * pScale;
    const itemGap            = 6 * pScale;  // vertical gap between items

    let cy = startY, col = 0;
    let rowMaxH = 0;
    let onFirstPage = true;
    let overflowCount = 0;

    doc.setFont(pdfFont, 'normal');
    doc.setFontSize(9 * pScale);

    for (let i = 0; i < questions.length; i++) {
        const item = questions[i];

        // Pre-calculate item height to decide whether it fits
        const clueText   = latexToText(item.clue || '');
        const clueLines  = hasFraction(item.clue)
            ? [clueText]  // fraction renderer handles its own height; approximate as 1 line
            : doc.splitTextToSize(clueText, colW - 14);
        const clueBlockH = clueLines.length * 4.5 * pScale;

        const workingCount = item.difficulty === 'Hard' ? 2 : item.difficulty === 'Medium' ? 1 : 0;
        const tagH         = showTopic ? 4 * pScale : 0;
        const itemH        = clueBlockH
            + (workingCount > 0 ? 5 + workingCount * workingLineSpacing : 0)
            + answerLineSpacing + 12 * pScale
            + tagH
            + itemGap;

        // Check overflow — whether a new row would push past the bottom margin
        const isNewRow = cols === 2 ? col === 0 : true;
        if (isNewRow && cy + itemH > PAGE_HEIGHT - MARGIN - 10) {
            if (capOnePage && onFirstPage) {
                // Count remaining questions as overflow and stop
                overflowCount = questions.length - i;
                break;
            }
            // Overflow onto a new PDF page
            drawExportIdFooter(ctx, exportId, pScale);
            doc.addPage();
            drawWatermark();
            cy = MARGIN + 15 * scale;
            col = 0;
            rowMaxH = 0;
            onFirstPage = false;
        }

        const itemX = col === 0 ? MARGIN : MARGIN + colW + 8;
        let drawY = cy;

        // ── Question number (inline with clue) ──────────────────────
        doc.setFont(pdfFont, 'bold');
        doc.setFontSize(9 * pScale);
        doc.setTextColor(100, 116, 139);
        doc.text(`${i + 1}.`, itemX, drawY);

        // ── Clue text (starts same line as number) ──────────────────
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

        // ── Topic tag (below answer line) ────────────────────────────
        if (showTopic && item.topic) {
            const topicRgb = TOPIC_COLOURS_RGB[item.topic] || [100, 116, 139];
            nextY += 4 * pScale;
            doc.setFont(pdfFont, 'normal');
            doc.setFontSize(6 * pScale);
            doc.setTextColor(...topicRgb);
            doc.text(item.topic.toUpperCase(), clueX, nextY);
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

    drawExportIdFooter(ctx, exportId, pScale);
    return overflowCount;
}

/**
 * Draw the answer key page showing all 3 difficulty sets.
 */
function drawKeyPage(ctx, sets, startY, pScale, exportId) {
    const { doc, PAGE_WIDTH, PAGE_HEIGHT, MARGIN, scale, pdfFont } = ctx;
    pScale = pScale || scale;

    const sections = [
        { label: 'EASY',   rgb: DIFF_RGB.Easy,   questions: sets.easy   || [] },
        { label: 'MEDIUM', rgb: DIFF_RGB.Medium,  questions: sets.medium || [] },
        { label: 'HARD',   rgb: DIFF_RGB.Hard,    questions: sets.hard   || [] },
    ].filter(s => s.questions.length > 0);

    if (sections.length === 0) return;

    const availW = PAGE_WIDTH - MARGIN * 2;
    const colW   = (availW - (sections.length - 1) * 6) / sections.length;
    let cy = startY;

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
                img.onload  = () => res(img);
                img.onerror = () => res(null);
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

            for (const pType of selectedPages) {
                await new Promise(r => setTimeout(r, 0));

                if (pType === 'easy') {
                    addPage();
                    const ps = getPScale('easy');
                    const sy = drawHeader(ctx, title, sub, 'EASY — SOLVE EACH PROBLEM AND WRITE YOUR ANSWER.', false, setIndicator, ps, exportId, [16, 185, 129]);
                    drawQuestionPage(ctx, sets.easy, sy, ps, exportId, 'Easy');

                } else if (pType === 'medium') {
                    addPage();
                    const ps = getPScale('medium');
                    const sy = drawHeader(ctx, title, sub, 'MEDIUM — SOLVE EACH PROBLEM AND WRITE YOUR ANSWER.', false, setIndicator, ps, exportId, [245, 158, 11]);
                    drawQuestionPage(ctx, sets.medium, sy, ps, exportId, 'Medium');

                } else if (pType === 'hard') {
                    addPage();
                    const ps = getPScale('hard');
                    const sy = drawHeader(ctx, title, sub, 'HARD — SOLVE EACH PROBLEM AND WRITE YOUR ANSWER.', false, setIndicator, ps, exportId, [239, 68, 68]);
                    drawQuestionPage(ctx, sets.hard, sy, ps, exportId, 'Hard');

                } else if (pType === 'key') {
                    addPage();
                    const ps = getPScale('key');
                    const sy = drawHeader(ctx, title, sub, 'ANSWER KEY', true, setIndicator, ps, exportId);
                    drawKeyPage(ctx, sets, sy, ps, exportId);
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
