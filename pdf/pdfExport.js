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
 * Draw outcome code chips in a horizontal row, wrapping to a new line when
 * the chips would exceed maxX. Returns the updated nextY after all chips.
 * Caller must advance nextY by 4*pScale before calling to create the gap.
 */
function _drawOutcomeChips(doc, codes, x, y, pScale, pdfFont, maxX, fontSizePt) {
    if (!codes.length) return y;
    doc.setFont(pdfFont, 'bold');
    doc.setFontSize(fontSizePt);
    const chipH = 3.5 * pScale;
    let chipX = x;
    codes.forEach(code => {
        const cw = doc.getTextWidth(code) + 4;
        if (chipX + cw > maxX && chipX > x) {
            chipX = x;
            y += chipH + 1;         // wrap to next row
        }
        doc.setFillColor(239, 238, 255);
        doc.roundedRect(chipX, y - 2.5 * pScale, cw, chipH, 1, 1, 'F');
        doc.setDrawColor(99, 102, 241);
        doc.setLineWidth(0.2);
        doc.roundedRect(chipX, y - 2.5 * pScale, cw, chipH, 1, 1, 'S');
        doc.setTextColor(99, 102, 241);
        doc.text(code, chipX + 2, y);
        chipX += cw + 2;
    });
    return y;
}

/**
 * Estimate the height (mm) that outcome chips will occupy for a set of codes
 * at a given pScale and column width. Used for pre-layout before drawing.
 */
function _estimateChipsHeight(doc, codes, colW, pScale, pdfFont, fontSizePt) {
    if (!codes.length) return 0;
    doc.setFont(pdfFont, 'bold');
    doc.setFontSize(fontSizePt);
    const chipH = 3.5 * pScale;
    let rows = 1;
    let lineW = 0;
    // Match the effective max width used by _drawOutcomeChips (itemX + colW - 2)
    // The clue indent is 9mm (clueX = itemX + 9), so available chip width is colW - 9 - 2.
    const maxW = colW - 11;
    codes.forEach(code => {
        const cw = doc.getTextWidth(code) + 4;
        if (lineW + cw > maxW && lineW > 0) {
            rows++;
            lineW = cw + 2;
        } else {
            lineW += cw + 2;
        }
    });
    return 4 * pScale + rows * chipH + (rows - 1) * 1;  // 4mm gap + all chip rows
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
    const cols             = cfg.cols || 2;
    const showTopic        = cfg.showTopic || false;
    const showOutcomeChips = cfg.psShowOutcomeChips || false;
    const capOnePage       = cfg.psCapOnePage || false;
    const stage            = DEFAULT_STAGE;
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
        const clueText   = latexToText(item.clue || '');
        const isFraction = hasFraction(item.clue);
        const clueLines  = isFraction
            ? [clueText]
            : doc.splitTextToSize(clueText, colW - 14);
        const clueBlockH = isFraction
            ? 3 * 4.5 * pScale
            : clueLines.length * 4.5 * pScale;

        const workingCount = item.difficulty === 'Hard' ? 2 : item.difficulty === 'Medium' ? 1 : 0;
        const tagH    = showTopic ? 4 * pScale : 0;
        // Use item.notes (specific sub-topic key) for outcome lookup — item.topic is broad category
        const itemCodes = showOutcomeChips && item.notes ? getTopicOutcomeCodes(item.notes, stage) : [];
        const chipsH    = itemCodes.length > 0
            ? _estimateChipsHeight(doc, itemCodes, colW, pScale, pdfFont, chipFontPt)
            : 0;
        const itemH = clueBlockH
            + (workingCount > 0 ? 5 + workingCount * workingLineSpacing : 0)
            + answerLineSpacing + 12 * pScale
            + tagH + chipsH + itemGap;

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

        // ── Topic tag ────────────────────────────────────────────────
        if (showTopic && item.topic) {
            const topicRgb = TOPIC_COLOURS_RGB[item.topic] || [100, 116, 139];
            nextY += 4 * pScale;
            doc.setFont(pdfFont, 'normal');
            doc.setFontSize(6 * pScale);
            doc.setTextColor(...topicRgb);
            doc.text(item.topic.toUpperCase(), clueX, nextY);
        }

        // ── Outcome chips (line-wrapped to column width) ─────────────
        if (itemCodes.length > 0) {
            nextY += 4 * pScale;
            nextY = _drawOutcomeChips(doc, itemCodes, clueX, nextY, pScale, pdfFont,
                itemX + colW - 2, chipFontPt);
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
            doc.line(cx, ky + 1.5 * pScale, cx + colW, ky + 1.5 * pScale);

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

            // Track how many questions actually rendered per difficulty (for cap-to-1-page).
            // Initialised to 0 so unselected difficulty pages contribute nothing to the key.
            const visibleCounts = { easy: 0, medium: 0, hard: 0 };

            for (const pType of selectedPages) {
                await new Promise(r => setTimeout(r, 0));

                if (pType === 'easy') {
                    addPage();
                    const ps = getPScale('easy');
                    const sy = drawHeader(ctx, title, sub, 'EASY — SOLVE EACH PROBLEM AND WRITE YOUR ANSWER.', false, setIndicator, ps, exportId, [16, 185, 129]);
                    const overflow = drawQuestionPage(ctx, sets.easy, sy, ps, exportId);
                    visibleCounts.easy = (sets.easy || []).length - overflow;

                } else if (pType === 'medium') {
                    addPage();
                    const ps = getPScale('medium');
                    const sy = drawHeader(ctx, title, sub, 'MEDIUM — SOLVE EACH PROBLEM AND WRITE YOUR ANSWER.', false, setIndicator, ps, exportId, [245, 158, 11]);
                    const overflow = drawQuestionPage(ctx, sets.medium, sy, ps, exportId);
                    visibleCounts.medium = (sets.medium || []).length - overflow;

                } else if (pType === 'hard') {
                    addPage();
                    const ps = getPScale('hard');
                    const sy = drawHeader(ctx, title, sub, 'HARD — SOLVE EACH PROBLEM AND WRITE YOUR ANSWER.', false, setIndicator, ps, exportId, [239, 68, 68]);
                    const overflow = drawQuestionPage(ctx, sets.hard, sy, ps, exportId);
                    visibleCounts.hard = (sets.hard || []).length - overflow;

                } else if (pType === 'key') {
                    addPage();
                    const ps = getPScale('key');
                    const sy = drawHeader(ctx, title, sub, 'ANSWER KEY', true, setIndicator, ps, exportId);
                    // Only key answers for questions that appeared on selected question pages.
                    const keySets = cfg.psCapOnePage ? {
                        easy:   (sets.easy   || []).slice(0, visibleCounts.easy),
                        medium: (sets.medium || []).slice(0, visibleCounts.medium),
                        hard:   (sets.hard   || []).slice(0, visibleCounts.hard),
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
        if (exportBtn) {
            exportBtn.disabled = false;
            exportBtn.innerHTML = exportBtnOrigHTML;
        }
        if (L) { L.style.opacity = '0'; setTimeout(() => L.style.display = 'none', 300); }
    }
}
